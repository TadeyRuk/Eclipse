/**
 * Run createPayroll → fund → distribute → claim against a Preprod/Preview contract. Uses the same
 * seed wallet + Midnight.js providers as deploy.ts — proves real on-chain circuits. fund deposits
 * real tNIGHT: the wallet balances the contract's unshielded input.
 *
 * Usage:
 *   MIDNIGHT_NETWORK=preprod npm run lifecycle -w @eclipse/contracts
 *
 * LIFECYCLE_DEPLOY=1 deploys a fresh instance for this run instead of reading an address, and
 * LIFECYCLE_SPARES=N also deploys N untouched instances for the Lace demo, written to
 * docs/evidence/l3-demo-addresses-{network}.txt. Every instance is one payroll run, and a cold
 * Preprod dust sync takes hours, so doing all deploys inside one sync saves a second sync.
 *
 * Resumable: the wallet sync is checkpointed (walletState.ts) and run progress — deployed
 * addresses, salts, tx ids — is kept in contracts/.states/lifecycle-run-{network}.json. A
 * restart skips finished deploys and resumes at the contract's on-chain status. After success,
 * re-running is a no-op; delete that file to start a new run.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pino from 'pino';
import { WebSocket } from 'ws';
import {
  initializeMidnightProviders,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  findDeployedContract,
  getPublicStates,
  type ContractProviders,
  type DeployContractOptions,
} from '@midnight-ntwrk/midnight-js-contracts';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk';

import { getConfig } from './config.js';
import {
  dustBech32FromState,
  latestState,
  registerNightForDust,
  waitForSpendableDust,
} from './dust.js';
import {
  buildResumableWallet,
  checkpointOnSignal,
  stateDir,
  writePrivateFileAtomic,
} from './walletState.js';
import { CompiledEclipseContract, zkConfigPath, ledger, Contract, type Ledger } from '../index.js';

/** Eclipse's concrete contract type — keeps ProvableCircuitId narrow for callTx. */
type EclipseContractType = InstanceType<typeof Contract>;
type EclipseProviders = ContractProviders<EclipseContractType>;
type Step = 'createPayroll' | 'fund' | 'distribute' | 'claim';

/** Progress that must survive a restart. Salts are private witnesses, hence the 0600 file. */
type RunState = {
  spares: string[];
  contractAddress?: string;
  salts?: string[];
  txIds: Partial<Record<Step, string>>;
  completed?: boolean;
};

// @ts-expect-error Node needs a WebSocket polyfill for indexer subscriptions
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'EclipseL2LifecycleState';
const rootDir = resolve(fileURLToPath(import.meta.url), '../../..');
const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const STATUS = ['Uninitialized', 'Created', 'Funded', 'Distributed'] as const;
const DEPOSIT = 100n;
/** Per chain interaction; a failed attempt costs one proof, not a multi-hour resync. */
const TX_ATTEMPTS = 3;

function loadNetworkEnv(network: string): void {
  const envPath = resolve(rootDir, `.env.${network}`);
  if (existsSync(envPath)) loadDotenv({ path: envPath });
}

function ensureSeed(network: string): string {
  const seedEnv = `MIDNIGHT_${network.toUpperCase()}_SEED`;
  const existing = process.env[seedEnv]?.trim();
  if (!existing) throw new Error(`Missing ${seedEnv} in .env.${network}`);
  return existing;
}

function envConfigFor(network: string): EnvironmentConfiguration {
  const config = getConfig(network);
  return {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  };
}

function resolveContractAddress(network: string): string {
  const fromEnv = process.env['CONTRACT_ADDRESS']?.trim();
  if (fromEnv) return fromEnv;
  const evidence = resolve(rootDir, `docs/evidence/l1-deploy-address-${network}.txt`);
  if (existsSync(evidence)) return readFileSync(evidence, 'utf8').trim();
  throw new Error('Set CONTRACT_ADDRESS or write docs/evidence/l1-deploy-address-{network}.txt');
}

function employerPk(): Uint8Array {
  const pk = new Uint8Array(32);
  pk[0] = 0xee;
  return pk;
}

function recipientsOne(): Uint8Array[] {
  const active = new Uint8Array(32);
  active[0] = 0xaa;
  return [active, ...Array.from({ length: 7 }, () => new Uint8Array(32))];
}

function saltsEight(): Uint8Array[] {
  return Array.from({ length: 8 }, (_, i) => {
    const s = randomBytes(32);
    s[0] = (s[0]! ^ (i + 1)) & 0xff;
    return s;
  });
}

/** The lifecycle is strictly ordered, so the ledger alone says which circuit runs next. */
function nextStep(led: Ledger): Step | undefined {
  if (led.status === 0) return 'createPayroll';
  if (led.status === 1) return 'fund';
  if (led.status === 2) return 'distribute';
  return led.claimed[0] ? undefined : 'claim';
}

