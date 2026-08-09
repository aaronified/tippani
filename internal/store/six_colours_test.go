package store

import (
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// Migration 0029 widens the colour CHECK on four tables, which means rebuilding
// four tables — three of them foreign-key parents with cascading children, three
// of them backing external-content FTS5 indexes with live sync triggers.
//
// EVERY ASSERTION HERE IS ABOUT VALUES, not counts. A cascade that ate the tag
// joins leaves a table that is empty rather than wrong, and a test that counted
// rows before and after would pass on a database where every tag had been
// stripped from every quote — 0018's own dialogue_tags restore had no assertion
// at all, which is the precedent this is written against.

// openAt28 returns a store at the pre-0029 schema: four colours, and the
// rebuild not yet run.
func openAt28(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 28)
	return s
}

// seedForColourRebuild fills every table the migration touches, plus every child
// and side table that could be lost by it.
func seedForColourRebuild(t *testing.T, s *Store) {
	t.Helper()
	ex := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	ex(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)
	ex(`INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Earthsea')`)
	ex(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Casablanca')`)
	ex(`INSERT INTO stickers (id, user_id, name, path) VALUES (1, 1, 'seal', 'a.png')`)

	ex(`INSERT INTO annotations (id, book_id, quote, note, color, chapter, location, source, favorite, dedupe_hash, sticker_id)
	    VALUES (11, 1, 'The mark is the making', 'a note', 'blue', 'Ch 3', 'p.142', 'manual', 1, 'h-ann-11', 1)`)
	ex(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash)
	    VALUES (12, 1, 'Only in silence the word', 'pink', 'manual', 'h-ann-12')`)
	ex(`INSERT INTO dialogues (id, movie_id, quote, character, actor, timestamp, color, source, dedupe_hash, season, episode, favorite)
	    VALUES (21, 1, 'Here is looking at you', 'Rick', 'Bogart', '00:12:00', 'orange', 'manual', 'h-dlg-21', 2, 6, 1)`)
	ex(`INSERT INTO utterances (id, user_id, quote, color, speaker, occasion, occasion_date, place, medium, source, dedupe_hash)
	    VALUES (31, 1, 'Give me blood', 'yellow', 'Bose', 'Burma broadcast', '1944', 'Burma', 'radio', 'manual', 'h-utt-31')`)

	ex(`INSERT INTO tags (id, user_id, name) VALUES (1, 1, 'memory'), (2, 1, 'craft')`)
	ex(`INSERT INTO annotation_tags (annotation_id, tag_id) VALUES (11, 1), (11, 2), (12, 2)`)
	ex(`INSERT INTO dialogue_tags (dialogue_id, tag_id) VALUES (21, 1)`)
	ex(`INSERT INTO utterance_tags (utterance_id, tag_id) VALUES (31, 2)`)

	// The polymorphic review rows: no FK, matched by id, so an id that moved
	// would orphan a card's whole review history with nothing to say so.
	ex(`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
	    VALUES ('book', 11, 30, 3, 'got', datetime('now'), datetime('now')),
	           ('screen', 21, 7, 1, 'forgot', datetime('now'), datetime('now')),
	           ('utterance', 31, 100, 5, 'got', datetime('now'), datetime('now'))`)

	ex(`INSERT INTO import_batches (id, user_id, source, filename) VALUES (1, 1, 'md', 'notes.md')`)
	ex(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (1, 1, 'book', 'Pending')`)
	ex(`INSERT INTO staged_quotes (id, staged_work_id, quote, color, chapter, tags, dedupe_hash)
	    VALUES (41, 1, 'staged line', 'pink', 'Ch 1', 'memory', 'h-stg-41')`)
}

func pairs(t *testing.T, s *Store, q string) []string {
	t.Helper()
	rows, err := s.DB.Query(q)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var a, b int64
		if err := rows.Scan(&a, &b); err != nil {
			t.Fatal(err)
		}
		out = append(out, itoa2(a, b))
	}
	sort.Strings(out)
	return out
}

func itoa2(a, b int64) string {
	return string(rune('0'+a%10)) + ":" + string(rune('0'+b%10))
}

