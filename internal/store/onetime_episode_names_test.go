package store

import (
	"path/filepath"
	"testing"
)

// The 3.5.0 pass: every season and episode a line names gets an episode of its own, named from
// its lines where they agree and left unnamed where they do not. Season 0 (specials) survives,
// a film's line (no season) makes nothing, and running it twice makes nothing twice.
func TestTheEpisodePassSeedsNamesFromLinesAndLeavesDisagreementsUnnamed(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'A Show'), (2, 1, 'A Film')`)
	line := func(id int, movie int, season, episode any, name string) {
		exec(`INSERT INTO dialogues (id, movie_id, quote, season, episode, episode_name, dedupe_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, movie, "q", season, episode, name, "h"+string(rune('a'+id)))
	}
	line(1, 1, 1, 1, "Pilot")
	line(2, 1, 1, 1, "Pilot")      // agrees
	line(3, 1, 1, 2, "The Second") // disagrees with the next
	line(4, 1, 1, 2, "Two")
	line(5, 1, 0, 1, "A Special") // season 0
	line(6, 1, 2, 1, "")          // no name typed
	line(7, 2, nil, nil, "")      // a film

	run := func() {
		t.Helper()
		tx, err := s.DB.Begin()
		if err != nil {
			t.Fatal(err)
		}
		if err := seedEpisodesFromLines(tx, OneTimeEnv{}); err != nil {
			tx.Rollback()
			t.Fatal(err)
		}
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
	}
	run()
	run()

	type row struct {
		season, episode int
		name, source    string
	}
	got := map[row]bool{}
	rows, err := s.DB.Query(`SELECT o.season, o.episode, e.name, e.source FROM episodes e JOIN episode_orders o ON o.episode_id = e.id AND o.kind = 'tv' WHERE e.movie_id = 1`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.season, &r.episode, &r.name, &r.source); err != nil {
			t.Fatal(err)
		}
		got[r] = true
	}
	rows.Close()
	want := []row{
		{1, 1, "Pilot", "lines"},
		{1, 2, "", ""},
		{0, 1, "A Special", "lines"},
		{2, 1, "", ""},
	}
	if len(got) != len(want) {
		t.Fatalf("got %v", got)
	}
	for _, w := range want {
		if !got[w] {
			t.Errorf("missing %+v in %v", w, got)
		}
	}
	var n int
	s.DB.QueryRow(`SELECT COUNT(*) FROM episodes WHERE movie_id = 2`).Scan(&n)
	if n != 0 {
		t.Errorf("a film got %d episodes", n)
	}
	s.DB.QueryRow(`SELECT COUNT(*) FROM episodes`).Scan(&n)
	if n != 4 {
		t.Errorf("running twice made %d episodes, want 4", n)
	}
}
