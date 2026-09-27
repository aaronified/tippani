package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/outbound"
)

// FILL GAPS, AS A JOB: a selection's Fill gaps, started as the screens start it
// (POST /jobs {kind: "fill"}), watched as Settings › Jobs watches it, and the
// library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (queueing,
//     jobs_api_test.go), since no request starts the server;
//   - the book supplier is the server's seam (srv.searchBooks), because a test
//     may not reach Google Books or Open Library; one test holds it mid-answer,
//     as a slow supplier would, so that Stop is pressed with a work in hand;
//   - Pushover is a stub of its API (newFakePushover), for the same reason;
//   - the offline switch is its environment variable (outbound.EnvVar), set the
//     way an operator sets it, and olog's lines reach the system log through the
//     sink serve() installs, so GET /admin/logs can be asked what was logged;
//   - the job's wire fields, and the names of its counts, which are the contract
//     the screens are built to: the SPA's jobs.js reads counts by those names
//     (COUNT_KEYS and jobOutcome), so a count spelled otherwise is a count the
//     screen shows as nothing.
//
// What each one guards, in a sentence a person would say: a fill fills only what
// is missing, says in its log what it did to each work, and counts fields filled,
// works that failed and works that need a Look up apart, under the names the
// screens read; Stop ends it after the work in hand, and what it had filled stays
// filled, and a Stop pressed during its last work leaves it finished, not
// stopped; a long fill tells the phone when it reaches its end, not when it
// is stopped; and a lookup the offline switch refused is not an error in the
// system log, while a supplier that fails any other way still is.

// duneSupplier is a book supplier that knows every ISBN it is asked about as
// Frank Herbert's Dune, 1965, 412 pages, and knows nothing by title alone.
const duneISBN, messiahISBN = "9780441013593", "9780441172696"

func duneSupplier(srv *Server) {
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", Author: "Frank Herbert",
			ISBN13: isbn, PublishedYear: 1965, Pages: 412}}, nil
	}
}

func createdID(t *testing.T, c *testClient, path string, body map[string]any) int64 {
	t.Helper()
	return decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", path, body, http.StatusCreated)).ID
}

// logOf is a job's whole log as its pane reads it, one string per line.
func logOf(t *testing.T, c *testClient, id int64) []string {
	t.Helper()
	page := decode[struct {
		Lines []struct {
			Level string `json:"level"`
			Line  string `json:"line"`
		} `json:"lines"`
	}](t, c.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=0", id), nil, http.StatusOK))
	var out []string
	for _, l := range page.Lines {
		out = append(out, l.Level+" "+l.Line)
	}
	return out
}

// countsAre fails unless a job's counts are exactly want: the names the screens
// read, and nothing else under them.
func countsAre(t *testing.T, j wireJob, want map[string]any) {
	t.Helper()
	var got, names []string
	for k, v := range j.Counts {
		got = append(got, fmt.Sprintf("%s=%v", k, v))
	}
	for k, v := range want {
		names = append(names, fmt.Sprintf("%s=%v", k, v))
	}
	sort.Strings(got)
	sort.Strings(names)
	if !slices.Equal(got, names) {
		t.Fatalf("%s job #%d counts %v, want exactly %v", j.Kind, j.ID, got, names)
	}
}

func TestAFillJobFillsWhatIsMissingAndSaysWhatItDidToEachWork(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneSupplier(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	messiah := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert"})
	bobs := createdID(t, bob, "/books", map[string]any{"title": "Bob's book", "author": "Someone"})

	job := alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": []int64{dune, messiah, bobs}}).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the fill's progress: %d of %d", job.Done, job.Total)
	}
	// Two fields on Dune; bob's book is not alice's to fill, which is a failure;
	// Dune Messiah has no ISBN to ask with, which is not.
	countsAre(t, job, map[string]any{"fields": float64(2), "failed": float64(1), "unpinned": float64(1)})

	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Dune» — filled year, pages",
		"info «Dune Messiah» — unpinned, so there is nothing to ask",
		fmt.Sprintf("warn book #%d — not found", bobs),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the fill's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's book") {
		t.Errorf("alice's fill names bob's book:\n%s", log)
	}

	got := decode[struct {
		Year  int `json:"published_year"`
		Pages int `json:"pages"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if got.Year != 1965 || got.Pages != 412 {
		t.Fatalf("Dune after the fill: %+v", got)
	}
}

func TestAFillJobStopsAfterTheWorkInHandAndKeepsWhatItFilled(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneSupplier(srv)
	answer := srv.searchBooks
	asked, release := make(chan struct{}, 1), make(chan struct{})
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		select {
		case asked <- struct{}{}:
			<-release // the first work's lookup is slow
		default:
		}
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": messiahISBN})

	job := alice.mustStart("fill", map[string]any{"book_ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fill never asked the supplier")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(release)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d works, want the one in hand", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"fields": float64(2), "failed": float64(0), "unpinned": float64(0)})

	year := func(id int64) int {
		return decode[struct {
			Year int `json:"published_year"`
		}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, http.StatusOK)).Year
	}
	if year(first) != 1965 || year(second) != 0 {
		t.Fatalf("after the stop: the first book's year %d, the second's %d; want the first filled and the second untouched",
			year(first), year(second))
	}
}

// A Stop pressed while the fill's one work is being looked up lets that work
// finish, as every Stop does — and then the fill has done everything it was
// given. It succeeded, with the year written; it is not a stopped fill.
func TestAFillStoppedDuringItsLastWorkHasFinished(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneSupplier(srv)
	answer := srv.searchBooks
	asked, release := make(chan struct{}, 1), make(chan struct{})
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		asked <- struct{}{}
		<-release
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})

	job := alice.mustStart("fill", map[string]any{"book_ids": []int64{dune}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fill never asked the supplier")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(release)
	done := alice.waitJob(job.ID, "succeeded")
	if done.Done != 1 || done.Total != 1 {
		t.Fatalf("the fill's progress: %d of %d", done.Done, done.Total)
	}
	countsAre(t, done, map[string]any{"fields": float64(2), "failed": float64(0), "unpinned": float64(0)})
	if log := strings.Join(logOf(t, alice, job.ID), "\n"); strings.HasSuffix(log, "stopped") {
		t.Errorf("a fill that did its one work ends its log saying it stopped:\n%s", log)
	}
	year := decode[struct {
		Year int `json:"published_year"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)).Year
	if year != 1965 {
		t.Fatalf("Dune's year after the fill: %d", year)
	}
}

