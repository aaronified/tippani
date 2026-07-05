package importer

import (
	"os"
	"strings"
	"testing"
)

// TestIMDbQuotesSynth runs against a committed synthetic quotes page (CI): a
// single-speaker line fills Character with labels dropped; a multi-speaker
// exchange keeps "Speaker: line" labels and leaves Character blank.
func TestIMDbQuotesSynth(t *testing.T) {
	f, err := os.Open("testdata/imdb_synth.htm")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	res, err := IMDbQuotes(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Movie.Title != "Synthetic Feature" || res.Movie.Year != 2021 ||
		res.Movie.MediaType != "movie" || res.Movie.IMDbID != "tt9999999" {
		t.Fatalf("movie header: %+v", res.Movie)
	}
	if len(res.Dialogues) != 2 {
		t.Fatalf("got %d dialogues, want 2", len(res.Dialogues))
	}
	if res.Dialogues[0].Character != "Hero" || strings.Contains(res.Dialogues[0].Quote, "Hero:") {
		t.Fatalf("single-speaker mapping: %+v", res.Dialogues[0])
	}
	ex := res.Dialogues[1]
	if ex.Character != "" || !strings.Contains(ex.Quote, "Hero: One.") || !strings.Contains(ex.Quote, "\nVillain: Two.") {
		t.Fatalf("multi-speaker mapping: %+v", ex)
	}
}

// TestIMDbQuotesReal runs against a real saved IMDb quotes page (gitignored for
// privacy). Skips in CI where the fixture is absent.
func TestIMDbQuotesReal(t *testing.T) {
	f, err := os.Open("testdata/imdb_real.htm")
	if err != nil {
		t.Skip("real IMDb fixture not present (gitignored — owner privacy)")
	}
	defer f.Close()

	res, err := IMDbQuotes(f)
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(res.Movie.Title) == "" {
		t.Fatal("no title parsed from real page")
	}
	if len(res.Dialogues) == 0 {
		t.Fatal("no dialogues parsed from real page")
	}
	for i, d := range res.Dialogues {
		if strings.TrimSpace(d.Quote) == "" {
			t.Fatalf("dialogue[%d] has empty quote", i)
		}
	}
}

// TestIMDbQuotesNotAPage rejects input that isn't a quotes page.
func TestIMDbQuotesNotAPage(t *testing.T) {
	if _, err := IMDbQuotes(strings.NewReader("<html>nope</html>")); err == nil {
		t.Fatal("expected an error for a non-IMDb page")
	}
}
