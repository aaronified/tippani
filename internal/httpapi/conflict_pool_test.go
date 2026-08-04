package httpapi

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"testing"
	"time"
)

// The duplicate-create path reads the existing row so a retried write is
// idempotent (see writeConflictExisting). The first cut of that read went through
// s.Store.DB while the handler still held its INSERT transaction — which needs a
// SECOND pool connection. store.Open caps the pool at 4, so once those are in use
// the handler blocked waiting for a connection only it could release: the request
// hung until busy_timeout turned it into a 500.
//
// It is reachable over plain HTTP, and by the least exotic client behaviour there
// is — an offline client flushing a queue posts the same captures again.

// TestDuplicatePostUnderPoolPressure pins the deadlock directly: hold all but one
// pool connection, then post a duplicate. The handler must answer promptly rather
// than waiting on a connection it is itself holding.
func TestDuplicatePostUnderPoolPressure(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")
	quote := "Cities, like dreams, are made of desires and fears."
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": quote}, http.StatusCreated)

	// Pin 3 of the 4 connections in open read transactions, leaving exactly one
	// for the handler — enough for its tx, and nothing spare for a second query.
	//
	// ReadOnly matters, and not only for tidiness: the DSN sets _txlock=immediate, so
	// a read-write Begin now takes SQLite's write lock at BEGIN. Three of those cannot
	// coexist, and the pin loop would deadlock against itself instead of testing the
	// handler. ReadOnly gives a plain deferred BEGIN, which is what "pin a connection
	// holding a read" always meant.
	for i := 0; i < 3; i++ {
		tx, err := srv.Store.DB.BeginTx(context.Background(), &sql.TxOptions{ReadOnly: true})
		if err != nil {
			t.Fatalf("pin %d: %v", i, err)
		}
		var n int
		if err := tx.QueryRow(`SELECT count(*) FROM books`).Scan(&n); err != nil {
			t.Fatalf("pin read %d: %v", i, err)
		}
		defer tx.Rollback()
	}

	done := make(chan int, 1)
	go func() {
		rec := c.do("POST", "/annotations", map[string]any{"book_id": bookID, "quote": quote})
		done <- rec.Code
	}()
	select {
	case code := <-done:
		if code != http.StatusConflict {
			t.Fatalf("duplicate POST with a saturated pool: got %d want 409", code)
		}
	case <-time.After(8 * time.Second):
		t.Fatal("duplicate POST wedged: the handler is waiting for a pool connection it holds itself")
	}
}

// TestConcurrentDuplicatePostsAllConflict is the HTTP-only version — no
// artificially pinned connections, just a queue flush racing itself. Every
// response must be a clean 409; a 500 here means the pool or the write lock is
// being contended by a handler holding a transaction it did not need.
func TestConcurrentDuplicatePostsAllConflict(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")
	quote := "Memory's images, once fixed in words, are erased."
	first := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": quote}, http.StatusCreated))

	const n = 8
	codes := make([]int, n)
	bodies := make([]conflictBody, n)
	var wg sync.WaitGroup
	fin := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := c.do("POST", "/annotations", map[string]any{"book_id": bookID, "quote": quote})
			codes[i] = rec.Code
			if rec.Code == http.StatusConflict {
				bodies[i] = decode[conflictBody](t, rec)
			}
		}(i)
	}
	go func() { wg.Wait(); close(fin) }()
	select {
	case <-fin:
	case <-time.After(30 * time.Second):
		t.Fatalf("wedged after 30s, codes so far=%v", codes)
	}

	// Every one of these must be a clean 409. This used to tolerate a 500 and count
	// it, because concurrent writers really did get SQLITE_BUSY back immediately —
	// the busy_timeout of 5000 was never consulted. The cause was the lock order,
	// not the pool: a DEFERRED transaction that reads before it writes has to upgrade
	// its read lock, and SQLite fails that upgrade instantly rather than risk a
	// deadlock. store.openDB now opens with _txlock=immediate, so the write lock is
	// taken at BEGIN and a second writer waits its turn like it was always meant to.
	//
	// Nothing here is allowed to be flaky-tolerant any more. A 500 in this loop is a
	// regression in that DSN, and it should say so.
	for i, code := range codes {
		switch code {
		case http.StatusConflict:
			if bodies[i].Existing.ID != first.ID {
				t.Errorf("request %d resolved to id %d, want the original %d",
					i, bodies[i].Existing.ID, first.ID)
			}
		case http.StatusInternalServerError:
			t.Errorf("request %d got a 500: concurrent writes are contending again — "+
				"check that store.openDB still sets _txlock=immediate", i)
		default:
			t.Errorf("request %d: got %d, want 409", i, code)
		}
	}

	// And nothing was written twice.
	var total int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM annotations`).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != 1 {
		t.Fatalf("%d annotations after 8 concurrent duplicate posts, want 1", total)
	}
}

// Same shape for dialogues, which share the contract.
func TestConcurrentDuplicateDialoguePostsAllConflict(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID
	quote := "Let everything that has been planned come true."
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movieID, "quote": quote}, http.StatusCreated)

	const n = 8
	codes := make([]int, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			codes[i] = c.do("POST", "/dialogues", map[string]any{"movie_id": movieID, "quote": quote}).Code
		}(i)
	}
	wg.Wait()
	conflicts := 0
	for i, code := range codes {
		switch code {
		case http.StatusConflict:
			conflicts++
		case http.StatusInternalServerError:
			// This is the one that reproduced most readily before _txlock=immediate.
			t.Errorf("request %d got a 500: concurrent writes are contending again — "+
				"check that store.openDB still sets _txlock=immediate", i)
		default:
			t.Errorf("request %d: got %d, want 409", i, code)
		}
	}
	if conflicts != n {
		t.Fatalf("%d/%d requests reached the conflict path, want all of them", conflicts, n)
	}
}
