package httpapi

import (
	"errors"
	"net/http"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// POST /movies/{id}/cast/imdb — fill this work's cast from an IMDb title, once.
//
// WHY IT TAKES AN ID AND NEVER SEARCHES. A title search is where a wrong cast gets
// attached to a right work, and a wrong cast reads as a correct one: the quote form
// then autofills "played by" with an actor from a different game. The reader is
// looking at the IMDb page — they have the URL in their hand — so the id comes from
// them. This endpoint pastes it into no search box and follows no redirect: the URL
// that goes out is built from a `tt\d{7,9}` match (metadata.IMDbTitleID) against a
// constant host.
//
// ONE PASS, AND THE ENDPOINT IS THE PLACE THAT PROMISE LIVES. One request in
// means one request out — there is no preview call and no apply call, because two
// endpoints would be two fetches of the same page, and a "fetch it again to be
// sure" flow is exactly what "IMDb once" rules out. So the reply carries the title
// IMDb answered with (its name and what kind of thing IMDb thinks it is) and the
// reader confirms AFTER the fact, against a cast they can now see and edit.
//
// WHY GAMES ARE THE POINT OF IT. Wikidata is the only structured free source for a
// game's voice cast and it is empty for most games — The Witcher 3, Mass Effect 3,
// Persona 5 and Disco Elysium all return nothing (see igdb_cast.go's measurement).
// IMDb has them. It is offered for films and shows too, because the same gap exists
// wherever TMDB's credits are thin, but the reason it was built is the game.
//
// THE PROVENANCE RULE IS NOT RE-IMPLEMENTED HERE. It merges through
// mergeProviderCast, exactly as TMDB's resync and the unattended fill do, so a row
// the reader typed or corrected keeps its names, a tombstone stays dead, and the
// rows this fetch adds are marked `provider` with `source = 'imdb'`. Everything
// this handler adds is: which work, which id, and one transaction.
//
// ADMIN IS NOT REQUIRED and this is not a settings-gated source. It needs no API
// key, it writes only into the caller's own work, and gating it behind a key nobody
// can obtain would mean building a control that never works. What gates it is that
// nothing calls it unless a person presses it.
func (s *Server) handleCastFromIMDb(w http.ResponseWriter, r *http.Request) {
	workID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		IMDb string `json:"imdb"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	id := metadata.IMDbTitleID(req.IMDb)
	if id == "" {
		// The message names the shape rather than the mistake, because the commonest
		// input here is a URL that IS acceptable and a `nm…` person id that is not.
		writeErr(w, http.StatusBadRequest, "paste an IMDb title link or id (tt…)")
		return
	}
	uid := userID(r)
	// Ownership first, and through the same helper the cast endpoints use: a work
	// that is not this reader's is a 404 before any request leaves the machine. An
	// outbound fetch for a foreign id would be a way to make this server tell you
	// whether a row exists.
	if _, ok := s.castWork(uid, "movie", workID); !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	olog.Tracef("[imdb] cast fetch uid=%v work=%d imdb=%s", uid, workID, id)

	title, cast, err := metadata.IMDbCast(r.Context(), id)
	if err != nil {
		if errors.Is(err, metadata.ErrNoIMDbTitle) {
			writeErr(w, http.StatusNotFound, "IMDb has no title with that id")
			return
		}
		codedError(w, r, olog.CodeIMDbFetch, "imdb cast fetch", err)
		return
	}
	// A TITLE WITH NO CAST IS A NORMAL ANSWER, not an error — the same rule the
	// Wikidata path follows. It is reported as zero added rather than as a failure,
	// because "IMDb lists nobody for this" is a fact the reader wants, and a 500
	// would send them looking for a problem with the app.
	if len(cast) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"title": title, "added": 0, "cast": []castRow{}})
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "imdb: begin", err)
		return
	}
	defer tx.Rollback()
	if err := mergeProviderCast(tx, uid, "movie", workID, "imdb", cast); err != nil {
		codedError(w, r, olog.CodeIMDbFetch, "imdb cast merge", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "imdb: commit", err)
		return
	}
	// The cast as it stands AFTER the merge, which is what the reader has to check
	// — not the list IMDb sent, because the rows they had already corrected are
	// deliberately not the rows IMDb just named.
	rows, err := loadCast(s.Store.DB, "movie", workID)
	if err != nil {
		codedError(w, r, olog.CodeCastRowScan, "imdb: reload cast", err)
		return
	}
	olog.Printf("[imdb] work %d: cast filled from %s (%s), %d row(s) now", workID, id, title.Title, len(rows))
	writeJSON(w, http.StatusOK, map[string]any{"title": title, "added": len(cast), "cast": rows})
}
