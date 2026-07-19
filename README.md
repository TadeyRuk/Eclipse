# Eclipse

Private payroll on [Midnight](https://midnight.network). An employer deposits a fixed pool of tokens and distributes it across a known set of recipients with individually private amounts — a zero-knowledge proof guarantees the hidden amounts sum exactly to the public deposit, so anyone can verify the books balance without anyone, including the chain itself, ever learning who received what.

Built for Rise In's [New Moon to Full: Monthly Moonshots on Midnight](https://www.risein.com/programs/new-moon-to-full-monthly-moonshots-on-midnight) program — Level 3 idea list, *Private Payroll / Splits*.

## Status

Design phase complete. Currently at Gate 0: proving the sum-proof circuit (`distribute()`) compiles and passes a test before any other work proceeds.

## Architecture

One Compact contract (four circuits: create, fund, distribute, claim), one React frontend with two role-scoped views (employer / recipient), and a thin SDK layer that isolates every Midnight.js and wallet-connector dependency behind two adapter files. Circuits execute locally on the caller's device — only proofs and signed transactions ever reach the network.

## Privacy Model

Deposit total, recipient list, and "distribution balanced: true/false" are public. Individual recipient amounts are never written to public ledger state, at any point, for any party — including the employer who set them.

## License

MIT
