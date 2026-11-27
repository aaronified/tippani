package httpapi

import (
	"net/http"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Editing what a staged quote SAYS (the owner's ask, 27 November 2026, from the
// Android app's bookmark flow).
//
// handleBulkStaged corrects where a line came from and refuses to touch its words
// — see the long note on its request type, and ADR-0820, which records why: a staged
// row is a record of what the file said. That holds for a file. It does not hold for
// a quote the owner made themselves and sent to the queue to be looked at later
// (the app turns a spoken bookmark into one line of Tippani Markdown and imports
// it, because the owner cannot trim it while driving). Its words are a draft by
// construction, and the only other place to shorten them was after approval, in a
// row that is already in the library.
//
// SO THIS IS A SEPARATE DOOR, AND A SINGLE ROW'S. Not another field on the bulk
// request: "set the text of these 400 quotes" is a request nobody means, and the
// bulk endpoint's refusal of it stays true and stays tested. One quote, by id, from
// the screen that is showing it.
//
// THE HASH MOVES WITH THE WORDS. staged_quotes carries UNIQUE (staged_work_id,
// dedupe_hash), which is what keeps a file's repeated line from being counted twice
// in the queue, and approval dedupes against the library by the same hash. A row
// whose text changed and whose hash did not would be approved as the old words'
// duplicate and skipped, or collide later. It is recomputed exactly as stageQuotes
// computes it. A new text that equals another staged quote's in the same work is
// refused as a 409, naming the clash, instead of merging two rows the owner can
// see as two.

// stagedTextReq mirrors the house convention: absent key = leave alone. A *string
// set to "" clears the field (a note, a translation); the quote itself cannot be
// cleared unless a note is left to stand in for it, because a staged row with no
// words at all has nothing to approve.
type stagedTextReq struct {
	Quote       *string `json:"quote"`
	Note        *string `json:"note"`
	Translation *string `json:"translation"`
}

// maxStagedText is the ceiling the live annotation text has. The staged row held
// whatever the importer read, so a longer one is possible there, but an edit made
// here is held to the one limit a saved quote lives under.
const maxStagedText = 20000

func (req *stagedTextReq) validate() string {
	if req.Quote == nil && req.Note == nil && req.Translation == nil {
		return "nothing to change: send quote, note or translation"
	}
	for _, f := range []struct {
		val  **string
		name string
	}{{&req.Quote, "quote"}, {&req.Note, "note"}, {&req.Translation, "translation"}} {
		if *f.val == nil {
			continue
		}
		trimmed, ok := trimCap(**f.val, maxStagedText)
		if !ok {
			return f.name + " too long (max 20000 characters)"
		}
		*f.val = &trimmed
	}
	return ""
}

// handleEditStagedQuoteText answers PATCH /import/staged/quotes/{id}.
func (s *Server) handleEditStagedQuoteText(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad id")
		return
	}
	var req stagedTextReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	// Ownership the way every staging door has it: another user's id simply does not
	// resolve, so it reads as absent and not as forbidden.
	picked, ok := s.resolveStagedSelection(w, r, uid, stagedSelector{IDs: []int64{id}})
	if !ok {
		return
	}
	if len(picked.QuoteIDs) != 1 {
		writeErr(w, http.StatusNotFound, "no matching staged quote")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "staged text: begin tx", err)
		return
	}
	defer tx.Rollback()

	var quote, note, translation, act, quest string
	var season, episode *int
	if err := tx.QueryRow(`SELECT COALESCE(quote, ''), COALESCE(note, ''), translation, season, episode,
	                              COALESCE(act, ''), COALESCE(quest, '') FROM staged_quotes WHERE id = ?`, id).
		Scan(&quote, &note, &translation, &season, &episode, &act, &quest); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "staged text: read row", err)
		return
	}
	if req.Quote != nil {
		quote = *req.Quote
	}
	if req.Note != nil {
		note = *req.Note
	}
	if req.Translation != nil {
		translation = *req.Translation
	}
	// The words the hash is over, as stageQuotes picks them: the quote, or the note
	// when the row is a note alone.
	text := quote
	if strings.TrimSpace(text) == "" {
		text = note
	}
	if strings.TrimSpace(text) == "" {
		writeErr(w, http.StatusBadRequest, "a quote needs words: keep the quote or a note")
		return
	}
	hash := store.DialogueDedupeHash(text, season, episode, act, quest)

	if _, err := tx.Exec(`UPDATE staged_quotes SET quote = ?, note = ?, translation = ?, dedupe_hash = ? WHERE id = ?`,
		nullable(quote), nullable(note), translation, hash, id); err != nil {
		if isUniqueErr(err) {
			writeErr(w, http.StatusConflict, "another quote waiting in this work already has those words")
			return
		}
		codedError(w, r, olog.CodeImportStagedOp, "staged text: update", err)
		return
	}
	if err := tx.Commit(); err != nil {
		codedError(w, r, olog.CodeImportStagedOp, "staged text: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": 1})
}
