# Eclipse — Architecture

Private payroll / splits on Midnight. Employer deposits a fixed pool of tokens, assigns per-recipient amounts privately, distributes once. Individual amounts never appear on the public ledger; only the proof that totals balance.

This document is the single source of truth for structure, boundaries, stack, and pipeline. `boundaries.md` gates what does NOT belong here. Program requirements: `Midnight.md`.

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

---

## 2. Workspace Structure (monorepo)

```
eclipse/
├── contracts/                  # Compact contract package
│   ├── src/
│   │   └── eclipse.compact     # single contract, all circuits
│   ├── managed/                # generated: circuits + keys (committed snapshot; CI regenerates & diffs)
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
│   │   │   ├── createEclipseSdk.ts  # factory (wiring only)
│   │   │   └── types/          # shared domain types (Payroll, Recipient, Receipt)
│   │   └── tests/
│   └── config/                 # shared tsconfig / eslint / prettier presets
├── docs/                       # this directory (local planning — not on public GitHub)
├── .github/workflows/          # CI/CD (see §7)
└── package.json                # workspace root (npm workspaces)
```

Rules:
- **Dependency direction is one-way:** `apps/web` → `packages/sdk` → (Midnight.js, Lace connector). The web app never imports Midnight.js directly. Contract package depends on nothing internal.
- One package = one responsibility. If a module needs a paragraph to explain, it's two modules.
- **`managed/` policy:** commit a snapshot under `contracts/managed/` (L1 requires the directory present). CI regenerates on a clean checkout and fails if the diff does not match. Never hand-edit generated files. Signing keys under `managed/keys/` may remain gitignored if the program allows — prefer committing whatever L1 evidence requires for a clean clone.

### 2.1 Modularity & maintainability

| Layer | Owns | Must NOT |
|---|---|---|
| **Contract** | Ledger schema, lifecycle guards, ZK invariants, commitment math | Import SDK/app; call wallet; UI strings |
| **SDK ports** | Stable async API, `Result<T>`, domain types | Import Midnight.js / `window.midnight` |
| **SDK adapters** | Wire format mapping, timeouts, version pins | Business logic duplicated from contract |
| **App views** | UX, loading/error states, route layout | Direct Midnight.js; thrown exceptions from SDK |
| **App state** | Wallet session, active payroll id, last SDK error code | Amount witnesses, salts, proof payloads |

**Rule:** Each layer is testable without the layer above. Contract tests need no browser; SDK tests mock ports; app tests mock `EclipsePort` / `WalletPort`.

**Contract internal structure** (single `eclipse.compact`, thin circuits):
- **Ledger block** — all public fields in one place
- **Pure helpers** (non-exported) — `sumVector8`, `assertLifecycle`, `commitRecipient`
- **Exported circuits** — orchestration only: read ledger → helpers → write ledger
- **Constants** — `MAX_RECIPIENTS = 8` defined once

**Change management:**
- Decision log (`boundaries.md`) before any ledger field or port method change
- Privacy public-surface table (`privacy-model.md`) before any new public field
- Version pins for Midnight.js / connector live in `packages/sdk/package.json` only
- Tagged releases: `level-1`, `level-2`, `level-3`

**Observability:**

| Concern | Where handled |
|---|---|
| Proof slow/fail | `ProofClient` duration logs; UI progress state |
| Circuit reject | Named contract tests; SDK maps to `CircuitRejected` |
| Wallet disconnect | `WalletPort` state; app blocks submit |
| Ledger drift vs types | Single `mapLedgerToPayroll()` in MidnightAdapter |
| CI signal | Compile + tests + managed diff — fail fast per layer |

---

## 3. Smart Contract (Compact)

### Ledger (public state)

