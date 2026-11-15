package httpapi

// WHAT ONE ENTRY SHOWS AND SAYS (0094).
//
// An anthology's switches (anthology_registry.go) decide which parts of a quote it prints. Two things sit under that:
//
//   AN OVERRIDE PER ENTRY. `anthology_entries.fields` is {key: true|false}; an entry that names a key shows or hides
//   that part whatever the anthology says, and one that does not inherits. forEntry is the one place the two are
//   combined, so the reading view, the Markdown and the EPUB cannot disagree about what an entry shows.
//
//   A RESTATEMENT PER ENTRY. `anthology_entries.edits` is {key: text} for the parts an anthology may say in its own
//   words: the quote, its note, its translation and the context before and after it. They are
//   applied to the row after it is read, so every renderer prints the anthology's version without knowing there is
//   one, and the quote in the library is never written through them. The original rides along in `Originals` for
//   the keys that were restated, because the editor has to be able to show what "put it back" would put back.
//
// THE CONTEXT IS A PAIR, not a field: the window of the source before the quote and the window after it, each its
// own text. It is read through renderContext, the same function the quote's own panel uses, so what an anthology
// shows as context is what the quote shows, narrowed by the same rules, until it is restated here.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

// anthologyEditKeys are the parts an entry may restate. `context_before` and `context_after` are the two halves of the
// `context` switch.
var anthologyEditKeys = map[string]bool{
	"quote": true, "note": true, "translation": true,
	"context_before": true, "context_after": true,
}

const anthologyEditMax = 20000

// forEntry is the anthology's switches with one entry's overrides laid over them. A key an entry does not name
// inherits; a key the registry does not know is ignored, as it is everywhere else.
func (f anthologyFields) forEntry(over map[string]bool) anthologyFields {
	if len(over) == 0 {
		return f
	}
	out := f
	out.Extra = make(map[string]bool, len(f.Extra)+len(over))
	for k, v := range f.Extra {
		out.Extra[k] = v
	}
	for k, v := range over {
		def, ok := anthologyFieldByKey[k]
		if !ok {
			continue
		}
		if def.stored() {
			out.Extra[k] = v
			continue
		}
		switch k {
		case "credit":
			out.HideCredit = !v
		case "source":
			out.HideSource = !v
		case "commentary":
			out.HideCommentary = !v
		case "colour":
			out.HideColour = !v
		case "locator":
			out.ShowLocator = v
		case "date":
			out.ShowDate = v
		}
	}
	return out
}

// kindOfEntry maps an anthology entry's kind onto the vocabulary the quote tables and source_context speak.
func subjectOfKind(kind string) string {
	switch kind {
	case kindBook:
		return "annotation"
	case kindScreen:
		return "dialogue"
	}
	return "utterance"
}

