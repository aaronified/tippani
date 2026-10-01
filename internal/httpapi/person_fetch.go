package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/jobs"
)

// ONE PERSON'S FETCH, BY THE RECORD'S ID: POST /people/id/{id}/fetch.
//
// The People row's Fetch was three requests and a fold in the browser: the
// portrait by (kind, name), the reference pages by (kind, name) when the portrait
// brought none, people.jsx's mergeLinks, and a save by id. Two of those spoke
// names, so on the second of two records sharing a name the portrait, the
// identity and the facts landed on the FIRST (the lowest id wins a name), and
// only the links reached the record the reader pressed. And the bulk Fetch
// missing looped the same from the tab, stopping when the tab did.
//
// Now it is this function, once: the people job loops it (runPeople, below),
// and the row's Fetch is one in-request call of it, kept in Settings › Jobs as
// lookup.person like any single lookup. Everything it writes goes onto the
// record named by id.

// errNoSuchPerson is a record that is not the reader's, or not anybody's: a 404,
// which says nothing about which.
var errNoSuchPerson = errors.New("not found")

// fetchPerson fetches record p of uid's, as personByID read it: resolves it as
// its first role (an author from their books, an actor from a film's credits, a
// studio from IGDB), writes the portrait, identity and facts onto it, looks up
// its reference pages when the resolve brought none, folds them into its links
// keeping every name the reader gave one, and saves. It answers the record as it
// is afterwards and the links the fetch found.
//
// THE CALLER READS THE RECORD, because both callers want it before the fetch:
// the row's Fetch names its job after it, and the people job names it in its
// log line, and compares it with what the fetch leaves to say what changed.
//
// Its errors are a *refusal whose sentence the reader is shown (the lookup
// failed), errStoppedItem (a Stop, or the reader going, ended ctx before the
// write), or anything else (a write failed); personByID's own is
// errNoSuchPerson. A reference-page lookup that fails costs the links and not
// the fetch, as it did in the browser: the portrait is still worth having.
//
// EVERY LOOKUP FIRST, THEN ONE WRITE. The portrait, its download and the
// reference pages are all asked for before anything is written, and what they
// found is written in one transaction (saveFetchedPerson). It was a write after
// the portrait and another after the links, so a Stop that landed while the
// links were asked for left a record with a new portrait and its old links: half
// a fetch. Now a Stop anywhere before the write leaves the record exactly as it
// was, and the portrait that had downloaded is removed (job_stop.go).
func (s *Server) fetchPerson(ctx context.Context, uid int64, p personRow) (personRow, map[string]string, error) {
	id := p.ID
	kind := s.fetchKind(uid, id)
	found, err := s.findPortrait(ctx, uid, kind, p.Name)
	if ctx.Err() != nil {
		s.removeCoverFile(found.image)
		return personRow{}, nil, errStoppedItem
	}
	if err != nil {
		return personRow{}, nil, &refusal{http.StatusBadGateway, errPortraitLookup}
	}
	links := found.links
	if len(links) == 0 {
		// Logged where it failed; the fetch goes on without links.
		links, _ = s.lookupLinks(ctx, kind, p.Name)
	}
	if links == nil {
		links = map[string]string{}
	}
	if ctx.Err() != nil {
		s.removeCoverFile(found.image)
		return personRow{}, nil, errStoppedItem
	}
	if err := s.saveFetchedPerson(uid, id, kind, found, links); err != nil {
		return personRow{}, nil, err
	}
	p, err = s.personByID(uid, id)
	if err != nil {
		return personRow{}, nil, err
	}
	p.Kind = kind
	return p, links, nil
}

