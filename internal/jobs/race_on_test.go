//go:build race

package jobs

// UnderRace is how many times slower this package's tests run under the race
// detector, for the stop proofs that bound a latency ("reads stopped within
// 300 ms of the press"). It is exported for the external test package
// (jobs_test), and it exists only in the test binary. The detector instruments
// every memory access, the pure-Go SQLite engine's included, and each of those
// proofs waits on SQLite writes between the press and the row reading stopped.
// Raced on a quiet machine (load 2) they took up to 194 ms of the 300; raced as
// eight copies at once (load 15), TestAStopReachesAJobHoldingTheWriteLockAtOnce
// read stopped past 300 ms in every one of its 32 runs, at up to 655 ms, with no
// data race reported. The bound is the product's (httpapi's race_on_test.go
// scales its own the same way); the race run is for data races, and it keeps a
// bound too.
const UnderRace = 3