// attachEntryDisplay reads each entry's overrides and restatements off the entries table.
func (s *Server) attachEntryDisplay(id int64, out []anthologyEntryRow) error {
	rows, err := s.Store.DB.Query(`SELECT kind, item_id, fields, edits FROM anthology_entries
	                               WHERE anthology_id = ? AND (fields <> '' OR edits <> '')`, id)
	if err != nil {
		return err
	}
	defer rows.Close()
	type pair struct{ fields, edits string }
	have := map[string]pair{}
	for rows.Next() {
		var kind string
		var item int64
		var p pair
		if err := rows.Scan(&kind, &item, &p.fields, &p.edits); err != nil {
			return err
		}
		have[kind+":"+strconv.FormatInt(item, 10)] = p
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range out {
		p, ok := have[out[i].Kind+":"+strconv.FormatInt(out[i].ItemID, 10)]
		if !ok {
			continue
		}
		out[i].Fields = decodeEntryFields(p.fields)
		out[i].Edits = decodeEntryEdits(p.edits)
	}
	return nil
}

func decodeEntryFields(s string) map[string]bool {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var m map[string]bool
	if json.Unmarshal([]byte(s), &m) != nil {
		return nil
	}
	for k := range m {
		if _, ok := anthologyFieldByKey[k]; !ok {
			delete(m, k)
		}
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

func decodeEntryEdits(s string) map[string]string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var m map[string]string
	if json.Unmarshal([]byte(s), &m) != nil {
		return nil
	}
	for k := range m {
		if !anthologyEditKeys[k] {
			delete(m, k)
		}
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

// attachQuoteParts fills what the quote itself carries and the entry query does not: its translation, its tags and the
// context around it. The translation and tag reads are one query per kind over the ids the entries name; the context is
// read per entry, through renderContext, because the span it is cut to is a rule of the quote's own work.
func (s *Server) attachQuoteParts(uid int64, out []anthologyEntryRow) error {
	byKind := map[string][]int{}
	for i := range out {
		byKind[out[i].Kind] = append(byKind[out[i].Kind], i)
	}
	type spec struct{ table, tags, tagKey, owner string }
	specs := map[string]spec{
		kindBook:      {"annotations", "annotation_tags", "annotation_id", "id IN (SELECT a.id FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?)"},
		kindScreen:    {"dialogues", "dialogue_tags", "dialogue_id", "id IN (SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)"},
		kindUtterance: {"utterances", "utterance_tags", "utterance_id", "user_id = ?"},
	}
	for kind, idx := range byKind {
		sp := specs[kind]
		ids := make([]any, 0, len(idx)+1)
		for _, i := range idx {
			ids = append(ids, out[i].ItemID)
		}
		at := map[int64]*anthologyEntryRow{}
		for _, i := range idx {
			at[out[i].ItemID] = &out[i]
		}
		ph := placeholders(len(ids))
		rows, err := s.Store.DB.Query(`SELECT id, COALESCE(translation,'') FROM `+sp.table+
			` WHERE id IN (`+ph+`) AND `+sp.owner, append(append([]any{}, ids...), uid)...)
		if err != nil {
			return err
		}
		for rows.Next() {
			var id int64
			var tr string
			if err := rows.Scan(&id, &tr); err != nil {
				rows.Close()
				return err
			}
			if e := at[id]; e != nil {
				e.Translation = tr
			}
		}
		if err := rows.Close(); err != nil {
			return err
		}
		trows, err := s.Store.DB.Query(`SELECT x.`+sp.tagKey+`, t.name FROM `+sp.tags+` x JOIN tags t ON t.id = x.tag_id
		                                 WHERE x.`+sp.tagKey+` IN (`+ph+`) AND t.user_id = ? ORDER BY t.name`,
			append(append([]any{}, ids...), uid)...)
		if err != nil {
			return err
		}
		for trows.Next() {
			var id int64
			var name string
			if err := trows.Scan(&id, &name); err != nil {
				trows.Close()
				return err
			}
			if e := at[id]; e != nil {
				e.Tags = append(e.Tags, name)
			}
		}
		if err := trows.Close(); err != nil {
			return err
		}
		for _, i := range idx {
			a, err := s.renderContext(uid, subjectOfKind(kind), out[i].ItemID, nil, nil)
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			if err != nil {
				return err
			}
			out[i].ContextBefore, out[i].ContextAfter = a.Before, a.After
		}
	}
	return nil
}

// applyEdits lays an entry's restatements over what the library says, keeping the library's words in Originals for
// the keys that were restated. The quote's own row is not touched: this edits the copy in the response.
func applyEdits(out []anthologyEntryRow) {
	for i := range out {
		e := &out[i]
		if len(e.Edits) == 0 {
			continue
		}
		e.Originals = map[string]string{}
		set := func(key string, field *string) {
			if v, ok := e.Edits[key]; ok {
				e.Originals[key] = *field
				*field = v
			}
		}
		set("quote", &e.Quote)
		set("note", &e.QuoteNote)
		set("translation", &e.Translation)
		set("context_before", &e.ContextBefore)
		set("context_after", &e.ContextAfter)
	}
}

// PUT /anthologies/{id}/entries/{kind}/{itemID}/display — what this entry shows and says, in this anthology only.
//
//	{"fields": {"translation": true, "note": null}, "edits": {"context_after": "…", "quote": null}}
//
// A `null` clears that key (back to inheriting, or back to the quote's own words); a present value sets it. A key that
// the body does not mention is left as it is, so a client changing one thing sends one thing. The quote itself is
// never written: that is the point of keeping these on the entry.
func (s *Server) handleAnthologyEntryDisplay(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid anthology id")
		return
	}
	kind := r.PathValue("kind")
	item, err := strconv.ParseInt(r.PathValue("itemID"), 10, 64)
	if err != nil || item <= 0 || (kind != kindBook && kind != kindScreen && kind != kindUtterance) {
		writeErr(w, http.StatusBadRequest, "name the passage by its kind (book, screen or utterance) and id")
		return
	}
	var body struct {
		Fields map[string]*bool   `json:"fields"`
		Edits  map[string]*string `json:"edits"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	for k := range body.Fields {
		if _, ok := anthologyFieldByKey[k]; !ok {
			writeErr(w, http.StatusBadRequest, "no such field: "+k)
			return
		}
	}
	for k, v := range body.Edits {
		if !anthologyEditKeys[k] {
			writeErr(w, http.StatusBadRequest, "that part of a quote cannot be restated: "+k)
			return
		}
		if v != nil && len([]rune(*v)) > anthologyEditMax {
			writeErr(w, http.StatusBadRequest, "that text is too long")
			return
		}
		// A passage with no words is not a restatement of it, it is a hole in the page (an empty quotation block, a
		// `> ` line in the file). Clearing the restatement is what null is for.
		if k == "quote" && v != nil && strings.TrimSpace(*v) == "" {
			writeErr(w, http.StatusBadRequest, "a passage needs its words; use put back to return the quote's own")
			return
		}
	}
	uid := userID(r)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin entry display", err)
		return
	}
	defer tx.Rollback()
	var rawF, rawE string
	err = tx.QueryRow(`SELECT fields, edits FROM anthology_entries WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
		id, kind, item).Scan(&rawF, &rawE)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "that quote is not in this anthology")
		return
	}
	if err != nil {
		internalError(w, r, "read entry display", err)
		return
	}
	fields := decodeEntryFields(rawF)
	if fields == nil {
		fields = map[string]bool{}
	}
	for k, v := range body.Fields {
		if v == nil {
			delete(fields, k)
		} else {
			fields[k] = *v
		}
	}
	edits := decodeEntryEdits(rawE)
	if edits == nil {
		edits = map[string]string{}
	}
	for k, v := range body.Edits {
		if v == nil {
			delete(edits, k)
		} else {
			edits[k] = *v
		}
	}
	enc := func(v any, empty bool) string {
		if empty {
			return ""
		}
		b, _ := json.Marshal(v)
		return string(b)
	}
	if _, err := tx.Exec(`UPDATE anthology_entries SET fields = ?, edits = ? WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
		enc(fields, len(fields) == 0), enc(edits, len(edits) == 0), id, kind, item); err != nil {
		internalError(w, r, "write entry display", err)
		return
	}
	if _, err := tx.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit entry display", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
