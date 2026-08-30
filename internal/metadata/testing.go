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

// SetAmazonBaseForTest points the Amazon marketplace at a stub server for one
// test. Same reasoning as SetWikidataBaseForTest: httpapi's own tests reach it
// through this package.
//
// It took a Google Custom Search base too until that API was retired from the
// app. The remaining Google path is the results-page scrape, whose base is set by
// SetFandomAndScrapeBasesForTest.
func SetAmazonBaseForTest(t *testing.T, base string) {
	t.Helper()
	orig := amazonBase
	if base != "" {
		amazonBase = base
	}
	t.Cleanup(func() { amazonBase = orig })
}

// SetAmazonCDNBaseForTest points the keyless cover host at a stub for one test.
func SetAmazonCDNBaseForTest(t *testing.T, base string) {
	t.Helper()
	orig := amazonCDNBase
	amazonCDNBase = base
	t.Cleanup(func() { amazonCDNBase = orig })
}

// SetWikipediaBaseForTest points the Wikipedia search and article host at a stub
// for one test. Same reasoning as the seams above: httpapi's image-ladder tests
// reach Wikipedia through this package.
func SetWikipediaBaseForTest(t *testing.T, base string) {
	t.Helper()
	orig := wikipediaBase
	wikipediaBase = base
	t.Cleanup(func() { wikipediaBase = orig })
}

// SetFandomAndScrapeBasesForTest points the Fandom wiki host and the Google
// image-results page at stubs for one test. Pass "" to leave one alone.
//
// The Fandom base is a FORMAT with one %s in it, standing for the wiki slug —
// the slug guess is the interesting half of that provider, so a test has to be
// able to see which wiki was addressed.
func SetFandomAndScrapeBasesForTest(t *testing.T, fandomFmt, googleScrape string) {
	t.Helper()
	f, g := fandomHostFmt, googleScrapeBase
	if fandomFmt != "" {
		fandomHostFmt = fandomFmt
	}
	if googleScrape != "" {
		googleScrapeBase = googleScrape
	}
	t.Cleanup(func() { fandomHostFmt, googleScrapeBase = f, g })
}
