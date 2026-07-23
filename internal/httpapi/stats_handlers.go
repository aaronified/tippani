package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// statsTop is a "most annotated/quoted" superlative (null when the user has
// no annotations/dialogues yet). CoverPath carries the cover/poster art for
// the Stats tile.
type statsTop struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	CoverPath string `json:"cover_path"`
	Count     int    `json:"count"`
}

// ---- recall breakdown (Stats page People/works card) ----

// recallTally is one entity row in the per-kind breakdown: how many works and
// quotes it accounts for, and where those quotes sit on the forgetting curve.
type recallTally struct {
	Name string `json:"name"`
	// CoverPath is the cover/poster of the entity's (first) work — set for the
	// work kinds (books · films · shows), empty for people/series (people art
	// comes from the People console client-side).
	CoverPath         string `json:"cover_path,omitempty"`
	Works             int    `json:"works"`
	Quotes            int    `json:"quotes"`
	Remembered        int    `json:"remembered"`
	Forgetting        int    `json:"forgetting"`
	ProbablyForgotten int    `json:"probably_forgotten"`
	Unseen            int    `json:"unseen"`
}

// statsKind is one breakdown kind as the client receives it: entity count, the
// top rows by quote count, and the recall superlatives ("who is the most
// remembered / most forgotten X").
type statsKind struct {
	Count          int            `json:"count"`
	Top            []recallTally  `json:"top"`
	MostRemembered *recallTally   `json:"most_remembered"`
	MostForgotten  *recallTally   `json:"most_forgotten"`
}

// statsTopN — rows per breakdown kind. The card shows ~10 and scrolls for the
// rest (ranked), so this is the scroll depth, not the visible height.
const statsTopN = 50

// tallyMap aggregates quotes into named entities (author, series, actor, …),
// case-insensitively — first spelling wins, works counted as a distinct set.
type tallyMap struct {
	rows  map[string]*recallTally
	works map[string]map[string]bool
}

func newTallyMap() *tallyMap {
	return &tallyMap{rows: map[string]*recallTally{}, works: map[string]map[string]bool{}}
}

// work registers a work for an entity without adding a quote — so an author's
// unannotated books still count toward their works.
func (tm *tallyMap) work(name, workKey string) *recallTally {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}
	k := strings.ToLower(name)
	row, ok := tm.rows[k]
	if !ok {
		row = &recallTally{Name: name}
		tm.rows[k] = row
		tm.works[k] = map[string]bool{}
	}
	if workKey != "" && !tm.works[k][workKey] {
		tm.works[k][workKey] = true
		row.Works++
	}
	return row
}

// quote adds one quote with its derived recall status.
func (tm *tallyMap) quote(name, workKey, status string) {
	row := tm.work(name, workKey)
	if row == nil {
		return
	}
	row.Quotes++
	switch status {
	case "remembered":
		row.Remembered++
	case "forgetting":
		row.Forgetting++
	case "probably-forgotten":
		row.ProbablyForgotten++
	default:
		row.Unseen++
	}
}

// finish shapes the aggregate for the client: rows sorted most-quoted first
// (then most works, then name), capped at statsTopN, plus the two recall
// superlatives picked over the FULL set, not just the visible top.
func (tm *tallyMap) finish() statsKind {
	all := make([]recallTally, 0, len(tm.rows))
	for _, r := range tm.rows {
		all = append(all, *r)
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].Quotes != all[j].Quotes {
			return all[i].Quotes > all[j].Quotes
		}
		if all[i].Works != all[j].Works {
			return all[i].Works > all[j].Works
		}
		return strings.ToLower(all[i].Name) < strings.ToLower(all[j].Name)
	})
	out := statsKind{Count: len(all), Top: []recallTally{}}
	for i := range all {
		if i < statsTopN {
			out.Top = append(out.Top, all[i])
		}
		if all[i].Remembered > 0 && (out.MostRemembered == nil || all[i].Remembered > out.MostRemembered.Remembered) {
			r := all[i]
			out.MostRemembered = &r
		}
		if all[i].ProbablyForgotten > 0 && (out.MostForgotten == nil || all[i].ProbablyForgotten > out.MostForgotten.ProbablyForgotten) {
			r := all[i]
			out.MostForgotten = &r
		}
	}
	return out
}

