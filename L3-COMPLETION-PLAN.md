# Plan: Finish Level 3 (First Quarter)

> **Working plan, not a doctrine doc.** Approved and in progress. Read this first, in full, before touching
> `fund`, the redeploy, or filing — it explains *why*, not just *what*. Once Level 3 is filed, fold any
> lasting decisions into `docs/submission.md` / `docs/boundaries.md` and this file can be deleted.
>
> **Handoff note (2026-09-23, second session):** Phases 0–3 and Phase 4b step 1 are **done** and
> pushed to `claude/level-3-completion-94tkor`. The api.github.com 403 was repo scoping, not the
> network policy: compactc 0.31.1 downloads fine from
> `github.com/midnightntwrk/compact/releases/download/compactc-v0.31.1/compactc_v0.31.1_x86_64-unknown-linux-musl.zip`.
> Recompiling reproduced `managed/` byte-for-byte before the change.
> - `fund` calls `receiveUnshielded(nativeToken(), disclose(amount))`; only fund's artifacts changed.
> - No transport change needed: Lace `balanceUnsealedTransaction` and testkit
>   `balanceUnboundTransaction` (tokenKindsToBalance defaults to `all`) both balance unshielded inputs.
> - 46 tests (13 contract, 17 SDK, 16 web); docs, screenshot and the Remotion video are updated.
> - **Open:** Phase 4 (you: redeploy + `npm run lifecycle`), Phase 4b steps 2–3 (live capture), Phase 5
>   (filing). Also still to do: open a PR to `main` for a CI run (CI only runs on `main` and PRs).
> - **Hardening pass (merged PR #1, then this branch):** 53 tests (20 contract: edge cases + ledger
>   privacy), CI `circuit-drift` job (recompile with compactc 0.31.1, fail on `managed/` diff) and
>   `npm run check:privacy`, a real screen-capture demo `docs/evidence/l3-demo-app.mp4` (in-memory,
>   labelled; script `l3-demo-app.record.mjs`), and the Remotion caption overlap is fixed.

## Context
Level 3 is about 80% done: CI, 43 tests, the `claim` circuit, the proposal draft, and the demo video are all in place. Five things are still missing:
1. `fund` is still a stub and moves no tokens.
2. The Preprod contract (`3aec836e…`) was deployed before `claim` existed.
3. The live create → fund → distribute → claim run has never completed.
4. The status docs are out of date.
5. Nothing after L1 has been filed on Rise In.

**Decision (from you):** `fund` will take in **real Preprod tNIGHT, unshielded**. The deposit total is already public, so this costs no privacy. `claim` stays a proof of entitlement that also blocks a second claim on the same slot. Paying out privately (shielded coins) moves to Level 4 and will be written down as such.

Who does what: I do Phases 1–3 in this container. **You** do Phase 4 (redeploy + live run, which needs your seed wallet, faucet tNIGHT and ~2h of dust sync) and Phase 5 (filing on Rise In).

---

