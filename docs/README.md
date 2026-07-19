# Eclipse — Docs Index

**Eclipse: private payroll on Midnight.** Distribute a fixed pool of tokens to a known set of recipients where individual amounts stay private forever, while anyone can verify the totals balance. Built for Rise In's "New Moon to Full: Monthly Moonshots on Midnight" program (Level 3 idea list item: *Private Payroll / Splits*).

## Reading Order

1. **[Midnight.md](Midnight.md)** — program requirements, Levels 1–3, verbatim checklists + judging criteria. The external contract we're building against.
2. **[boundaries.md](boundaries.md)** — what Eclipse is NOT, numeric guardrails, sequencing gates, decision log. Read before proposing any feature.
3. **[architecture.md](architecture.md)** — full system design: contract (ledger/circuits/invariants), SDK adapter layer, frontend, security posture, CI/CD, testing, risks.
4. **[privacy-model.md](privacy-model.md)** — who learns what, disclosure ledger, honest limitations. Canonical source for the judged README "privacy model" section.
5. **[design.md](design.md)** — UI/UX. Intentionally blank until Gate 0 (contract feasibility) passes.

## Current Status

- **Phase:** design complete, pre-implementation
- **Next action:** Gate 0 feasibility spike — `distribute()` sum-proof circuit compiles + one passing test (see boundaries.md sequencing gates)
- **Then:** Level 1 submission (toolchain + deployed contract + README), due with July/August challenge windows
- **Program deadline (current cycle):** Jul 31, 2026

## One-Paragraph Pitch (for Level 1 README requirement)

> Eclipse is a private payroll dApp on Midnight. An employer deposits a fixed pool of test tokens, assigns each recipient's share privately, and distributes in one atomic transaction. A zero-knowledge proof guarantees the hidden amounts sum exactly to the public deposit — so recipients and observers can trust the books balance without anyone (including the chain itself) ever seeing who earned what. Salary privacy is a real-world norm; Eclipse makes it a verifiable one.
