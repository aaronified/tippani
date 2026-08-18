package store

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"unicode"
)

// ---------------------------------------------------------------------------
// Schema-shape capture
// ---------------------------------------------------------------------------
//
// Every other migration test in this package is BEHAVIOURAL: it INSERTs a row
// and checks whether a CHECK or a UNIQUE fires. That catches a great deal, but
// it only ever catches the rules somebody remembered to write an INSERT for. A
// rebuild that quietly drops a column default, widens a CHECK by one value, or
// forgets to recreate an index is invisible to it — the INSERT still succeeds,
// so the test still passes, and the damage only shows up months later as a
// column full of NULLs or a table scan on the review deck.
//
// So: capture the SHAPE. Columns with their types, nullability, defaults and
// primary-key position; the table's CHECK expressions; its indexes with their
// key columns; and its foreign keys with their referential actions. All of it
// comes from SQLite itself (PRAGMA table_info / index_list / index_info /
// foreign_key_list, plus the CREATE TABLE text in sqlite_master), never from a
// hand-maintained mirror of the migrations, so it cannot drift out of date the
// way a duplicated schema constant would.
//
// The urgency is 0018's warning, which is the sharpest statement of the hazard
// in this repo: `tags` is an FK parent of annotation_tags AND dialogue_tags,
// both ON DELETE CASCADE. A DROP-TABLE rebuild of tags — the standard SQLite
// dance for changing a constraint — silently takes every join row with it
// unless the migration parks and restores them, exactly as 0004 and 0018 do for
// the annotations/dialogues side. That is a data-loss bug that leaves the
// schema looking perfect afterwards. Nothing here can stop someone writing that
// migration, but TestTagDeleteCascades pins the cascade that makes it dangerous
// and TestSchemaShape pins what has to survive it.

// columnShape is one row of PRAGMA table_info: the facts about a column that a
// rebuild can lose without any INSERT noticing.
type columnShape struct {
	Name    string
	Type    string
	NotNull bool
	Default string // as SQLite reports it; "" means no default at all
	HasDflt bool   // distinguishes DEFAULT '' from no DEFAULT clause
	PK      int    // 0 = not part of the primary key, else 1-based position
}

func (c columnShape) String() string {
	dflt := "<none>"
	if c.HasDflt {
		dflt = c.Default
	}
	null := "null"
	if c.NotNull {
		null = "notnull"
	}
	return fmt.Sprintf("col   %-16s %-8s %-7s pk=%d default=%s", c.Name, c.Type, null, c.PK, dflt)
}

// indexShape is PRAGMA index_list plus the key columns from index_info. Origin
// matters: 'c' is a CREATE INDEX a migration must recreate by hand, 'u' is a
// UNIQUE table constraint that rides along with the CREATE TABLE, 'pk' is the
// primary key. A rebuild that turns a 'u' into nothing looks identical in
// table_info.
type indexShape struct {
	Name    string
	Unique  bool
	Origin  string // c | u | pk
	Partial bool
	Columns []string
}

func (i indexShape) String() string {
	// Auto-generated names (sqlite_autoindex_*) carry an ordinal that shifts
	// when constraints are reordered, so they are noise in a diff; the columns
	// and the uniqueness are the real content.
	name := i.Name
	if strings.HasPrefix(name, "sqlite_autoindex_") {
		name = "<auto>"
	}
	return fmt.Sprintf("index %-24s unique=%-5t origin=%-2s partial=%-5t (%s)",
		name, i.Unique, i.Origin, i.Partial, strings.Join(i.Columns, ", "))
}

// fkShape is one row of PRAGMA foreign_key_list. OnDelete is the field this
// whole file exists for.
type fkShape struct {
	From     string
	Table    string
	To       string
	OnDelete string
	OnUpdate string
}

func (f fkShape) String() string {
	return fmt.Sprintf("fk    %-16s -> %s(%s) on_delete=%s on_update=%s",
		f.From, f.Table, f.To, f.OnDelete, f.OnUpdate)
}

// tableShape is the whole picture for one table, comparable and printable.
type tableShape struct {
	Name     string
	Columns  []columnShape // in cid order — column ORDER is part of the shape
	Checks   []string      // normalised CHECK expressions, sorted
	Indexes  []indexShape  // sorted by rendered form, so the diff is stable
	FKs      []fkShape     // sorted by rendered form
	Triggers []string      // triggers whose tbl_name is this table, sorted
	SQL      string        // raw CREATE TABLE text, for a failure message to quote
}

// String renders the shape one fact per line. A test that fails prints this,
// so the message says WHAT changed rather than "shapes differ".
func (ts tableShape) String() string {
	var b strings.Builder
	fmt.Fprintf(&b, "table %s\n", ts.Name)
	for _, l := range ts.lines() {
		b.WriteString("  " + l + "\n")
	}
	return b.String()
}

// lines is the flat, order-stable rendering diffShape compares.
func (ts tableShape) lines() []string {
	out := make([]string, 0, len(ts.Columns)+len(ts.Checks)+len(ts.Indexes)+len(ts.FKs)+len(ts.Triggers))
	for _, c := range ts.Columns {
		out = append(out, c.String())
	}
	for _, c := range ts.Checks {
		out = append(out, "check "+c)
	}
	for _, i := range ts.Indexes {
		out = append(out, i.String())
	}
	for _, f := range ts.FKs {
		out = append(out, f.String())
	}
	for _, tr := range ts.Triggers {
		out = append(out, "trig  "+tr)
	}
	return out
}

// column finds a column by name.
func (ts tableShape) column(name string) (columnShape, bool) {
	for _, c := range ts.Columns {
		if c.Name == name {
			return c, true
		}
	}
	return columnShape{}, false
}

// columnNames is the ordered column list — handy for asserting that a rebuild
// neither dropped nor reordered anything.
func (ts tableShape) columnNames() []string {
	out := make([]string, 0, len(ts.Columns))
	for _, c := range ts.Columns {
		out = append(out, c.Name)
	}
	return out
}

// fkFrom finds the foreign key declared on a child column.
func (ts tableShape) fkFrom(col string) (fkShape, bool) {
	for _, f := range ts.FKs {
		if f.From == col {
			return f, true
		}
	}
	return fkShape{}, false
}

// indexOn finds an index by its exact key columns, ignoring the name — the
// point is the access path, and an auto-index has no name worth pinning.
func (ts tableShape) indexOn(cols ...string) (indexShape, bool) {
	for _, i := range ts.Indexes {
		if len(i.Columns) != len(cols) {
			continue
		}
		match := true
		for n := range cols {
			if i.Columns[n] != cols[n] {
				match = false
				break
			}
		}
		if match {
			return i, true
		}
	}
	return indexShape{}, false
}

// checkMentioning returns the CHECK expressions containing a substring, so a
// test can name the constraint it cares about without pinning its wording.
func (ts tableShape) checkMentioning(sub string) []string {
	var out []string
	for _, c := range ts.Checks {
		if strings.Contains(c, sub) {
			out = append(out, c)
		}
	}
	return out
}

