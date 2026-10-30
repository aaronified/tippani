package httpapi

// A show's episodes: a name of its own for each, and up to three orders (see migration 0088).
//
// A line of dialogue keeps its season and episode in the `tv` order and never anything else, so
// the numbers inside the dedupe hash do not depend on which order is shown. `episodes` and
// `episode_orders` say what each episode is called and where it sits in the other numberings.
// THIS FILE IS THE READ HALF: the dialog's list. Saving an order comes after it.
//
// OWNERSHIP IS THE SERIES'. Neither table has a user_id, so every query here starts from a movie
// that is the reader's, and a series that is not is 404 — never 403 — like every other work.

import (
	"database/sql"
	"net/http"
	"sort"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/store"
)

// episodeOrderKinds are the three orders a series can show. The column is free text and a
// fourth would be a row, but only these are offered.
var episodeOrderKinds = []string{"tv", "dvd", "custom"}

type episodePlace struct {
	Season  int `json:"season"`
	Episode int `json:"episode"`
}

type episodeRow struct {
	ID       int64                   `json:"id"`
	Name     string                  `json:"name"`
	Overview string                  `json:"overview"`
	AirDate  string                  `json:"air_date"`
	Source   string                  `json:"source"`
	Quotes   int                     `json:"quotes"`
	Orders   map[string]episodePlace `json:"orders"`
	// Candidates are the names this episode's lines carry when it has none of its own, for the
	// reader to pick one. Empty once the episode is named.
	Candidates []string `json:"candidates,omitempty"`
}

type episodesAnswer struct {
	// Order is the one shown: movies.episode_order, with '' read as tv.
	Order    string       `json:"order"`
	Episodes []episodeRow `json:"episodes"`
	// HasDVD says whether any episode carries a dvd place, so the dialog can say a series has none
	// published instead of offering an empty switch position.
	HasDVD bool `json:"has_dvd"`
}

