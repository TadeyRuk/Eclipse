# Midnight Program Requirements — Levels 1–3

Source: Rise In "New Moon to Full: Monthly Moonshots on Midnight" — $8,000 prize pool.
Program window (current cycle): Jun 29, 2026 → Jul 31, 2026. Submissions per monthly challenge (July active; August, September upcoming).

Verbatim requirements captured from the program pages on 2026-07-19. Re-check the platform before each submission — content can change between cycles.

---

## Program-Wide Rules

- **Sequential progression.** Reward for a higher level requires all preceding levels' requirements met. Broken chain = rewarded only up to the last unbroken level.
- **Monthly evaluation.** End of each month, technical committee reviews. Eligible only for the highest valid level reached that month (no stacking multiple level prizes in one month).
- **Once rewarded for a level, must move up** to stay eligible for future prizes.
- **Teams allowed** — prize per project/submission, not per person.
- **Mentor & Market Fit checkpoint required before onboarding users** (Levels 5–6). User onboarding without this review does not count.
- **Pivoting allowed** next month with mentor approval.

## Judging Criteria (applies to all levels)

1. **Core Technical Standards** — strong functionality, strict adherence to level requirements, comprehensive documentation.
2. **Code Quality & Security** — clean, well-structured, efficient code. Higher levels: smart contract security and optimization are key criteria.
3. **Ecosystem Fit** — solving a real problem / filling a gap in the Midnight ecosystem. High-utility projects prioritized.
4. **User Traction (Levels 5–6)** — active user onboarding and real-world interaction required, technical completion alone is not enough.

Prize pool weighting: majority weighted toward Levels 4–6.

---

## 🌑 Level 1 — New Moon: Setup & First Contract

**Mission:** Toolchain set up, first Compact contract written and deployed on Preview/Preprod, plus an initial idea.
**Prize:** None — entry level. Unlocks prize track from Level 2 onward.

### What you learn
- Installing the Midnight toolchain (Compact compiler, proof server, Node 22, Docker)
- Writing a Compact contract with public ledger state and a private witness
- Using `disclose()` deliberately to control what becomes public
- Compiling to ZK circuits and deploying to Preprod

### Requirements to pass
- [ ] Toolchain installed and a contract that compiles via `compact compile`
- [ ] Passing test suite
- [ ] Generated `managed/` directory present (circuits + keys)
- [ ] Contract deployed to Preview or Preprod with a visible contract address
- [ ] An initial product idea (1 short paragraph) drafted in the README
- [ ] Minimum 5 meaningful commits

### Submission checklist
- [ ] Public GitHub repository with a README.md
- [ ] Setup instructions (how to run locally)
- [ ] Screenshot: successful compile output (circuits listed)
- [ ] Screenshot: contract deployed with address shown
- [ ] README section explaining public state vs private witness
- [ ] Initial product idea paragraph
- [ ] Minimum 5 meaningful commits

---

## 🌒 Level 2 — Waxing Crescent: Frontend Integration

**Mission:** Contract wired to a frontend UI, with Lace connected on Preprod.
**Prize:** $10 per selected winner.

### What you learn
- Midnight.js SDK and the DApp connector API
- Connecting and disconnecting the Lace wallet
- Calling a circuit from the frontend and handling its result
- Managing local private state; deploying to Preprod

### Requirements to pass
- [ ] Lace wallet connect / disconnect implemented
- [ ] Circuit called successfully from the frontend
- [ ] An observable privacy behavior (something proven without being shown)
- [ ] Contract deployed to Preprod with a verifiable address
- [ ] Minimum 8 meaningful commits

### Submission checklist
- [ ] Public GitHub repository with README
- [ ] Live demo link (Vercel, Netlify, or similar)
- [ ] Deployed Preprod contract address (verifiable on-chain)
- [ ] Demo video: wallet connect + a successful circuit call
- [ ] README documenting the privacy claim
- [ ] Minimum 8 meaningful commits

---

## 🌓 Level 3 — First Quarter: Production-Grade dApp

**Mission:** A polished, production-grade dApp with tests and CI/CD, plus a chosen problem from the provided list.
**Prize:** $30 per selected winner.

### Provided idea list (choose one — submission requires committee approval)
1. Private Voting — anonymous ballots with publicly verifiable tallies
2. Age / Eligibility Gate — prove a threshold without revealing the underlying value
3. Private Allowlist Access — prove membership without revealing identity
4. Confidential Credentials — prove a credential is valid without disclosing it
5. Sealed-Bid Auction — private bids, verifiable winner
6. **Private Payroll / Splits — distribute funds without exposing amounts** ← Eclipse's pick
7. Anonymous Feedback / Survey — verifiable participation, private responses

### What you learn
- Designing a dApp around selective disclosure
- Writing contract and application tests
- Setting up a CI/CD pipeline (compile + test on every push)
- Scoping a realistic product proposal

### Requirements to pass
- [ ] Fully functional dApp that meaningfully uses Midnight's privacy model
- [ ] Minimum 3 tests passing
- [ ] CI/CD pipeline running (workflow file + passing runs)
- [ ] Approved idea submitted from the provided idea list
- [ ] Minimum 10 meaningful commits

### Submission checklist
- [ ] Public GitHub repository with complete README
- [ ] Live demo link
- [ ] Screenshot: test output (3+ tests passing)
- [ ] CI/CD badge or workflow file with passing runs
- [ ] Demo video (1 minute) showing full functionality
- [ ] README "privacy model" section: what an observer can and cannot learn
- [ ] Product proposal (from the idea list) submitted for approval
- [ ] Minimum 10 meaningful commits

---

## Later Levels (context only — not yet in scope)

- **🌔 Level 4 — Waxing Gibbous:** MVP live on Preprod, docs, CI/CD, public product (X) profile.
- **🌕 Level 5 — Full Moon:** Same MVP, docs, a living feedback loop, 50 Preprod users. Mentor/Market-Fit review required before onboarding.
- **🌝 Level 6 — Supermoon:** Deploy to Mainnet, iterate on feedback, brand assets, onboard 20 real users. Real tokens at this stage.

## Network Notes (from program "Notes for Builders")

- In Compact, circuit inputs are **private by default**. `disclose()` does not make a value public — it tells the compiler the developer considers it safe to expose. Data only becomes public when it crosses into a public domain: ledger writes, returns from exported contracts, or contract-to-contract calls.
- Levels 1–5 target **Preview/Preprod** (test networks, synthetic tokens). Level 6 deploys to **Mainnet** (real value).
