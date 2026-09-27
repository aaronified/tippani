package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/outbound"
)

// A LOOKUP THE OFFLINE SWITCH REFUSED IS NOT AN ERROR IN THE SERVER'S LOG.
//
// The operator switches the app offline, and a reader goes on using it: looks a
// book up, fills a work's gaps, fetches a person from the People console, one
// row and then as a job. Each lookup is refused by the gate, as it should be, and
// none of them is logged as an error, because the operator asked for exactly
// that and the gate has kept its own line for each. The same lookups failing any
// other way, online, are still errors, each under the code Troubleshooting
// names for it.
//
// Every request goes through the handler as the screens send it, and the log is
// read as System logs reads it (GET /admin/logs, the error level).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue is
// given to the server as serve() gives it (queueing), and olog's sink goes into
// its logbook, as serve() routes it, since no request starts the server; the
// offline switch is TIPPANI_OFFLINE (outbound.EnvVar), set as an operator sets
// it; the book supplier and the author resolver are the server's seams
// (srv.searchBooks, srv.resolveAuthor), replaced for the online half, because a
// test may not reach Google Books or Open Library to be told no; and the TIP
// codes, which are what an operator reads in the log and looks up.
func TestALookupTheOfflineSwitchRefusedIsNotLoggedAsAnError(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	olog.SetSink(func(e olog.Entry) { q.lb.System(e.Level, e.Code, e.Line) })
	t.Cleanup(func() { olog.SetSink(nil) })
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	leGuin := recordID(t, alice, "Ursula K. Le Guin")

	// A reader's lookups, as the screens make them.
	lookUp := func() {
		t.Helper()
		alice.mustDo("POST", "/books/lookup", map[string]any{"title": "Dune"}, http.StatusBadGateway)
		alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": []int64{dune}}).ID, "succeeded")
		alice.mustDo("POST", "/people/id/"+itoa(leGuin)+"/fetch", nil, http.StatusBadGateway)
		alice.waitJob(alice.mustStart("people", map[string]any{"ids": []int64{leGuin}}).ID, "succeeded")
		flushed(t, q.lb)
	}
	// The error lines under each code, counted from a mark: the id of the last
	// line before the lookups.
	codes := []string{"TIP-META-014", "TIP-META-011", "TIP-PEOPLE-003"}
	errorsSince := func(mark int64) map[string]int {
		t.Helper()
		n := map[string]int{}
		for _, l := range alice.logs(url.Values{"level": {"error"}, "limit": {"1000"}}).Lines {
			if l.ID > mark {
				n[l.Code]++
			}
		}
		return n
	}
	newest := func() int64 { return alice.logs(url.Values{"level": {"error,warn,info,request,asset,trace"}}).Upto }

	t.Setenv(outbound.EnvVar, "1")
	mark := newest()
	lookUp()
	offline := errorsSince(mark)
	for _, code := range codes {
		if offline[code] != 0 {
			t.Errorf("offline, %d %s error(s) were logged for lookups the switch refused", offline[code], code)
		}
	}

	// Online, the suppliers say no: that is what the codes are for. A book
	// lookup, a fill's work, and a person's fetch twice, the row's and the job's.
	t.Setenv(outbound.EnvVar, "")
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, errors.New("google books: status 503")
	}
	srv.resolveAuthor = func(context.Context, string, []string) (metadata.AuthorResolution, error) {
		return metadata.AuthorResolution{}, errors.New("open library: status 503")
	}
	mark = newest()
	lookUp()
	online := errorsSince(mark)
	for code, want := range map[string]int{"TIP-META-014": 1, "TIP-META-011": 1, "TIP-PEOPLE-003": 2} {
		if online[code] != want {
			t.Errorf("online, a supplier that said no left %d %s error(s), want %d", online[code], code, want)
		}
	}
}