## Phase 0: Unblock the compiler download (you, ~1 min)
The environment's network policy blocks GitHub downloads (403), so neither the Compact installer nor `@midnight-ntwrk/midnight-js-compact` can fetch compiler 0.31.1.
1. Open the cloud environment menu in the session title bar and choose **Edit**.
2. Under **Network access**, either choose a broader access level or add these allowed domains: `github.com`, `api.github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`.
3. Save. The change applies to new sessions, so start a fresh session on this branch (or tell me here and I'll check whether this container picks it up).
4. I check it with `COMPACTC_VERSION=0.31.1 npx fetch-compactc` and then `npm run compile`, which must reproduce the current `managed/` before I change anything.

Access levels are described at https://code.claude.com/docs/en/claude-code-on-the-web.

## Phase 1: Real token transfer-in in the contract
**File:** `contracts/src/eclipse.compact`
- In `fund(amount)`, after `assertCreated()`, add `receiveUnshielded(nativeToken(), amount)` so the transaction must actually deposit `amount` tNIGHT into the contract. Before relying on it, check the exact stdlib signature against compiler **0.31.1** (the amount is probably `Uint<128>`, so cast from `Uint<64>`).
- Rewrite the header comment and the `fund` comment. The contract no longer describes itself as a stub.
- Recompile to regenerate `contracts/managed/eclipse/**` (keys, zkir, contract-info). CI uses the committed artifacts.
  - Toolchain: install the Compact compiler 0.31.1 in this container (official installer, pinned to that version). **If the network policy blocks that**, I push the `.compact` change and you run `cd contracts && npm run compile` locally and commit `managed/`.
- `contracts/tests/distribute.test.ts`: update `createThenFund`. The circuit context may need to account for the unshielded input; check what compact-runtime 0.16 expects. Add tests:
  - `fund` records an unshielded receive of `amount` in native token
  - `fund` rejects when status ≠ Created (keep the existing check)
  - all existing sum-proof and claim tests stay green

## Phase 2: SDK, app and lifecycle script
- `packages/sdk/src/contract/MidnightJsTransport.ts:236`: `callTx.fund(amount)` stays the same, but the wallet must now balance an unshielded input. Confirm midnight-js 4.1 balances unshielded inputs automatically. If it doesn't, add the balancing step there.
- `packages/sdk/src/contract/EclipsePort.ts`: update the doc comment (fund = real tNIGHT deposit).
- In-memory/demo adapter: treat `fund` as a mock deposit, with a clear label.
- `apps/web/src/pages/EmployerPage.tsx:203`: change the button label from "Stub fund" to "Deposit tNIGHT" and add a short helper line saying the deposit total is public by design. Update `privacy.test.tsx` if it matches on that label.
- `contracts/deploy/lifecycle.ts`: extend it to create → fund (real tNIGHT) → distribute → **claim**. Write every txId to `docs/evidence/l3-onchain-lifecycle.json`, replacing the old `l2-…` name.

## Phase 3: Make the docs match reality
- `README.md`:
  - Status paragraph
  - Status table: L3 becomes "In progress" now and "Filed" later
  - Gantt: demo video done; tNIGHT fund done
  - Circuits column / note: stays until the redeploy
  - Test count, if it changed
- `docs/submission.md` §2: L3 row plus a "Level 3 filing record" stub listing only facts that are true.
- `docs/architecture.md` (§ Token handling, circuit table) and `docs/boundaries.md` decision log: add a dated row saying "unshielded tNIGHT deposit; shielded pay-out deferred to L4".
- `docs/privacy-model.md`: add a disclosure row for fund (the deposit amount is public, which it already is).
- `docs/proposal.md`: move "real transfer-in" from remaining to done. Keep the redeploy under remaining until Phase 4 is done.
- Refresh `docs/evidence/l3-tests.png` if the test count changes.

**Commit/push:** Conventional Commits on `claude/level-3-completion-94tkor`. CI only runs on `main` and on PRs, so I'll offer to open a PR to get a green CI run.

## Phase 4: Redeploy + live run (you, on your machine)
1. Top up the seed wallet from the Preprod faucet (tNIGHT + dust).
2. Start the proof-server on `:6300` (pinned at 8.1.0).
3. `cd contracts && MIDNIGHT_NETWORK=preprod npm run deploy`. It takes ~2h on a cold dust sync, so leave it running; the watchdog script `deploy/run-lifecycle-watchdog.sh` restarts it if it wedges.
4. `npm run lifecycle` → produces `docs/evidence/l3-onchain-lifecycle.json`.
5. Send me the new address plus the JSON. I'll update the README address table (4 circuits, drop the "predates claim" note), the Netlify env var and the explorer link, then tag `level-3`.

## Phase 4b: Demo video, the real one
The current `docs/evidence/l3-demo.mp4` is a Remotion **illustrated walkthrough**, not a screen capture. L3 asks for a video showing "full functionality", and after Phase 4 we can show it happening for real. A real capture is the strongest thing a judge can watch.

**Step 1, me (in this container, right after Phase 2):** patch the Remotion walkthrough so it isn't out of date.
- `docs/evidence/l3-video/src/scenes/Scene2Split.tsx` (and `Scene1Connect.tsx` if needed): replace the "Stub fund" button and copy with "Deposit tNIGHT", matching the new app label.
- Re-render `l3-demo.mp4` with Chromium (already installed at `/opt/pw-browsers`) so we have an honest backup if the live filming stalls.

**Step 2, you (after Phase 4 has redeployed):** screen-record the real flow, following `docs/evidence/l3-demo-storyboard.md`. It already has six beats in 60s, the "do not film" list and the honest-framing rules.
- Update beat 2 of the storyboard (done by me in Phase 3): the deposit is now a real Lace signing prompt that moves tNIGHT. Show that prompt on camera, because it proves the token transfer is real.
- Setup: Lace on Preprod, proof-server on `:6300`, `VITE_USE_CHAIN=1`, the new contract address, and `/employer` + `/observer` side by side.
- Save as `docs/evidence/l3-demo-live.mp4`. Aim for under ~2 MB. If it's bigger, host it on YouTube/Loom and link it.

**Step 3, me:** in the README, make the live capture the primary L3 video and keep the Remotion video listed as the "illustrated walkthrough". Remove the "not a screen capture" disclaimer, or narrow it to the backup video only.

**If the chain stalls while you're filming:** film the in-memory path and say so on screen, as the storyboard already says. Never present it as a live Preprod call.

## Phase 5: Filing (you)
1. File **Level 2** on Rise In first, because the chain has to stay unbroken.
2. Submit the idea #6 proposal (`docs/proposal.md`) for approval.
3. File **Level 3** with: repo link, CI badge, the 1-min video, the live demo, the test screenshot, and the new Preprod address.
4. Before filing, check that the Rise In cycle is still open. The docs say the window ended 2026-07-31, so you may be filing into a new cycle.

---

## Verification
- `npm ci && npm run typecheck && npm test && npm run build` from the repo root, all green (the same steps CI runs).
- Contract tests show fund's unshielded receive plus the full create → fund → distribute → claim path.
- `grep -ri "stub fund\|Stub fund"` returns nothing outside the history/decision log.
- After Phase 4: open the new address on the 1am explorer (Preprod). The status should be `Distributed`, one `claimed` flag should be true, and `depositTotal` should match the tNIGHT that actually moved.

## Risks
- **The compiler can't be installed here.** Fallback: you compile locally (one command).
- **The wallet doesn't balance the unshielded input automatically.** That surfaces in the Phase 4 run. The fix goes in `MidnightJsTransport` and the lifecycle script.
- **The dust sync wedges again.** Use the watchdog, and run it on a stable machine or connection.
