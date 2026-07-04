package importer

import (
	"os"
	"strings"
	"testing"
)

func TestGoodreadsSynth(t *testing.T) {
	f, err := os.Open("testdata/goodreads_synth.htm")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	res, err := Goodreads(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "Test Book" || res.Book.Author != "Jane Author" {
		t.Fatalf("book = %q by %q", res.Book.Title, res.Book.Author)
	}
	if len(res.Annotations) != 2 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if res.Annotations[0].Quote != "Synthetic quote one." {
		t.Fatalf("quote 0 = %q", res.Annotations[0].Quote)
	}
	if got := strings.Join(res.Annotations[0].Tags, ","); got != "wisdom,life" {
		t.Fatalf("tags 0 = %q", got)
	}
	// A <br> inside a quote becomes a newline; the second quote has no tags.
	if res.Annotations[1].Quote != "A second line,\nacross two rows." {
		t.Fatalf("quote 1 = %q", res.Annotations[1].Quote)
	}
	if len(res.Annotations[1].Tags) != 0 {
		t.Fatalf("quote 1 tags = %v, want none", res.Annotations[1].Tags)
	}
}

func TestGoodreadsRealExport(t *testing.T) {
	f, err := os.Open("testdata/goodreads_real.htm")
	if err != nil {
		t.Skip("real Goodreads fixture not present (gitignored — owner privacy)")
	}
	defer f.Close()
	res, err := Goodreads(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "Foundation" || res.Book.Author != "Isaac Asimov" {
		t.Fatalf("book = %q by %q", res.Book.Title, res.Book.Author)
	}
	if len(res.Annotations) != 30 {
		t.Fatalf("got %d annotations, want 30", len(res.Annotations))
	}
	for i, a := range res.Annotations {
		if a.Quote == "" {
			t.Fatalf("annotation %d has empty quote", i)
		}
	}
}

func TestGoodreadsErrors(t *testing.T) {
	if _, err := Goodreads(strings.NewReader("<html>no quotes here</html>")); err == nil {
		t.Fatal("want error for a page with no quotes")
	}
}
