package httpapi

// EVERYTHING BEHIND ONE TILE — the carousel chooser on a character or a person
// screen, and the two counts the screens print beside it.
//
// GET /{books|movies}/{id}/whos-in-it
//
// WHY THE CHOOSER IS EXHAUSTIVE, which is the owner's ruling and not the design
// pack's drawing. The pack lists, for a tile on a person's strip, the work, the
// one character that person plays in it, and the credit. Its own comment points
// past that — "a work with two roles lists both characters here — which is why
// this is a list" — and the ruling finished the thought: a tile opens the work's
// own page, every character linked to that work, and every person credited in it,
// and the reader picks. The alternative is a tile whose answer depends on which
// screen you arrived from, so the same cover behaves differently in two places.
//
// ONE REQUEST, because a chooser opens on a press and a reader will not wait for
// three. The three lists come off three cheap indexed reads on rows the work
// already owns.
//
// AND THE COUNTS RIDE ALONG, because they are the same question asked per
// character: how much of this character have you actually kept in this work. The
// screens print them as "37 quotes · 19 chapters"; see locatorNoun for what the
// second one counts and why the noun changes with the medium.

import (
	"database/sql"
	"net/http"

	"tippani/internal/olog"
)

// whosWork is the tile's own destination: the work's page in the app.
type whosWork struct {
	Kind      string `json:"kind"` // book | movie
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Cover     string `json:"cover"`
	Year      int    `json:"year"`
	MediaType string `json:"media_type,omitempty"`
}

// whosCharacter is one character linked to the work, with the counts the pair()
// row prints. CastID is the row that links them, which is what the local screen
// is keyed on — a work may bill one character twice (0056's own note: the young
// Vito and the old Vito), so the character id alone does not name a screen.
type whosCharacter struct {
	CastID      int64  `json:"cast_id"`
	CharacterID int64  `json:"character_id,omitempty"`
	Name        string `json:"name"`
	Image       string `json:"image_path"`
	Quotes      int    `json:"quotes"`
	// Locators is how many distinct places in this work this character speaks
	// from, and LocatorNoun is what those places are called here.
	Locators    int    `json:"locators"`
	LocatorNoun string `json:"locator_noun"`
}

// whosPerson is somebody credited on the work, in any role. One row per person
// however many roles they hold: the pack's own screen is called people-global and
// not actor-global, because "actor" is a role somebody holds on one work and this
// is the person.
type whosPerson struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Image string `json:"image_path"`
	Roles string `json:"roles"` // "performer · author", the work's own words joined
}

// locatorNoun answers what a work's places are called, and what column holds
// them.
//
// THE OWNER'S RULING, in their words: "in a movie all scenes are distinct
// anyway". So the second count is a DISTINCT over this character's own quotes
// rather than a stored total of the work's scenes — which nothing records and
// which no provider reports. A book counts chapters, a film scenes, a game
// quests, and each is the locator column that medium's quotes actually carry.
//
// THE BLANK IS ONE OF THE VALUES, also the owner's: a work where nobody has
// filled a locator counts one place rather than none, because the quotes are
// somewhere even when nobody has said where. COUNT(DISTINCT) drops NULLs, so the
// column is coalesced first — dropping them would report 0 places for lines that
// plainly exist.
func locatorNoun(kind, mediaType string) (noun, expr string) {
	if kind == "book" {
		return "chapter", `COALESCE(CAST(a.chapter_no AS TEXT), '')`
	}
	if mediaType == "game" {
		return "quest", `COALESCE(d.quest, '')`
	}
	return "scene", `COALESCE(d.timestamp, '')`
}

// handleWhosInIt: GET /{books|movies}/{id}/whos-in-it
func (s *Server) handleWhosInIt(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		uid := userID(r)
		// castWork is the ownership check for every work-scoped verb here, and a
		// foreign work is 404 rather than 403 — a 403 confirms the row exists.
		if _, ok := s.castWork(uid, kind, workID); !ok {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		work, err := s.whosWorkRow(uid, kind, workID)
		if err != nil {
			internalError(w, r, "whos-in-it: work", err)
			return
		}
		chars, err := s.whosCharacters(uid, kind, workID, work.MediaType)
		if err != nil {
			internalError(w, r, "whos-in-it: characters", err)
			return
		}
		people, err := s.whosPeople(uid, kind, workID)
		if err != nil {
			internalError(w, r, "whos-in-it: people", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"work": work, "characters": chars, "people": people,
		})
	}
}