| Field | Type | Purpose |
|---|---|---|
| `employer` | address/PK | Who created this payroll instance |
| `depositTotal` | Uint | Public pool size (stub-writable at L1; real token transfer post-L1) |
| `recipients` | ordered list / fixed slots (max 8) | Who is owed a payment (membership only, no amounts). Insertion order binds `amounts[i]` |
| `receiptCommitments` | Map\<address, Bytes\> or Vector\[8\] | Per-recipient commitment — enables claim later; reveals nothing alone |
| `status` | enum {Created, Funded, Distributed} | Lifecycle guard; `Distributed` is the public “balanced” signal |

Dropped: `balancedProofPosted` (redundant with `status = Distributed`).

### Internal helpers (non-exported)

| Helper | Responsibility |
|---|---|
| `sumVector8` | Sum `amounts[0..7]`; reject nonzero padding on unused slots |
| `assertLifecycle` | Enforce Created→Funded→Distributed; reject re-entry |
| `commitRecipient` | `H(amount \|\| recipientPk \|\| salt)` |

### Circuits (exported)

Public data becomes public via **ledger writes** (and returns), not via `disclose()` alone. Midnight: circuit inputs are private by default; `disclose()` annotates compiler intent; data is public when it crosses into ledger / exported returns / cross-contract calls.

| Circuit | Caller | Private witnesses | Ledger writes |
|---|---|---|---|
| `createPayroll(recipients)` | Employer | — | `employer`, `recipients`, `status = Created` |
| `fund(amount)` | Employer | — | `depositTotal`, `status = Funded` (L1: stub set; post-L1: with FungibleToken transfer-in) |
| `distribute(amounts, salts)` | Employer | `amounts` Vector\[8\], `salts` Vector\[8\] | `receiptCommitments`, `status = Distributed` |
| `claim()` | Recipient | recipient key / opening material | claim validity only (caller-scoped). **Post-L1** |

### Core invariant (the ZK heart)

`distribute()` asserts: `sum(amounts[0..7]) == depositTotal`, unused slots are `0`, and index `i` binds to recipient at insertion order. On success writes commitments + `status = Distributed`. Individual amounts never become plaintext ledger state.

### Lifecycle guards

- `fund` only from `Created`, `distribute` only from `Funded`, no re-entry. One-shot — no partial distribution, no top-up, no withdrawal circuit (absence of code is the security control).

### Token handling

- **Gate 0 / L1:** stub `depositTotal` as a public Uint (no FungibleToken wiring required for the spike or L1 deploy).
- **Post-L1:** employer deposits an existing Preprod test token (faucet-sourced). OpenZeppelin `FungibleToken.compact` conventions for transfer-in; Eclipse ledger tracks the pool. No minting inside Eclipse.

### 3.1 Gate 0 circuit sketch

**In spike:** stub ledger fields needed for the sum check + internal helpers + `distribute()` only.

**Out of spike:** `createPayroll`, `fund`, `claim`, Lace, UI, adapters, FungibleToken.

| Item | Decision |
|---|---|
| Shape | Fixed `Vector[8]`; unused amounts = `0`; recipient order = insertion order |
| Sum | `sum(amounts[0..7]) == depositTotal` |
| Witnesses | `amounts`, `salts` |
| Commitments | `commitment[i] = H(amount[i] \|\| recipientPk[i] \|\| salt[i])` |
| Success | Write commitments; `status = Distributed` |
| Fail | Proof reject; no ledger update |
| Tests | `distribute_accepts_when_sum_equals_total`; `distribute_rejects_when_sum_exceeds_total` |

```
Witnesses (amounts, salts) ──┐
Ledger (depositTotal, …) ────┼──▶ distribute ──▶ helpers (sumVector8, commitRecipient)
                             │         │
                             │         ├─ sum OK ──▶ ledger: commitments, status=Distributed
                             │         └─ sum fail ─▶ proof reject
```

### 3.2 Level 1 circuit expansion (after Gate 0)

| Piece | In L1? | Notes |
|---|---|---|
| Helpers + `distribute()` | Yes | From Gate 0 |
| `createPayroll` | Yes | Recipients + employer on ledger |
| `fund` (stub) | Yes | Public `depositTotal`; no FungibleToken yet |
| `claim` | No | Post-L1 |
| Lace / UI / adapters | No | Level 2 |

