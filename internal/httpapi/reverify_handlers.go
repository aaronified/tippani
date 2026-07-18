package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// Force-fetch & re-verify (ROADMAP §2): a deliberate "re-check everything"
// pass over a SELECTION of books, movies/shows and saved people. The preview
// (POST /metadata/reverify) re-runs each item's lookup against the live
// sources — targeting the PINNED identity ids (isbn/asin/google_id,
// tmdb_id/tvdb_id, people.source_id / the stored cast) so it re-checks the
// same entity instead of re-guessing by name — and returns per-field diffs
// WITHOUT writing anything. The apply (POST /metadata/reverify/apply) writes
// only the fields the user approved, resending the previewed values (the same
// trust boundary as the existing PUT edit surface: whitelisted fields, the
// same validators, ownership-scoped SQL).
//
// Stateless by design: no server-side diff session — the client holds the
// preview and sends back exactly what the user saw and ticked. requireAuth
// (not admin): both endpoints touch only the caller's own rows, like
// /books/lookup and /people/portrait; the per-call item cap bounds provider
// load. The client slices a large selection into small sequential batches and
// drives a progress bar, reusing the covers-refetch loop shape.

// maxReverifyItems caps one preview/apply call. The client chunks above this.
const maxReverifyItems = 15

type fieldDiff struct {
	Field  string `json:"field"`
	Stored any    `json:"stored"`
	Fresh  any    `json:"fresh"`
}

// reverifyItem statuses: "ok" (checked; Diffs empty = up to date),
// "unpinned" (no identity id to target — use Look up to pin it first),
// "fetch_failed" (the provider call failed; Error carries a short hint),
// "not_found" (not the caller's row — indistinguishable from missing).
type reverifyItem struct {
	Type   string      `json:"type"` // "book" | "movie" | "person"
	ID     int64       `json:"id,omitempty"`
	Kind   string      `json:"kind,omitempty"` // person only: author | actor
	Name   string      `json:"name,omitempty"` // person only
	Title  string      `json:"title,omitempty"`
	Status string      `json:"status"`
	Source string      `json:"source,omitempty"` // which provider answered
	Diffs  []fieldDiff `json:"diffs"`
	Error  string      `json:"error,omitempty"`
}

