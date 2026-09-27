package httpapi

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/metadata"
)

// A STOP IS INSTANT, AND IT BREAKS NOTHING — AT EVERY PLACE ONE CAN LAND.
//
// The owner, on 3.1.0's Stop: "the job cancel button must also be the most
// responsive kill switch. No dillydallying after it has been pressed", and then
// "Stop cancels instantly: but it still shall not break anything. That's
// important." For every kind a person can start, each case here holds a job of
// two items at one place a Stop can land — before its first item, inside each
// call it makes outward, between its two items, and just before a write, with a
// supplier's answer already in hand — presses Stop there, as the row's Stop, as
// Stop all, and as an admin deleting the reader whose job it is, and then asks
// the app, through its API and its data directory:
//
//   - the job reads stopped within 300 ms of the press, its log names who
//     stopped it, and a call that was on the wire saw its request cancelled;
//   - every item is done whole or untouched: the one finished before the Stop
//     has everything it was given, the one in hand has nothing of it;
//   - nothing temporary or partial is anywhere in the data directory, every
//     picture a book, film, person or character names is there and served, and
//     no picture is there that nothing names;
//   - the job queued behind it runs and succeeds, and the stopped job, run again,
//     succeeds and does all it was given.
//
// A reader deleted while their job runs cannot be read back as themselves, so
// that case restores the account from the admin's bin and signs them in again
// before it looks — the account the admin would give back is the one checked.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (queueing,
//     jobs_api_test.go), and its test.lines kind is the job queued behind;
//   - the suppliers are the server's seams — the book search (srv.searchBooks),
//     Open Library's author resolution and reference pages (srv.resolveAuthor,
//     srv.authorLinks), TMDB and TheTVDB pointed at stubs of their APIs — and
//     each is held, on the item the case picks, until the request's context is
//     cancelled, as a supplier that never answers is; or held until then and
//     made to answer after all, as one whose answer was already in hand when the
//     Stop landed;
//   - the picture download is the real one (metadata.FetchImage), let reach a
//     stub image host (metadata.AllowAnyImageHostForTest) through srv.fetchImage,
//     so its temp file and its rename are the ones under test; the host sends
//     half a picture and holds the rest where a case holds it, and srv.fetchImage
//     answers every other address as a picture that is not there, since Amazon's
//     and Open Library's own are nowhere a test may reach;
//   - two test seams, srv.itemSeam and srv.backupSeam: the one way to hold a job
//     before its first item, between two, or between a backup's steps, where
//     nothing is on the wire for a stub to hold;
//   - the data directory (srv.DataDir), walked for what a Stop could leave, and
//     its MediaCover folder, listed against the pictures the API names;
//   - the wire field names, which are the contract the screens are built to.

// pngPicture sniffs as a PNG and clears the size floor for a picture.
var pngPicture = append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{7}, 900)...)

// stopWithin is how soon after the press a job must read stopped.
const stopWithin = 300 * time.Millisecond

// killWorld is one server, its two accounts, a stub image host, and the hold a
// case puts its job in.
type killWorld struct {
	t      *testing.T
	srv    *Server
	h      http.Handler
	admin  *testClient
	reader *testClient
	images string // the stub image host's address

	// holding is on until the Stop has been pressed and the job has read
	// stopped; from then on every supplier answers, for the job run again.
	holding atomic.Bool
	// holdPicture is the address the image host holds mid-body, and
	// latePicture the one it sends whole but srv.fetchImage hands back only once
	// the Stop has landed.
	holdPicture, latePicture atomic.Pointer[string]
	reached                  chan string
	reachOnce                sync.Once
	sawCancel                atomic.Bool
}

func newKillWorld(t *testing.T) *killWorld {
	t.Helper()
	// First, so that it is undone after the queue has closed: a job still on
	// its way out reads it.
	metadata.AllowAnyImageHostForTest(t)
	srv := newTestServer(t)
	queueing(t, srv)
	w := &killWorld{t: t, srv: srv, reached: make(chan string, 1)}
	w.holding.Store(true)
	w.images = w.imageHost()
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		if !strings.HasPrefix(rawURL, w.images) {
			return "", errors.New("no such picture")
		}
		name, err := metadata.FetchImage(ctx, rawURL, dir)
		if p := w.latePicture.Load(); err == nil && w.holding.Load() && p != nil && strings.HasSuffix(rawURL, *p) {
			w.late(ctx, "the picture had arrived")
		}
		return name, err
	}
	w.h = srv.Handler()
	w.admin = signupAdmin(t, w.h)
	w.reader = addUser(t, w.h, w.admin, "bob")
	return w
}