func TestALongFillJobTellsThePhoneWhenItReachesItsEnd(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	duneSupplier(srv)
	answer := srv.searchBooks
	var holding atomic.Bool
	holding.Store(true)
	hold, asked := make(chan struct{}), make(chan struct{}, 1)
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if holding.Load() {
			asked <- struct{}{}
			<-hold
		}
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, http.StatusOK)
	ids := []int64{createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})}
	for i := 1; i < notifyFetchMin; i++ {
		ids = append(ids, createdID(t, alice, "/books", map[string]any{"title": fmt.Sprintf("Book %02d", i), "author": "Someone"}))
	}

	// Stopped after its first work: it did not reach its end, so the phone hears
	// nothing.
	cut := alice.mustStart("fill", map[string]any{"book_ids": ids})
	<-asked
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", cut.ID), nil, http.StatusOK)
	holding.Store(false)
	close(hold)
	alice.waitJob(cut.ID, "stopped")
	if msgs := push.sent(); len(msgs) != 0 {
		t.Fatalf("a stopped fill sent %+v", msgs)
	}

	// A short one is quiet; the whole library, to its end, is not.
	alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": ids[1:]}).ID, "succeeded")
	if msgs := push.sent(); len(msgs) != 0 {
		t.Fatalf("a fill of %d works sent %+v", len(ids)-1, msgs)
	}
	alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": ids}).ID, "succeeded")
	msgs := push.sent()
	want := fmt.Sprintf("0 fields filled across %d works.", notifyFetchMin)
	if len(msgs) != 1 || msgs[0]["title"] != "Metadata fill finished" || msgs[0]["message"] != want {
		t.Fatalf("a fill of %d works sent %+v, want one saying %q", notifyFetchMin, msgs, want)
	}
}

// A LOOKUP THE OFFLINE SWITCH REFUSED IS NOT AN ERROR. The operator switched the
// app offline and a fill asks the book's ISBN of its suppliers; the gate refuses
// the call, as it should, and has already said so in the fill's own log. The
// system log gets no TIP-META-011 error for it: offline, where every browser
// journey runs, every fill left one per work, over the errors that are failures.
// A supplier that fails any other way is still an error, once.
func TestALookupTheOfflineSwitchRefusedIsNotLoggedAsAnError(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	olog.SetSink(func(e olog.Entry) { q.lb.System(e.Level, e.Code, e.Line) })
	t.Cleanup(func() { olog.SetSink(nil) })
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	fill := map[string]any{"book_ids": []int64{dune}}
	lookupErrors := func() int {
		n := 0
		for _, l := range alice.logs(url.Values{"q": {"re-verify book isbn"}, "level": {"error"}}).Lines {
			if l.Code == string(olog.CodeMetaReverifyFetch) {
				n++
			}
		}
		return n
	}

	t.Setenv(outbound.EnvVar, "1")
	job := alice.waitJob(alice.mustStart("fill", fill).ID, "succeeded")
	// The lookup was asked and refused, not skipped: the work failed.
	countsAre(t, job, map[string]any{"fields": float64(0), "failed": float64(1), "unpinned": float64(0)})
	if n := lookupErrors(); n != 0 {
		t.Errorf("the offline switch's refusal of a fill's lookup was logged as %d TIP-META-011 error(s)", n)
	}

	// Online again, and the supplier says no: that is the failure the code is for.
	t.Setenv(outbound.EnvVar, "")
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, errors.New("google books: status 503")
	}
	alice.waitJob(alice.mustStart("fill", fill).ID, "succeeded")
	if n := lookupErrors(); n != 1 {
		t.Errorf("a lookup the supplier refused: %d TIP-META-011 error(s), want 1", n)
	}
}
