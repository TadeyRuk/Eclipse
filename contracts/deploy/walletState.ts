/**
 * Resumable seed wallet for the Preprod deploy/lifecycle scripts.
 *
 * A cold Preprod dust sync replays ~1.5M indexer events and takes hours. testkit's
 * `MidnightWalletProvider.build` keeps that progress in memory only, so every crash or watchdog
 * restart replayed from index 0. Each sub-wallet can serialize itself (the dust snapshot stores
 * `appliedIndex` as `offset`), so this builds the same wallet testkit would, but restores the
 * three sub-wallets from the last checkpoint when one exists and checkpoints them while running.
 *
 * Checkpoints live in `contracts/.states/` (gitignored), mode 0600: they hold the wallet's coin
 * state. The filename carries a truncated seed hash, never the seed.
 */
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger } from 'pino';
import {
  DEFAULT_DUST_OPTIONS,
  MidnightWalletProvider,
  WalletSeeds,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  createKeystore,
  DustWallet,
  InMemoryTransactionHistoryStorage,
  mergeWalletEntries,
  PublicKey,
  ShieldedWallet,
  UnshieldedWallet,
  WalletEntrySchema,
  WalletFacade,
} from '@midnight-ntwrk/wallet-sdk';

/** Fee padding in DUST specks; negligible next to a single 25e18-speck generated coin. */
const DUST_FEE_OVERHEAD = 1_000_000_000n;

type Snapshot = {
  version: 1;
  networkId: string;
  savedAt: string;
  appliedIndex: string;
  shielded: string;
  unshielded: string;
  dust: string;
};

const CHECKPOINT_INTERVAL_MS = 60_000;
/** A wedged wallet must not block shutdown; serialization is local, so this is generous. */
const FINAL_CHECKPOINT_TIMEOUT_MS = 10_000;

export function stateDir(rootDir: string): string {
  return resolve(rootDir, 'contracts/.states');
}

function checkpointPath(rootDir: string, network: string, seed: string): string {
  const fingerprint = createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return resolve(stateDir(rootDir), `wallet-${network}-${fingerprint}.json`);
}

/** Write-then-rename so a kill mid-write leaves the previous file intact. */
export function writePrivateFileAtomic(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);
}

function readSnapshot(path: string, networkId: string, logger: Logger): Snapshot | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const snapshot = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
    if (snapshot.version !== 1 || snapshot.networkId !== networkId) {
      throw new Error(`checkpoint is for ${snapshot.networkId} v${snapshot.version}`);
    }
    return snapshot;
  } catch (err) {
    const aside = `${path}.unreadable-${Date.now()}`;
    renameSync(path, aside);
    logger.warn(`Ignoring unreadable wallet checkpoint (moved to ${aside}): ${String(err)}`);
    return undefined;
  }
}

type SubWallets = { shielded: ShieldedWallet; unshielded: UnshieldedWallet; dust: DustWallet };

export type ResumableWallet = {
  provider: MidnightWalletProvider;
  /** Starts periodic checkpoints; the returned function writes a final one and stops. */
  startCheckpointing: () => () => Promise<void>;
};

