package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"

	"tippani/internal/metadata"
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

func validPersonKind(k string) bool { return k == "author" || k == "actor" || k == "director" }

// personKindsList names the accepted kinds in the order the 400 messages list
// them — keep it in step with validPersonKind above. Directors (and TV
// "creators") are sourced from movies.director, the way authors come from
// books.author and actors from dialogues.actor.
const personKindsList = "author, actor or director"

// creditSeps loads the caller's separator configuration for multi-author
// splitting (the creditSeparators preference). Best-effort: a prefs load
// failure falls back to the default separator set.
func (s *Server) creditSeps(uid int64) metadata.CreditSeps {
	pf, err := s.loadPrefs(uid)
	if err != nil {
		return metadata.DefaultCreditSeps
	}
	return metadata.ParseCreditSeps(pf.CreditSeparators)
}

// gcOrphanPeople deletes saved person rows (of one kind) whose name is no
// longer referenced by any of the user's books (authors) or dialogues
// (actors) — e.g. after a book's author is renamed, the old author's metadata
// would otherwise linger in the DB and clutter the Metadata console. Called
// from the write paths that can change a reference (never from a read).
// Multi-author aware: the keep-set holds every verbatim credit AND its split
// components under BOTH the user's current separator config and the default
// one — splitting only ever adds names, and the superset means flipping the
// creditSeparators setting can never turn saved bios/portraits into "orphans"
// and delete them. Best-effort: a failure here never fails the request.
func (s *Server) gcOrphanPeople(uid int64, kind string) {
	if !validPersonKind(kind) {
		return
	}
	seps := s.creditSeps(uid)
	ref := `SELECT TRIM(author) FROM books
	        WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''`
	switch kind {
	case "actor":
		ref = `SELECT TRIM(d.actor) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		       WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''`
	case "director":
		ref = `SELECT TRIM(director) FROM movies
		       WHERE user_id = ? AND director IS NOT NULL AND TRIM(director) <> ''`
	}
	rows, err := s.Store.DB.Query(ref, uid)
	if err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC referenced select failed: %v", err)
		return
	}
	keep := map[string]bool{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC referenced row scan failed: %v", err)
			continue
		}
		n = strings.TrimSpace(n)
		if n == "" {
			continue
		}
		keep[strings.ToLower(n)] = true
		for _, c := range metadata.SplitCredits(n, seps) {
			keep[strings.ToLower(c)] = true
		}
		for _, c := range metadata.SplitCredits(n, metadata.DefaultCreditSeps) {
			keep[strings.ToLower(c)] = true
		}
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC referenced row iteration failed: %v", err)
	}
	rows.Close()

	prows, err := s.Store.DB.Query(
		`SELECT id, name, image_path FROM people WHERE user_id = ? AND kind = ?`, uid, kind)
	if err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC saved select failed: %v", err)
		return
	}
	var ids []any
	var images []string
	for prows.Next() {
		var id int64
		var name, img string
		if err := prows.Scan(&id, &name, &img); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC saved row scan failed: %v", err)
			continue
		}
		if keep[strings.ToLower(strings.TrimSpace(name))] {
			continue
		}
		ids = append(ids, id)
		if img != "" {
			images = append(images, img)
		}
	}
	if err := prows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC saved row iteration failed: %v", err)
	}
	prows.Close()
	if len(ids) == 0 {
		return
	}
	if _, err := s.Store.DB.Exec(
		`DELETE FROM people WHERE id IN (?`+strings.Repeat(",?", len(ids)-1)+`)`, ids...); err != nil {
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
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
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
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
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
			olog.Errorf(olog.CodePeopleImageFetch, "[people] upsert kind=%s name=%q image fetch failed: %v",
				req.Kind, req.Name, ferr)
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
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
		return
	}
	olog.Tracef("[people] handlePeopleNames uid=%d kind=%s", uid, kind)
	// Sweep dangling metadata on load — the hook that keeps orphaned rows (a
	// renamed/removed author whose old spelling no longer appears on any book)
	// from lingering in the console, without a background job. Best-effort.
	s.gcOrphanPeople(uid, kind)
	// Each credit row carries its work count (books for authors, distinct
	// titles for actors) so the console can show per-person tallies.
	q := `SELECT TRIM(author), COUNT(*) FROM books
		WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) != ''
		GROUP BY TRIM(author)`
	switch kind {
	case "actor":
		q = `SELECT TRIM(d.actor), COUNT(DISTINCT d.movie_id) FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) != ''
			GROUP BY TRIM(d.actor)`
	case "director":
		// One director string per movie row, so COUNT(*) grouped by director is
		// the number of the caller's films crediting them.
		q = `SELECT TRIM(director), COUNT(*) FROM movies
			WHERE user_id = ? AND director IS NOT NULL AND TRIM(director) != ''
			GROUP BY TRIM(director)`
	}
	rows, err := s.Store.DB.Query(q, uid)
	if err != nil {
		internalError(w, r, "list referenced names", err)
		return
	}
	// Multi-author separation (ROADMAP §11): a joined credit ("Gaiman &
	// Pratchett") lists as its individual components, each fetchable and
	// resolvable on its own. The stored credit string stays verbatim — only
	// this people view splits. The byName map dedupes components shared
	// across works case-insensitively.
	seps := s.creditSeps(uid)
	// Tally on the SPLIT components: a co-authored book counts once for each
	// author, keyed case-insensitively like byName below. First spelling wins
	// for display.
	referenced := []string{}
	counts := map[string]int64{}
	for rows.Next() {
		var n string
		var c int64
		if err := rows.Scan(&n, &c); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] referenced names row scan failed: %v", err)
			continue
		}
		for _, comp := range metadata.SplitCredits(n, seps) {
			referenced = append(referenced, comp)
			counts[strings.ToLower(comp)] += c
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
		Count    int64  `json:"count"`     // works referencing this name (books / distinct titles); 0 for saved-only rows
	}
	byName := map[string]*nameRow{}
	for _, n := range referenced {
		key := strings.ToLower(n)
		if _, ok := byName[key]; !ok {
			byName[key] = &nameRow{Name: n, Count: counts[key]}
		}
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
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
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
		// Actors and directors are both TMDB people, resolved by name.
		tmdb, _ := s.resolveTMDB()
		if tmdb == nil {
			writeErr(w, http.StatusServiceUnavailable,
				"these links come from TMDB — add a TMDB key in Settings first")
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
// authors) or dialogue.actor (for actors) carrying `from` — as the whole credit
// OR as one component of a joined multi-author credit — is rewritten (the
// co-credits untouched), and the saved metadata is folded onto `to`: the `from`
// row is renamed when `to` has none yet, or dropped (its photo file cleaned)
// when `to` already carries its own. This is how two transliterations
// ("Dostoevsky" / "Dostoyevsky") collapse into one — and how a bad multi-author
// split is recombined. Returns how many books/dialogues were rewritten.
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
		writeErr(w, http.StatusBadRequest, "kind must be "+personKindsList)
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
	seps := s.creditSeps(uid)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "rename begin", err)
		return
	}
	defer tx.Rollback()

	// Scan-and-rewrite instead of a single UPDATE: `from` may be one component
	// inside a joined credit ("Neil Gaiman & Terry Pratchett"), which SQL string
	// equality can't rewrite without clobbering the co-credits. A full scan is
	// fine — libraries are hundreds of rows and rename is rare. Rewrites are
	// collected first, then applied (no exec while the cursor is open).
	type rewrite struct {
		id     int64
		credit string
	}
	var rewrites []rewrite
	scanQ := `SELECT id, TRIM(author) FROM books
	          WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''`
	switch req.Kind {
	case "actor":
		scanQ = `SELECT d.id, TRIM(d.actor) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		         WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''`
	case "director":
		scanQ = `SELECT id, TRIM(director) FROM movies
		         WHERE user_id = ? AND director IS NOT NULL AND TRIM(director) <> ''`
	}
	crows, err := tx.Query(scanQ, uid)
	if err != nil {
		internalError(w, r, "rename scan", err)
		return
	}
	for crows.Next() {
		var id int64
		var credit string
		if err := crows.Scan(&id, &credit); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] rename credit row scan failed: %v", err)
			continue
		}
		if next, ok := metadata.ReplaceCredit(credit, req.From, req.To, seps); ok {
			rewrites = append(rewrites, rewrite{id, next})
		}
	}
	if err := crows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] rename credit row iteration failed: %v", err)
	}
	crows.Close()

	updateQ := `UPDATE books SET author = ? WHERE id = ?`
	switch req.Kind {
	case "actor":
		updateQ = `UPDATE dialogues SET actor = ?, updated_at = datetime('now') WHERE id = ?`
	case "director":
		// The movies_fts triggers re-index the director column automatically.
		updateQ = `UPDATE movies SET director = ? WHERE id = ?`
	}
	for _, rw := range rewrites {
		if _, e := tx.Exec(updateQ, rw.credit, rw.id); e != nil {
			internalError(w, r, "rename rewrite", e)
			return
		}
	}
	updated := int64(len(rewrites))

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
