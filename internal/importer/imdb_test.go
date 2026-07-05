package importer

import (
	"os"
	"strings"
	"testing"
)

// TestIMDbQuotesReal parses a saved IMDb quotes page (V for Vendetta, 2005) and
// checks the header, the exchange-granularity mapping, and a couple of known
// quotes — both a single-speaker line and a multi-speaker exchange.
func TestIMDbQuotesReal(t *testing.T) {
	f, err := os.Open("testdata/imdb_real.htm")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	res, err := IMDbQuotes(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Movie.Title != "V for Vendetta" {
		t.Fatalf("title = %q, want V for Vendetta", res.Movie.Title)
	}
	if res.Movie.Year != 2005 {
		t.Fatalf("year = %d, want 2005", res.Movie.Year)
	}
	if res.Movie.MediaType != "movie" {
		t.Fatalf("media_type = %q, want movie", res.Movie.MediaType)
	}
	if res.Movie.IMDbID != "tt0434409" {
		t.Fatalf("imdb id = %q, want tt0434409", res.Movie.IMDbID)
	}
	// The saved page holds 50 quote nodes; after de-duping we expect close to
	// that. Guard against a parser that silently drops most of them.
	if len(res.Dialogues) < 40 {
		t.Fatalf("parsed %d dialogues, want >= 40", len(res.Dialogues))
	}

	// A single-speaker line: character filled, labels dropped.
	var vLine *Dialogue
	for i := range res.Dialogues {
		if strings.HasPrefix(res.Dialogues[i].Quote, "People should not be afraid of their governments") {
			vLine = &res.Dialogues[i]
			break
		}
	}
	if vLine == nil {
		t.Fatal("did not find the 'People should not be afraid' quote")
	}
	if vLine.Character != "V" {
		t.Fatalf("single-speaker character = %q, want V", vLine.Character)
	}
	if strings.Contains(vLine.Quote, "V:") {
		t.Fatalf("single-speaker quote should not carry the label: %q", vLine.Quote)
	}

	// A multi-speaker exchange: character blank, labels retained, newline-joined.
	var exchange *Dialogue
	for i := range res.Dialogues {
		q := res.Dialogues[i].Quote
		if strings.Contains(q, "Evey Hammond: My father was a writer") {
			exchange = &res.Dialogues[i]
			break
		}
	}
	if exchange == nil {
		t.Fatal("did not find the 'My father was a writer' exchange")
	}
	if exchange.Character != "" {
		t.Fatalf("multi-speaker character = %q, want empty", exchange.Character)
	}
	if !strings.Contains(exchange.Quote, "\nV: A man after my own heart.") {
		t.Fatalf("multi-speaker quote missing second speaker line: %q", exchange.Quote)
	}
}

// TestIMDbQuotesNotAPage rejects input that isn't a quotes page.
func TestIMDbQuotesNotAPage(t *testing.T) {
	if _, err := IMDbQuotes(strings.NewReader("<html>nope</html>")); err == nil {
		t.Fatal("expected an error for a non-IMDb page")
	}
}
