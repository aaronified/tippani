package httpapi

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"

	"tippani/internal/outbound"
)

// WHAT EACH JOB IS ABOUT, AS PAST JOBS NAMES IT.
//
// A lookup a reader makes is kept as a job in its request, and the row names what
// was looked up — the title, the ISBN, the name the reader typed — so that "Book
// lookup · Dune" can be told from "Book lookup · Emma" in Settings › Jobs. A
// queued job about one work or one person is named after it; one about several
// is named after nothing, and the screen counts them.
//
// Every request goes through the handler as the screens send it, with the
// server offline (TIPPANI_OFFLINE), so every lookup's outward call is refused and
// logged — which is what keeps a lookup as a job at all — and nothing reaches a
// supplier. Past jobs is read as the Jobs tab reads it (GET /jobs?view=past).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the logbook
// and the outbound hook are given to the server as serve() gives them (the
// queue's logbook, outbound.SetObserver), and the log is flushed before Past jobs
// is read (flushed), since a request's job lands in the logbook's next batch; the
// film's cast is fetched from a TheTVDB stub (suicideSquad) before the server
// goes offline; and the job kinds' names and the wire fields of a job, which are
// the contract Settings › Jobs is built to.
//
// What it guards, in a sentence a person would say: each lookup I make is kept
// under what I looked up, and a job about one thing is kept under that thing —
// when the thing is mine: a job given another reader's id is kept under nothing,
// and my Past jobs never names what is theirs.
func TestEachJobIsKeptUnderWhatItIsAbout(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	outbound.SetObserver(q.lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	var waller int64
	for _, row := range castOf(t, alice, "/movies/"+itoa(film)+"/cast").Cast {
		if row.Character == "Amanda Waller" {
			waller = row.ID
		}
	}
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	emma := createdID(t, alice, "/books", map[string]any{"title": "Emma", "author": "Jane Austen"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	leGuin := recordID(t, alice, "Ursula K. Le Guin")
	t.Setenv(outbound.EnvVar, "1")

	// The lookups a reader makes, one at a time, each answered however a
	// refused supplier makes it answer.
	for _, req := range []struct {
		path string
		body any
	}{
		{"/books/lookup", map[string]any{"title": "Dune", "isbn": duneISBN}},
		{"/books/lookup", map[string]any{"isbn": messiahISBN}},
		{"/movies/lookup", map[string]any{"title": "Suicide Squad"}},
		{"/images/search", map[string]any{"kind": "portrait", "name": "Viola Davis", "title": "Suicide Squad"}},
		{"/images/search", map[string]any{"kind": "cover", "title": "Emma", "isbn": messiahISBN}},
		{"/people/portrait", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}},
		{"/people/lookup", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}},
		{"/metadata/reverify", map[string]any{"book_ids": []int64{dune}}},
		{"/cast/" + itoa(waller) + "/image", nil},
		{"/movies/" + itoa(film) + "/cast/imdb", map[string]any{"imdb": "https://www.imdb.com/title/tt1386697/"}},
		{"/people/id/" + itoa(leGuin) + "/fetch", nil},
		{"/movies/" + itoa(film) + "/cast/art", map[string]any{"names": []string{"Viola Davis"}}},
	} {
		alice.do("POST", req.path, req.body)
	}
	// The queued ones, each waited out before the next, as five at once is a
	// reader's limit.
	for _, start := range []struct {
		kind   string
		params map[string]any
	}{
		{"fill", map[string]any{"book_ids": []int64{dune}}},
		{"fill", map[string]any{"book_ids": []int64{dune, emma}}},
		{"people", map[string]any{"ids": []int64{leGuin}}},
		{"reverify", map[string]any{"people": []map[string]string{{"kind": "author", "name": "Ursula K. Le Guin"}}}},
		{"reverify", map[string]any{"book_ids": []int64{dune}, "movie_ids": []int64{film}}},
		{"covers", map[string]any{"missing_only": true}},
	} {
		j := alice.mustStart(start.kind, start.params)
		alice.waitJob(j.ID, "succeeded")
	}
	flushed(t, q.lb)

	kept := map[string][]string{}
	for _, j := range alice.jobs("view=past&limit=200").Jobs {
		kept[j.Kind] = append(kept[j.Kind], j.Subject)
	}
	for _, want := range []struct{ kind, subject string }{
		{"lookup.book", "Dune"},
		{"lookup.book", messiahISBN},
		{"lookup.movie", "Suicide Squad"},
		{"lookup.images", "Viola Davis"},
		{"lookup.images", "Emma"},
		{"lookup.portrait", "Ursula K. Le Guin"},
		{"lookup.links", "Ursula K. Le Guin"},
		{"lookup.reverify", "Dune"},
		{"lookup.cast-image", "Amanda Waller"},
		{"lookup.cast-imdb", "tt1386697"},
		{"lookup.cast-tvdb", "Suicide Squad"},
		{"lookup.person", "Ursula K. Le Guin"},
		{"lookup.cast-art", "Suicide Squad"},
		{"fill", "Dune"},
		{"fill", ""},
		{"people", "Ursula K. Le Guin"},
		{"reverify", "Ursula K. Le Guin"},
		{"reverify", ""},
		{"covers", ""},
	} {
		if !slices.Contains(kept[want.kind], want.subject) {
			t.Errorf("no %s job kept under %q; the %s jobs are under %q", want.kind, want.subject, want.kind, kept[want.kind])
		}
	}
	// Two works, and neither is named: the screen says "2 works" itself.
	if fills := kept["fill"]; len(fills) != 2 || slices.Contains(fills, "Emma") {
		t.Errorf("the fill jobs are under %q", fills)
	}
	if t.Failed() {
		var all []string
		for k, v := range kept {
			all = append(all, fmt.Sprintf("%s=%q", k, v))
		}
		slices.Sort(all)
		t.Log("every job kept:\n" + strings.Join(all, "\n"))
	}
}

// ANOTHER READER'S WORK IS NOT NAMED. Bob, holding the ids of alice's book, film
// and author (a stale link, a guessed number), starts a fill of each work, a
// check of the book and a fetch of the author. Each job is his to see, and each
// is kept under nothing: a job's subject is what Past jobs shows, and a title
// read without asking whose it is would tell him what alice has.
func TestAJobGivenAnotherReadersIDIsNotNamedAfterWhatItFound(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"})
	arrival := createdID(t, alice, "/movies", map[string]any{"title": "Arrival", "media_type": "movie"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	leGuin := recordID(t, alice, "Ursula K. Le Guin")

	for _, start := range []struct {
		kind   string
		params map[string]any
	}{
		{"fill", map[string]any{"book_ids": []int64{dune}}},
		{"fill", map[string]any{"movie_ids": []int64{arrival}}},
		{"reverify", map[string]any{"book_ids": []int64{dune}}},
		{"people", map[string]any{"ids": []int64{leGuin}}},
	} {
		j := bob.mustStart(start.kind, start.params)
		if j.Subject != "" {
			t.Errorf("bob's %s of alice's id is kept under %q", start.kind, j.Subject)
		}
		bob.waitJob(j.ID, "succeeded")
	}
	past := bob.jobs("view=past&limit=50").Jobs
	if len(past) != 4 {
		t.Fatalf("bob's Past jobs: %d, want his four", len(past))
	}
	for _, j := range past {
		if j.Subject != "" {
			t.Errorf("bob's Past jobs shows his %s as %q", j.Kind, j.Subject)
		}
	}
}
