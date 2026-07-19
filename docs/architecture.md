# Eclipse — Architecture

Private payroll / splits on Midnight. Employer deposits a fixed pool of tokens, assigns per-recipient amounts privately, distributes once. Individual amounts never appear on the public ledger; only the proof that totals balance.

This document is the single source of truth for structure, boundaries, stack, and pipeline. `boundaries.md` gates what does NOT belong here.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Employer's Browser                        │
│  ┌───────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │  Web App (UI) │──▶│  Eclipse SDK      │──▶│ Lace Wallet    │  │
│  │  React        │   │  (adapter layer)  │   │ (DApp connector)│ │
│  └───────────────┘   └────────┬─────────┘   └───────┬────────┘  │
│                               │                      │           │
│                      ┌────────▼─────────┐            │           │
│                      │  Local Proof     │            │           │
│                      │  Server (Docker) │            │           │
│                      └────────┬─────────┘            │           │
└───────────────────────────────┼──────────────────────┼──────────┘
                                │  proof only          │  signed tx
                                ▼                      ▼
                    ┌─────────────────────────────────────┐
                    │      Midnight Preprod Network        │
                    │  ┌─────────────────────────────┐    │
                    │  │   Eclipse Contract (Compact) │    │
                    │  │   public ledger + verifier   │    │
                    │  └─────────────────────────────┘    │
                    └─────────────────────────────────────┘
