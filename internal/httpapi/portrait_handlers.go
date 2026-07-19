package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// Portrait resolution (author/actor photos) — the "fetch the image
// automatically" path (POST /people/portrait). Unlike PUT /people, which stores
// a URL the user pasted, this resolves the portrait from the catalogue the app
// already knows and, crucially, pins the person to a stable external id so a
// re-fetch can never drift to a namesake:
//
//	actor  — read straight from the film's stored cast (movies.cast_json), which
//	         already carries the supplier's person id + a headshot URL harvested
//	         from the credits when the movie was added. The film IS the
//	         disambiguator (it is that film's cast), so NO extra provider call is
//	         made here.
//	director — read from the crew in the film's cached TMDB payload
//	         (movies.source_metadata), which carries the director's person id +
//	         profile_path even though only their name was flattened onto the
//	         movie. Same "the film is the disambiguator" trick as actors, but from
//	         the raw credits.crew rather than the parsed cast; a by-name person
//	         search is the fallback for films synced without a TMDB payload.
//	author — resolved through Open Library, disambiguating same-name authors
//	         (the "several David Reichs" problem) by cross-checking each
//	         candidate's works against the books the author wrote in this library;
//	         the portrait is an OL photo or the Wikidata P18 image.
//
// Best-effort and idempotent: fills image_path when a portrait resolves,
// persists source/source_id (the identity), and leaves bio/born/links untouched
// so a user's manual edits are never clobbered.

// handlePersonPortrait: POST /people/portrait {kind, name}. Answers with
// {resolved, image, person} — resolved=false (200, not an error) when the app
// couldn't pin a portrait, so the client can fall back to manual entry.
func (s *Server) handlePersonPortrait(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Kind = strings.TrimSpace(req.Kind)
	req.Name = strings.TrimSpace(req.Name)
	if !validPersonKind(req.Kind) {
		writeErr(w, http.StatusBadRequest, "kind must be author or actor")
		return
	}
	if req.Name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	uid := userID(r)
	olog.Tracef("[people] handlePersonPortrait uid=%d kind=%s name=%q", uid, req.Kind, req.Name)

	source, sourceID, imageURL, bio, born, died, links, rerr := s.resolvePersonPortrait(r.Context(), uid, req.Kind, req.Name)
	if rerr != nil {
		// Only the author (Open Library) path returns a hard error here — the
		// actor/director paths degrade to best-effort. The client sees a generic
		// message, so log the real cause.
		olog.Errorf(olog.CodePeopleLookupFailed, "[people] portrait kind=%s name=%q failed: %v", req.Kind, req.Name, rerr)
		writeErr(w, http.StatusBadGateway, "lookup failed — try again in a moment")
		return
	}

	// Download the portrait through the API-host allowlist (image.tmdb.org,
	// artworks.thetvdb.com, covers.openlibrary.org, commons/upload.wikimedia.org
	// are all allowed). Best-effort: a fetch miss still lets the identity persist.
	newImage := ""
	if imageURL != "" {
		if name, ferr := s.fetchImage(r.Context(), imageURL, s.coversDir()); ferr == nil {
			newImage = name
		}
	}

	// Nothing pinned (no identity, no image, no bio/born/died): report it and hand
	// back the current row (or a shell) so the UI can offer manual entry, writing nothing.
	if source == "" && newImage == "" && bio == "" && born == "" && died == "" {
		if p, ok := s.getPerson(uid, req.Kind, req.Name); ok {
			writeJSON(w, http.StatusOK, map[string]any{"resolved": false, "image": false, "person": p, "links": links})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"resolved": false, "image": false,
			"person": map[string]any{"kind": req.Kind, "name": req.Name}, "links": links})
		return
	}

	var oldImage string
	_ = s.Store.DB.QueryRow(
		`SELECT image_path FROM people WHERE user_id = ? AND kind = ? AND name = ?`,
		uid, req.Kind, req.Name).Scan(&oldImage)

	// Upsert identity + image + bio/born/died. A blank newImage keeps any existing
	// photo (identity still refreshed) so re-running never wipes a good portrait;
	// bio/born/died fill only when empty, so a user's manual edits are never clobbered.
	if _, err := s.Store.DB.Exec(`
		INSERT INTO people (user_id, kind, name, image_path, bio, born, died, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, kind, name) DO UPDATE SET
			image_path = CASE WHEN excluded.image_path <> '' THEN excluded.image_path ELSE people.image_path END,
			bio = CASE WHEN people.bio = '' AND excluded.bio <> '' THEN excluded.bio ELSE people.bio END,
			born = CASE WHEN people.born = '' AND excluded.born <> '' THEN excluded.born ELSE people.born END,
			died = CASE WHEN people.died = '' AND excluded.died <> '' THEN excluded.died ELSE people.died END,
			source = excluded.source, source_id = excluded.source_id`,
		uid, req.Kind, req.Name, newImage, bio, born, died, source, sourceID); err != nil {
		s.removeCoverFile(newImage) // roll back the just-fetched file on write failure
		internalError(w, r, "portrait upsert", err)
		return
	}
	if newImage != "" && oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage) // best-effort; the new row is committed
	}

	p, _ := s.getPerson(uid, req.Kind, req.Name)
	writeJSON(w, http.StatusOK, map[string]any{
		"resolved": true,
		"image":    p.ImagePath != "",
		"person":   p,
		"links":    links,
	})
}

