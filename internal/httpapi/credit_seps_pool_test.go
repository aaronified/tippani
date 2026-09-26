package httpapi

import (
	"net/http"
	"testing"
	"time"

	"tippani/internal/store"
)

// AN EDIT HOLDS ONE DATABASE CONNECTION, NOT TWO.
//
// Saving a quote writes its speaker and cast links inside a transaction, and
// those need the reader's credit separators, a preference. The preference was
// read through the pool while the transaction held a connection, so every such
// save needed two at once. Four saves at once hold all four of the pool's
// connections and each waits for a fifth, with no timeout: the state issue #40
// describes, reached by ordinary use. The read now goes through the transaction.
//
// WHAT IT KNOWS, declared: the pool, through store.HoldEveryConnectionForTest,
// which it holds full but for one connection. Nothing a reader can do puts a
// live server there on purpose, and it is exactly the state in which a handler
// that asks for a second connection inside its transaction waits for ever.
func TestAnEditToADialogueLineNeedsOneConnection(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated))
	line := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything that has been planned come true.",
		"character": "Stalker", "actor": "Alexander Kaidanovsky",
	}, http.StatusCreated))

	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)
	_ = held[0].Close() // one connection free, which is all a save should need

	done := make(chan int, 1)
	go func() {
		rec := c.do("PUT", "/dialogues/"+itoa(line.ID), map[string]any{
			"quote":     "Let everything that has been planned come true.",
			"character": "The Stalker", "actor": "Alexander Kaidanovsky",
		})
		done <- rec.Code
	}()
	select {
	case code := <-done:
		if code != http.StatusOK {
			t.Fatalf("saving the line with one connection free: got %d, want 200", code)
		}
	case <-time.After(8 * time.Second):
		store.ReleaseForTest(held[1:])
		<-done
		t.Fatal("saving a dialogue line waited over 8s with one connection free: something inside its transaction asked the pool for a second")
	}
}
