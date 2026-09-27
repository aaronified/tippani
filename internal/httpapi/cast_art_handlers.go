package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"tippani/internal/olog"
)

// POST /books/{id}/cast/art and POST /movies/{id}/cast/art {names} →
// {character_images, portraits}: THE PICTURES A WORK PAGE IS ABOUT TO DRAW, IN ONE
// REQUEST.
//
// A film's page used to fetch them itself, one request a picture, from three
// loops: the Details panel's cast list and the film's board each asked
// POST /cast/{id}/image for every role with a provider picture and no file, and
// the board and the panel each asked POST /people/portrait for every actor with
// no headshot. Twenty roles and twenty actors were forty requests, and every one
// of them was an outbound call a reader could not see. Now the page sends the
// names it is about to draw and this fetches, serially, the work's pending
// character pictures and those names' pending headshots, in its request — as
// fast as the loops were, and kept in Settings › Jobs as one lookup.cast-art with
// a line for every call it made (the outbound hook).
//
// THE SAME CAPS AS THE LOOPS: twenty roles and twenty names, metadata.maxCast,
// the largest cast a supplier seed can be — a self-hosted box should not open
// forty connections because somebody opened a film.
//
// A NAME THAT ALREADY HAS A HEADSHOT IS SKIPPED, whatever the page sends: the page
// may send names before its own map of who has a picture has loaded, and asking
// again for a headshot the reader already has would be a lookup for nothing.
//
// THE KIND OF HEADSHOT IS THE ONE THE LOOPS ASKED FOR. A film's surfaces asked as
// actor (a game's voice cast included: its credits are the same cast rows). A
// book's asked for none — a book has characters, not a cast, and the panel's
// loop was handed no kind for one — so a book's names are not looked up here
// either, and a book page asks only when a role has a picture to fetch.
//
// WITHIN ABOUT FORTY-FIVE SECONDS. The server gives a response sixty seconds to
// be written (cmd/tippani), and a pass over forty slow suppliers could take
// longer; the write deadline is cleared, as the backup does, and the pass stops
// starting fetches once the budget is spent and answers with what arrived. The
// page asks again next time it is opened.
//
// THE BUDGET IS THE REQUEST'S, NOT A PASS'S. It is set once, when the request
// arrives, and everything the request does spends it: the pass it runs, the
// pass it waits on, and the pass for its own names after that. Each pass
// setting its own would let a request that joins another wait out the first
// pass whole and then spend a budget of its own — twice the budget and a fetch,
// behind a proxy that gives up at sixty seconds a 504, and a page that never
// re-reads the pictures that did arrive.
//
// ONE PASS AT A TIME PER READER AND WORK. The film's board and its Details panel
// draw the same faces, and a parent's refetch re-runs a surface's effect while
// its request is still out, so the same work is asked for twice at once. The
// second request joins the first rather than starting a second set of outbound
// calls for the same rows: it waits, answers what the first found, and then asks
// for any of its names the first did not carry. If the first request ended before
// its pass did (its reader closed the tab), the second runs the pass itself.
// Nothing outlives a request: the pass runs in the first request's own
// goroutine, and a waiter gives up when its own request ends or its budget is
// spent — answering, then, what the pass it waited on has fetched so far.

const (
	castArtRoles = 20 // character pictures one pass fetches, as the cast panel's loop capped them
	castArtNames = 20 // headshots one pass looks up, as usePortraitFill capped them
)

// castArtBudget is how long a request keeps starting fetches and waiting on
// another's. A variable so the tests that spend it need not wait forty-five
// seconds.
var castArtBudget = 45 * time.Second

