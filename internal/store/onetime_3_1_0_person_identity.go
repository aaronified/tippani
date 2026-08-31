package store

import (
	"database/sql"
	"fmt"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// 3.1.0: the strings that were people become people, and the strings that were
// characters become characters.
//
// RETIRING THIS FILE. Delete it. Nothing else mentions it — onetime.go iterates
// what registered — and the row it wrote in one_time_passes stays behind as the
// record that it ran. Delete it once no supported instance can still be
// upgrading from before 3.1.0.
//
// WHY THIS IS A PASS AND NOT A MIGRATION. 0056 created the tables; it cannot
// fill them. Splitting "Richard Pevear, Larissa Volokhonsky" into two people
// needs metadata.SplitCredits — suffix re-attachment for Jr./III, an "and" that
// only splits in list context so "William and Mary" survives, "et al" dropped,
// components deduped case-insensitively — and none of that is expressible in
// SQL. It also needs EACH ACCOUNT'S OWN separator preference, because whether &
// means two people is a setting the reader owns.
//
// THE SPLIT IS THE RISK, AND THE REPO HAS ALREADY DECIDED WHICH WAY TO TAKE IT.
// board_handlers.go, on the same question: "a wrongly-split name is visible and
// a wrongly-merged one hides a whole person." A wrong split puts two rows on a
// screen where the reader can see them and merge them back. A wrong merge makes
// one person out of two and there is nothing on any screen that says so. So this
// splits, using the same tested function the importer already trusts, honouring
// the same preference.
//
// WHAT IT DOES NOT DO IS MATCH ACROSS WORKS BY NAME FOR CHARACTERS. Two works
// with a character called "Narrator" get two records. Welding them together is
// the reader's deliberate act in the picker, because "Mother", "The Doctor" and
// "Narrator" recur across unrelated books and are emphatically not one person.
// People ARE matched by name — that is the entire point of the pass, and the
// name is the only evidence a string-keyed library ever had.
//
// THE PASS DOES NOT REWRITE A CREDIT IT CAN LEAVE ALONE. Once the links exist the
// column is recomposed from them, and recompose leaves a column that already
// renders the same people in the same order exactly as it stands — so a reader
// who typed "Gaiman & Pratchett" still has "Gaiman & Pratchett" on that book, and
// the pass is a pure addition of records rather than an edit to every credit
// string in the library on first start. What it CAN rewrite is a column that was
// already wrong for its own account: whitespace a split normalises away, or the
// empty string where a link exists. Nothing a reader typed is normalised.
//
// A FAILURE IS LOGGED AND SKIPPED, like every pass — see onetime.go. The library
// then runs with empty link tables and its original columns, which is precisely
// the state it was in before 0056: nothing is lost, and the next start retries.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.1.0",
		Name:    "3.1.0-person-identity",
		Why:     "credits and cast were strings; give every one of them a record to point at",
		Run:     runPersonIdentity,
	})
}

// creditBackfill names one column and the role its link rows take.
var creditBackfill = []struct {
	table string
	kind  string
	col   string
	role  CreditRole
}{
	{"books", "book", "author", RoleAuthor},
	{"books", "book", "translator", RoleTranslator},
	{"books", "book", "editor", RoleEditor},
	{"movies", "movie", "director", RoleDirector},
}

func runPersonIdentity(tx *sql.Tx, env OneTimeEnv) error {
	users, err := backfillUsers(tx)
	if err != nil {
		return err
	}
	var people, chars, credits, cast int
	for _, u := range users {
		// EACH ACCOUNT'S OWN SEPARATORS. Read straight from the preferences blob
		// rather than through httpapi's loader, which this package cannot see and
		// which would not exist in a migration context anyway. A missing or
		// unreadable preference falls back to the default set — the same
		// fallback the loader makes, for the same reason: refusing to split at
		// all would put every co-authored work into one bogus person.
		seps := metadata.ParseCreditSeps(creditSepPref(tx, u))

		for _, b := range creditBackfill {
			n, p, err := backfillCredits(tx, u, b.table, b.kind, b.col, b.role, seps)
			if err != nil {
				return fmt.Errorf("%s.%s: %w", b.table, b.col, err)
			}
			credits += n
			people += p
		}
		c, ch, err := backfillCast(tx, u)
		if err != nil {
			return fmt.Errorf("work_cast: %w", err)
		}
		cast += c
		chars += ch
	}
	olog.Printf("[store] person identity: %d credits over %d people, %d cast rows over %d characters",
		credits, people, cast, chars)
	return nil
}

