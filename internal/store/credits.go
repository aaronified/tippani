package store

import (
	"database/sql"
	"fmt"
	"strings"

	"tippani/internal/metadata"
)

// Credits: the one place that writes a credit, and the one place that recomposes
// the column derived from it.
//
// 0056 made work_person the truth and books.author / translator / editor and
// movies.director a cache of it. A cache with twenty-one writers is not a cache,
// it is twenty-one chances to disagree — so every one of them comes through
// SetCredits, and nothing else writes those four columns. CreditsAgree walks the
// whole library asserting it, and the test that calls it is what turns "nothing
// else writes them" from a comment into a fact.
//
// WHY THE COLUMN SURVIVES AT ALL is argued at length in 0056's header; the short
// version is that books_fts is external-content FTS5, external-content FTS5
// cannot index a joined table, and dropping the column would move the
// write-through problem into the search index and cost the one-line rebuild that
// repairs it.

// CreditRole is one of the four roles a work_person row can hold. They are the
// four credit COLUMNS — the roles that have somewhere to be cached — and not the
// whole vocabulary of a credit: a narrator or an illustrator is a work_person
// row with its own role string and no column, which is exactly why the link
// table exists.
type CreditRole string

const (
	RoleAuthor     CreditRole = "author"
	RoleTranslator CreditRole = "translator"
	RoleEditor     CreditRole = "editor"
	RoleDirector   CreditRole = "director"
)

// creditColumn maps a role to the column it is cached in. A role with no entry
// here is a legitimate credit that simply has no column — SetCredits writes its
// link rows and skips the recompose.
var creditColumn = map[CreditRole]struct {
	table string
	col   string
}{
	RoleAuthor:     {"books", "author"},
	RoleTranslator: {"books", "translator"},
	RoleEditor:     {"books", "editor"},
	RoleDirector:   {"movies", "director"},
}

// CreditSep is what a recomposed column joins with WHEN IT HAS TO BE REWRITTEN.
//
// IT IS NOT WHAT THE COLUMN MUST SAY. A column that already renders the same
// people in the same order is left exactly as the reader typed it, ampersand and
// all — see creditRendersLinks. Good Omens prints "Neil Gaiman & Terry
// Pratchett" on its cover, and that is the credit the book carries, the string
// search matches and the words an export writes; normalising it to a comma
// because the app happens to join with one would be the derived cache quietly
// editing the reader's library.
//
// This constant is therefore the fallback spelling, used when the column has
// genuinely gone stale and something must be written: an author was renamed, a
// co-author added, a merge re-pointed a credit. Then the app writes the app's
// own way of printing two people, because there is no reader's spelling left to
// preserve.
const CreditSep = ", "

// creditRendersLinks answers whether the column already says what the link rows
// say — the same people, in the same order — however it happens to join them.
//
// THE SPLIT IS THE SAME ONE THAT BUILT THE LINKS, using the account's own
// separators, and that is what makes the answer exact rather than a guess about
// punctuation. A reader with "and" switched off who renames "Daniels and Sons"
// to "Daniels & Sons" must SEE the rename: under their settings the old column
// is one person called "Daniels and Sons", which is not the one person the links
// now name, so it is not faithful and it is rewritten. A comparison that merely
// normalised separator characters would have called those two the same and
// swallowed the rename.
func creditRendersLinks(have string, parts []string, seps metadata.CreditSeps) bool {
	got := metadata.SplitCredits(have, seps)
	if len(got) != len(parts) {
		return false
	}
	for i := range got {
		if strings.TrimSpace(got[i]) != strings.TrimSpace(parts[i]) {
			return false
		}
	}
	return true
}

