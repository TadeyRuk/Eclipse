# Eclipse

[![CI](https://github.com/TadeyRuk/Eclipse/actions/workflows/ci.yml/badge.svg)](https://github.com/TadeyRuk/Eclipse/actions/workflows/ci.yml)

Private payroll on [Midnight](https://midnight.network). An employer deposits a fixed pool of tokens and distributes it across a known set of recipients with individually private amounts — a zero-knowledge proof guarantees the hidden amounts sum exactly to the public deposit, so anyone can verify the books balance without anyone, including the chain itself, ever learning who received what.

Built for Rise In's [New Moon to Full: Monthly Moonshots on Midnight](https://www.risein.com/programs/new-moon-to-full-monthly-moonshots-on-midnight) program — Level 3 idea list, *Private Payroll / Splits*.

## Status

Level 2 Waxing Crescent **ready to file** — all requirements met: Lace connect/disconnect, a circuit
called from the frontend, observable privacy via the dual-view UI (employer wizard + observer
ledger), a verifiable Preprod contract, live demo, and demo video. SDK adapters sit behind a
`Result` boundary; privacy wipe tests cover the amount-clearing claim.

Level 3 First Quarter **in progress** — CI/CD is green (typecheck → test → build on every push), the
test suite stands at 43 across three workspaces, the `claim` circuit is live end to end (employee
claims a slot without revealing its amount), the product proposal for idea #6 is drafted
([docs/proposal.md](docs/proposal.md)), and a one-minute demo video is recorded (illustrated
walkthrough — see note below). Remaining: real FungibleToken `fund` transfer-in, a redeploy carrying
the `claim` circuit, and filing the proposal on Rise In for approval.

Running create → fund → distribute yourself needs a local proof-server on `127.0.0.1:6300` — circuits
prove locally by design, so this is inherent to Midnight, not a shortcut. Connect-only works on the
hosted demo without one.

**Last updated:** 2026-07-26 · Program window: 2026-06-29 → 2026-07-31

### Live demo

| Surface | URL |
|---|---|
| Employer wizard | [https://eclipse-private-payroll.netlify.app/employer](https://eclipse-private-payroll.netlify.app/employer) |
| Observer ledger | [https://eclipse-private-payroll.netlify.app/observer](https://eclipse-private-payroll.netlify.app/observer) |

Connect-only works on the hosted site without a proof-server. Create → fund → distribute needs Lace (Preprod) plus a local proof-server on `127.0.0.1:6300`.

### Contract address

| Network | Address | Circuits |
|---|---|---|
| Preview | — | — |
| Preprod | [`3aec836e6c723531cb13803e63795d531117c73231fa7793372c504a8bfa3d47`](https://explorer.1am.xyz/contract/3aec836e6c723531cb13803e63795d531117c73231fa7793372c504a8bfa3d47?network=preprod) | `createPayroll`, `fund`, `distribute` |

> **Note:** the deployed instance above predates the `claim` circuit — it carries the three L1/L2
> circuits, and its ledger has no `claimed` vector. The repo now compiles four circuits, so
> `claim` is exercised by the contract tests and the in-memory demo path, not yet by this address.
> A redeploy is pending: a cold Preprod dust sync runs ~2 hours and does not resume across
> attempts, which is the honest reason it is not done yet rather than an oversight.

**Evidence:** [L1 compile](docs/evidence/l1-compile.png) · [L1 deploy](docs/evidence/l1-deploy.png) · [L2 connect](docs/evidence/l2-connect.png) · [L2 distribute](docs/evidence/l2-distribute.png) · [L2 observer](docs/evidence/l2-observer.png) · [L2 demo video](docs/evidence/l2-demo.webm) · [L2 storyboard](docs/evidence/l2-demo-storyboard.md) · [L3 tests (43 passing)](docs/evidence/l3-tests.png) · [L3 storyboard](docs/evidence/l3-demo-storyboard.md) · [L3 demo video](docs/evidence/l3-demo.mp4)

> The L3 demo video is an **illustrated walkthrough** — a Remotion recreation of the six
> storyboard beats (connect, private split, distribute, observer, claim, proof lands), not a
> screen capture of a live Preprod session. The L2 video above is a real capture with Lace
> connected; this one narrates the same UI and lifecycle without requiring a live wallet signature
> to reproduce. Every screen and value shown matches the actual app's components, copy, and theme.

### Progress (Gantt)

```mermaid
gantt
    title Eclipse — Rise In New Moon to Full
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    todayMarker off

    section Foundation
    Architecture and privacy docs     :done,    arch, 2026-07-19, 1d
    Gate0 sum-proof circuit plus tests :done,   g0,   2026-07-19, 1d

    section Level1_NewMoon
    createPayroll and stub fund       :done,    l1a, 2026-07-20, 1d
    Preprod deploy and screenshots    :done,    l1b, 2026-07-20, 1d
    File Level1 on Rise In            :done,    l1c, 2026-07-20, 1d

    section Level2_WaxingCrescent
    Lace SDK dual-view UI             :done,    l2a, 2026-07-20, 1d
    Live demo and demo video          :done,    l2b, 2026-07-20, 1d
    File Level2 on Rise In            :active,  l2c, 2026-07-20, 1d

    section Level3_FirstQuarter
    CI pipeline and badge             :done,    l3a, 2026-07-26, 1d
    Product proposal idea 6           :done,    l3b, 2026-07-26, 1d
    FungibleToken fund and claim      :active,  l3c, 2026-07-27, 3d
    One minute demo video             :done,    l3d, 2026-07-30, 1d
    File Level3 on Rise In            :crit,    l3e, 2026-07-31, 1d
```

| Gate / level | State |
|---|---|
| Gate 0 — sum-proof spike | **Done** |
| Level 1 — New Moon | **Filed** (Rise In) |
| Level 2 — Waxing Crescent (Lace + dual-view) | **Ready to file** (Rise In) |
| Level 3 — First Quarter (full dApp + CI) | **In progress** — CI, 43 tests, `claim`, proposal draft, demo video done |

Sequencing rules: [docs/boundaries.md](docs/boundaries.md). Level filing playbooks: [docs/submission.md](docs/submission.md).

## Initial idea

Eclipse is a private payroll dApp on Midnight. An employer deposits a fixed pool of test tokens, assigns each recipient's share privately, and distributes in one atomic transaction. A zero-knowledge proof guarantees the hidden amounts sum exactly to the public deposit — so recipients and observers can trust the books balance without anyone (including the chain itself) ever seeing who earned what. Salary privacy is a real-world norm; Eclipse makes it a verifiable one.

## Privacy claim (L2)

Individual payroll amounts are **private witnesses**. Observers (and the chain) see employer, recipient addresses, `depositTotal`, `status`, and opaque `receiptCommitments` — never plaintext per-recipient amounts. The employer UI clears amounts from memory and the DOM after a successful distribute; the `/observer` route has no amount inputs. Disclosure ledger: [docs/privacy-model.md](docs/privacy-model.md).

## Public state vs private witness

In Compact, circuit inputs are **private by default**. Data becomes public when it is written to the ledger (or returned / passed cross-contract) — not merely because `disclose()` appears in source.

| Public (ledger) | Private (witnesses) |
|---|---|
| Employer, recipient addresses, `depositTotal` | Per-recipient `amounts` |
| `status` (`Created` → `Funded` → `Distributed`) | Per-recipient `salts` |
| `receiptCommitments` (opaque hashes) | Anything not written to ledger |

`distribute()` asserts `sum(amounts) == depositTotal` without putting individual amounts on-chain.

## Quick Start

```bash
# Node 22 (see .nvmrc)
npm install

# Compile the Compact contract (requires Compact CLI)
cd contracts && npm run compile

# Contract + SDK + web privacy tests
npm test
```

### Web UI (local)

```bash
# Terminal A — proof server (required for create/fund/distribute); pin to ledger 8.1.0
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v

# Terminal B — dual-view app (add VITE_USE_CHAIN=1 for real Preprod callTx)
npm run dev -w @eclipse/web
# open http://127.0.0.1:5173/employer and /observer
```

Needs Lace (Preprod) + funded tDUST for a real wallet connect. Connect-only works without the proof-server; circuits call `ProofClient.healthCheck()` first and fail closed if `:6300` is down.

### Deploy contract (Preprod)

```bash
cd contracts && MIDNIGHT_NETWORK=preprod npm run deploy
```

On-chain create→fund→distribute (same Midnight.js path as the UI, deploy wallet):

```bash
MIDNIGHT_NETWORK=preprod npm run lifecycle -w @eclipse/contracts
```

## Live demo prerequisites

Judges on Netlify **cannot** use your laptop’s proof-server unless they run one locally.

1. Install [Lace](https://www.lace.io/) and switch to **Preprod**
2. Fund tDUST via the Midnight faucet (and ensure Night is registered for dust generation)
3. Run the proof-server on loopback:

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

4. Open the live demo → Connect Lace → Employer create → stub fund → distribute (`VITE_USE_CHAIN=1` on Netlify)
5. Open `/observer`: public status + commitments; **no** private amounts

Transport modes:

- **`VITE_USE_CHAIN=0`:** in-memory ledger for dual-view privacy demos without fees
- **`VITE_USE_CHAIN=1`:** Midnight.js `findDeployedContract` + `callTx` via Lace + local proof-server **8.1.0**; observer reads the Preprod indexer

## Architecture

Monorepo: `apps/web` → `packages/sdk` → Lace / proof-server. The web app never imports Midnight.js. SDK ports (`WalletPort`, `EclipsePort`) return typed `Result`; adapters (`LaceAdapter`, `MidnightAdapter`, `ProofClient`) are the only external-touch files.

Details: [docs/architecture.md](docs/architecture.md). Scope gates: [docs/boundaries.md](docs/boundaries.md).

## Privacy Model

### What an observer can learn

Anyone querying the chain sees the employer address, the full recipient list, the `depositTotal`, the
lifecycle `status`, and eight opaque `receiptCommitments`. When `status = Distributed`, they also
learn something stronger: that the distribution **provably balanced** — the hidden amounts sum
exactly to the public deposit.

### What an observer cannot learn

No chain query by anyone — including the employer — returns an individual amount. Per-recipient
`amounts` and `salts` are private witnesses; they never become ledger state. The commitments are
hashes, opaque without the opening a recipient holds.

| Fact | Employer | Recipient (self) | Recipient (others) | Observer |
|---|---|---|---|---|
| Payroll exists, employer address | ✅ | ✅ | ✅ | ✅ |
| Deposit total | ✅ | ✅ | ✅ | ✅ |
| Recipient list | ✅ | ✅ | ✅ | ✅ |
| Distribution balanced (proven) | ✅ | ✅ | ✅ | ✅ |
| Which slots have claimed | ✅ | ✅ | ✅ | ✅ |
| Own amount | ✅ | ✅ | — | ❌ |
| **Any individual amount from chain data** | ❌ | ❌ | ❌ | ❌ |

### Why this needs ZK rather than encryption

Posting encrypted amounts would hide the values but prove nothing — an observer could not distinguish
an honest payroll from one whose numbers don't add up, or where the employer kept half the pool.
Because the sum check runs *inside* the circuit, an unbalanced distribution cannot produce a valid
proof, so it cannot be confirmed. Recipients trust the math, not the employer.

### Honest limitations

- **Small-N inference.** With one recipient, their amount equals the public total; with two, each can
  infer the other's. Amount privacy is meaningful from N=3 upward — a property of the arithmetic, not
  a defect in the circuit.
- **Claim timing is public.** `claimed[]` is a per-slot flag, so observers learn which recipient
  claimed and when — never how much. A nullifier-set design would hide the slot too; it was weighed
  and deferred, since the amount-privacy claim does not depend on it.
- **The deposit total is public by design.** Observers learn the company distributed 1000 tokens.
  What is protected is the split, not the spend.
- **The recipient list is public in v1.** Observers learn *who* was paid, not *how much*. Hiding
  membership is a possible v2, out of scope per [docs/boundaries.md](docs/boundaries.md).
- **Off-chain leakage is out of scope.** If the employer emails a spreadsheet, no chain helps.

Full disclosure ledger and trust assumptions: [docs/privacy-model.md](docs/privacy-model.md).

## Testing

```bash
npm test
```

43 tests across three workspaces:

- **contracts** — 10 tests: sum-proof, lifecycle ordering, and claim (valid opening, wrong amount
  rejected, double-claim rejected, claim-before-distribute rejected)
- **@eclipse/sdk** — 17 tests: Result mapping, salts, ProofClient loopback, mock-port adapters,
  receipt-opening storage and the claim path
- **@eclipse/web** — 16 tests: amount wipe after distribute, employee claims without rendering the
  amount, observer has no private amount fields, `MAX_RECIPIENTS` validation (6 privacy tests), plus
  10 render/prop tests for the Card/Tag/Button/Pill/StatChip/GradientField UI primitives

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck → test → build on every push
and pull request to `main`. `contracts/managed/` (compiled circuit, keys, zkir) is committed, so CI
needs neither the Compact compiler nor a proof server, and never touches the network.

## Documentation

| Doc | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Docs index |
| [docs/proposal.md](docs/proposal.md) | Product proposal — idea #6, Private Payroll / Splits |
| [docs/submission.md](docs/submission.md) | Rise In submission playbook |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/privacy-model.md](docs/privacy-model.md) | Who learns what |
| [docs/boundaries.md](docs/boundaries.md) | Scope and gates |

## License

MIT