```

Key architectural fact: **circuits execute locally on the user's device; only proofs and signed transactions reach the network.** Raw amounts never leave the employer's machine except as (a) proof material and (b) per-recipient private state readable only by that recipient.

## 2. Workspace Structure (monorepo)

```
eclipse/
├── contracts/                  # Compact contract package
│   ├── src/
│   │   └── eclipse.compact     # single contract, all circuits
│   ├── managed/                # generated: circuits + keys (gitignored artifacts, CI-verified)
│   └── tests/                  # contract-level tests
├── apps/
│   └── web/                    # React frontend (single app, role-based views)
│       ├── src/
│       │   ├── views/
│       │   │   ├── employer/   # create payroll, add recipients, distribute
│       │   │   └── employee/   # view own payment, claim
│       │   ├── components/     # shared presentational components
│       │   └── state/          # app state (see §5)
│       └── tests/
├── packages/
│   ├── sdk/                    # Eclipse SDK — THE adapter layer (see §4)
│   │   ├── src/
│   │   │   ├── wallet/         # Lace / DApp-connector adapter
│   │   │   ├── contract/       # typed circuit-call wrappers
│   │   │   ├── proof/          # proof-server client adapter
│   │   │   └── types/          # shared domain types (Payroll, Recipient, Receipt)
│   │   └── tests/
│   └── config/                 # shared tsconfig / eslint / prettier presets
├── docs/                       # this directory
├── .github/workflows/          # CI/CD (see §7)
└── package.json                # workspace root (npm workspaces)
```

Rules:
- **Dependency direction is one-way:** `apps/web` → `packages/sdk` → (Midnight.js, Lace connector). The web app never imports Midnight.js directly. Contract package depends on nothing internal.
- One package = one responsibility. If a module needs a paragraph to explain, it's two modules.
- `managed/` artifacts are build outputs — regenerated in CI, never hand-edited. (Program requires the directory present in the repo for L1 evidence; keep a committed snapshot plus CI regeneration check that they match.)

## 3. Smart Contract (Compact)

### Ledger (public state)
| Field | Type | Purpose |
|---|---|---|
| `employer` | address/PK | Who created this payroll instance |
| `depositTotal` | Uint | Publicly visible pool size (real token transfer in) |
| `recipients` | Set<address> | Who is owed a payment (membership only, no amounts) |
| `receiptCommitments` | Map<address, Bytes> | Per-recipient commitment (hash) — lets recipient prove/claim, reveals nothing |
| `status` | enum {Created, Funded, Distributed} | Lifecycle guard |
| `balancedProofPosted` | Boolean | Set true only when sum-proof verifies |

### Circuits (exported)
| Circuit | Caller | Private witnesses | Discloses |
|---|---|---|---|
| `createPayroll(recipients)` | Employer | — | recipient set, employer |
| `fund(amount)` | Employer | — | depositTotal (inherent to token transfer) |
| `distribute(amounts[])` | Employer | all per-recipient amounts | `balanced: true` + per-recipient commitments |
| `claim()` / `viewReceipt()` | Recipient | recipient's secret key material | validity of their own claim only |

### Core invariant (the ZK heart)
`distribute()` asserts internally: `sum(amounts) == depositTotal` and `len(amounts) == len(recipients)`. On success discloses only the boolean. Individual `amounts[i]` values bind into per-recipient commitments; never written as plaintext ledger state.

### Lifecycle guards
- `fund` only from `Created`, `distribute` only from `Funded`, no re-entry to any prior state. One-shot by construction — no partial distribution, no top-up, no withdrawal circuit exists at all (absence of code is the security control).

### Token handling
- Employer deposits an existing Preprod test token (faucet-sourced). Base pattern: OpenZeppelin `FungibleToken.compact` conventions for the transfer-in; Eclipse's own ledger tracks the pool. No minting inside Eclipse.

## 4. Eclipse SDK (adapter layer)

Purpose: isolate every external dependency behind an interface the app owns. Midnight.js, the DApp connector API, and the proof server are young, fast-moving dependencies — version churn lands here, not in app code.

```
packages/sdk/src/
├── wallet/
│   ├── WalletPort.ts        # interface: connect(), disconnect(), sign(), state()
│   └── LaceAdapter.ts       # only file that touches window.midnight / DApp connector
├── contract/
│   ├── EclipsePort.ts       # interface: createPayroll(), fund(), distribute(), claim()
│   └── MidnightAdapter.ts   # only file that imports Midnight.js contract APIs
├── proof/
│   └── ProofClient.ts       # local proof-server transport, health check, timeout policy
└── types/                   # Payroll, Recipient, Receipt, Result<T, EclipseError>
```

Rules:
- Ports are stable; adapters are replaceable. Tests mock ports, never adapters.
- All SDK functions return typed `Result` (success | typed error) — no thrown exceptions crossing the SDK boundary.
- Error taxonomy lives in one place: `WalletNotConnected`, `ProofServerDown`, `CircuitRejected`, `TxFailed`, `Timeout`. UI maps these to user-facing messages; SDK never contains UI strings.

## 5. Frontend (apps/web)

- **Stack:** React 18 + Vite + TypeScript (strict) + Tailwind. Matches existing tooling experience (Beans, Big-T-Web) — no new framework risk on a deadline.
- **State:** local component state + one thin store (Zustand) for session-level state (wallet connection, active payroll). No server state library — there is no server; chain + SDK is the backend.
- **Views:** two route groups, `/employer/*` and `/employee/*`, one codebase. Role determined by which flow the user enters, not by auth (wallet identity is the auth).
- **Rendering rule:** components never call the SDK directly during render; all chain interaction flows through explicit user actions → SDK → typed result → store update.

## 6. Security & Privacy Model (first-class)

- **Private by default, disclose by exception.** Every `disclose()` call in the contract requires a paired justification comment and an entry in `privacy-model.md`. CI greps for undocumented `disclose(` occurrences.
- **What each party can learn** is specified in `privacy-model.md` and mirrored in the README (a judged Level 3 artifact).
- **No secrets in repo.** Wallet seeds, faucet keys — never committed. `.env.example` documents required vars; real `.env` gitignored. Sensitive local config lives in `~/.config/eclipse/` per machine convention.
- **Contract security posture:** minimal surface (4 circuits), lifecycle state machine prevents ordering attacks, no withdrawal path exists, arithmetic is bounded (Uint overflow checked by compiler/assertions).
- **Dependency hygiene:** lockfile committed; CI audits (`npm audit` gate + pinned versions for Midnight.js/SDK deps since pre-1.0 APIs break).

## 7. CI/CD (first-class citizen)

GitHub Actions, three workflows:

### `ci.yml` — every push + PR
1. Install (frozen lockfile — fails if lockfile drifts from manifest)
2. Typecheck (`tsc --noEmit` across workspace)
3. Lint (eslint + prettier check, shared config from `packages/config`)
4. **Contract compile** (`compact compile`) — the circuit must build on clean checkout
5. **Managed-artifact check** — regenerated `managed/` matches committed snapshot (catches "works on my machine" circuit drift)
6. Contract tests + SDK tests + app tests (3+ required by L3; target well above)
7. Build web app (production Vite build must succeed)

### `deploy.yml` — main branch only, after ci passes
- Deploy `apps/web` to Vercel (program requires live demo link)
- Preprod contract address injected via environment variable, never hardcoded

### `security.yml` — scheduled weekly + on dependency changes
- `npm audit` (fail on high/critical)
- Dependency-review on PRs touching `package.json`

Rules:
- **No direct pushes to `main`** — PRs only, CI green required to merge.
- Badge in README (judged artifact for L3).
- Every level submission is a tagged release (`level-1`, `level-2`, `level-3`) — clean evidence trail for the committee.

## 8. Testing Strategy

| Layer | Tool | What's tested |
|---|---|---|
| Contract | Compact test framework / vitest harness | invariants: sum==total passes, sum!=total rejects, lifecycle order enforced, double-distribute rejected |
| SDK | vitest, ports mocked | adapter error mapping, result types, timeout behavior |
| App | vitest + testing-library | employer flow renders, employee flow renders, error states surface |
| E2E (L4+) | Playwright | full flow against local proof server + Preprod |

Minimum bar: the three contract invariant tests above are non-negotiable — they ARE the product's correctness claim.

## 9. Conventions

- TypeScript strict everywhere; no `any` without an inline justification comment.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`) — also satisfies "meaningful commits" program requirements legibly.
- File naming: `PascalCase.tsx` components, `camelCase.ts` modules, one exported symbol per file in the SDK.
- Formatting is machine-owned (prettier) — never a review topic.

## 10. Known Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Midnight.js / connector API churn (pre-1.0) | All contact isolated in two adapter files; pin versions; upgrade deliberately |
| Sum-proof pattern has no official worked example | Prototype `distribute()` circuit first, before any UI work — fail fast if pattern fights the compiler |
| Proof generation latency unknown | Measure at Level 1; UI designs for seconds-scale waits (progress states), not instant feedback |
| Fixed-size recipient arrays (ZK circuits often need static bounds) | Capped at 8 recipients per payroll for v1 (see boundaries.md numeric guardrails) |
| Recipient claim UX depends on private-state APIs | Validate during Level 2 wallet integration before promising claim flow in demo |