// handleMetadataReverify: POST /metadata/reverify
// {book_ids?, movie_ids?, people?: [{kind,name}]} → {items, checked, changed}.
// Read-only: nothing is written; the client presents the diffs for approval.
func (s *Server) handleMetadataReverify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
		People   []struct {
			Kind string `json:"kind"`
			Name string `json:"name"`
		} `json:"people"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	total := len(req.BookIDs) + len(req.MovieIDs) + len(req.People)
	if total == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to re-verify — pass book_ids, movie_ids or people")
		return
	}
	if total > maxReverifyItems {
		writeErr(w, http.StatusBadRequest, "too many items per call (max 15) — send smaller batches")
		return
	}
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataReverify uid=%d books=%d movies=%d people=%d",
		uid, len(req.BookIDs), len(req.MovieIDs), len(req.People))

	gkey, gErr := s.Store.GetSetting(settingGoogleBooksKey)
	cookie, cErr := s.Store.GetSetting(settingAmazonCookie)
	domain, dErr := s.Store.GetSetting(settingAmazonDomain)
	for _, err := range []error{gErr, cErr, dErr} {
		if err != nil {
			olog.Warnf(olog.CodeMetaKeyRead, "[meta] provider key read failed: %v", err)
		}
	}
	tmdb, _ := s.resolveTMDB()
	tvdb, _ := s.resolveTVDB()

	ctx := r.Context()
	items := []reverifyItem{}
	for _, id := range req.BookIDs {
		items = append(items, s.reverifyBook(ctx, uid, id, gkey, cookie, domain))
	}
	for _, id := range req.MovieIDs {
		items = append(items, s.reverifyMovie(ctx, uid, id, tmdb, tvdb))
	}
	for _, p := range req.People {
		items = append(items, s.reverifyPerson(ctx, uid, strings.TrimSpace(p.Kind), strings.TrimSpace(p.Name)))
	}
	changed := 0
	for _, it := range items {
		if it.Status == "ok" && len(it.Diffs) > 0 {
			changed++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "checked": len(items), "changed": changed})
}

// itemGenreNames reads ONE item's stored genre names (kind = "book" |
// "movie"); empty on any error — a genre read miss must not fail a preview.
// (genreNames in book_handlers.go is the all-items map for list endpoints.)
func (s *Server) itemGenreNames(kind string, id int64) []string {
	out := []string{}
	rows, err := s.Store.DB.Query(
		`SELECT g.name FROM `+kind+`_genres x JOIN genres g ON g.id = x.genre_id
		 WHERE x.`+kind+`_id = ? ORDER BY g.name`, id)
	if err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre read failed: %v", err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre row scan failed: %v", err)
			continue
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre row iteration failed: %v", err)
	}
	return out
}

// diffStr appends a diff when the fresh string is non-empty and differs.
func diffStr(diffs []fieldDiff, field, stored, fresh string) []fieldDiff {
	fresh = strings.TrimSpace(fresh)
	if fresh == "" || fresh == strings.TrimSpace(stored) {
		return diffs
	}
	return append(diffs, fieldDiff{Field: field, Stored: strings.TrimSpace(stored), Fresh: fresh})
}

// sameGenreSet compares genre lists case-insensitively as sets.
func sameGenreSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]bool, len(a))
	for _, g := range a {
		set[strings.ToLower(strings.TrimSpace(g))] = true
	}
	for _, g := range b {
		if !set[strings.ToLower(strings.TrimSpace(g))] {
			return false
		}
	}
	return true
}

// reverifyLookupError turns a provider failure into a short, non-leaking hint
// (the full cause goes to the log under TIP-META-011).
func reverifyLookupError(what string, err error) string {
	olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify %s lookup failed: %v", what, err)
	if errors.Is(err, metadata.ErrQuota) {
		return "Google Books' shared quota is used up — add a free key in Settings → Metadata sources"
	}
	return "lookup failed — try again in a moment"
}

func (s *Server) reverifyBook(ctx context.Context, uid, id int64, gkey, cookie, domain string) reverifyItem {
	it := reverifyItem{Type: "book", ID: id, Status: "ok", Diffs: []fieldDiff{}}
	var title, author, isbn, asin, googleID, desc, series, cover, rawMeta string
	var year int
	var seriesIdx float64
	err := s.Store.DB.QueryRow(`
		SELECT title, COALESCE(author,''), COALESCE(isbn,''), COALESCE(asin,''), COALESCE(google_id,''),
		       COALESCE(description,''), COALESCE(published_year,0), COALESCE(series,''),
		       COALESCE(series_index,0), COALESCE(cover_path,''), COALESCE(source_metadata,'')
		FROM books WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&title, &author, &isbn, &asin, &googleID, &desc, &year, &series, &seriesIdx, &cover, &rawMeta)
	if errors.Is(err, sql.ErrNoRows) {
		it.Status = "not_found"
		return it
	}
	if err != nil {
		olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify book %d read failed: %v", id, err)
		it.Status, it.Error = "fetch_failed", "could not read this book — try again"
		return it
	}
	it.Title = title
	genres := s.itemGenreNames("book", id)

	// Identity ladder — the pinned id decides which live source answers.
	// (openlibrary_id alone is deliberately not re-checked: OL work records
	// have poor field parity, so an OL-only book reads as unpinned.)
	isbnN := metadata.NormalizeISBN(isbn)
	var cand *metadata.BookCandidate
	switch {
	case isbnN != "":
		cs, lerr := s.searchBooks(ctx, isbnN, "", "", gkey)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book isbn", lerr)
			return it
		}
		if len(cs) > 0 {
			cand = &cs[0]
		}
	case asin != "" && cookie != "":
		a, lerr := metadata.FetchAmazonBook(ctx, asin, cookie, domain)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book asin", lerr)
			return it
		}
		cand = a
	case googleID != "":
		g, lerr := s.googleVolume(ctx, googleID, gkey)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book google_id", lerr)
			return it
		}
		cand = g
	case asin != "":
		// Pinned by ASIN, but the Amazon source needs its cookie — say so
		// instead of the misleading "no pinned identity".
		it.Status = "fetch_failed"
		it.Error = "this book is pinned by ASIN — Amazon lookups need the cookie in Settings → Metadata sources"
		return it
	default:
		it.Status = "unpinned"
		it.Error = "no re-checkable identity (isbn, asin or google id) — use Look up to re-pin this book first"
		return it
	}
	if cand == nil {
		it.Status = "fetch_failed"
		it.Error = "the source no longer returns this identity"
		return it
	}
	it.Source = cand.Source

	d := it.Diffs
	d = diffStr(d, "title", title, cand.Title)
	d = diffStr(d, "author", author, cand.Author)
	d = diffStr(d, "description", desc, cand.Description)
	if cand.PublishedYear != 0 && cand.PublishedYear != year {
		d = append(d, fieldDiff{Field: "published_year", Stored: year, Fresh: cand.PublishedYear})
	}
	// Genres: candidate capped at 5 (same cap as the covers refetch), compared
	// as a case-insensitive set after the canonical title-casing.
	if len(cand.Genres) > 0 {
		fresh := cleanNames(cand.Genres)
		if len(fresh) > 5 {
			fresh = fresh[:5]
		}
		for i := range fresh {
			fresh[i] = titleCaseGenre(fresh[i])
		}
		if !sameGenreSet(genres, fresh) {
			d = append(d, fieldDiff{Field: "genres", Stored: genres, Fresh: fresh})
		}
	}
	d = diffStr(d, "series", series, cand.Series)
	if cand.SeriesIndex != 0 && cand.SeriesIndex != seriesIdx {
		d = append(d, fieldDiff{Field: "series_index", Stored: seriesIdx, Fresh: cand.SeriesIndex})
	}
	if cand.ISBN13 != "" && cand.ISBN13 != isbnN {
		d = append(d, fieldDiff{Field: "isbn", Stored: isbnN, Fresh: cand.ISBN13})
	}
	// Cover: offered when the fresh source has art AND the stored one is
	// missing or below the low-res threshold — a good stored cover is never
	// churned. Stored = the local file (client renders it), fresh = the URL.
	if cand.CoverURL != "" && (cover == "" || s.coverWidth(cover) < lowResCoverWidth) {
		d = append(d, fieldDiff{Field: "cover", Stored: cover, Fresh: cand.CoverURL})
	}
	it.Diffs = d
	return it
}

