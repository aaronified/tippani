package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"sort"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// people: per-name metadata (bio/photo/links) for the people referenced as free
// text across the library — books.author, dialogues.actor, movies.director
// (migration 0012). Keyed by (user_id, NAME) since 0027, with the roles a
// person plays held in person_kinds beside the row rather than folded into its
// key. Matched to a work by exact name; no link tables — this is pure
// enrichment layered over the existing strings.

type personRow struct {
	ID int64 `json:"id"`
	// Kind echoes the role that was ASKED for, not one stored on the row — since
	// 0027 a person has a set of them. Kinds carries the whole set, so a chip can
	// read "author · speaker" rather than appearing twice on one page.
	Kind      string   `json:"kind"`
	Kinds     []string `json:"kinds,omitempty"`
	Name      string   `json:"name"`
	Bio       string   `json:"bio"`
	ImagePath string   `json:"image_path"`
	Born      string   `json:"born"`
	Died      string   `json:"died"`
	Links     string   `json:"links"`
	Source    string   `json:"source"`
	SourceID  string   `json:"source_id"`
}

// personCols is p.-prefixed because every read joins person_kinds now — see
// personKindJoin. `kind` is NOT among them: it left the row in 0027.
const personCols = `p.id, p.name, p.bio, p.image_path, p.born, p.died, p.links, p.source, p.source_id`

func scanPerson(sc interface{ Scan(...any) error }) (personRow, error) {
	var p personRow
	err := sc.Scan(&p.ID, &p.Name, &p.Bio, &p.ImagePath, &p.Born, &p.Died, &p.Links, &p.Source, &p.SourceID)
	return p, err
}

// ---- roles (0027) ---------------------------------------------------------
//
// Until 0027 a role was part of a person's identity: the row was keyed
// (user_id, kind, name), so one human who both writes and acts was two rows
// with two bios and two portraits, and enriching one left the other blank. Now
// the row IS the person and the roles are a set beside it.
//
// Two consequences run through everything below. A read FILTERS BY A JOIN
// rather than by a column. And a write has to file the role separately, which
// is two statements where there was one — so they live in helpers rather than
// being spelled out at each of the three call sites that upsert a person
// (here, portrait_handlers, reverify_handlers), because three hand-written
// copies of a two-statement write is how one of them ends up doing only the
// first half.

// personKindJoin scopes a people query to one role. Its `?` binds AFTER the
// user id at every call site, so the argument order reads (uid, kind).
const personKindJoin = ` JOIN person_kinds pk ON pk.person_id = p.id AND pk.kind = ?`

// recordPersonKind files an existing person under a role. Idempotent: the
// primary key makes a repeat a no-op, so callers never have to check first.
func (s *Server) recordPersonKind(personID int64, kind string) error {
	_, err := s.Store.DB.Exec(
		`INSERT OR IGNORE INTO person_kinds (person_id, kind) VALUES (?, ?)`, personID, kind)
	return err
}

// personIDByName resolves a person row for this account. Returns 0 when there
// is none, which callers read as "the upsert inserted nothing to file a role
// against" — an impossible state that is still worth not crashing on.
func (s *Server) personIDByName(uid int64, name string) (int64, error) {
	var id int64
	err := s.Store.DB.QueryRow(
		`SELECT id FROM people WHERE user_id = ? AND name = ?`, uid, name).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

// personKindsTx is personKindsOf inside a caller's transaction. The rename holds
// one, and reading roles on a SECOND connection while it holds the write lock is
// the self-deadlock this four-connection pool makes survivable rather than
// impossible — so the read goes through the transaction that is already open.
func personKindsTx(tx *sql.Tx, personID int64) []string {
	rows, err := tx.Query(`SELECT kind FROM person_kinds WHERE person_id = ? ORDER BY kind`, personID)
	if err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] roles select (tx) failed: %v", err)
		return nil
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] role row scan (tx) failed: %v", err)
			continue
		}
		out = append(out, k)
	}
	return out
}

