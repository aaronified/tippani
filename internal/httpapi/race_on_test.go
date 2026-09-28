//go:build race

package httpapi

// underRace is how many times slower this package's tests run under the race
// detector, for the few that bound a latency: the import stop proofs' and the
// kill-switch proofs' "stopped within 300 ms" (import_stop_test.go,
// stopWithin in stop_kill_switch_test.go). The detector instruments every
// memory access, the pure-Go SQLite engine's included. A Stop that lands inside
// an import's transaction hands SQLite's write lock through three writers before
// the row reads stopped, and under -race that hand-off overran 300 ms once in
// about four runs, where ten runs without it never came near. A kill-switch case
// (a fill's book search, its reader deleted) read stopped at 340 ms under -race
// on a machine at load 22. The bound is the product's; the race run is for data
// races, and it keeps a bound too.
const underRace = 3
