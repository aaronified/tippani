package httpapi

import (
	"net/http"
	"strconv"
)

// Shared LIMIT/OFFSET handling for the four list endpoints a client mirrors:
// books, movies, annotations, dialogues.
//
// Both parameters are optional and absent by default, so the SPA — which sends
// neither — keeps receiving the whole list exactly as before. They exist for
// clients that cannot hold the whole library in memory at once, which is every
// phone with a large enough library.

// maxListLimit caps a single page. Generous, because the caller paging through
// a personal library wants few round trips, not tiny pages; bounded, because an
// unbounded limit is just the old behaviour with extra steps.
const maxListLimit = 1000

// applyPaging appends LIMIT/OFFSET to q and its arguments, validating both
// parameters. It writes a 400 and returns false on bad input.
//
// SQLite has no bare OFFSET, so an offset without a limit is expressed as
// "LIMIT -1 OFFSET n" — -1 meaning unbounded.
func applyPaging(w http.ResponseWriter, r *http.Request, q *string, args *[]any) bool {
	limit, hasLimit, ok := intParam(w, r, "limit", 1, maxListLimit)
	if !ok {
		return false
	}
	offset, hasOffset, ok := intParam(w, r, "offset", 0, 1<<31)
	if !ok {
		return false
	}
	switch {
	case hasLimit && hasOffset:
		*q += ` LIMIT ? OFFSET ?`
		*args = append(*args, limit, offset)
	case hasLimit:
		*q += ` LIMIT ?`
		*args = append(*args, limit)
	case hasOffset:
		*q += ` LIMIT -1 OFFSET ?`
		*args = append(*args, offset)
	}
	return true
}

// intParam reads an optional non-negative integer query parameter, bounded to
// [min, max]. Returns (value, present, ok); on a bad value it writes the 400
// and returns ok=false.
func intParam(w http.ResponseWriter, r *http.Request, name string, min, max int) (value int, present, ok bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return 0, false, true
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < min || n > max {
		writeErr(w, http.StatusBadRequest,
			name+" must be an integer between "+strconv.Itoa(min)+" and "+strconv.Itoa(max))
		return 0, false, false
	}
	return n, true, true
}