// personKindsOf lists every role a person plays, so the client can say "author
// · speaker" on one chip instead of showing the same face twice.
func (s *Server) personKindsOf(personID int64) []string {
	rows, err := s.Store.DB.Query(
		`SELECT kind FROM person_kinds WHERE person_id = ? ORDER BY kind`, personID)
	if err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] roles select failed: %v", err)
		return nil
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] role row scan failed: %v", err)
			continue
		}
		out = append(out, k)
	}
	return out
}

// personKinds is the accepted vocabulary, in the order the 400 messages list it.
// Directors (and TV "creators") are sourced from movies.director, the way authors
// come from books.author, actors from dialogues.actor and speakers from
// utterances.speaker.
//
// "studio" is the odd one and earns its place by having BEHAVIOUR rather than a
// label (the bar 0037 set): a logo, a click target, and its own slot on a game's
// overview page where a film shows its director. It shares movies.director with
// directors, split by media_type — which is exactly why every query keyed on this
// vocabulary has to name the media type rather than just the column.
//
// A SLICE RATHER THAN A CHAIN OF ||, so the vocabulary can be ENUMERATED. The
// invariant tests in people_gc_test.go assert that every accepted kind has a
// reference query and a rename pair, and their comment claimed they were "kept
// in step with validPersonKind by construction" while actually carrying a
// hand-written list — so adding this seventh kind would have passed them
// vacuously, which is the exact shape of the parity test that skipped embedded
// structs. Ranging over this makes the claim true.
var personKinds = []string{"author", "actor", "director", "speaker", "translator", "editor", "studio"}

func validPersonKind(k string) bool {
	return slices.Contains(personKinds, k)
}

// personKindsList renders personKinds for a 400 message ("a, b or c"), so the
// message cannot fall behind the vocabulary the way the literal it replaced did.
var personKindsList = func() string {
	if len(personKinds) < 2 {
		return strings.Join(personKinds, "")
	}
	return strings.Join(personKinds[:len(personKinds)-1], ", ") + " or " + personKinds[len(personKinds)-1]
}()

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

// orphanRefQuery names the column that decides whether a saved person of this
// kind is still referenced by the library: authors come from books.author,
// actors from dialogues.actor, directors from movies.director. Each query takes
// one argument, the user id, and returns the referenced names.
//
// An unrecognised kind returns "", and gcOrphanPeople sweeps nothing for it.
// That empty case is the entire point of this function existing separately.
//
// It used to be written inline as a default plus two overrides — ref started as
// the books.author query and a switch replaced it for actor and director. With
// exactly three valid kinds that is correct, and it is correct ONLY for that
// reason. gcOrphanPeople's guard is `if !validPersonKind(kind) { return }`, so
// it stops protecting the moment a fourth kind becomes valid, and that kind
// would silently inherit the books.author query: every person of it whose name
// is not also one of your book authors would be deleted and its portrait file
// unlinked, by a best-effort sweep that logs at Warn and still answers 200.
//
// Failing to sweep leaves clutter. Sweeping wrongly loses a bio and a portrait.
// So a missing case does nothing, and adding a kind without adding its query
// here is now a visible gap rather than a deletion.
func orphanRefQuery(kind string) string {
	switch kind {
	case "author":
		return `SELECT TRIM(author) FROM books
		        WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''`
	case "actor":
		return `SELECT TRIM(d.actor) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		        WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''`
	case "director":
		// media_type <> 'game' IS LOAD-BEARING, not tidiness. 0040 puts a game's
		// STUDIO in this same column, so an unfiltered query answers "who are my
		// directors" with every studio in the library — and the orphan sweep then
		// deletes a director whose name happens to match no film but does match a
		// game studio. This is the third appearance of the hazard the header above
		// describes; the first two were fixed and the third was missed.
		return `SELECT TRIM(director) FROM movies
		        WHERE user_id = ? AND media_type <> 'game'
		          AND director IS NOT NULL AND TRIM(director) <> ''`
	case "studio":
		// The mirror image: the same column, the other side of the split.
		return `SELECT TRIM(director) FROM movies
		        WHERE user_id = ? AND media_type = 'game'
		          AND director IS NOT NULL AND TRIM(director) <> ''`
	case "speaker":
		// No parent join: an utterance carries its own user_id (0026).
		return `SELECT TRIM(speaker) FROM utterances
		        WHERE user_id = ? AND TRIM(speaker) <> ''`
	case "translator":
		// NOT NULL DEFAULT '' (0034), so no IS NOT NULL term — but the TRIM(...)
		// <> '' one still matters, because '' is the overwhelmingly common value.
		return `SELECT TRIM(translator) FROM books
		        WHERE user_id = ? AND TRIM(translator) <> ''`
	case "editor":
		return `SELECT TRIM(editor) FROM books
		        WHERE user_id = ? AND TRIM(editor) <> ''`
	}
	return ""
}