// resolvePersonPortrait resolves a person's portrait, stable identity and
// reference links from the library's own catalogue: an actor from the film's
// stored cast (no external call), an author via Open Library disambiguated by
// the books they wrote, with a Wikidata fallback. Best-effort — empty
// source/imageURL means nothing confident was found. A non-nil err is only a
// hard author-lookup failure (the caller surfaces it as 502); actor resolution
// never errors. Shared by the portrait endpoint and the bulk refetch.
func (s *Server) resolvePersonPortrait(ctx context.Context, uid int64, kind, name string) (source, sourceID, imageURL, bio, born, died string, links map[string]string, err error) {
	links = map[string]string{}
	switch kind {
	case "actor":
		source, sourceID, imageURL, bio, born, died = s.resolveActorMeta(ctx, uid, name)
		return source, sourceID, imageURL, bio, born, died, links, nil
	case "director":
		source, sourceID, imageURL, bio, born, died = s.resolveDirectorMeta(ctx, uid, name)
		return source, sourceID, imageURL, bio, born, died, links, nil
	}
	titles, terr := s.authorBookTitles(uid, name)
	if terr != nil {
		return "", "", "", "", "", "", links, terr
	}
	res, rerr := s.resolveAuthor(ctx, name, titles)
	if rerr != nil {
		return "", "", "", "", "", "", links, rerr
	}
	if res.Key != "" {
		source, sourceID, imageURL, bio, born, died = "openlibrary", res.Key, res.ImageURL, res.Bio, res.Born, res.Died
		if res.Links != nil {
			links = res.Links
		}
	}
	return source, sourceID, imageURL, bio, born, died, links, nil
}

