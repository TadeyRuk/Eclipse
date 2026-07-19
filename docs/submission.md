# Eclipse — Submission Playbook

**Purpose:** clear Rise In *New Moon to Full* levels efficiently without weakening product architecture.  
**Audience:** builders filing levels, and reviewers scanning how we plan to ship.  
**Not in this file:** ledger schemas, adapter internals, privacy disclosure rows — those live in [architecture.md](architecture.md), [privacy-model.md](privacy-model.md), and [boundaries.md](boundaries.md).

Program window (current cycle): **2026-06-29 → 2026-07-31**. Re-check Rise In before each filing — requirements can change.

---

## 1. Doctrine (how we win without becoming a hello-world)

| Principle | Meaning for Eclipse |
|---|---|
| **README is the pitch** | Judges open GitHub first. Every required section lives in the root README (or one click away). Deep design stays in `docs/`. |
| **Evidence over claims** | Addresses, screenshots, CI badges, demo links — present when true; absent when not. No TBD placeholders. |
| **Product circuit early** | Gate 0 proved the real payroll invariant (`distribute` sum-proof). We do **not** ship a throwaway counter for L1; we use the Eclipse contract (minimal lifecycle OK). |
| **Sequential filing** | L2 credit requires L1 filed; L3 requires the chain unbroken. A gate is done only when **filed on Rise In**, not when code is green locally. |
| **Architecture is the long game** | Ports/adapters, privacy ledger, and scope gates stay authoritative. Submission pressure never overrides [boundaries.md](boundaries.md) tripwires. |

```
boundaries.md  →  what we refuse to build
architecture.md → how the system is structured
privacy-model.md → what observers learn
submission.md (this file) → how we file levels and prove it
README.md → judge-facing surface
```

---

## 2. Current position

| Gate / level | State | Eclipse artifact |
|---|---|---|
| Gate 0 — sum-proof spike | **Done** | `contracts/src/eclipse.compact`, `managed/eclipse`, 2 invariant tests |
| Level 1 — New Moon | **In progress** | Need create + stub fund, Preprod deploy, screenshots, file |
| Level 2 — Waxing Crescent | Planned | Lace + UI circuit call + observable privacy |
| Level 3 — First Quarter | Planned | Full flow, CI, idea #6 approval, 1-min demo |