func (s *Server) reverifyMovie(ctx context.Context, uid, id int64, tmdb *metadata.TMDB, tvdb *metadata.TVDB) reverifyItem {
	it := reverifyItem{Type: "movie", ID: id, Status: "ok", Diffs: []fieldDiff{}}
	var title, director, desc, mediaType, series, poster, castJSON string
	var year int
	var tmdbID, tvdbID int64
	err := s.Store.DB.QueryRow(`
		SELECT title, COALESCE(director,''), COALESCE(release_year,0), COALESCE(description,''),
		       COALESCE(media_type,'movie'), COALESCE(series,''), COALESCE(tmdb_id,0), COALESCE(tvdb_id,0),
		       COALESCE(poster_path,''), COALESCE(cast_json,'[]')
		FROM movies WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&title, &director, &year, &desc, &mediaType, &series, &tmdbID, &tvdbID, &poster, &castJSON)
	if errors.Is(err, sql.ErrNoRows) {
		it.Status = "not_found"
		return it
	}
	if err != nil {
		olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify movie %d read failed: %v", id, err)
		it.Status, it.Error = "fetch_failed", "could not read this title — try again"
		return it
	}
	it.Title = title
	genres := s.itemGenreNames("movie", id)

	var det *metadata.MovieDetails
	var lerr error
	switch {
	case tmdbID != 0 && tmdb != nil:
		if mediaType == "show" {
			det, lerr = tmdb.DetailsTV(ctx, tmdbID)
		} else {
			det, lerr = tmdb.Details(ctx, tmdbID)
		}
	case tvdbID != 0 && tvdb != nil:
		if mediaType == "show" {
			det, lerr = tvdb.SeriesDetails(ctx, strconv.FormatInt(tvdbID, 10))
		} else {
			det, lerr = tvdb.MovieDetails(ctx, strconv.FormatInt(tvdbID, 10))
		}
	case tmdbID != 0 || tvdbID != 0:
		it.Status = "fetch_failed"
		it.Error = "the pinned source needs its key — add it in Settings → Metadata sources"
		return it
	default:
		it.Status = "unpinned"
		it.Error = "no pinned identity (TMDB/TheTVDB id) — use Look up to pin this title first"
		return it
	}
	if lerr != nil {
		it.Status, it.Error = "fetch_failed", reverifyLookupError("movie details", lerr)
		return it
	}
	it.Source = det.Source

	d := it.Diffs
	d = diffStr(d, "title", title, det.Title)
	d = diffStr(d, "director", director, det.Director)
	d = diffStr(d, "description", desc, det.Overview)
	if det.ReleaseYear != 0 && det.ReleaseYear != year {
		d = append(d, fieldDiff{Field: "release_year", Stored: year, Fresh: det.ReleaseYear})
	}
	if len(det.Genres) > 0 {
		fresh := cleanNames(det.Genres)
		if len(fresh) > 5 {
			fresh = fresh[:5]
		}
		for i := range fresh {
			fresh[i] = titleCaseGenre(fresh[i])
		}
		if !sameGenreSet(genres, fresh) {
			d = append(d, fieldDiff{Field: "genres", Stored: genres, Fresh: fresh})
		}
	}
	d = diffStr(d, "series", series, det.Series)
	// Cast: ordered (character, actor) pairs; person_id/image_url ride along in
	// fresh so an approved apply keeps the portrait pipeline working.
	var stored []metadata.CastMember
	_ = json.Unmarshal([]byte(castJSON), &stored) // bad cached JSON reads as empty
	if len(det.Cast) > 0 && !sameCast(stored, det.Cast) {
		d = append(d, fieldDiff{Field: "cast", Stored: stored, Fresh: det.Cast})
	}
	if det.PosterURL != "" && (poster == "" || s.coverWidth(poster) < lowResCoverWidth) {
		d = append(d, fieldDiff{Field: "poster", Stored: poster, Fresh: det.PosterURL})
	}
	if det.TMDBID != 0 && det.TMDBID != tmdbID {
		d = append(d, fieldDiff{Field: "tmdb_id", Stored: tmdbID, Fresh: det.TMDBID})
	}
	if det.TVDBID != 0 && det.TVDBID != tvdbID {
		d = append(d, fieldDiff{Field: "tvdb_id", Stored: tvdbID, Fresh: det.TVDBID})
	}
	it.Diffs = d
	return it
}

// sameCast compares billing order and the visible (character, actor) pairs —
// a person_id/image_url-only change is not worth a user-facing diff.
func sameCast(a, b []metadata.CastMember) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !strings.EqualFold(strings.TrimSpace(a[i].Character), strings.TrimSpace(b[i].Character)) ||
			!strings.EqualFold(strings.TrimSpace(a[i].Actor), strings.TrimSpace(b[i].Actor)) {
			return false
		}
	}
	return true
}

// getPersonFold is getPerson with a case-insensitive fallback: the People
// console lists names in the casing the CREDIT uses, which can differ from
// the saved row's casing — the re-verify flow must still find the row (and
// then keys everything by the row's canonical spelling).
func (s *Server) getPersonFold(uid int64, kind, name string) (personRow, bool) {
	if p, ok := s.getPerson(uid, kind, name); ok {
		return p, true
	}
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people
		 WHERE user_id = ? AND kind = ? AND LOWER(name) = LOWER(?) LIMIT 1`, uid, kind, name))
	if err != nil {
		return personRow{}, false
	}
	return p, true
}

