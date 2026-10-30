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
	"net/http"
	"sort"
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
