# ADR-0710: internal/httpapi is raced nightly in shards, by test name

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 3.0.1; ten shards 3.1.1

*Closes the open question above.*

- **Ten jobs, one package, a tenth of its tests each** (six until 3.1.1). `race-nightly-httpapi` is a matrix
  of ten shards over one package, `./internal/httpapi`, named once in the job's `PKG`. Each
  shard lists the package's tests from the race binary (`go test -race -list`), takes
  every tenth in round-robin, and runs them with its own `-timeout 60m` and `-count=1`.
  The share is never written down, so a test added tomorrow lands in a shard with nothing
  to update, and the shard count is the matrix's own size.
- **Ten, from six, in 3.1.1.** 3.1.0's stop proofs, each about three minutes raced, brought all six shards to 53 to 61 minutes against their hour, and the sweep run by hand on 28 September (run 36457262379) lost shard 3 to the timeout, with no failure and no race, 8 s into a test. Ten brings a shard to about 33 minutes. The count is still only the matrix's size.
- **The package is not a matrix axis,** because that is what keeps the matrix's size equal
  to the shard count. It was one at first. A second entry there would have doubled the
  size, so each job would take every twentieth test (every twelfth, when there were six) and half of both packages would go
  unraced, with every per-name check green. A second package that needs splitting gets a
  job of its own.
- **Every shard checks every test it was dealt, by name,** as the per-push job checks each of its
  names. A `-run` pattern that matches nothing exits 0, which is the false green that cost
  v1.7.4.
- **Instead of.** Raising the package's timeout alone: one job well over an hour, which is
  a job nobody reads. Sampling the sweep: it stops being a sweep. Sharding by package, the
  entry above: it named the package but gave it no more time.
- **Whose call.** The session's own. It had reported this timeout to the owner as "a budget
  decision for you", and then took the decision under the owner's "work on the fixes for
  v3.0.1". The owner may reverse it.
- **Measured on a runner under `-race`, 26 September**, by the sweep dispatched at 3.0.1's
  push (run 36224498389, at 02273f53, the code v3.0.1 shipped). Every shard passed, in
  43m01s, 34m47s, 34m50s, 45m25s, 44m04s and 29m40s. The longest leaves about fifteen
  minutes of its hour, so a seventh shard is the next step if the package keeps growing.
  Every per-package job passed as well.
- **The first unraced pass had two failures in shard 6, unnamed** because that log was not
  kept (5ae0f6c8). A later rerun of "shard 6" cleared nothing about them: at 1,371 tests the
  round-robin had moved, so only 80 of its tests were among the 226 in the shard that failed. So exactly
  those 226, the list 5ae0f6c8 dealt, were run again at 3.0.2's tree, unraced, with
  `-count=3`: all 226 still exist, and 678 of 678 passed, in 276 seconds. The two failures
  have not come back in three runs of every test that could have produced them, and the
  raced sweep passed too. A flake is still possible, and a first failure there would be
  worth reading as one before reading it as a race.

<sub>3.0.1; ten shards 3.1.1 — `.github/workflows/ci.yml` · `docs/wiki/Developing.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