L1 also needs: `managed/` committed, Preprod deploy + address, public README sections (setup, public vs private witness, idea), screenshots, ≥5 commits, **filed on Rise In**. See `TASKS.md` and `Midnight.md`.

---

## 4. Eclipse SDK (adapter layer)

Purpose: isolate every external dependency behind an interface the app owns. Midnight.js, the DApp connector API, and the proof server are young, fast-moving dependencies — version churn lands here, not in app code.

```
packages/sdk/src/
├── createEclipseSdk.ts      # factory — only wiring file
├── wallet/
│   ├── WalletPort.ts        # interface: connect(), disconnect(), sign(), state()
│   └── LaceAdapter.ts       # only file that touches window.midnight / DApp connector
├── contract/
│   ├── EclipsePort.ts       # interface: createPayroll(), fund(), distribute(), claim()
│   └── MidnightAdapter.ts   # only file that imports Midnight.js; implements EclipsePort
├── proof/
│   └── ProofClient.ts       # local proof-server transport, health check, timeout policy
├── internal/
│   └── safeAsync.ts         # try/catch → Result helper (adapters only)
└── types/                   # Payroll, Recipient, Receipt, Result, MAX_RECIPIENTS
```

### 4.1 Ports vs adapters

Three adapters, two ports. App codes against ports; factory wires adapters.

| Adapter | File | External dep | Responsibility |
|---|---|---|---|
| **LaceAdapter** | `wallet/LaceAdapter.ts` | DApp connector / `window.midnight` | connect, disconnect, `state()`, sign |
| **MidnightAdapter** | `contract/MidnightAdapter.ts` | Midnight.js | Implements `EclipsePort`. Orchestrates proof → sign → submit. Single `mapLedgerToPayroll()`. |
| **ProofClient** | `proof/ProofClient.ts` | HTTP to proof-server | `healthCheck()`, `prove()`, timeout + one retry on Timeout |

MidnightAdapter receives `ProofClient` + `WalletPort` via **constructor injection** (not `new LaceAdapter()` inside). If a method grows past ~80 lines, extract private helpers inside `contract/` — not a fourth adapter (boundaries tripwire).

### 4.2 Factory

```ts
export interface EclipseSdkConfig {
  proofServerUrl: string;       // default http://127.0.0.1:6300
  contractAddress: string;      // from env, never hardcoded in app
  network: 'preprod' | 'local';
}

export interface EclipseSdk {
  wallet: WalletPort;
  eclipse: EclipsePort;
}

export function createEclipseSdk(config: EclipseSdkConfig): EclipseSdk { /* wire adapters */ }
```

App imports **`createEclipseSdk` + port types only** — never adapter classes. Unit tests inject mocks; Gate 2 integration may use real Lace + proof-server.

### 4.3 Domain types (align when adapters land)

In `packages/sdk/src/types/domain.ts` (ports already exist; update when implementing):
- Drop `balancedProofPosted` from `Payroll` — use `status === 'Distributed'`
- Add `MAX_RECIPIENTS = 8` (constant shared conceptually with Compact)
- `distribute(amounts: bigint[])` on `EclipsePort` — MidnightAdapter packs salts/witnesses internally

### 4.4 Error mapping (adapter-owned)

Every `catch` ends in `err(kind, message, cause)` — never re-throw across the SDK boundary.

| Source | `EclipseErrorKind` | Where |
|---|---|---|
| Wallet not connected / user rejected sign | `WalletNotConnected` | LaceAdapter |
| Proof-server unreachable / 5xx | `ProofServerDown` | ProofClient |
| Proof timeout | `Timeout` | ProofClient |
| Circuit assertion / invalid witness | `CircuitRejected` | MidnightAdapter |
| Tx rejected / insufficient funds | `TxFailed` | MidnightAdapter |

UI maps **`kind` only**. Never log amounts or witnesses.

### 4.5 Error handling & fallbacks

