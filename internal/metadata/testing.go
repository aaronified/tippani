package metadata

import "testing"

// SetWikidataBaseForTest points the Wikidata client at a stub server for the
// duration of one test.
//
// Exported, and living in the package it mutates, because httpapi's tests need
// it too: the game-lookup handler reaches Wikidata through this package, so a
// test of the FALLBACK has to be able to stand a stub in front of it from
// outside. The alternative is exporting the variable itself, which would let
// anything reassign it at runtime — this way the seam is a test helper that
// restores itself, and the variable stays package-private.
func SetWikidataBaseForTest(t *testing.T, base string) {
	t.Helper()
	orig := wikidataBase
	wikidataBase = base
	t.Cleanup(func() { wikidataBase = orig })
}

// SetImageSearchBasesForTest points the picture sources at stub servers for the
// duration of one test — the Google Custom Search host and the Amazon
// marketplace. Same reasoning as SetWikidataBaseForTest: httpapi's own tests
// reach these through this package, so the seam has to be reachable from
// outside without exporting the variables themselves. Pass "" to leave one alone.
func SetImageSearchBasesForTest(t *testing.T, google, amazon string) {
	t.Helper()
	g, a := googleCSEBase, amazonBase
	if google != "" {
		googleCSEBase = google
	}
	if amazon != "" {
		amazonBase = amazon
	}
	t.Cleanup(func() { googleCSEBase, amazonBase = g, a })
}

// SetAmazonCDNBaseForTest points the keyless cover host at a stub for one test.
func SetAmazonCDNBaseForTest(t *testing.T, base string) {
	t.Helper()
	orig := amazonCDNBase
	amazonCDNBase = base
	t.Cleanup(func() { amazonCDNBase = orig })
}