func (s *Server) reverifyPerson(ctx context.Context, uid int64, kind, name string) reverifyItem {
	it := reverifyItem{Type: "person", Kind: kind, Name: name, Title: name, Status: "ok", Diffs: []fieldDiff{}}
	if !validPersonKind(kind) || name == "" {
		it.Status, it.Error = "not_found", "kind must be author, actor or director, with a name"
		return it
	}
	p, ok := s.getPersonFold(uid, kind, name)
	if !ok {
		it.Status = "unpinned"
		it.Error = "nothing saved for this name yet — fetch it from the People console first"
		return it
	}
	// Key the item by the saved row's canonical spelling so the apply that
	// follows targets the same row.
	it.Name, it.Title, name = p.Name, p.Name, p.Name
	// The same confident resolution the portrait pipeline uses: an actor from
	// the stored cast (no network), an author via Open Library disambiguated by
	// their books. Links come back only for authors; actor links stay the
	// People console's job (a by-name TMDB search could drift to a namesake).
	source, sourceID, imageURL, bio, born, links, rerr := s.resolvePersonPortrait(ctx, uid, kind, name)
	if rerr != nil {
		it.Status, it.Error = "fetch_failed", reverifyLookupError("person", rerr)
		return it
	}
	if source == "" && imageURL == "" && len(links) == 0 && bio == "" && born == "" {
		it.Error = "no confident match found"
		return it
	}
	it.Source = source

	d := it.Diffs
	// Identity needs BOTH halves — a cast entry with a headshot but no person
	// id would otherwise emit a "source:" value the apply endpoint rejects.
	identityDrift := source != "" && sourceID != "" && (source != p.Source || sourceID != p.SourceID)
	if identityDrift {
		d = append(d, fieldDiff{
			Field:  "identity",
			Stored: strings.TrimSpace(strings.TrimPrefix(p.Source+":"+p.SourceID, ":")),
			Fresh:  source + ":" + sourceID,
		})
	}
	if merged := mergePersonLinks(p.Links, links); merged != strings.TrimSpace(p.Links) {
		d = append(d, fieldDiff{Field: "links", Stored: p.Links, Fresh: merged})
	}
	if imageURL != "" && (p.ImagePath == "" || identityDrift) {
		d = append(d, fieldDiff{Field: "portrait", Stored: p.ImagePath, Fresh: imageURL})
	}
	// Bio + birth year only fill an empty field — a user's own text is never
	// overwritten by a re-verify (mirrors the auto-enrich upsert's CASE guards).
	if bio != "" && strings.TrimSpace(p.Bio) == "" {
		d = append(d, fieldDiff{Field: "bio", Stored: p.Bio, Fresh: bio})
	}
	if born != "" && strings.TrimSpace(p.Born) == "" {
		d = append(d, fieldDiff{Field: "born", Stored: p.Born, Fresh: born})
	}
	it.Diffs = d
	return it
}

// ---- link merging (Go mirror of people.jsx parseLinks/mergeLinks) ----

