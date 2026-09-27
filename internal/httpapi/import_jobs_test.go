package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"tippani/internal/importer"
)

// AN IMPORT IS KEPT AS A JOB, THOUGH IT RUNS IN ITS REQUEST.
//
// Driven through the API as the Import screen drives it — a file posted to the
// drop target (POST /import/auto) or to a source's own route — and read back as
// Settings › Jobs reads it: Past jobs, then the job's log.
//
// WHAT IT KNOWS, declared: what jobs_api_test.go's header declares (the queue and
// its logbook given to the server as serve() gives them, and the wire field
// names), and the importer's own sample files (internal/importer/testdata, as
// import_auto_test.go reads them).
//
// What each one guards, in a sentence a person would say: a file I dropped is in
// Past jobs under its name, saying what it was read as and what it staged, under
// the batch the import queue shows; a file of quotes says so too; a file that is
// something else is kept as a failed import that says what it is; a file its
// route cannot read is kept as a failed import that says why; and what a Kindle
// file counted beside its quotes — the bookmarks it skipped — is in the log.

type wireLine struct {
	ID    int64  `json:"id"`
	Level string `json:"level"`
	Line  string `json:"line"`
}

// importJob waits for the import of file to be in c's past jobs, as the list is
// read again until it shows, and returns it with its log.
func importJob(c *testClient, file string) (wireJob, []wireLine) {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		for _, j := range c.jobs("view=past&kind=import").Jobs {
			if j.Subject == file {
				return j, decode[struct {
					Lines []wireLine `json:"lines"`
				}](c.t, c.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=0", j.ID), nil, http.StatusOK)).Lines
			}
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("no import of %q in past jobs", file)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// saying fails unless one of lines holds every part of want, and returns it.
func saying(t *testing.T, lines []wireLine, want ...string) wireLine {
	t.Helper()
	for _, l := range lines {
		all := true
		for _, w := range want {
			all = all && strings.Contains(l.Line, w)
		}
		if all {
			return l
		}
	}
	t.Fatalf("no line says %q in %+v", want, lines)
	return wireLine{}
}

func TestAnImportIsKeptAsAJobThatSaysWhatItReadAndStaged(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	rec := c.importAs("notes", fixture(t, "goodreads_synth.htm"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("the import: %d %s", rec.Code, rec.Body)
	}
	staged := decode[autoReply](t, rec)
	if staged.Staged < 2 {
		t.Fatalf("the sample staged %d quotes; this test wants a plural", staged.Staged)
	}
	j, lines := importJob(c, "notes")
	if j.Queued || !j.Own || j.State != "succeeded" || j.Error != "" {
		t.Fatalf("the import in past jobs: %+v", j)
	}
	saying(t, lines, "read as "+importer.SourceGoodreadsHTML, "the file says")
	// The batch it names is the one the import queue shows.
	saying(t, lines, fmt.Sprintf("staged %d quotes from 1 work as batch %d", staged.Staged, staged.BatchID))
	if q := queue(t, c, ""); len(q.Batches) != 1 || q.Batches[0].ID != staged.BatchID {
		t.Fatalf("the import queue's batches: %+v, want %d", q.Batches, staged.BatchID)
	}

	// A file of quotes, through the markdown route: the route names the format,
	// and the quotes are staged into one group.
	md := "---\ntype: quotes\n---\n\n## Burma Radio broadcast\n\n> Give me blood\n- speaker: Bose\n\n" +
		"## Singapore rally\n\n> Give me blood\n- speaker: Bose\n"
	quotes := stageQuotesMD(t, c, "speeches.md", md)
	_, lines = importJob(c, "speeches.md")
	saying(t, lines, "read as "+importer.SourceMarkdown, "route")
	saying(t, lines, fmt.Sprintf("staged 2 quotes as batch %d", quotes.BatchID))
}

func TestAnImportThatStagesNothingIsKeptAsAFailedOneSayingWhy(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	// Something else entirely: the app's own export, a zip.
	if rec := c.importAs("library.zip", []byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"), ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("a zip: %d %s", rec.Code, rec.Body)
	}
	j, lines := importJob(c, "library.zip")
	if j.State != "failed" || j.Error != "HTTP 400" {
		t.Fatalf("the zip's import: %+v", j)
	}
	if l := saying(t, lines, "not imported", "a zip archive"); l.Level != "warn" {
		t.Fatalf("the near miss's line: %+v", l)
	}

	// A file its route cannot read, and the parser's own reason.
	rec := c.importFile("/import/goodreads-html", "saved.htm", []byte("<html><body>nothing here</body></html>"))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a page that is not Goodreads: %d %s", rec.Code, rec.Body)
	}
	why := decode[struct {
		Error string `json:"error"`
	}](t, rec).Error
	j, lines = importJob(c, "saved.htm")
	if j.State != "failed" {
		t.Fatalf("the page's import: %+v", j)
	}
	saying(t, lines, "read as "+importer.SourceGoodreadsHTML)
	saying(t, lines, "not imported: "+why)

	// Nothing above may have staged a batch.
	if q := queue(t, c, ""); len(q.Batches) != 0 {
		t.Fatalf("a refused import staged something: %+v", q.Batches)
	}
}

func TestAKindleImportSaysWhatItCountedBesideTheQuotes(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	clips := strings.Join([]string{
		"A Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 12 | Location 100-101 | Added on Monday, 5 January 2026 10:00:00",
		"",
		"The first thing worth keeping.",
		"==========",
		"A Borrowed Light (Ashworth, N.)",
		"- Your Bookmark on page 15 | Added on Monday, 5 January 2026 10:02:00",
		"",
		"",
		"==========",
		"A Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 20 | Location 200-201 | Added on Monday, 5 January 2026 10:05:00",
		"",
		"The second thing worth keeping.",
		"==========",
		"",
	}, "\n")
	rec := c.importAs("My Clippings.txt", []byte(clips), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("the clippings: %d %s", rec.Code, rec.Body)
	}
	_, lines := importJob(c, "My Clippings.txt")
	saying(t, lines, "read as "+importer.SourceKindleClippings)
	saying(t, lines, "staged 2 quotes from 1 work")
	saying(t, lines, "bookmarks skipped 1")
}