func TestSixColoursRebuildKeepsEverything(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)

	annTags := pairs(t, s, `SELECT annotation_id, tag_id FROM annotation_tags`)
	dlgTags := pairs(t, s, `SELECT dialogue_id, tag_id FROM dialogue_tags`)
	uttTags := pairs(t, s, `SELECT utterance_id, tag_id FROM utterance_tags`)
	if len(annTags) != 3 || len(dlgTags) != 1 || len(uttTags) != 1 {
		t.Fatalf("seed is wrong: %v %v %v", annTags, dlgTags, uttTags)
	}

	migrateThrough(t, s, 29)

	// The join rows come back with the SAME PAIRS, not merely the same count.
	if got := pairs(t, s, `SELECT annotation_id, tag_id FROM annotation_tags`); !eq(got, annTags) {
		t.Errorf("annotation_tags: %v, want %v", got, annTags)
	}
	if got := pairs(t, s, `SELECT dialogue_id, tag_id FROM dialogue_tags`); !eq(got, dlgTags) {
		t.Errorf("dialogue_tags: %v, want %v", got, dlgTags)
	}
	if got := pairs(t, s, `SELECT utterance_id, tag_id FROM utterance_tags`); !eq(got, uttTags) {
		t.Errorf("utterance_tags: %v, want %v", got, uttTags)
	}

	// Every id survived, so item_reviews still matches by it.
	for _, c := range []struct{ kind string; id int64 }{{"book", 11}, {"screen", 21}, {"utterance", 31}} {
		var n int
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind = ? AND item_id = ?`,
			c.kind, c.id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Errorf("%s review row for id %d is gone", c.kind, c.id)
		}
	}

	// Column values, not just rows: a rebuild that dropped a column from the
	// INSERT list silently nulls it, and most of these are never read by a test.
	var quote, note, chapter, location, source, hash string
	var favorite, stickerID int64
	if err := s.DB.QueryRow(`SELECT quote, COALESCE(note,''), COALESCE(chapter,''), COALESCE(location,''),
	        source, dedupe_hash, favorite, COALESCE(sticker_id,0) FROM annotations WHERE id = 11`).
		Scan(&quote, &note, &chapter, &location, &source, &hash, &favorite, &stickerID); err != nil {
		t.Fatal(err)
	}
	if quote != "The mark is the making" || note != "a note" || chapter != "Ch 3" ||
		location != "p.142" || source != "manual" || hash != "h-ann-11" || favorite != 1 || stickerID != 1 {
		t.Errorf("annotation 11 lost a field: %q %q %q %q %q %q %d %d",
			quote, note, chapter, location, source, hash, favorite, stickerID)
	}

	var season, episode int64
	var character, actor, ts string
	if err := s.DB.QueryRow(`SELECT COALESCE(season,0), COALESCE(episode,0), COALESCE(character,''),
	        COALESCE(actor,''), COALESCE(timestamp,'') FROM dialogues WHERE id = 21`).
		Scan(&season, &episode, &character, &actor, &ts); err != nil {
		t.Fatal(err)
	}
	if season != 2 || episode != 6 || character != "Rick" || actor != "Bogart" || ts != "00:12:00" {
		t.Errorf("dialogue 21 lost a field: %d %d %q %q %q", season, episode, character, actor, ts)
	}

	var speaker, occasion, odate, place, medium string
	if err := s.DB.QueryRow(`SELECT speaker, occasion, occasion_date, place, medium
	        FROM utterances WHERE id = 31`).Scan(&speaker, &occasion, &odate, &place, &medium); err != nil {
		t.Fatal(err)
	}
	if speaker != "Bose" || occasion != "Burma broadcast" || odate != "1944" || place != "Burma" || medium != "radio" {
		t.Errorf("utterance 31 lost its occasion: %q %q %q %q %q", speaker, occasion, odate, place, medium)
	}

	var stagedTags, stagedChapter string
	if err := s.DB.QueryRow(`SELECT tags, COALESCE(chapter,'') FROM staged_quotes WHERE id = 41`).
		Scan(&stagedTags, &stagedChapter); err != nil {
		t.Fatal(err)
	}
	if stagedTags != "memory" || stagedChapter != "Ch 1" {
		t.Errorf("staged quote 41 lost a field: %q %q", stagedTags, stagedChapter)
	}
}

// The point of the whole migration.
func TestSixColoursAcceptsTheTwoNewOnes(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)
	migrateThrough(t, s, 29)

	for _, q := range []string{
		`UPDATE annotations SET color = 'green' WHERE id = 11`,
		`UPDATE dialogues SET color = 'purple' WHERE id = 21`,
		`UPDATE utterances SET color = 'green' WHERE id = 31`,
		`UPDATE staged_quotes SET color = 'purple' WHERE id = 41`,
	} {
		if _, err := s.DB.Exec(q); err != nil {
			t.Errorf("%s: %v", q, err)
		}
	}
	// And still refuses one that is not a colour, or the CHECK has been dropped
	// rather than widened — which would let a typo become a permanent value no
	// picker can display.
	for _, q := range []string{
		`UPDATE annotations SET color = 'chartreuse' WHERE id = 11`,
		`UPDATE dialogues SET color = '' WHERE id = 21`,
		`UPDATE utterances SET color = 'GREEN' WHERE id = 31`,
		`UPDATE staged_quotes SET color = 'mauve' WHERE id = 41`,
	} {
		if _, err := s.DB.Exec(q); err == nil {
			t.Errorf("%s was accepted; the CHECK is gone, not widened", q)
		}
	}
}

// The FTS indexes are external-content with live sync triggers. The triggers go
// with the table and are recreated; the index is rebuilt. Both halves matter: a
// missing trigger means new rows never become searchable, and a missing rebuild
// means the OLD rows silently stop being.
func TestSixColoursKeepsSearchWorking(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)
	migrateThrough(t, s, 29)

	hits := func(table, q string) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE `+table+` MATCH ?`, q).Scan(&n); err != nil {
			t.Fatalf("%s MATCH %q: %v", table, q, err)
		}
		return n
	}

	// Rows that existed BEFORE the rebuild are still findable — the index was
	// rebuilt rather than left pointing at a table that no longer exists.
	if n := hits("annotations_fts", "making"); n != 1 {
		t.Errorf("pre-existing annotation is not searchable: %d hits", n)
	}
	if n := hits("dialogues_fts", "Bogart"); n != 1 {
		t.Errorf("pre-existing dialogue is not searchable: %d hits", n)
	}
	if n := hits("utterances_fts", "blood"); n != 1 {
		t.Errorf("pre-existing utterance is not searchable: %d hits", n)
	}

	// And a row inserted AFTER it becomes searchable — the triggers are back.
	if _, err := s.DB.Exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash)
	    VALUES (13, 1, 'wizardry unspeakable', 'green', 'manual', 'h-ann-13')`); err != nil {
		t.Fatal(err)
	}
	if n := hits("annotations_fts", "unspeakable"); n != 1 {
		t.Errorf("the insert trigger did not come back: %d hits", n)
	}
	// ...and stops being when it goes, which is the delete trigger.
	if _, err := s.DB.Exec(`DELETE FROM annotations WHERE id = 13`); err != nil {
		t.Fatal(err)
	}
	if n := hits("annotations_fts", "unspeakable"); n != 0 {
		t.Errorf("the delete trigger did not come back: %d hits", n)
	}
}

// The index rebuild is insurance, and this is what it insures against.
//
// An external-content FTS5 index keeps its OWN entries: dropping and recreating
// the content table does not clear them, so pre-existing rows stay findable
// whether or not the migration rebuilds. (Found by mutation — removing the
// rebuild changed nothing, which is exactly the signal that a line is either
// unnecessary or untested.)
//
// It is not unnecessary. A database whose index had already drifted — the
// failure the Maintenance screen's "rebuild the search index" action exists for
// — is repaired by passing through this migration rather than carrying the drift
// forward forever. So the case worth asserting is a desynced index, not a
// healthy one.
func TestSixColoursRepairsADesyncedSearchIndex(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)

	// Empty the index behind the triggers' back: the rows are still in the
	// table, and search can no longer find them.
	for _, tbl := range []string{"annotations_fts", "dialogues_fts", "utterances_fts"} {
		if _, err := s.DB.Exec(`INSERT INTO ` + tbl + `(` + tbl + `) VALUES('delete-all')`); err != nil {
			t.Fatal(err)
		}
	}
	var before int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM annotations_fts WHERE annotations_fts MATCH 'making'`).
		Scan(&before); err != nil {
		t.Fatal(err)
	}
	if before != 0 {
		t.Fatalf("the index was not actually desynced: %d hits", before)
	}

	migrateThrough(t, s, 29)

	for _, c := range []struct{ table, term string }{
		{"annotations_fts", "making"},
		{"dialogues_fts", "Bogart"},
		{"utterances_fts", "blood"},
	} {
		var n int
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM ` + c.table + ` WHERE ` + c.table + ` MATCH ?`, c.term).
			Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Errorf("%s was not repaired by the rebuild: %d hits for %q", c.table, n, c.term)
		}
	}
}

// The item_reviews delete triggers are the stand-in for a foreign key the schema
// cannot express (one column pointing at three tables). Losing one leaves review
// rows behind for deleted quotes, which resurface as cards for things that no
// longer exist.
func TestSixColoursKeepsTheReviewDeleteTriggers(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)
	migrateThrough(t, s, 29)

	for _, c := range []struct {
		kind, table string
		id          int64
	}{
		{"book", "annotations", 11},
		{"screen", "dialogues", 21},
		{"utterance", "utterances", 31},
	} {
		if _, err := s.DB.Exec(`DELETE FROM `+c.table+` WHERE id = ?`, c.id); err != nil {
			t.Fatal(err)
		}
		var n int
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind = ? AND item_id = ?`,
			c.kind, c.id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Errorf("%s: deleting the quote left its review row behind", c.kind)
		}
	}
}