// personByID reads record id of uid's with its roles as person_kinds files them;
// errNoSuchPerson when uid has none.
func (s *Server) personByID(uid, id int64) (personRow, error) {
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people p WHERE p.user_id = ? AND p.id = ?`, uid, id))
	if errors.Is(err, sql.ErrNoRows) {
		return personRow{}, errNoSuchPerson
	}
	if err != nil {
		return personRow{}, err
	}
	p.Kinds = s.personKindsOf(id)
	return p, nil
}

// fetchKind is the kind a record's Fetch resolves it as: the first of its roles,
// as the People console lists them (GET /people/records: every role its credits
// give it, in alphabetical order), that is a person kind, or author for a record
// no credit names — which is most of them, and what the browser's Fetch sent.
//
// A STUDIO IS CREDITED AS ITS GAME'S DIRECTOR. 0040 put both in movies.director,
// so the credit's role is "director" either way, and a studio fetched as a
// director would be looked up among TMDB's people, where it is not. A director
// credit on a game reads as studio here, which is what sends it to IGDB.
func (s *Server) fetchKind(uid, id int64) string {
	rows, err := s.Store.DB.Query(`
		SELECT CASE WHEN wp.role = 'director' AND wp.kind = 'movie'
		             AND EXISTS (SELECT 1 FROM movies m WHERE m.id = wp.work_id AND m.media_type = 'game')
		            THEN 'studio' ELSE wp.role END
		  FROM work_person wp WHERE wp.user_id = ? AND wp.person_id = ?
		UNION
		SELECT 'actor' FROM work_cast
		 WHERE user_id = ? AND actor_id = ? AND origin <> 'removed'
		UNION
		SELECT 'speaker' FROM utterances WHERE user_id = ? AND speaker_id = ?
		UNION
		SELECT 'actor' FROM dialogues d JOIN movies m ON m.id = d.movie_id
		 WHERE m.user_id = ? AND d.actor_id = ?
		ORDER BY 1`, uid, id, uid, id, uid, id, uid, id)
	if err != nil {
		return "author"
	}
	defer rows.Close()
	for rows.Next() {
		var role string
		if rows.Scan(&role) == nil && validPersonKind(role) {
			return role
		}
	}
	return "author"
}

// saveFetchedPerson writes what a record's fetch found onto record id of uid's,
// in one transaction: the portrait, identity and facts when the resolve pinned
// anything (persistPortraitOn), and the links folded into the record's links. It
// removes the downloaded portrait when the write fails, and the portrait it
// replaced once the write has committed.
//
// THE LINKS ARE FOLDED INTO THE LINKS AS THEY ARE NOW, read inside the
// transaction: a save of the record's links between the caller's read and this
// write would otherwise be written over.
func (s *Server) saveFetchedPerson(uid, id int64, kind string, f portraitFind, links map[string]string) error {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(f.image)
		return err
	}
	defer tx.Rollback()
	oldImage := ""
	if f.pinned() {
		if oldImage, err = persistPortraitOn(tx, uid, id, kind, f); err != nil {
			s.removeCoverFile(f.image)
			return err
		}
	}
	var cur, curSources string
	if err := tx.QueryRow(`SELECT links, link_sources FROM people WHERE id = ? AND user_id = ?`, id, uid).Scan(&cur, &curSources); err == nil {
		if merged := mergeLinks(cur, links); merged != "" && merged != cur {
			// A fetched address is credited to the supplier that answered; the
			// ones already there keep theirs.
			merged = strings.TrimSpace(merged)
			if _, err := tx.Exec(`UPDATE people SET links = ?, link_sources = ? WHERE id = ? AND user_id = ?`,
				merged, relinkSources(cur, merged, readLinkSources(curSources), linkSupplierFor(kind)), id, uid); err != nil {
				s.removeCoverFile(f.image)
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		s.removeCoverFile(f.image)
		return err
	}
	if f.image != "" && oldImage != "" && oldImage != f.image {
		s.removeCoverFile(oldImage) // best-effort; the new row is committed
	}
	return nil
}

// runPeople is the people job: a record's Fetch, for each record the job names,
// one at a time, with a line in its log for each saying what the fetch found or
// why it failed. Its counts are what the People screen's flash says: how many
// were fetched, how many failed, and why the first one did, in the sentence the
// row's own Fetch would have shown. A Stop leaves the record in hand as it was
// (fetchPerson), and it is counted neither way.
func runPeople(s *Server, ctx context.Context, j *jobs.Job) error {
	var p struct {
		IDs []int64 `json:"ids"`
		// Missing is "Fetch missing people": every record of the owner's that
		// lacks links or a portrait, read as the job starts (validateEvery).
		Missing bool `json:"missing"`
	}
	if err := j.Params(&p); err != nil {
		return err
	}
	if p.Missing {
		var err error
		if p.IDs, err = s.everyMissingPerson(j); err != nil {
			return err
		}
	}
	uid := j.Owner().UserID
	ok, failed, firstErr := 0, 0, ""
	for i, id := range p.IDs {
		if !s.goOn(j, i) {
			break
		}
		before, err := s.personByID(uid, id)
		var after personRow
		if err == nil {
			after, _, err = s.fetchPerson(ctx, uid, before)
		}
		name := itemName("person", id, before.Name)
		if errors.Is(err, errStoppedItem) {
			abandoned(j, name)
			break
		}
		if err != nil {
			failed++
			said, cause := personFetchSaid(err)
			if firstErr == "" {
				firstErr = said
			}
			j.Log(jobs.LevelWarn, "%s — failed: %s", name, cause)
		} else {
			ok++
			j.Log(jobs.LevelInfo, "%s — %s", name, personFetchFound(before, after))
		}
		j.Progress(i+1, len(p.IDs))
	}
	return j.SetResult(map[string]any{"ok": ok, "failed": failed, "first_error": firstErr})
}

// personFetchSaid is what a failed fetch tells the reader, as the row's Fetch
// answers it, and what its log line says: the same, but for a failure of the
// server's own, whose cause the reader is not shown and the log is.
func personFetchSaid(err error) (said, cause string) {
	if errors.Is(err, errNoSuchPerson) {
		return "not found", "not found"
	}
	if ref, ok := asRefusal(err); ok {
		return ref.msg, ref.msg
	}
	return "internal error", "internal error: " + err.Error()
}

// personFetchFound is what a fetch changed on a record, from the record before
// and after: "portrait, identity, bio, links", or that it found nothing new.
func personFetchFound(before, after personRow) string {
	var got []string
	if after.ImagePath != "" && after.ImagePath != before.ImagePath {
		got = append(got, "portrait")
	}
	if after.Source != "" && (after.Source != before.Source || after.SourceID != before.SourceID) {
		got = append(got, "identity ("+after.Source+")")
	}
	for _, f := range []struct{ name, was, is string }{
		{"bio", before.Bio, after.Bio}, {"born", before.Born, after.Born}, {"died", before.Died, after.Died},
		{"links", before.Links, after.Links},
	} {
		if f.is != f.was {
			got = append(got, f.name)
		}
	}
	if len(got) == 0 {
		return "nothing new found"
	}
	return "found " + strings.Join(got, ", ")
}

// handlePersonFetch: POST /people/id/{id}/fetch, no body → {person, links}.
func (s *Server) handlePersonFetch(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	p, err := s.personByID(uid, id)
	var links map[string]string
	if err == nil {
		jobSubject(r.Context(), p.Name)
		p, links, err = s.fetchPerson(r.Context(), uid, p)
	}
	switch ref, refused := asRefusal(err); {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]any{"person": p, "links": links})
	case errors.Is(err, errStoppedItem):
		// The reader went before the fetch could write: nothing was written, and
		// nobody is waiting for an answer, so there is no error to report.
		writeErr(w, http.StatusServiceUnavailable, "the fetch was cut short before anything was written")
	case errors.Is(err, errNoSuchPerson):
		writeErr(w, http.StatusNotFound, "not found")
	case refused:
		writeErr(w, ref.status, ref.msg)
	default:
		internalError(w, r, "person fetch", err)
	}
}
