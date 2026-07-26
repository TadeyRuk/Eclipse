# L3 demo video storyboard (60s)

Level 3 asks for a one-minute video showing **full functionality**. The L2 video stopped at the
observer view because Employee was a placeholder; the claim circuit is now live, so the closing beat
is a real proof rather than a voiceover promise.

Film against `npm run dev -w @eclipse/web` (or the Netlify demo) with Lace on Preprod. A local
proof-server on `:6300` is required for the chain path; the in-memory path (`VITE_USE_CHAIN=0`) runs
the same UI without one and is the safer take if the proof-server is cold.

Keep two browser tabs open side by side — the split screen *is* the privacy argument.

| Beat | Time | Screen | What to show |
|---|---|---|---|
| 1 · Connect | 0:00–0:08 | `/employer` | Click **Connect Lace**, unlock on Preprod. Address appears in the shell. |
| 2 · Private split | 0:08–0:22 | Employer wizard | Add 3 recipients (N≥3 — below that the split is inferable from the public total). Fund a public deposit, then enter private amounts summing to it. |
| 3 · Distribute | 0:22–0:34 | Employer success | **Prove & distribute** → status `Distributed`, opaque commitments listed, amount inputs gone from the form. |
| 4 · Observer | 0:34–0:44 | `/observer` | Public ledger only: status, deposit total, recipient addresses, commitments, claimed flags all `—`. Say plainly: no per-recipient amount exists anywhere in this view. |
| 5 · Claim | 0:44–0:56 | `/employee` | Click **Claim** on a slot. It succeeds — and the amount is never displayed. This is the beat the L2 video could not show. |
| 6 · Proof lands | 0:56–1:00 | `/observer` refreshed | That slot now reads `claimed`; every amount is still absent. Observers learn *that* someone claimed, never *how much*. |

## Script for the closing line

> "The chain now knows the payroll balanced and that this recipient claimed their share. It has never
> known, and cannot compute, what that share was."

## Do not film

- Private amounts in the URL, devtools, or a localStorage/IndexedDB inspector
- The seed phrase or any `.env` contents
- A retake where distribute failed and was edited to look successful
- N=1 or N=2 payrolls presented as private — with one recipient the amount *is* the public total

## Honest framing

If the chain path stalls on dust sync during filming, film the in-memory path and say so on screen.
The circuits, commitments, and claim logic are identical; only the transport differs. Claiming a
live Preprod call that did not happen would be the one unrecoverable mistake in this submission.