// Everything the rebuild had to put back, in one list. A missing index is not an
// error — it is a table scan nobody notices until the library is large.
func TestSixColoursRestoresIndexesAndTriggers(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)
	migrateThrough(t, s, 29)

	rows, err := s.DB.Query(`SELECT type || ':' || name FROM sqlite_master
		WHERE type IN ('index','trigger') AND name NOT LIKE 'sqlite_%'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		have[n] = true
	}
	for _, want := range []string{
		"index:idx_ann_book", "index:idx_dlg_movie",
		"index:idx_utterances_user", "index:idx_utterances_speaker",
		"index:idx_staged_quotes_work",
		"trigger:annotations_ai", "trigger:annotations_ad", "trigger:annotations_au",
		"trigger:dialogues_ai", "trigger:dialogues_ad", "trigger:dialogues_au",
		"trigger:utterances_ai", "trigger:utterances_ad", "trigger:utterances_au",
		"trigger:item_reviews_book_del", "trigger:item_reviews_screen_del",
		"trigger:item_reviews_utterance_del",
	} {
		if !have[want] {
			t.Errorf("%s did not survive the rebuild", want)
		}
	}

	// Nothing parked was left behind. A leftover _backup table is a copy of the
	// library's tag joins sitting in the file forever.
	var leftovers int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM sqlite_master
		WHERE type = 'table' AND (name LIKE '\_%' ESCAPE '\' OR name LIKE '%_new')`).Scan(&leftovers); err != nil {
		t.Fatal(err)
	}
	if leftovers != 0 {
		t.Errorf("%d scaffolding table(s) left behind", leftovers)
	}
}

