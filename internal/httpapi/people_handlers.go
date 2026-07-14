package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"

	"tippani/internal/olog"
)

// people: per-name metadata (bio/photo/links) for the authors and actors
// referenced as free text on books/dialogues (migration 0012). Keyed by
// (user_id, kind, name); matched to a book/film by exact name. No link tables —
// this is pure enrichment layered over the existing strings.

type personRow struct {
	ID        int64  `json:"id"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Bio       string `json:"bio"`
	ImagePath string `json:"image_path"`
	Born      string `json:"born"`
	Links     string `json:"links"`
	Source    string `json:"source"`
	SourceID  string `json:"source_id"`
}

const personCols = `id, kind, name, bio, image_path, born, links, source, source_id`

func scanPerson(sc interface{ Scan(...any) error }) (personRow, error) {
	var p personRow
	err := sc.Scan(&p.ID, &p.Kind, &p.Name, &p.Bio, &p.ImagePath, &p.Born, &p.Links, &p.Source, &p.SourceID)
	return p, err
}

func validPersonKind(k string) bool { return k == "author" || k == "actor" }

// gcOrphanPeople deletes saved person rows (of one kind) whose name is no
// longer referenced by any of the user's books (authors) or dialogues
// (actors) — e.g. after a book's author is renamed, the old author's metadata
// would otherwise linger in the DB and clutter the Metadata console. Called
// from the write paths that can change a reference (never from a read).
// Best-effort: a failure here never fails the triggering request.
func (s *Server) gcOrphanPeople(uid int64, kind string) {
	if !validPersonKind(kind) {
		return
	}
	// The set of names still referenced, already lowercased (the console keys
	// names case-insensitively). Inlined LOWER/TRIM — no derived-table column
	// alias, which SQLite's driver here doesn't accept.
	ref := `SELECT LOWER(TRIM(author)) FROM books
	        WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''`
	if kind == "actor" {
		ref = `SELECT LOWER(TRIM(d.actor)) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		       WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''`
	}
	orphan := ` FROM people WHERE user_id = ? AND kind = ? AND LOWER(name) NOT IN (` + ref + `)`
	// Collect the orphans' image files first so they can be cleaned after the
	// row delete.
	rows, err := s.Store.DB.Query(`SELECT image_path`+orphan, uid, kind, uid)
	if err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC select failed: %v", err)
		return
	}
	var images []string
	for rows.Next() {
		var img string
		if err := rows.Scan(&img); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC image row scan failed: %v", err)
			continue
		}
		if img != "" {
			images = append(images, img)
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC image row iteration failed: %v", err)
	}
	rows.Close()
	if _, err := s.Store.DB.Exec(`DELETE`+orphan, uid, kind, uid); err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC delete failed: %v", err)
		return
	}
	for _, img := range images {
		s.removeCoverFile(img)
	}
}

// handlePeople: GET /people?kind=author|actor[&name=X].
// With a name → the single row ({exists,person}); without → all of that kind
// ({people}), used to paint group-by portraits and manage saved entries.
func (s *Server) handlePeople(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	kind := r.URL.Query().Get("kind")
	if !validPersonKind(kind) {
		writeErr(w, http.StatusBadRequest, "kind must be author or actor")
		return
	}
	olog.Tracef("[people] handlePeople uid=%d kind=%s name=%q", uid, kind, r.URL.Query().Get("name"))
	if name := strings.TrimSpace(r.URL.Query().Get("name")); name != "" {
		p, err := scanPerson(s.Store.DB.QueryRow(
			`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? AND name = ?`, uid, kind, name))
		if errors.Is(err, sql.ErrNoRows) {
			// Not saved yet: a shell so the UI can offer fetch / manual entry.
			writeJSON(w, http.StatusOK, map[string]any{"exists": false, "kind": kind, "name": name})
			return
		}
		if err != nil {
			internalError(w, r, "load person", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"exists": true, "person": p})
		return
	}
	rows, err := s.Store.DB.Query(
		`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? ORDER BY name`, uid, kind)
	if err != nil {
		internalError(w, r, "list people", err)
		return
	}
	defer rows.Close()
	people := []personRow{}
	for rows.Next() {
		p, err := scanPerson(rows)
		if err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] people list row scan failed: %v", err)
			continue
		}
		people = append(people, p)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] people list row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"people": people})
}

// handleUpsertPerson: PUT /people — upsert by (kind, name). image_url is fetched
// (any host; SSRF-guarded, private IPs blocked) and stored; clear_image drops it.
func (s *Server) handleUpsertPerson(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind       string `json:"kind"`
		Name       string `json:"name"`
		Bio        string `json:"bio"`
		Born       string `json:"born"`
		Links      string `json:"links"`
		Source     string `json:"source"`
		SourceID   string `json:"source_id"`
		ImageURL   string `json:"image_url"`
		ClearImage bool   `json:"clear_image"`
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
	olog.Tracef("[people] handleUpsertPerson uid=%d kind=%s name=%q", uid, req.Kind, req.Name)

	// The current image, so a replace/clear can GC the old file after commit.
	var oldImage string
	_ = s.Store.DB.QueryRow(
		`SELECT image_path FROM people WHERE user_id = ? AND kind = ? AND name = ?`,
		uid, req.Kind, req.Name).Scan(&oldImage)

	newImage := oldImage
	if req.ClearImage {
		newImage = ""
	} else if req.ImageURL != "" {
		name, ferr := s.fetchUserImage(r.Context(), req.ImageURL, s.coversDir())
		if ferr != nil {
			writeErr(w, http.StatusBadGateway,
				"couldn't fetch that image — check the URL points directly at a JPG/PNG/WebP/GIF under 2 MB")
			return
		}
		newImage = name
	}

	if _, err := s.Store.DB.Exec(`
		INSERT INTO people (user_id, kind, name, bio, image_path, born, links, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, kind, name) DO UPDATE SET
			bio = excluded.bio, image_path = excluded.image_path, born = excluded.born,
			links = excluded.links, source = excluded.source, source_id = excluded.source_id`,
		uid, req.Kind, req.Name, strings.TrimSpace(req.Bio), newImage, strings.TrimSpace(req.Born),
		strings.TrimSpace(req.Links), strings.TrimSpace(req.Source), strings.TrimSpace(req.SourceID)); err != nil {
		s.removeCoverFile(newImage) // roll back a just-fetched file on write failure
		internalError(w, r, "upsert person", err)
		return
	}
	if oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage) // best-effort; new row is committed
	}
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? AND name = ?`, uid, req.Kind, req.Name))
	if err != nil {
		internalError(w, r, "reload person", err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// handlePeopleNames: GET /people/names?kind=author|actor — every distinct name
// of that kind referenced in the caller's library (books.author for authors,
// dialogues.actor joined through the caller's movies for actors), merged with
// saved people rows so the Metadata console can show link/photo status per name.
func (s *Server) handlePeopleNames(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	kind := r.URL.Query().Get("kind")
	if !validPersonKind(kind) {
		writeErr(w, http.StatusBadRequest, "kind must be author or actor")
		return
	}
	olog.Tracef("[people] handlePeopleNames uid=%d kind=%s", uid, kind)
	// Sweep dangling metadata on load — the hook that keeps orphaned rows (a
	// renamed/removed author whose old spelling no longer appears on any book)
	// from lingering in the console, without a background job. Best-effort.
	s.gcOrphanPeople(uid, kind)
	q := `SELECT DISTINCT TRIM(author) FROM books
		WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) != ''`
	if kind == "actor" {
		q = `SELECT DISTINCT TRIM(d.actor) FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) != ''`
	}
	rows, err := s.Store.DB.Query(q, uid)
	if err != nil {
		internalError(w, r, "list referenced names", err)
		return
	}
	referenced := []string{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] referenced names row scan failed: %v", err)
			continue
		}
		if n != "" {
			referenced = append(referenced, n)
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] referenced names row iteration failed: %v", err)
	}
	rows.Close()

	type nameRow struct {
		Name     string `json:"name"`
		Saved    bool   `json:"saved"`
		ID       int64  `json:"id,omitempty"`
		Links    string `json:"links"`
		HasImage bool   `json:"has_image"` // a portrait is stored — lets the console flag who still needs one
	}
	byName := map[string]*nameRow{}
	for _, n := range referenced {
		byName[strings.ToLower(n)] = &nameRow{Name: n}
	}
	// Saved rows fold in (and appear even when no longer referenced, so stale
	// metadata stays visible and deletable from the console).
	prows, err := s.Store.DB.Query(
		`SELECT id, name, links, image_path FROM people WHERE user_id = ? AND kind = ?`, uid, kind)
	if err != nil {
		internalError(w, r, "list saved people", err)
		return
	}
	for prows.Next() {
		var id int64
		var name, links, image string
		if err := prows.Scan(&id, &name, &links, &image); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] saved names row scan failed: %v", err)
			continue
		}
		key := strings.ToLower(name)
		if row, ok := byName[key]; ok {
			row.Saved, row.ID, row.Links, row.HasImage = true, id, links, image != ""
		} else {
			byName[key] = &nameRow{Name: name, Saved: true, ID: id, Links: links, HasImage: image != ""}
		}
	}
	if err := prows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] saved names row iteration failed: %v", err)
	}
	prows.Close()

	out := make([]nameRow, 0, len(byName))
	for _, row := range byName {
		out = append(out, *row)
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	writeJSON(w, http.StatusOK, map[string]any{"people": out})
}

