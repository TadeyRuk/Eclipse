# Eclipse — Privacy Model

Level 3 requires a README section: "what an observer can and cannot learn." This file is the canonical answer. At **L1 file time**, the public README gets a short **public state vs private witness** section mirrored from here; at **L3**, a fuller privacy-model section. Every ledger write (and any `disclose()` annotation) in the contract must map to a row below — CI greps for undocumented `disclose(` once the contract exists.

**Midnight Network Notes:** circuit inputs are private by default. `disclose()` does **not** make a value public — it tells the compiler the developer considers it safe to expose. Data becomes public when it crosses into a public domain: **ledger writes**, returns from exported contracts, or contract-to-contract calls.

---

## Who Learns What

| Fact | Employer | Recipient (self) | Recipient (about others) | Public observer |
|---|---|---|---|---|
| Payroll exists, employer address | ✅ | ✅ | ✅ | ✅ |
| Deposit total (pool size) | ✅ | ✅ | ✅ | ✅ |
| Recipient list (addresses) | ✅ | ✅ | ✅ | ✅ (v1 — see boundaries) |
| Distribution happened & is balanced (sum == total, proven) | ✅ | ✅ | ✅ | ✅ (`status = Distributed`) |
| **Own amount** | ✅ (they set it / local records) | ✅ | — | ❌ |
| **Any individual amount, from on-chain data** | ❌ | ❌ | ❌ | ❌ |
| Which recipient got more/less than another | ❌* | ❌ | ❌ | ❌ |

\* Employer knows from their own local input at creation time. The claim is about **on-chain queryability**: once distributed, no chain query by anyone — including the employer — returns individual amounts. They exist only as (a) proof material, (b) commitments openable solely by each recipient's key.

---

## Public surface (ledger / returns)

Every public fact maps to a **ledger field or return**, not to `disclose()` alone.

| Circuit | Public surface | Justification |
|---|---|---|
| `createPayroll` | Ledger: `employer`, `recipients`, `status = Created` | Recipients must be publicly bindable to commitments; employer accountability |
| `fund` (stub at L1) | Ledger: `depositTotal`, `status = Funded` | Public anchor the sum-proof binds against (L1 stub; post-L1 also inherent to token transfer) |
| `distribute` | Ledger: `status = Distributed` | Core public claim — books provably balanced (no separate boolean field) |
| `distribute` | Ledger: `receiptCommitments` | Opaque hashes; enable recipient claims later; reveal nothing without opening |
| `claim` (post-L1) | Return / caller-scoped validity only | Proves “I am owed my committed amount” without stating the amount |

Witnesses that **never** become ledger state: `amounts[]`, `salts[]`.

---

## Inference Risks (honest limitations)

- **Small-N inference:** with 1 recipient, their amount = the public total. With 2, each recipient can infer the other's (total − own). Amounts-privacy is meaningful from N=3 upward; the app should warn below that.
- **Deposit total is public by design** — anyone can see the company distributed 1000 tokens. What's protected is the split, not the spend.
- **Recipient list is public in v1** — an observer learns who got paid by this employer, not how much. Hiding membership is a possible v2 (Merkle-committed recipient set), out of scope per boundaries.md.
- **Off-chain leakage is out of scope:** if the employer emails a spreadsheet around, no chain can help.

---

## Trust Assumptions

- Recipients trust the **math**, not the employer: a distribution that doesn't balance cannot produce a valid proof, so it cannot be confirmed on-chain.
- No trusted third party, no oracle, no admin backdoor circuit.
- Proof server runs locally (employer's machine) — private inputs never transit to any third-party service.
