package importer

import (
	"os"
	"strings"
	"testing"
)

// TestAmazonNotebookSynth parses a synthetic read.amazon.com/notebook page and
// checks the book header plus per-highlight colour and location mapping. (Add a
// real saved page as amazon_notebook_real.htm to harden this, as with IMDb.)
func TestAmazonNotebookSynth(t *testing.T) {
	f, err := os.Open("testdata/amazon_notebook_synth.htm")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	res, err := AmazonNotebook(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "The Synthetic Guide" {
		t.Fatalf("title = %q", res.Book.Title)
	}
	if res.Book.Author != "Ada Testwright" {
		t.Fatalf("author = %q (By: prefix not stripped?)", res.Book.Author)
	}
	if res.Book.ASIN != "B00SYNTH01" {
		t.Fatalf("asin = %q", res.Book.ASIN)
	}
	if len(res.Annotations) != 3 {
		t.Fatalf("got %d annotations, want 3", len(res.Annotations))
	}

	a0 := res.Annotations[0]
	if a0.Color != "yellow" || a0.Location != "1234" || a0.Note != "Remember to verify this." ||
		!strings.HasPrefix(a0.Quote, "The unexamined import") {
		t.Fatalf("annotation[0] = %+v", a0)
	}
	if res.Annotations[1].Color != "blue" || res.Annotations[1].Location != "56" {
		t.Fatalf("annotation[1] = %+v", res.Annotations[1])
	}
	if res.Annotations[2].Color != "pink" || res.Annotations[2].Note != "" {
		t.Fatalf("annotation[2] = %+v", res.Annotations[2])
	}
}

func TestAmazonNotebookNotAPage(t *testing.T) {
	if _, err := AmazonNotebook(strings.NewReader("<html>nope</html>")); err == nil {
		t.Fatal("expected an error for a non-notebook page")
	}
}
