package httpapi

// Keep the context, throw the file away, through the API only.
//
// WHAT THIS KNOWS: the prune routes, the context read, the state a lookup reports, and (for the
// claims an answer cannot make) the Sources folder: the bytes are gone, the row is not.

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

type pruneAnswer struct {
	Pruned bool `json:"pruned"`
	Kept   int  `json:"kept"`
}

func (c *testClient) sourceID(subject string, work int64) int64 {
	c.t.Helper()
	got := decode[sourceAnswer](c.t, c.mustDo("GET", "/sources?subject="+subject+"&subject_id="+strconv.FormatInt(work, 10), nil, 200))
	if len(got.Sources) != 1 {
		c.t.Fatalf("expected one source: %+v", got)
	}
	return got.Sources[0].ID
}

func TestAPruneKeepsTheContextAndThrowsTheFileAway(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Nineteen Eighty-Four")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "1984.txt", []byte(prose))
	id := c.sourceID("book", book)

	got := decode[pruneAnswer](t, c.mustDo("POST", "/sources/"+strconv.FormatInt(id, 10)+"/prune", nil, 200))
	if !got.Pruned || got.Kept != 1 {
		t.Fatalf("%+v", got)
	}
	if liveSourceFiles(t, srv) != 0 {
		t.Fatal("the bytes must be gone")
	}
	// The ROW stays and says pruned: it is the only record that the work ever had a source.
	state := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200))
	if state.State != "pruned" || state.Sources[0].Name != "1984.txt" || state.Sources[0].PrunedAt == "" {
		t.Fatalf("%+v", state)
	}
	// And the stored context opens, with no file anywhere: the rows are the read path.
	if ctx := c.contextOf("annotation", hl); !strings.Contains(ctx.Body, "clocks were striking thirteen") {
		t.Fatalf("%+v", ctx)
	}
}

// BEFORE THE BYTES GO, THE FILE IS READ ONCE MORE: a quote added after the file was attached is
// cut now, so the prune keeps as much as there is to keep.
func TestAPruneFirstCutsContextForQuotesAddedSinceTheFileWasAttached(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	late := c.newHighlight(book, "The hallway smelt of boiled cabbage and old rag mats.")
	c.mustDo("GET", "/quotes/annotation/"+strconv.FormatInt(late, 10)+"/context", nil, http.StatusNotFound)

	c.mustDo("POST", "/sources/"+strconv.FormatInt(c.sourceID("book", book), 10)+"/prune", nil, 200)
	if ctx := c.contextOf("annotation", late); !strings.Contains(ctx.Body, "boiled cabbage") {
		t.Fatalf("the quote added since should be cut during the prune: %+v", ctx)
	}
	_ = srv
}

func TestAQuoteAddedAfterAPruneHasNoContextAndARescanSaysWhy(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	id := c.sourceID("book", book)
	c.mustDo("POST", "/sources/"+strconv.FormatInt(id, 10)+"/prune", nil, 200)

	after := c.newHighlight(book, "At one end of it a coloured poster was tacked to the wall.")
	c.mustDo("GET", "/quotes/annotation/"+strconv.FormatInt(after, 10)+"/context", nil, http.StatusNotFound)
	rec := c.do("POST", "/sources/"+strconv.FormatInt(id, 10)+"/rescan", nil)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "pruned") {
		t.Fatalf("a rescan of a pruned file names the remedy: %d %s", rec.Code, rec.Body)
	}
	_ = srv
}

func TestAddingTheSameFileAgainAfterAPruneRestoresEverythingAndKeepsTheContext(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.mustDo("POST", "/sources/"+strconv.FormatInt(c.sourceID("book", book), 10)+"/prune", nil, 200)
	after := c.newHighlight(book, "At one end of it a coloured poster was tacked to the wall.")

	rec := c.putSource(sourceFields("book", book), "b-again.txt", []byte(prose))
	if rec.Code != http.StatusOK {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	state := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200))
	if state.State != "file" || liveSourceFiles(t, srv) != 1 {
		t.Fatalf("the file is back: %+v", state)
	}
	if ctx := c.contextOf("annotation", after); !strings.Contains(ctx.Body, "coloured poster") {
		t.Fatalf("the quote that had none gets context now: %+v", ctx)
	}
	if ctx := c.contextOf("annotation", hl); ctx.Body == "" {
		t.Fatal("the same file keeps what was already kept")
	}
}

func TestAPreviewSaysWhatWouldBeKeptAndWhatHasNoContextToKeep(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.newHighlight(book, "A line the file does not contain, nowhere in it at all, honestly.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	id := c.sourceID("book", book)

	pv := decode[pruneRow](t, c.mustDo("GET", "/sources/"+strconv.FormatInt(id, 10)+"/prune", nil, 200))
	if pv.WithContext != 1 || pv.WithoutContext != 1 || pv.Bytes != int64(len(prose)) || pv.KeptBytes == 0 || pv.Title != "B" {
		t.Fatalf("%+v", pv)
	}
	if liveSourceFiles(t, srv) != 1 {
		t.Fatal("a preview must remove nothing")
	}
	stack := decode[struct {
		Sources []pruneRow `json:"sources"`
		Frees   int64      `json:"frees"`
	}](t, c.mustDo("GET", "/sources/stack", nil, 200))
	if len(stack.Sources) != 1 || stack.Frees <= 0 {
		t.Fatalf("%+v", stack)
	}
}

func TestTheStackIsBiggestFirstSoTheDecisionStartsWhereItFreesMost(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	small, big := c.newBook("Small"), c.newBook("Big")
	c.putSource(sourceFields("book", small), "s.txt", []byte("one paragraph\n\ntwo paragraphs\n\nthree\n"))
	c.putSource(sourceFields("book", big), "b.txt", []byte(prose+prose))
	stack := decode[struct {
		Sources []pruneRow `json:"sources"`
	}](t, c.mustDo("GET", "/sources/stack", nil, 200))
	if len(stack.Sources) != 2 || stack.Sources[0].Title != "Big" {
		t.Fatalf("%+v", stack.Sources)
	}
	_ = srv
}

func TestAMountedFileHasNothingToPruneAndAnotherReadersIsNotFound(t *testing.T) {
	srv, c, _, film, _, _ := mountFixture(t)
	cara := addUser(t, srv.Handler(), c, "cara")
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": cand.Bucket, "tokens": []string{cand.Token}}, 200)
		}
	}
	id := strconv.FormatInt(c.sourceID("screen", film), 10)
	if rec := c.do("POST", "/sources/"+id+"/prune", nil); rec.Code != http.StatusConflict {
		t.Fatalf("a mounted source's bytes are not ours to remove: %d %s", rec.Code, rec.Body)
	}
	if rec := cara.do("POST", "/sources/"+id+"/prune", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("%d", rec.Code)
	}
	if rec := c.do("GET", "/sources/stack", nil); !strings.Contains(rec.Body.String(), `"sources":[]`) {
		t.Fatalf("a mounted file is not in the stack: %s", rec.Body)
	}
}

func TestPruningTwiceIsRefused(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	id := strconv.FormatInt(c.sourceID("book", book), 10)
	c.mustDo("POST", "/sources/"+id+"/prune", nil, 200)
	c.mustDo("POST", "/sources/"+id+"/prune", nil, http.StatusConflict)
	_ = srv
}