// personCreditSQL returns the pair of statements a rename needs for one kind:
// the scan that finds every credit string mentioning the person, and the update
// that writes a rewritten credit back. ok is false for a kind with no credit
// column, and the caller must not rename.
//
// They are returned TOGETHER, from one switch, on purpose. They were previously
// two separate switches — each a default-plus-overrides over books — sitting
// forty lines apart in handleRenamePerson, which is two ways to get the same
// thing wrong. Independently, either could inherit the books arm for a kind it
// does not know. Jointly, they could also disagree: scan one table and write to
// another, which reads every book's author and stamps the rewritten strings
// onto dialogue rows by matching id.
//
// The blast radius here is larger than the orphan sweep's. metadata.ReplaceCredit
// matches a name as a COMPONENT inside a joined credit, so a speaker renamed
// from "Bose" would rewrite the author line of every book credited to anyone
// called Bose, in place, across the whole library — and rename is one of the few
// operations with no undo.
func personCreditSQL(kind string) (scan, update string, ok bool) {
	switch kind {
	case "author":
		return `SELECT id, TRIM(author) FROM books
		        WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''`,
			`UPDATE books SET author = ?, updated_at = datetime('now') WHERE id = ?`, true
	case "actor":
		return `SELECT d.id, TRIM(d.actor) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		        WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''`,
			`UPDATE dialogues SET actor = ?, updated_at = datetime('now') WHERE id = ?`, true
	case "director":
		// Scoped to non-games for the reason orphanRefQuery's director arm gives,
		// and the blast radius is the larger one described in this function's own
		// header: rename matches a name as a COMPONENT of a joined credit, so an
		// unfiltered rename of "Bethesda" as a director would rewrite the studio
		// of every Bethesda game in place, with no undo.
		//
		// The UPDATE is keyed by the id the SELECT returned, so narrowing the scan
		// is sufficient — but both arms name the media type anyway, because these
		// two are returned together precisely so they cannot disagree.
		return `SELECT id, TRIM(director) FROM movies
		        WHERE user_id = ? AND media_type <> 'game'
		          AND director IS NOT NULL AND TRIM(director) <> ''`,
			// The movies_fts triggers re-index the director column automatically.
			`UPDATE movies SET director = ?, updated_at = datetime('now')
			 WHERE id = ? AND media_type <> 'game'`, true
	case "studio":
		return `SELECT id, TRIM(director) FROM movies
		        WHERE user_id = ? AND media_type = 'game'
		          AND director IS NOT NULL AND TRIM(director) <> ''`,
			`UPDATE movies SET director = ?, updated_at = datetime('now')
			 WHERE id = ? AND media_type = 'game'`, true
	case "speaker":
		// The utterances_fts triggers re-index the speaker column automatically.
		// The DEDUPE HASH does not follow, and cannot: it is a SHA over
		// normalised fields, which SQL cannot compute. rehashRenamedQuotes runs
		// after the rewrite — see handleRenamePerson.
		return `SELECT id, TRIM(speaker) FROM utterances
		        WHERE user_id = ? AND TRIM(speaker) <> ''`,
			`UPDATE utterances SET speaker = ?, updated_at = datetime('now') WHERE id = ?`, true
	case "translator":
		// books.translator is NOT NULL DEFAULT '' (0034), hence no IS NOT NULL
		// term. It is NOT in books_fts — see 0034's header for why — so unlike
		// the director and speaker arms there is no index to re-sync here.
		return `SELECT id, TRIM(translator) FROM books
		        WHERE user_id = ? AND TRIM(translator) <> ''`,
			`UPDATE books SET translator = ?, updated_at = datetime('now') WHERE id = ?`, true
	case "editor":
		return `SELECT id, TRIM(editor) FROM books
		        WHERE user_id = ? AND TRIM(editor) <> ''`,
			`UPDATE books SET editor = ?, updated_at = datetime('now') WHERE id = ?`, true
	}
	return "", "", false
}