**Principle:** typed `Result<T>`; fallbacks recover infra/UX — never skip proofs or weaken privacy.

| Layer | Pattern | try/catch? |
|---|---|---|
| Contract | `assert` / lifecycle; fail = proof reject | No |
| SDK adapters | External I/O only → `Result` via `safeAsync` | Yes — boundary only |
| Ports / factory | Wiring | No |
| App views | `if (!result.ok) setError(kind)` | No — never catch SDK |

**Fallback matrix:**

| Failure | Allowed | Forbidden |
|---|---|---|
| Sum ≠ total | User fixes amounts; retry | Auto-adjust; skip proof; plaintext ledger |
| Proof-server down | Pre-flight `healthCheck()`; Docker instructions; retry | Remote proof server; mock proof in prod |
| Proof timeout | 1 auto-retry same witnesses; then manual | Infinite retry; altered witnesses |
| Wallet disconnected | Block submit; reconnect; keep form | Cache signed tx without wallet |
| User rejects sign | Clear pending; resubmit | Auto re-prompt loop |
| Tx failed | Explorer link; full flow retry (new proof) | Resubmit same proof without confirm |
| Gate 0 compiler fight (~2 days) | Equal-splits (still private witnesses + sum-proof) | Pivot without mentor; weaken privacy claims |
| Midnight.js break | Pin version; fix MidnightAdapter only | Fork logic into app |

**Orchestration atomicity (`distribute`):** prove fails → no sign/submit. Sign fails → discard proof. Submit fails → user re-runs full flow. No resume-from-step-2.

### 4.6 Adapter build timeline

| When | What |
|---|---|
| Gate 0 / L1 | **Zero adapter code** — contract only |
| Post-L1 → L2 | `ProofClient` → `MidnightAdapter` → `LaceAdapter` → `createEclipseSdk` → wire one circuit from UI |

---

## 5. Frontend (apps/web)

- **Stack:** React 18 + Vite + TypeScript (strict) + Tailwind.
- **State:** local component state + thin Zustand store for session (wallet, active payroll, last error `kind`). No server state library — chain + SDK is the backend.
- **Views:** `/employer/*` and `/employee/*`. Wallet identity is auth.
- **Rendering rule:** SDK only from explicit user actions → typed result → store update. Never during render.
- **Pre-validation:** amounts length ≤ 8, sum preview — app-side before SDK call.
- **Debug:** `VITE_DEBUG=1` footer shows error `kind` / message / proof-server health — **never** amounts or salts.
- **Post-L1:** pre-flight `ProofClient.healthCheck()` on distribute screen.

---

## 6. Security & Privacy Model (first-class)

Canonical “who learns what”: `privacy-model.md`. Public README mirrors a short version at L1 (public vs private witness) and a fuller privacy-model section at L3.

### Four surfaces

| Surface | Threat | Control |
|---|---|---|
| Contract | Sum mismatch, double-distribute, overflow | Lifecycle; sum assert; no withdrawal; Gate 0 tests |
| Contract | Undocumented leakage | Every ledger write + `disclose(` row in privacy-model; CI disclose-grep |
| Client | Amounts/salts leaked | Memory only — never `localStorage` / URL params; DEBUG excludes witnesses |
| Client | XSS | No `dangerouslySetInnerHTML` / `eval` |
| Client | Wrong network | Contract address + network from env; factory validates Lace chain |
| SDK | Witnesses to wrong host | ProofClient defaults to `127.0.0.1:6300`; no remote proof URL in prod |
| SDK | Stack leaks to UI | `Result<T>`; `cause` dev-only |
| Repo / CI | Committed secrets | `.env` gitignored; `.env.example` keys only; faucet keys in `~/.config/eclipse/` |
| Supply chain | Bad deps | lockfile; `npm ci`; `npm audit` high/critical; pin Midnight.js |

### Privacy-critical rules

