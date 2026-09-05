package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
)

// A PICTURE FROM THIS MACHINE — the design pack's "Upload", which is the one of
// its four picture verbs the app had no path for at all.
//
// `character-popup.dc.html:1257-1260` names three ways a picture arrives and
// calls them "the repo's order": Fetch (ask the suppliers), Upload (a file from
// this machine), Paste URL (from the web, by address). Two of the three were
// built — `POST /cast/{id}/image` fetches and also takes a pasted address — and
// the third had no route, so the screen drew two verbs where the pack draws
// three. Drawing the button without this would have been the exact false
// affordance the rest of this work has been taking out: a control that looks
// live, presses, and does nothing.
//
// WHY THIS IS THREE HANDLERS AND NOT ONE. The three tables are three different
// ownership questions, and only one of them is "is this row yours":
//
//	work_cast     — yours AND not a tombstone. 0048 keeps a removed pairing as a
//	                row so a provider refetch cannot resurrect it, so `origin =
//	                'removed'` is this table's word for "not on the list", and
//	                every other cast route already 404s one.
//	characters    — yours, which `identityTarget` already answers for both
//	people        —   identity tables and answers the same way.
//
// A shared handler would have to carry all three questions and a switch to pick
// between them, which is the same code with a parameter in front of it.
//
// EVERYTHING AFTER THE CHECK IS `uploadCover`, unchanged and already generic:
// the 12 MB envelope, `metadata.StoreImage`'s decode-and-cap, the UPDATE, and
// deleting the file the row used to point at. A second copy of that would be a
// second place the size cap, the accepted formats and the orphan cleanup have to
// agree — and they would agree until one was edited.
//
// THE REPLY IS THE STORED NAME, which is what the caller needs and what the
// fetch route already answers with. The three screens redraw from it directly
// rather than reloading the record, so the picture appears on the press.

// handleCastImageUpload: POST /cast/{id}/image/upload, multipart "file".
// This work's own picture of the character — the same column `POST
// /cast/{id}/image` writes from a URL, so nothing downstream can tell a fetched
// picture from an uploaded one. That is the property the chips depend on.
func (s *Server) handleCastImageUpload(w http.ResponseWriter, r *http.Request) {
	castID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	// Ownership BEFORE the body is read, and another reader's row is a 404 rather
	// than a 403 — the per-user rule the whole API follows, so one reader cannot
	// learn that another reader's row exists.
	var origin string
	err := s.Store.DB.QueryRow(
		`SELECT origin FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&origin)
	switch {
	case errors.Is(err, sql.ErrNoRows), err == nil && origin == castRemoved:
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	case err != nil:
		internalError(w, r, "load cast row", err)
		return
	}
	s.uploadCover(w, r, "work_cast", "character_image_path")
}

// handleCharacterImageUpload: POST /characters/{id}/image/upload, multipart
// "file". The identity's own picture — what every work without one falls back
// to, which is why `PUT /characters/{id}/image` guards its promote path so
// carefully. An upload is the reader choosing directly and needs no such guard:
// the bytes are theirs, not another appearance's.
func (s *Server) handleCharacterImageUpload(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.identityTarget(w, r, "characters"); !ok {
		return
	}
	s.uploadCover(w, r, "characters", "image_path")
}

// handlePersonImageUpload: POST /people/id/{id}/portrait, multipart "file".
// Under /people/id/ with the record's other by-id routes, and NOT beside `POST
// /people/portrait` — that one resolves a portrait from the catalogue by
// {kind, name} and answers with a whole person; this one stores bytes against an
// id. Two routes that took a picture but disagreed about what addresses a person
// would be one route too many to keep straight.
func (s *Server) handlePersonImageUpload(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.identityTarget(w, r, "people"); !ok {
		return
	}
	s.uploadCover(w, r, "people", "image_path")
}