// SetCredits replaces every credit of one role on one work, and refreshes the
// column that caches it — both inside the caller's transaction.
//
// `names` is already split. Splitting is the CALLER's job because the rule is a
// per-user setting (metadata.SplitCredits with their CreditSeps) and this package
// must not reach into the metadata package to read it; the handlers that have the
// user's settings to hand do the split and pass the components.
//
// `seps` is the same account's separator set, passed rather than loaded for the
// same reason, and it is here for the RECOMPOSE rather than for the split: the
// column is left alone when it already renders these people under these
// separators, so deciding that needs the rule the reader set.
//
// A component resolves to a person by name OR by alias, and only creates one when
// neither matches. The alias arm is what makes a merge survive: once "M.
// Bulgakov" is an alias of Mikhail Bulgakov, every work printing the short form
// goes on resolving to the one record instead of manufacturing the duplicate
// again on the next write — which is the failure this whole model exists to
// prevent, reappearing through the back door.
func SetCredits(tx *sql.Tx, uid int64, kind string, workID int64, role CreditRole, names []string, seps metadata.CreditSeps) error {
	if _, err := tx.Exec(
		`DELETE FROM work_person WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ?`,
		uid, kind, workID, string(role)); err != nil {
		return fmt.Errorf("clear credits: %w", err)
	}
	for i, raw := range names {
		name := strings.TrimSpace(raw)
		if name == "" {
			continue
		}
		pid, err := ResolvePerson(tx, uid, name)
		if err != nil {
			return err
		}
		// credit_as is stored only when it DIFFERS from the person's own name.
		// Storing it always would make every row look like a deliberate
		// re-crediting, and the panel's "how the name prints on this work only"
		// would then be a sentence about every credit in the library.
		var canonical string
		if err := tx.QueryRow(`SELECT name FROM people WHERE id = ?`, pid).Scan(&canonical); err != nil {
			return fmt.Errorf("read person name: %w", err)
		}
		creditAs := ""
		if canonical != name {
			creditAs = name
		}
		if _, err := tx.Exec(
			`INSERT INTO work_person (user_id, kind, work_id, person_id, role, credit_as, ordering)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			uid, kind, workID, pid, string(role), creditAs, i); err != nil {
			return fmt.Errorf("insert credit: %w", err)
		}
	}
	return RecomposeCredit(tx, uid, kind, workID, role, seps)
}

// RecomposeCredit rewrites one cached column from the link rows behind it.
//
// Exported because the person panel writes work_person directly — changing a
// role, a credit_as or an ordering without going through a raw string — and the
// column has to follow that too. Every writer of work_person calls this, and the
// only writers of work_person are in this file and in the people handlers.
func RecomposeCredit(tx *sql.Tx, uid int64, kind string, workID int64, role CreditRole, seps metadata.CreditSeps) error {
	target, ok := creditColumn[role]
	if !ok {
		return nil // a real credit with no column to cache it in
	}
	// COALESCE rather than a CASE: credit_as is NOT NULL with an empty default,
	// so the empty string is what "print the person's own name" looks like.
	rows, err := tx.Query(
		`SELECT CASE WHEN wp.credit_as = '' THEN p.name ELSE wp.credit_as END
		   FROM work_person wp
		   JOIN people p ON p.id = wp.person_id
		  WHERE wp.user_id = ? AND wp.kind = ? AND wp.work_id = ? AND wp.role = ?
		  ORDER BY wp.ordering`,
		uid, kind, workID, string(role))
	if err != nil {
		return fmt.Errorf("read credits: %w", err)
	}
	defer rows.Close()
	var parts []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return err
		}
		parts = append(parts, s)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	// The table names are from a constant map, never from input.
	want := strings.Join(parts, CreditSep)

	// READ BEFORE WRITE, and it is not a micro-optimisation. books_fts and
	// movies_fts are external-content FTS5 with AFTER UPDATE triggers, so every
	// write here costs a delete and a re-insert in the search index — for the
	// whole row, not just the column. Recompose runs after every credit write,
	// which means a forty-book bulk author set would re-index forty rows a second
	// time to store the string they already hold. The usual case is that nothing
	// changed: a create writes what the reader typed and this recomposes it back.
	var have sql.NullString
	sel := fmt.Sprintf(`SELECT %s FROM %s WHERE id = ? AND user_id = ?`, target.col, target.table)
	switch err := tx.QueryRow(sel, workID, uid).Scan(&have); {
	case err == sql.ErrNoRows:
		return nil // the work went away under us; nothing to cache
	case err != nil:
		return fmt.Errorf("read %s.%s: %w", target.table, target.col, err)
	case have.String == want:
		return nil
	case creditRendersLinks(have.String, parts, seps):
		// ALREADY TRUE, DIFFERENTLY PUNCTUATED. The reader typed "Neil Gaiman &
		// Terry Pratchett"; the links say Gaiman then Pratchett; the column is a
		// faithful rendering of them and it is the one printed on the book. Leave
		// it. This is not the read-before-write saving above — that one skips a
		// write of the identical string; this one declines to make the app's
		// spelling win over the reader's.
		return nil
	}
	upd := fmt.Sprintf(`UPDATE %s SET %s = ? WHERE id = ? AND user_id = ?`, target.table, target.col)
	if _, err := tx.Exec(upd, want, workID, uid); err != nil {
		return fmt.Errorf("recompose %s.%s: %w", target.table, target.col, err)
	}
	return nil
}

// ResolvePerson finds the person a credit string names, or creates them.
//
// NAME FIRST, THEN ALIAS, and the order matters. A spelling that is somebody's
// canonical name and also somebody else's alias belongs to the person who is
// actually called that — an alias is a way of FINDING a record, never a claim on
// a name another record holds outright.
//
// Ties on the canonical name go to the lowest id. Two people may share a name
// since 0056, so this is a real case rather than a defensive branch: without a
// rule, which of two Kurosawas a credit resolves to would depend on SQLite's
// scan order. The reader's remedy is credit_as or a merge; the code's obligation
// is to be deterministic.
func ResolvePerson(tx *sql.Tx, uid int64, name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, fmt.Errorf("resolve person: empty name")
	}
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM people WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`,
		uid, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, fmt.Errorf("find person: %w", err)
	}
	err = tx.QueryRow(
		`SELECT person_id FROM person_alias WHERE user_id = ? AND alias_key = ?`,
		uid, CastKey(name)).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, fmt.Errorf("find person by alias: %w", err)
	}
	res, err := tx.Exec(`INSERT INTO people (user_id, name) VALUES (?, ?)`, uid, name)
	if err != nil {
		return 0, fmt.Errorf("create person: %w", err)
	}
	return res.LastInsertId()
}