// imageHost serves every picture whole, but the one the case holds: of that it
// sends half, and holds the rest until the request is cancelled.
func (w *killWorld) imageHost() string {
	host := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		if p := w.holdPicture.Load(); w.holding.Load() && p != nil && strings.HasSuffix(r.URL.Path, *p) {
			rw.Header().Set("Content-Length", strconv.Itoa(2*len(pngPicture)))
			_, _ = rw.Write(pngPicture)
			rw.(http.Flusher).Flush()
			_ = w.cut(r.Context(), "the picture's download")
			return
		}
		_, _ = rw.Write(pngPicture)
	}))
	w.t.Cleanup(host.Close)
	return host.URL
}

// picture is a picture's address on the image host.
func (w *killWorld) picture(name string) string { return w.images + "/" + name + ".png" }

// reach says the job has come to the hold.
func (w *killWorld) reach(where string) {
	w.reachOnce.Do(func() { w.reached <- where })
}

// cut is a held call on the wire: it waits for the job's context to end, as a
// supplier that never answers is waited on, and ends with the cancellation.
func (w *killWorld) cut(ctx context.Context, where string) error {
	w.reach(where)
	<-ctx.Done()
	w.sawCancel.Store(true)
	return ctx.Err()
}

// late is a held call whose answer was already in hand when the Stop landed: it
// waits for the job's context to end, and its caller then answers after all.
func (w *killWorld) late(ctx context.Context, where string) {
	w.reach(where)
	<-ctx.Done()
	w.sawCancel.Store(true)
}

// pause holds a job at a seam until it has been stopped.
func (w *killWorld) pause(j *jobs.Job, where string) {
	w.reach(where)
	for deadline := time.Now().Add(20 * time.Second); !j.Stopping() && time.Now().Before(deadline); {
		time.Sleep(time.Millisecond)
	}
}

// atItem arms the item seam: the job is held before item next.
func (w *killWorld) atItem(next int, where string) {
	w.srv.itemSeam = func(j *jobs.Job, i int) {
		if i == next && w.holding.Load() {
			w.pause(j, where)
		}
	}
}

// ---- what a Stop could leave -------------------------------------------------

// treeClean fails on anything in the data directory a download, a backup or a
// staging step leaves while it is under way: none may outlive a Stop.
func (w *killWorld) treeClean() {
	w.t.Helper()
	var left []string
	err := filepath.WalkDir(w.srv.DataDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		n := d.Name()
		if strings.HasPrefix(n, metadata.DownloadPrefix) || strings.HasSuffix(n, ".partial") ||
			strings.HasPrefix(n, ".backup-") || strings.HasPrefix(n, ".safety-") {
			rel, _ := filepath.Rel(w.srv.DataDir, p)
			left = append(left, rel)
		}
		return nil
	})
	if err != nil {
		w.t.Fatal(err)
	}
	if len(left) > 0 {
		w.t.Fatalf("left in the data directory after the Stop: %q", left)
	}
}

// picturesNamed is every picture the accounts' books, films, people and
// characters name, as their own screens list them.
func (w *killWorld) picturesNamed(clients ...*testClient) []string {
	w.t.Helper()
	var out []string
	add := func(name string) {
		if name != "" {
			out = append(out, name)
		}
	}
	for _, c := range clients {
		for _, b := range decode[struct {
			Books []struct {
				Cover string `json:"cover_path"`
			} `json:"books"`
		}](w.t, c.mustDo("GET", "/books", nil, http.StatusOK)).Books {
			add(b.Cover)
		}
		for _, m := range decode[struct {
			Movies []struct {
				Poster string `json:"poster_path"`
			} `json:"movies"`
		}](w.t, c.mustDo("GET", "/movies", nil, http.StatusOK)).Movies {
			add(m.Poster)
		}
		for _, p := range decode[struct {
			People []struct {
				Image string `json:"image_path"`
			} `json:"people"`
		}](w.t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
			add(p.Image)
		}
		for _, ch := range decode[struct {
			Characters []struct {
				Image string `json:"image_path"`
			} `json:"characters"`
		}](w.t, c.mustDo("GET", "/characters", nil, http.StatusOK)).Characters {
			add(ch.Image)
		}
	}
	return out
}

