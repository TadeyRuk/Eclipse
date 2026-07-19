# README Standards

How every README in this repo gets written and reviewed. Applies to the root README, and to any package-level README added later (`packages/sdk/README.md`, `contracts/README.md`, etc). PRs that add or touch a README should be checked against this file.

---

## 1. Signal-to-Noise Ratio

A README is read, not studied. Every line competes for attention with the reader's patience.

- **No filler sentences.** "This project aims to leverage cutting-edge technology to..." — delete. State what it does.
- **No restating the obvious.** Don't explain what React is, what Git is, what npm install does generically. Explain what's specific to *this* repo.
- **One idea per paragraph.** If a paragraph covers two things, split it.
- **Prefer tables and lists over prose** when the content is enumerable (requirements, commands, env vars, file structure).
- **Every sentence should fail a "so what?" test positively.** If deleting a sentence loses no information a reader needs, delete it.
- **No decorative badges beyond functional ones.** CI status, license, deploy status — yes. "Made with ❤️" — no.

## 2. Cohesiveness

- **One voice, one tense.** Present tense, active voice, throughout. Not "the contract was designed to..." — "the contract enforces...".
- **Terminology is fixed once and reused.** If the doc calls it a "circuit" in section 2, it's not a "function" in section 4. Cross-check against `architecture.md` for canonical terms.
- **Structure mirrors the reader's actual questions, in order they'd ask them:** what is this → how do I run it → how is it built → how do I verify it works → where do I go for more. Don't reorder for narrative flair.
- **No orphaned sections.** Every heading either has content or doesn't exist. No "Roadmap (TBD)" placeholders — see §4.
- **Internal links, not duplication.** If `privacy-model.md` already answers "what can observers learn," the README links to it — it doesn't re-explain it in different words that can drift out of sync.

## 3. Structure (root README template)

```markdown
# Project Name

One-sentence description. What it does, plainly.

One-paragraph pitch (the "so what" — why this exists, what problem it solves).

## Status
Current phase, next milestone, deadline if relevant. Delete once the project has shipped past "in progress."

## Quick Start
Minimum commands to run it locally. Numbered, copy-pasteable, no narration between steps.

## Architecture
2-4 sentences + a link to the full architecture doc. Not a duplicate of it.

## Privacy Model (if applicable)
2-4 sentences + a link to the full privacy-model doc.

## Testing
How to run tests. What's covered, in one line.

## Documentation
Table or list linking every doc in `docs/`, one-line description each.

## License
```

## 4. No Placeholders, No Half-Finished Sections

- Never commit "TODO," "Coming soon," "TBD" as content — either write the real thing or omit the section entirely.
- A section that will be true later (e.g., "Deployed Contract Address") gets added *when* it's true, not stubbed in advance.
- If a required program artifact (screenshot, video link, contract address) isn't ready yet, the section is absent — not present-with-placeholder. Absence is honest; a placeholder looks like an oversight to a reviewer.

## 5. Evidence Over Claims

- Don't write "thoroughly tested" — link the CI badge and say "N tests, run via `npm test`."
- Don't write "production-grade" without the CI/CD and test evidence sitting one click away.
- Every claim a judge would want to verify should be either inline (a real link, a real number) or explicitly deferred with a reason, not asserted bare.

## 6. Maintenance Rule

- When architecture, scope, or privacy model changes, the README's corresponding section (or its links) gets updated in the **same commit** — a stale README is worse than no README.
- Long-form detail lives in `docs/*.md`; the README stays thin and links out. This is enforced structurally: if you're about to write more than ~4 sentences on one subsystem in the README, that content belongs in `docs/` instead, with a link.

## 7. Review Checklist (before merging any README change)

- [ ] Reads top-to-bottom in under 2 minutes
- [ ] No sentence fails the "so what?" test
- [ ] No placeholder/TBD content
- [ ] All internal links resolve to real files
- [ ] Terminology matches `architecture.md` / `Midnight.md` / `privacy-model.md`
- [ ] Every claim is either evidenced (link, number) or removed
- [ ] Status section reflects current reality, not aspirational state
