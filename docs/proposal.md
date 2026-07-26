# Eclipse — Product Proposal (Level 3, Idea #6)

**Idea list selection:** #6 — *Private Payroll / Splits: distribute funds without exposing amounts*
**Submitted for:** Rise In *New Moon to Full: Monthly Moonshots on Midnight*, Level 3 committee approval
**Repository:** https://github.com/TadeyRuk/Eclipse
**Preprod contract:** `3aec836e6c723531cb13803e63795d531117c73231fa7793372c504a8bfa3d47`

---

## 1. The problem

Salary confidentiality is a workplace norm almost everywhere, and it is the norm that breaks first
when payroll moves on-chain. A public ledger turns "what does she earn?" from a question people are
expected not to ask into a query anyone can run, forever, without asking.

The usual workarounds trade one problem for another. Paying from an opaque pooled treasury hides the
splits but also hides whether the money went where it was promised — recipients must simply trust
the payer. Off-chain settlement keeps salaries private by giving up the ledger's guarantees
entirely.

The tension is that two things are wanted at once, and they normally conflict:

- Recipients and auditors want proof the distribution was **complete and correct** — the whole pool
  was allocated, nothing skimmed.
- Everyone wants the **individual amounts** to stay private.

Public ledgers give the first by destroying the second. Private ledgers give the second by
abandoning the first.

## 2. Why this needs zero-knowledge, not encryption

Encrypting the amounts and posting the ciphertext would hide the values, but it would prove nothing:
an observer could not tell an honest payroll from one where the employer encrypted a set of numbers
that don't add up, or quietly kept half the pool.

Midnight's model resolves this. The per-recipient amounts enter the circuit as **private witnesses**
and never become ledger state. The circuit enforces the invariant

```
sum(amounts[0..7]) == depositTotal
```

and a transaction that violates it cannot produce a valid proof, so it cannot be confirmed. The
public ledger records only that a balanced distribution occurred (`status = Distributed`) plus
opaque per-recipient `receiptCommitments`.

The result is the combination that neither alternative offers: **the books are publicly provable to
balance, while the split stays private.** Recipients trust the math rather than the employer — a
distribution that doesn't balance is not merely detectable after the fact, it is unconfirmable.

## 3. What Eclipse is

One employer funds a fixed pool and distributes it across a known set of recipients in one atomic
transaction, with individually private amounts.

**Lifecycle:** `Created → Funded → Distributed`. One-shot, no withdrawal circuit, no re-splitting.

**Two role-scoped views**, which is also how the privacy claim is demonstrated rather than asserted:

| View | Sees |
|---|---|
| `/employer` | Own inputs while composing; amounts cleared from memory and DOM after distribute |
| `/observer` | Employer, recipient addresses, `depositTotal`, `status`, commitments — no amount fields exist in this route |

A judge can open both side by side and watch the same transaction produce a complete public record
that contains no individual amount.

## 4. What an observer can and cannot learn

| Fact | Public? |
|---|---|
| Payroll exists; employer address | Yes |
| Deposit total (pool size) | Yes — inherent to a real token transfer |
| Recipient list (addresses) | Yes in v1 |
| Distribution happened and is balanced | Yes — `status = Distributed` |
| Per-recipient receipt commitments | Yes, but opaque |
| Which slots have claimed | Yes — timing, not amounts |
| **Any individual amount** | **No** — never plaintext ledger state |

Full disclosure ledger: [privacy-model.md](privacy-model.md).

### Honest limitations

Stating these up front, because a proposal that hides them is not a scoped proposal:

- **Small-N inference.** With one recipient, the amount equals the public total. With two, each can
  infer the other's. Amount privacy is meaningful from N=3 upward; the app warns below that. This is
  a property of the arithmetic, not a defect in the circuit.
- **The deposit total is public by design.** An observer learns the company distributed 1000 tokens.
  What is protected is the split, not the spend.
- **The recipient list is public in v1.** An observer learns *who* was paid, not *how much*. Hiding
  membership (Merkle-committed recipient set) is a plausible v2 and is explicitly out of scope now.
- **Off-chain leakage is out of scope.** If the employer emails a spreadsheet, no chain helps.

## 5. Scope for Level 3

**In scope:**

- ✅ Recipient flow: `claim` circuit proving "I am owed my committed amount" without stating the
  amount — done, with receipt openings held in local private storage
- ✅ CI/CD: typecheck + test + build on every push, badge in README — done, green
- ✅ Test suite well above the 3-test minimum — 33 passing (10 contract, 17 SDK, 6 web privacy)
- ✅ Full README privacy-model section — done
- Employer flow: real FungibleToken transfer-in replacing the L1 stub
- Redeploy to Preprod carrying the `claim` circuit
- One-minute demo video

**Explicitly not in scope** (from [boundaries.md](boundaries.md), which predates this proposal):

Recurring or scheduled payroll; multi-employer or marketplace features; withdrawal, refund, or
re-splitting logic; token minting; hiding the recipient list; hiding the deposit total; mobile or
desktop clients; fiat, price feeds, or stablecoin logic; identity/KYC of any kind; admin dashboards,
analytics, or notifications.

**Numeric guardrails:** max 8 recipients per payroll (`Vector[8]` — ZK circuits favour static
bounds, and this keeps proof time sane); one contract instance per payroll run; Lace as the only
supported wallet; Preprod only, no mainnet before Level 6.

## 6. Current state

Levels 1 and 2 are complete, which is the evidence that this scope is real rather than projected:

| Level | State |
|---|---|
| Gate 0 — sum-proof spike | Done — the payroll invariant compiled and tested before any UI work began |
| Level 1 — New Moon | Filed 2026-07-20 — Preprod deploy, `managed/`, README, evidence |
| Level 2 — Waxing Crescent | Code-complete — Lace connect/disconnect, circuit from frontend, dual-view privacy demo, live demo, video |
| Level 3 — First Quarter | In progress — `claim` circuit, CI, and 33 tests landed; this proposal |

Eclipse did not ship a throwaway counter contract for Level 1. The sum-proof circuit that carries
the entire privacy claim was the first thing built, deliberately, so that the hard part was proven
feasible before anything was staked on it.

---

**Related:** [boundaries.md](boundaries.md) · [architecture.md](architecture.md) ·
[privacy-model.md](privacy-model.md) · [submission.md](submission.md)
