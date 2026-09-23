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
| Which slots have claimed (`claimed[]`) | ✅ | ✅ | ✅ | ✅ |
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
| `fund` | Ledger: `depositTotal`, `status = Funded`; tx: unshielded input of `amount` native token (`receiveUnshielded`) | Public anchor the sum-proof binds against. Since L3 the deposit is a real unshielded tNIGHT transfer, so the amount (and the depositing wallet's unshielded inputs) is visible in the transaction too — no new fact beyond `depositTotal` (L1 was a stub write) |
| `distribute` | Ledger: `status = Distributed` | Core public claim — books provably balanced (no separate boolean field) |
| `distribute` | Ledger: `receiptCommitments` | Opaque hashes; enable recipient claims later; reveal nothing without opening |
| `claim` | Ledger: `claimed[slot] = true` | Prevents double-claiming; proves “I am owed my committed amount” by re-deriving the commitment from private `amount` + `salt`. The amount is never written |

Witnesses that **never** become ledger state: `amounts[]`, `salts[]`.

---

## Inference Risks (honest limitations)

- **Small-N inference:** with 1 recipient, their amount = the public total. With 2, each recipient can infer the other's (total − own). Amounts-privacy is meaningful from N=3 upward; the app should warn below that.
- **Deposit total is public by design** — anyone can see the company distributed 1000 tokens. What's protected is the split, not the spend.
- **Recipient list is public in v1** — an observer learns who got paid by this employer, not how much. Hiding membership is a possible v2 (Merkle-committed recipient set), out of scope per boundaries.md.
- **Claim timing is public.** `claimed[]` is a per-slot flag, so observers learn *which* recipient
  claimed and *when* — never how much. Since the recipient list is already public in v1, this adds
  timing metadata rather than identity. A nullifier-set design (publishing `H(salt)` instead of a
  slot flag) would hide the slot too; it was weighed against the v1 timeline and deferred, since the
  amount-privacy claim does not depend on it.
- **Off-chain leakage is out of scope:** if the employer emails a spreadsheet around, no chain can help.

---

## Trust Assumptions

- Recipients trust the **math**, not the employer: a distribution that doesn't balance cannot produce a valid proof, so it cannot be confirmed on-chain.
- No trusted third party, no oracle, no admin backdoor circuit.
- Proof server runs locally (employer's machine) — private inputs never transit to any third-party service.
