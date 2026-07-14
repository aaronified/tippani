package httpapi

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"unicode"

	"tippani/internal/olog"
)

// defaultSeedTags is the starter tag vocabulary every new user receives, so the
// tag palette — and the sticker styles it drives — isn't empty on day one
// (v3 "default seed tags/stickers"). Names span the four colours and all five
// styles. Unique per (user_id, name); the ON CONFLICT keeps seeding idempotent.
var defaultSeedTags = []struct{ Name, Color, Style string }{
	{"favourite", "pink", "sticker"},
	{"insight", "yellow", "flyout"},
	{"beautiful", "orange", "tape"},
	{"reference", "blue", "banner"},
	{"funny", "yellow", "sticker"},
	{"heartbreak", "pink", "reel"},
	{"craft", "blue", "tape"},
	{"wisdom", "orange", "sticker"},
}

// seedDefaultTags inserts the starter vocabulary for a freshly-created user.
// Best-effort: a failure is logged, never fatal — the account is already made
// and the user can create tags by hand.
func seedDefaultTags(db *sql.DB, userID int64) {
	for _, t := range defaultSeedTags {
		if _, err := db.Exec(
			`INSERT INTO tags (user_id, name, color, style) VALUES (?, ?, ?, ?)
			 ON CONFLICT DO NOTHING`,
			userID, t.Name, t.Color, t.Style); err != nil {
			log.Printf("seed tags for user %d: %v", userID, err)
			return
		}
	}
}

func (s *Server) handleListGenres(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[tag] handleListGenres uid=%v", userID(r))
	rows, err := s.Store.DB.Query(
		`SELECT name FROM genres WHERE user_id = ? ORDER BY name`, userID(r))
	if err != nil {
		internalError(w, r, "list genres", err)
		return
	}
	defer rows.Close()
	names := []string{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[tag] genre row scan failed: %v", err)
			continue
		}
		names = append(names, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[tag] genre row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"genres": names})
}

// ---- tags: managed vocabulary with colour + style (§10) ----
//
// Tags used to be name-only rows GC'd when their last use disappeared. With
// the Tags page they are a managed vocabulary: colour + presentation style
// per tag, explicit CRUD, and zero-usage tags persist (only DELETE /tags/{id}
// removes one; its join rows cascade). setTags/addTags still auto-create
// missing names with the default colour/style.

func validTagStyle(v string) bool {
	switch v {
	case "sticker", "banner", "flyout", "tape", "reel":
		return true
	}
	return false
}

// tagRow is the GET/POST/PUT /tags response shape; annotations/dialogues are
// usage counts across the two join tables.
type tagRow struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Style       string `json:"style"`
	Annotations int    `json:"annotations"`
	Dialogues   int    `json:"dialogues"`
}

const tagSelect = `
	SELECT t.id, t.name, t.color, t.style,
	       (SELECT count(*) FROM annotation_tags at WHERE at.tag_id = t.id),
	       (SELECT count(*) FROM dialogue_tags dt WHERE dt.tag_id = t.id)
	FROM tags t`

func (s *Server) fetchTag(uid, id int64) (*tagRow, error) {
	var t tagRow
	err := s.Store.DB.QueryRow(tagSelect+` WHERE t.id = ? AND t.user_id = ?`, id, uid).
		Scan(&t.ID, &t.Name, &t.Color, &t.Style, &t.Annotations, &t.Dialogues)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[tag] handleListTags uid=%v", userID(r))
	rows, err := s.Store.DB.Query(tagSelect+` WHERE t.user_id = ? ORDER BY t.name`, userID(r))
	if err != nil {
		internalError(w, r, "list tags", err)
		return
	}
	defer rows.Close()
	tags := []tagRow{}
	for rows.Next() {
		var t tagRow
		if err := rows.Scan(&t.ID, &t.Name, &t.Color, &t.Style, &t.Annotations, &t.Dialogues); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[tag] tag row scan failed: %v", err)
			continue
		}
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[tag] tag row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

type tagReq struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	Style string `json:"style"`
}