/**
 * Retries a chain interaction in-process: exiting instead would discard the synced wallet and
 * cost a resync. Between attempts the wallet catches up to the tip, so a retried proof is built
 * against a current dust anchor (a stale one is what error 170 rejects).
 */
async function withRetry<T>(
  label: string,
  wallet: WalletFacade,
  dustTimeoutMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= TX_ATTEMPTS) throw err;
      logger.warn(`${label} failed (attempt ${attempt}/${TX_ATTEMPTS}), retrying: ${String(err)}`);
      await sleep(30_000 * attempt);
      await waitForSpendableDust(wallet, dustTimeoutMs);
    }
  }
}

async function deployFresh(providers: EclipseProviders): Promise<string> {
  logger.info('Deploying a fresh Eclipse instance…');
  const deployed = await deployContract<EclipseContractType>(providers, {
    compiledContract:
      CompiledEclipseContract as unknown as DeployContractOptions<EclipseContractType>['compiledContract'],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  const address = deployed.deployTxData.public.contractAddress;
  logger.info(`Contract deployed at: ${address}`);
  return address;
}

/** Wait until unshielded NIGHT is visible — needed before dust registration. */
async function waitForNight(timeoutMs: number, wallet: WalletFacade): Promise<bigint> {
  const started = Date.now();
  const nightRaw = unshieldedToken().raw;
  while (Date.now() - started < timeoutMs) {
    const state = await latestState(wallet);
    const night = state.unshielded.balances[nightRaw] ?? 0n;
    logger.info(`Waiting for tNIGHT… night=${night} isSynced=${state.isSynced}`);
    if (night > 0n) return night;
    await sleep(10_000);
  }
  throw new Error(`Timed out waiting for tNIGHT after ${timeoutMs}ms — fund via faucet first`);
}

async function main(): Promise<void> {
  const network = process.env['MIDNIGHT_NETWORK'] ?? 'preprod';
  loadNetworkEnv(network);
  const seed = ensureSeed(network);
  const config = getConfig(network);
  setNetworkId(config.networkId as 'preview' | 'preprod');

  logger.info(`Network=${network}`);
  logger.info(`Proof server=${config.proofServer} (reuse existing docker if :6300 is up)`);

  const runPath = resolve(stateDir(rootDir), `lifecycle-run-${network}.json`);
  const evidencePath = resolve(rootDir, 'docs/evidence/l3-onchain-lifecycle.json');
  const run: RunState = existsSync(runPath)
    ? (JSON.parse(readFileSync(runPath, 'utf8')) as RunState)
    : { spares: [], txIds: {} };
  const saveRun = () => writePrivateFileAtomic(runPath, JSON.stringify(run, null, 2));
  if (run.completed) {
    logger.info(
      `Lifecycle already completed for ${run.contractAddress}; evidence: ${evidencePath}`,
    );
    logger.info(`Delete ${runPath} to start a new run.`);
    console.log('\nECLIPSE_L3_ONCHAIN_OK');
    return;
  }

  const { provider: wallet, startCheckpointing } = await buildResumableWallet(
    logger,
    envConfigFor(network),
    seed,
    network,
    rootDir,
  );
  const stopCheckpointing = startCheckpointing();
  checkpointOnSignal(stopCheckpointing, logger);
  await wallet.start(false);

  try {
    const nightTimeout = Number(process.env['MIDNIGHT_FUND_TIMEOUT_MS'] ?? 15 * 60_000);
    const night = await waitForNight(nightTimeout, wallet.wallet);
    logger.info(`tNIGHT balance: ${night}`);

    const dustTimeout = Number(process.env['MIDNIGHT_DUST_TIMEOUT_MS'] ?? 30 * 60_000);
    const dustState = await latestState(wallet.wallet);
    logger.info(`Wallet dust address: ${dustBech32FromState(dustState)}`);
    if (dustState.dust.balance(new Date()) === 0n) {
      await registerNightForDust(wallet.wallet, wallet.unshieldedKeystore, {
        forceReregister: process.env['MIDNIGHT_FORCE_DUST_REREGISTER'] === '1',
      });
    }
    logger.info('Waiting for spendable tDUST before circuit calls…');
    await waitForSpendableDust(wallet.wallet, dustTimeout);
    // Marker for run-lifecycle-watchdog.sh: past here, stall detection watches log output.
    logger.info('Circuit phase started');

    // testkit types circuit ids as `string`, while midnight-js wants this contract's
    // ProvableCircuitId union. Cast to the concrete Eclipse providers once here — casting to the
    // unresolved parameter type instead would erase the generic and leave every callTx member
    // typed `undefined`.
    const providers = initializeMidnightProviders(wallet, envConfigFor(network), {
      zkConfigPath,
      privateStateStoreName: `eclipse-l2-${network}`,
    }) as unknown as EclipseProviders;
    const retry = <T>(label: string, fn: () => Promise<T>) =>
      withRetry(label, wallet.wallet, dustTimeout, fn);
    const readLedger = async (address: string) =>
      ledger(
        (await retry('read ledger', () => getPublicStates(providers.publicDataProvider, address)))
          .contractState.data,
      );

    // Spares first: if the lifecycle calls below fail, the demo instances already exist.
    const spareCount = Number(process.env['LIFECYCLE_SPARES'] ?? 0);
    while (run.spares.length < spareCount) {
      run.spares.push(await retry('deploy demo instance', () => deployFresh(providers)));
      saveRun();
    }
    if (spareCount > 0) {
      const sparePath = resolve(rootDir, `docs/evidence/l3-demo-addresses-${network}.txt`);
      writeFileSync(sparePath, `${run.spares.join('\n')}\n`, 'utf8');
      logger.info(`Wrote ${run.spares.length} demo instance(s) to ${sparePath}`);
    }

    // The run owns its contract from Uninitialized onward, so its persisted salts are the ones
    // distribute commits to — which is what makes resuming at claim possible.
    if (!run.contractAddress) {
      if (process.env['LIFECYCLE_DEPLOY'] === '1') {
        run.contractAddress = await retry('deploy lifecycle instance', () =>
          deployFresh(providers),
        );
      } else {
        const address = resolveContractAddress(network);
        const status = (await readLedger(address)).status;
        if (status !== 0) {
          throw new Error(
            `Contract is ${STATUS[status] ?? status}, not Uninitialized. Redeploy a fresh instance for lifecycle, or pass a new CONTRACT_ADDRESS.`,
          );
        }
        run.contractAddress = address;
      }
      run.salts = saltsEight().map((s) => Buffer.from(s).toString('hex'));
      saveRun();
    }
    const contractAddress = run.contractAddress;
    const salts = (run.salts ?? []).map((h) => Uint8Array.from(Buffer.from(h, 'hex')));
    if (salts.length !== 8)
      throw new Error(`Run file ${runPath} has no salts for ${contractAddress}`);
    logger.info(`Lifecycle contract=${contractAddress}`);

    const found = await retry('find contract', () =>
      findDeployedContract(providers, {
        contractAddress,
        compiledContract: CompiledEclipseContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      }),
    );

    const recipients = recipientsOne();
    const amounts = [DEPOSIT, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    for (let step = nextStep(await readLedger(contractAddress)); step;) {
      const current = step;
      const tx = await retry(current, async () => {
        // A previous attempt can land even when its response is lost; re-proving would then
        // fail the circuit's status assertion, so check the ledger first.
        if (nextStep(await readLedger(contractAddress)) !== current) return undefined;
        logger.info(`Calling ${current}…`);
        switch (current) {
          case 'createPayroll':
            return found.callTx.createPayroll(employerPk(), recipients);
          case 'fund':
            return found.callTx.fund(DEPOSIT);
          case 'distribute':
            return found.callTx.distribute(amounts, salts);
          case 'claim':
            // Slot 0 opens its commitment; amount and salt stay private witnesses.
            return found.callTx.claim(0n, DEPOSIT, recipients[0]!, salts[0]!);
        }
      });
      if (tx) {
        run.txIds[current] = tx.public.txId;
        saveRun();
        logger.info(`${current} txId=${tx.public.txId}`);
      } else {
        logger.warn(`${current} landed in an earlier attempt; its txId was not recorded`);
      }
      step = nextStep(await readLedger(contractAddress));
    }

    const after = await readLedger(contractAddress);
    logger.info(
      `Ledger status after: ${STATUS[after.status] ?? after.status} depositTotal=${after.depositTotal}`,
    );

    mkdirSync(resolve(rootDir, 'docs/evidence'), { recursive: true });
    const out = {
      network,
      contractAddress,
      createTxId: run.txIds.createPayroll ?? null,
      fundTxId: run.txIds.fund ?? null,
      distributeTxId: run.txIds.distribute ?? null,
      claimTxId: run.txIds.claim ?? null,
      status: STATUS[after.status] ?? String(after.status),
      depositTotal: after.depositTotal.toString(),
      claimed: Array.from(after.claimed),
    };
    writeFileSync(evidencePath, JSON.stringify(out, null, 2));
    run.completed = true;
    saveRun();
    console.log('\nECLIPSE_L3_ONCHAIN_OK');
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await stopCheckpointing();
  }

  await wallet.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