func (s *Server) whosWorkRow(uid int64, kind string, workID int64) (whosWork, error) {
	out := whosWork{Kind: kind, ID: workID}
	if kind == "book" {
		err := s.Store.DB.QueryRow(
			`SELECT title, COALESCE(cover_path, ''), COALESCE(published_year, 0)
			   FROM books WHERE id = ? AND user_id = ?`, workID, uid).
			Scan(&out.Title, &out.Cover, &out.Year)
		return out, err
	}
	err := s.Store.DB.QueryRow(
		`SELECT title, COALESCE(poster_path, ''), COALESCE(release_year, 0), COALESCE(media_type, 'movie')
		   FROM movies WHERE id = ? AND user_id = ?`, workID, uid).
		Scan(&out.Title, &out.Cover, &out.Year, &out.MediaType)
	return out, err
}

// whosCharacters lists the work's cast with each row's counts.
//
// THE COUNTS ARE ONE QUERY AND NOT ONE PER ROW. A film with a forty-name cast
// would otherwise be eighty round trips for a panel that opens on a press, and
// the join is on the index 0056 added for exactly this (idx_dialogues_speaker).
//
// A TOMBSTONE IS NOT IN THE LIST. `origin <> 'removed'` — a row the reader
// unlinked is gone as far as any screen is concerned, and it survives only so a
// refetch can decline to bring it back.
func (s *Server) whosCharacters(uid int64, kind string, workID int64, mediaType string) ([]whosCharacter, error) {
	noun, locator := locatorNoun(kind, mediaType)
	var q string
	if kind == "book" {
		q = `SELECT c.id, COALESCE(c.character_id, 0), c.character,
		            COALESCE(NULLIF(c.character_image_path, ''),
		                     COALESCE((SELECT ch.image_path FROM characters ch
		                                WHERE ch.id = c.character_id AND ch.user_id = c.user_id), '')),
		            COUNT(a.id), COUNT(DISTINCT ` + locator + `)
		       FROM work_cast c
		       LEFT JOIN annotations a ON a.speaker_cast_id = c.id
		      WHERE c.user_id = ? AND c.kind = ? AND c.work_id = ? AND c.origin <> ?
		      GROUP BY c.id
		      ORDER BY c.billing, c.id`
	} else {
		q = `SELECT c.id, COALESCE(c.character_id, 0), c.character,
		            COALESCE(NULLIF(c.character_image_path, ''),
		                     COALESCE((SELECT ch.image_path FROM characters ch
		                                WHERE ch.id = c.character_id AND ch.user_id = c.user_id), '')),
		            COUNT(d.id), COUNT(DISTINCT ` + locator + `)
		       FROM work_cast c
		       LEFT JOIN dialogues d ON d.speaker_cast_id = c.id
		      WHERE c.user_id = ? AND c.kind = ? AND c.work_id = ? AND c.origin <> ?
		      GROUP BY c.id
		      ORDER BY c.billing, c.id`
	}
	rows, err := s.Store.DB.Query(q, uid, kind, workID, castRemoved)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []whosCharacter{}
	for rows.Next() {
		var c whosCharacter
		if err := rows.Scan(&c.CastID, &c.CharacterID, &c.Name, &c.Image, &c.Quotes, &c.Locators); err != nil {
			return nil, err
		}
		// A CHARACTER WITH NO QUOTES HAS NO PLACES EITHER. The LEFT JOIN yields one
		// null row for such a cast member, and COUNT(DISTINCT COALESCE(null,''))
		// counts that as one — a place the character does not in fact speak from.
		if c.Quotes == 0 {
			c.Locators = 0
		}
		c.LocatorNoun = noun
		out = append(out, c)
	}
	return out, rows.Err()
}

// whosPeople lists everybody the work credits, in any role, one row per person.
//
// TWO SOURCES, because a work credits people two ways: `work_person` holds the
// makers (author, translator, director, studio) and `work_cast.actor_id` holds
// the performers. A person can be both — the pack's own example is a performer
// who wrote a book — so the roles are gathered per person rather than the person
// being listed twice under two headings.
func (s *Server) whosPeople(uid int64, kind string, workID int64) ([]whosPerson, error) {
	rows, err := s.Store.DB.Query(
		`SELECT p.id, p.name, COALESCE(p.image_path, ''), GROUP_CONCAT(DISTINCT x.role)
		   FROM (
		          SELECT person_id, role FROM work_person
		           WHERE user_id = ? AND kind = ? AND work_id = ?
		          UNION ALL
		          SELECT actor_id AS person_id, 'performer' AS role FROM work_cast
		           WHERE user_id = ? AND kind = ? AND work_id = ?
		             AND actor_id IS NOT NULL AND origin <> ?
		        ) x
		   JOIN people p ON p.id = x.person_id AND p.user_id = ?
		  GROUP BY p.id
		  ORDER BY p.name`,
		uid, kind, workID, uid, kind, workID, castRemoved, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []whosPerson{}
	for rows.Next() {
		var p whosPerson
		var roles sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &p.Image, &roles); err != nil {
			return nil, err
		}
		p.Roles = roles.String
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[identity] whos-in-it people: %v", err)
		return nil, err
	}
	return out, nil
}
