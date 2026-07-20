import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pino from 'pino';
import { filter, firstValueFrom, throttleTime, timeout } from 'rxjs';
import { WebSocket } from 'ws';
import {
  initializeMidnightProviders,
  MidnightWalletProvider,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  DustAddress,
  MidnightBech32m,
  type WalletFacade,
} from '@midnight-ntwrk/wallet-sdk';

import { getConfig } from './config.js';
import { CompiledEclipseContract, zkConfigPath } from '../index.js';

// @ts-expect-error Node needs a WebSocket polyfill for indexer subscriptions
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'EclipseL1DeployState';
const rootDir = resolve(fileURLToPath(import.meta.url), '../../..');
const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadNetworkEnv(network: string): void {
  const envPath = resolve(rootDir, `.env.${network}`);
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
    logger.info(`Loaded ${envPath}`);
  }
}

function ensureSeed(network: string): string {
  const upper = network.toUpperCase();
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const existing = process.env[seedEnv]?.trim();
  if (existing) return existing;

  const envPath = resolve(rootDir, `.env.${network}`);
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8');
    const match = text.match(new RegExp(`^${seedEnv}=(.+)$`, 'm'));
    if (match?.[1]) {
      process.env[seedEnv] = match[1].trim();
      return match[1].trim();
    }
  }

  const seed = randomBytes(32).toString('hex');
  writeFileSync(envPath, `# Eclipse L1 deploy wallet — DO NOT COMMIT\n${seedEnv}=${seed}\n`, {
    mode: 0o600,
  });
  process.env[seedEnv] = seed;
  logger.info(`Wrote new seed to ${envPath}`);
  return seed;
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

/** Latest wallet state without requiring dust sync to complete. */
async function latestState(wallet: WalletFacade) {
  return firstValueFrom(wallet.state().pipe(throttleTime(2_000)));
}

function nightBalance(state: Awaited<ReturnType<typeof latestState>>): bigint {
  const nightTokenRaw = unshieldedToken().raw;
  return state.unshielded.balances[nightTokenRaw] ?? 0n;
}

/**
 * Poll unshielded NIGHT from live state emissions.
 * Unlike testkit syncWallet/waitForFunds, this does NOT require dust progress
 * to be strictly complete — fresh faucet wallets otherwise hang forever.
 */
async function waitForNightBalance(
  wallet: WalletFacade,
  timeoutMs: number,
): Promise<bigint> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await latestState(wallet);
    const night = nightBalance(state);
    logger.info(
      `Progress: shielded=${state.shielded.state.progress.isStrictlyComplete()} ` +
        `unshielded=${state.unshielded.progress.isStrictlyComplete()} ` +
        `dust=${state.dust.state.progress.isStrictlyComplete()} night=${night}`,
    );
    if (night > 0n) return night;
    await sleep(15_000);
  }
  throw new Error(`Timed out waiting for tNIGHT after ${timeoutMs}ms`);
}

function dustBech32FromState(state: Awaited<ReturnType<typeof latestState>>): string {
  return MidnightBech32m.encode(getNetworkId(), state.dust.address).toString();
}

async function submitDustRecipe(
  wallet: WalletFacade,
  recipe: Awaited<ReturnType<WalletFacade['registerNightUtxosForDustGeneration']>>,
  label: string,
): Promise<string> {
  const finalized = await wallet.finalizeRecipe(recipe);
  const txId = await wallet.submitTransaction(finalized);
  logger.info(`${label} tx submitted: ${txId}`);
  return txId;
}

