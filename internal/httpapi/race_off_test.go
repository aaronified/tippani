//go:build !race

package httpapi

// underRace is 1 outside the race detector: a latency bound is the product's
// own (race_on_test.go says why a -race run scales it).
const underRace = 1