// handleGetEpisodes: GET /movies/{id}/episodes.
func (s *Server) handleGetEpisodes(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	uid := userID(r)
	var order, mediaType string
	err := s.Store.DB.QueryRow(`SELECT episode_order, media_type FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&order, &mediaType)
	if err != nil {
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	}
	if mediaType != "show" {
		// Films and games have no episodes, and the answer says so rather than inventing a list.
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	}
	if order == "" {
		order = "tv"
	}
	out := episodesAnswer{Order: order, Episodes: []episodeRow{}}
	byID := map[int64]*episodeRow{}

	rows, err := s.Store.DB.Query(`SELECT id, name, overview, air_date, source FROM episodes WHERE movie_id = ? ORDER BY id`, id)
	if err != nil {
		internalError(w, r, "episodes: list", err)
		return
	}
	for rows.Next() {
		var e episodeRow
		if err := rows.Scan(&e.ID, &e.Name, &e.Overview, &e.AirDate, &e.Source); err != nil {
			rows.Close()
			internalError(w, r, "episodes: scan", err)
			return
		}
		e.Orders = map[string]episodePlace{}
		out.Episodes = append(out.Episodes, e)
	}
	rows.Close()
	for i := range out.Episodes {
		byID[out.Episodes[i].ID] = &out.Episodes[i]
	}

	orows, err := s.Store.DB.Query(`
		SELECT o.episode_id, o.kind, o.season, o.episode FROM episode_orders o
		JOIN episodes e ON e.id = o.episode_id WHERE e.movie_id = ?`, id)
	if err != nil {
		internalError(w, r, "episodes: orders", err)
		return
	}
	for orows.Next() {
		var eid int64
		var kind string
		var p episodePlace
		if err := orows.Scan(&eid, &kind, &p.Season, &p.Episode); err != nil {
			orows.Close()
			internalError(w, r, "episodes: orders scan", err)
			return
		}
		if e := byID[eid]; e != nil {
			e.Orders[kind] = p
			if kind == "dvd" {
				out.HasDVD = true
			}
		}
	}
	orows.Close()

	// The reader's quotes per episode, and the names their lines carry: both read off the stored
	// `tv` numbers, which is what every line holds.
	type key struct{ season, episode int }
	byTV := map[key]*episodeRow{}
	for i := range out.Episodes {
		if p, ok := out.Episodes[i].Orders["tv"]; ok {
			byTV[key{p.Season, p.Episode}] = &out.Episodes[i]
		}
	}
	lrows, err := s.Store.DB.Query(`
		SELECT season, episode, episode_name, COUNT(*) FROM dialogues
		WHERE movie_id = ? AND season IS NOT NULL AND episode IS NOT NULL
		GROUP BY season, episode, episode_name`, id)
	if err != nil {
		internalError(w, r, "episodes: lines", err)
		return
	}
	for lrows.Next() {
		var k key
		var name string
		var n int
		if err := lrows.Scan(&k.season, &k.episode, &name, &n); err != nil {
			lrows.Close()
			internalError(w, r, "episodes: lines scan", err)
			return
		}
		e := byTV[k]
		if e == nil {
			continue
		}
		e.Quotes += n
		if name != "" && e.Name == "" {
			e.Candidates = append(e.Candidates, name)
		}
	}
	lrows.Close()
	for i := range out.Episodes {
		sort.Strings(out.Episodes[i].Candidates)
	}
	// Seasons in order, then episodes: the dialog's own grouping, in the order being shown.
	sort.SliceStable(out.Episodes, func(i, j int) bool {
		a, b := out.Episodes[i].Orders[order], out.Episodes[j].Orders[order]
		if a.Season != b.Season {
			return a.Season < b.Season
		}
		return a.Episode < b.Episode
	})
	writeJSON(w, http.StatusOK, out)
}

type episodePutItem struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Season  int    `json:"season"`
	Episode int    `json:"episode"`
}

type episodePutReq struct {
	// Order is the one being saved: tv or custom. dvd is as the provider published it and is refused.
	Order string `json:"order"`
	// Confirm is the reader's yes to renumbering the tv order, which rewrites the lines that sit in
	// the episodes that move. Without it a tv save that would move lines answers 409 with the count.
	Confirm bool `json:"confirm"`
	// Show is which order the series shows afterwards (tv, dvd or custom), written in the same
	// transaction so the dialog's one press cannot leave places saved and the view unchanged. nil
	// leaves it.
	Show     *string          `json:"show"`
	Episodes []episodePutItem `json:"episodes"`
}

// handlePutEpisodes: PUT /movies/{id}/episodes — a full-state save of ONE order and the names.
//
//   - custom touches no line: it is only where each episode sits in the reader's own numbering.
//   - tv is the order the lines are stored in, so changing a place rewrites and rehashes the lines
//     in that episode, in one transaction, and refuses the whole save when a rehashed line would
//     meet one that already holds its hash. The boot repair skips such a row; this does not.
//   - dvd is read-only and refused.
//
// An episode's name is written on the episode and on each of its lines, so a line's export and the
// import binding keep saying what the episode is called.
func (s *Server) handlePutEpisodes(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	var req episodePutReq
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	var mediaType string
	if err := s.Store.DB.QueryRow(`SELECT media_type FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&mediaType); err != nil || mediaType != "show" {
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	}
	switch req.Order {
	case "tv", "custom":
	case "dvd":
		writeErr(w, http.StatusBadRequest, "the dvd order is read-only: copy it to custom to change it")
		return
	default:
		writeErr(w, http.StatusBadRequest, "order must be tv or custom")
		return
	}

	if req.Show != nil && *req.Show != "" && *req.Show != "tv" && *req.Show != "dvd" && *req.Show != "custom" {
		writeErr(w, http.StatusBadRequest, "an episode order is tv, dvd or custom")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "episodes: begin", err)
		return
	}
	defer tx.Rollback()

	// What the series holds now: each episode's place in the order being saved, and its tv place.
	type held struct {
		name     string
		cur, tv  episodePlace
		hasTV    bool
		newPlace episodePlace
	}
	eps := map[int64]*held{}
	rows, err := tx.Query(`SELECT id, name FROM episodes WHERE movie_id = ?`, id)
	if err != nil {
		internalError(w, r, "episodes: list", err)
		return
	}
	for rows.Next() {
		var eid int64
		h := &held{}
		if err := rows.Scan(&eid, &h.name); err != nil {
			rows.Close()
			internalError(w, r, "episodes: scan", err)
			return
		}
		eps[eid] = h
	}
	rows.Close()
	orows, err := tx.Query(`SELECT o.episode_id, o.kind, o.season, o.episode FROM episode_orders o JOIN episodes e ON e.id = o.episode_id
		WHERE e.movie_id = ? AND o.kind IN ('tv', ?)`, id, req.Order)
	if err != nil {
		internalError(w, r, "episodes: orders", err)
		return
	}
	for orows.Next() {
		var eid int64
		var kind string
		var p episodePlace
		if err := orows.Scan(&eid, &kind, &p.Season, &p.Episode); err != nil {
			orows.Close()
			internalError(w, r, "episodes: orders scan", err)
			return
		}
		if h := eps[eid]; h != nil {
			if kind == "tv" {
				h.tv, h.hasTV = p, true
			}
			if kind == req.Order {
				h.cur = p
			}
		}
	}
	orows.Close()

	// The new places, and every pair in the order unique once they are in.
	for _, h := range eps {
		h.newPlace = h.cur
	}
	names := map[int64]string{}
	for _, it := range req.Episodes {
		h := eps[it.ID]
		if h == nil {
			writeErr(w, http.StatusBadRequest, "an episode in the list is not this series'")
			return
		}
		if it.Season < 0 || it.Episode < 0 {
			writeErr(w, http.StatusBadRequest, "season and episode cannot be negative")
			return
		}
		h.newPlace = episodePlace{Season: it.Season, Episode: it.Episode}
		names[it.ID] = strings.TrimSpace(it.Name)
	}
	seen := map[episodePlace]bool{}
	for _, h := range eps {
		if seen[h.newPlace] {
			writeErr(w, http.StatusBadRequest, "two episodes would sit in the same place")
			return
		}
		seen[h.newPlace] = true
	}

	moved := 0
	if req.Order == "tv" {
		n, status, msg, extra := renumberTV(tx, id, func() map[episodePlace]episodePlace {
			m := map[episodePlace]episodePlace{}
			for _, h := range eps {
				if h.hasTV && h.newPlace != h.tv {
					m[h.tv] = h.newPlace
				}
			}
			return m
		}(), req.Confirm)
		if status != 0 {
			writeJSON(w, status, map[string]any{"error": msg, "moves": n, "collisions": extra})
			return
		}
		moved = n
	}
	for eid, h := range eps {
		if h.newPlace == h.cur {
			continue
		}
		if _, err := tx.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, ?, ?, ?)
			ON CONFLICT (episode_id, kind) DO UPDATE SET season = excluded.season, episode = excluded.episode`,
			eid, req.Order, h.newPlace.Season, h.newPlace.Episode); err != nil {
			internalError(w, r, "episodes: save order", err)
			return
		}
	}
	for eid, name := range names {
		h := eps[eid]
		if name == h.name {
			continue
		}
		if _, err := tx.Exec(`UPDATE episodes SET name = ?, source = 'reader' WHERE id = ?`, name, eid); err != nil {
			internalError(w, r, "episodes: save name", err)
			return
		}
		// The lines of this episode, by the tv place it holds now.
		tvp := h.tv
		if req.Order == "tv" {
			tvp = h.newPlace
		}
		if h.hasTV {
			if _, err := tx.Exec(`UPDATE dialogues SET episode_name = ? WHERE movie_id = ? AND season = ? AND episode = ?`,
				name, id, tvp.Season, tvp.Episode); err != nil {
				internalError(w, r, "episodes: name the lines", err)
				return
			}
		}
	}
	if req.Show != nil {
		v := *req.Show
		if v == "tv" {
			v = ""
		}
		if _, err := tx.Exec(`UPDATE movies SET episode_order = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`, v, id, uid); err != nil {
			internalError(w, r, "episodes: show order", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "episodes: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"moved": moved})
}

// renumberTV moves the lines of each episode in `moves` (old tv place -> new) and rehashes them. It
// returns the number of lines that move, and a non-zero status with a message when the save has to be
// refused: unconfirmed (409 with the count) or a collision (409, naming how many lines would collide).
// Nothing is written on a refusal. Moves are applied in two passes so that two episodes swapping
// places never meet each other's hash half way.
func renumberTV(tx *sql.Tx, movie int64, moves map[episodePlace]episodePlace, confirm bool) (n int, status int, msg string, collisions int) {
	if len(moves) == 0 {
		return 0, 0, "", 0
	}
	type line struct {
		id         int64
		quote      string
		act, quest string
		season, ep int
		hash       string
		newHash    string
		moves      bool
	}
	rows, err := tx.Query(`SELECT id, quote, act, quest, season, episode, dedupe_hash FROM dialogues
		WHERE movie_id = ?`, movie)
	if err != nil {
		return 0, http.StatusInternalServerError, "could not read the lines", 0
	}
	var lines []*line
	for rows.Next() {
		l := &line{}
		var season, ep sql.NullInt64
		if err := rows.Scan(&l.id, &l.quote, &l.act, &l.quest, &season, &ep, &l.hash); err != nil {
			rows.Close()
			return 0, http.StatusInternalServerError, "could not read the lines", 0
		}
		l.season, l.ep = int(season.Int64), int(ep.Int64)
		if season.Valid && ep.Valid {
			if to, ok := moves[episodePlace{l.season, l.ep}]; ok {
				l.moves = true
				s2, e2 := to.Season, to.Episode
				l.newHash = store.DialogueDedupeHash(l.quote, &s2, &e2, l.act, l.quest)
				l.season, l.ep = s2, e2
				n++
			}
		}
		lines = append(lines, l)
	}
	rows.Close()
	if n == 0 {
		return 0, 0, "", 0
	}
	if !confirm {
		return n, http.StatusConflict, "renumbering the tv order moves quotes: confirm to go on", 0
	}
	final := map[string]int{}
	for _, l := range lines {
		h := l.hash
		if l.moves {
			h = l.newHash
		}
		final[h]++
	}
	for _, c := range final {
		if c > 1 {
			collisions += c - 1
		}
	}
	if collisions > 0 {
		return n, http.StatusConflict, "a renumbered quote would meet one that already has its place: nothing was changed", collisions
	}
	for _, l := range lines {
		if l.moves {
			if _, err := tx.Exec(`UPDATE dialogues SET dedupe_hash = 'moving:' || id WHERE id = ?`, l.id); err != nil {
				return 0, http.StatusInternalServerError, "could not renumber", 0
			}
		}
	}
	for _, l := range lines {
		if l.moves {
			if _, err := tx.Exec(`UPDATE dialogues SET season = ?, episode = ?, dedupe_hash = ?, updated_at = datetime('now') WHERE id = ?`,
				l.season, l.ep, l.newHash, l.id); err != nil {
				return 0, http.StatusInternalServerError, "could not renumber", 0
			}
		}
	}
	return n, 0, "", 0
}

// writeEpisodes merges a supplier's episode list into a show, inside the caller's transaction.
//
//   - An episode is found by its tv place. One the show lacks is made, with the supplier's name,
//     overview and air date and its tv order row; one with no quotes is kept like any other.
//   - A NAME THE READER WROTE IS NEVER OVERWRITTEN: `source` says who wrote it, and only a name the
//     supplier or the lines wrote is replaced. The overview and air date fill in where empty.
//   - The dvd order is the supplier's to publish, so it is rewritten each time and removed from an
//     episode the supplier no longer places there. The reader's custom order is not touched.
//
// An empty list changes nothing: a supplier that would not answer must not empty a show.
func writeEpisodes(tx *sql.Tx, movie int64, source string, eps []metadata.Episode) error {
	if len(eps) == 0 {
		return nil
	}
	type held struct {
		id     int64
		name   string
		source string
	}
	have := map[episodePlace]held{}
	rows, err := tx.Query(`SELECT e.id, e.name, e.source, o.season, o.episode FROM episodes e
		JOIN episode_orders o ON o.episode_id = e.id AND o.kind = 'tv' WHERE e.movie_id = ?`, movie)
	if err != nil {
		return err
	}
	for rows.Next() {
		var h held
		var p episodePlace
		if err := rows.Scan(&h.id, &h.name, &h.source, &p.Season, &p.Episode); err != nil {
			rows.Close()
			return err
		}
		have[p] = h
	}
	rows.Close()
	// An answer with no dvd place at all is no evidence the supplier dropped its grouping (the call that
	// finds it may simply have failed), so the stored dvd order is only pruned when this one has some.
	anyDVD := false
	for _, e := range eps {
		if e.DVDSeason > 0 || e.DVDNumber > 0 {
			anyDVD = true
		}
	}
	for _, e := range eps {
		p := episodePlace{Season: e.Season, Episode: e.Number}
		h, ok := have[p]
		if !ok {
			res, err := tx.Exec(`INSERT INTO episodes (movie_id, name, overview, air_date, source) VALUES (?, ?, ?, ?, ?)`,
				movie, e.Name, e.Overview, e.AirDate, source)
			if err != nil {
				return err
			}
			h.id, _ = res.LastInsertId()
			if _, err := tx.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, 'tv', ?, ?)`,
				h.id, e.Season, e.Number); err != nil {
				return err
			}
		} else {
			if h.source != "reader" && e.Name != "" && e.Name != h.name {
				if _, err := tx.Exec(`UPDATE episodes SET name = ?, source = ? WHERE id = ?`, e.Name, source, h.id); err != nil {
					return err
				}
			}
			if _, err := tx.Exec(`UPDATE episodes SET overview = CASE WHEN overview = '' THEN ? ELSE overview END,
				air_date = CASE WHEN air_date = '' THEN ? ELSE air_date END WHERE id = ?`, e.Overview, e.AirDate, h.id); err != nil {
				return err
			}
		}
		if e.DVDNumber > 0 || e.DVDSeason > 0 {
			if _, err := tx.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (?, 'dvd', ?, ?)
				ON CONFLICT (episode_id, kind) DO UPDATE SET season = excluded.season, episode = excluded.episode`,
				h.id, e.DVDSeason, e.DVDNumber); err != nil {
				return err
			}
		} else if anyDVD {
			if _, err := tx.Exec(`DELETE FROM episode_orders WHERE episode_id = ? AND kind = 'dvd'`, h.id); err != nil {
				return err
			}
		}
	}
	return nil
}
