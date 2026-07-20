/**
 * Run createPayroll → fund → distribute against an already-deployed Preprod/Preview contract.
 * Uses the same seed wallet + Midnight.js providers as deploy.ts — proves real on-chain circuits.
 *
 * Usage:
 *   MIDNIGHT_NETWORK=preprod npm run lifecycle -w @eclipse/contracts
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pino from 'pino';
import { WebSocket } from 'ws';
import {
  initializeMidnightProviders,
  MidnightWalletProvider,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  findDeployedContract,
  getPublicStates,
} from '@midnight-ntwrk/midnight-js-contracts';

import { getConfig } from './config.js';
import {
  dustBech32FromState,
  latestState,
  registerNightForDust,
  waitForSpendableDust,
} from './dust.js';
import { CompiledEclipseContract, zkConfigPath, ledger } from '../index.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

// @ts-expect-error Node needs a WebSocket polyfill for indexer subscriptions
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'EclipseL2LifecycleState';
const rootDir = resolve(fileURLToPath(import.meta.url), '../../..');
const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const STATUS = ['Uninitialized', 'Created', 'Funded', 'Distributed'] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

/** Wait until unshielded NIGHT is visible — needed before dust registration. */
async function waitForNight(timeoutMs: number, wallet: Awaited<ReturnType<typeof MidnightWalletProvider.build>>['wallet']): Promise<bigint> {
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
  const contractAddress = resolveContractAddress(network);
  setNetworkId(config.networkId as 'preview' | 'preprod');

  logger.info(`Network=${network} contract=${contractAddress}`);
  logger.info(`Proof server=${config.proofServer} (reuse existing docker if :6300 is up)`);

  const wallet = await MidnightWalletProvider.build(logger, envConfigFor(network), seed);
  await wallet.start(false);

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

  const providers = initializeMidnightProviders(wallet, envConfigFor(network), {
    zkConfigPath,
    privateStateStoreName: `eclipse-l2-${network}`,
  });

  const publicStates = await getPublicStates(providers.publicDataProvider, contractAddress);
  const before = ledger(publicStates.contractState.data);
  logger.info(`Ledger status before: ${STATUS[before.status] ?? before.status}`);

  if (before.status !== 0) {
    throw new Error(
      `Contract is ${STATUS[before.status] ?? before.status}, not Uninitialized. Redeploy a fresh instance for lifecycle, or pass a new CONTRACT_ADDRESS.`,
    );
  }

  const found = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledEclipseContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  const deposit = 100n;
  logger.info('Calling createPayroll…');
  const createTx = await found.callTx.createPayroll(employerPk(), recipientsOne());
  logger.info(`createPayroll txId=${createTx.public.txId}`);

  logger.info('Calling fund…');
  const fundTx = await found.callTx.fund(deposit);
  logger.info(`fund txId=${fundTx.public.txId}`);

  const amounts = [deposit, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
  const salts = saltsEight();
  logger.info('Calling distribute…');
  const distTx = await found.callTx.distribute(amounts, salts);
  logger.info(`distribute txId=${distTx.public.txId}`);

  const afterStates = await getPublicStates(providers.publicDataProvider, contractAddress);
  const after = ledger(afterStates.contractState.data);
  logger.info(
    `Ledger status after: ${STATUS[after.status] ?? after.status} depositTotal=${after.depositTotal}`,
  );

  const evidenceDir = resolve(rootDir, 'docs/evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const out = {
    network,
    contractAddress,
    createTxId: createTx.public.txId,
    fundTxId: fundTx.public.txId,
    distributeTxId: distTx.public.txId,
    status: STATUS[after.status] ?? String(after.status),
    depositTotal: after.depositTotal.toString(),
  };
  writeFileSync(resolve(evidenceDir, 'l2-onchain-lifecycle.json'), JSON.stringify(out, null, 2));
  console.log('\nECLIPSE_L2_ONCHAIN_OK');
  console.log(JSON.stringify(out, null, 2));

  await wallet.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
