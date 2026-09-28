//go:build race

package httpapi

// underRace is how many times slower this package's tests run under the race
// detector, for the few that bound a latency (the import stop proofs' and the
// kill-switch proof's "stopped within 300 ms"). The detector instruments every memory access, and
// a Stop that lands inside a transaction hands SQLite's write lock through three
// writers before the row reads stopped; under -race that hand-off overran 300 ms
// once in about four runs, where ten runs without it never came near. The bound
// is the product's; the race run is for data races, and it keeps a bound too.
const underRace = 3