// picturesWhole fails unless every picture named is served, and every picture
// in the covers folder is one something names: no row points at a file that is
// not there, and no file is there that a Stop left without its row.
func (w *killWorld) picturesWhole(clients ...*testClient) {
	w.t.Helper()
	named := w.picturesNamed(clients...)
	for _, name := range named {
		if rec := clients[0].do("GET", "/covers/"+name, nil); rec.Code != http.StatusOK {
			w.t.Fatalf("a picture a row names is not served: %s (%d)", name, rec.Code)
		}
	}
	entries, err := os.ReadDir(w.srv.coversDir())
	if err != nil {
		w.t.Fatal(err)
	}
	for _, e := range entries {
		if e.IsDir() {
			continue // the bin's own folder, where a deleted account's pictures wait
		}
		if !slices.Contains(named, e.Name()) {
			w.t.Fatalf("a picture nothing names is in the covers folder: %s (named: %q)", e.Name(), named)
		}
	}
}

// ---- the kinds ---------------------------------------------------------------

// killCase is one kind, held at one place a Stop can land.
type killCase struct {
	kind    string
	admin   bool   // an admin's kind, started by the admin
	point   string // where the Stop lands, in words
	outward bool   // the point is a call on the wire, which must see its request cancelled
	done    int    // how many of the job's two items are finished at that point
	// arm makes the library, arms the hold, and answers the job's params and a
	// check of the library: that the job's first done items are finished whole
	// and the rest untouched. jobID is the job whose result a check may read.
	arm func(w *killWorld) (params any, check func(c *testClient, jobID int64, done int))
}

// bookAnswers makes the book search know Dune and Dune Messiah by ISBN, each
// with a year, a page count, an author and a cover on the image host; the search
// for hold's ISBN is held as mode says ("cut" or "late"), and "" holds none.
func (w *killWorld) bookAnswers(hold, mode string) {
	w.srv.searchBooks = func(ctx context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == hold && w.holding.Load() {
			if mode == "cut" {
				return nil, w.cut(ctx, "the book search")
			}
			w.late(ctx, "the book search had answered")
		}
		year, pages := 1965, 412
		if isbn == messiahISBN {
			year, pages = 1969, 256
		}
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn,
			PublishedYear: year, Pages: pages, CoverURL: w.picture(isbn)}}, nil
	}
}

type killBook struct {
	Author string `json:"author"`
	Year   int    `json:"published_year"`
	Pages  int    `json:"pages"`
	Cover  string `json:"cover_path"`
}

func bookOf(t *testing.T, c *testClient, id int64) killBook {
	t.Helper()
	return decode[killBook](t, c.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, http.StatusOK))
}

// twoBooks gives c Dune and Dune Messiah by ISBN, with nothing else known.
func twoBooks(t *testing.T, c *testClient, author string) [2]int64 {
	t.Helper()
	body := func(title, isbn string) map[string]any {
		b := map[string]any{"title": title, "isbn": isbn}
		if author != "" {
			b["author"] = author
		}
		return b
	}
	return [2]int64{
		createdID(t, c, "/books", body("Dune", duneISBN)),
		createdID(t, c, "/books", body("Dune Messiah", messiahISBN)),
	}
}

// fillCase is a fill over two books held at one point.
func fillCase(point string, outward bool, done int, hold func(w *killWorld)) killCase {
	return killCase{kind: "fill", point: point, outward: outward, done: done,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			ids := twoBooks(w.t, w.reader, "Frank Herbert")
			w.bookAnswers("", "")
			hold(w)
			return map[string]any{"book_ids": ids[:]}, func(c *testClient, _ int64, done int) {
				for i, id := range ids {
					b := bookOf(w.t, c, id)
					if filled := b.Year != 0 && b.Pages != 0 && b.Cover != ""; i < done && !filled {
						w.t.Fatalf("book %d of 2 was finished before the Stop and is not filled whole: %+v", i+1, b)
					}
					if i >= done && (b.Year != 0 || b.Pages != 0 || b.Cover != "") {
						w.t.Fatalf("book %d of 2 was in hand or not reached, and something of the fill was written: %+v", i+1, b)
					}
				}
			}
		}}
}

