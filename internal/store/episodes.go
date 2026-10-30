package store

import "database/sql"

// EnsureEpisodes gives every (season, episode) a show's lines name an `episodes` row with its tv
// order, where it lacks one, and names it from its lines when they agree on one. It is idempotent
// and cheap, and is called after anything that writes a line's season or episode, so the episode
// list a reader opens is never missing the episode a quote came from.
//
// It never renames an episode that has a name, and never touches the orders: an episode the reader
// or a supplier already described is theirs. Season 0 is a real season (specials), so it keys on NULL
// and never on zero.
func EnsureEpisodes(tx *sql.Tx, movieID int64) error {
	rows, err := tx.Query(`
		SELECT d.season, d.episode, COUNT(DISTINCT NULLIF(d.episode_name, '')), MIN(NULLIF(d.episode_name, ''))
		FROM dialogues d
		WHERE d.movie_id = ? AND d.season IS NOT NULL AND d.episode IS NOT NULL
		  AND NOT EXISTS (SELECT 1 FROM episodes e JOIN episode_orders o ON o.episode_id = e.id AND o.kind = 'tv'
		                  WHERE e.movie_id = d.movie_id AND o.season = d.season AND o.episode = d.episode)
		GROUP BY d.season, d.episode`, movieID)
	if err != nil {
		return err
	}
	type missing struct {
		season, episode int
		names           int
		name            sql.NullString
	}
	var todo []missing
	for rows.Next() {
		var m missing
		if err := rows.Scan(&m.season, &m.episode, &m.names, &m.name); err != nil {
			rows.Close()
			return err
		}
		todo = append(todo, m)
	}
	rows.Close()
	for _, m := range todo {
		name, source := "", ""
		// Where the lines disagree the name is left for the reader to pick.
		if m.names == 1 && m.name.Valid {
			name, source = m.name.String, "lines"
		}
		res, err := tx.Exec(`INSERT INTO episodes (movie_id, name, source) VALUES (?, ?, ?)`, movieID, name, source)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		if _, err := tx.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, 'tv', ?, ?)`,
			id, m.season, m.episode); err != nil {
			return err
		}
	}
	return nil
}