// rehashRenamedQuotes recomputes dedupe_hash for one account's standalone
// quotes after a speaker rename.
//
// WHY IT IS NEEDED. UtteranceDedupeHash folds the speaker in, because §24
// inverts the usual rule: the occasion is a locator and it DISCRIMINATES. So
// renaming a speaker changes what those quotes ARE, and a hash still computed
// from the old spelling would fail to recognise a re-import of the same line
// under the new one — quietly producing a duplicate months later.
//
// WHY A COLLISION IS SKIPPED RATHER THAN MERGED OR FAILED. Two quotes that
// differed only by the spelling of a name become the same quote under the new
// one, and UNIQUE (user_id, dedupe_hash) then refuses the second. Failing the
// whole rename over it would strand the library half-renamed; deleting the
// loser would destroy a row the user never asked to lose. Leaving that ONE row
// on its old hash costs nothing today and is visible as an ordinary duplicate
// pair, which the user can resolve. This is the same hazard the dialogue
// backfill defers, handled per row instead of per migration.
func rehashRenamedQuotes(tx *sql.Tx, uid int64) error {
	rows, err := tx.Query(
		`SELECT id, quote, COALESCE(note,''), COALESCE(speaker,''), COALESCE(occasion,''),
		        COALESCE(occasion_date,'')
		 FROM utterances WHERE user_id = ?`, uid)
	if err != nil {
		return err
	}
	type row struct {
		id   int64
		hash string
	}
	var want []row
	for rows.Next() {
		var id int64
		var quote, note, speaker, occasion, occDate string
		if err := rows.Scan(&id, &quote, &note, &speaker, &occasion, &occDate); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] rehash row scan failed: %v", err)
			continue
		}
		text := quote
		if text == "" {
			text = note
		}
		want = append(want, row{id, store.UtteranceDedupeHash(text, speaker, occasion, occDate)})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for _, r := range want {
		if _, err := tx.Exec(
			`UPDATE utterances SET dedupe_hash = ? WHERE id = ?`, r.hash, r.id); err != nil {
			// Almost certainly the UNIQUE. Leave this row on its old hash and
			// carry on — see the note above on why that beats failing.
			olog.Warnf(olog.CodePeopleOrphanGC,
				"[people] quote %d kept its previous dedupe hash after a rename: %v", r.id, err)
		}
	}
	return nil
}