// twoFilms gives c two films pinned to TheTVDB and TMDB, and stands up both
// suppliers, TheTVDB answering first; TMDB's answer for the second is held.
func (w *killWorld) twoFilms(c *testClient, mode string) [2]int64 {
	w.t.Helper()
	var held atomic.Int64
	tmdb := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		if id := held.Load(); id != 0 && w.holding.Load() && strings.HasPrefix(r.URL.Path, fmt.Sprintf("/movie/%d", id)) {
			if mode == "cut" {
				_ = w.cut(r.Context(), "TMDB's answer")
				return
			}
		}
		_, _ = rw.Write([]byte(`{"id":1,"title":"The Matrix","release_date":"1999-03-30","overview":"From TMDB.","credits":{"cast":[]}}`))
	}))
	w.t.Cleanup(tmdb.Close)
	tvdb := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/login" {
			_, _ = rw.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		_, _ = rw.Write([]byte(`{"data":{"id":70,"name":"The Matrix","year":"1999","overview":"From TheTVDB.","characters":[]}}`))
	}))
	w.t.Cleanup(tvdb.Close)
	w.srv.TMDB.Key, w.srv.TMDB.BaseURL = "k", tmdb.URL
	w.srv.TVDB = &metadata.TVDB{Key: "k", BaseURL: tvdb.URL}
	var ids [2]int64
	for i, title := range []string{"First film", "Second film"} {
		m := decode[movieDetail](w.t, c.mustDo("POST", "/movies", map[string]any{"title": title, "media_type": "movie"}, http.StatusCreated))
		c.mustDo("PUT", fmt.Sprintf("/movies/%d", m.ID), map[string]any{
			"title": title, "media_type": "movie", "tmdb_id": 600 + i, "tvdb_id": 70 + i,
		}, http.StatusOK)
		ids[i] = m.ID
	}
	held.Store(601)
	return ids
}

type killFilm struct {
	Description string `json:"description"`
	Year        int    `json:"release_year"`
}

func filmOf(t *testing.T, c *testClient, id int64) killFilm {
	t.Helper()
	return decode[killFilm](t, c.mustDo("GET", fmt.Sprintf("/movies/%d", id), nil, http.StatusOK))
}

// fillFilmsCase is a fill over two films whose second is held inside TMDB, after
// TheTVDB has answered for it: what TheTVDB said must not be written.
func fillFilmsCase() killCase {
	return killCase{kind: "fill", point: "inside TMDB, TheTVDB having answered", outward: true, done: 1,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			ids := w.twoFilms(w.reader, "cut")
			return map[string]any{"movie_ids": ids[:]}, func(c *testClient, _ int64, done int) {
				for i, id := range ids {
					f := filmOf(w.t, c, id)
					if i < done && (f.Description != "From TheTVDB." || f.Year != 1999) {
						w.t.Fatalf("film %d of 2 was finished before the Stop and is not filled whole: %+v", i+1, f)
					}
					if i >= done && (f.Description != "" || f.Year != 0) {
						w.t.Fatalf("film %d of 2 was in hand, and the supplier that answered before the Stop was written: %+v", i+1, f)
					}
				}
			}
		}}
}

// findingsOf is the ids a check kept findings for, from its result.
func findingsOf(t *testing.T, c *testClient, jobID int64) []int64 {
	t.Helper()
	var ids []int64
	for _, it := range decode[struct {
		Result []struct {
			ID int64 `json:"id"`
		} `json:"result"`
	}](t, c.mustDo("GET", fmt.Sprintf("/jobs/%d/result", jobID), nil, http.StatusOK)).Result {
		ids = append(ids, it.ID)
	}
	return ids
}

// reverifyCase is a check over two works held at one point. A check writes
// nothing to the library, stopped or not; what it keeps is its findings, and it
// keeps none for the item a Stop reached.
func reverifyCase(point string, outward bool, done int, films bool, hold func(w *killWorld)) killCase {
	return killCase{kind: "reverify", point: point, outward: outward, done: done,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			var ids [2]int64
			var params map[string]any
			if films {
				ids = w.twoFilms(w.reader, "cut")
				params = map[string]any{"movie_ids": ids[:]}
			} else {
				ids = twoBooks(w.t, w.reader, "Frank Herbert")
				w.bookAnswers("", "")
				hold(w)
				params = map[string]any{"book_ids": ids[:]}
			}
			return params, func(c *testClient, jobID int64, done int) {
				for _, id := range ids {
					if films {
						if f := filmOf(w.t, c, id); f.Description != "" || f.Year != 0 {
							w.t.Fatalf("a check wrote to a film: %+v", f)
						}
					} else if b := bookOf(w.t, c, id); b.Year != 0 || b.Pages != 0 || b.Cover != "" {
						w.t.Fatalf("a check wrote to a book: %+v", b)
					}
				}
				if jobID == 0 {
					return // the account was deleted and given back: the check is no longer theirs to read
				}
				if got := findingsOf(w.t, c, jobID); !slices.Equal(got, ids[:done]) {
					w.t.Fatalf("the check kept findings for %v, want exactly the %d item(s) finished before the Stop: %v", got, done, ids[:done])
				}
			}
		}}
}