// statsBreakdown builds the per-kind recall breakdown: every quote is walked
// once per medium with its derived status and credited to its book/film/show,
// its series, and its people — joined credits split into individual names
// (ROADMAP §11) with the caller's separator config, exactly like the People
// console. A second cheap pass over the bare catalogue registers quote-less
// works so an author's works count means "books shelved", not "books quoted".
func (s *Server) statsBreakdown(uid int64) (map[string]statsKind, error) {
	seps := s.creditSeps(uid)
	authors, books, series := newTallyMap(), newTallyMap(), newTallyMap()
	films, shows, directors, actors := newTallyMap(), newTallyMap(), newTallyMap(), newTallyMap()

	// Books: register every shelved work, then walk the annotations.
	type bookRef struct {
		title, author, series, cover string
	}
	bookRefs := map[int64]bookRef{}
	rows, err := s.Store.DB.Query(
		`SELECT id, title, COALESCE(author,''), COALESCE(series,''), COALESCE(cover_path,'') FROM books WHERE user_id = ?`, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var br bookRef
		if err := rows.Scan(&id, &br.title, &br.author, &br.series, &br.cover); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown book row scan failed: %v", err)
			continue
		}
		bookRefs[id] = br
		key := "book:" + strconv.FormatInt(id, 10)
		if row := books.work(br.title, key); row != nil && row.CoverPath == "" {
			row.CoverPath = br.cover
		}
		series.work(br.series, key)
		for _, a := range metadata.SplitCredits(br.author, seps) {
			authors.work(a, key)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = s.Store.DB.Query(`
		SELECT a.book_id, r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result,''),
		       COALESCE(julianday('now') - julianday(a.created_at), 1e9)
		FROM annotations a JOIN books b ON b.id = a.book_id
		LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
		WHERE b.user_id = ?`, reviewMinStability, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var bookID int64
		var seen bool
		var stability, age float64
		var lr sql.NullString
		var lastResult string
		if err := rows.Scan(&bookID, &seen, &stability, &lr, &lastResult, &age); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown annotation row scan failed: %v", err)
			continue
		}
		br := bookRefs[bookID]
		status := recallStatus(seen, stability, elapsedDays(lr), age, lastResult)
		key := "book:" + strconv.FormatInt(bookID, 10)
		books.quote(br.title, key, status)
		series.quote(br.series, key, status)
		for _, a := range metadata.SplitCredits(br.author, seps) {
			authors.quote(a, key, status)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	// Screen: same two passes over movies and dialogues.
	type movieRef struct {
		title, mediaType, director, series, poster string
	}
	movieRefs := map[int64]movieRef{}
	rows, err = s.Store.DB.Query(
		`SELECT id, title, COALESCE(media_type,'movie'), COALESCE(director,''), COALESCE(series,''), COALESCE(poster_path,'') FROM movies WHERE user_id = ?`, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var mr movieRef
		if err := rows.Scan(&id, &mr.title, &mr.mediaType, &mr.director, &mr.series, &mr.poster); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown movie row scan failed: %v", err)
			continue
		}
		movieRefs[id] = mr
		key := "screen:" + strconv.FormatInt(id, 10)
		titles := films
		if mr.mediaType == "show" {
			titles = shows
		}
		if row := titles.work(mr.title, key); row != nil && row.CoverPath == "" {
			row.CoverPath = mr.poster
		}
		series.work(mr.series, key)
		for _, d := range metadata.SplitCredits(mr.director, seps) {
			directors.work(d, key)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = s.Store.DB.Query(`
		SELECT d.movie_id, COALESCE(d.actor,''), r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result,''),
		       COALESCE(julianday('now') - julianday(d.created_at), 1e9)
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id
		WHERE m.user_id = ?`, reviewMinStability, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var movieID int64
		var actor string
		var seen bool
		var stability, age float64
		var lr sql.NullString
		var lastResult string
		if err := rows.Scan(&movieID, &actor, &seen, &stability, &lr, &lastResult, &age); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown dialogue row scan failed: %v", err)
			continue
		}
		mr := movieRefs[movieID]
		status := recallStatus(seen, stability, elapsedDays(lr), age, lastResult)
		key := "screen:" + strconv.FormatInt(movieID, 10)
		titles := films
		if mr.mediaType == "show" {
			titles = shows
		}
		titles.quote(mr.title, key, status)
		series.quote(mr.series, key, status)
		for _, dd := range metadata.SplitCredits(mr.director, seps) {
			directors.quote(dd, key, status)
		}
		for _, a := range metadata.SplitCredits(actor, seps) {
			actors.quote(a, key, status)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	return map[string]statsKind{
		"authors":   authors.finish(),
		"books":     books.finish(),
		"series":    series.finish(),
		"films":     films.finish(),
		"shows":     shows.finish(),
		"directors": directors.finish(),
		"actors":    actors.finish(),
	}, nil
}

// handleStats implements GET /stats (§10): user-scoped library counts plus
// three superlatives for the Settings page tiles. A fixed handful of
// aggregate queries — nothing per-row.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[stats] handleStats uid=%v", uid)

	var books, annotations, movies, dialogues, tags, favorites int
	err := s.Store.DB.QueryRow(`
		SELECT
		  (SELECT count(*) FROM books WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?),
		  (SELECT count(*) FROM movies WHERE user_id = ?),
		  (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?),
		  (SELECT count(*) FROM tags WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		     WHERE b.user_id = ? AND a.favorite = 1)
		+ (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		     WHERE m.user_id = ? AND d.favorite = 1)`,
		uid, uid, uid, uid, uid, uid, uid).
		Scan(&books, &annotations, &movies, &dialogues, &tags, &favorites)
	if err != nil {
		internalError(w, r, "scan stats", err)
		return
	}

	topOf := func(query string) (*statsTop, error) {
		var t statsTop
		err := s.Store.DB.QueryRow(query, uid).Scan(&t.ID, &t.Title, &t.CoverPath, &t.Count)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return &t, nil
	}
	mostAnnotated, err := topOf(`
		SELECT b.id, b.title, COALESCE(b.cover_path, ''), count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE b.user_id = ? GROUP BY b.id ORDER BY count(*) DESC, b.id LIMIT 1`)
	if err != nil {
		internalError(w, r, "load most annotated", err)
		return
	}
	mostQuoted, err := topOf(`
		SELECT m.id, m.title, COALESCE(m.poster_path, ''), count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ? GROUP BY m.id ORDER BY count(*) DESC, m.id LIMIT 1`)
	if err != nil {
		internalError(w, r, "load most quoted", err)
		return
	}

	// Busiest month: annotations + dialogues bucketed by created_at month
	// (datetime('now') stores "YYYY-MM-DD …", so the bucket is substr 1–7).
	// Ties break to the most recent month.
	type monthTop struct {
		Month string `json:"month"`
		Count int    `json:"count"`
	}
	var busiest *monthTop
	{
		var m monthTop
		err := s.Store.DB.QueryRow(`
			SELECT substr(created_at, 1, 7) AS month, count(*)
			FROM (SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id
			        WHERE b.user_id = ?
			      UNION ALL
			      SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id
			        WHERE m.user_id = ?)
			GROUP BY month ORDER BY count(*) DESC, month DESC LIMIT 1`, uid, uid).
			Scan(&m.Month, &m.Count)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			// leave busiest nil -> JSON null
		case err != nil:
			internalError(w, r, "scan busiest month", err)
			return
		default:
			busiest = &m
		}
	}

	// Daily activity for the last ~53 weeks (annotations + dialogues bucketed by
	// created_at day) — drives the Stats page's GitHub-style calendar. Only days
	// with saves are sent; the client zero-fills its week grid.
	type dayCount struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	daily := []dayCount{}
	arows, err := s.Store.DB.Query(`
		SELECT substr(created_at, 1, 10) AS day, count(*)
		FROM (SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
		      UNION ALL
		      SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)
		WHERE created_at >= datetime('now', '-372 days')
		GROUP BY day ORDER BY day`, uid, uid)
	if err != nil {
		internalError(w, r, "query daily activity", err)
		return
	}
	for arows.Next() {
		var dc dayCount
		if err := arows.Scan(&dc.Date, &dc.Count); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] daily activity row scan failed: %v", err)
			continue
		}
		daily = append(daily, dc)
	}
	if err := arows.Err(); err != nil {
		olog.Warnf(olog.CodeStatsRowScan, "[stats] daily activity row iteration failed: %v", err)
	}
	arows.Close()

	// Review activity for the same window, per mode: cards answered per
	// reviewer-local day (quiz_sessions.day is already the local date). Feeds the
	// Activity card's Quiz and Practice calendars beside the Saves one.
	reviewSeries := func(mode string) ([]dayCount, error) {
		out := []dayCount{}
		rows, err := s.Store.DB.Query(`SELECT day, answered FROM quiz_sessions
			WHERE user_id = ? AND mode = ? AND answered > 0 AND day >= date('now','-372 days')
			ORDER BY day`, uid, mode)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var dc dayCount
			if err := rows.Scan(&dc.Date, &dc.Count); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] %s activity row scan failed: %v", mode, err)
				continue
			}
			out = append(out, dc)
		}
		return out, rows.Err()
	}
	dailyQuiz, err := reviewSeries("daily")
	if err != nil {
		internalError(w, r, "query quiz activity", err)
		return
	}
	dailyPractice, err := reviewSeries("practice")
	if err != nil {
		internalError(w, r, "query practice activity", err)
		return
	}

	// ---- richer insights for the dedicated Stats page ----

	// Breadth: genres actually attached to something. (People breadth now comes
	// from the recall breakdown below, multi-author splitting included.)
	var genres int
	if err := s.Store.DB.QueryRow(`
		SELECT count(*) FROM (
		  SELECT bg.genre_id AS gid FROM book_genres bg JOIN books b ON b.id = bg.book_id WHERE b.user_id = ?
		  UNION
		  SELECT mg.genre_id FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id WHERE m.user_id = ?
		)`, uid, uid).Scan(&genres); err != nil {
		internalError(w, r, "count genres", err)
		return
	}

	// Highlight-colour breakdown of book annotations (the four fixed colours).
	colors := map[string]int{"yellow": 0, "blue": 0, "pink": 0, "orange": 0}
	if crows, err := s.Store.DB.Query(`
		SELECT a.color, count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE b.user_id = ? GROUP BY a.color`, uid); err != nil {
		internalError(w, r, "query colours", err)
		return
	} else {
		for crows.Next() {
			var c string
			var n int
			if err := crows.Scan(&c, &n); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] colour row scan failed: %v", err)
				continue
			}
			if _, ok := colors[c]; ok {
				colors[c] = n
			}
		}
		crows.Close()
	}

	// Leaderboard: top tags by usage. (Author/actor/director leaderboards moved
	// into the recall breakdown.)
	type nameCount struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	listOf := func(query string, args ...any) ([]nameCount, error) {
		rows, err := s.Store.DB.Query(query, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []nameCount{}
		for rows.Next() {
			var nc nameCount
			if err := rows.Scan(&nc.Name, &nc.Count); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] top-list row scan failed: %v", err)
				continue
			}
			out = append(out, nc)
		}
		return out, rows.Err()
	}
	topTags, err := listOf(`
		SELECT t.name, count(*) AS c FROM tags t JOIN (
		  SELECT at.tag_id FROM annotation_tags at
		    JOIN annotations a ON a.id = at.annotation_id JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
		  UNION ALL
		  SELECT dt.tag_id FROM dialogue_tags dt
		    JOIN dialogues d ON d.id = dt.dialogue_id JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?
		) u ON u.tag_id = t.id
		GROUP BY t.id ORDER BY c DESC, t.name LIMIT 50`, uid, uid)
	if err != nil {
		internalError(w, r, "top tags", err)
		return
	}

	// Recall overview (the forgetting curve across the whole library): status
	// counts plus how many quotes have entered the schedule and their average
	// floored half-life — the Stats page "Memory" card.
	states, err := s.reviewStates(uid, true, true)
	if err != nil {
		internalError(w, r, "recall states", err)
		return
	}
	var reviewedN int
	var avgHalfLife float64
	if err := s.Store.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(AVG(MAX(r.stability, `+reviewFloorSQL+`)), 0) FROM item_reviews r
		WHERE (r.kind = 'book' AND r.item_id IN
		         (SELECT a.id FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?))
		   OR (r.kind = 'screen' AND r.item_id IN
		         (SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?))`,
		uid, uid).Scan(&reviewedN, &avgHalfLife); err != nil {
		internalError(w, r, "recall half-life", err)
		return
	}

	// Per-kind recall breakdown (authors · books · series · films · shows ·
	// directors · actors), multi-author credits split.
	breakdown, err := s.statsBreakdown(uid)
	if err != nil {
		internalError(w, r, "recall breakdown", err)
		return
	}

	// "Collecting since": the earliest saved quote/dialogue (date only, or null).
	var firstSaved *string
	{
		var fs sql.NullString
		err := s.Store.DB.QueryRow(`
			SELECT min(created_at) FROM (
			  SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
			  UNION ALL
			  SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)`,
			uid, uid).Scan(&fs)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			internalError(w, r, "first saved", err)
			return
		}
		if fs.Valid && len(fs.String) >= 10 {
			d := fs.String[:10] // YYYY-MM-DD
			firstSaved = &d
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"books":          books,
		"annotations":    annotations,
		"movies":         movies,
		"dialogues":      dialogues,
		"tags":           tags,
		"favorites":      favorites,
		"genres":         genres,
		"most_annotated": mostAnnotated,
		"most_quoted":    mostQuoted,
		"busiest_month":  busiest,
		"daily_activity": daily,
		"daily_quiz":     dailyQuiz,
		"daily_practice": dailyPractice,
		"colors":         colors,
		"top_tags":       topTags,
		"first_saved":    firstSaved,
		"recall": map[string]any{
			"states":        states,
			"reviewed":      reviewedN,
			"avg_half_life": avgHalfLife,
		},
		"breakdown": breakdown,
	})
}
