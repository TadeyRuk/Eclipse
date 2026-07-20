# L2 demo video storyboard (60–90s)

Film against the live Netlify demo (or `npm run dev -w @eclipse/web`) with Lace on Preprod and a local proof-server on `:6300`.

| Beat | Screen | What to show / say |
|---|---|---|
| 1 · Connect | `/employer` | Click **Connect Lace**, unlock Preprod. Voice: “Employer connects Lace on Preprod.” |
| 2 · Private split | Employer wizard | Enter ≤8 recipients, stub fund a public deposit, enter **private** amounts that sum to deposit. |
| 3 · Distribute | Employer success | **Prove & distribute** succeeds → status `Distributed`, opaque commitments, amounts wiped from the form. |
| 4 · Observer | `/observer` (second tab optional) | Public ledger only: status, deposit total, recipients, commitments. **No** per-recipient amounts. |
| 5 · Claim | On-screen or VO | One line: “Individual amounts never appear as plaintext ledger state — see privacy-model.md.” |

**Do not film:** private amounts in the URL, localStorage inspectors, or a fake claim flow (Employee is L3 placeholder).
