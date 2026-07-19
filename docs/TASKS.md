# Eclipse — Task Tracker

Working list for Gate 0 setup. Completed items are removed, not checked off — see git history for what was done and when.

## Gate 0 — Toolchain & Foundation

- [ ] Relog to pick up docker group membership (needs full KDE logout/login — verify with `docker run --rm hello-world`)
- [ ] Pull Midnight proof-server image (`docker pull midnightntwrk/proof-server`, run on port 6300)
- [ ] Write `contracts/src/eclipse.compact` (createPayroll, fund, distribute, claim circuits — architecture.md §3)
- [ ] Compile `eclipse.compact` and verify sum-proof against local proof server
- [ ] Write and pass `distribute()` invariant tests (sum==total passes, sum!=total rejects, lifecycle order enforced, double-distribute rejected — architecture.md §8)
