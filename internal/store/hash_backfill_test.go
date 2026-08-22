package store

// The 1.3.0 repair: rows written before dialogue hashes were episode-qualified
// still hold the text-only hash, which makes them latent duplicates — the next
// import of the same file computes the qualified hash, misses them, and inserts a
// second copy. Migrate re-hashes them.

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBackfillDialogueHashes(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`)
	mustExec(`INSERT INTO movies (id, user_id, title, media_type) VALUES (1, 1, 'Reel Seven', 'show')`)

	const episoded = "You cut the part where I was happy."
	const bare = "Seven reels, seven ways to lie about a summer."

	// Exactly what 1.3.0 wrote: an episode recorded, but hashed on text alone.
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, season, episode, dedupe_hash)
	          VALUES (1, 1, ?, 1, 2, ?)`, episoded, DedupeHash(episoded))
	// A film-shaped row with no episode, which must be left exactly as it is.
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
	          VALUES (2, 1, ?, ?)`, bare, DedupeHash(bare))

	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatal(err)
	}

	var got string
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	n := func(i int) *int { return &i }
	if want := DialogueDedupeHash(episoded, n(1), n(2), "", ""); got != want {
		t.Fatalf("episoded row not re-hashed:\n got %s\nwant %s", got, want)
	}
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 2`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := DedupeHash(bare); got != want {
		t.Fatalf("un-episoded row must not be touched:\n got %s\nwant %s", got, want)
	}

	// Idempotent: it is unguarded and runs on every Migrate, so a second pass must
	// change nothing rather than, say, double-qualifying the text.
	before := got
	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 2`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != before {
		t.Fatal("second pass changed a row it should have left alone")
	}
}

// THE BACKFILL MUST NOT REFUSE TO BOOT. It runs from Migrate, so a returned
// error means the application does not start — and fixing the whitespace fault
// in DialogueDedupeHash moved the hash in the LESS discriminating direction for
// the first time: two rows stored as "hello " and "hello" in one work hashed
// differently before and hash the same now, which is the correction, and which
// UNIQUE (movie_id, dedupe_hash) then refuses.
//
// The original backfill could not collide, and its comment said so. This is the
// test for the day that stopped being true.
func TestBackfillSurvivesAHashCollision(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`)
	mustExec(`INSERT INTO movies (id, user_id, title, media_type) VALUES (1, 1, 'Reel Seven', 'show')`)

	// The same line in the same episode, one copy pasted with a stray space.
	// Under the OLD algorithm these hashed differently, which is how both got
	// stored; under the new one they are the same quote.
	const line = "Not today."
	oldHash := func(text string, season, episode int) string {
		// The old order: fold, append the suffix, THEN normalise the join.
		joined := typographicFold.Replace(text) + "\x1f" + "s" + itoaTest(season) + "e" + itoaTest(episode)
		return DedupeHashOfJoined(collapseForTest(joined))
	}
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, season, episode, dedupe_hash)
	          VALUES (1, 1, ?, 1, 1, ?)`, line, oldHash(line, 1, 1))
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, season, episode, dedupe_hash)
	          VALUES (2, 1, ?, 1, 1, ?)`, line+" ", oldHash(line+" ", 1, 1))

	// The whole point: it returns nil. An error here is a database that will not
	// open, over a pair of near-identical quotes.
	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatalf("the backfill refused to complete, which would stop the app booting: %v", err)
	}

	// Nothing was deleted. One row moved to the corrected hash; the other kept
	// the hash it had, which is exactly as good as it was yesterday.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM dialogues`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("the backfill lost a row: %d left", n)
	}
	var moved int
	if err := s.DB.QueryRow(
		`SELECT count(*) FROM dialogues WHERE dedupe_hash = ?`,
		DialogueDedupeHash(line, ptrTest(1), ptrTest(1), "", "")).Scan(&moved); err != nil {
		t.Fatal(err)
	}
	if moved != 1 {
		t.Fatalf("expected exactly one row on the corrected hash, got %d", moved)
	}
}

func itoaTest(n int) string { return string(rune('0' + n)) }
func ptrTest(n int) *int    { return &n }
// collapseForTest reproduces the OLD normalisation — fields collapsed AFTER the
// suffix was joined on — so the fixture can be written the way the buggy code
// would have written it. Spelling it out here rather than calling the fixed
// function is the point: a test that used the new code to build its "old" rows
// would be asserting nothing.
func collapseForTest(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

// 0047 widened the scan to act and quest, and it repairs nothing on upgrade: no
// row written before that migration can carry an act, because the column did not
// exist. What it does repair is a hash left STALE afterwards — and there are live
// ways to leave one, because neither the bulk field editor nor find/replace
// recomputes dedupe_hash when it rewrites a column that the hash is over.
//
// So the fixture is a game line whose act says one thing and whose stored hash
// says the line had no act at all, which is exactly what a bulk act edit leaves
// behind. Left alone it is a latent duplicate: the next import of the same file
// computes the qualified hash, misses this row, and inserts a second copy.
func TestBackfillHealsAStaleGameHash(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`)
	mustExec(`INSERT INTO movies (id, user_id, title, media_type) VALUES (1, 1, 'Disco Elysium', 'game')`)

	const bark = "Sure is a hot one today."
	const plain = "You are a hardened, unlikely detective."

	// An act recorded, hashed as though it were not — a bulk edit's leftovers.
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, act, quest, dedupe_hash)
	          VALUES (1, 1, ?, '2', 'The Well', ?)`, bark, DedupeHash(bark))
	// A line with no locator of any kind, which must be left exactly as it is:
	// the widened WHERE must not start pulling in every film row in the database.
	mustExec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
	          VALUES (2, 1, ?, ?)`, plain, DedupeHash(plain))

	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatal(err)
	}

	var got string
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := DialogueDedupeHash(bark, nil, nil, "2", "The Well"); got != want {
		t.Fatalf("the game line was not re-hashed, so its act is not in its identity:\n got %s\nwant %s", got, want)
	}
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 2`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := DedupeHash(plain); got != want {
		t.Fatalf("a line with no locator was rewritten:\n got %s\nwant %s", got, want)
	}

	// Idempotent, like the episode half: it is unguarded and runs on every Migrate.
	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatal(err)
	}
	var again string
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 1`).Scan(&again); err != nil {
		t.Fatal(err)
	}
	if want := DialogueDedupeHash(bark, nil, nil, "2", "The Well"); again != want {
		t.Fatal("a second pass moved a row it had already corrected")
	}
}

// The staging queue mirrors the live rule, so it needs the same repair — and it is
// the half most easily left out, because staged rows are short-lived and a stale
// hash there shows up as a file that stages twice rather than as a visible error.
func TestBackfillHealsAStaleStagedGameHash(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`)
	mustExec(`INSERT INTO import_batches (id, user_id, source) VALUES (1, 1, 'md')`)
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (1, 1, 'movie', 'Disco Elysium')`)

	const bark = "Sure is a hot one today."
	mustExec(`INSERT INTO staged_quotes (id, staged_work_id, quote, act, dedupe_hash)
	          VALUES (1, 1, ?, 'Act 2', ?)`, bark, DedupeHash(bark))

	if err := s.BackfillDialogueHashes(); err != nil {
		t.Fatal(err)
	}
	var got string
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM staged_quotes WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := DialogueDedupeHash(bark, nil, nil, "Act 2", ""); got != want {
		t.Fatalf("a staged game line kept its stale hash:\n got %s\nwant %s", got, want)
	}
}
