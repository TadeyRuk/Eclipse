# Eclipse — Boundaries & Gates

Purpose: keep Eclipse shippable within the program timeline. Every "wouldn't it be cool if" gets checked against this file first. If it's not inside a gate below, it does not get built this cycle.

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
- ❌ Hiding deposit total (inherently public — it's a real token transfer)
- ❌ Mobile app, browser-extension, desktop app — web only
- ❌ Fiat anything, price feeds, stablecoin logic
- ❌ Identity/KYC of any kind — wallet address IS the identity
- ❌ Admin dashboards, analytics, notifications — demo-relevant features only

## Numeric Guardrails

| Constraint | v1 value | Why |
|---|---|---|
| Max recipients per payroll | 8 | ZK circuits favor static bounds; keeps proof time sane; enough for demo |
| Contracts deployed | 1 | One contract instance per payroll run is acceptable; no factory pattern yet |
| Supported wallets | 1 (Lace) | Program requirement; no wallet-abstraction layer beyond the port interface |
| Supported networks | Preprod (+ local for dev) | Mainnet is Level 6 concern, not now |

## Sequencing Gates (order is mandatory)

1. **Gate 0 — Feasibility spike:** `distribute()` sum-proof circuit compiles and a test passes locally. **Nothing else starts before this.** If the pattern fights the compiler for more than ~2 focused days, escalate: simplify (equal-splits variant) or pivot idea with mentor approval — decided consciously, not by drift.
2. **Gate 1 — Level 1 submission:** toolchain + deployed contract + README. Uses the Eclipse contract itself (even minimal) — no throwaway hello-world repo divergence.
3. **Gate 2 — Level 2 submission:** wallet connect + circuit call from UI. UI may be ugly; privacy behavior must be observable.
4. **Gate 3 — Idea approval:** Private Payroll proposal submitted and approved before deep Level 3 polish.
5. **Gate 4 — Level 3 submission:** tests + CI/CD + demo video + privacy-model README.

Rule: a gate is not "done" until the submission is actually filed on Rise In, not just code-complete.

## Complexity Tripwires (stop and re-read this file if…)

- A second smart contract appears
- Any circuit needs more than ~5 witnesses
- The SDK grows a third adapter beyond wallet/contract(/proof)
- Any feature exists that the 60-second demo video will not show
- A dependency gets added that isn't: Midnight tooling, React, Vite, Tailwind, Zustand, vitest, testing-library
- More than 20% of a week goes to UI polish before Gate 3 passes

## Decision Log (append-only)

| Date | Decision | Why |
|---|---|---|
| 2026-07-19 | Idea: Private Payroll/Splits (list item 6) | Niche pick, real ZK depth, same skeleton as allowlist but one axis harder |
| 2026-07-19 | Employer deposits existing tokens, no minting | Realism; matches FungibleToken flow |
| 2026-07-19 | Single atomic distribute() call | Running-total-across-calls is a harder ZK state problem; one-shot is provable and demoable |
| 2026-07-19 | Amounts private even from post-hoc employer queries | On-chain state never stores plaintext amounts; employer's local records are their own business |
| 2026-07-19 | Recipient list public in v1 | Hiding membership too doubles circuit complexity; amounts-privacy is the product claim |
| 2026-07-19 | Name: Eclipse | Hides what's behind it while proving it's there |