func backfillUsers(tx *sql.Tx) ([]int64, error) {
	rows, err := tx.Query(`SELECT id FROM users ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("read users: %w", err)
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// creditSepPref digs the one preference out of the JSON blob. Best-effort by
// design: this pass must not fail a boot over a malformed preferences document,
// and the default set is a defensible answer for every account.
func creditSepPref(tx *sql.Tx, uid int64) string {
	var pref sql.NullString
	err := tx.QueryRow(
		`SELECT json_extract(preferences, '$.creditSeparators') FROM users WHERE id = ?`,
		uid).Scan(&pref)
	if err != nil || !pref.Valid {
		return ""
	}
	return pref.String
}

// backfillCredits turns one column of one table into link rows, then recomposes
// the column from them — which, for the overwhelming majority of rows, changes
// nothing at all. Returns (credits written, people touched).
func backfillCredits(tx *sql.Tx, uid int64, table, kind, col string, role CreditRole, seps metadata.CreditSeps) (int, int, error) {
	// The table and column come from creditBackfill, never from input.
	q := fmt.Sprintf(`SELECT id, COALESCE(%s, '') FROM %s WHERE user_id = ? AND COALESCE(%s, '') <> ''`, col, table, col)
	rows, err := tx.Query(q, uid)
	if err != nil {
		return 0, 0, fmt.Errorf("read: %w", err)
	}
	// COLLECTED BEFORE WRITING, not written as they are scanned. SetCredits
	// writes to the same table this cursor is reading, and SQLite's behaviour
	// when a statement mutates rows a live cursor is walking is not something to
	// rely on for a one-shot upgrade nobody watches.
	type work struct {
		id  int64
		raw string
	}
	var works []work
	for rows.Next() {
		var w work
		if err := rows.Scan(&w.id, &w.raw); err != nil {
			rows.Close()
			return 0, 0, err
		}
		works = append(works, w)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return 0, 0, err
	}

	credits, seen := 0, map[int64]bool{}
	for _, w := range works {
		names := metadata.SplitCredits(w.raw, seps)
		if len(names) == 0 {
			continue
		}
		if err := SetCredits(tx, uid, kind, w.id, role, names, seps); err != nil {
			return 0, 0, err
		}
		credits += len(names)
		ids, err := creditPeople(tx, uid, kind, w.id, role)
		if err != nil {
			return 0, 0, err
		}
		for _, id := range ids {
			seen[id] = true
		}
	}
	return credits, len(seen), nil
}

func creditPeople(tx *sql.Tx, uid int64, kind string, workID int64, role CreditRole) ([]int64, error) {
	rows, err := tx.Query(
		`SELECT person_id FROM work_person WHERE user_id = ? AND kind = ? AND work_id = ? AND role = ?`,
		uid, kind, workID, string(role))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// backfillCast gives every cast row a character record and, where it names one,
// an actor.
//
// THE ACTOR IS RESOLVED THROUGH ResolvePerson, so a performer who is also an
// author in the same library ends up as ONE record — which is the whole appeal
// of the model and is invisible until it happens. The character is resolved
// per user but never welded across works: two works naming "Narrator" get two
// records, deliberately.
//
// NO SPLITTING ON EITHER. A cast row's character and actor are one name each by
// construction — 0048 seeds them one per provider credit — so running the credit
// splitter over them would turn "Crosby, Stills & Nash" as a single credited
// performer into three, which is the wrong-split risk without the compensating
// benefit.
//
// IT DOES NOT CALL ResolveCharacter, AND THAT IS THE POINT. Resolving matches by
// name, which is right in a picker where the reader chose an existing character
// deliberately and wrong here, where nobody chose anything: it would silently
// weld every "Narrator", "Mother" and "The Doctor" in the library into one
// record spanning forty unrelated works, and nothing on any screen would say so.
//
// So a character is created per WORK. Eight Harry Potter films come out of this
// as eight Harry Potters, which the reader can see in the character list and
// merge in one act — the repo's own rule, from board_handlers.go: a wrongly-split
// name is visible and a wrongly-merged one hides a whole person.
//
// Within ONE work the name still collapses, because a work listing the same
// character twice — child and adult casting — is two cast rows about one
// character, which is exactly what actor_id being per row is for.
func backfillCast(tx *sql.Tx, uid int64) (int, int, error) {
	rows, err := tx.Query(
		`SELECT id, kind, work_id, COALESCE(character, ''), COALESCE(actor, '')
		   FROM work_cast
		  WHERE user_id = ? AND origin <> 'removed'
		  ORDER BY id`, uid)
	if err != nil {
		return 0, 0, fmt.Errorf("read cast: %w", err)
	}
	type row struct {
		id        int64
		kind      string
		workID    int64
		character string
		actor     string
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.kind, &r.workID, &r.character, &r.actor); err != nil {
			rows.Close()
			return 0, 0, err
		}
		all = append(all, r)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return 0, 0, err
	}

	// Keyed by (kind, work, folded name), so one work's two rows for one
	// character share a record and two works' rows never do.
	byWork := map[string]int64{}
	chars := 0
	for _, r := range all {
		var cid, aid sql.NullInt64
		if r.character != "" {
			key := fmt.Sprintf("%s\x1f%d\x1f%s", r.kind, r.workID, CastKey(r.character))
			if _, ok := byWork[key]; !ok {
				res, err := tx.Exec(`INSERT INTO characters (user_id, name) VALUES (?, ?)`, uid, r.character)
				if err != nil {
					return 0, 0, fmt.Errorf("create character: %w", err)
				}
				id, err := res.LastInsertId()
				if err != nil {
					return 0, 0, err
				}
				byWork[key] = id
				chars++
			}
			cid = sql.NullInt64{Int64: byWork[key], Valid: true}
		}
		if r.actor != "" {
			id, err := ResolvePerson(tx, uid, r.actor)
			if err != nil {
				return 0, 0, err
			}
			aid = sql.NullInt64{Int64: id, Valid: true}
		}
		if !cid.Valid && !aid.Valid {
			continue
		}
		if _, err := tx.Exec(
			`UPDATE work_cast SET character_id = ?, actor_id = ? WHERE id = ? AND user_id = ?`,
			cid, aid, r.id, uid); err != nil {
			return 0, 0, fmt.Errorf("link cast row: %w", err)
		}
	}
	return len(all), chars, nil
}
