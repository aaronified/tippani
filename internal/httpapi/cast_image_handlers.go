package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

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
//
// A READER'S OWN PICTURE COMES THROUGH THIS SAME ROUTE, and that is the point of
// the optional body rather than a second endpoint. Send {"image_url": "..."} and
// those bytes are fetched and stored in the same column, so nothing downstream can
// tell a reader's choice from a provider's: one chip, one fallback, one field to
// read. A role a provider has never heard of — a reader-authored cast row on a
// game, or a book's character — gets a picture by exactly the mechanism TheTVDB's
// rows do.
//
// TWO DIFFERENCES, BOTH DELIBERATE. A body REPLACES an existing picture, where the
// no-body call declines to: the empty call is a chip saying "make sure this is
// local", and a reader typing a URL is somebody choosing. And what they choose
// survives every later refetch for free, because a stored path is not a provider
// fact — 0049's merge takes back `character_image_url` and never touches the path
// beside it. That asymmetry is what makes "fetched and reader-provided work the
// same way" true after the second fetch as well as the first.
func (s *Server) handleCastImage(w http.ResponseWriter, r *http.Request) {
	castID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)

	// An absent body is the ordinary "make this local if it is not already" call,
	// so a decode failure must not be fatal: the chips send no body at all.
	var req castImageReq
	if r.ContentLength > 0 && !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}

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
	var character string
	if s.Store.DB.QueryRow(`SELECT character FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&character) == nil {
		jobSubject(r.Context(), character)
	}

	if req.ImageURL != "" {
		// The reader chose this one. It replaces whatever is there, provider or not.
		//
		// TWO FETCHERS, AND PICKING THE WRONG ONE BREAKS THE FEATURE QUIETLY.
		// fetchImage enforces the provider host allowlist (metadata.coverHosts),
		// which is right for a URL TheTVDB supplied and wrong for one a reader
		// typed — their picture is wherever they found it, and an allowlist would
		// refuse it with a message about a fetch failure. fetchUserImage is the
		// no-allowlist path the person form already uses for exactly this, with the
		// same size and format checks. So provenance chooses, and this is the one
		// place the two paths differ.
		err = s.storeCastImage(r.Context(), uid, castID, req.ImageURL, s.fetchUserImage)
	} else {
		// Already ours, or the provider never had one: nothing to fetch, and the
		// answer is the row as it stands.
		_, err = s.fetchCastImage(r.Context(), uid, castID)
	}
	switch {
	case errors.Is(err, errCastImageFetch):
		// The reader loses a picture, not a page: the chip falls back to the
		// actor's headshot and the row keeps its provider URL for the next attempt.
		writeErr(w, http.StatusBadGateway, errCastImageFetch.Error())
		return
	case err != nil:
		internalError(w, r, "character image", err)
		return
	}
	s.writeCastRow(w, r, castID, uid)
}

// errCastImageFetch is a character picture whose download failed; the cause is
// logged where it failed.
var errCastImageFetch = errors.New("that character image could not be fetched")

// fetchCastImage makes cast row castID's provider picture ours: fetched once,
// through the provider host allowlist, and stored on the row. fetched is false
// when there was nothing to fetch — the row already has its file, or its
// provider has no picture for the role. The caller has checked that the row is
// uid's and not a tombstone: POST /cast/{id}/image checks the one row, and a work
// page's pictures (POST /{books|movies}/{id}/cast/art) check the work.
func (s *Server) fetchCastImage(ctx context.Context, uid, castID int64) (fetched bool, err error) {
	// Named away from `url` and `path`, which are stdlib package names.
	var srcURL, stored string
	if err := s.Store.DB.QueryRow(
		`SELECT character_image_url, character_image_path FROM work_cast
		 WHERE id = ? AND user_id = ?`, castID, uid,
	).Scan(&srcURL, &stored); err != nil {
		return false, fmt.Errorf("load character image: %w", err)
	}
	if stored != "" || srcURL == "" {
		return false, nil
	}
	return true, s.storeCastImage(ctx, uid, castID, srcURL, s.fetchImage)
}

// storeCastImage fetches srcURL with fetch and stores it as cast row castID's
// picture. A failed download is errCastImageFetch.
func (s *Server) storeCastImage(ctx context.Context, uid, castID int64, srcURL string,
	fetch func(ctx context.Context, rawURL, destDir string) (string, error)) error {
	name, ferr := fetch(ctx, srcURL, s.coversDir())
	if ferr != nil {
		// Logged with TIP-COVER-001, the code the on-demand cover refetch uses,
		// because it is the same failure: a provider's image host said no.
		olog.Errorf(olog.CodeCoverFetch,
			"[cast] character image cast_id=%d url=%q failed: %v", castID, srcURL, ferr)
		return errCastImageFetch
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE work_cast SET character_image_path = ?, updated_at = datetime('now')
		 WHERE id = ? AND user_id = ?`, name, castID, uid,
	); err != nil {
		return fmt.Errorf("store character image: %w", err)
	}
	return nil
}

// castImageReq is the optional body: a picture the reader has chosen for this
// role, given as a URL the way a person's portrait is given one.
//
// A URL, WHICH IS ONE OF THE TWO WAYS A READER'S PICTURE ARRIVES. The person form
// takes `image_url` and the server fetches it, so the fetch, the size cap and the
// format check are one code path for provider art and reader art alike — and that
// shared path is most of what "work the exact same way" means in practice.
//
// The other way is a file from the reader's machine, which this route does not
// take: `POST /cast/{id}/image/upload` does (picture_upload.go), because a
// multipart body and a JSON body cannot share a decoder. Both end at the same
// column, which is the property that matters downstream — nothing that draws a
// chip can tell a fetched picture from an uploaded one.
type castImageReq struct {
	ImageURL string `json:"image_url"`
}

// maxCastImageURL is the practical ceiling browsers and proxies agree on for a
// URL. A cap rather than no cap because this string is stored nowhere but is
// handed to a fetcher, and an unbounded one is a pointless thing to accept.
const maxCastImageURL = 2048

func (q *castImageReq) validate() string {
	q.ImageURL = strings.TrimSpace(q.ImageURL)
	if q.ImageURL == "" {
		return ""
	}
	if len(q.ImageURL) > maxCastImageURL {
		return "that image address is too long"
	}
	// http(s) only, and named rather than left to the fetcher: a file:// or data:
	// URL would be read by the SERVER, from the server's own disk, on behalf of
	// whoever typed it.
	if !strings.HasPrefix(q.ImageURL, "http://") && !strings.HasPrefix(q.ImageURL, "https://") {
		return "an image address must start with http:// or https://"
	}
	return ""
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
