# Eclipse — Privacy Model

Level 3 requires a README section: "what an observer can and cannot learn." This file is the canonical answer; the repo README mirrors it. Every `disclose()` in the contract must map to a row here — CI checks for undocumented disclosures.

---

## Who Learns What

| Fact | Employer | Recipient (self) | Recipient (about others) | Public observer |
|---|---|---|---|---|
| Payroll exists, employer address | ✅ | ✅ | ✅ | ✅ |
| Deposit total (pool size) | ✅ | ✅ | ✅ | ✅ |
| Recipient list (addresses) | ✅ | ✅ | ✅ | ✅ (v1 — see boundaries) |
| Distribution happened & is balanced (sum == total, proven) | ✅ | ✅ | ✅ | ✅ |
| **Own amount** | ✅ (they set it / local records) | ✅ | — | ❌ |
| **Any individual amount, from on-chain data** | ❌ | ❌ | ❌ | ❌ |
| Which recipient got more/less than another | ❌* | ❌ | ❌ | ❌ |

\* Employer knows from their own local input at creation time. The claim is about **on-chain queryability**: once distributed, no chain query by anyone — including the employer — returns individual amounts. They exist only as (a) proof material, (b) commitments openable solely by each recipient's key.

## Disclosure Ledger (every `disclose()` justified)

| Circuit | Disclosed value | Justification |
|---|---|---|
| `createPayroll` | recipient set, employer | Recipients must be publicly bindable to commitments; employer accountability |
| `fund` | deposit amount | Inherent to a real token transfer; also the public anchor the sum-proof binds against |
| `distribute` | `balanced: true` | The product's core public claim — the books provably balance |
| `distribute` | per-recipient commitments | Opaque hashes; enable recipient claims; reveal nothing without recipient key |
| `claim` | validity of caller's own claim | Caller-scoped; proves "I am owed my committed amount" without stating the amount |

## Inference Risks (honest limitations)

- **Small-N inference:** with 1 recipient, their amount = the public total. With 2, each recipient can infer the other's (total − own). Amounts-privacy is meaningful from N=3 upward; the app should warn below that.
- **Deposit total is public by design** — anyone can see the company distributed 1000 tokens. What's protected is the split, not the spend.
- **Recipient list is public in v1** — an observer learns who got paid by this employer, not how much. Hiding membership is a possible v2 (Merkle-committed recipient set), out of scope per boundaries.md.
- **Off-chain leakage is out of scope:** if the employer emails a spreadsheet around, no chain can help.

## Trust Assumptions

- Recipients trust the **math**, not the employer: a distribution that doesn't balance cannot produce a valid proof, so it cannot be confirmed on-chain.
- No trusted third party, no oracle, no admin backdoor circuit.
- Proof server runs locally (employer's machine) — private inputs never transit to any third-party service.