// personLinkProviders recognises a saved link's provider by hostname, in the
// display order the UI uses. Keep in lockstep with PROVIDERS in people.jsx.
var personLinkProviders = []struct {
	slug string
	re   *regexp.Regexp
}{
	{"imdb", regexp.MustCompile(`(^|\.)imdb\.com$`)},
	{"tmdb", regexp.MustCompile(`(^|\.)themoviedb\.org$`)},
	{"tvdb", regexp.MustCompile(`(^|\.)thetvdb\.com$`)},
	{"wikipedia", regexp.MustCompile(`(^|\.)wikipedia\.org$`)},
	{"openlibrary", regexp.MustCompile(`(^|\.)openlibrary\.org$`)},
}

// mergePersonLinks folds freshly-resolved provider links into the stored
// free-text links field without disturbing anything the user added by hand:
// providers land in canonical order, existing URLs win, unrecognised extras
// keep their place at the end.
func mergePersonLinks(stored string, fetched map[string]string) string {
	known := map[string]string{}
	var extra []string
	for _, tok := range strings.Fields(stored) {
		u, err := url.Parse(tok)
		if err != nil || u.Hostname() == "" {
			extra = append(extra, tok)
			continue
		}
		host := strings.ToLower(u.Hostname())
		matched := ""
		for _, p := range personLinkProviders {
			if p.re.MatchString(host) {
				matched = p.slug
				break
			}
		}
		if matched != "" && known[matched] == "" {
			known[matched] = tok
		} else {
			extra = append(extra, tok)
		}
	}
	for slug, u := range fetched {
		if u != "" && known[slug] == "" {
			known[slug] = u
		}
	}
	var out []string
	for _, p := range personLinkProviders {
		if known[p.slug] != "" {
			out = append(out, known[p.slug])
		}
	}
	out = append(out, extra...)
	return strings.Join(out, "\n")
}

// ---- apply ----

