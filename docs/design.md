# Eclipse — Design (UI/UX)

> **Status: intentionally blank.** UI/UX design deferred until contract feasibility is proven (see boundaries.md — contract-first rule). Fill this in before starting Level 2 frontend work.

## To be defined

- Visual identity (eclipse motif, dark-first palette fits the product and the Midnight brand adjacency)
- Employer flow wireframes: create payroll → add recipients → fund → distribute → confirmation
- Employee flow wireframes: connect wallet → see own payment → claim/receipt view
- Proof-generation wait states (seconds-scale — needs deliberate loading/progress design, not spinners pretending to be instant)
- Error-state catalogue mapped from SDK error taxonomy (WalletNotConnected, ProofServerDown, CircuitRejected, TxFailed, Timeout)
- Demo-video storyboard (60 seconds, Level 3 judged artifact): employer distributes → employee sees only own amount → observer sees only balanced proof

## Constraints already settled (from architecture)

- One web app, two route groups (`/employer/*`, `/employee/*`) — no separate apps
- Wallet identity is the only auth — no login screens, no accounts
- React + Tailwind; responsive; desktop-first (demo runs on desktop with Lace extension)