// gcOrphanPeople un-files a role from saved people whose name is no longer
// referenced by the library — e.g. after a book's author is renamed, the old
// author's metadata would otherwise linger and clutter the Metadata console.
// Called from the write paths that can change a reference (never from a read).
//
// SINCE 0027 THIS UN-FILES A ROLE RATHER THAN DELETING A PERSON, and only
// deletes the row once no role is left. That is not a refinement, it is the
// difference between right and wrong under the new schema: a person who is both
// an author and a speaker is ONE row, so deleting them because their last book
// went would take a portrait and a bio that the speaker side is still using.
//
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
	ref := orphanRefQuery(kind)
	if ref == "" {
		olog.Warnf(olog.CodePeopleOrphanGC, "[people] orphan GC has no reference query for kind %q; skipping", kind)
		return
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
		`SELECT p.id, p.name FROM people p`+personKindJoin+`
		 WHERE p.user_id = ?`, kind, uid)
	if err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC saved select failed: %v", err)
		return
	}
	var ids []any
	for prows.Next() {
		var id int64
		var name string
		if err := prows.Scan(&id, &name); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC saved row scan failed: %v", err)
			continue
		}
		if keep[strings.ToLower(strings.TrimSpace(name))] {
			continue
		}
		ids = append(ids, id)
	}
	if err := prows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC saved row iteration failed: %v", err)
	}
	prows.Close()
	if len(ids) == 0 {
		return
	}
	placeholders := `(?` + strings.Repeat(",?", len(ids)-1) + `)`

	// Drop the role first. Everything after this is about the rows that role was
	// the last reason to keep.
	if _, err := s.Store.DB.Exec(
		`DELETE FROM person_kinds WHERE kind = ? AND person_id IN `+placeholders,
		append([]any{kind}, ids...)...); err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC role delete failed: %v", err)
		return
	}

	// Portraits are read BEFORE the delete and unlinked after, and only for rows
	// that really went — a person still playing another role keeps their file.
	var images []string
	irows, err := s.Store.DB.Query(
		`SELECT image_path FROM people WHERE id IN `+placeholders+`
		 AND image_path <> ''
		 AND NOT EXISTS (SELECT 1 FROM person_kinds pk WHERE pk.person_id = people.id)`, ids...)
	if err != nil {
		olog.Errorf(olog.CodePeopleOrphanGC, "[people] orphan GC portrait select failed: %v", err)
		return
	}
	for irows.Next() {
		var img string
		if err := irows.Scan(&img); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] orphan GC portrait row scan failed: %v", err)
			continue
		}
		images = append(images, img)
	}
	irows.Close()

	if _, err := s.Store.DB.Exec(
		`DELETE FROM people WHERE id IN `+placeholders+`
		 AND NOT EXISTS (SELECT 1 FROM person_kinds pk WHERE pk.person_id = people.id)`, ids...); err != nil {
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
			`SELECT `+personCols+` FROM people p`+personKindJoin+`
			 WHERE p.user_id = ? AND p.name = ?`, kind, uid, name))
		if errors.Is(err, sql.ErrNoRows) {
			// Not saved yet: a shell so the UI can offer fetch / manual entry.
			writeJSON(w, http.StatusOK, map[string]any{"exists": false, "kind": kind, "name": name})
			return
		}
		if err != nil {
			internalError(w, r, "load person", err)
			return
		}
		p.Kind, p.Kinds = kind, s.personKindsOf(p.ID)
		writeJSON(w, http.StatusOK, map[string]any{"exists": true, "person": p})
		return
	}
	rows, err := s.Store.DB.Query(
		`SELECT `+personCols+` FROM people p`+personKindJoin+`
		 WHERE p.user_id = ? ORDER BY p.name`, kind, uid)
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
		p.Kind = kind
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
		Died       string `json:"died"`
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
		`SELECT image_path FROM people WHERE user_id = ? AND name = ?`,
		uid, req.Name).Scan(&oldImage)

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
		INSERT INTO people (user_id, name, bio, image_path, born, died, links, source, source_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, name) DO UPDATE SET
			bio = excluded.bio, image_path = excluded.image_path, born = excluded.born,
			died = excluded.died, links = excluded.links, source = excluded.source, source_id = excluded.source_id`,
		uid, req.Name, strings.TrimSpace(req.Bio), newImage, strings.TrimSpace(req.Born),
		strings.TrimSpace(req.Died), strings.TrimSpace(req.Links), strings.TrimSpace(req.Source), strings.TrimSpace(req.SourceID)); err != nil {
		s.removeCoverFile(newImage) // roll back a just-fetched file on write failure
		internalError(w, r, "upsert person", err)
		return
	}
	if oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage) // best-effort; new row is committed
	}
	// File the role. Saving someone as a speaker who is already an author adds a
	// role to the person you have; it does not make a second one.
	id, err := s.personIDByName(uid, req.Name)
	if err != nil {
		internalError(w, r, "reload person", err)
		return
	}
	if id != 0 {
		if err := s.recordPersonKind(id, req.Kind); err != nil {
			internalError(w, r, "record person role", err)
			return
		}
	}
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people p WHERE p.user_id = ? AND p.name = ?`, uid, req.Name))
	if err != nil {
		internalError(w, r, "reload person", err)
		return
	}
	p.Kind, p.Kinds = req.Kind, s.personKindsOf(p.ID)
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
	//
	// AN EXPLICIT CASE PER KIND, WITH NO DEFAULT. This was `q :=` the books.author
	// query followed by a switch that overrode it for the other three — the exact
	// default-plus-overrides shape orphanRefQuery's header warns about, still live
	// here because nobody had added a kind since. 0034 added two, and under the old
	// shape `?kind=translator` would have answered with every book AUTHOR, tallied,
	// named as translators, and offered for renaming. Silent, plausible, and wrong.
	//
	// An unmapped kind now leaves `q` empty and is refused below rather than
	// inheriting somebody else's query. validPersonKind has already run, so
	// reaching that line means the two lists disagree — which is a bug in this
	// file, and says so.
	q := ""
	switch kind {
	case "author":
		q = `SELECT TRIM(author), COUNT(*) FROM books
			WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) != ''
			GROUP BY TRIM(author)`
	case "translator":
		// NOT NULL DEFAULT '' (0034) — no IS NOT NULL term, and the count is
		// books-they-translated, the same question the author arm answers.
		q = `SELECT TRIM(translator), COUNT(*) FROM books
			WHERE user_id = ? AND TRIM(translator) != ''
			GROUP BY TRIM(translator)`
	case "editor":
		q = `SELECT TRIM(editor), COUNT(*) FROM books
			WHERE user_id = ? AND TRIM(editor) != ''
			GROUP BY TRIM(editor)`
	case "actor":
		q = `SELECT TRIM(d.actor), COUNT(DISTINCT d.movie_id) FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) != ''
			GROUP BY TRIM(d.actor)`
	case "director":
		// One director string per movie row, so COUNT(*) grouped by director is
		// the number of the caller's films crediting them.
		//
		// media_type <> 'game' is the same load-bearing filter personCreditSQL and
		// orphanRefQuery carry, and this is the arm where its absence would be
		// VISIBLE rather than merely destructive: 0040 stores a game's studio in
		// movies.director, so without it the Metadata console's director list
		// answers with every studio in the library — tallied, named as directors,
		// and offered for renaming. That is the identical sentence this switch's
		// own header writes about translators and authors, one kind later.
		q = `SELECT TRIM(director), COUNT(*) FROM movies
			WHERE user_id = ? AND media_type <> 'game'
			  AND director IS NOT NULL AND TRIM(director) != ''
			GROUP BY TRIM(director)`
	case "studio":
		// The other side of the same column. COUNT(*) is the number of the
		// caller's games crediting that studio.
		q = `SELECT TRIM(director), COUNT(*) FROM movies
			WHERE user_id = ? AND media_type = 'game'
			  AND director IS NOT NULL AND TRIM(director) != ''
			GROUP BY TRIM(director)`
	case "speaker":
		// The count is QUOTES, not works: a speaker has no works, and two lines
		// from one speech are two quotes rather than one source. utterances
		// carries its own user_id, so there is no parent to join (0026).
		q = `SELECT TRIM(speaker), COUNT(*) FROM utterances
			WHERE user_id = ? AND TRIM(speaker) != ''
			GROUP BY TRIM(speaker)`
	}
	if q == "" {
		// Unreachable unless validPersonKind and this switch have drifted apart,
		// which is precisely the drift worth reporting rather than papering over.
		olog.Errorf(olog.CodePeopleLookupFailed, "[people] no names query for valid kind %q", kind)
		writeErr(w, http.StatusInternalServerError, "cannot list names for that kind")
		return
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
		`SELECT p.id, p.name, p.links, p.image_path FROM people p`+personKindJoin+`
		 WHERE p.user_id = ?`, kind, uid)
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
	// WHICH PROVIDER IS A QUESTION ABOUT THE MEDIUM, NOT ABOUT THE ROLE, and
	// writing it as `author` vs everything-else was only correct while author was
	// the sole book-side kind. Translators and editors are book people (0034):
	// sent down the else-branch they would be looked up in a FILM database, which
	// does not fail — it either answers with an actor who happens to share the
	// name, or answers with nothing behind an error telling somebody chasing a
	// literary translator to go and add a TMDB key.
	switch req.Kind {
	case "author", "translator", "editor":
		links, err = s.authorLinks(r.Context(), req.Name)
	case "studio":
		// A STUDIO IS NOT A PERSON, and neither of the other two branches can
		// say so. Sent to Open Library it comes back as an AUTHOR page —
		// "Electronic Arts" resolves to an openlibrary.org/authors/ record,
		// which is not wrong about the string and completely wrong about the
		// thing. Sent to TMDB it resolves to whatever human shares the name.
		//
		// Games are IGDB's from end to end (0040), and companies are one of its
		// endpoints, so this is the same key answering the same question about
		// the same catalogue.
		igdb, _ := s.resolveIGDB()
		if igdb == nil {
			writeErr(w, http.StatusServiceUnavailable,
				"studio links come from IGDB — add the IGDB client id and secret in Settings first")
			return
		}
		var logo string
		links, logo, _, err = igdb.CompanyLinks(r.Context(), req.Name)
		if err == nil && logo != "" {
			// The logo rides back on the same call rather than needing a second
			// one: it is the portrait for this row, and the two are one fact.
			if links == nil {
				links = map[string]string{}
			}
			links["logo_url"] = metadata.IGDBCoverURL(logo)
		}
	default:
		// Actors, directors and speakers are TMDB people, resolved by name.
		tmdb, _ := s.resolveTMDB()
		if tmdb == nil {
			writeErr(w, http.StatusServiceUnavailable,
				"these links come from TMDB — add a TMDB key in Settings first")
			return
		}
		links, err = s.actorLinks(r.Context(), tmdb, req.Name)
	}
	if err != nil {
		// The client only ever sees a generic message, so log the real provider
		// cause here — otherwise "lookup failed" is invisible in the logs.
		olog.Errorf(olog.CodePeopleLookupFailed, "[people] lookup kind=%s name=%q failed: %v", req.Kind, req.Name, err)
		if errors.Is(err, metadata.ErrTMDBAuth) {
			// A rejected key never fixes itself on retry — say so, don't tell the
			// user to "try again in a moment".
			writeErr(w, http.StatusBadGateway, "TMDB rejected the key — re-check it in Settings → Metadata sources.")
			return
		}
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

	// THE ROWS BEING RENAMED ARE FOUND FIRST, because since 0027 they decide
	// which credit columns get rewritten. A person is one row playing a set of
	// roles, so renaming Bose from the Authors console has to rewrite their
	// SPEAKER credits too — otherwise the row says one name, the library says
	// another, and the next orphan sweep un-files the role left behind.
	//
	// The lookup is by name alone. `kind` on this request now says only which
	// console the caller came from.
	rows, err := tx.Query(`SELECT id, image_path FROM people
	                       WHERE user_id = ? AND LOWER(name) = LOWER(?) AND name <> ?`,
		uid, req.From, req.To)
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

	// Which credit columns to rewrite. An UNSAVED name has no roles to read, and
	// the console lists referenced names whether or not they carry metadata — so
	// fall back to the role the caller came from rather than rewriting nothing.
	roles := map[string]bool{}
	for _, p := range froms {
		for _, k := range personKindsTx(tx, p.id) {
			roles[k] = true
		}
	}
	if len(roles) == 0 {
		roles[req.Kind] = true
	}
	ordered := make([]string, 0, len(roles))
	for k := range roles {
		ordered = append(ordered, k)
	}
	sort.Strings(ordered) // deterministic, so a failure reproduces

	var rewrites []rewrite
	for _, role := range ordered {
		scanQ, updateQ, ok := personCreditSQL(role)
		if !ok {
			// A role with no credit column — a value the API would not write
			// today. Skipping beats guessing: a rename that picks the wrong table
			// rewrites credits across the library with no undo.
			olog.Warnf(olog.CodePeopleOrphanGC, "[people] rename: no credit column for role %q; skipping", role)
			continue
		}
		crows, qerr := tx.Query(scanQ, uid)
		if qerr != nil {
			internalError(w, r, "rename scan", qerr)
			return
		}
		var found []rewrite
		for crows.Next() {
			var id int64
			var credit string
			if err := crows.Scan(&id, &credit); err != nil {
				olog.Warnf(olog.CodePeopleRowScan, "[people] rename credit row scan failed: %v", err)
				continue
			}
			if next, ok := metadata.ReplaceCredit(credit, req.From, req.To, seps); ok {
				found = append(found, rewrite{id, next})
			}
		}
		if err := crows.Err(); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[people] rename credit row iteration failed: %v", err)
		}
		crows.Close()

		// updateQ came from personCreditSQL alongside scanQ, so it cannot target a
		// different table than the one just scanned.
		for _, rw := range found {
			if _, e := tx.Exec(updateQ, rw.credit, rw.id); e != nil {
				internalError(w, r, "rename rewrite", e)
				return
			}
		}
		rewrites = append(rewrites, found...)
	}
	updated := int64(len(rewrites))

	// Fold the saved metadata onto `to`: the `from` rows either get renamed
	// (when `to` has no row yet) or are merged into it and deleted.
	var toID int64
	if err := tx.QueryRow(`SELECT COALESCE((SELECT id FROM people WHERE user_id = ? AND name = ?), 0)`,
		uid, req.To).Scan(&toID); err != nil {
		internalError(w, r, "rename to-check", err)
		return
	}
	if toID == 0 && len(froms) > 0 {
		// Rename the first from-row to `to` — keeps its bio/photo/links/id, and
		// its roles travel with the row.
		if _, e := tx.Exec(`UPDATE people SET name = ? WHERE id = ?`, req.To, froms[0].id); e != nil {
			internalError(w, r, "rename people", e)
			return
		}
		toID = froms[0].id
		froms = froms[1:] // the rest are now redundant duplicates
	}
	// A speaker rename changes the quotes' identity, so their hashes follow.
	// Once for the account rather than per rewritten row: the hash depends on
	// fields the loop above does not carry, and a second pass over a personal
	// library is nothing.
	if roles["speaker"] {
		if err := rehashRenamedQuotes(tx, uid); err != nil {
			internalError(w, r, "rename rehash quotes", err)
			return
		}
	}
	var freed []string
	for _, p := range froms {
		// THE ROLES MOVE BEFORE THE ROW GOES. Deleting the row cascades its
		// person_kinds away, so a speaker folded into an existing author row would
		// otherwise quietly stop being a speaker.
		if toID != 0 {
			if _, e := tx.Exec(
				`INSERT OR IGNORE INTO person_kinds (person_id, kind)
				 SELECT ?, kind FROM person_kinds WHERE person_id = ?`, toID, p.id); e != nil {
				internalError(w, r, "rename role merge", e)
				return
			}
		}
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
