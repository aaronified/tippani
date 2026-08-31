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
	Count          int           `json:"count"`
	Top            []recallTally `json:"top"`
	MostRemembered *recallTally  `json:"most_remembered"`
	MostForgotten  *recallTally  `json:"most_forgotten"`
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
// once per medium with its derived status and credited to its work, its series,
// and its people — joined credits split into individual names (ROADMAP §11)
// with the caller's separator config, exactly like the People console. A second
// cheap pass over the bare catalogue registers quote-less works so an author's
// works count means "books shelved", not "books quoted".
//
// Standalone quotes (§24) are the exception to that two-pass shape, and to the
// idea of a work: there is no table of speeches to walk, so their "works" are
// the occasions the quotes name.
func (s *Server) statsBreakdown(uid int64) (map[string]statsKind, error) {
	seps := s.creditSeps(uid)
	authors, books, series := newTallyMap(), newTallyMap(), newTallyMap()
	films, shows, directors, actors := newTallyMap(), newTallyMap(), newTallyMap(), newTallyMap()
	// CHARACTERS ARE THEIR OWN TALLY, not a second reading of the actor one.
	//
	// They are a different KIND of thing and the counts differ: one actor plays
	// several characters across a library and one character is played by several
	// actors across adaptations, so neither list is derivable from the other. A
	// book has characters and no actors at all, which is the case that settles it —
	// merged, every book quote would be missing from the only list it belongs in.
	//
	// Deliberately NOT fed into `people`: a character is not a person with a
	// portrait, a page and a rename. `people` is the actor-and-director merge and
	// stays that.
	characters := newTallyMap()
	// people is every credited human in one map, whatever role they were
	// credited in. 0027 already made the NAME a person's identity and their
	// kinds a set, precisely because a speaker is so often already an author —
	// but the breakdowns never caught up, so somebody with a book and a film
	// appeared twice, in two sections, each telling half the story.
	people := newTallyMap()

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
			people.work(a, key)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = s.Store.DB.Query(`
		SELECT a.book_id, COALESCE(a.character,''), r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result,''),
		       COALESCE(julianday('now') - julianday(a.created_at), 1e9)
		FROM annotations a JOIN books b ON b.id = a.book_id
		LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
		WHERE b.user_id = ?`, reviewMinStability, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var bookID int64
		var character string
		var seen bool
		var stability, age float64
		var lr sql.NullString
		var lastResult string
		if err := rows.Scan(&bookID, &character, &seen, &stability, &lr, &lastResult, &age); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown annotation row scan failed: %v", err)
			continue
		}
		br := bookRefs[bookID]
		status := recallStatus(seen, stability, elapsedDays(lr), age, lastResult)
		key := "book:" + strconv.FormatInt(bookID, 10)
		books.quote(br.title, key, status)
		series.quote(br.series, key, status)
		// A BOOK HAS CHARACTERS AND NO ACTORS (0047), which is the case that makes
		// the two lists separate rather than one relabelled. Merged into the actor
		// tally these rows would be missing from the only list they belong in.
		for _, c := range metadata.SplitCredits(character, seps) {
			characters.quote(c, key, status)
		}
		for _, a := range metadata.SplitCredits(br.author, seps) {
			authors.quote(a, key, status)
			people.quote(a, key, status)
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
			people.work(d, key)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = s.Store.DB.Query(`
		SELECT d.movie_id, COALESCE(d.actor,''), COALESCE(d.character,''), r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result,''),
		       COALESCE(julianday('now') - julianday(d.created_at), 1e9)
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id
		WHERE m.user_id = ?`, reviewMinStability, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var movieID int64
		var actor, character string
		var seen bool
		var stability, age float64
		var lr sql.NullString
		var lastResult string
		if err := rows.Scan(&movieID, &actor, &character, &seen, &stability, &lr, &lastResult, &age); err != nil {
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
		// Split the same way the actor is: a line can be spoken by more than one
		// character, entered like tags, and the quote form splits it on the reader's
		// own separators.
		for _, c := range metadata.SplitCredits(character, seps) {
			characters.quote(c, key, status)
		}
		// Once per PERSON, not once per credit. Eastwood directs and stars, and
		// counting the same line under both of his credits would give him twice
		// the quotes he has — the one place where merging the roles can double
		// count, because a dialogue is the only quote that carries two.
		for _, name := range distinctCredits(seps, mr.director, actor) {
			people.quote(name, key, status)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	// Standalone quotes: ONE pass, not two, because there is no work table to
	// register first — the "works" are the occasions themselves, and an occasion
	// exists only because something was said on it. A speaker is to a quote what
	// an author is to a book, so both tallies count distinct occasions as their
	// works.
	//
	// A proverb contributes to neither: tallyMap.work drops an empty name, so a
	// quote with no speaker and no occasion falls out of the breakdown the same
	// way it falls out of the review deck.
	speakers := newTallyMap()
	rows, err = s.Store.DB.Query(`
		SELECT COALESCE(u.speaker,''), COALESCE(u.occasion,''),
		       r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result,''),
		       COALESCE(julianday('now') - julianday(u.created_at), 1e9)
		FROM utterances u
		LEFT JOIN item_reviews r ON r.kind = 'utterance' AND r.item_id = u.id
		WHERE u.user_id = ?`, reviewMinStability, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var speaker, occasion string
		var seen bool
		var stability, age float64
		var lr sql.NullString
		var lastResult string
		if err := rows.Scan(&speaker, &occasion, &seen, &stability, &lr, &lastResult, &age); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] breakdown quote row scan failed: %v", err)
			continue
		}
		status := recallStatus(seen, stability, elapsedDays(lr), age, lastResult)
		key := utteranceWorkKey(speaker, occasion)
		for _, sp := range metadata.SplitCredits(speaker, seps) {
			speakers.quote(sp, key, status)
			people.quote(sp, key, status)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	return map[string]statsKind{
		"authors":    authors.finish(),
		"books":      books.finish(),
		"series":     series.finish(),
		"films":      films.finish(),
		"shows":      shows.finish(),
		"directors":  directors.finish(),
		"actors":     actors.finish(),
		"characters": characters.finish(),
		"speakers":   speakers.finish(),
		"people":     people.finish(),
	}, nil
}

// distinctCredits folds several credit strings into one set of names, so a
// person credited twice on the same work is counted once.
//
// It exists for exactly one case and it is worth naming: a dialogue carries both
// a director and an actor, and those can be the same person. Every other quote
// kind has a single role attached, so the role tallies can each walk their own
// credit string without conflict — only the combined people map sees both at
// once.
// Keyed case-insensitively and returning the display spelling, because that is
// how tallyMap identifies a row. Keying on the exact string would let "Clint
// Eastwood" and "clint eastwood" through as two people and reintroduce the
// double count this exists to stop.
func distinctCredits(seps metadata.CreditSeps, credits ...string) map[string]string {
	out := map[string]string{}
	for _, c := range credits {
		for _, name := range metadata.SplitCredits(c, seps) {
			if name = strings.TrimSpace(name); name != "" {
				if k := strings.ToLower(name); out[k] == "" {
					out[k] = name
				}
			}
		}
	}
	return out
}

// yearBucket is one year on the timeline: how many works were first published
// or released in it, and how many quotes the library holds from those works.
type yearBucket struct {
	Year   int `json:"year"`
	Works  int `json:"works"`
	Quotes int `json:"quotes"`
}

// timelineYears returns one row per year the library actually touches, ordered.
//
// A quote is dated by the WORK it came from, not by when it was saved — the
// activity calendar already answers "when was I reading". This answers "how old
// is what I read", which for a library assembled around old books is a different
// and more interesting shape.
//
// Standalone quotes are dated by occasion_date, the only date they carry that is
// about the quote rather than about the saving of it. That column is a partial
// date stored as TEXT ('YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'), so the year comes off
// the front: substr(…, 1, 5) rather than 1, 4, because a BCE year carries a
// leading '-' and '-380' needs five characters. SQLite's CAST stops at the first
// non-digit, so '2019-' and '-380-' both land on the right number.
//
// Works with no year are simply absent. There is no "unknown" bucket, because a
// bar labelled "no year" sitting next to the 1920s invites reading it as a
// point in time, and it is not one — it is a gap in the catalogue.
func (s *Server) timelineYears(uid int64) ([]yearBucket, error) {
	rows, err := s.Store.DB.Query(`
		SELECT year, SUM(works) AS works, SUM(quotes) AS quotes FROM (
			SELECT published_year AS year, 1 AS works, 0 AS quotes
			  FROM books WHERE user_id = ? AND COALESCE(published_year, 0) <> 0
			UNION ALL
			SELECT release_year, 1, 0
			  FROM movies WHERE user_id = ? AND COALESCE(release_year, 0) <> 0
			UNION ALL
			SELECT b.published_year, 0, 1
			  FROM annotations a JOIN books b ON b.id = a.book_id
			 WHERE b.user_id = ? AND COALESCE(b.published_year, 0) <> 0
			UNION ALL
			SELECT m.release_year, 0, 1
			  FROM dialogues d JOIN movies m ON m.id = d.movie_id
			 WHERE m.user_id = ? AND COALESCE(m.release_year, 0) <> 0
			UNION ALL
			SELECT CAST(substr(occasion_date, 1, 5) AS INTEGER), 0, 1
			  FROM utterances
			 WHERE user_id = ? AND occasion_date <> ''
			   AND CAST(substr(occasion_date, 1, 5) AS INTEGER) <> 0
		)
		GROUP BY year ORDER BY year`, uid, uid, uid, uid, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []yearBucket{}
	for rows.Next() {
		var b yearBucket
		if err := rows.Scan(&b.Year, &b.Works, &b.Quotes); err != nil {
			olog.Warnf(olog.CodeStatsRowScan, "[stats] timeline row scan failed: %v", err)
			continue
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// favouritePerson is the person whose quotes you have hearted most.
//
// Not derivable from the breakdown: tallyMap counts quotes and recall states and
// has never carried favourites. And it cannot be a GROUP BY on the credit
// column, for the two reasons every people query here has to respect — a credit
// can name two people ("Gaiman & Pratchett"), and a dialogue can name the same
// person twice, as director and as actor. So the rows come back per quote and
// the splitting happens in Go, exactly as the breakdown does it.
func (s *Server) favouritePerson(uid int64, seps metadata.CreditSeps) (*statsTop, error) {
	counts := map[string]int{}
	display := map[string]string{}
	add := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		k := strings.ToLower(name)
		if display[k] == "" {
			display[k] = name
		}
		counts[k]++
	}

	// Books and standalone quotes carry one credit each.
	for _, q := range []string{
		`SELECT b.author FROM annotations a JOIN books b ON b.id = a.book_id
		  WHERE b.user_id = ? AND a.favorite = 1`,
		`SELECT speaker FROM utterances WHERE user_id = ? AND favorite = 1`,
	} {
		rows, err := s.Store.DB.Query(q, uid)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var credit sql.NullString
			if err := rows.Scan(&credit); err != nil {
				continue
			}
			for _, n := range metadata.SplitCredits(credit.String, seps) {
				add(n)
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}

	// A dialogue carries two, and they can be the same person.
	rows, err := s.Store.DB.Query(`
		SELECT COALESCE(m.director, ''), COALESCE(d.actor, '')
		  FROM dialogues d JOIN movies m ON m.id = d.movie_id
		 WHERE m.user_id = ? AND d.favorite = 1`, uid)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var director, actor string
		if err := rows.Scan(&director, &actor); err != nil {
			continue
		}
		for _, name := range distinctCredits(seps, director, actor) {
			add(name)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	best, bestKey := 0, ""
	for k, n := range counts {
		// Ties break on the name so the tile does not change on every reload for
		// a library where two people are level.
		if n > best || (n == best && k < bestKey) {
			best, bestKey = n, k
		}
	}
	if best == 0 {
		return nil, nil
	}
	return &statsTop{Title: display[bestKey], Count: best}, nil
}

// everyQuoteCreatedAt is one row per saved quote of any kind, carrying just the
// timestamp. Three aggregates bucket by it — the busiest month, the activity
// calendar, and "collecting since" — and each used to spell the union out
// again, so counting a new kind meant remembering it in three places. It
// returns its own arguments because each arm binds the user id separately, and
// a union whose arm count and argument count disagree fails at run time rather
// than compile time.
func everyQuoteCreatedAt(uid int64) (string, []any) {
	return `SELECT a.created_at FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
	        UNION ALL
	        SELECT d.created_at FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?
	        UNION ALL
	        SELECT u.created_at FROM utterances u WHERE u.user_id = ?`,
		[]any{uid, uid, uid}
}

// handleStats implements GET /stats (§10): user-scoped library counts plus
// three superlatives for the Settings page tiles. A fixed handful of
// aggregate queries — nothing per-row.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	// OPTIONAL, AND UTC WHEN ABSENT. The only thing the offset decides here is
	// which local day "today" is for the current streak, and every other number
	// on this page is timezone-free — so a caller that does not send one gets
	// the page it always got rather than a 400.
	offset, ok := tzOffset(r.URL.Query().Get("offset"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "offset must be UTC offset minutes between -720 and 840")
		return
	}
	olog.Tracef("[stats] handleStats uid=%v offset=%d", uid, offset)

	// Read up here, ahead of the local `type reviewDay struct` this function
	// declares further down for the activity series — which shadows the package
	// function of that name for the rest of the body.
	today, _, _ := reviewDay(offset)
	streak, err := s.dailyStreak(uid, today)
	if err != nil {
		internalError(w, r, "recall streak", err)
		return
	}
	longestStreak, err := s.longestDailyStreak(uid)
	if err != nil {
		internalError(w, r, "recall longest streak", err)
		return
	}

	// FOUR MORE COUNTS THAN THE CARDS NEED, and they are here rather than in four
	// endpoints of their own because the SHELL asks this question. The rail names
	// each destination with what is inside it — books and their highlights,
	// boards and their quotes, anthologies and the entries in them, tags and
	// stickers — and every one of those is a count(*) over an indexed user_id.
	// Adding them to a statement the app already runs on every load costs a
	// scan of four small tables; asking for them separately would have cost four
	// round trips, four handlers and four chances for the rail and the screen to
	// disagree about how many boards there are.
	//
	// `anthologies` IS NEW AND WAS ALREADY BEING READ. navBadge has had
	// `stats.anthologies != null` in it since the drawer was written, and this
	// endpoint has never sent the key — so the Anthologies row has worn no count
	// for its whole life, silently, because the guard reads absent as "do not
	// show one". The guard was right; the payload was missing.
	var books, annotations, movies, dialogues, quotes, tags, favorites int
	var boards, anthologies, anthologyQuotes, stickers int
	err = s.Store.DB.QueryRow(`
		SELECT
		  (SELECT count(*) FROM books WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?),
		  (SELECT count(*) FROM movies WHERE user_id = ?),
		  (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?),
		  (SELECT count(*) FROM utterances WHERE user_id = ?),
		  (SELECT count(*) FROM tags WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id
		     WHERE b.user_id = ? AND a.favorite = 1)
		+ (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		     WHERE m.user_id = ? AND d.favorite = 1)
		+ (SELECT count(*) FROM utterances WHERE user_id = ? AND favorite = 1),
		  (SELECT count(*) FROM boards WHERE user_id = ?),
		  (SELECT count(*) FROM anthologies WHERE user_id = ?),
		  -- anthology_entries carries no user_id of its own (0043): it is scoped
		  -- through its anthology, which is what this join is for.
		  (SELECT count(*) FROM anthology_entries e
		     JOIN anthologies a ON a.id = e.anthology_id WHERE a.user_id = ?),
		  (SELECT count(*) FROM stickers WHERE user_id = ?)`,
		uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid).
		Scan(&books, &annotations, &movies, &dialogues, &quotes, &tags, &favorites,
			&boards, &anthologies, &anthologyQuotes, &stickers)
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
		everyQuote, everyQuoteArgs := everyQuoteCreatedAt(uid)
		err := s.Store.DB.QueryRow(`
			SELECT substr(created_at, 1, 7) AS month, count(*)
			FROM (`+everyQuote+`)
			GROUP BY month ORDER BY count(*) DESC, month DESC LIMIT 1`, everyQuoteArgs...).
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

	// Daily activity (annotations + dialogues bucketed by created_at day) — drives
	// the Stats page's GitHub-style calendar. The window covers the widest the
	// calendar can render (~130 weeks on a wide desktop; see MAX_WEEKS in
	// StatsPage), not just 12 months, so older columns aren't blank on a wide
	// screen. Only days with saves are sent; the client zero-fills its week grid.
	type dayCount struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	daily := []dayCount{}
	activityQuery, activityArgs := everyQuoteCreatedAt(uid)
	arows, err := s.Store.DB.Query(`
		SELECT substr(created_at, 1, 10) AS day, count(*)
		FROM (`+activityQuery+`)
		WHERE created_at >= datetime('now', '-930 days')
		GROUP BY day ORDER BY day`, activityArgs...)
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
	//
	// `got` rides along so the day tooltip can report ACCURACY. A heatmap cell
	// coloured by volume answers "did I sit down that day" and nothing else —
	// twelve answers all wrong paints exactly like twelve all right — and the
	// ratio is the half of it worth knowing. It is a second column on a row
	// already being read, not a second query.
	//
	// Practice rows are the resettable tally (handlePracticeReset DELETEs them
	// outright), so a reset practice history simply returns no rows and the
	// calendar has nothing to describe. There is no stale-accuracy case to guard:
	// the numerator and the denominator leave together or not at all.
	type reviewDay struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
		Got   int    `json:"got"`
	}
	reviewSeries := func(mode string) ([]reviewDay, error) {
		out := []reviewDay{}
		rows, err := s.Store.DB.Query(`SELECT day, answered, got FROM quiz_sessions
			WHERE user_id = ? AND mode = ? AND answered > 0 AND day >= date('now','-930 days')
			ORDER BY day`, uid, mode)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var rd reviewDay
			if err := rows.Scan(&rd.Date, &rd.Count, &rd.Got); err != nil {
				olog.Warnf(olog.CodeStatsRowScan, "[stats] %s activity row scan failed: %v", mode, err)
				continue
			}
			out = append(out, rd)
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

	// Highlight-colour breakdown across every kind that wears one — annotations
	// since the beginning, dialogues since 0021, standalone quotes since 0026.
	// The card is headed "Highlight colours" and counts itself in "quotes", and
	// in this app a quote is any of the three.
	// Seeded from the set, so a colour added by a migration appears in the
	// breakdown at zero rather than being absent from it entirely.
	colors := map[string]int{}
	for _, c := range annotationColors {
		colors[c] = 0
	}
	if crows, err := s.Store.DB.Query(`
		SELECT color, count(*) FROM (
		  SELECT a.color FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?
		  UNION ALL
		  SELECT d.color FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?
		  UNION ALL
		  SELECT u.color FROM utterances u WHERE u.user_id = ?)
		GROUP BY color`, uid, uid, uid); err != nil {
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
			// += rather than =, so the tally survives a query shape that returns a
			// colour more than once. The allowlist keeps a value from outside the
			// four (a CHECK is per-table; this map is the one place they meet).
			if _, ok := colors[c]; ok {
				colors[c] += n
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
		  UNION ALL
		  SELECT ut.tag_id FROM utterance_tags ut
		    JOIN utterances u2 ON u2.id = ut.utterance_id WHERE u2.user_id = ?
		) u ON u.tag_id = t.id
		GROUP BY t.id ORDER BY c DESC, t.name LIMIT 50`, uid, uid, uid)
	if err != nil {
		internalError(w, r, "top tags", err)
		return
	}

	// Recall overview (the forgetting curve across the whole library): status
	// counts plus how many quotes have entered the schedule and their average
	// floored half-life — the Stats page "Memory" card.
	states, err := s.reviewStates(uid, allMedia())
	if err != nil {
		internalError(w, r, "recall states", err)
		return
	}
	// One ownership arm per kind, generated from the same descriptors the deck
	// uses. item_reviews is polymorphic and carries no user_id, so each kind has
	// to be traced back to its owner separately — and a kind missing from this
	// list would quietly shrink the average rather than fail.
	var arms []string
	var hlArgs []any
	for _, rs := range sourcesFor(allMedia()) {
		arms = append(arms, `(r.kind = '`+rs.kind+`' AND r.item_id IN
			(SELECT x.id FROM `+rs.from()+` WHERE `+rs.ownerCol()+` = ?))`)
		hlArgs = append(hlArgs, uid)
	}
	var reviewedN int
	var avgHalfLife float64
	if err := s.Store.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(AVG(MAX(r.stability, `+reviewFloorSQL+`)), 0) FROM item_reviews r
		WHERE `+strings.Join(arms, " OR "), hlArgs...).Scan(&reviewedN, &avgHalfLife); err != nil {
		internalError(w, r, "recall half-life", err)
		return
	}

	// Per-kind recall breakdown (authors · books · series · films · shows ·
	// directors · actors · speakers · people), multi-author credits split.
	breakdown, err := s.statsBreakdown(uid)
	if err != nil {
		internalError(w, r, "recall breakdown", err)
		return
	}

	// When the library's works are FROM, as opposed to when they were saved.
	timeline, err := s.timelineYears(uid)
	if err != nil {
		internalError(w, r, "timeline", err)
		return
	}
	favouritePerson, err := s.favouritePerson(uid, s.creditSeps(uid))
	if err != nil {
		internalError(w, r, "favourite person", err)
		return
	}

	// "Collecting since": the earliest saved quote/dialogue (date only, or null).
	var firstSaved *string
	{
		var fs sql.NullString
		firstQuery, firstArgs := everyQuoteCreatedAt(uid)
		err := s.Store.DB.QueryRow(`SELECT min(created_at) FROM (`+firstQuery+`)`, firstArgs...).Scan(&fs)
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
		"books":            books,
		"annotations":      annotations,
		"movies":           movies,
		"dialogues":        dialogues,
		"quotes":           quotes,
		"tags":             tags,
		"favorites":        favorites,
		"boards":           boards,
		"anthologies":      anthologies,
		"anthology_quotes": anthologyQuotes,
		"stickers":         stickers,
		"genres":           genres,
		"most_annotated":   mostAnnotated,
		"timeline":         timeline,
		"favourite_person": favouritePerson,
		"most_quoted":      mostQuoted,
		"busiest_month":    busiest,
		"daily_activity":   daily,
		"daily_quiz":       dailyQuiz,
		"daily_practice":   dailyPractice,
		"colors":           colors,
		"top_tags":         topTags,
		"first_saved":      firstSaved,
		"recall": map[string]any{
			"states":        states,
			"reviewed":      reviewedN,
			"avg_half_life": avgHalfLife,
			// BOTH STREAKS, because the longest one is not derivable from the
			// current one and is the number a reader measures themselves
			// against: a run that ended is invisible to the current figure by
			// construction. They travel together so the card can print one and
			// annotate it with the other.
			"streak":         streak,
			"longest_streak": longestStreak,
		},
		"breakdown": breakdown,
	})
}