// handlePersonLookup: POST /people/lookup {kind, name} — resolve the person's
// external reference pages (Open Library + Wikipedia for authors; TMDB, IMDb,
// TheTVDB + Wikipedia for actors). Read-only: the client merges the returned
// links into the saved row via the existing PUT /people.
func (s *Server) handlePersonLookup(w http.ResponseWriter, r *http.Request) {
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
	olog.Tracef("[people] handlePersonLookup kind=%s name=%q", req.Kind, req.Name)
	var links map[string]string
	var err error
	if req.Kind == "author" {
		links, err = s.authorLinks(r.Context(), req.Name)
	} else {
		tmdb, _ := s.resolveTMDB()
		if tmdb == nil {
			writeErr(w, http.StatusServiceUnavailable,
				"actor links come from TMDB — add a TMDB key in Settings first")
			return
		}
		links, err = s.actorLinks(r.Context(), tmdb, req.Name)
	}
	if err != nil {
		writeErr(w, http.StatusBadGateway, "lookup failed — try again in a moment")
		return
	}
	if links == nil {
		links = map[string]string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"links": links})
}

// handleRenamePerson: POST /people/rename {kind, from, to} — rename an author or
// actor across the caller's whole library in one shot. Every book.author (for
// authors) or dialogue.actor (for actors) matching `from` case-insensitively is
// rewritten to the exact `to` string, and the saved metadata is folded onto
// `to`: the `from` row is renamed when `to` has none yet, or dropped (its photo
// file cleaned) when `to` already carries its own. This is how two
// transliterations ("Dostoevsky" / "Dostoyevsky") collapse into one. Returns how
// many books/dialogues were rewritten.
func (s *Server) handleRenamePerson(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		From string `json:"from"`
		To   string `json:"to"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Kind = strings.TrimSpace(req.Kind)
	req.From = strings.TrimSpace(req.From)
	req.To = strings.TrimSpace(req.To)
	if !validPersonKind(req.Kind) {
		writeErr(w, http.StatusBadRequest, "kind must be author or actor")
		return
	}
	if req.From == "" || req.To == "" {
		writeErr(w, http.StatusBadRequest, "from and to are required")
		return
	}
	if req.From == req.To {
		writeErr(w, http.StatusBadRequest, "from and to are identical")
		return
	}
	uid := userID(r)
	olog.Tracef("[people] handleRenamePerson uid=%d kind=%s from=%q to=%q", uid, req.Kind, req.From, req.To)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "rename begin", err)
		return
	}
	defer tx.Rollback()

	var updated int64
	if req.Kind == "author" {
		res, e := tx.Exec(`UPDATE books SET author = ?
		                   WHERE user_id = ? AND author IS NOT NULL AND LOWER(TRIM(author)) = LOWER(?)`,
			req.To, uid, req.From)
		if e != nil {
			internalError(w, r, "rename books", e)
			return
		}
		updated, _ = res.RowsAffected()
	} else {
		res, e := tx.Exec(`UPDATE dialogues SET actor = ?, updated_at = datetime('now')
		                   WHERE LOWER(TRIM(actor)) = LOWER(?) AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`,
			req.To, req.From, uid)
		if e != nil {
			internalError(w, r, "rename dialogues", e)
			return
		}
		updated, _ = res.RowsAffected()
	}

	// Fold the saved metadata onto `to`. `from` rows (case-insensitive, excluding
	// an exact `to`) either get renamed to `to` (when `to` has no row yet) or
	// deleted — their photo files cleaned after commit.
	var toExists bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM people WHERE user_id = ? AND kind = ? AND name = ?)`,
		uid, req.Kind, req.To).Scan(&toExists); err != nil {
		internalError(w, r, "rename to-check", err)
		return
	}
	rows, err := tx.Query(`SELECT id, image_path FROM people
	                       WHERE user_id = ? AND kind = ? AND LOWER(name) = LOWER(?) AND name <> ?`,
		uid, req.Kind, req.From, req.To)
	if err != nil {
		internalError(w, r, "rename from-rows", err)
		return
	}
	type prow struct {
		id  int64
		img string
	}
	var froms []prow
	for rows.Next() {
		var p prow
		if err := rows.Scan(&p.id, &p.img); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] rename from-rows row scan failed: %v", err)
			continue
		}
		froms = append(froms, p)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] rename from-rows row iteration failed: %v", err)
	}
	rows.Close()

	if !toExists && len(froms) > 0 {
		// Rename the first from-row to `to` — keeps its bio/photo/links/id.
		if _, e := tx.Exec(`UPDATE people SET name = ? WHERE id = ?`, req.To, froms[0].id); e != nil {
			internalError(w, r, "rename people", e)
			return
		}
		froms = froms[1:] // the rest are now redundant duplicates
	}
	var freed []string
	for _, p := range froms {
		if _, e := tx.Exec(`DELETE FROM people WHERE id = ?`, p.id); e != nil {
			internalError(w, r, "rename dedupe", e)
			return
		}
		if p.img != "" {
			freed = append(freed, p.img)
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "rename commit", err)
		return
	}
	for _, img := range freed {
		s.removeCoverFile(img) // best-effort; rows are committed
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "updated": updated})
}

// handleDeletePerson: DELETE /people/{id} — clears the metadata (the free-text
// author/actor on books/films is untouched).
func (s *Server) handleDeletePerson(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid person id")
		return
	}
	uid := userID(r)
	olog.Tracef("[people] handleDeletePerson uid=%d id=%d", uid, id)
	var image string
	err := s.Store.DB.QueryRow(`SELECT image_path FROM people WHERE id = ? AND user_id = ?`, id, uid).Scan(&image)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not found")
		return
	case err != nil:
		internalError(w, r, "load person image", err)
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM people WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete person", err)
		return
	}
	if image != "" {
		s.removeCoverFile(image) // best-effort
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
