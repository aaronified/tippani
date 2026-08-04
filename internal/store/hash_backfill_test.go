package store

// The 1.3.0 repair: rows written before dialogue hashes were episode-qualified
// still hold the text-only hash, which makes them latent duplicates — the next
// import of the same file computes the qualified hash, misses them, and inserts a
// second copy. Migrate re-hashes them.

import (
	"path/filepath"
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
	if want := DialogueDedupeHash(episoded, n(1), n(2)); got != want {
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
