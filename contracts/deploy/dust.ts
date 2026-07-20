/**
 * Shared NIGHT→tDUST registration + accrual wait for deploy/lifecycle scripts.
 * Circuit txs need spendable dust for fees; Night alone is not enough.
 */
import pino from 'pino';
import { filter, firstValueFrom, throttleTime, timeout } from 'rxjs';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  DustAddress,
  MidnightBech32m,
  type WalletFacade,
} from '@midnight-ntwrk/wallet-sdk';
import type { MidnightWalletProvider } from '@midnight-ntwrk/testkit-js';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function latestState(wallet: WalletFacade) {
  return firstValueFrom(wallet.state().pipe(throttleTime(2_000)));
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

export async function registerNightForDust(
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

  if (opts.forceReregister && registeredCoins.length > 0 && unregistered.length === 0) {
    logger.warn('Force re-register: deregistering existing NIGHT dust registration...');
    const deregRecipe = await wallet.deregisterFromDustGeneration(
      [...registeredCoins],
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    await submitDustRecipe(wallet, deregRecipe, 'Dust deregistration');
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

export async function waitForSpendableDust(
  wallet: WalletFacade,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  // Prefer fully-synced snapshots when they arrive quickly; otherwise fall back
  // immediately so a multi-hour dust catch-up does not stall logs for 60s/cycle.
  while (Date.now() - started < timeoutMs) {
    let state;
    try {
      state = await firstValueFrom(
        wallet.state().pipe(
          throttleTime(2_000),
          filter((s) => s.isSynced),
          timeout({ first: 8_000 }),
        ),
      );
    } catch {
      state = await latestState(wallet);
    }
    const now = new Date();
    const dust = state.dust.balance(now);
    const dustCoins = state.dust.availableCoins.length;
    const nightRaw = unshieldedToken().raw;
    const night = state.unshielded.balances[nightRaw] ?? 0n;
    const nightCoins = state.unshielded.availableCoins.filter((c) => c.utxo.type === nightRaw);
    let projected = 0n;
    try {
      const estimates = state.dust.estimateDustGeneration(nightCoins, now);
      for (const e of estimates) {
        const rec = e as unknown as Record<string, unknown>;
        for (const key of ['generatedNow', 'generated', 'value', 'balance']) {
          if (typeof rec[key] === 'bigint') projected += rec[key] as bigint;
        }
      }
    } catch (err) {
      logger.warn(`estimateDustGeneration failed: ${String(err)}`);
    }
    const dustProg = progressSummary(state.dust.state.progress);
    logger.info(
      `Dust balance: ${dust} coins=${dustCoins} night=${night} projected~${projected} isSynced=${state.isSynced} ` +
        `shielded=${state.shielded.state.progress.isStrictlyComplete()} ` +
        `unshielded=${state.unshielded.progress.isStrictlyComplete()} ` +
        `dustProg=${state.dust.state.progress.isStrictlyComplete()} ` +
        `dustProgress=${dustProg}`,
    );
    // Spendable dust only after dust ledger has caught up enough to report balance.
    if (dust > 0n && dustCoins > 0) return;
    if (dust > 0n) return;
    await sleep(10_000);
  }
  throw new Error(
    `Timed out waiting for spendable tDUST after ${timeoutMs}ms. ` +
      `Watch dustProgress.appliedIndex climbing toward highestRelevantWalletIndex — ` +
      `a cold Preprod dust sync can take hours. If already registered and stuck, try ` +
      `MIDNIGHT_FORCE_DUST_REREGISTER=1 once a tiny dust balance exists.`,
  );
}

export { dustBech32FromState };