// ResolveCharacter is ResolvePerson for the other table.
//
// SAME SHAPE, DELIBERATELY, and written out rather than shared through an
// interface: two tables with two column sets and two id spaces, where the only
// thing genuinely common is six lines of control flow. 0056's header takes the
// cost of the second copy openly — this is where it is paid, and keeping the two
// literally parallel is what makes a divergence visible in a diff.
//
// IT NEVER MATCHES ACROSS WORKS BY ITSELF. Callers pass a name that came from a
// picker where the reader chose an existing character deliberately, or a name
// that is new. "Narrator", "Mother" and "The Doctor" recur across unrelated
// works and are not one character, so automatic name matching would silently
// weld forty books together.
func ResolveCharacter(tx *sql.Tx, uid int64, name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, fmt.Errorf("resolve character: empty name")
	}
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM characters WHERE user_id = ? AND name = ? ORDER BY id LIMIT 1`,
		uid, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, fmt.Errorf("find character: %w", err)
	}
	err = tx.QueryRow(
		`SELECT character_id FROM character_alias WHERE user_id = ? AND alias_key = ?`,
		uid, CastKey(name)).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, fmt.Errorf("find character by alias: %w", err)
	}
	res, err := tx.Exec(`INSERT INTO characters (user_id, name) VALUES (?, ?)`, uid, name)
	if err != nil {
		return 0, fmt.Errorf("create character: %w", err)
	}
	return res.LastInsertId()
}

// SyncCreditsFromColumns rebuilds a work's link rows from the columns as they
// currently stand, then recomposes those columns from the result.
//
// THE OTHER HALF OF SetCredits, and the one most callers want. Nineteen of the
// twenty-one places that write a credit already have the value in a column by
// the time they are done — an INSERT with the reader's fields, a COALESCE
// backfill, a bulk UPDATE over a set of ids, a re-verify applying one allowed
// field. Threading the raw strings back out to a sync call means every one of
// them restating what it just wrote, and a caller that restates it slightly
// wrong produces link rows describing a book nobody has.
//
// So this READS what actually landed. It cannot disagree with the write it
// follows, because it is looking at the write.
//
// It takes the separator set rather than reading a preference, because whether
// "&" means two people belongs to the account and this package has no business
// loading an HTTP caller's settings — the boundary that keeps store from
// importing httpapi. The caller passes what it already has to hand.
func SyncCreditsFromColumns(tx *sql.Tx, uid int64, kind string, workID int64, seps metadata.CreditSeps) error {
	switch kind {
	case "book":
		var author, translator, editor sql.NullString
		err := tx.QueryRow(
			`SELECT author, translator, editor FROM books WHERE id = ? AND user_id = ?`,
			workID, uid).Scan(&author, &translator, &editor)
		if err == sql.ErrNoRows {
			return nil // deleted under us; nothing to describe
		}
		if err != nil {
			return fmt.Errorf("read book credits: %w", err)
		}
		for _, c := range []struct {
			role CreditRole
			raw  sql.NullString
		}{
			{RoleAuthor, author},
			{RoleTranslator, translator},
			{RoleEditor, editor},
		} {
			if err := SetCredits(tx, uid, kind, workID, c.role, metadata.SplitCredits(c.raw.String, seps), seps); err != nil {
				return err
			}
		}
		return nil
	case "movie":
		var director sql.NullString
		err := tx.QueryRow(
			`SELECT director FROM movies WHERE id = ? AND user_id = ?`, workID, uid).Scan(&director)
		if err == sql.ErrNoRows {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read movie credits: %w", err)
		}
		return SetCredits(tx, uid, kind, workID, RoleDirector, metadata.SplitCredits(director.String, seps), seps)
	}
	return fmt.Errorf("sync credits: unknown kind %q", kind)
}

// SyncAllCredits re-derives every credit link row in one account from the
// columns as they stand.
//
// FOR THE OPERATIONS THAT REWRITE CREDITS IN BULK, of which rename is the one
// that matters: it rewrites a NAME AS A COMPONENT inside joined credits across
// every column in the library, and the ids it touched do not say which table
// each belonged to. Re-deriving the lot is exact where reconstructing that
// mapping would be a second chance to get it wrong — and rename's own comment
// settles the cost: "libraries are hundreds of rows and rename is rare".
//
// It doubles as the repair. If CreditsAgree ever reports drift on a real
// database, this is what fixes it, and it fixes it from the columns, which are
// what the reader has been looking at.
func SyncAllCredits(tx *sql.Tx, uid int64, seps metadata.CreditSeps) error {
	for _, t := range []struct{ table, kind string }{
		{"books", "book"},
		{"movies", "movie"},
	} {
		// The table name is a constant here, never input.
		rows, err := tx.Query(fmt.Sprintf(`SELECT id FROM %s WHERE user_id = ?`, t.table), uid)
		if err != nil {
			return fmt.Errorf("list %s: %w", t.table, err)
		}
		var ids []int64
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		// Collected before writing: SyncCreditsFromColumns writes to the table
		// this cursor was reading.
		for _, id := range ids {
			if err := SyncCreditsFromColumns(tx, uid, t.kind, id, seps); err != nil {
				return err
			}
		}
	}
	return nil
}

// CreditDisagreement is one work whose cached column does not match its links.
type CreditDisagreement struct {
	Kind   string
	WorkID int64
	Role   CreditRole
	Column string
	Links  string
}

// CreditsAgree walks every work and reports where the cache has drifted from the
// link rows. It is the invariant 0056 rests on, and it exists as a function
// rather than only as a test so a support question can be answered by running it
// against a real database.
//
// A work with NO link rows for a role and a NON-EMPTY column is a disagreement —
// that is the shape a write which bypassed SetCredits leaves behind, and it is
// the one this is really looking for.
//
// WHAT IT ASKS IS "DOES THE COLUMN RENDER THESE PEOPLE", NOT "IS IT BYTE FOR BYTE
// THE APP'S OWN JOIN". Those were the same question until the column was allowed
// to keep the reader's spelling, and asking the stricter one now would report
// every co-authored book in a library that prints "&" as drift — a check that
// cries wolf on correct data is a check that gets switched off. The looser
// question is still exact: it splits with the account's own separators, which is
// the same rule that built the links.
//
// THE COMPARISON MOVED OUT OF SQL FOR THAT REASON. It used to be a group_concat
// and a `col != links` in the query. metadata.SplitCredits knows about suffixes
// and the "and" guards, and reimplementing any of that in SQLite would be a
// second splitter to keep in step with the first.
func CreditsAgree(db *sql.DB, uid int64, seps metadata.CreditSeps) ([]CreditDisagreement, error) {
	var out []CreditDisagreement
	for role, target := range creditColumn {
		kind := "book"
		if target.table == "movies" {
			kind = "movie"
		}
		// \x1f is the ASCII unit separator: a byte a credit cannot contain, so
		// splitting the concatenation back apart cannot cut a name in half the way
		// joining on a comma would.
		q := fmt.Sprintf(`
			SELECT w.id,
			       COALESCE(w.%s, ''),
			       COALESCE((SELECT group_concat(
			                   CASE WHEN wp.credit_as = '' THEN p.name ELSE wp.credit_as END, char(31))
			                 FROM (SELECT * FROM work_person
			                        WHERE user_id = ? AND kind = ? AND work_id = w.id AND role = ?
			                        ORDER BY ordering) wp
			                 JOIN people p ON p.id = wp.person_id), '')
			  FROM %s w
			 WHERE w.user_id = ?`, target.col, target.table)
		rows, err := db.Query(q, uid, kind, string(role), uid)
		if err != nil {
			return nil, fmt.Errorf("check %s.%s: %w", target.table, target.col, err)
		}
		for rows.Next() {
			var id int64
			var col, joined string
			if err := rows.Scan(&id, &col, &joined); err != nil {
				rows.Close()
				return nil, err
			}
			var parts []string
			if joined != "" {
				parts = strings.Split(joined, "\x1f")
			}
			if strings.TrimSpace(col) == strings.Join(parts, CreditSep) {
				continue
			}
			if creditRendersLinks(col, parts, seps) {
				continue
			}
			out = append(out, CreditDisagreement{
				Kind: kind, WorkID: id, Role: role, Column: col, Links: strings.Join(parts, CreditSep),
			})
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}