func (s *Server) handleCastArt(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req struct {
			Names []string `json:"names"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		uid := userID(r)
		// A work that is not this reader's is a 404 before anything leaves the
		// machine, as every cast route answers one.
		if _, ok := s.castWork(uid, kind, workID); !ok {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		jobSubject(r.Context(), s.workTitle(uid, kind, workID))
		_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
		deadline := time.Now().Add(castArtBudget)
		got := s.castArt(r.Context(), castArtKey{uid, kind, workID}, castArtAsked(kind, req.Names), deadline)
		writeJSON(w, http.StatusOK, map[string]any{"character_images": got.images, "portraits": got.portraits})
	}
}

// castArtAsked is the names a work's pass looks headshots up for: trimmed, each
// once, at most castArtNames of them — and none for a book (see the header).
func castArtAsked(kind string, names []string) []string {
	if kind == "book" {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
		if len(out) == castArtNames {
			break
		}
	}
	return out
}

// castArtKey is which pass a request is for: one reader's one work.
type castArtKey struct {
	uid  int64
	kind string
	id   int64
}

// castArtCount is what arrived.
type castArtCount struct{ images, portraits int }

func (a castArtCount) plus(b castArtCount) castArtCount {
	return castArtCount{a.images + b.images, a.portraits + b.portraits}
}

// castArtFlight is a pass in progress, which a second request for the same work
// joins.
type castArtFlight struct {
	names map[string]bool // what the pass was asked for
	done  chan struct{}   // closed when it has ended, cut set
	// images and portraits are what has arrived so far, counted as each lands,
	// so a request that stops waiting before the pass ends can say what it
	// fetched: the page re-reads its pictures only when an answer says some
	// arrived.
	images, portraits atomic.Int64
	// cut is whether the pass did not finish: its request ended first, or it
	// panicked.
	cut bool
	// waiting is how many requests have joined it. Nothing reads it but the
	// tests that have to know a second request is waiting before they let the
	// first go on.
	waiting int
}

// got is what the pass has fetched so far; all of it, once done is closed.
func (f *castArtFlight) got() castArtCount {
	return castArtCount{int(f.images.Load()), int(f.portraits.Load())}
}

// castArtFlights is every pass in progress. Its zero value is ready.
type castArtFlights struct {
	mu sync.Mutex
	m  map[castArtKey]*castArtFlight
}

// join is the pass in progress for key, or a new one that the caller leads.
func (fl *castArtFlights) join(key castArtKey, names []string) (f *castArtFlight, lead bool) {
	fl.mu.Lock()
	defer fl.mu.Unlock()
	if f := fl.m[key]; f != nil {
		f.waiting++
		return f, false
	}
	if fl.m == nil {
		fl.m = map[castArtKey]*castArtFlight{}
	}
	f = &castArtFlight{names: map[string]bool{}, done: make(chan struct{})}
	for _, n := range names {
		f.names[n] = true
	}
	fl.m[key] = f
	return f, true
}

// land ends a pass: the next request for its work starts a new one.
func (fl *castArtFlights) land(key castArtKey, f *castArtFlight) {
	fl.mu.Lock()
	delete(fl.m, key)
	fl.mu.Unlock()
	close(f.done)
}

// castArt runs, or joins, the pass for key and answers what arrived, starting no
// fetch after deadline and waiting on no other request's pass past it.
func (s *Server) castArt(ctx context.Context, key castArtKey, names []string, deadline time.Time) castArtCount {
	var total castArtCount
	for {
		f, lead := s.castArtFlights.join(key, names)
		if lead {
			s.leadCastArt(ctx, key, f, names, deadline)
			return total.plus(f.got())
		}
		spent := time.NewTimer(time.Until(deadline))
		select {
		case <-f.done:
			spent.Stop()
		case <-ctx.Done():
			spent.Stop()
			return total
		case <-spent.C:
			// The pass it joined has outlasted this request's budget. What that
			// pass has fetched is on the reader's rows already, and the answer
			// says so; the rest arrives for whoever opens the page next.
			return total.plus(f.got())
		}
		total = total.plus(f.got())
		if !f.cut {
			// What the first pass was not asked for is still to ask.
			var rest []string
			for _, n := range names {
				if !f.names[n] {
					rest = append(rest, n)
				}
			}
			if len(rest) == 0 {
				return total
			}
			names = rest
		}
		if ctx.Err() != nil {
			return total
		}
	}
}

// leadCastArt runs the pass f stands for and lands it, however the pass ends. A
// pass that panics is landed all the same, and as cut: net/http recovers the
// request and the server goes on, and a pass left in the table would keep every
// later request for the work waiting on a channel nothing closes. Cut, the
// requests waiting on it run the pass themselves.
func (s *Server) leadCastArt(ctx context.Context, key castArtKey, f *castArtFlight, names []string, deadline time.Time) {
	f.cut = true
	defer s.castArtFlights.land(key, f)
	f.cut = s.fetchCastArt(ctx, key, names, deadline, f)
}

// fetchCastArt is one pass: the work's pending character pictures, then the
// pending headshots of names, one at a time, until deadline, each counted on f
// as it lands. cut says the request ended first.
func (s *Server) fetchCastArt(ctx context.Context, key castArtKey, names []string, deadline time.Time, f *castArtFlight) (cut bool) {
	another := func() bool {
		if ctx.Err() != nil {
			cut = true
			return false
		}
		return time.Now().Before(deadline)
	}
	rows, err := loadCast(s.Store.DB, key.kind, key.id)
	if err != nil {
		olog.Warnf(olog.CodeCastArt, "[cast] pictures for %s %d: the cast could not be read: %v", key.kind, key.id, err)
	}
	pending := 0
	for _, c := range rows {
		if c.CharacterImageURL == "" || c.CharacterImagePath != "" {
			continue
		}
		pending++
		if pending > castArtRoles || !another() {
			break
		}
		fetched, err := s.fetchCastImage(ctx, key.uid, c.ID)
		switch {
		case err == nil && fetched:
			f.images.Add(1)
		case err != nil && !errors.Is(err, errCastImageFetch):
			// A failed download is logged where it failed; this is the database.
			olog.Warnf(olog.CodeCastArt, "[cast] picture for cast row %d: %v", c.ID, err)
		}
	}
	for _, name := range names {
		if s.hasHeadshot(key.uid, name) {
			continue
		}
		if !another() {
			return cut
		}
		found, err := s.portraitByName(ctx, key.uid, "actor", name)
		if err != nil {
			if _, lookup := asRefusal(err); !lookup {
				olog.Warnf(olog.CodeCastArt, "[cast] headshot for %q: %v", name, err)
			}
			continue
		}
		if found.image != "" {
			f.portraits.Add(1)
		}
	}
	return cut
}

// hasHeadshot is whether the record a headshot for name would be written onto
// (the lowest id of that name, as POST /people/portrait writes) already has one.
func (s *Server) hasHeadshot(uid int64, name string) bool {
	var image string
	err := s.Store.DB.QueryRow(`SELECT image_path FROM people WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`,
		uid, name).Scan(&image)
	return err == nil && image != ""
}
