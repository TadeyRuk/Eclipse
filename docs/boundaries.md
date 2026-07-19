# Eclipse — Boundaries & Gates

Purpose: keep Eclipse shippable within the program timeline. Every "wouldn't it be cool if" gets checked against this file first. If it's not inside a gate below, it does not get built this cycle.

Program source: `Midnight.md`. Rise In rewards are **sequential** — L2 requires L1 complete; L3 requires an unbroken L1→L2 chain. A gate is not "done" until the submission is **filed on Rise In**, not just code-complete.

---

## Hard Scope (v1 — through Level 3)

**Eclipse IS:**
- One employer, one fixed pool, one-shot distribution
- Pre-known recipients (employer adds addresses directly)
- Private per-recipient amounts; publicly provable balanced total
- One Compact contract, one web app (two role views), one SDK package
- Preprod test tokens only

**Eclipse IS NOT (this cycle):**
- ❌ Recurring/scheduled payroll (no cron, no streams, no vesting)
- ❌ Multi-employer / payroll marketplace / org management
- ❌ Withdrawal, refund, or re-splitting logic — no circuit for it exists, on purpose
- ❌ Token minting — deposits existing test tokens only
- ❌ Hiding the recipient list (addresses are public in v1; only amounts are private)
- ❌ Hiding deposit total (inherently public — it's a real token transfer / public anchor)
- ❌ Mobile app, browser-extension, desktop app — web only
- ❌ Fiat anything, price feeds, stablecoin logic
- ❌ Identity/KYC of any kind — wallet address IS the identity
- ❌ Admin dashboards, analytics, notifications — demo-relevant features only

## Numeric Guardrails

| Constraint | v1 value | Why |
|---|---|---|
| Max recipients per payroll | 8 | ZK circuits favor static bounds (`Vector[8]`); keeps proof time sane; enough for demo |
| Contracts deployed | 1 | One contract instance per payroll run is acceptable; no factory pattern yet |
| Supported wallets | 1 (Lace) | Program requirement; no wallet-abstraction layer beyond the port interface |
| Supported networks | Preprod (+ local for dev) | Mainnet is Level 6 concern, not now |

## Sequencing Gates (order is mandatory)

1. **Gate 0 — Feasibility spike:** stub ledger + helpers + `distribute()` sum-proof compiles; tests `distribute_accepts_when_sum_equals_total` and `distribute_rejects_when_sum_exceeds_total` pass locally. **Nothing else starts before this.** No FungibleToken, no `claim`, no Lace/UI.
2. **Gate 1 — Level 1 submission (Midnight New Moon):** Eclipse contract itself (not hello-world) with `createPayroll` + stub `fund` + `distribute`; `managed/` present; Preprod deploy + address; public README (setup, public vs private witness, idea); screenshots; ≥5 commits; **filed on Rise In**.
3. **Gate 2 — Level 2 submission:** Lace connect/disconnect + circuit call from UI; observable privacy (amounts hidden, status+commitments public); live demo; demo video; ≥8 commits; filed.
4. **Gate 3 — Idea approval:** Private Payroll (#6) proposal submitted and approved before deep Level 3 polish.
5. **Gate 4 — Level 3 submission:** full dApp, ≥3 tests, CI/CD + badge, public README privacy model, 1-minute demo video, ≥10 commits; filed.

### Gate 0 kill-switch (~2 focused days)

**“Fighting the compiler” means:** cannot express fixed-length sum vs public `depositTotal`; cannot bind commitments; or proof time absurd for N=8.

**Fallback:** equal-splits variant — amounts still private witnesses, still sum-proof against `depositTotal` — before pivoting the idea with mentor approval. Do not weaken the privacy claim (no plaintext ledger amounts).

## Complexity Tripwires (stop and re-read this file if…)

- A second smart contract appears
- Any circuit needs more than ~5 witnesses
- The SDK grows a fourth adapter beyond wallet/contract/proof
- Any feature exists that the 60-second demo video will not show
- A dependency gets added that isn't: Midnight tooling, React, Vite, Tailwind, Zustand, vitest, testing-library
- More than 20% of a week goes to UI polish before Gate 3 passes

## Program alignment (Midnight L1–L3)

| Midnight level | Internal gate | Eclipse focus |
|---|---|---|
| L1 New Moon | Gate 1 | Compile, tests, `managed/`, Preprod deploy, README witness section — **no Lace/CI required** |
| L2 Waxing Crescent | Gate 2 | Lace + circuit from UI + observable privacy + live demo |
| L3 First Quarter | Gates 3–4 | Full dApp, tests, CI, idea approval, privacy-model README |

CI/CD is an **L3** Midnight requirement (may be added earlier). Hiding the recipient list is **not** required for idea #6.

## Decision Log (append-only)

| Date | Decision | Why |
|---|---|---|
| 2026-07-19 | Idea: Private Payroll/Splits (list item 6) | Niche pick, real ZK depth, same skeleton as allowlist but one axis harder |
| 2026-07-19 | Employer deposits existing tokens, no minting | Realism; matches FungibleToken flow |
| 2026-07-19 | Single atomic distribute() call | Running-total-across-calls is a harder ZK state problem; one-shot is provable and demoable |
| 2026-07-19 | Amounts private even from post-hoc employer queries | On-chain state never stores plaintext amounts; employer's local records are their own business |
| 2026-07-19 | Recipient list public in v1 | Hiding membership too doubles circuit complexity; amounts-privacy is the product claim |
| 2026-07-19 | Name: Eclipse | Hides what's behind it while proving it's there |
| 2026-07-19 | Fixed `Vector[8]` amounts/salts; pad unused with 0 | Compact static bounds; matches max-8 guardrail |
| 2026-07-19 | Commitment = `H(amount \|\| recipientPk \|\| salt)` | Extensible to claim without plaintext ledger |
| 2026-07-19 | Drop `balancedProofPosted`; use `status = Distributed` | One public balanced signal; less ledger clutter |
| 2026-07-19 | Public via ledger writes/returns, not disclose-alone | Matches Midnight Network Notes |
| 2026-07-19 | `managed/` committed snapshot + CI regen/diff | L1 evidence; catch circuit drift |
| 2026-07-19 | Gate 0 = distribute only; L1 adds create + stub fund; claim post-L1 | Spike the ZK heart first; still ship Eclipse for L1 |
| 2026-07-19 | Stub `fund` for L1 (no FungibleToken yet) | Unblocks Preprod deploy without token-custody complexity |
| 2026-07-19 | Compact helpers: sumVector8, assertLifecycle, commitRecipient | Thin circuits; easier to test and maintain |
| 2026-07-19 | Kill-switch: equal-splits after ~2 days | Conscious fallback, not drift |
| 2026-07-19 | Three adapters only; factory + constructor injection | Maintainability; boundaries tripwire |
| 2026-07-19 | Local docs gitignored; public README gains L1/L3 sections at file time | Judges see README; planning stays private |