// validate applies the shared name rules (trim, 64-rune cap) and defaults an
// empty colour/style — POST may omit them; PUT is full state like the other
// PUTs, so an omitted field resets to the default.
func (t *tagReq) validate() string {
	t.Name = cleanTagName(t.Name)
	if t.Name == "" {
		return "name is required"
	}
	if t.Color == "" {
		t.Color = "yellow"
	}
	if !validColor(t.Color) {
		return "color must be yellow, blue, pink or orange"
	}
	if t.Style == "" {
		t.Style = "sticker"
	}
	if !validTagStyle(t.Style) {
		return "style must be sticker, banner, flyout, tape or reel"
	}
	return ""
}

func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	var req tagReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[tag] handleCreateTag uid=%v name=%q", uid, req.Name)
	// Case-insensitive dedupe, same rule as cleanNames; the guard is in the
	// INSERT so check and insert are one atomic statement.
	res, err := s.Store.DB.Exec(`
		INSERT INTO tags (user_id, name, color, style)
		SELECT ?, ?, ?, ?
		WHERE NOT EXISTS (SELECT 1 FROM tags WHERE user_id = ? AND lower(name) = lower(?))`,
		uid, req.Name, req.Color, req.Style, uid, req.Name)
	if err != nil {
		internalError(w, r, "insert tag", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusConflict, "tag already exists")
		return
	}
	id, _ := res.LastInsertId()
	t, err := s.fetchTag(uid, id)
	if err != nil {
		internalError(w, r, "fetch tag", err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (s *Server) handleUpdateTag(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid tag id")
		return
	}
	var req tagReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[tag] handleUpdateTag uid=%v id=%v", uid, id)
	// Surface a rename collision with another tag as a 409.
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM tags WHERE user_id = ? AND id <> ? AND lower(name) = lower(?))`,
		uid, id, req.Name).Scan(&clash); err != nil {
		internalError(w, r, "check tag name clash", err)
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "tag already exists")
		return
	}
	res, err := s.Store.DB.Exec(
		`UPDATE tags SET name = ?, color = ?, style = ? WHERE id = ? AND user_id = ?`,
		req.Name, req.Color, req.Style, id, uid)
	if err != nil {
		internalError(w, r, "update tag", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "tag not found")
		return
	}
	t, err := s.fetchTag(uid, id)
	if err != nil {
		internalError(w, r, "fetch tag", err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

// handleDeleteTag removes a tag; its annotation_tags/dialogue_tags rows
// cascade, so tagged annotations and dialogues just lose the label.
func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid tag id")
		return
	}
	olog.Tracef("[tag] handleDeleteTag uid=%v id=%v", userID(r), id)
	res, err := s.Store.DB.Exec(`DELETE FROM tags WHERE id = ? AND user_id = ?`, id, userID(r))
	if err != nil {
		internalError(w, r, "delete tag", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "tag not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- shared name plumbing (genres + tag name lists on annotations) ----

// cleanTagName applies the shared name rules: trim and cap at 64 runes.
func cleanTagName(n string) string {
	n = strings.TrimSpace(n)
	if r := []rune(n); len(r) > 64 {
		n = strings.TrimSpace(string(r[:64]))
	}
	return n
}

// cleanNames normalizes a genre/tag name list: a comma ALWAYS divides (so a
// provider that hands back "Fiction, fantasy, general" as one string becomes
// three names), then trim, drop empties, cap 64 runes, dedupe case-insensitively
// keeping the first spelling.
func cleanNames(names []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, raw := range names {
		for _, part := range strings.Split(raw, ",") {
			n := cleanTagName(part)
			if n == "" || seen[strings.ToLower(n)] {
				continue
			}
			seen[strings.ToLower(n)] = true
			out = append(out, n)
		}
	}
	return out
}

// titleCaseGenre Title-Cases a genre, leaving an all-caps token (an acronym like
// "YA" / "SFF") untouched. Mirrors the frontend helper of the same name.
func titleCaseGenre(s string) string {
	s = strings.TrimSpace(s)
	hasLetter, allUpper := false, true
	for _, r := range s {
		if unicode.IsLetter(r) {
			hasLetter = true
			if !unicode.IsUpper(r) {
				allUpper = false
			}
		}
	}
	if hasLetter && allUpper {
		return s // keep acronyms / all-caps as they came in
	}
	var b strings.Builder
	prevSpace := true
	for _, r := range s {
		if prevSpace {
			b.WriteRune(unicode.ToUpper(r))
		} else {
			b.WriteRune(unicode.ToLower(r))
		}
		prevSpace = unicode.IsSpace(r)
	}
	return b.String()
}

// setGenres replaces the genre set of one book or movie (kind: "book" or
// "movie"; the caller has already verified ownership): upsert names, replace
// join rows, recompute the denormalized genre_text — which feeds FTS via the
// UPDATE trigger (PLAN §3) — then GC genres nothing references. The genres
// table is shared between books and movies (PLAN §3b).
func setGenres(tx *sql.Tx, kind string, userID, ownerID int64, names []string) error {
	names = cleanNames(names)
	// Genres carry a consistent casing (Title Case, acronyms preserved); tags keep
	// whatever the user typed. cleanNames already deduped case-insensitively, so
	// title-casing can't introduce a new collision.
	for i := range names {
		names[i] = titleCaseGenre(names[i])
	}
	if _, err := tx.Exec(`DELETE FROM `+kind+`_genres WHERE `+kind+`_id = ?`, ownerID); err != nil {
		return err
	}
	for _, n := range names {
		if _, err := tx.Exec(
			`INSERT INTO genres (user_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			userID, n); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO `+kind+`_genres (`+kind+`_id, genre_id)
			 SELECT ?, id FROM genres WHERE user_id = ? AND name = ?`,
			ownerID, userID, n); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`UPDATE `+kind+`s SET genre_text = ? WHERE id = ?`,
		strings.Join(names, " "), ownerID); err != nil {
		return err
	}
	return gcGenres(tx, userID)
}

func gcGenres(tx *sql.Tx, userID int64) error {
	_, err := tx.Exec(
		`DELETE FROM genres WHERE user_id = ? AND id NOT IN
		 (SELECT genre_id FROM book_genres UNION SELECT genre_id FROM movie_genres)`, userID)
	return err
}

// setTags mirrors setGenres for the tag set of one annotation or dialogue
// (kind: "annotation" or "dialogue"; the caller has already verified
// ownership through the book/movie). Both kinds share the per-user tags
// table — one vocabulary spans books and movies (PLAN §3). Unlike genres,
// tags are never GC'd here: the vocabulary is managed (§10), so a tag that
// drops to zero usage keeps its colour/style until deleted explicitly.
func setTags(tx *sql.Tx, kind string, userID, ownerID int64, names []string) error {
	names = cleanNames(names)
	if _, err := tx.Exec(`DELETE FROM `+kind+`_tags WHERE `+kind+`_id = ?`, ownerID); err != nil {
		return err
	}
	for _, n := range names {
		if _, err := tx.Exec(
			`INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			userID, n); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO `+kind+`_tags (`+kind+`_id, tag_id)
			 SELECT ?, id FROM tags WHERE user_id = ? AND name = ?`,
			ownerID, userID, n); err != nil {
			return err
		}
	}
	return nil
}

// addTags attaches names WITHOUT detaching existing ones — import duplicate
// enrichment (PLAN §5) unions tags instead of replacing them.
func addTags(tx *sql.Tx, kind string, userID, ownerID int64, names []string) error {
	for _, n := range cleanNames(names) {
		if _, err := tx.Exec(
			`INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			userID, n); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO `+kind+`_tags (`+kind+`_id, tag_id)
			 SELECT ?, id FROM tags WHERE user_id = ? AND name = ?`,
			ownerID, userID, n); err != nil {
			return err
		}
	}
	return nil
}