// captureShape reads a table's shape straight out of SQLite.
func captureShape(t *testing.T, db *sql.DB, table string) tableShape {
	t.Helper()
	ts := tableShape{Name: table}

	if err := db.QueryRow(
		`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
	).Scan(&ts.SQL); err != nil {
		t.Fatalf("table %q: no CREATE TABLE in sqlite_master: %v", table, err)
	}
	ts.Checks = extractChecks(ts.SQL)

	rows, err := db.Query(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?)`, table)
	if err != nil {
		t.Fatalf("table_info(%s): %v", table, err)
	}
	for rows.Next() {
		var c columnShape
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&c.Name, &c.Type, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			t.Fatalf("table_info(%s) scan: %v", table, err)
		}
		c.NotNull, c.PK = notnull != 0, pk
		c.Default, c.HasDflt = dflt.String, dflt.Valid
		ts.Columns = append(ts.Columns, c)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatalf("table_info(%s): %v", table, err)
	}
	rows.Close()
	if len(ts.Columns) == 0 {
		t.Fatalf("table %q has no columns — does it exist?", table)
	}

	// index_list gives the indexes; index_info gives each one's key columns.
	// Two queries, drained separately, because the pool is only 4 connections
	// and nesting them would hold one open per index.
	type idxRow struct {
		name    string
		unique  bool
		origin  string
		partial bool
	}
	var idxRows []idxRow
	rows, err = db.Query(`SELECT name, "unique", origin, partial FROM pragma_index_list(?)`, table)
	if err != nil {
		t.Fatalf("index_list(%s): %v", table, err)
	}
	for rows.Next() {
		var r idxRow
		var uniq, partial int
		if err := rows.Scan(&r.name, &uniq, &r.origin, &partial); err != nil {
			rows.Close()
			t.Fatalf("index_list(%s) scan: %v", table, err)
		}
		r.unique, r.partial = uniq != 0, partial != 0
		idxRows = append(idxRows, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatalf("index_list(%s): %v", table, err)
	}
	rows.Close()

	for _, r := range idxRows {
		idx := indexShape{Name: r.name, Unique: r.unique, Origin: r.origin, Partial: r.partial}
		cols, err := db.Query(`SELECT name FROM pragma_index_info(?)`, r.name)
		if err != nil {
			t.Fatalf("index_info(%s): %v", r.name, err)
		}
		for cols.Next() {
			// NULL means an expression index — there is no column to name.
			var n sql.NullString
			if err := cols.Scan(&n); err != nil {
				cols.Close()
				t.Fatalf("index_info(%s) scan: %v", r.name, err)
			}
			if n.Valid {
				idx.Columns = append(idx.Columns, n.String)
			} else {
				idx.Columns = append(idx.Columns, "<expr>")
			}
		}
		if err := cols.Err(); err != nil {
			cols.Close()
			t.Fatalf("index_info(%s): %v", r.name, err)
		}
		cols.Close()
		ts.Indexes = append(ts.Indexes, idx)
	}

	rows, err = db.Query(
		`SELECT "from", "table", "to", on_delete, on_update FROM pragma_foreign_key_list(?)`, table)
	if err != nil {
		t.Fatalf("foreign_key_list(%s): %v", table, err)
	}
	for rows.Next() {
		var f fkShape
		// "to" is NULL when the reference is to the parent's implicit primary key.
		var to sql.NullString
		if err := rows.Scan(&f.From, &f.Table, &to, &f.OnDelete, &f.OnUpdate); err != nil {
			rows.Close()
			t.Fatalf("foreign_key_list(%s) scan: %v", table, err)
		}
		f.To = to.String
		if !to.Valid {
			f.To = "<rowid pk>"
		}
		ts.FKs = append(ts.FKs, f)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatalf("foreign_key_list(%s): %v", table, err)
	}
	rows.Close()

	// Triggers stand in for constraints SQLite cannot express: the FTS sync
	// triggers keep the search index honest, and item_reviews_*_del is the
	// polymorphic ON DELETE CASCADE 0015 could not declare. A rebuild DROPs the
	// table and takes all of them with it, which is why 0018 recreates each one
	// verbatim — and why losing one has to be a test failure, not a surprise.
	rows, err = db.Query(
		`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?`, table)
	if err != nil {
		t.Fatalf("triggers(%s): %v", table, err)
	}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			t.Fatalf("triggers(%s) scan: %v", table, err)
		}
		ts.Triggers = append(ts.Triggers, n)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatalf("triggers(%s): %v", table, err)
	}
	rows.Close()

	// Columns keep their cid order (that order IS part of the shape). Everything
	// else is a set, so sort it — otherwise SQLite's internal ordering leaks into
	// the diff and an unrelated migration reshuffles it.
	sort.Strings(ts.Checks)
	sort.Strings(ts.Triggers)
	sort.Slice(ts.Indexes, func(a, b int) bool { return ts.Indexes[a].String() < ts.Indexes[b].String() })
	sort.Slice(ts.FKs, func(a, b int) bool { return ts.FKs[a].String() < ts.FKs[b].String() })
	return ts
}

// diffShape reports the lines present in one shape and missing from the other,
// both ways round, so a failure names the fact that changed instead of dumping
// two walls of text at the reader.
func diffShape(want, got tableShape) []string {
	index := func(ls []string) map[string]int {
		m := map[string]int{}
		for _, l := range ls {
			m[l]++
		}
		return m
	}
	wl, gl := want.lines(), got.lines()
	wm, gm := index(wl), index(gl)
	var out []string
	for _, l := range wl {
		if gm[l] == 0 {
			out = append(out, "- "+l)
		}
		gm[l]--
	}
	for _, l := range gl {
		if wm[l] == 0 {
			out = append(out, "+ "+l)
		}
		wm[l]--
	}
	return out
}

// ---------------------------------------------------------------------------
// CHECK extraction
// ---------------------------------------------------------------------------

// extractChecks pulls every CHECK expression out of a CREATE TABLE statement.
// SQLite exposes columns, indexes and foreign keys through PRAGMAs but offers
// nothing for CHECK constraints, so the only source is the SQL text — which is
// also the exact text ALTER TABLE ADD COLUMN appends to, so a CHECK that
// arrived on a later column (dialogues.color in 0021) is found the same way as
// one declared in 0018's rebuild.
//
// This is a scanner, not a regexp, because it has to skip string literals,
// quoted identifiers and comments before it can trust a "CHECK" it sees:
// item_reviews' CREATE TABLE has `-- 'book' | 'screen'` hanging off a column,
// and a naive match would read the apostrophes as a literal and lose its place.
func extractChecks(sqlText string) []string {
	r := []rune(sqlText)
	var out []string
	for i := 0; i < len(r); {
		switch {
		case r[i] == '\'' || r[i] == '"' || r[i] == '`':
			i = skipQuoted(r, i)
		case r[i] == '[':
			for i < len(r) && r[i] != ']' {
				i++
			}
			i++
		case r[i] == '-' && i+1 < len(r) && r[i+1] == '-':
			for i < len(r) && r[i] != '\n' {
				i++
			}
		case r[i] == '/' && i+1 < len(r) && r[i+1] == '*':
			i += 2
			for i+1 < len(r) && !(r[i] == '*' && r[i+1] == '/') {
				i++
			}
			i += 2
		case isWordRune(r[i]):
			j := i
			for j < len(r) && isWordRune(r[j]) {
				j++
			}
			if strings.EqualFold(string(r[i:j]), "check") {
				k := j
				for k < len(r) && unicode.IsSpace(r[k]) {
					k++
				}
				if k < len(r) && r[k] == '(' {
					expr, end := balancedParens(r, k)
					out = append(out, collapseSpace(expr))
					i = end
					continue
				}
			}
			i = j
		default:
			i++
		}
	}
	return out
}

func isWordRune(c rune) bool {
	return c == '_' || unicode.IsLetter(c) || unicode.IsDigit(c)
}

// skipQuoted returns the index just past the closing quote of the literal or
// quoted identifier starting at i, honouring SQL's doubled-quote escape.
func skipQuoted(r []rune, i int) int {
	q := r[i]
	i++
	for i < len(r) {
		if r[i] == q {
			if i+1 < len(r) && r[i+1] == q {
				i += 2
				continue
			}
			return i + 1
		}
		i++
	}
	return i
}

// balancedParens returns the text inside the parenthesised group starting at
// open, and the index just past its closing paren.
func balancedParens(r []rune, open int) (string, int) {
	depth, i := 0, open
	start := open + 1
	for i < len(r) {
		switch {
		case r[i] == '\'' || r[i] == '"' || r[i] == '`':
			i = skipQuoted(r, i)
			continue
		case r[i] == '(':
			depth++
		case r[i] == ')':
			depth--
			if depth == 0 {
				return string(r[start:i]), i + 1
			}
		}
		i++
	}
	return string(r[start:]), len(r)
}