// The foreign keys have to come back too — a rebuilt table that forgot its
// REFERENCES silently stops cascading, so deleting a book leaves its quotes.
func TestSixColoursKeepsForeignKeys(t *testing.T) {
	s := openAt28(t)
	seedForColourRebuild(t, s)
	migrateThrough(t, s, 29)

	if _, err := s.DB.Exec(`DELETE FROM books WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM annotations WHERE book_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("deleting the book left %d annotation(s): the FK did not come back", n)
	}

	var bad int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM pragma_foreign_key_check`).Scan(&bad); err != nil {
		t.Fatal(err)
	}
	if bad != 0 {
		t.Errorf("foreign_key_check reports %d violation(s) after the rebuild", bad)
	}
}

// The migration is append-only and idempotent in the sense that matters: running
// the whole set on a fresh database must produce the same schema as running it
// on one that stopped at 28. Otherwise a new install and an upgraded one differ,
// and every later migration is written against whichever the author happened to
// have.
func TestSixColoursLeavesTheSameSchemaAsAFreshInstall(t *testing.T) {
	upgraded := openAt28(t)
	// Through EVERY remaining migration, not through 29. The claim above is that
	// an upgraded database ends up identical to a fresh one, and a hardcoded
	// target quietly narrows it to "identical as of 0029" — after which the test
	// passes forever while comparing two different things. It caught 0030 by
	// failing, which is the right outcome and the wrong reason.
	if err := upgraded.Migrate(); err != nil {
		t.Fatal(err)
	}

	fresh, err := Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer fresh.Close()
	if err := fresh.Migrate(); err != nil {
		t.Fatal(err)
	}

	dump := func(s *Store) string {
		rows, err := s.DB.Query(`SELECT type, name, COALESCE(sql, '') FROM sqlite_master
			WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		var b strings.Builder
		for rows.Next() {
			var typ, name, sql string
			if err := rows.Scan(&typ, &name, &sql); err != nil {
				t.Fatal(err)
			}
			// The rebuild renames a table into place, which quotes its name in
			// the stored SQL. That is cosmetic and not a schema difference.
			sql = strings.ReplaceAll(sql, `"`, "")
			b.WriteString(typ + " " + name + "\n" + strings.Join(strings.Fields(sql), " ") + "\n")
		}
		return b.String()
	}

	a, bDump := dump(upgraded), dump(fresh)
	if a != bDump {
		t.Errorf("upgraded and fresh schemas differ.\n--- upgraded ---\n%s\n--- fresh ---\n%s", a, bDump)
	}
}

func eq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
