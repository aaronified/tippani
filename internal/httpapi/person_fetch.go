package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// ONE PERSON'S FETCH, BY THE RECORD'S ID: POST /people/id/{id}/fetch.
//
// The People row's Fetch was four requests and a fold in the browser: the
// portrait by (kind, name), the reference pages by (kind, name) when the portrait
// brought none, people.jsx's mergeLinks, and a save by id. Two of those spoke
// names, so on the second of two records sharing a name the portrait, the
// identity and the facts landed on the FIRST (the lowest id wins a name), and
// only the links reached the record the reader pressed. And the bulk Fetch
// missing looped the same four from the tab, stopping when the tab did.
//
// Now it is this function, once: the people job loops it, and the row's Fetch is
// one in-request call of it, kept in Settings › Jobs as lookup.person like any
// single lookup. Everything it writes goes onto the record named by id.

// errNoSuchPerson is a record that is not the reader's, or not anybody's: a 404,
// which says nothing about which.
var errNoSuchPerson = errors.New("not found")

// fetchPerson fetches record id of uid's: resolves it as its first role (an
// author from their books, an actor from a film's credits, a studio from IGDB),
// writes the portrait, identity and facts onto it, looks up its reference pages
// when the resolve brought none, folds them into its links keeping every name
// the reader gave one, and saves. It answers the record as it is afterwards and
// the links the fetch found.
//
// Its errors are errNoSuchPerson, a *refusal whose sentence the reader is shown
// (the lookup failed), or anything else (a write failed). A reference-page lookup
// that fails costs the links and not the fetch, as it did in the browser: the
// portrait has been written by then, and it is still worth having.
func (s *Server) fetchPerson(ctx context.Context, uid, id int64) (personRow, map[string]string, error) {
	p, err := s.personByID(uid, id)
	if err != nil {
		return personRow{}, nil, err
	}
	kind := s.fetchKind(uid, id)
	found, err := s.findPortrait(ctx, uid, kind, p.Name)
	if err != nil {
		return personRow{}, nil, &refusal{http.StatusBadGateway, errPortraitLookup}
	}
	if found.pinned() {
		if err := s.persistPortrait(uid, id, kind, found); err != nil {
			return personRow{}, nil, err
		}
	}
	links := found.links
	if len(links) == 0 {
		// Logged where it failed; the fetch goes on without links.
		links, _ = s.lookupLinks(ctx, kind, p.Name)
	}
	if links == nil {
		links = map[string]string{}
	}
	// Folded into the links as they are NOW, read again: the portrait write above
	// does not touch them, but a save of the record's links between the read at
	// the top and this line would otherwise be written over.
	if cur, err := s.personByID(uid, id); err == nil {
		p = cur
	}
	if merged := mergeLinks(p.Links, links); merged != "" && merged != p.Links {
		if err := s.savePersonLinks(uid, id, merged); err != nil {
			return personRow{}, nil, err
		}
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

// savePersonLinks writes record id's links, trimmed, as PUT /people/id/{id}
// writes them when it is sent links alone.
func (s *Server) savePersonLinks(uid, id int64, links string) error {
	_, err := s.Store.DB.Exec(`UPDATE people SET links = ? WHERE id = ? AND user_id = ?`,
		strings.TrimSpace(links), id, uid)
	return err
}

// handlePersonFetch: POST /people/id/{id}/fetch, no body → {person, links}.
func (s *Server) handlePersonFetch(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, links, err := s.fetchPerson(r.Context(), userID(r), id)
	switch ref, refused := asRefusal(err); {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]any{"person": p, "links": links})
	case errors.Is(err, errNoSuchPerson):
		writeErr(w, http.StatusNotFound, "not found")
	case refused:
		writeErr(w, ref.status, ref.msg)
	default:
		internalError(w, r, "person fetch", err)
	}
}
