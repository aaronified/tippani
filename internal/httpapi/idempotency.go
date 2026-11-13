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
// The same key on a different method or path is a client mistake and is refused (422) rather than answered with
// a response that belongs to another request. Only a success is remembered: a refused or failed request may be
// sent again and succeed.
//
// A key is honoured for a day. That is checked when it is looked up, and the rows past a day are deleted when
// the next one is written, so nothing wakes on a timer. Two requests with the same key in flight at once can both
// run; the second one's answer is not stored. A client that queues its writes sends them one at a time.
func (s *Server) idempotent(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get(idempotencyHeader)
		if key == "" || len(key) > idempotencyMaxKey {
			next(w, r)
			return
		}
		uid := userID(r)
		var method, path, contentType string
		var status int
		var body []byte
		err := s.Store.DB.QueryRow(`SELECT method, path, status, content_type, body FROM idempotency_keys
		                             WHERE user_id = ? AND key = ? AND created_at > datetime('now', '-1 day')`,
			uid, key).Scan(&method, &path, &status, &contentType, &body)
		if err == nil {
			if method != r.Method || path != r.URL.Path {
				writeErr(w, http.StatusUnprocessableEntity, "that Idempotency-Key was used for a different request")
				return
			}
			if contentType != "" {
				w.Header().Set("Content-Type", contentType)
			}
			w.Header().Set("Idempotency-Replayed", "true")
			w.WriteHeader(status)
			_, _ = w.Write(body)
			return
		}

		rec := &recordedResponse{ResponseWriter: w}
		next(rec, r)
		if rec.status < 200 || rec.status >= 300 {
			return
		}
		// A failure to remember is not a failure of the request, which has already been answered.
		_, _ = s.Store.DB.Exec(`DELETE FROM idempotency_keys WHERE created_at <= datetime('now', '-1 day')`)
		_, _ = s.Store.DB.Exec(`INSERT OR REPLACE INTO idempotency_keys (user_id, key, method, path, status, content_type, body)
		                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
			uid, key, r.Method, r.URL.Path, rec.status, w.Header().Get("Content-Type"), rec.body.Bytes())
	}
}