type killPerson struct {
	Bio   string `json:"bio"`
	Image string `json:"image_path"`
	Links string `json:"links"`
}

func personOf(t *testing.T, c *testClient, id int64) killPerson {
	t.Helper()
	return decode[killPerson](t, c.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK))
}

// twoAuthors gives c two author records with nothing on them.
func twoAuthors(t *testing.T, c *testClient) [2]int64 {
	t.Helper()
	for _, name := range []string{"Ursula K. Le Guin", "Octavia E. Butler"} {
		c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	return [2]int64{recordID(t, c, "Ursula K. Le Guin"), recordID(t, c, "Octavia E. Butler")}
}

// authorAnswers makes Open Library resolve every author with a bio and a
// portrait on the image host, and no links, so the record's reference pages are
// asked for on their own; they come back with one. Butler's resolution or her
// reference pages are held as the case says.
func (w *killWorld) authorAnswers(holdResolve, holdLinks string) {
	w.srv.resolveAuthor = func(ctx context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		if name == "Octavia E. Butler" && w.holding.Load() && holdResolve == "cut" {
			return metadata.AuthorResolution{}, w.cut(ctx, "Open Library's resolution")
		}
		return metadata.AuthorResolution{Key: "OL" + strconv.Itoa(len(name)) + "A", Name: name, Bio: "An American author.",
			ImageURL: w.picture(strings.ReplaceAll(name, " ", "-"))}, nil
	}
	w.srv.authorLinks = func(ctx context.Context, name string) (map[string]string, error) {
		if name == "Octavia E. Butler" && w.holding.Load() {
			switch holdLinks {
			case "cut":
				return nil, w.cut(ctx, "the reference pages")
			case "late":
				w.late(ctx, "the reference pages had answered")
			}
		}
		return map[string]string{"wikipedia": "https://en.wikipedia.org/wiki/" + strings.ReplaceAll(name, " ", "_")}, nil
	}
}

// peopleCase is a people fetch over two records held at one point.
func peopleCase(point string, outward bool, done int, hold func(w *killWorld)) killCase {
	return killCase{kind: "people", point: point, outward: outward, done: done,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			ids := twoAuthors(w.t, w.reader)
			w.authorAnswers("", "")
			hold(w)
			return map[string]any{"ids": ids[:]}, func(c *testClient, _ int64, done int) {
				for i, id := range ids {
					p := personOf(w.t, c, id)
					if whole := p.Bio != "" && p.Image != "" && strings.Contains(p.Links, "wikipedia"); i < done && !whole {
						w.t.Fatalf("record %d of 2 was fetched before the Stop and is not whole: %+v", i+1, p)
					}
					if i >= done && (p.Bio != "" || p.Image != "" || p.Links != "") {
						w.t.Fatalf("record %d of 2 was in hand or not reached, and something of the fetch was written: %+v", i+1, p)
					}
				}
			}
		}}
}

// applyCase is a review's apply of two items — a book's year and cover, then a
// person's bio and portrait — held at one point.
func applyCase(point string, outward bool, done int, hold func(w *killWorld)) killCase {
	return killCase{kind: "reverify-apply", point: point, outward: outward, done: done,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			book := twoBooks(w.t, w.reader, "Frank Herbert")[0]
			person := twoAuthors(w.t, w.reader)[1]
			hold(w)
			items := []map[string]any{
				{"type": "book", "id": book, "set": map[string]any{"published_year": 1965, "cover": w.picture("dune-cover")}},
				{"type": "person", "kind": "author", "name": "Octavia E. Butler",
					"set": map[string]any{"bio": "An American author.", "portrait": w.picture("butler-portrait")}},
			}
			return map[string]any{"items": items}, func(c *testClient, _ int64, done int) {
				b := bookOf(w.t, c, book)
				if written := b.Year == 1965 && b.Cover != ""; done >= 1 && !written {
					w.t.Fatalf("the book was applied before the Stop and is not written whole: %+v", b)
				}
				if done < 1 && (b.Year != 0 || b.Cover != "") {
					w.t.Fatalf("the book was not reached, and something of the apply was written: %+v", b)
				}
				p := personOf(w.t, c, person)
				if written := p.Bio != "" && p.Image != ""; done >= 2 && !written {
					w.t.Fatalf("the person was applied and is not written whole: %+v", p)
				}
				if done < 2 && (p.Bio != "" || p.Image != "") {
					w.t.Fatalf("the person was in hand or not reached, and something of the apply was written: %+v", p)
				}
			}
		}}
}