Progress chart: root [README.md](../README.md#progress-gantt).

---

## 3. Level playbooks

Each playbook lists **Midnight requirements** mapped to **Eclipse deliverables**, then a **file checklist**. Work top-to-bottom; do not start the next level’s UI polish before the current level is filed.

### 3.1 Level 1 — New Moon

**Mission:** toolchain + compiling Eclipse contract + deploy + README evidence.

| Midnight requires | Eclipse deliverable |
|---|---|
| `compact compile` | `cd contracts && npm run compile` |
| Passing tests | `cd contracts && npm test` (expand lifecycle tests when create/fund land) |
| `managed/` present | `contracts/managed/eclipse/` committed |
| Deployed Preview/Preprod + address | Deploy Eclipse contract; table in README |
| Idea paragraph | README *Initial idea* (already present) |
| Public vs private witness | README section (already present); detail in privacy-model |
| Setup instructions | README *Quick Start* |
| Screenshots: compile + deploy | `docs/evidence/` or README images |
| ≥5 meaningful commits | Conventional Commits on `main` |
| Filed on Rise In | Submission recorded; Gate 1 closed in boundaries terms |

**Build order (L1 code):**
1. Replace Gate 0 constructor-only bootstrap with `createPayroll` + stub `fund` ([architecture.md](architecture.md) §3.2)
2. Lifecycle tests: order + double-distribute reject
3. Deploy Preview/Preprod; paste address into README
4. Capture screenshots; update Status + Gantt
5. **File Level 1**

**Out of scope for L1:** Lace, React app, CI badge, `claim`, FungibleToken transfer-in.

### 3.2 Level 2 — Waxing Crescent

**Mission:** Lace + one circuit from UI + observable privacy.

| Midnight requires | Eclipse deliverable |
|---|---|
| Lace connect/disconnect | `LaceAdapter` + UI control |
| Circuit from frontend | Prefer `distribute` (or create→fund→distribute path) via `EclipsePort` |
| Observable privacy | Demo: amounts never shown on-chain/UI to observer; status + commitments public |
| Preprod address | README + live env |
| Live demo link | Vercel (or similar) |
| Demo video | Wallet connect + successful circuit call |
| README privacy claim | Short claim + link to privacy-model |
| ≥8 commits | Cumulative |
| Filed on Rise In | Gate 2 closed |

**Build order:** `ProofClient` → `MidnightAdapter` → `LaceAdapter` → `createEclipseSdk` → employer distribute screen ([architecture.md](architecture.md) §4.6).

### 3.3 Level 3 — First Quarter

**Mission:** production-shaped dApp + tests + CI + idea approval.

| Midnight requires | Eclipse deliverable |
|---|---|
| Fully functional privacy dApp | Employer create/fund/distribute + employee claim/view |
| ≥3 tests | Contract + SDK/app tests (target well above 3) |
| CI/CD | `.github/workflows/ci.yml` + badge in README |
| Idea #6 approved | Private Payroll proposal filed (boundaries Gate 3) |
| README privacy model | Expand README; canonical detail remains privacy-model.md |
| 1-minute demo video | Full flow storyboard in design (when filled) |
| Live demo + test screenshot | Evidence in README / `docs/evidence/` |
| ≥10 commits | Cumulative |
| Filed on Rise In | Gate 4 closed |

**Later levels (L4–L6):** same sequential rule; Preprod until L6 Mainnet. Do not expand scope past [boundaries.md](boundaries.md) Hard Scope until L3 is filed.

---

## 4. README contract (judge surface)

Root README **must** always reflect reality. When a level is filed, update these in the **same commit** as the evidence:

| Section | L1 | L2 | L3 |
|---|---|---|---|
| Status + Gantt | Yes | Yes | Yes |
| Initial idea | Yes | Yes | Yes |
| Public vs private witness | Yes | Yes | Expand → privacy model |
| Quick Start | Yes | Yes | Yes |
| Contract address table | Yes | Yes | Yes |
| Live demo link | — | Yes | Yes |
| CI badge | — | — | Yes |
| Testing | Yes | Yes | Yes + screenshot |
| Docs table | Yes | Yes | Yes |

**Rule:** if a section would need “TBD” or “coming soon,” omit it until true ([readme-standards](readme-standards.md) locally; same spirit publicly).

---

## 5. Evidence vault

Store judge artifacts under `docs/evidence/` (create when first screenshot exists):

```
docs/evidence/
  l1-compile.png
  l1-deploy.png
  l2-demo.mp4          # or external link in README
  l3-tests.png
  l3-demo.mp4
```

README links to these paths. Prefer PNG/WebM under ~1–2 MB. Contract addresses stay as text in README (copy-pasteable).

---

## 6. Pace (flexible targets)

| Milestone | Target (this cycle) | Notes |
|---|---|---|
| Gate 0 | Done (2026-07-19) | Sum-proof + tests |
| L1 filed | ~2026-07-22 | Deploy is the critical path |
| L2 filed | ~2026-07-27 | Lace + one circuit + video |
| L3 + idea filed | ≤2026-07-31 | CI + full flow + proposal |

Slip the chart in README when reality slips — honesty beats a green Gantt that lies.

---

## 7. Risk register (program-facing)

| Risk | Impact | Mitigation |
|---|---|---|
| Deploy / faucet / Preview friction | Blocks L1 | Budget a full day; follow Midnight faucet docs; Preview first if Preprod is slow |
| Proof-server / Docker instability | Blocks L2 demo | Local Docker on `:6300`; pre-flight health check; film demo when stack is warm |
| Lace / connector API churn | Blocks L2 | Isolate in `LaceAdapter`; pin versions ([architecture.md](architecture.md) §4) |
| Compact sum-proof complexity | Already mitigated | Gate 0 done; kill-switch remains equal-splits ([boundaries.md](boundaries.md)) |
| Over-building UI before L1 filed | Wastes calendar | Boundaries tripwire: no UI polish before Gate 3 unless L2 requires it |
| Stale README vs code | Judges misread status | Update Status/Gantt in the same PR as milestones |
| Docs vs submission drift | Confusion | This file owns checklists; architecture owns design — link, don’t fork |

---

## 8. Maintenance (long-term)

1. **After every filed level:** tick the playbook mentally, move Status in README, append a one-line note under §2 Current position.
2. **After any ledger / privacy change:** update privacy-model + architecture first, then README mirror, then this file only if checklists change.
3. **Do not turn this file into a task dump.** Day-to-day TODOs stay local (`TASKS.md` gitignored). This file stays stable checklists + doctrine.
4. **Re-read Rise In** before each submission; if the platform checklist diverges, update §3 in the same week.
5. **Tagged releases:** `level-1`, `level-2`, `level-3` on the commit that matches the filing ([architecture.md](architecture.md) §7).

---

## 9. Quick links

| Need | Go to |
|---|---|
| What we will not build | [boundaries.md](boundaries.md) |
| How the system is built | [architecture.md](architecture.md) |
| Who learns what | [privacy-model.md](privacy-model.md) |
| Judge-facing progress | [../README.md](../README.md) |
| Compile / test | `cd contracts && npm run compile && npm test` |