1. Witnesses never leave the device except to local proof-server on loopback.
2. No server-side Eclipse backend in v1.
3. Employer amounts stay in memory until proof; clear on navigate away.
4. Salts via `crypto.getRandomValues`; never logged.

### Gate 0 security scope

Contract invariants only (sum pass/reject). Client/SDK hygiene activate when those packages get code — documented now so the first adapter PR follows the rules.

---

## 7. CI/CD (first-class citizen)

GitHub Actions, three workflows. **Not required to file L1** (Midnight requires CI at L3); add when ready, ideally before L3.

### `ci.yml` — every push + PR

| Gate | Fails on |
|---|---|
| Install (`npm ci`) | Lockfile drift |
| Typecheck | Any `tsc` error |
| Lint + prettier | Style or import-boundary violation |
| Contract compile | Circuit does not build |
| Managed-artifact check | Regenerated `managed/` ≠ committed snapshot |
| Tests | Contract / SDK / app failures |
| Build web | Vite production build fails |
| disclose-grep (once contract exists) | `disclose(` without privacy-model row |

### `deploy.yml` — main, after ci

- Deploy `apps/web` to Vercel; Preprod contract address via env — never hardcoded.

### `security.yml` — weekly + dependency PRs

- `npm audit` fail on high/critical; dependency-review on `package.json` PRs.

Rules: no direct pushes to `main`; CI green to merge; README badge at L3; tagged releases per level.

---

## 8. Testing Strategy

| Layer | Tool | What's tested |
|---|---|---|
| Contract | Compact / vitest harness | Gate 0: sum pass/reject. L1+: lifecycle order, double-distribute reject. Named like `distribute_rejects_when_sum_exceeds_total` |
| SDK | vitest, ports mocked | Error mapping, Result types, timeout / one-retry behavior |
| App | vitest + testing-library | Flows render; error `kind` surfaces recovery UI |
| E2E (L4+) | Playwright | Full flow vs local proof-server + Preprod |

Minimum bar: Gate 0 sum invariants are non-negotiable — they ARE the product's correctness claim. L3 requires ≥3 tests passing (target well above).

---

## 9. Conventions & code hygiene

| Practice | Enforcement |
|---|---|
| TypeScript `strict` | `packages/config/tsconfig.base.json` |
| No `any` | Inline `// justify:` comment required |
| Formatting | Prettier (`packages/config/prettier.base.json`); CI `--check` |
| Lint | Shared ESLint; warnings-as-errors for SDK + app |
| Import boundaries | `apps/web` must not import `@midnight/*` or `contracts/` (`no-restricted-imports`) |
| One export per SDK file | Convention + review |
| Conventional Commits | `feat:`, `fix:`, `test:`, `docs:`, `ci:` |
| Lockfile | `npm ci` in CI |
| PR-only `main` | CI green to merge |

File naming: `PascalCase.tsx` components, `camelCase.ts` modules.

### Pre-merge review checklist

- [ ] No secrets, seeds, or real `.env` values in diff
- [ ] No new `disclose(` or ledger field without `privacy-model.md` update
- [ ] No Midnight.js import outside `MidnightAdapter.ts`
- [ ] No `window.midnight` outside `LaceAdapter.ts`
- [ ] No `localStorage` / URL params for amounts or salts
- [ ] SDK methods return `Result<T>`, not throw
- [ ] New dependency justified against `boundaries.md` tripwire list

---

## 10. Known Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Midnight.js / connector API churn (pre-1.0) | Isolated in adapters; pin versions; upgrade deliberately |
| Sum-proof pattern has no official worked example | Gate 0 first — fail fast; kill-switch = equal-splits after ~2 days |
| Proof generation latency unknown | Measure at L1; UI designs for seconds-scale waits |
| Fixed-size recipient arrays | Cap 8 (`MAX_RECIPIENTS`); Vector\[8\] padding rules |
| Recipient claim UX depends on private-state APIs | Validate during L2 before promising claim in demo |
| Public README vs local docs | At L1/L3 file time, mirror required sections into public README; keep long-form in local `docs/` |