// handleMetadataReverifyApply: POST /metadata/reverify/apply
// {items: [{type, id | kind+name, set:{field: value}}]} → per-item results.
// Writes ONLY whitelisted, user-approved fields, per-item transactionally;
// image fields (cover/poster/portrait — the previewed URLs) download after the
// text commit so an image miss degrades to a note instead of reverting text.
func (s *Server) handleMetadataReverifyApply(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []struct {
			Type string                     `json:"type"`
			ID   int64                      `json:"id"`
			Kind string                     `json:"kind"`
			Name string                     `json:"name"`
			Set  map[string]json.RawMessage `json:"set"`
		} `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to apply")
		return
	}
	if len(req.Items) > maxReverifyItems {
		writeErr(w, http.StatusBadRequest, "too many items per call (max 15) — send smaller batches")
		return
	}
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataReverifyApply uid=%d items=%d", uid, len(req.Items))

	type applyResult struct {
		Type  string `json:"type"`
		ID    int64  `json:"id,omitempty"`
		Kind  string `json:"kind,omitempty"`
		Name  string `json:"name,omitempty"`
		OK    bool   `json:"ok"`
		Error string `json:"error,omitempty"`
		Note  string `json:"note,omitempty"`
	}
	results := []applyResult{}
	applied, failed := 0, 0
	for _, item := range req.Items {
		res := applyResult{Type: item.Type, ID: item.ID, Kind: item.Kind, Name: item.Name}
		var note string
		var aerr error
		switch item.Type {
		case "book":
			note, aerr = s.applyReverifyBook(r.Context(), uid, item.ID, item.Set)
		case "movie":
			note, aerr = s.applyReverifyMovie(r.Context(), uid, item.ID, item.Set)
		case "person":
			note, aerr = s.applyReverifyPerson(r.Context(), uid, strings.TrimSpace(item.Kind), strings.TrimSpace(item.Name), item.Set)
		default:
			aerr = errors.New("type must be book, movie or person")
		}
		res.Note = note
		if aerr != nil {
			res.Error = aerr.Error()
			failed++
		} else {
			res.OK = true
			applied++
		}
		results = append(results, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"applied": applied, "failed": failed, "results": results})
}

// decodeSet pulls one typed field out of a set map; absent keys return ok=false.
func decodeSet[T any](set map[string]json.RawMessage, key string) (T, bool, error) {
	var v T
	raw, present := set[key]
	if !present {
		return v, false, nil
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		return v, false, errors.New(key + ": wrong type")
	}
	return v, true, nil
}

// isUniqueErr matches SQLite UNIQUE-constraint violations (the isbn/tmdb_id
// partial-unique indexes) so they read as "duplicate", mirroring the 409s the
// create/edit paths return.
func isUniqueErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE")
}

func (s *Server) applyReverifyBook(ctx context.Context, uid, id int64, set map[string]json.RawMessage) (note string, err error) {
	allowed := map[string]bool{"title": true, "author": true, "description": true, "published_year": true,
		"genres": true, "series": true, "series_index": true, "isbn": true, "cover": true}
	for k := range set {
		if !allowed[k] {
			return "", errors.New("unknown field for a book: " + k)
		}
	}
	cols := []string{}
	args := []any{}
	addStr := func(key, col string, allowEmpty bool) error {
		v, present, derr := decodeSet[string](set, key)
		if derr != nil {
			return derr
		}
		if !present {
			return nil
		}
		v = strings.TrimSpace(v)
		if v == "" && !allowEmpty {
			return errors.New(key + " cannot be empty")
		}
		cols = append(cols, col+" = ?")
		args = append(args, nullable(v))
		return nil
	}
	// title binds non-nullable (a book must keep a title).
	if v, present, derr := decodeSet[string](set, "title"); derr != nil {
		return "", derr
	} else if present {
		v = strings.TrimSpace(v)
		if v == "" {
			return "", errors.New("title cannot be empty")
		}
		cols = append(cols, "title = ?")
		args = append(args, v)
	}
	if err := addStr("author", "author", true); err != nil {
		return "", err
	}
	if err := addStr("description", "description", true); err != nil {
		return "", err
	}
	if err := addStr("series", "series", true); err != nil {
		return "", err
	}
	if y, present, derr := decodeSet[int](set, "published_year"); derr != nil {
		return "", derr
	} else if present {
		if !validYear(y) {
			return "", errors.New("published_year out of range")
		}
		cols = append(cols, "published_year = ?")
		args = append(args, nullableInt(y))
	}
	if f, present, derr := decodeSet[float64](set, "series_index"); derr != nil {
		return "", derr
	} else if present {
		cols = append(cols, "series_index = ?")
		args = append(args, nullableFloat(f))
	}
	if v, present, derr := decodeSet[string](set, "isbn"); derr != nil {
		return "", derr
	} else if present {
		n := metadata.NormalizeISBN(v)
		if n == "" {
			return "", errors.New("invalid isbn")
		}
		cols = append(cols, "isbn = ?")
		args = append(args, n)
	}
	genres, hasGenres, derr := decodeSet[[]string](set, "genres")
	if derr != nil {
		return "", derr
	}
	coverURL, hasCover, derr := decodeSet[string](set, "cover")
	if derr != nil {
		return "", derr
	}

	// The approved cover downloads FIRST (through the metadata host allowlist)
	// so the file can ride the same transaction; a miss degrades to a note.
	newCover, oldCover := "", ""
	if hasCover && strings.TrimSpace(coverURL) != "" {
		if name, ferr := s.fetchImage(ctx, strings.TrimSpace(coverURL), s.coversDir()); ferr != nil {
			olog.Warnf(olog.CodeMetaReverifyImage, "[meta] re-verify book %d cover fetch failed: %v", id, ferr)
			note = "cover: fetch failed — other fields applied"
		} else {
			newCover = name
			_ = s.Store.DB.QueryRow(`SELECT COALESCE(cover_path,'') FROM books WHERE id = ? AND user_id = ?`,
				id, uid).Scan(&oldCover) // best-effort: worst case the old file lingers
			cols = append(cols, "cover_path = ?")
			args = append(args, newCover)
		}
	}
	if len(cols) == 0 && !hasGenres {
		s.removeCoverFile(newCover)
		if note != "" {
			// The ONLY approved field was the cover and its download failed —
			// that's the documented degrade-to-note outcome, not a client error.
			return note, nil
		}
		return "", errors.New("no approved fields")
	}

	tx, terr := s.Store.DB.Begin()
	if terr != nil {
		s.removeCoverFile(newCover)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d begin failed: %v", id, terr)
		return "", errors.New("write failed")
	}
	defer tx.Rollback()
	if len(cols) > 0 {
		args = append(args, id, uid)
		res, xerr := tx.Exec(`UPDATE books SET `+strings.Join(cols, ", ")+` WHERE id = ? AND user_id = ?`, args...)
		if xerr != nil {
			s.removeCoverFile(newCover)
			if isUniqueErr(xerr) {
				return "", errors.New("duplicate — another book already carries that isbn")
			}
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d update failed: %v", id, xerr)
			return "", errors.New("write failed")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			s.removeCoverFile(newCover)
			return "", errors.New("not found")
		}
	} else if !txOwnsRow(tx, "books", uid, id) {
		s.removeCoverFile(newCover)
		return "", errors.New("not found")
	}
	if hasGenres {
		capped := cleanNames(genres)
		if len(capped) > 5 {
			capped = capped[:5]
		}
		if gerr := setGenres(tx, "book", uid, id, capped); gerr != nil {
			s.removeCoverFile(newCover)
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d genres failed: %v", id, gerr)
			return "", errors.New("write failed")
		}
	}
	if cerr := tx.Commit(); cerr != nil {
		s.removeCoverFile(newCover)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d commit failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if newCover != "" && oldCover != "" && oldCover != newCover {
		s.removeCoverFile(oldCover) // best-effort; new row committed
	}
	return note, nil
}

// txOwnsRow is the ownership check for a genre-only apply, where no UPDATE has
// proven the row is the caller's (foreign rows read as "not found" — no
// existence leak).
func txOwnsRow(tx *sql.Tx, table string, uid, id int64) bool {
	var ok bool
	_ = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = ? AND user_id = ?)`, id, uid).Scan(&ok)
	return ok
}