// resolveActorMeta resolves an actor's portrait, TMDB identity, biography and
// birth year. It starts from the stored cast — the film IS the disambiguator, so
// a person id harvested there is exact — then makes ONE live TMDB /person call to
// (a) fill a headshot for films synced before headshots were captured and (b)
// pull the bio + birthday the credits payload never carried. When no stored cast
// pins a TMDB id (old rows, or a TVDB-only show) it falls back to a by-name
// person search, which is namesake-prone — so the stored id always wins. Degrades
// to the stored headshot + identity when there is no TMDB key. This is the one
// place the actor path reaches out to a provider (see the package comment).
func (s *Server) resolveActorMeta(ctx context.Context, uid int64, name string) (source, sourceID, imageURL, bio, born, died string) {
	source, sourceID, imageURL = s.actorPortraitFromCast(uid, name)
	tmdb, _ := s.resolveTMDB()
	if tmdb == nil {
		return source, sourceID, imageURL, "", "", "" // no key — keep the stored headshot
	}
	id := ""
	switch {
	case source == "tmdb" && sourceID != "":
		id = sourceID // exact: this actor's id, pinned from one of their TMDB films
	case source == "tvdb":
		// A TVDB-only show already has a correct headshot + identity; a by-name
		// TMDB search could pin a namesake, so leave it (TVDB carries no bio here).
		return source, sourceID, imageURL, "", "", ""
	default:
		// Old TMDB film that stored no person id, or nothing stored → by-name search.
		id = tmdb.PersonSearchID(ctx, name)
	}
	if id == "" {
		return source, sourceID, imageURL, "", "", ""
	}
	pm, err := tmdb.PersonDetails(ctx, id)
	if err != nil || pm == nil {
		olog.Tracef("[people] actor %q person details miss: %v", name, err)
		return source, sourceID, imageURL, "", "", ""
	}
	// Pin to the TMDB identity we used, fill a missing headshot, always take the
	// freshly-fetched bio/born/died (the stored cast never had them).
	source, sourceID = "tmdb", id
	if imageURL == "" {
		imageURL = pm.ImageURL
	}
	return source, sourceID, imageURL, pm.Bio, pm.Born, pm.Died
}

// actorPortraitFromCast finds an actor's portrait + supplier identity in the
// stored cast of the caller's films that reference them — no external call. It
// prefers a cast entry that carries both a person id and a headshot; failing a
// headshot anywhere, it still returns the identity alone (so the person is
// pinned). Empty strings mean "not found in any stored cast".
func (s *Server) actorPortraitFromCast(uid int64, name string) (source, personID, imageURL string) {
	// LIKE (not equality): a multi-actor credit stored as "A & B" is listed as
	// its split components, and each component must still find its films. The
	// widened candidate set is safe — the precise match below is against the
	// cast entry's own actor name (EqualFold), not the dialogue credit.
	rows, err := s.Store.DB.Query(`
		SELECT COALESCE(m.cast_json, '[]'), COALESCE(m.tmdb_id, 0), COALESCE(m.tvdb_id, 0)
		FROM movies m JOIN dialogues d ON d.movie_id = m.id
		WHERE m.user_id = ? AND LOWER(d.actor) LIKE '%' || LOWER(?) || '%'
		GROUP BY m.id`, uid, name)
	if err != nil {
		return "", "", ""
	}
	defer rows.Close()
	var fbSource, fbID string // identity-only fallback (a cast hit with no headshot)
	for rows.Next() {
		var castJSON string
		var tmdbID, tvdbID int64
		if err := rows.Scan(&castJSON, &tmdbID, &tvdbID); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] actor cast row scan failed: %v", err)
			continue
		}
		src := "tvdb"
		if tmdbID != 0 {
			src = "tmdb"
		}
		var cast []metadata.CastMember
		if json.Unmarshal([]byte(castJSON), &cast) != nil {
			continue
		}
		for _, c := range cast {
			if !strings.EqualFold(strings.TrimSpace(c.Actor), name) {
				continue
			}
			if c.ImageURL != "" {
				return src, c.PersonID, c.ImageURL // best: identity + headshot
			}
			if c.PersonID != "" && fbID == "" {
				fbSource, fbID = src, c.PersonID // remember, keep looking for a headshot
			}
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] actor cast row iteration failed: %v", err)
	}
	return fbSource, fbID, ""
}