// coversCase is an admin's covers pass over two books with no author and no
// cover, held at one point.
func coversCase(point string, outward bool, done int, hold func(w *killWorld)) killCase {
	return killCase{kind: "covers", admin: true, point: point, outward: outward, done: done,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			ids := twoBooks(w.t, w.admin, "")
			w.bookAnswers("", "")
			hold(w)
			return map[string]any{"missing_only": true}, func(c *testClient, _ int64, done int) {
				for i, id := range ids {
					b := bookOf(w.t, c, id)
					if whole := b.Author != "" && b.Cover != ""; i < done && !whole {
						w.t.Fatalf("book %d of 2 was walked before the Stop and is not whole: %+v", i+1, b)
					}
					if i >= done && (b.Author != "" || b.Cover != "") {
						w.t.Fatalf("book %d of 2 was in hand or not reached, and something of the pass was written: %+v", i+1, b)
					}
				}
			}
		}}
}

// backupCase is an admin's backup held at one of its steps. Its one item is
// the archive, and a stopped one leaves the archive kept before it as it was.
func backupCase(point, step string, nth int) killCase {
	return killCase{kind: "backup", admin: true, point: point,
		arm: func(w *killWorld) (any, func(*testClient, int64, int)) {
			// A book with a cover, so the archive holds a file after its snapshot:
			// a Stop between two files needs two.
			w.admin.mustDo("POST", "/books", map[string]any{"title": "Kindred", "cover_url": w.picture("kindred")}, http.StatusCreated)
			before := w.admin.waitJob(w.admin.mustStart("backup", map[string]any{"password": "supersecret"}).ID, "succeeded")
			kept := keptBackup(w.t, w.admin)
			if kept == "" {
				w.t.Fatalf("the first backup kept nothing: %+v", before)
			}
			var seen atomic.Int32
			w.srv.backupSeam = func(ctx context.Context, at string) {
				if at == step && w.holding.Load() && int(seen.Add(1)) == nth {
					w.reach(point)
					<-ctx.Done()
				}
			}
			return map[string]any{"password": "supersecret"}, func(c *testClient, _ int64, done int) {
				now := keptBackup(w.t, c)
				if done == 0 && now != kept {
					w.t.Fatalf("a stopped backup changed the archive kept: %q, was %q", now, kept)
				}
				if done > 0 && now == "" {
					w.t.Fatal("a backup that succeeded keeps no archive")
				}
				if rec := c.do("GET", "/admin/backup/download", nil); rec.Code != http.StatusOK || rec.Body.Len() == 0 {
					w.t.Fatalf("the kept archive does not download: %d, %d bytes", rec.Code, rec.Body.Len())
				}
			}
		}}
}

// keptBackup is the kept archive's name, as the Server card reads it.
func keptBackup(t *testing.T, c *testClient) string {
	t.Helper()
	b := decode[struct {
		Backup *struct {
			Name string `json:"name"`
		} `json:"backup"`
	}](t, c.mustDo("GET", "/admin/backup", nil, http.StatusOK))
	if b.Backup == nil {
		return ""
	}
	return b.Backup.Name
}

