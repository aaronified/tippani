package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// POST /movies/{id}/cast/tvdb — re-pull this title's cast from TheTVDB, on
// demand, in one request.
//
// WHY IT HAS TO EXIST SEPARATELY FROM THE RESYNC. TheTVDB's extended record is
// the only source in this app that carries an image PER ROLE — the character in
// costume rather than the actor's headshot — and until now the only way to get it
// was `PUT /movies/{id}` with a source and a source id, which re-pulls the
// poster, the genres, the overview and the release year along with the cast. That
// is the right control for "this record is wrong" and the wrong one for "this
// record is fine, its cast is thin": a reader who has corrected a title's year by
// hand will not press a button that offers to take it back, so they never get the
// character art either. 2.2.0's one-time pass exists precisely because upgraded
// libraries are pinned to TMDB and see none of this; it flags the titles, and this
// is the control it was flagging them FOR.
//
// ONE REQUEST, AND NO SEARCH. The id comes from the row — `movies.tvdb_id`, which
// the reader can already see and edit in the Details panel — so nothing here
// guesses which title this is. A title with no TheTVDB id is refused with a
// message saying so rather than searched for: a search is where the wrong cast
// gets attached to the right work, and a wrong cast reads as a correct one because
// the capture form then autofills "played by" from it. Same argument, in the same
// words, as the IMDb route's.
//
// The extended payload carries the characters, the actors, their TheTVDB person
// ids, the headshots AND the per-role art in the one response, so this is a single
// GET and no follow-up. The images themselves are still fetched lazily, per chip,
// by POST /cast/{id}/image — twenty roles is twenty files and a reader quotes two.
//
// THE PROVENANCE RULE IS NOT RE-IMPLEMENTED. It merges through mergeProviderCast
// like every other fetch, so a row the reader typed or corrected keeps its names,
// a tombstone stays dead, and the rows this adds are marked `provider` with
// `source = 'tvdb'`.
func (s *Server) handleCastFromTVDB(w http.ResponseWriter, r *http.Request) {
	workID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	// Ownership before anything leaves the machine, through the same helper the
	// cast endpoints use. An outbound fetch for a foreign id would be a way to make
	// this server tell you whether somebody else's row exists.
	if _, ok := s.castWork(uid, "movie", workID); !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	var tvdbID int64
	var mediaType string
	if err := s.Store.DB.QueryRow(
		`SELECT COALESCE(tvdb_id, 0), COALESCE(media_type, 'movie') FROM movies
		 WHERE id = ? AND user_id = ?`, workID, uid,
	).Scan(&tvdbID, &mediaType); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		internalError(w, r, "tvdb cast: load work", err)
		return
	}
	if tvdbID == 0 {
		// 409 rather than 400: the request is well formed and the row is not ready.
		// The message names the fix, because the field it names is on the same panel
		// as the button that produced this.
		writeErr(w, http.StatusConflict, "this title has no TheTVDB id — set one, or use Look up to match it first")
		return
	}
	client, _ := s.resolveTVDB()
	if client == nil {
		// The same 503 every TheTVDB path gives with no key: it is a configuration
		// answer, not a failure of this request.
		writeErr(w, http.StatusServiceUnavailable, "no TheTVDB key configured")
		return
	}

	id := strconv.FormatInt(tvdbID, 10)
	olog.Tracef("[tvdb] cast fetch uid=%v work=%d tvdb=%s media=%s", uid, workID, id, mediaType)
	// A show's record lives under /series and a film's under /movies, and asking the
	// wrong one 404s. `media_type` is the row's own answer; a game never has a
	// TheTVDB id, so it is refused above by having none rather than by a branch here.
	var d *metadata.MovieDetails
	var err error
	if mediaType == "show" {
		d, err = client.SeriesDetails(r.Context(), id)
	} else {
		d, err = client.MovieDetails(r.Context(), id)
	}
	if err != nil {
		codedError(w, r, olog.CodeTVDBCastFetch, "tvdb cast fetch", err)
		return
	}

	// A RECORD WITH NO CAST IS A NORMAL ANSWER, not an error — the same rule the
	// IMDb and Wikidata paths follow. TheTVDB's coverage of minor films is thin,
	// and "TheTVDB lists nobody for this" is a fact the reader wants rather than a
	// problem with the app.
	if len(d.Cast) == 0 {
		rows, lerr := loadCast(s.Store.DB, "movie", workID)
		if lerr != nil {
			codedError(w, r, olog.CodeCastRowScan, "tvdb: reload cast", lerr)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"title": d.Title, "added": 0, "cast": rows})
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "tvdb cast: begin", err)
		return
	}
	defer tx.Rollback()
	if err := mergeProviderCast(tx, uid, "movie", workID, "tvdb", d.Cast); err != nil {
		codedError(w, r, olog.CodeTVDBCastFetch, "tvdb cast merge", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "tvdb cast: commit", err)
		return
	}
	// The cast as it stands AFTER the merge, which is what the reader has to check —
	// not the list TheTVDB sent, because the rows they had already corrected are
	// deliberately not the rows TheTVDB just named.
	rows, err := loadCast(s.Store.DB, "movie", workID)
	if err != nil {
		codedError(w, r, olog.CodeCastRowScan, "tvdb: reload cast", err)
		return
	}
	olog.Printf("[tvdb] work %d: cast filled from tvdb %s (%s), %d row(s) now", workID, id, d.Title, len(rows))
	writeJSON(w, http.StatusOK, map[string]any{"title": d.Title, "added": len(d.Cast), "cast": rows})
}
