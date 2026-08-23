package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// Portrait resolution (author/actor photos) — the "fetch the image
// automatically" path (POST /people/portrait). Unlike PUT /people, which stores
// a URL the user pasted, this resolves the portrait from the catalogue the app
// already knows and, crucially, pins the person to a stable external id so a
// re-fetch can never drift to a namesake:
//
//	actor  — read straight from the cast mapping (work_cast, 0048), whose rows
//	         carry the supplier's person id + a headshot URL harvested from the
//	         credits when the film was added, AND the reader's own corrections and
//	         hand-typed credits. The film IS the disambiguator (it is that film's
//	         cast), so NO extra provider call is made here. It read
//	         movies.cast_json until 0048, which meant a name the reader corrected —
//	         and every voice actor on a game, where that blob is empty — resolved
//	         by name instead, through the namesake-prone search this path exists to
//	         avoid.
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
		// Was the literal "kind must be author or actor", stale since director and
		// speaker landed and wrong again the moment 0034 added two more. The const
		// is the one place that list lives.
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
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
		`SELECT image_path FROM people WHERE user_id = ? AND name = ?`,
		uid, req.Name).Scan(&oldImage)

	// Upsert identity + image + bio/born/died. A blank newImage keeps any existing
	// photo (identity still refreshed) so re-running never wipes a good portrait;
	// bio/born/died fill only when empty, so a user's manual edits are never clobbered.
	if _, err := s.Store.DB.Exec(`
		INSERT INTO people (user_id, name, image_path, bio, born, died, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, name) DO UPDATE SET
			image_path = CASE WHEN excluded.image_path <> '' THEN excluded.image_path ELSE people.image_path END,
			bio = CASE WHEN people.bio = '' AND excluded.bio <> '' THEN excluded.bio ELSE people.bio END,
			born = CASE WHEN people.born = '' AND excluded.born <> '' THEN excluded.born ELSE people.born END,
			died = CASE WHEN people.died = '' AND excluded.died <> '' THEN excluded.died ELSE people.died END,
			source = excluded.source, source_id = excluded.source_id`,
		uid, req.Name, newImage, bio, born, died, source, sourceID); err != nil {
		s.removeCoverFile(newImage) // roll back the just-fetched file on write failure
		internalError(w, r, "portrait upsert", err)
		return
	}
	if newImage != "" && oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage) // best-effort; the new row is committed
	}
	// Fetching an actor's portrait for someone already saved as an author adds
	// the actor role to that person rather than making a second row.
	if id, err := s.personIDByName(uid, req.Name); err == nil && id != 0 {
		if err := s.recordPersonKind(id, req.Kind); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] portrait role record failed: %v", err)
		}
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
	case "studio":
		// A STUDIO IS NOT A PERSON, AND THIS IS THE PATH THAT WROTE THE ROW.
		//
		// Everything below falls to the Open Library AUTHOR lookup, which was a
		// complete description of the world until 0040 added a seventh person
		// kind that is not a person. So "fill in automatically" on Electronic
		// Arts resolved it to openlibrary.org/authors/OL7329153A, stored that as
		// the identity, and the panel then said "VIA OPENLIBRARY" — truthfully,
		// which is the worst part.
		//
		// Fixing the /people/lookup button alone was not enough and is worth
		// recording as the mistake it was: THIS is the endpoint that persists a
		// source, a source id, a portrait and a bio, so it is the one that had
		// been writing the wrong answer into the database all along.
		igdb, _ := s.resolveIGDB()
		if igdb == nil {
			// No key is not an error here: the caller reports resolved=false and
			// offers the manual fields, exactly as an unfound author does.
			return "", "", "", "", "", "", links, nil
		}
		l, logo, id, cerr := igdb.CompanyLinks(ctx, name)
		if cerr != nil {
			// Best-effort, like the actor and director paths. A studio whose
			// logo could not be fetched is still a studio.
			olog.Warnf(olog.CodePeopleLookupFailed, "[people] studio %q: %v", name, cerr)
			return "", "", "", "", "", "", links, nil
		}
		if l != nil {
			links = l
		}
		if id > 0 {
			source, sourceID = "igdb", strconv.FormatInt(id, 10)
		}
		// No bio, no born, no died: IGDB's company records carry none, and
		// inventing a founding date for a studio is exactly the sort of
		// confident wrongness this app refuses elsewhere.
		return source, sourceID, metadata.IGDBCoverURL(logo), "", "", "", links, nil
	}
	// Everything else falls to the Open Library author path, and WHICH COLUMN
	// disambiguates it is the whole question. The titles are what turn a name into
	// one person rather than a list of namesakes, so a translator looked up against
	// books whose AUTHOR matches their name gets an empty title list and resolves
	// undisambiguated — the first thing that happens when anybody opens a
	// translator chip, and it would look like the provider simply having no record
	// of them.
	col := "author"
	switch kind {
	case "translator", "editor":
		col = kind
	}
	titles, terr := s.creditBookTitles(uid, col, name)
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
// birth year. It starts from the cast mapping — the film IS the disambiguator, so
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
	case source == "tvdb", source == "wikidata":
		// A PINNED IDENTITY IN SOMEBODY ELSE'S NAMESPACE IS STILL A PINNED IDENTITY.
		// A TVDB-only show and a game's Wikidata voice credit both already carry a
		// correct headshot and a correct id — a TVDB peopleId, a Wikidata QID — and
		// neither is a TMDB person id, so neither can be handed to PersonDetails. The
		// only remaining move would be a by-name TMDB search, which could pin a
		// namesake to get a bio, and a bio is not worth the wrong person.
		//
		// `wikidata` arrives here because the cast row names its OWN supplier now
		// (0048) rather than being labelled from the film's tmdb_id/tvdb_id. Under
		// the blob every game credit was labelled "tvdb" — which took this same
		// branch, so the behaviour is unchanged and the word is finally true.
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
// caller's own cast mapping — no external call. It prefers a row that carries
// both a person id and a headshot; failing a headshot anywhere, it still returns
// the identity alone (so the person is pinned). Empty strings mean "no cast row
// in this library names them".
//
// IT READS work_cast AND NOT movies.cast_json, AND THAT IS THE POINT (0048). The
// blob is a provider's list that no /cast edit has ever written, so every name
// the reader owns was invisible here:
//
//   - A CORRECTED NAME STOPPED MATCHING. The mapping now fills dialogues.actor,
//     so a quote saved after the correction carries the corrected spelling, the
//     chip on the people page shows it — and the blob still held the provider's,
//     so the lookup missed and resolveActorMeta fell through to a by-name TMDB
//     search. That fallback's own comment calls it namesake-prone, and pinning an
//     id from the film's own cast is the thing this function exists to do instead.
//   - A GAME'S VOICE CAST WAS NEVER THERE AT ALL. For most games the blob is '[]'
//     (TIP-META-018), so every voice actor in the app was resolved by name.
//
// MATCHED ON actor_key, the table's own folded key (store.CastKey), rather than
// on EqualFold: it is what the rest of the feature calls the same person, and
// idx_work_cast_actor is per-user on exactly that column because "does this actor
// appear in any cast at all?" is the question a rename and an orphan sweep both
// ask. The old query's LIKE over dialogues.actor is gone with the blob — it was
// there to widen the CANDIDATE FILMS for a joint credit stored as "A & B", while
// the decisive comparison was always against a cast entry's own actor name. That
// comparison is now the index lookup, so the widening has nothing left to do.
//
// THE DIALOGUE JOIN IS GONE TOO, and that is a small deliberate widening: a cast
// row no longer needs a quote beside it to be found. The film was always the
// disambiguator; requiring a dialogue as well was an artefact of the blob being
// reachable only through the film. Nothing asks about an actor who has no chip,
// and a chip exists because something already names them.
//
// Tombstones are excluded. A credit the reader deleted is not a place to get a
// headshot from.
func (s *Server) actorPortraitFromCast(uid int64, name string) (source, personID, imageURL string) {
	key := store.CastKey(name)
	if key == "" {
		return "", "", ""
	}
	// ORDER BY: a row with a headshot first, then the provider's billing. The loop
	// below would find the same answer in any order — this makes it the same answer
	// every time, which a person's stored identity had better be.
	rows, err := s.Store.DB.Query(`
		SELECT source, person_id, image_url FROM work_cast
		WHERE user_id = ? AND actor_key = ? AND origin <> ?
		ORDER BY CASE WHEN image_url <> '' THEN 0 ELSE 1 END, billing, id`,
		uid, key, castRemoved)
	if err != nil {
		return "", "", ""
	}
	defer rows.Close()
	var fbSource, fbID string // identity-only fallback (a row with no headshot)
	for rows.Next() {
		var src, pid, img string
		if err := rows.Scan(&src, &pid, &img); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] actor cast row scan failed: %v", err)
			continue
		}
		if img != "" {
			return src, pid, img // best: identity + headshot
		}
		if pid != "" && fbID == "" {
			fbSource, fbID = src, pid // remember, keep looking for a headshot
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
// creditBookTitles lists the caller's books crediting `name` in ONE column, for
// the disambiguation the Open Library lookup needs.
//
// `col` is interpolated, which is the one thing this function has to be careful
// about — it is a column name and SQL has no placeholder for one. Every caller
// passes a literal from resolvePersonPortrait's own switch, never anything that
// reached the process from outside; that is the contract, and it is why the
// switch is there rather than `col := kind`.
func (s *Server) creditBookTitles(uid int64, col, name string) ([]string, error) {
	switch col {
	case "author", "translator", "editor":
	default:
		return nil, errors.New("creditBookTitles: not a credit column: " + col)
	}
	rows, err := s.Store.DB.Query(`
		SELECT title FROM books
		WHERE user_id = ? AND `+col+` IS NOT NULL
		  AND LOWER(`+col+`) LIKE '%' || LOWER(?) || '%'`, uid, name)
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

// getPerson reads one saved person row IN A ROLE; ok=false when there is none,
// which since 0027 also covers "saved, but not under this role".
func (s *Server) getPerson(uid int64, kind, name string) (personRow, bool) {
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people p`+personKindJoin+`
		 WHERE p.user_id = ? AND p.name = ?`, kind, uid, name))
	if err != nil {
		return personRow{}, false
	}
	p.Kind, p.Kinds = kind, s.personKindsOf(p.ID)
	return p, true
}
