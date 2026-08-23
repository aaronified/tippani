package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"tippani/internal/olog"
)

// POST /cast/{id}/image — fetch this character's picture once and serve it from
// here afterwards.
//
// WHY THE APP HOLDS THE BYTES rather than pointing a chip at TheTVDB. The CSP
// already allows artworks.thetvdb.com, so hotlinking would have worked with no
// backend at all — and every quote card that drew a character would have been a
// request from the reader's browser to a third party, naming a title in their
// library. This is a self-hosted app whose whole premise is that the library is
// nobody else's business, and every other image here — covers, posters,
// portraits — is already fetched once and served locally for that reason. A
// hotlink also breaks silently the day the file moves.
//
// ON DEMAND, AND THAT IS THE WHOLE REASON THIS IS A ROUTE. A film's cast is
// twenty rows and a reader quotes two of them; fetching twenty images because a
// title was added would spend twenty requests answering a question nobody asked,
// inside the request that added the title. The portrait pipeline settled this
// already — a person's headshot is resolved when their panel is opened, not when
// their name first appears in a credit — and this follows it.
//
// IDEMPOTENT, AND CHEAP TO CALL AGAIN. A row that already has a stored path is
// returned as-is without a fetch, so a client may call this for every chip it is
// about to draw without thinking about which ones are already local. That is the
// property that lets the caller be dumb, and a caller that has to remember what
// it has already asked for is a caller that gets it wrong.
//
// A ROW WITH NO PROVIDER URL IS NOT AN ERROR. Most roles have no art of their own
// even on TheTVDB, and every TMDB-sourced row has none by definition. The reply is
// the row with an empty path, and the client falls back to the actor's headshot —
// which is what TheTVDB's own site does. A 404 here would make "this role has no
// picture" indistinguishable from "that row is not yours".
func (s *Server) handleCastImage(w http.ResponseWriter, r *http.Request) {
	castID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)

	// Ownership first, and a row belonging to somebody else is a 404 rather than a
	// 403 — the per-user rule this whole API follows, so one reader cannot learn
	// that another reader's row exists.
	kind, workID, origin, _, err := s.castOwner(uid, castID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	case err != nil:
		internalError(w, r, "load cast row", err)
		return
	case origin == castRemoved:
		// A tombstone is not a row; it exists so a refetch can decline to bring a
		// deletion back. Same answer handleUpdateCast gives.
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}
	if _, ok := s.castWork(uid, kind, workID); !ok {
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}

	// Named away from `url` and `path`, which are stdlib package names.
	var srcURL, stored string
	if err := s.Store.DB.QueryRow(
		`SELECT character_image_url, character_image_path FROM work_cast
		 WHERE id = ? AND user_id = ?`, castID, uid,
	).Scan(&srcURL, &stored); err != nil {
		internalError(w, r, "load character image", err)
		return
	}
	if stored != "" || srcURL == "" {
		// Already ours, or the provider never had one. Either way there is nothing
		// to fetch and the answer is the row as it stands.
		s.writeCastRow(w, r, castID, uid)
		return
	}

	name, ferr := s.fetchImage(r.Context(), srcURL, s.coversDir())
	if ferr != nil {
		// The reader loses a picture, not a page: the chip falls back to the
		// actor's headshot and the row keeps its provider URL for the next attempt.
		// Logged with TIP-COVER-001, the code the on-demand cover refetch uses,
		// because it is the same failure: a provider's image host said no.
		olog.Errorf(olog.CodeCoverFetch,
			"[cast] character image cast_id=%d url=%q failed: %v", castID, srcURL, ferr)
		writeErr(w, http.StatusBadGateway, "that character image could not be fetched")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ?, updated_at = datetime('now')
		 WHERE id = ? AND user_id = ?`, name, castID, uid,
	); err != nil {
		internalError(w, r, "store character image", err)
		return
	}
	s.writeCastRow(w, r, castID, uid)
}

// writeCastRow replies with one cast row by id, in the shape every other cast
// read uses. Shared by the two exits above so the success and the nothing-to-do
// paths cannot drift into answering differently.
func (s *Server) writeCastRow(w http.ResponseWriter, r *http.Request, castID, uid int64) {
	c, err := scanCastRow(s.Store.DB.QueryRow(
		`SELECT `+castCols+` FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid))
	if err != nil {
		internalError(w, r, "load cast row", err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}