export async function buildResumableWallet(
  logger: Logger,
  env: EnvironmentConfiguration,
  seed: string,
  network: string,
  rootDir: string,
): Promise<ResumableWallet> {
  const path = checkpointPath(rootDir, network, seed);
  const seeds = WalletSeeds.fromMasterSeed(seed);
  const keystore = createKeystore(seeds.unshielded, env.walletNetworkId);
  // Mirrors testkit's internal mapEnvironmentToConfiguration so restored and fresh wallets are
  // configured identically to MidnightWalletProvider.build.
  const config = {
    indexerClientConnection: { indexerHttpUrl: env.indexer, indexerWsUrl: env.indexerWS },
    provingServerUrl: new URL(env.proofServer),
    networkId: env.walletNetworkId,
    relayURL: new URL(env.nodeWS),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    costParameters: { feeBlocksMargin: 5 },
  };
  const unshieldedConfig = {
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
  };
  const dustConfig = {
    ...config,
    costParameters: {
      ledgerParams: DEFAULT_DUST_OPTIONS.ledgerParams,
      // Must be > 0. With initialParameters a small call tx (createPayroll) prices at exactly 0,
      // and dust-wallet 4.2.0's computeBalancingRecipe then selects no coins and loops forever
      // on a 1-speck fee it can never cover (observed 2026-09-26). Deploys price above 0.
      additionalFeeOverhead: DUST_FEE_OVERHEAD,
      feeBlocksMargin: DEFAULT_DUST_OPTIONS.feeBlocksMargin,
    },
  };

  const snapshot = readSnapshot(path, env.walletNetworkId, logger);
  let restored: SubWallets | undefined;
  if (snapshot) {
    try {
      restored = {
        shielded: ShieldedWallet(config).restore(snapshot.shielded),
        unshielded: UnshieldedWallet(unshieldedConfig).restore(snapshot.unshielded),
        dust: DustWallet(dustConfig).restore(snapshot.dust),
      };
      logger.info(
        `Restored wallet from checkpoint at appliedIndex=${snapshot.appliedIndex} (saved ${snapshot.savedAt})`,
      );
    } catch (err) {
      const aside = `${path}.unrestorable-${Date.now()}`;
      renameSync(path, aside);
      logger.warn(`Wallet checkpoint failed to restore (moved to ${aside}): ${String(err)}`);
    }
  }
  if (!restored) logger.info('No usable wallet checkpoint; syncing from index 0');
  const wallets: SubWallets = restored ?? {
    shielded: ShieldedWallet(config).startWithSeed(seeds.shielded),
    unshielded: UnshieldedWallet(unshieldedConfig).startWithPublicKey(
      PublicKey.fromKeyStore(keystore),
    ),
    dust: DustWallet(dustConfig).startWithSeed(
      seeds.dust,
      LedgerParameters.initialParameters().dust,
    ),
  };

  const facade = await WalletFacade.init({
    configuration: config,
    shielded: () => wallets.shielded,
    unshielded: () => wallets.unshielded,
    dust: () => wallets.dust,
  });
  const provider = await MidnightWalletProvider.withWallet(
    logger,
    env,
    facade,
    ZswapSecretKeys.fromSeed(seeds.shielded),
    DustSecretKey.fromSeed(seeds.dust),
    keystore,
  );

  const startCheckpointing = () => {
    let lastIndex = snapshot?.appliedIndex ?? '';
    let saving: Promise<void> | undefined;

    const writeCheckpoint = async (): Promise<void> => {
      try {
        const [shielded, unshielded, dust] = await Promise.all([
          facade.shielded.serializeState(),
          facade.unshielded.serializeState(),
          facade.dust.serializeState(),
        ]);
        const appliedIndex = String((JSON.parse(dust) as { offset?: string }).offset ?? '0');
        if (appliedIndex === lastIndex) return;
        const next: Snapshot = {
          version: 1,
          networkId: env.walletNetworkId,
          savedAt: new Date().toISOString(),
          appliedIndex,
          shielded,
          unshielded,
          dust,
        };
        writePrivateFileAtomic(path, JSON.stringify(next));
        lastIndex = appliedIndex;
        logger.info(`Checkpointed wallet sync at appliedIndex=${appliedIndex}`);
      } catch (err) {
        logger.warn(`Wallet checkpoint failed: ${String(err)}`);
      }
    };
    // One write at a time. The reset runs in `.finally` (always async) so it cannot fire before
    // the assignment, which would leave `saving` pinned to a settled promise.
    const save = (): Promise<void> => {
      saving ??= writeCheckpoint().finally(() => {
        saving = undefined;
      });
      return saving;
    };

    const timer = setInterval(() => void save(), CHECKPOINT_INTERVAL_MS);
    timer.unref();
    return async () => {
      clearInterval(timer);
      await Promise.race([save(), sleep(FINAL_CHECKPOINT_TIMEOUT_MS, undefined, { ref: false })]);
    };
  };

  return { provider, startCheckpointing };
}

/**
 * Writes a final checkpoint before exiting on the watchdog's SIGTERM (or Ctrl+C), so a restart
 * loses at most the work since that write rather than the checkpoint interval.
 */
export function checkpointOnSignal(stop: () => Promise<void>, logger: Logger): void {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      logger.warn(`${signal} received; writing final wallet checkpoint`);
      void stop().finally(() => process.exit(signal === 'SIGTERM' ? 143 : 130));
    });
  }
}
