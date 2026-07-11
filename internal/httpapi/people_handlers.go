package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"
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
		return
	}
	var images []string
	for rows.Next() {
		var img string
		if rows.Scan(&img) == nil && img != "" {
			images = append(images, img)
		}
	}
	rows.Close()
	if _, err := s.Store.DB.Exec(`DELETE`+orphan, uid, kind, uid); err != nil {
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
	if name := strings.TrimSpace(r.URL.Query().Get("name")); name != "" {
		p, err := scanPerson(s.Store.DB.QueryRow(
			`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? AND name = ?`, uid, kind, name))
		if errors.Is(err, sql.ErrNoRows) {
			// Not saved yet: a shell so the UI can offer fetch / manual entry.
			writeJSON(w, http.StatusOK, map[string]any{"exists": false, "kind": kind, "name": name})
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"exists": true, "person": p})
		return
	}
	rows, err := s.Store.DB.Query(
		`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? ORDER BY name`, uid, kind)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	people := []personRow{}
	for rows.Next() {
		if p, err := scanPerson(rows); err == nil {
			people = append(people, p)
		}
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
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage) // best-effort; new row is committed
	}
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people WHERE user_id = ? AND kind = ? AND name = ?`, uid, req.Kind, req.Name))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// handlePeopleNames: GET /people/names?kind=author|actor — every distinct name
// of that kind referenced in the caller's library (books.author for authors,
// dialogues.actor joined through the caller's movies for actors), merged with
// saved people rows so the Metadata console can show link status per name.
func (s *Server) handlePeopleNames(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	kind := r.URL.Query().Get("kind")
	if !validPersonKind(kind) {
		writeErr(w, http.StatusBadRequest, "kind must be author or actor")
		return
	}
	q := `SELECT DISTINCT TRIM(author) FROM books
		WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) != ''`
	if kind == "actor" {
		q = `SELECT DISTINCT TRIM(d.actor) FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) != ''`
	}
	rows, err := s.Store.DB.Query(q, uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	referenced := []string{}
	for rows.Next() {
		var n string
		if rows.Scan(&n) == nil && n != "" {
			referenced = append(referenced, n)
		}
	}
	rows.Close()

	type nameRow struct {
		Name  string `json:"name"`
		Saved bool   `json:"saved"`
		ID    int64  `json:"id,omitempty"`
		Links string `json:"links"`
	}
	byName := map[string]*nameRow{}
	for _, n := range referenced {
		byName[strings.ToLower(n)] = &nameRow{Name: n}
	}
	// Saved rows fold in (and appear even when no longer referenced, so stale
	// metadata stays visible and deletable from the console).
	prows, err := s.Store.DB.Query(
		`SELECT id, name, links FROM people WHERE user_id = ? AND kind = ?`, uid, kind)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	for prows.Next() {
		var id int64
		var name, links string
		if prows.Scan(&id, &name, &links) != nil {
			continue
		}
		key := strings.ToLower(name)
		if row, ok := byName[key]; ok {
			row.Saved, row.ID, row.Links = true, id, links
		} else {
			byName[key] = &nameRow{Name: name, Saved: true, ID: id, Links: links}
		}
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

// handleDeletePerson: DELETE /people/{id} — clears the metadata (the free-text
// author/actor on books/films is untouched).
func (s *Server) handleDeletePerson(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid person id")
		return
	}
	uid := userID(r)
	var image string
	err := s.Store.DB.QueryRow(`SELECT image_path FROM people WHERE id = ? AND user_id = ?`, id, uid).Scan(&image)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM people WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if image != "" {
		s.removeCoverFile(image) // best-effort
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
