package store

import (
	"database/sql"
	"sort"

	"tippani/internal/olog"
)

// 3.5.0: one name per episode. Lines have carried a typed episode name since 2.2.0, so a
// show's episode was named on each of its lines and could be named differently on two.
// This gives every (series, season, episode) a line names an `episodes` row with its `tv`
// order, and seeds the name from its lines.
//
// WHERE THE LINES DISAGREE the name is left empty and the row says so by its source: a
// guess between two names the reader typed is theirs to make, and the episode dialog lists
// the candidates. It never picks the commonest, because "two of three" is not "right".
//
// SEASON 0 SURVIVES: specials are season 0 and a falsy-zero test would drop them, so the
// pass keys on NULL, never on zero.
//
// RETIRING THIS FILE. Delete it; nothing else mentions it. Do it once no supported
// instance can still be upgrading from before 3.5.0.

func init() {
	RegisterOneTimePass(OneTimePass{
		Version: "3.5.0",
		Name:    "3.5.0-episode-names",
		Why:     "an episode gets one name of its own; seed an episodes row for every season and episode a line names",
		Run:     seedEpisodesFromLines,
	})
}

func seedEpisodesFromLines(tx *sql.Tx, _ OneTimeEnv) error {
	rows, err := tx.Query(`
		SELECT movie_id, season, episode, episode_name FROM dialogues
		WHERE season IS NOT NULL AND episode IS NOT NULL`)
	if err != nil {
		return err
	}
	type key struct{ movie, season, episode int64 }
	names := map[key]map[string]bool{}
	for rows.Next() {
		var k key
		var name string
		if err := rows.Scan(&k.movie, &k.season, &k.episode, &name); err != nil {
			rows.Close()
			return err
		}
		if names[k] == nil {
			names[k] = map[string]bool{}
		}
		if name != "" {
			names[k][name] = true
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	// A stable order, so two runs over the same data hand out the same ids.
	keys := make([]key, 0, len(names))
	for k := range names {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		a, b := keys[i], keys[j]
		if a.movie != b.movie {
			return a.movie < b.movie
		}
		if a.season != b.season {
			return a.season < b.season
		}
		return a.episode < b.episode
	})

	made := 0
	for _, k := range keys {
		// Already there (a re-run after a partial failure): leave it alone.
		var have int
		if err := tx.QueryRow(`
			SELECT COUNT(*) FROM episodes e JOIN episode_orders o ON o.episode_id = e.id AND o.kind = 'tv'
			WHERE e.movie_id = ? AND o.season = ? AND o.episode = ?`, k.movie, k.season, k.episode).Scan(&have); err != nil {
			return err
		}
		if have > 0 {
			continue
		}
		name, source := "", ""
		if len(names[k]) == 1 {
			for n := range names[k] {
				name, source = n, "lines"
			}
		}
		res, err := tx.Exec(`INSERT INTO episodes (movie_id, name, source) VALUES (?, ?, ?)`, k.movie, name, source)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		if _, err := tx.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, 'tv', ?, ?)`,
			id, k.season, k.episode); err != nil {
			return err
		}
		made++
	}
	olog.Printf("[store] episodes: %d seeded from the lines of shows", made)
	return nil
}
