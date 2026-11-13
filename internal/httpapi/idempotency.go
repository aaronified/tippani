package httpapi

import (
	"bytes"
	"net/http"
)

// idempotencyHeader is the request header a client sets on a write it may send twice (ADR-0933).
const idempotencyHeader = "Idempotency-Key"

// idempotencyMaxKey bounds the key a client may send; a longer one is treated as absent rather than stored.
const idempotencyMaxKey = 100

// recordedResponse copies what a handler writes so it can be stored beside the key.
type recordedResponse struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *recordedResponse) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *recordedResponse) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// idempotent wraps a create handler so a request that repeats an Idempotency-Key gets the first answer again and
// changes nothing. It sits inside requireAuth: the key belongs to the account, and another account's key is
// another key.
//
// THE KEY IS RESERVED BEFORE THE HANDLER RUNS. A phone whose request timed out sends it again while the first may
// still be running; looking the key up and storing the answer afterwards would let both run and make the thing
// twice. So the first request inserts a pending row (status 0), the repeat finds it and is told 409 to try again
// in a moment, and the row becomes the answer when the handler succeeds. A pending row older than two minutes is
// a request that died with the process and is replaced, so a crash does not block a retry for a day.
//
// The same key on a different path is a client mistake and is refused (422) rather than answered with a response
// that belongs to another request. Every wrapped route is a POST, so the path is what tells requests apart. Only a
// success is remembered: a refused or failed request releases its key and may be sent again and succeed. A key
// longer than 100 characters is refused (400) so the client learns it is not protected.
//
// A key is honoured for a day. That is checked when it is looked up, and the rows past a day are deleted when the
// next key is reserved, so nothing wakes on a timer.
func (s *Server) idempotent(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get(idempotencyHeader)
		if key == "" {
			next(w, r)
			return
		}
		if len(key) > idempotencyMaxKey {
			writeErr(w, http.StatusBadRequest, "the Idempotency-Key is at most 100 characters")
			return
		}
		uid := userID(r)
		db := s.Store.DB
		_, _ = db.Exec(`DELETE FROM idempotency_keys WHERE created_at <= datetime('now', '-1 day')`)

		owned := false
		for attempt := 0; attempt < 2 && !owned; attempt++ {
			res, err := db.Exec(`INSERT OR IGNORE INTO idempotency_keys (user_id, key, method, path, status, body)
			                     VALUES (?, ?, ?, ?, 0, x'')`, uid, key, r.Method, r.URL.Path)
			if err != nil {
				// the memory is unavailable: the request is made, unprotected, rather than refused
				next(w, r)
				return
			}
			if n, _ := res.RowsAffected(); n == 1 {
				owned = true
				break
			}
			var path, contentType string
			var status int
			var body []byte
			var pendingFresh bool
			err = db.QueryRow(`SELECT path, status, content_type, body, created_at > datetime('now', '-2 minutes')
			                    FROM idempotency_keys WHERE user_id = ? AND key = ?`, uid, key).
				Scan(&path, &status, &contentType, &body, &pendingFresh)
			if err != nil {
				continue // the row went between the insert and the read: reserve it again
			}
			if path != r.URL.Path {
				writeErr(w, http.StatusUnprocessableEntity, "that Idempotency-Key was used for a different request")
				return
			}
			if status == 0 {
				if pendingFresh {
					w.Header().Set("Retry-After", "2")
					writeErr(w, http.StatusConflict, "that request is still being made; try again in a moment")
					return
				}
				_, _ = db.Exec(`DELETE FROM idempotency_keys WHERE user_id = ? AND key = ? AND status = 0`, uid, key)
				continue
			}
			if contentType != "" {
				w.Header().Set("Content-Type", contentType)
			}
			w.Header().Set("Idempotency-Replayed", "true")
			w.WriteHeader(status)
			_, _ = w.Write(body)
			return
		}
		if !owned {
			next(w, r)
			return
		}

		stored := false
		defer func() {
			// a refusal, a failure or a panic releases the key so the request can be sent again
			if !stored {
				_, _ = db.Exec(`DELETE FROM idempotency_keys WHERE user_id = ? AND key = ? AND status = 0`, uid, key)
			}
		}()
		rec := &recordedResponse{ResponseWriter: w}
		next(rec, r)
		if rec.status < 200 || rec.status >= 300 {
			return
		}
		if _, err := db.Exec(`UPDATE idempotency_keys SET status = ?, content_type = ?, body = ?
		                      WHERE user_id = ? AND key = ?`,
			rec.status, w.Header().Get("Content-Type"), rec.body.Bytes(), uid, key); err == nil {
			stored = true
		}
	}
}