// killCases is every kind at every place a Stop can land in it.
func killCases() []killCase {
	return []killCase{
		fillCase("before its first work", false, 0, func(w *killWorld) { w.atItem(0, "before the first work") }),
		fillCase("inside the book search", true, 1, func(w *killWorld) { w.bookAnswers(messiahISBN, "cut") }),
		fillCase("inside the cover's download", true, 1, func(w *killWorld) { w.holdPicture.Store(ptr(messiahISBN + ".png")) }),
		fillCase("between its works", false, 1, func(w *killWorld) { w.atItem(1, "between the works") }),
		fillCase("just before the write, the search answered", true, 1, func(w *killWorld) { w.bookAnswers(messiahISBN, "late") }),
		fillCase("just before the write, the cover arrived", true, 1, func(w *killWorld) { w.latePicture.Store(ptr(messiahISBN + ".png")) }),
		fillFilmsCase(),

		reverifyCase("before its first item", false, 0, false, func(w *killWorld) { w.atItem(0, "before the first item") }),
		reverifyCase("inside the book search", true, 1, false, func(w *killWorld) { w.bookAnswers(messiahISBN, "cut") }),
		reverifyCase("between its items", false, 1, false, func(w *killWorld) { w.atItem(1, "between the items") }),
		reverifyCase("just before it keeps the item, the search answered", true, 1, false, func(w *killWorld) { w.bookAnswers(messiahISBN, "late") }),
		reverifyCase("inside TMDB, TheTVDB having answered", true, 1, true, nil),

		applyCase("before its first item", false, 0, func(w *killWorld) { w.atItem(0, "before the first item") }),
		applyCase("inside the portrait's download", true, 1, func(w *killWorld) { w.holdPicture.Store(ptr("butler-portrait.png")) }),
		applyCase("between its items", false, 1, func(w *killWorld) { w.atItem(1, "between the items") }),
		applyCase("just before the write, the portrait arrived", true, 1, func(w *killWorld) { w.latePicture.Store(ptr("butler-portrait.png")) }),

		peopleCase("before its first record", false, 0, func(w *killWorld) { w.atItem(0, "before the first record") }),
		peopleCase("inside Open Library's resolution", true, 1, func(w *killWorld) { w.authorAnswers("cut", "") }),
		peopleCase("inside the portrait's download", true, 1, func(w *killWorld) { w.holdPicture.Store(ptr("Octavia-E.-Butler.png")) }),
		peopleCase("inside the reference pages, the portrait arrived", true, 1, func(w *killWorld) { w.authorAnswers("", "cut") }),
		peopleCase("between its records", false, 1, func(w *killWorld) { w.atItem(1, "between the records") }),
		peopleCase("just before the write, the reference pages answered", true, 1, func(w *killWorld) { w.authorAnswers("", "late") }),

		coversCase("before its first work", false, 0, func(w *killWorld) { w.atItem(0, "before the first work") }),
		coversCase("inside the book search", true, 1, func(w *killWorld) { w.bookAnswers(messiahISBN, "cut") }),
		coversCase("inside the cover's download", true, 1, func(w *killWorld) { w.holdPicture.Store(ptr(messiahISBN + ".png")) }),
		coversCase("between its works", false, 1, func(w *killWorld) { w.atItem(1, "between the works") }),
		coversCase("just before the write, the search answered", true, 1, func(w *killWorld) { w.bookAnswers(messiahISBN, "late") }),
		coversCase("just before the write, the cover arrived", true, 1, func(w *killWorld) { w.latePicture.Store(ptr(messiahISBN + ".png")) }),

		backupCase("before its snapshot", "snapshot", 1),
		backupCase("between two of its files", "file", 2),
		backupCase("just before its promote", "promote", 1),
	}
}

func ptr(s string) *string { return &s }

// What each press is, as the person pressing it: the row's Stop, Stop all, and
// an admin deleting the reader whose job is running.
var stopPresses = []string{"stop", "stop all", "delete the reader"}

func TestAStopAnywhereIsInstantAndLeavesEveryItemWholeOrUntouched(t *testing.T) {
	for _, c := range killCases() {
		for _, press := range stopPresses {
			if press == "delete the reader" && c.admin {
				continue // an admin's account is never deleted from under it (handleDeleteUser)
			}
			t.Run(c.kind+"/"+c.point+"/"+press, func(t *testing.T) { runKillCase(t, c, press) })
		}
	}
}

