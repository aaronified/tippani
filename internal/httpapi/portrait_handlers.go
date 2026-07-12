package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"tippani/internal/metadata"
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

	var source, sourceID, imageURL string
	// links are the reference pages resolved from the SAME confident identity — so
	// an author's links (Open Library + Wikipedia) can't point at a namesake
	// either. Empty for actors, whose links still come from POST /people/lookup.
	links := map[string]string{}
	if req.Kind == "actor" {
		source, sourceID, imageURL = s.actorPortraitFromCast(uid, req.Name)
	} else {
		titles, err := s.authorBookTitles(uid, req.Name)
		if err != nil {
			internalError(w, r, "portrait book titles", err)
			return
		}
		res, rerr := s.resolveAuthor(r.Context(), req.Name, titles)
		if rerr != nil {
			writeErr(w, http.StatusBadGateway, "lookup failed — try again in a moment")
			return
		}
		if res.Key != "" {
			source, sourceID, imageURL = "openlibrary", res.Key, res.ImageURL
			if res.Links != nil {
				links = res.Links
			}
		}
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

	// Nothing pinned (no identity, no image): report it and hand back the current
	// row (or a shell) so the UI can offer manual entry, without writing anything.
	if source == "" && newImage == "" {
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

	// Upsert identity + image. A blank newImage keeps any existing photo (identity
	// still refreshed), so re-running never wipes a good portrait.
	if _, err := s.Store.DB.Exec(`
		INSERT INTO people (user_id, kind, name, image_path, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, kind, name) DO UPDATE SET
			image_path = CASE WHEN excluded.image_path <> '' THEN excluded.image_path ELSE people.image_path END,
			source = excluded.source, source_id = excluded.source_id`,
		uid, req.Kind, req.Name, newImage, source, sourceID); err != nil {
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

// actorPortraitFromCast finds an actor's portrait + supplier identity in the
// stored cast of the caller's films that reference them — no external call. It
// prefers a cast entry that carries both a person id and a headshot; failing a
// headshot anywhere, it still returns the identity alone (so the person is
// pinned). Empty strings mean "not found in any stored cast".
func (s *Server) actorPortraitFromCast(uid int64, name string) (source, personID, imageURL string) {
	rows, err := s.Store.DB.Query(`
		SELECT COALESCE(m.cast_json, '[]'), COALESCE(m.tmdb_id, 0), COALESCE(m.tvdb_id, 0)
		FROM movies m JOIN dialogues d ON d.movie_id = m.id
		WHERE m.user_id = ? AND LOWER(TRIM(d.actor)) = LOWER(?)
		GROUP BY m.id`, uid, name)
	if err != nil {
		return "", "", ""
	}
	defer rows.Close()
	var fbSource, fbID string // identity-only fallback (a cast hit with no headshot)
	for rows.Next() {
		var castJSON string
		var tmdbID, tvdbID int64
		if rows.Scan(&castJSON, &tmdbID, &tvdbID) != nil {
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
	return fbSource, fbID, ""
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
		if rows.Scan(&t) == nil && strings.TrimSpace(t) != "" {
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