// collapseSpace squeezes whitespace runs to one space so that reindenting a
// migration does not read as a schema change. Safe here because no string
// literal in this schema contains whitespace; if one ever does, this comment is
// the thing that was wrong.
func collapseSpace(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// quotedLiterals returns the single-quoted string literals inside an
// expression, in order. Used to assert that a colour CHECK covers exactly four
// colours without pinning the exact spelling of the IN clause.
func quotedLiterals(expr string) []string {
	r := []rune(expr)
	var out []string
	for i := 0; i < len(r); {
		if r[i] == '\'' {
			end := skipQuoted(r, i)
			lit := string(r[i+1 : end-1])
			out = append(out, strings.ReplaceAll(lit, "''", "'"))
			i = end
			continue
		}
		i++
	}
	return out
}

// ---------------------------------------------------------------------------
// The expected shapes
// ---------------------------------------------------------------------------

// autoIndexName stands in for SQLite's generated constraint-index name
// (sqlite_autoindex_<table>_N). indexShape.String renders any such name as
// <auto>, because the ordinal shifts when constraints are reordered and is not
// a fact worth failing a build over — the key columns and the uniqueness are.
const autoIndexName = "sqlite_autoindex_"

// openHead is a fresh database with every migration applied: the schema a new
// install gets. The upgrade path from a populated older database is covered by
// openAt19 / openAt22 in the neighbouring files, and by
// TestTagJoinRowsSurviveMigration below.
func openHead(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	return s
}

// wantShapes is the schema I mean these six tables to have, written out fact by
// fact rather than hashed into a golden string — the point is that a reviewer
// can read a diff and say "no, dropping that default is wrong", which a digest
// makes impossible.
//
// Adding a column to one of these tables is expected to fail this test. That is
// the design: the failure prints the diff, and updating the list beside the
// migration is a deliberate, reviewable act. What it exists to stop is the
// SILENT loss — a rebuild that forgets `DEFAULT 'yellow'`, drops the noted_at
// column, or comes back without idx_at_tag.
func wantShapes() []tableShape {
	return []tableShape{
		{
			// tags is the table the next migration rebuilds, and the reason this
			// file exists. It is a per-user vocabulary: one row per (user, name),
			// carrying how the tag renders on the Tags page.
			Name: "tags",
			Columns: []columnShape{
				{Name: "id", Type: "INTEGER", PK: 1},
				{Name: "user_id", Type: "INTEGER", NotNull: true},
				{Name: "name", Type: "TEXT", NotNull: true},
				// 0005 gave tags a colour and a style. Both defaults matter: a tag
				// created by the importer names neither, and a NULL here would
				// reach the renderer as an absent style.
				{Name: "color", Type: "TEXT", NotNull: true, Default: "'yellow'", HasDflt: true},
				{Name: "style", Type: "TEXT", NotNull: true, Default: "'sticker'", HasDflt: true},
			},
			Checks: []string{
				"color IN ('yellow','blue','pink','orange','green','purple')",
				"style IN ('sticker','banner','flyout','tape','reel')",
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "u", Columns: []string{"user_id", "name"}},
			},
			FKs: []fkShape{
				{From: "user_id", Table: "users", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// Rebuilt by 0027, which is the other reason this file exists: that
			// migration MERGES rows, so it is the one migration in the repo whose
			// mistakes delete data rather than failing. What came out is keyed on
			// the person, not on the person-and-role.
			Name: "people",
			Columns: []columnShape{
				{Name: "id", Type: "INTEGER", PK: 1},
				{Name: "user_id", Type: "INTEGER", NotNull: true},
				{Name: "name", Type: "TEXT", NotNull: true},
				// Every enrichment field defaults to empty rather than NULL, so a
				// hand-made row and a fetched one read the same to the scanner.
				{Name: "bio", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "image_path", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "born", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "died", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "links", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "source", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "source_id", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				{Name: "created_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
			},
			Indexes: []indexShape{
				// (user_id, name), NOT (user_id, kind, name): the role stopped being
				// part of identity in 0027.
				{Name: autoIndexName, Unique: true, Origin: "u", Columns: []string{"user_id", "name"}},
			},
			FKs: []fkShape{
				{From: "user_id", Table: "users", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// The set a person's roles live in since 0027. Deliberately CHECK-free:
			// a CHECK is evaluated against existing data, so one unexpected value in
			// one database would turn the migration into a startup failure.
			Name: "person_kinds",
			Columns: []columnShape{
				{Name: "person_id", Type: "INTEGER", NotNull: true, PK: 1},
				{Name: "kind", Type: "TEXT", NotNull: true, PK: 2},
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "pk", Columns: []string{"person_id", "kind"}},
				// "everyone of kind X" is what the People console asks on every load.
				{Name: "idx_person_kinds_kind", Origin: "c", Columns: []string{"kind"}},
			},
			FKs: []fkShape{
				{From: "person_id", Table: "people", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// The join 0018 warned about. Two-column primary key, no surrogate id:
			// a quote either carries a tag or it does not.
			Name: "annotation_tags",
			Columns: []columnShape{
				{Name: "annotation_id", Type: "INTEGER", NotNull: true, PK: 1},
				{Name: "tag_id", Type: "INTEGER", NotNull: true, PK: 2},
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "pk", Columns: []string{"annotation_id", "tag_id"}},
				// The reverse lookup: "every highlight tagged grief" walks this,
				// and without it the Tags page table-scans the whole join.
				{Name: "idx_at_tag", Origin: "c", Columns: []string{"tag_id", "annotation_id"}},
			},
			FKs: []fkShape{
				{From: "annotation_id", Table: "annotations", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
				{From: "tag_id", Table: "tags", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// Identical in shape to annotation_tags, deliberately — the screen side
			// mirrors the book side everywhere (see 0021's note on the symmetry).
			Name: "dialogue_tags",
			Columns: []columnShape{
				{Name: "dialogue_id", Type: "INTEGER", NotNull: true, PK: 1},
				{Name: "tag_id", Type: "INTEGER", NotNull: true, PK: 2},
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "pk", Columns: []string{"dialogue_id", "tag_id"}},
				{Name: "idx_dt_tag", Origin: "c", Columns: []string{"tag_id", "dialogue_id"}},
			},
			FKs: []fkShape{
				{From: "dialogue_id", Table: "dialogues", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
				{From: "tag_id", Table: "tags", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// annotations has been rebuilt twice (0004, 0018) and extended four
			// times (0008 noted_at, 0009 sticker_x/y, 0011 sticker_id). This is
			// what came out the far end.
			Name: "annotations",
			Columns: []columnShape{
				{Name: "id", Type: "INTEGER", PK: 1},
				{Name: "book_id", Type: "INTEGER", NotNull: true},
				// Both nullable: a bare note with no quote is a legal annotation,
				// which is what the two-column CHECK below is for.
				{Name: "quote", Type: "TEXT"},
				{Name: "note", Type: "TEXT"},
				{Name: "color", Type: "TEXT", NotNull: true, Default: "'yellow'", HasDflt: true},
				{Name: "chapter", Type: "TEXT"},
				{Name: "location", Type: "TEXT"},
				// 0004 dropped the CHECK on source on purpose: the importer list
				// keeps growing and the app layer validates it. NOT NULL, no
				// default — every writer has to say where the highlight came from.
				{Name: "source", Type: "TEXT", NotNull: true},
				{Name: "favorite", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				{Name: "dedupe_hash", Type: "TEXT", NotNull: true},
				{Name: "created_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
				{Name: "updated_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
				{Name: "noted_at", Type: "TEXT"},
				{Name: "sticker_x", Type: "REAL"},
				{Name: "sticker_y", Type: "REAL"},
				{Name: "sticker_id", Type: "INTEGER"},
				// 0033. Not in the quiz, on purpose. A column on the row rather than a
				// flag on item_reviews, because item_reviews has no row at all for a
				// quote that has never been reviewed and inserting a bare one would
				// read as "seen" in four separate queries. See the migration.
				{Name: "review_excluded", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				// 0044. The chapter's NUMBER, beside the name `chapter` has held since
				// 0001. REAL because 12.5 is where an interlude goes, nullable with 0
				// meaning absent — series_index's convention, one table over, for the
				// identical field. Nothing was backfilled: see the migration.
				{Name: "chapter_no", Type: "REAL"},
			},
			Checks: []string{
				"color IN ('yellow','blue','pink','orange','green','purple')",
				"quote IS NOT NULL OR note IS NOT NULL",
			},
			Indexes: []indexShape{
				// The import dedupe. Scoped per book, not globally: the same
				// sentence highlighted in two books is two highlights.
				{Name: autoIndexName, Unique: true, Origin: "u", Columns: []string{"book_id", "dedupe_hash"}},
				{Name: "idx_ann_book", Origin: "c", Columns: []string{"book_id"}},
			},
			FKs: []fkShape{
				{From: "book_id", Table: "books", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
				// SET NULL, emphatically not CASCADE: retiring a sticker from the
				// sticker sheet must not delete the highlights wearing it.
				{From: "sticker_id", Table: "stickers", To: "id", OnDelete: "SET NULL", OnUpdate: "NO ACTION"},
			},
			Triggers: []string{
				"annotations_ad", "annotations_ai", "annotations_au",
				// 0015's polymorphic FK stand-in. A deleted highlight must take its
				// review row with it or the deck serves a card for a quote that no
				// longer exists.
				"item_reviews_book_del",
				// 0043's, the same shape and for the same reason: an anthology entry
				// points at (kind, item_id) across three tables and can hold no real
				// foreign key, so a deleted highlight has to be removed from every
				// anthology it was in. Left behind, it renders as a gap the reader
				// cannot delete because nothing on screen represents it.
				"anthology_entries_book_del",
			},
		},
		{
			// dialogues: 0003 base, rebuilt by 0018, then extended by 0020
			// (noted_at, source), 0021 (color) and 0025 (season, episode). The
			// column ORDER is the history — the ALTERed columns land after the
			// rebuild's, and a future rebuild that "tidies" them into a nicer order
			// is a change worth noticing.
			Name: "dialogues",
			Columns: []columnShape{
				{Name: "id", Type: "INTEGER", PK: 1},
				{Name: "movie_id", Type: "INTEGER", NotNull: true},
				// Unlike an annotation, a dialogue has no note-only form: a line is
				// a line. Hence NOT NULL here and no two-column CHECK below.
				{Name: "quote", Type: "TEXT", NotNull: true},
				{Name: "note", Type: "TEXT"},
				{Name: "character", Type: "TEXT"},
				{Name: "actor", Type: "TEXT"},
				{Name: "timestamp", Type: "TEXT"},
				{Name: "favorite", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				{Name: "dedupe_hash", Type: "TEXT", NotNull: true},
				{Name: "created_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
				{Name: "updated_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
				{Name: "sticker_x", Type: "REAL"},
				{Name: "sticker_y", Type: "REAL"},
				{Name: "sticker_id", Type: "INTEGER"},
				{Name: "noted_at", Type: "TEXT"},
				// 'manual' because everything already in the table when 0020 landed
				// had been typed into the browser.
				{Name: "source", Type: "TEXT", NotNull: true, Default: "'manual'", HasDflt: true},
				{Name: "color", Type: "TEXT", NotNull: true, Default: "'yellow'", HasDflt: true},
				// NULL is the only "unset" — season 0 is a real season (specials),
				// so these must stay nullable rather than 0-means-none. See 0025.
				{Name: "season", Type: "INTEGER"},
				{Name: "episode", Type: "INTEGER"},
				// 0033. Not in the quiz, on purpose. A column on the row rather than a
				// flag on item_reviews, because item_reviews has no row at all for a
				// quote that has never been reviewed and inserting a bare one would
				// read as "seen" in four separate queries. See the migration.
				{Name: "review_excluded", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
			},
			Checks: []string{
				"color IN ('yellow','blue','pink','orange','green','purple')",
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "u", Columns: []string{"movie_id", "dedupe_hash"}},
				{Name: "idx_dlg_movie", Origin: "c", Columns: []string{"movie_id"}},
			},
			FKs: []fkShape{
				{From: "movie_id", Table: "movies", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
				{From: "sticker_id", Table: "stickers", To: "id", OnDelete: "SET NULL", OnUpdate: "NO ACTION"},
			},
			Triggers: []string{
				"dialogues_ad", "dialogues_ai", "dialogues_au",
				"item_reviews_screen_del",
				"anthology_entries_screen_del", // 0043 — see annotations above
			},
		},
		{
			// item_reviews is the spaced-repetition schedule, keyed polymorphically
			// on (kind, item_id). It has NO foreign keys and cannot have any — the
			// two parents are annotations and dialogues — so the triggers on those
			// two tables are the entire referential-integrity story. See 0015.
			Name: "item_reviews",
			Columns: []columnShape{
				{Name: "kind", Type: "TEXT", NotNull: true, PK: 1},
				{Name: "item_id", Type: "INTEGER", NotNull: true, PK: 2},
				// 1.0 day is a brand-new card's half-life; 0019 capped stored
				// values at 100 but left the starting point alone.
				{Name: "stability", Type: "REAL", NotNull: true, Default: "1.0", HasDflt: true},
				{Name: "review_count", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				{Name: "lapse_count", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				{Name: "last_result", Type: "TEXT", NotNull: true, Default: "''", HasDflt: true},
				// Nullable: a card that has only ever been skipped has been touched
				// but never reviewed, and the two dates say different things.
				{Name: "last_reviewed_at", Type: "TEXT"},
				{Name: "last_touched_at", Type: "TEXT", NotNull: true},
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "pk", Columns: []string{"kind", "item_id"}},
			},
		},
		{
			// trash is the bin (0031): one row per deleted THING, holding a JSON
			// snapshot of its whole subtree. It is pinned here because the CHECK and
			// the two defaults are the feature: a kind outside the six would be a
			// restore path that does not exist, and a payload that could arrive NULL
			// would be a bin entry with nothing in it.
			//
			// NO FOREIGN KEY to anything it describes, and there cannot be one — the
			// rows it holds do not exist. `user_id` is whose BIN the row sits in,
			// which for kind='account' is the admin who deleted the account rather
			// than the account itself; see the migration header for why the cascade
			// would otherwise delete the entry that makes the deletion undoable.
			Name: "trash",
			Columns: []columnShape{
				{Name: "id", Type: "INTEGER", PK: 1},
				{Name: "user_id", Type: "INTEGER", NotNull: true},
				{Name: "kind", Type: "TEXT", NotNull: true},
				{Name: "label", Type: "TEXT", NotNull: true},
				{Name: "child_count", Type: "INTEGER", NotNull: true, Default: "0", HasDflt: true},
				{Name: "deleted_at", Type: "TEXT", NotNull: true, Default: "datetime('now')", HasDflt: true},
				{Name: "payload", Type: "TEXT", NotNull: true},
				{Name: "files", Type: "TEXT", NotNull: true, Default: "'[]'", HasDflt: true},
			},
			Checks: []string{
				// 'selection' since 0032: a bulk delete is ONE entry holding every row
				// from every item, so the bin shows one decision rather than forty.
				"kind IN ('book','movie','annotation','dialogue','quote','account','selection')",
			},
			Indexes: []indexShape{
				{Name: "trash_user_time", Origin: "c", Columns: []string{"user_id", "deleted_at"}},
			},
			FKs: []fkShape{
				{From: "user_id", Table: "users", To: "id", OnDelete: "CASCADE", OnUpdate: "NO ACTION"},
			},
		},
		{
			// id_floor (0031) is two columns and the reason a restore never has to
			// renumber anything. `next_id` is the lowest id that may be handed out
			// for that table; every create path allocates from it and a restore
			// raises it above whatever it puts back.
			//
			// If this table is ever dropped or its default changed to something that
			// can be NULL, ids start being reused the moment a table's highest row
			// is deleted — and the symptom is not an error, it is a restore that
			// collides months later.
			Name: "id_floor",
			Columns: []columnShape{
				{Name: "table_name", Type: "TEXT", NotNull: false, PK: 1},
				{Name: "next_id", Type: "INTEGER", NotNull: true},
			},
			Indexes: []indexShape{
				{Name: autoIndexName, Unique: true, Origin: "pk", Columns: []string{"table_name"}},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Does the tripwire actually trip?
// ---------------------------------------------------------------------------

// widgetDDL is a miniature of the schema this file guards: a child table with a
// cascading foreign key, a defaulted column under a CHECK, a UNIQUE constraint,
// a hand-made index and a trigger. Each case below rewrites exactly one part of
// it and demands that the diff notices.
//
// This exists because every assertion in this file is worth precisely as much
// as captureShape's ability to see a change. A helper that quietly returned an
// empty CHECK list, or an index list without its key columns, would make
// TestSchemaShape pass forever while seeing nothing — the most expensive kind
// of test there is. I could not prove the tripwire trips by breaking a real
// migration (the whole point is not to), so it is proved here instead.
const widgetDDL = `
CREATE TABLE holder (id INTEGER PRIMARY KEY);
CREATE TABLE shelf (id INTEGER PRIMARY KEY);   -- never referenced by the base DDL; it
                                               -- exists only so one case below can
                                               -- repoint widget's foreign key at a
                                               -- DIFFERENT parent, which is the drift
                                               -- a rebuild produces by copying the
                                               -- wrong REFERENCES clause.
CREATE TABLE widget (
  id INTEGER PRIMARY KEY,
  holder_id INTEGER NOT NULL REFERENCES holder(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow','blue')),
  label TEXT,
  note TEXT,
  UNIQUE (holder_id, note)
);
CREATE INDEX idx_widget_holder ON widget(holder_id);
CREATE TRIGGER widget_ad AFTER DELETE ON widget BEGIN
  DELETE FROM holder WHERE id = -1;
END;`

// shapeOfDDL runs a schema fragment against its own throwaway database and
// captures the shape of `widget`. Each variant gets its own file so the table
// and index names can stay identical — otherwise the names alone would show up
// as differences and every case would "pass" for the wrong reason.
func shapeOfDDL(t *testing.T, ddl string) tableShape {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "shape.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if _, err := s.DB.Exec(ddl); err != nil {
		t.Fatalf("DDL rejected by SQLite: %v\n%s", err, ddl)
	}
	return captureShape(t, s.DB, "widget")
}

func TestSchemaShapeDetectsDrift(t *testing.T) {
	base := shapeOfDDL(t, widgetDDL)

	// Control. If this ever fails, the capture is not deterministic and every
	// other assertion in this file is noise.
	if d := diffShape(base, shapeOfDDL(t, widgetDDL)); len(d) > 0 {
		t.Fatalf("the same DDL captured twice produced a diff:\n%s", strings.Join(d, "\n"))
	}

	for _, tc := range []struct {
		name   string
		from   string // the fragment of widgetDDL this drift rewrites
		to     string
		wantIn string // a token the resulting diff has to mention
	}{
		{
			name: "a rebuild drops a column default",
			from: "DEFAULT 'yellow' ", to: "",
			wantIn: "default=<none>",
		},
		{
			name: "a rebuild widens a CHECK by one value",
			from: "'yellow','blue'", to: "'yellow','blue','chartreuse'",
			wantIn: "chartreuse",
		},
		{
			name: "a rebuild loses ON DELETE CASCADE",
			from: " ON DELETE CASCADE", to: "",
			wantIn: "on_delete=NO ACTION",
		},
		{
			name: "a rebuild forgets to recreate an index",
			from: "CREATE INDEX idx_widget_holder ON widget(holder_id);", to: "",
			wantIn: "idx_widget_holder",
		},
		{
			// The case the header comment names as the nightmare — "an index list
			// without its key columns" — and the one the rest of this test was
			// blind to: the index comes back under the RIGHT NAME on the WRONG
			// COLUMNS. Nothing about the name, the uniqueness or the origin
			// changes, so only the captured key columns can tell the difference.
			// If captureShape ever stops reading index_info, this is the case
			// that goes red.
			name: "a rebuild recreates an index on the wrong column",
			from: "ON widget(holder_id);", to: "ON widget(color);",
			wantIn: "(color)",
		},
		{
			// Column ORDER inside an index is the access path, not decoration:
			// idx_at_tag is (tag_id, annotation_id) precisely so "every highlight
			// tagged grief" is a seek and not a scan, and the primary key already
			// covers the other direction. A rebuild that types the two columns the
			// other way round leaves an index that is present, unique, correctly
			// named — and useless for the query it was created for.
			name: "a rebuild reverses an index's column order",
			from: "UNIQUE (holder_id, note)", to: "UNIQUE (note, holder_id)",
			wantIn: "(note, holder_id)",
		},
		{
			// 0001 writes genuinely partial indexes (idx_books_user_isbn is
			// `WHERE isbn IS NOT NULL`), so a WHERE clause landing on — or falling
			// off — an index in a rebuild is a live hazard here, not a theoretical
			// one. A partial UNIQUE stops enforcing uniqueness over the rows the
			// predicate excludes, which no INSERT test notices until the duplicate
			// arrives.
			name: "a rebuild narrows an index with a WHERE clause",
			from: "ON widget(holder_id);", to: "ON widget(holder_id) WHERE holder_id > 0;",
			wantIn: "partial=true",
		},
		{
			// Declared type drives SQLite's affinity, so retyping a column changes
			// what comes back out of it: TEXT '007' stored in an INTEGER column
			// reads back as 7. A rebuild that mistypes one column in a
			// hand-retyped CREATE TABLE is exactly how that happens.
			name: "a rebuild changes a column's declared type",
			from: "label TEXT", to: "label BLOB",
			wantIn: "BLOB",
		},
		{
			// The referential action survived but the PARENT did not. Copying a
			// REFERENCES clause off the neighbouring column is an easy slip in a
			// hand-written rebuild, and it produces a foreign key that still says
			// ON DELETE CASCADE while cascading from entirely the wrong table.
			name: "a rebuild repoints a foreign key at the wrong parent",
			from: "REFERENCES holder(id)", to: "REFERENCES shelf(id)",
			wantIn: "-> shelf(id)",
		},
		{
			name: "a rebuild loses a UNIQUE constraint",
			from: ",\n  UNIQUE (holder_id, note)", to: "",
			wantIn: "unique=true",
		},
		{
			name: "a rebuild drops a column outright",
			from: "  label TEXT,\n", to: "",
			wantIn: "label",
		},
		{
			name: "a rebuild loses NOT NULL",
			from: "color TEXT NOT NULL", to: "color TEXT",
			wantIn: "notnull",
		},
		{
			name: "a rebuild forgets to recreate a trigger",
			from: "CREATE TRIGGER widget_ad AFTER DELETE ON widget BEGIN\n  DELETE FROM holder WHERE id = -1;\nEND;",
			to:   "",
			// Exactly 0018's collateral damage: DROP TABLE takes the FTS sync and
			// item_reviews stand-in triggers with it, and only recreating them by
			// hand brings them back.
			wantIn: "widget_ad",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if !strings.Contains(widgetDDL, tc.from) {
				t.Fatalf("case is vacuous: widgetDDL does not contain %q", tc.from)
			}
			drifted := shapeOfDDL(t, strings.Replace(widgetDDL, tc.from, tc.to, 1))
			d := diffShape(base, drifted)
			if len(d) == 0 {
				t.Fatalf("drift went unnoticed; captureShape cannot see this change\n%s", drifted)
			}
			if !strings.Contains(strings.Join(d, "\n"), tc.wantIn) {
				t.Fatalf("diff does not mention %q, so a failure would not say what broke:\n%s",
					tc.wantIn, strings.Join(d, "\n"))
			}
		})
	}

	// Reordering columns changes no fact about any single column, so the
	// multiset diff is silent by design — the ordered column list is what
	// catches it, which is why TestSchemaShape asserts both.
	t.Run("a rebuild reorders columns", func(t *testing.T) {
		swapped := shapeOfDDL(t, strings.Replace(widgetDDL,
			"  label TEXT,\n  note TEXT,\n", "  note TEXT,\n  label TEXT,\n", 1))
		if d := diffShape(base, swapped); len(d) != 0 {
			t.Fatalf("expected the multiset diff to be blind to a reorder, got:\n%s", strings.Join(d, "\n"))
		}
		if strings.Join(base.columnNames(), ",") == strings.Join(swapped.columnNames(), ",") {
			t.Fatal("column order was not captured, so TestSchemaShape's order check is vacuous")
		}
	})
}

// TestSchemaShape is the tripwire: it applies every migration to a fresh
// database and compares the six most at-risk tables against wantShapes, fact by
// fact. A failure prints the differing lines, the whole current shape and the
// CREATE TABLE text, so the reader can tell a deliberate change from a
// rebuild's collateral damage without opening a SQLite shell.
func TestSchemaShape(t *testing.T) {
	s := openHead(t)
	for _, want := range wantShapes() {
		t.Run(want.Name, func(t *testing.T) {
			got := captureShape(t, s.DB, want.Name)
			if d := diffShape(want, got); len(d) > 0 {
				t.Fatalf("%s: schema shape drifted (- want, + got)\n%s\n\nfull shape now:\n%s\nCREATE TABLE:\n%s",
					want.Name, strings.Join(d, "\n"), got, got.SQL)
			}
			// diffShape compares multisets, so it cannot see a pure reordering —
			// which still matters, because a bare INSERT and every `SELECT *`
			// reader binds by position.
			w, g := strings.Join(want.columnNames(), ", "), strings.Join(got.columnNames(), ", ")
			if w != g {
				t.Fatalf("%s: column ORDER changed\n want: %s\n got:  %s", want.Name, w, g)
			}
		})
	}
}

// TestSchemaInvariants states the handful of rules the application actually
// leans on, as rules. TestSchemaShape above would catch every one of these
// breaking, but it would report them as "line differs"; these say WHY the line
// mattered, and they keep holding when a benign new column makes the pinned
// shape stale.
func TestSchemaInvariants(t *testing.T) {
	s := openHead(t)
	shapes := map[string]tableShape{}
	for _, n := range []string{
		"tags", "annotation_tags", "dialogue_tags", "utterance_tags",
		"annotations", "dialogues", "utterances", "staged_quotes", "item_reviews",
	} {
		shapes[n] = captureShape(t, s.DB, n)
	}

	// The colour set is fixed at any given time and the UI paints exactly that
	// many swatches. A CHECK that is wider than the set lets a colour into the
	// database that no client can render; one that is narrower starts rejecting
	// rows already stored. Assert the SET, not the spelling, so reordering the IN
	// list is not a failure.
	//
	// 0029 took this from four to six by rebuilding FIVE tables — every one of
	// them a foreign-key parent with cascading children. Changing this list is
	// therefore never a one-line edit here: it means another migration, and this
	// assertion is what says so out loud.
	//
	// utterances and staged_quotes are checked too. They were absent while this
	// list was four values long, which meant two of the five tables carrying the
	// constraint had nothing watching them.
	wantColors := []string{"blue", "green", "orange", "pink", "purple", "yellow"}
	for _, table := range []string{"tags", "annotations", "dialogues", "utterances", "staged_quotes"} {
		checks := shapes[table].checkMentioning("color IN")
		if len(checks) != 1 {
			// Errorf, not Fatalf: every other rule in this function reports and
			// carries on, and a missing colour CHECK on `tags` is no reason to
			// stop telling the reader that the sticker foreign key also broke.
			t.Errorf("%s: want exactly one colour CHECK, got %d: %v", table, len(checks), checks)
			continue
		}
		got := quotedLiterals(checks[0])
		sort.Strings(got)
		if strings.Join(got, ",") != strings.Join(wantColors, ",") {
			t.Errorf("%s colour CHECK covers %v, want exactly %v\n  check: %s",
				table, got, wantColors, checks[0])
		}
	}

	// Referential actions, each one load-bearing in a different direction.
	for _, tc := range []struct{ table, column, parent, action, why string }{
		{"tags", "user_id", "users", "CASCADE",
			"deleting an account takes its private vocabulary with it"},
		{"annotation_tags", "tag_id", "tags", "CASCADE",
			"deleting a tag unfiles the highlights, and 0018 warns this fires on a tags rebuild"},
		{"dialogue_tags", "tag_id", "tags", "CASCADE",
			"same cascade on the screen side — a tags rebuild hits BOTH joins"},
		{"annotation_tags", "annotation_id", "annotations", "CASCADE",
			"a deleted highlight must not leave a join row pointing at nothing"},
		{"dialogue_tags", "dialogue_id", "dialogues", "CASCADE",
			"likewise for a deleted line"},
		{"annotations", "book_id", "books", "CASCADE",
			"deleting a book deletes its highlights"},
		{"dialogues", "movie_id", "movies", "CASCADE",
			"deleting a film or show deletes its lines"},
		{"annotations", "sticker_id", "stickers", "SET NULL",
			"retiring a sticker must NOT delete the highlights wearing it"},
		{"dialogues", "sticker_id", "stickers", "SET NULL",
			"and must not delete the lines either"},
	} {
		fk, ok := shapes[tc.table].fkFrom(tc.column)
		if !ok {
			t.Errorf("%s.%s: foreign key to %s is gone (%s)", tc.table, tc.column, tc.parent, tc.why)
			continue
		}
		if fk.Table != tc.parent || fk.OnDelete != tc.action {
			t.Errorf("%s.%s -> %s(%s) ON DELETE %s; want %s(id) ON DELETE %s — %s",
				tc.table, tc.column, fk.Table, fk.To, fk.OnDelete, tc.parent, tc.action, tc.why)
		}
	}

	// The unique keys. Two kinds here: the import dedupe indexes (the only thing
	// stopping a re-imported file from doubling every quote) and the identity
	// keys of the joins and the schedule.
	for _, tc := range []struct {
		table string
		cols  []string
		why   string
	}{
		{"annotations", []string{"book_id", "dedupe_hash"}, "re-importing a file must not double the highlights"},
		{"dialogues", []string{"movie_id", "dedupe_hash"}, "same dedupe on the screen side"},
		{"tags", []string{"user_id", "name"}, "one tag per name per user; the Tags page merges on it"},
		{"annotation_tags", []string{"annotation_id", "tag_id"}, "a highlight carries a tag once"},
		{"dialogue_tags", []string{"dialogue_id", "tag_id"}, "a line carries a tag once"},
		{"item_reviews", []string{"kind", "item_id"}, "one schedule row per reviewable item"},
	} {
		idx, ok := shapes[tc.table].indexOn(tc.cols...)
		if !ok {
			t.Errorf("%s: no index on (%s) — %s", tc.table, strings.Join(tc.cols, ", "), tc.why)
			continue
		}
		if !idx.Unique {
			t.Errorf("%s: index on (%s) is no longer UNIQUE — %s",
				tc.table, strings.Join(tc.cols, ", "), tc.why)
		}
	}

	// The reverse-lookup indexes on the joins. Nothing fails without them; the
	// Tags page just quietly starts scanning, which no behavioural test can see.
	for _, tc := range []struct {
		table string
		cols  []string
	}{
		{"annotation_tags", []string{"tag_id", "annotation_id"}},
		{"dialogue_tags", []string{"tag_id", "dialogue_id"}},
	} {
		if _, ok := shapes[tc.table].indexOn(tc.cols...); !ok {
			t.Errorf("%s: the tag-first index on (%s) is gone; listing a tag's quotes now scans",
				tc.table, strings.Join(tc.cols, ", "))
		}
	}

	// item_reviews cannot hold a foreign key (two possible parents), so the
	// triggers on annotations and dialogues ARE its cascade. 0018 had to
	// recreate both by hand after its rebuilds; the next rebuild will too.
	if n := len(shapes["item_reviews"].FKs); n != 0 {
		t.Errorf("item_reviews grew %d foreign keys; it is polymorphic and can have none", n)
	}
	// anthology_entries (0043) is the third table of this shape and the second to
	// need writing out by hand, so its three triggers are named here beside
	// item_reviews'. utterances carries only the anthology one: item_reviews has no
	// utterance trigger because 0026's quotes arrived with the id floor already in
	// place, while anthology_entries needs all three — the orphan is a correctness
	// problem whether or not the id can be reused.
	for _, tc := range []struct{ table, trigger string }{
		{"annotations", "item_reviews_book_del"},
		{"dialogues", "item_reviews_screen_del"},
		{"annotations", "anthology_entries_book_del"},
		{"dialogues", "anthology_entries_screen_del"},
		{"utterances", "anthology_entries_utterance_del"},
	} {
		found := false
		for _, tr := range shapes[tc.table].Triggers {
			if tr == tc.trigger {
				found = true
			}
		}
		if !found {
			t.Errorf("%s: trigger %s is missing — it is the ON DELETE CASCADE item_reviews cannot declare (have %v)",
				tc.table, tc.trigger, shapes[tc.table].Triggers)
		}
	}
}

// ---------------------------------------------------------------------------
// The cascade, exercised for real
// ---------------------------------------------------------------------------

// seedTagged fills a freshly migrated database with one user, one book, one
// film, one highlight, one line, and two tags applied to both quotes. Returns
// nothing: every test below addresses the rows by their fixed ids.
func seedTagged(t *testing.T, s *Store) {
	t.Helper()
	for _, q := range []string{
		`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`,
		`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Invisible Cities', 'Italo Calvino')`,
		`INSERT INTO movies (id, user_id, title, director) VALUES (1, 1, 'Stalker', 'Andrei Tarkovsky')`,
		`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash)
		 VALUES (1, 1, 'Cities, like dreams, are made of desires and fears.', 'yellow', 'manual', 'h1')`,
		`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
		 VALUES (1, 1, 'Let everything that has been planned come true.', 'h2')`,
		`INSERT INTO tags (id, user_id, name) VALUES (1, 1, 'longing')`,
		`INSERT INTO tags (id, user_id, name) VALUES (2, 1, 'cities')`,
		`INSERT INTO annotation_tags (annotation_id, tag_id) VALUES (1, 1), (1, 2)`,
		`INSERT INTO dialogue_tags (dialogue_id, tag_id) VALUES (1, 1), (1, 2)`,
	} {
		if _, err := s.DB.Exec(q); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
}

func countRows(t *testing.T, s *Store, query string, args ...any) int {
	t.Helper()
	var n int
	if err := s.DB.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

// TestTagDeleteCascades proves the cascade 0018 warned about actually fires,
// and fires in one direction only. Deleting a tag unfiles every quote that
// carried it — on BOTH sides, books and screen — while leaving the quotes
// themselves, and the other tag's filing, untouched.
//
// This is the behaviour that makes a DROP-TABLE rebuild of `tags` dangerous:
// the implicit delete SQLite performs when the old table goes runs this exact
// cascade against every join row in the database. A migration that rebuilds
// tags has to park annotation_tags and dialogue_tags first and restore them
// after, the way 0004 and 0018 do for the annotations/dialogues side.
func TestTagDeleteCascades(t *testing.T) {
	s := openHead(t)
	seedTagged(t, s)

	if n := countRows(t, s, `SELECT count(*) FROM annotation_tags`); n != 2 {
		t.Fatalf("setup: annotation_tags has %d rows, want 2", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM dialogue_tags`); n != 2 {
		t.Fatalf("setup: dialogue_tags has %d rows, want 2", n)
	}

	if _, err := s.DB.Exec(`DELETE FROM tags WHERE id = 1`); err != nil {
		t.Fatalf("delete tag: %v", err)
	}

	// Both joins lost exactly the rows for tag 1.
	if n := countRows(t, s, `SELECT count(*) FROM annotation_tags WHERE tag_id = 1`); n != 0 {
		t.Errorf("annotation_tags: %d rows still point at the deleted tag; the cascade did not fire", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM dialogue_tags WHERE tag_id = 1`); n != 0 {
		t.Errorf("dialogue_tags: %d rows still point at the deleted tag; the cascade did not fire", n)
	}
	// ...and nothing else.
	if n := countRows(t, s, `SELECT count(*) FROM annotation_tags WHERE tag_id = 2`); n != 1 {
		t.Errorf("annotation_tags: the surviving tag's filing went too (%d rows, want 1)", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM dialogue_tags WHERE tag_id = 2`); n != 1 {
		t.Errorf("dialogue_tags: the surviving tag's filing went too (%d rows, want 1)", n)
	}
	// The cascade runs from tag to join and stops. Untagging is not deleting:
	// if this ever fails, removing a tag has started destroying quotes.
	if n := countRows(t, s, `SELECT count(*) FROM annotations`); n != 1 {
		t.Errorf("deleting a tag deleted the highlight itself (%d annotations left, want 1)", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM dialogues`); n != 1 {
		t.Errorf("deleting a tag deleted the line itself (%d dialogues left, want 1)", n)
	}

	// The other direction: deleting a quote unfiles it but leaves the tag in the
	// user's vocabulary, because a tag is a thing you own, not a label on a row.
	if _, err := s.DB.Exec(`DELETE FROM annotations WHERE id = 1`); err != nil {
		t.Fatalf("delete annotation: %v", err)
	}
	if n := countRows(t, s, `SELECT count(*) FROM annotation_tags`); n != 0 {
		t.Errorf("annotation_tags: %d rows outlived their highlight", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM tags WHERE id = 2`); n != 1 {
		t.Error("deleting a highlight deleted the tag; tags belong to the user, not the quote")
	}

	// And the root: deleting the account clears the vocabulary and both joins.
	if _, err := s.DB.Exec(`DELETE FROM users WHERE id = 1`); err != nil {
		t.Fatalf("delete user: %v", err)
	}
	for _, table := range []string{"tags", "annotation_tags", "dialogue_tags"} {
		if n := countRows(t, s, `SELECT count(*) FROM `+table); n != 0 {
			t.Errorf("%s: %d rows outlived the account", table, n)
		}
	}
}

// TestTagJoinRowsSurviveMigration is the guard aimed squarely at the next
// migration. It seeds tags and both joins at the 0019 schema, then upgrades to
// head and checks the filing is still there.
//
// Today it passes trivially — no migration since 0019 touches tags. That is the
// point: it is already in place for the rebuild that does. A `tags` rebuild
// written without parking annotation_tags and dialogue_tags will drop both sets
// of join rows the moment DROP TABLE runs, leave a perfectly correct-looking
// schema behind, and fail HERE rather than in a bug report six months later.
func TestTagJoinRowsSurviveMigration(t *testing.T) {
	// openAt19 already seeds the user, book, film, highlight and line.
	s := openAt19(t)
	for _, q := range []string{
		`INSERT INTO tags (id, user_id, name, color, style) VALUES (1, 1, 'longing', 'blue', 'banner')`,
		`INSERT INTO tags (id, user_id, name) VALUES (2, 1, 'cities')`,
		`INSERT INTO annotation_tags (annotation_id, tag_id) VALUES (1, 1), (1, 2)`,
		`INSERT INTO dialogue_tags (dialogue_id, tag_id) VALUES (1, 1), (1, 2)`,
	} {
		if _, err := s.DB.Exec(q); err != nil {
			t.Fatalf("seed at v19 %q: %v", q, err)
		}
	}

	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	if n := countRows(t, s, `SELECT count(*) FROM tags`); n != 2 {
		t.Fatalf("tags: %d rows survived the upgrade, want 2", n)
	}
	// The non-default colour/style came through: a rebuild that recreates the
	// table but copies only (id, user_id, name) passes a row count and still
	// loses how every tag looks.
	var color, style string
	if err := s.DB.QueryRow(`SELECT color, style FROM tags WHERE id = 1`).Scan(&color, &style); err != nil {
		t.Fatalf("tag 1: %v", err)
	}
	if color != "blue" || style != "banner" {
		t.Errorf("tag 1 presentation lost in migration: color=%q style=%q, want blue/banner", color, style)
	}

	for _, tc := range []struct{ table, query string }{
		{"annotation_tags", `SELECT count(*) FROM annotation_tags WHERE annotation_id = 1`},
		{"dialogue_tags", `SELECT count(*) FROM dialogue_tags WHERE dialogue_id = 1`},
	} {
		if n := countRows(t, s, tc.query); n != 2 {
			t.Errorf("%s: %d join rows survived the upgrade, want 2 — a rebuild cascade-deleted the filing",
				tc.table, n)
		}
	}
}

// TestSchemaItemReviewTriggersStandInForCascade exercises the other half of the
// 0018 hazard. item_reviews has no foreign key and cannot have one, so the only
// thing tying a schedule row to its quote is a trigger on the parent — a
// trigger that a table rebuild silently drops with the table. If this fails,
// the review deck has started serving cards for quotes that were deleted.
func TestSchemaItemReviewTriggersStandInForCascade(t *testing.T) {
	s := openHead(t)
	seedTagged(t, s)
	for _, q := range []string{
		`INSERT INTO item_reviews (kind, item_id, last_touched_at) VALUES ('book', 1, '2026-01-01')`,
		`INSERT INTO item_reviews (kind, item_id, last_touched_at) VALUES ('screen', 1, '2026-01-01')`,
	} {
		if _, err := s.DB.Exec(q); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}

	if _, err := s.DB.Exec(`DELETE FROM annotations WHERE id = 1`); err != nil {
		t.Fatalf("delete annotation: %v", err)
	}
	if n := countRows(t, s, `SELECT count(*) FROM item_reviews WHERE kind = 'book'`); n != 0 {
		t.Errorf("item_reviews: %d book rows outlived their highlight", n)
	}
	// The screen row is untouched — the two triggers are scoped by kind, so
	// deleting a highlight must not disturb the film side of the deck.
	if n := countRows(t, s, `SELECT count(*) FROM item_reviews WHERE kind = 'screen'`); n != 1 {
		t.Errorf("item_reviews: deleting a highlight took %d screen rows with it", 1-n)
	}

	if _, err := s.DB.Exec(`DELETE FROM dialogues WHERE id = 1`); err != nil {
		t.Fatalf("delete dialogue: %v", err)
	}
	if n := countRows(t, s, `SELECT count(*) FROM item_reviews`); n != 0 {
		t.Errorf("item_reviews: %d rows outlived their quotes", n)
	}
}

// TestAnthologyEntriesFollowTheirQuotes is the same proof for 0043's three
// triggers, and it needs all three: an anthology draws from every kind at once,
// which is the one thing a board cannot do, so a cascade that works for two kinds
// out of three is a feature that quietly rots for the third.
//
// The failure it guards is not a crash. An orphaned entry leaves the anthology
// rendering a gap — a position and a piece of the reader's own commentary with no
// quote under it — that they cannot delete, because nothing on screen represents
// the thing to delete.
//
// AND ONE THING IT DELIBERATELY DOES NOT ASSERT: that a reused rowid inherits an
// orphan's entries. 0026's header warns about id reuse, and the plan for this
// feature repeated the warning — but 0031's id floor took it away for exactly
// these three tables, and it did so BECAUSE item_reviews had already been bitten
// by it. Writing that case here would be a test whose subject is another file's
// guarantee; TestIDFloorNeverReusesAnID is where it belongs.
func TestAnthologyEntriesFollowTheirQuotes(t *testing.T) {
	s := openHead(t)
	seedTagged(t, s)
	for _, q := range []string{
		// A standalone quote, which seedTagged has no reason to make: it exists for
		// the third trigger, and it is the kind with no parent table at all.
		`INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
		 VALUES (1, 1, 'Give me blood, and I will give you freedom.', 'Subhas Chandra Bose', 'h3')`,
		`INSERT INTO anthologies (id, user_id, title, intro) VALUES (1, 1, 'Cities and their ghosts', 'Three passages.')`,
		// One entry per kind, each carrying commentary, because the commentary is
		// the thing that is actually lost when an entry outlives its quote.
		`INSERT INTO anthology_entries (anthology_id, position, kind, item_id, note)
		 VALUES (1, 1.0, 'book', 1, 'Calvino first, because he sets the terms.')`,
		`INSERT INTO anthology_entries (anthology_id, position, kind, item_id, note)
		 VALUES (1, 2.0, 'screen', 1, 'Then the Zone answers him.')`,
		`INSERT INTO anthology_entries (anthology_id, position, kind, item_id, note)
		 VALUES (1, 3.0, 'utterance', 1, 'And a voice from outside either.')`,
		// A second anthology holding the same book quote: filing is not moving, so
		// deleting the QUOTE must clear both, and deleting one anthology must not
		// touch the other's entry.
		`INSERT INTO anthologies (id, user_id, title) VALUES (2, 1, 'Openings')`,
		`INSERT INTO anthology_entries (anthology_id, position, kind, item_id)
		 VALUES (2, 1.0, 'book', 1)`,
	} {
		if _, err := s.DB.Exec(q); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}

	// The real foreign key, which the anthologies table DOES have: dropping an
	// anthology takes its entries and nothing else.
	if _, err := s.DB.Exec(`DELETE FROM anthologies WHERE id = 2`); err != nil {
		t.Fatalf("delete anthology: %v", err)
	}
	if n := countRows(t, s, `SELECT count(*) FROM anthology_entries WHERE anthology_id = 2`); n != 0 {
		t.Errorf("%d entries outlived their anthology; the ON DELETE CASCADE is not firing", n)
	}
	if n := countRows(t, s, `SELECT count(*) FROM anthology_entries WHERE anthology_id = 1`); n != 3 {
		t.Fatalf("deleting one anthology left %d of the other's 3 entries", n)
	}

	// And now the three that are triggers rather than declarations. One kind at a
	// time, asserting the other two are untouched after each — the scoping is the
	// part that a copy-pasted trigger gets wrong, and a trigger missing its `kind`
	// clause would empty the whole anthology on the first delete while every
	// count-based assertion still looked plausible.
	for _, tc := range []struct {
		del  string
		kind string
		left []string
	}{
		{`DELETE FROM annotations WHERE id = 1`, "book", []string{"screen", "utterance"}},
		{`DELETE FROM dialogues WHERE id = 1`, "screen", []string{"utterance"}},
		{`DELETE FROM utterances WHERE id = 1`, "utterance", nil},
	} {
		if _, err := s.DB.Exec(tc.del); err != nil {
			t.Fatalf("%s: %v", tc.del, err)
		}
		if n := countRows(t, s,
			`SELECT count(*) FROM anthology_entries WHERE kind = ?`, tc.kind); n != 0 {
			t.Errorf("%s: %d %s entries outlived the quote", tc.del, n, tc.kind)
		}
		for _, other := range tc.left {
			if n := countRows(t, s,
				`SELECT count(*) FROM anthology_entries WHERE kind = ?`, other); n != 1 {
				t.Errorf("%s: took the %s entry with it — the trigger is not scoped by kind", tc.del, other)
			}
		}
	}

	// The anthology itself survives being emptied. It holds the reader's own
	// writing: an intro that outlives every quote in it is still theirs, and a
	// container that deleted itself when its last entry went would take that prose
	// with it silently.
	if n := countRows(t, s, `SELECT count(*) FROM anthologies WHERE id = 1`); n != 1 {
		t.Error("the anthology deleted itself when its last entry went")
	}
	var intro string
	if err := s.DB.QueryRow(`SELECT intro FROM anthologies WHERE id = 1`).Scan(&intro); err != nil {
		t.Fatal(err)
	}
	if intro != "Three passages." {
		t.Errorf("intro = %q after the entries went", intro)
	}
}