func (s *Server) applyReverifyMovie(ctx context.Context, uid, id int64, set map[string]json.RawMessage) (note string, err error) {
	allowed := map[string]bool{"title": true, "director": true, "description": true, "release_year": true,
		"genres": true, "series": true, "cast": true, "poster": true, "tmdb_id": true, "tvdb_id": true}
	for k := range set {
		if !allowed[k] {
			return "", errors.New("unknown field for a movie: " + k)
		}
	}
	cols := []string{}
	args := []any{}
	addStr := func(key, col string, allowEmpty bool) error {
		v, present, derr := decodeSet[string](set, key)
		if derr != nil {
			return derr
		}
		if !present {
			return nil
		}
		v = strings.TrimSpace(v)
		if v == "" && !allowEmpty {
			return errors.New(key + " cannot be empty")
		}
		cols = append(cols, col+" = ?")
		args = append(args, nullable(v))
		return nil
	}
	if v, present, derr := decodeSet[string](set, "title"); derr != nil {
		return "", derr
	} else if present {
		v = strings.TrimSpace(v)
		if v == "" {
			return "", errors.New("title cannot be empty")
		}
		cols = append(cols, "title = ?")
		args = append(args, v)
	}
	if err := addStr("director", "director", true); err != nil {
		return "", err
	}
	if err := addStr("description", "description", true); err != nil {
		return "", err
	}
	if err := addStr("series", "series", true); err != nil {
		return "", err
	}
	if y, present, derr := decodeSet[int](set, "release_year"); derr != nil {
		return "", derr
	} else if present {
		if !validYear(y) {
			return "", errors.New("release_year out of range")
		}
		cols = append(cols, "release_year = ?")
		args = append(args, nullableInt(y))
	}
	for _, idf := range []string{"tmdb_id", "tvdb_id"} {
		if v, present, derr := decodeSet[int64](set, idf); derr != nil {
			return "", derr
		} else if present {
			cols = append(cols, idf+" = ?")
			args = append(args, nullableInt64(v))
		}
	}
	cast, hasCast, derr := decodeSet[[]metadata.CastMember](set, "cast")
	if derr != nil {
		return "", derr
	}
	if hasCast {
		raw, merr := json.Marshal(cast)
		if merr != nil {
			return "", errors.New("cast: wrong shape")
		}
		cols = append(cols, "cast_json = ?")
		args = append(args, string(raw))
	}
	genres, hasGenres, derr := decodeSet[[]string](set, "genres")
	if derr != nil {
		return "", derr
	}
	posterURL, hasPoster, derr := decodeSet[string](set, "poster")
	if derr != nil {
		return "", derr
	}

	newPoster, oldPoster := "", ""
	if hasPoster && strings.TrimSpace(posterURL) != "" {
		if name, ferr := s.fetchImage(ctx, strings.TrimSpace(posterURL), s.coversDir()); ferr != nil {
			olog.Warnf(olog.CodeMetaReverifyImage, "[meta] re-verify movie %d poster fetch failed: %v", id, ferr)
			note = "poster: fetch failed — other fields applied"
		} else {
			newPoster = name
			_ = s.Store.DB.QueryRow(`SELECT COALESCE(poster_path,'') FROM movies WHERE id = ? AND user_id = ?`,
				id, uid).Scan(&oldPoster)
			cols = append(cols, "poster_path = ?")
			args = append(args, newPoster)
		}
	}
	if len(cols) == 0 && !hasGenres {
		s.removeCoverFile(newPoster)
		if note != "" {
			// Poster-only approval whose download failed — degrade to the note.
			return note, nil
		}
		return "", errors.New("no approved fields")
	}

	tx, terr := s.Store.DB.Begin()
	if terr != nil {
		s.removeCoverFile(newPoster)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d begin failed: %v", id, terr)
		return "", errors.New("write failed")
	}
	defer tx.Rollback()
	if len(cols) > 0 {
		args = append(args, id, uid)
		res, xerr := tx.Exec(`UPDATE movies SET `+strings.Join(cols, ", ")+` WHERE id = ? AND user_id = ?`, args...)
		if xerr != nil {
			s.removeCoverFile(newPoster)
			if isUniqueErr(xerr) {
				return "", errors.New("duplicate — another title already carries that source id")
			}
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d update failed: %v", id, xerr)
			return "", errors.New("write failed")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			s.removeCoverFile(newPoster)
			return "", errors.New("not found")
		}
	} else if !txOwnsRow(tx, "movies", uid, id) {
		s.removeCoverFile(newPoster)
		return "", errors.New("not found")
	}
	if hasGenres {
		capped := cleanNames(genres)
		if len(capped) > 5 {
			capped = capped[:5]
		}
		if gerr := setGenres(tx, "movie", uid, id, capped); gerr != nil {
			s.removeCoverFile(newPoster)
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d genres failed: %v", id, gerr)
			return "", errors.New("write failed")
		}
	}
	if hasCast {
		// A refreshed cast can name speakers for dialogues whose actor is blank.
		if _, ferr := refillMovieActors(tx, id); ferr != nil {
			olog.Warnf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d actor refill failed: %v", id, ferr)
		}
	}
	if cerr := tx.Commit(); cerr != nil {
		s.removeCoverFile(newPoster)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d commit failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if newPoster != "" && oldPoster != "" && oldPoster != newPoster {
		s.removeCoverFile(oldPoster)
	}
	return note, nil
}

func (s *Server) applyReverifyPerson(ctx context.Context, uid int64, kind, name string, set map[string]json.RawMessage) (note string, err error) {
	if !validPersonKind(kind) || name == "" {
		return "", errors.New("kind must be author, actor or director, with a name")
	}
	allowed := map[string]bool{"links": true, "identity": true, "source": true, "source_id": true, "portrait": true, "bio": true, "born": true}
	for k := range set {
		if !allowed[k] {
			return "", errors.New("unknown field for a person: " + k)
		}
	}
	p, exists := s.getPerson(uid, kind, name)
	if !exists {
		return "", errors.New("not found")
	}
	links, hasLinks, derr := decodeSet[string](set, "links")
	if derr != nil {
		return "", derr
	}
	// identity ships as "source:id" (the preview's diff value); a split
	// source/source_id pair is accepted too.
	source, sourceID := p.Source, p.SourceID
	if v, present, derr := decodeSet[string](set, "identity"); derr != nil {
		return "", derr
	} else if present {
		src, sid, ok := strings.Cut(strings.TrimSpace(v), ":")
		if !ok || src == "" || sid == "" {
			return "", errors.New("identity must be source:id")
		}
		source, sourceID = src, sid
	}
	if v, present, derr := decodeSet[string](set, "source"); derr != nil {
		return "", derr
	} else if present {
		source = strings.TrimSpace(v)
	}
	if v, present, derr := decodeSet[string](set, "source_id"); derr != nil {
		return "", derr
	} else if present {
		sourceID = strings.TrimSpace(v)
	}
	portraitURL, hasPortrait, derr := decodeSet[string](set, "portrait")
	if derr != nil {
		return "", derr
	}
	newBio := p.Bio
	if v, present, derr := decodeSet[string](set, "bio"); derr != nil {
		return "", derr
	} else if present {
		newBio = strings.TrimSpace(v)
	}
	newBorn := p.Born
	if v, present, derr := decodeSet[string](set, "born"); derr != nil {
		return "", derr
	} else if present {
		newBorn = strings.TrimSpace(v)
	}

	newImage := ""
	if hasPortrait && strings.TrimSpace(portraitURL) != "" {
		if img, ferr := s.fetchImage(ctx, strings.TrimSpace(portraitURL), s.coversDir()); ferr != nil {
			olog.Warnf(olog.CodeMetaReverifyImage, "[meta] re-verify person %q portrait fetch failed: %v", name, ferr)
			note = "portrait: fetch failed — other fields applied"
		} else {
			newImage = img
		}
	}
	newLinks := p.Links
	if hasLinks {
		newLinks = strings.TrimSpace(links)
	}
	image := p.ImagePath
	if newImage != "" {
		image = newImage
	}
	// Full upsert. bio/born now flow through too (only diffed when the stored
	// field was empty, so a user's own text still can't be overwritten here).
	if _, xerr := s.Store.DB.Exec(`
		INSERT INTO people (user_id, kind, name, bio, image_path, born, links, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, kind, name) DO UPDATE SET
			image_path = excluded.image_path, links = excluded.links,
			bio = excluded.bio, born = excluded.born,
			source = excluded.source, source_id = excluded.source_id`,
		uid, kind, name, newBio, image, newBorn, newLinks, source, sourceID); xerr != nil {
		s.removeCoverFile(newImage)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify person %q upsert failed: %v", name, xerr)
		return "", errors.New("write failed")
	}
	if newImage != "" && p.ImagePath != "" && p.ImagePath != newImage {
		s.removeCoverFile(p.ImagePath)
	}
	return note, nil
}