// resolveDirectorMeta resolves a director's (or TV "creator's") portrait, TMDB
// identity, biography and birth year. It mirrors resolveActorMeta: start from the
// person id + headshot the film's cached credits already carry (no external
// call), then make ONE live TMDB /person call to fill a missing headshot and the
// bio/born the credits never carried. When no cached crew pins a TMDB id (a
// manually-typed director, a TVDB-only show, or a TV creator not in credits.crew)
// it falls back to a by-name person search — namesake-prone, so the pinned id
// always wins. Degrades to the stored headshot + identity when there is no key.
func (s *Server) resolveDirectorMeta(ctx context.Context, uid int64, name string) (source, sourceID, imageURL, bio, born, died string) {
	source, sourceID, imageURL = s.directorPortraitFromCrew(uid, name)
	tmdb, _ := s.resolveTMDB()
	if tmdb == nil {
		return source, sourceID, imageURL, "", "", "" // no key — keep the stored headshot
	}
	id := sourceID
	if source != "tmdb" || id == "" {
		id = tmdb.PersonSearchID(ctx, name) // no pinned crew id → by-name search
	}
	if id == "" {
		return source, sourceID, imageURL, "", "", ""
	}
	pm, err := tmdb.PersonDetails(ctx, id)
	if err != nil || pm == nil {
		olog.Tracef("[people] director %q person details miss: %v", name, err)
		return source, sourceID, imageURL, "", "", ""
	}
	source, sourceID = "tmdb", id
	if imageURL == "" {
		imageURL = pm.ImageURL
	}
	return source, sourceID, imageURL, pm.Bio, pm.Born, pm.Died
}

// directorPortraitFromCrew finds a director's TMDB identity + headshot in the
// crew of the cached TMDB payloads (movies.source_metadata) of the caller's films
// that credit them — no external call. Only the director's *name* is flattened
// onto movies.director when a film is added, but the raw credits.crew the payload
// carries still holds their person id + profile_path, so this recovers them
// retroactively for every TMDB film already in the library. Prefers a crew entry
// that carries a headshot; failing that returns the identity alone. Empty strings
// mean "not found in any cached crew" (a manual/TVDB film, or a TV creator).
func (s *Server) directorPortraitFromCrew(uid int64, name string) (source, personID, imageURL string) {
	// LIKE (not equality): a co-directed credit stored as "A & B" lists as its
	// split components, and each must still find its films; the precise match
	// below is against the crew entry's own name (EqualFold + job Director).
	rows, err := s.Store.DB.Query(`
		SELECT source_metadata FROM movies
		WHERE user_id = ? AND director IS NOT NULL
		  AND LOWER(director) LIKE '%' || LOWER(?) || '%'
		  AND tmdb_id IS NOT NULL AND source_metadata IS NOT NULL AND source_metadata <> ''`, uid, name)
	if err != nil {
		return "", "", ""
	}
	defer rows.Close()
	var fbID string // identity-only fallback (a crew hit with no headshot)
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] director crew row scan failed: %v", err)
			continue
		}
		var payload struct {
			Credits struct {
				Crew []struct {
					ID          int64  `json:"id"`
					Name        string `json:"name"`
					Job         string `json:"job"`
					ProfilePath string `json:"profile_path"`
				} `json:"crew"`
			} `json:"credits"`
		}
		if json.Unmarshal([]byte(raw), &payload) != nil {
			continue
		}
		for _, c := range payload.Credits.Crew {
			if c.Job != "Director" || !strings.EqualFold(strings.TrimSpace(c.Name), name) || c.ID == 0 {
				continue
			}
			id := strconv.FormatInt(c.ID, 10)
			if url := metadata.TMDBProfileURL(c.ProfilePath); url != "" {
				return "tmdb", id, url // best: identity + headshot
			}
			if fbID == "" {
				fbID = id // remember, keep looking for a headshot
			}
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] director crew row iteration failed: %v", err)
	}
	if fbID != "" {
		return "tmdb", fbID, ""
	}
	return "", "", ""
}

// authorBookTitles returns the titles of the caller's books whose author field
// mentions the name — the cross-check corpus that disambiguates namesakes.
func (s *Server) authorBookTitles(uid int64, name string) ([]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT title FROM books
		WHERE user_id = ? AND author IS NOT NULL
		  AND LOWER(author) LIKE '%' || LOWER(?) || '%'`, uid, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] author book titles row scan failed: %v", err)
			continue
		}
		if strings.TrimSpace(t) != "" {
			out = append(out, t)
		}
	}
	return out, rows.Err()
}

// getPerson reads one saved person row; ok=false when there is none.
func (s *Server) getPerson(uid int64, kind, name string) (personRow, bool) {
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? AND name = ?`, uid, kind, name))
	if err != nil {
		return personRow{}, false
	}
	return p, true
}