async function registerNightForDust(
  wallet: WalletFacade,
  unshieldedKeystore: MidnightWalletProvider['unshieldedKeystore'],
  opts: { forceReregister?: boolean } = {},
): Promise<string | undefined> {
  let state = await latestState(wallet);
  const unshieldedRaw = unshieldedToken().raw;
  let nightCoins = state.unshielded.availableCoins.filter(
    (coin) => coin.utxo.type === unshieldedRaw,
  );
  let registeredCoins = nightCoins.filter((c) => c.meta.registeredForDustGeneration);
  let unregistered = nightCoins.filter((c) => !c.meta.registeredForDustGeneration);
  logger.info(
    `NIGHT UTXOs: total=${nightCoins.length} registered=${registeredCoins.length} unregistered=${unregistered.length}`,
  );

  // Prior registration may have omitted the dust receiver — deregister then re-bind.
  if (opts.forceReregister && registeredCoins.length > 0 && unregistered.length === 0) {
    logger.warn('Force re-register: deregistering existing NIGHT dust registration...');
    const deregRecipe = await wallet.deregisterFromDustGeneration(
      [...registeredCoins],
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    await submitDustRecipe(wallet, deregRecipe, 'Dust deregistration');
    // Wait for indexer to flip registeredForDustGeneration back to false.
    const waitStart = Date.now();
    while (Date.now() - waitStart < 180_000) {
      await sleep(10_000);
      state = await latestState(wallet);
      nightCoins = state.unshielded.availableCoins.filter((c) => c.utxo.type === unshieldedRaw);
      unregistered = nightCoins.filter((c) => !c.meta.registeredForDustGeneration);
      registeredCoins = nightCoins.filter((c) => c.meta.registeredForDustGeneration);
      logger.info(
        `Post-deregister: registered=${registeredCoins.length} unregistered=${unregistered.length}`,
      );
      if (unregistered.length > 0) break;
    }
  }

  if (unregistered.length === 0) {
    logger.warn('All NIGHT UTXOs already registered — waiting for DUST accrual');
    return undefined;
  }

  const dustBech32 = dustBech32FromState(state);
  const dustReceiver = MidnightBech32m.parse(dustBech32).decode(DustAddress, getNetworkId());
  logger.info(`Registering ${unregistered.length} NIGHT UTXO(s) → ${dustBech32}`);

  try {
    const estimate = await wallet.estimateRegistration(unregistered);
    logger.info(`Registration fee estimate: ${estimate.fee}`);
    if (estimate.fee > 0n) {
      await wallet.waitForGeneratedDust(unregistered, estimate.fee, {
        timeoutMs: Number(process.env['MIDNIGHT_DUST_TIMEOUT_MS'] ?? 30 * 60_000),
      });
      logger.info('Projected dust reached registration fee threshold');
    }
  } catch (err) {
    logger.warn(`estimate/waitForGeneratedDust skipped or failed: ${String(err)}`);
  }

  const recipe = await wallet.registerNightUtxosForDustGeneration(
    unregistered,
    unshieldedKeystore.getPublicKey(),
    (payload) => unshieldedKeystore.signData(payload),
    dustReceiver,
  );
  return submitDustRecipe(wallet, recipe, 'Dust registration');
}

function progressSummary(progress: {
  isStrictlyComplete: () => boolean;
  toString?: () => string;
}): string {
  try {
    return JSON.stringify(progress);
  } catch {
    return `complete=${progress.isStrictlyComplete()}`;
  }
}

async function waitForSpendableDust(wallet: WalletFacade, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let state;
    try {
      // Prefer fully-synced state (docs wait on isSynced before trusting dust.balance).
      state = await firstValueFrom(
        wallet.state().pipe(
          throttleTime(5_000),
          filter((s) => s.isSynced),
          timeout({ first: 60_000 }),
        ),
      );
    } catch {
      state = await latestState(wallet);
    }
    const now = new Date();
    const dust = state.dust.balance(now);
    const dustCoins = state.dust.availableCoins.length;
    const nightCoins = state.unshielded.availableCoins.filter(
      (c) => c.utxo.type === unshieldedToken().raw,
    );
    let projected = 0n;
    try {
      const estimates = state.dust.estimateDustGeneration(nightCoins, now);
      for (const e of estimates) {
        // Field names vary by SDK build; take any bigint-like generated amount.
        const rec = e as unknown as Record<string, unknown>;
        for (const key of ['generatedNow', 'generated', 'value', 'balance']) {
          if (typeof rec[key] === 'bigint') projected += rec[key] as bigint;
        }
      }
    } catch (err) {
      logger.warn(`estimateDustGeneration failed: ${String(err)}`);
    }
    logger.info(
      `Dust balance: ${dust} coins=${dustCoins} projected~${projected} isSynced=${state.isSynced} ` +
        `shielded=${state.shielded.state.progress.isStrictlyComplete()} ` +
        `unshielded=${state.unshielded.progress.isStrictlyComplete()} ` +
        `dust=${state.dust.state.progress.isStrictlyComplete()} ` +
        `dustProgress=${progressSummary(state.dust.state.progress)}`,
    );
    if (dust > 0n) return;
    await sleep(15_000);
  }
  throw new Error(`Timed out waiting for spendable tDUST after ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  const network = process.env['MIDNIGHT_NETWORK'] ?? 'preview';
  const mode = process.argv[2] ?? 'deploy';

  loadNetworkEnv(network);
  const seed = ensureSeed(network);
  const config = getConfig(network);
  setNetworkId(config.networkId as 'preview' | 'preprod');
  const env = envConfigFor(network);

  const wallet = await MidnightWalletProvider.build(logger, env, seed);
  const address = wallet.unshieldedKeystore.getBech32Address().asString();

  if (mode === 'init') {
    console.log('\n=== Eclipse L1 wallet ===');
    console.log(`Network:  ${network}`);
    console.log(`Address:  ${address}`);
    console.log(`Faucet:   ${config.faucet}`);
    console.log(`Human UI: ${config.faucetPage}`);
    console.log('\nSeed saved under .env.' + network + ' (gitignored).');
    console.log('Next: npm run deploy --workspace=@eclipse/contracts\n');
    return;
  }

  // Start without auto-faucet — Preview/Preprod drips require human captcha.
  await wallet.start(false);
  logger.info(`Waiting for tNIGHT at ${address}`);
  logger.info(`Fund via: ${config.faucetPage}`);

  const fundTimeout = Number(process.env['MIDNIGHT_FUND_TIMEOUT_MS'] ?? 45 * 60_000);
  const night = await waitForNightBalance(wallet.wallet, fundTimeout);
  logger.info(`tNIGHT balance: ${night}`);

  const dustTimeout = Number(process.env['MIDNIGHT_DUST_TIMEOUT_MS'] ?? 30 * 60_000);
  const dustState = await latestState(wallet.wallet);
  const dustBech32 = dustBech32FromState(dustState);
  logger.info(`Wallet dust address: ${dustBech32}`);
  if (dustState.dust.balance(new Date()) === 0n) {
    // Only force-deregister when explicitly requested — needs dust for fees (error 138 otherwise).
    await registerNightForDust(wallet.wallet, wallet.unshieldedKeystore, {
      forceReregister: process.env['MIDNIGHT_FORCE_DUST_REREGISTER'] === '1',
    });
  }
  await waitForSpendableDust(wallet.wallet, dustTimeout);

  const providers = initializeMidnightProviders(wallet, env, {
    zkConfigPath,
    privateStateStoreName: `eclipse-l1-${network}`,
  });

  logger.info(`Deploying Eclipse contract to ${network}...`);
  const deployed = await deployContract(providers, {
    compiledContract: CompiledEclipseContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Contract deployed at: ${contractAddress}`);

  const evidenceDir = resolve(rootDir, 'docs/evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const outPath = resolve(evidenceDir, `l1-deploy-address-${network}.txt`);
  writeFileSync(outPath, `${contractAddress}\n`, 'utf8');
  console.log(`\nECLIPSE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`Wrote ${outPath}\n`);

  await wallet.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