func runKillCase(t *testing.T, c killCase, press string) {
	w := newKillWorld(t)
	owner, other, who := w.reader, w.admin, "bob"
	if c.admin {
		owner, other, who = w.admin, w.reader, "alice"
	}
	params, check := c.arm(w)
	job := owner.mustStart(c.kind, params)
	select {
	case <-w.reached:
	case <-time.After(20 * time.Second):
		t.Fatalf("the job never reached %s: %+v", c.point, owner.job(job.ID))
	}
	// The job queued behind it is the other account's, so a reader's Stop all
	// cannot reach it. An admin's Stop all stops everybody's, so behind theirs it
	// is queued once the press has landed.
	behind := func() wireJob { return other.mustStart("test.lines", map[string]any{"tag": "behind " + c.point}) }
	var next wireJob
	queuedFirst := !(c.admin && press == "stop all")
	if queuedFirst {
		next = behind()
	}

	viewer, line := owner, who+" pressed Stop"
	var deleted chan int
	pressed := time.Now()
	switch press {
	case "stop":
		owner.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	case "stop all":
		owner.mustDo("POST", "/jobs/stop-all", nil, http.StatusOK)
		line = who + " pressed Stop all"
	case "delete the reader":
		// The delete waits for the job to be out of its hands, so it is sent
		// beside the reads that watch it.
		viewer, line = w.admin, "Stop, because the account that started this job is being deleted"
		deleted = make(chan int, 1)
		bobID := accountID(t, w.admin, "bob")
		pressed = time.Now()
		go func() { deleted <- w.admin.do("DELETE", "/admin/users/"+itoa(bobID), nil).Code }()
	}

	// STOPPED WITHIN 300 MS OF THE PRESS.
	var stopped wireJob
	for {
		stopped = viewer.job(job.ID)
		if stopped.State == jobs.StateStopped {
			break
		}
		if time.Since(pressed) > 20*time.Second {
			t.Fatalf("the job never read stopped after the press: %+v", stopped)
		}
		time.Sleep(2 * time.Millisecond)
	}
	if took := time.Since(pressed); took > stopWithin {
		t.Fatalf("the job read stopped %s after the press, want within %s", took, stopWithin)
	}
	w.holding.Store(false)
	if c.outward && !w.sawCancel.Load() {
		t.Fatalf("the call on the wire at %s never saw its request cancelled", c.point)
	}
	if stopped.Done != c.done {
		t.Fatalf("the stopped job counts %d item(s) done, want %d: the one in hand is not one of them", stopped.Done, c.done)
	}
	if log := strings.Join(logOf(t, viewer, job.ID), "\n"); !strings.Contains(log, line) {
		t.Fatalf("the job's log does not say who pressed Stop (%q):\n%s", line, log)
	}

	// EVERY ITEM WHOLE OR UNTOUCHED, NOTHING LEFT BEHIND.
	reader, readable := w.reader, job.ID
	if press == "delete the reader" {
		if code := <-deleted; code != http.StatusOK {
			t.Fatalf("deleting the reader while their job ran: %d", code)
		}
		w.treeClean()
		reader, readable = w.giveBack("bob"), 0
	}
	checker := reader
	if c.admin {
		checker = w.admin
	}
	check(checker, readable, c.done)
	w.treeClean()
	w.picturesWhole(w.admin, reader)

	// THE QUEUE GOES ON, AND THE STOPPED JOB RUNS AGAIN TO ITS END.
	if !queuedFirst {
		next = behind()
	}
	other.waitJob(next.ID, jobs.StateSucceeded)
	if press == "delete the reader" {
		return // their job is the admin's to read now, and nobody's to run again
	}
	var body any
	if c.kind == "backup" {
		body = map[string]any{"password": "supersecret"}
	}
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, owner.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", job.ID), body, http.StatusAccepted)).Job
	owner.waitJob(again.ID, jobs.StateSucceeded)
	if c.kind == "reverify" {
		readable = again.ID
	}
	check(checker, readable, 2)
	w.treeClean()
	w.picturesWhole(w.admin, reader)
}

// giveBack restores the deleted account from the admin's bin and signs it in
// again, as the admin would give an account back and its reader would return.
func (w *killWorld) giveBack(name string) *testClient {
	w.t.Helper()
	for _, e := range binOf(w.t, w.admin).Trash {
		if e.Kind == "account" && e.Label == name {
			restore(w.t, w.admin, e.ID, http.StatusOK)
			c := &testClient{t: w.t, h: w.h}
			rec := c.do("POST", "/auth/login", map[string]string{"username": name, "password": "supersecret"})
			if rec.Code != http.StatusOK {
				w.t.Fatalf("%s cannot sign in once given back: %d %s", name, rec.Code, rec.Body)
			}
			c.cookie = cookieOf(w.t, rec)
			return c
		}
	}
	w.t.Fatalf("the deleted account %s is not in the admin's bin", name)
	return nil
}
