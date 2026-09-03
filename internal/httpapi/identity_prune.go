package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Pruning the records nothing points at any more.
//
// WHY THIS IS NOT THE ORPHAN GC. gcOrphanPeople (people_handlers.go) already runs
// after the mutations that can strand a name — an author renamed, a film's cast
// rewritten — and it is keyed on ONE kind and matches BY NAME, because that is
// what those mutations change. It cannot answer "what is stranded right now": a
// record can be left behind by a path that never calls it (a work deleted out of
// the bin's retention window, an import approved and then withdrawn, a merge
// undone), and nothing sweeps afterwards. So a reader who has been using the app
// for a year has a people list with rows in it that belong to nothing, and the
// only way to clear them has been one delete at a time.
//
// THE DEFINITION IS THE LIST'S OWN, not the delete's. store.DeletePersonRecord
// refuses on work_person credits alone, which would let this prune an actor who
// holds cast rows and no credits — someone the records list shows as being on
// three works. The two counts this uses are exactly the two columns that list
// selects (identity_handlers.go, handlePeopleRecords), plus the lines count, so a
// row is pruned only when every number the reader can see against it is zero. A
// person with no works but a quote they spoke is NOT an orphan; something still
// points at them, and the point of the button is to remove what nothing points at.
//
// ONE BIN ENTRY PER RECORD, not one for the batch. A batch would need a new
// trash kind, and trash.kind is a CHECK constraint — three migrations so far have
// rebuilt that table to add one word (0032, 0058, 0060). Per record costs nothing:
// 'person-delete' and 'character-delete' are already allowed, the reversal already
// exists, and the reader gets each pruned name back on its own rather than having
// to restore forty to recover one.

// orphanPerson is one row of either kind, as the confirm dialog needs it.
type orphanPerson struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Image string `json:"image_path"`
}

// The two orphan queries. Kept as constants beside each other because they are one
// definition in two tables, and a change to one that misses the other is a prune
// that clears characters on a rule people are not held to.
const orphanPeopleSQL = `
	SELECT p.id, p.name, p.image_path FROM people p
	 WHERE p.user_id = ?
	   AND NOT EXISTS (SELECT 1 FROM work_person wp WHERE wp.user_id = p.user_id AND wp.person_id = p.id)
	   AND NOT EXISTS (SELECT 1 FROM work_cast wc WHERE wc.user_id = p.user_id AND wc.actor_id = p.id
	                                                AND wc.origin <> 'removed')
	   AND NOT EXISTS (SELECT 1 FROM utterances u WHERE u.user_id = p.user_id AND u.speaker_id = p.id)
	   AND NOT EXISTS (SELECT 1 FROM dialogues d JOIN movies m ON m.id = d.movie_id
	                    WHERE m.user_id = p.user_id AND d.actor_id = p.id)
	 ORDER BY CASE WHEN p.sort_name <> '' THEN p.sort_name ELSE p.name END COLLATE NOCASE, p.id`

const orphanCharactersSQL = `
	SELECT c.id, c.name, c.image_path FROM characters c
	 WHERE c.user_id = ?
	   AND NOT EXISTS (SELECT 1 FROM work_cast wc WHERE wc.user_id = c.user_id AND wc.character_id = c.id
	                                                AND wc.origin <> 'removed')
	 ORDER BY CASE WHEN c.sort_name <> '' THEN c.sort_name ELSE c.name END COLLATE NOCASE, c.id`

func orphanRows(q interface {
	Query(string, ...any) (*sql.Rows, error)
}, sqlText string, uid int64) ([]orphanPerson, error) {
	rows, err := q.Query(sqlText, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []orphanPerson{}
	for rows.Next() {
		var o orphanPerson
		if err := rows.Scan(&o.ID, &o.Name, &o.Image); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] orphan row scan failed: %v", err)
			continue
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// handleOrphans: GET /people/orphans — what a prune would take.
//
// The rows and not just a count, because the button opens a confirm and a confirm
// that says "remove 23 records" without naming one is a dialog a reader cannot
// answer. The names are what make it answerable.
func (s *Server) handleOrphans(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	people, err := orphanRows(s.Store.DB, orphanPeopleSQL, uid)
	if err != nil {
		internalError(w, r, "list orphan people", err)
		return
	}
	characters, err := orphanRows(s.Store.DB, orphanCharactersSQL, uid)
	if err != nil {
		internalError(w, r, "list orphan characters", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"people": people, "characters": characters})
}

// handlePrune: POST /people/prune — delete every orphan, to the bin.
//
// ONE TRANSACTION for the whole sweep. A prune that half-ran would leave the
// reader looking at a list they had just asked to be rid of, with no way to tell
// which half went; and the images are unlinked only after the commit, so a
// rollback cannot take a portrait with it.
func (s *Server) handlePrune(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()

	// Re-read inside the transaction rather than trusting what the client saw:
	// the list it was drawn from may be minutes old, and a record that has since
	// been credited on a work is one this must not touch.
	people, err := orphanRows(tx, orphanPeopleSQL, uid)
	if err != nil {
		internalError(w, r, "read orphan people", err)
		return
	}
	characters, err := orphanRows(tx, orphanCharactersSQL, uid)
	if err != nil {
		internalError(w, r, "read orphan characters", err)
		return
	}

	var files []string
	for _, kind := range []string{"person", "character"} {
		list := people
		if kind == "character" {
			list = characters
		}
		for _, o := range list {
			var undo *store.RecordDeleteUndo
			var image string
			if kind == "person" {
				undo, image, err = store.DeletePersonRecord(tx, uid, o.ID)
			} else {
				undo, image, err = store.DeleteCharacterRecord(tx, uid, o.ID)
			}
			if err != nil {
				// A refusal here is not a reader's problem to solve, it is this
				// file's rule disagreeing with the store's — the queries above
				// selected a row the delete then declined. That is a bug, and a
				// 500 says so rather than pruning most of the list and shrugging.
				internalError(w, r, "prune "+kind, err)
				return
			}
			payload, err := json.Marshal(undo)
			if err != nil {
				internalError(w, r, "prune: write the undo", err)
				return
			}
			fileJSON := "[]"
			if image != "" {
				if b, err := json.Marshal([]string{image}); err == nil {
					fileJSON = string(b)
				}
				files = append(files, image)
			}
			children := len(undo.Aliases) + len(undo.Cast) + len(undo.Screen) + len(undo.Utterance)
			if _, err := tx.Exec(
				`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				uid, kind+"-delete", o.Name, children, string(payload), fileJSON); err != nil {
				internalError(w, r, "prune: park the undo", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "prune: commit", err)
		return
	}
	if len(files) > 0 {
		s.parkFiles(files)
	}
	olog.Printf("[identity] pruned %d people and %d characters for user %d", len(people), len(characters), uid)
	writeJSON(w, http.StatusOK, map[string]any{
		"people":     len(people),
		"characters": len(characters),
	})
}
