package httpapi

// Themed practice — "quiz me on this book / film / tag / colour / person".
//
// WHERE THE CLAUSE GOES IS THE WHOLE RISK, and it is not reviewSource.where().
// Five queries splice that string, and two of them are Daily's own:
// dailyRemaining, which decides the badge, and reviewStates, which draws the
// "where you stand" row. A theme added there would narrow both — so opening a
// themed round would change the number of cards the app said were due today, in
// the same commit whose stated constraint is that Daily is not themeable.
//
// So a theme is its own clause, threaded through the candidate queries only, and
// deckCandidates takes it as an explicit argument. handleDailyQuiz has to pass
// reviewTheme{} by name, which makes "Daily is not themeable" a line somebody
// can read rather than an omission nobody notices.
//
// DAILY IS NOT THEMEABLE, and that is a decision rather than an oversight. The
// daily deck IS the schedule: filtering it would mean the cards that are
// actually due go unasked while the streak still counts them as a day cleared,
// which quietly turns the one authoritative surface into a second practice mode.

import (
	"net/url"
	"strconv"
	"strings"
)

// reviewTheme is what a themed round is about. Zero value means "everything",
// which is what Practice has always done and what Daily is fixed at.
type reviewTheme struct {
	tag    string
	colour string
	person string // author, actor, speaker or director — matched across all of them
	book   int64
	movie  int64
}

func (t reviewTheme) any() bool {
	return t.tag != "" || t.colour != "" || t.person != "" || t.book != 0 || t.movie != 0
}

// parseReviewTheme reads the theme off a query string. Unknown values are not
// errors — an empty theme is a full round, which is the behaviour every existing
// client already gets.
func parseReviewTheme(q url.Values) reviewTheme {
	var t reviewTheme
	t.tag = strings.TrimSpace(q.Get("tag"))
	t.colour = strings.TrimSpace(q.Get("color"))
	t.person = strings.TrimSpace(q.Get("person"))
	if n, err := strconv.ParseInt(q.Get("book"), 10, 64); err == nil {
		t.book = n
	}
	if n, err := strconv.ParseInt(q.Get("movie"), 10, 64); err == nil {
		t.movie = n
	}
	return t
}

// clause is the theme's SQL for ONE source, or ("", nil) when this theme cannot
// apply to this kind.
//
// `excluded` is the second return: true when the theme is about something this
// kind cannot have, so the caller can drop the kind entirely rather than run a
// query that will match everything. "Quiz me on this book" over film lines must
// return no film lines — not all of them, which is what an ignored clause would
// do, and which is the failure this file's neighbours keep warning about.
func (t reviewTheme) clause(rs reviewSource) (string, []any, bool) {
	var sql strings.Builder
	var args []any

	if t.book != 0 {
		if rs.kind != kindBook {
			return "", nil, true
		}
		sql.WriteString(" AND x.book_id = ?")
		args = append(args, t.book)
	}
	if t.movie != 0 {
		if rs.kind != kindScreen {
			return "", nil, true
		}
		sql.WriteString(" AND x.movie_id = ?")
		args = append(args, t.movie)
	}
	if t.colour != "" {
		// Every kind of quote carries a colour, so this one never excludes a kind.
		sql.WriteString(" AND x.color = ?")
		args = append(args, t.colour)
	}
	if t.tag != "" {
		// Tags are a join table per kind, named for the kind rather than shared.
		sql.WriteString(` AND EXISTS (SELECT 1 FROM ` + rs.tagJoin + ` tj
		                              JOIN tags tg ON tg.id = tj.tag_id
		                              WHERE tj.` + rs.tagKey + ` = x.id AND lower(tg.name) = lower(?))`)
		args = append(args, t.tag)
	}
	if t.person != "" {
		// ONE FIELD, MANY ROLES. "Quiz me on Austen" and "quiz me on Bogart" are
		// the same request, and which column answers it depends on the kind: a
		// book has an author, a film line has an actor and its film a director, a
		// standalone quote has a speaker. Asking the caller to know which would
		// push a per-kind branch into every entry point.
		switch rs.kind {
		case kindBook:
			sql.WriteString(" AND lower(COALESCE(p.author,'')) LIKE lower(?)")
			args = append(args, "%"+t.person+"%")
		case kindScreen:
			sql.WriteString(" AND (lower(COALESCE(x.actor,'')) LIKE lower(?) OR lower(COALESCE(p.director,'')) LIKE lower(?))")
			args = append(args, "%"+t.person+"%", "%"+t.person+"%")
		case kindUtterance:
			sql.WriteString(" AND lower(COALESCE(x.speaker,'')) LIKE lower(?)")
			args = append(args, "%"+t.person+"%")
		}
	}
	return sql.String(), args, false
}
