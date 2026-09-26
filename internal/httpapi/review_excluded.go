package httpapi

import (
	"database/sql"
	"net/http"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// ── EVERY QUOTE YOU HAVE TOLD THE DECK TO SKIP, IN ONE PLACE.
//
// WHY IT NEEDS A SCREEN AT ALL. Excluding a quote is a decision made on the quote,
// one at a time, months apart, on a card the reader may never open again — and
// the only trace of it afterwards is a card that stops coming round. There was no
// way to ask "what have I excluded?", which makes the feature quietly unauditable:
// a deck that feels thin has either run out of material or been narrowed by
// twenty decisions the reader has forgotten, and nothing on screen tells them
// which. The v3 pack draws this as "Never asked about", grouped under each work.
//
// IT READS THE SAME FLAG THE DECK READS, through the same `reviewSource` table
// the deck's own queries are spliced from. The alternative — a query per quote
// kind written here — is how a list comes to disagree with the thing it claims to
// describe: a fourth quote kind added later reaches the deck through sourcesFor
// and would not reach this list at all.
//
// THE PARENT'S FLAG IS NOT READ HERE, for the reason review_handlers.go sets out
// at length: excluding a work WRITES the column onto its quotes rather than
// gating them at query time, so the flag on the row is the whole truth and a list
// built from it cannot show a quote whose exclusion the reader has no way to undo.

type excludedQuote struct {
	ID   int64  `json:"id"`
	Kind string `json:"kind"`
	Text string `json:"text"`
}

type excludedGroup struct {
	// WorkID is 0 for a standalone quote, which has no parent — the same asymmetry
	// every other part of the review code carries rather than inventing a parent
	// row to make the shape uniform.
	WorkID int64  `json:"work_id"`
	Kind   string `json:"kind"`
	Title  string `json:"title"`
	// ART AND CREDIT, so the list can be read as a shelf rather than as a column
	// of titles. The pack draws each work here with its cover or its poster and
	// the people behind it (settings-restructured.dc.html:2972-2981); the app drew
	// a mono label and nothing else, which is a list of strings where the reader
	// is being asked to recognise their own books.
	//
	// EMPTY IS THE HONEST ANSWER for a standalone quote and for a work with no
	// artwork — the client draws its own hatch rather than being sent a
	// placeholder path that does not resolve.
	Art string `json:"art"`
	// A NAME AND THE FACE THAT GOES WITH IT. This was a list of bare strings, so
	// every chip on the screen drew the grey stand-in — on a list whose whole
	// argument is that a reader should RECOGNISE their own shelf. The photograph
	// is already on the people row; nothing was asking for it.
	People []excludedPerson `json:"people"`
	// HOW MANY QUOTES THE WORK HAS, not how many are skipped. The row prints one
	// against the other — 27 skipped of 28 — and a fraction needs a denominator
	// that does not move when the reader puts one back. Counted over the same
	// table the excluded rows came out of, so a work whose quotes were all
	// skipped reads 28 of 28 rather than 28 of nothing.
	QuotesTotal int             `json:"quotes_total"`
	Quotes      []excludedQuote `json:"quotes"`
}

// A CREDIT AND ITS PHOTOGRAPH. `image_path` is empty for a name nobody has
// fetched yet, which is the honest answer and the one the client already draws a
// stand-in for.
type excludedPerson struct {
	Name      string `json:"name"`
	ImagePath string `json:"image_path"`
}

// creditNames — a credit column into at most two names.
//
// IT IS THE REPO'S OWN SPLITTER AND NOT A FOURTH COPY OF THE RULE. This function
// used to split on comma, semicolon and ampersand by hand, with a comment arguing
// that honouring `creditSeparators` would load a preference into a list endpoint
// that needs none. The argument was wrong twice over, and a rating measured both:
// "Martin Luther King, Jr." came back as two chips, the second of them "Jr.", and
// "Gaiman and Pratchett" came back as one. Every chip on this screen is a DOOR
// onto a person, so a bad split is not a cosmetic miss — it is a press that opens
// a record for somebody who does not exist.
//
// `metadata.SplitCredits` already answers all of it: the suffix table that
// re-attaches Jr., Sr., III and Inc.; " and " splitting only in list context or
// between two full names; "et al" dropped; case-insensitive dedupe. It is the
// same function the credits table, the cast builder and the character console
// call, and `people.jsx` mirrors it deliberately — a fifth copy here is exactly
// what that lockstep exists to prevent.
//
// TWO IS STILL THE CEILING, because the row it lands in is a phone's width. A
// work with four authors shows two; the count is not printed, because "and 2
// more" in a chip row is a chip that answers nothing.
func creditNames(credit string, seps metadata.CreditSeps) []string {
	all := metadata.SplitCredits(credit, seps)
	if len(all) > 2 {
		return all[:2]
	}
	return all
}

// excludedFrom lists one source's excluded rows, newest work first. The text is
// truncated by the CLIENT and not here: a row is a quote and the screen decides
// how much of one it can draw, which is the difference between a list that can be
// redesigned and a list whose shape is baked into a handler.
func (s *Server) excludedFrom(uid int64, rs reviewSource, seps metadata.CreditSeps) ([]excludedGroup, error) {
	// WHICH COLUMNS HOLD THE ART AND THE CREDIT, named per source rather than
	// guessed from the table: a book has a cover and an author, a film has a
	// poster and a director, and a standalone quote has neither. They are
	// hard-coded here beside the sources they belong to rather than added to
	// `reviewSource`, because this is the only reader of them — a field on the
	// shared struct would be four sources carrying two columns for one caller.
	art, credit := "", ""
	switch rs.parent {
	case "books":
		art, credit = "p.cover_path", "p.author"
	case "movies":
		art, credit = "p.poster_path", "p.director"
	}
	var q string
	if rs.parent == "" {
		// A standalone quote's speaker is the nearest thing it has to a credit, and
		// it has no artwork at all. Its own total is 1: it IS the work, so a
		// fraction here can only ever read one of one.
		q = `SELECT 0, COALESCE(x.work_title, ''), '', COALESCE(x.speaker, ''), 1, x.id,
		            COALESCE(NULLIF(x.quote, ''), COALESCE(x.note, ''))
		     FROM ` + rs.table + ` x
		     WHERE x.user_id = ? AND COALESCE(x.review_excluded, 0) = 1
		     ORDER BY x.id DESC`
	} else {
		// THE WORK'S WHOLE COUNT, correlated on the parent rather than joined:
		// the outer query is already filtered to excluded rows, so a GROUP BY
		// here would count what is left rather than what there is.
		q = `SELECT p.id, COALESCE(p.title, ''), COALESCE(` + art + `, ''), COALESCE(` + credit + `, ''),
		            (SELECT COUNT(*) FROM ` + rs.table + ` t WHERE t.` + rs.parentKey + ` = p.id), x.id,
		            COALESCE(NULLIF(x.quote, ''), COALESCE(x.note, ''))
		     FROM ` + rs.table + ` x JOIN ` + rs.parent + ` p ON p.id = x.` + rs.parentKey + `
		     WHERE p.user_id = ? AND COALESCE(x.review_excluded, 0) = 1
		     ORDER BY p.title COLLATE NOCASE, x.id`
	}
	rows, err := s.Store.DB.Query(q, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Grouped here rather than by the client, because the grouping is what the
	// screen IS — "under its work" is the pack's phrase — and a client that
	// regrouped a flat list would be the second place that decides what a work is.
	var out []excludedGroup
	byWork := map[int64]int{}
	for rows.Next() {
		var workID, id int64
		var whole int
		var title, art, credit, text string
		if err := rows.Scan(&workID, &title, &art, &credit, &whole, &id, &text); err != nil {
			return nil, err
		}
		// A standalone quote groups by ITSELF rather than by work 0: they have no
		// parent in common, and folding them into one group called "" would claim
		// they do.
		key := workID
		if rs.parent == "" {
			key = -id
		}
		at, seen := byWork[key]
		if !seen {
			people := make([]excludedPerson, 0, 2)
			// SPLIT HERE RATHER THAN ON THE SCREEN. A credit column holds one
			// string with the reader's own separators in it, and the client
			// already has a setting for what those are — but this list is the
			// one place that would have to learn it a second time. Two names
			// is the honest ceiling for a chip row on a phone.
			for _, n := range creditNames(credit, seps) {
				people = append(people, excludedPerson{Name: n})
			}
			out = append(out, excludedGroup{
				WorkID: workID, Kind: rs.kind, Title: title, Art: art,
				People: people, QuotesTotal: whole,
			})
			at = len(out) - 1
			byWork[key] = at
		}
		out[at].Quotes = append(out[at].Quotes, excludedQuote{ID: id, Kind: rs.kind, Text: text})
	}
	return out, rows.Err()
}

// handleReviewExcluded — GET /review/excluded.
//
// EVERY SOURCE, NOT THE READER'S CURRENT SCOPE. `sourcesFor` narrows the deck to
// the media a reader draws from, and narrowing this list the same way would hide
// exclusions on a medium they have switched off — which is precisely the state
// where a forgotten exclusion is hardest to find and most confusing to meet again
// later.
func (s *Server) handleReviewExcluded(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	// READ ONCE, FOR ALL THREE SOURCES. The reader's separators are one fact
	// about them, not one per quote kind.
	seps := s.creditSeps(s.Store.DB, uid)
	var groups []excludedGroup
	for _, rs := range []reviewSource{bookSource(), screenSource(), utteranceSource()} {
		got, err := s.excludedFrom(uid, rs, seps)
		if err != nil && err != sql.ErrNoRows {
			writeErr(w, http.StatusInternalServerError, "could not read what is excluded")
			return
		}
		groups = append(groups, got...)
	}
	if groups == nil {
		groups = []excludedGroup{}
	}
	s.fillExcludedFaces(uid, groups)
	n := 0
	for _, g := range groups {
		n += len(g.Quotes)
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": groups, "total": n})
}

// fillExcludedFaces — the photograph for every credited name on the list, in one
// query.
//
// ONE QUERY FOR THE WHOLE LIST, not one per group. A reader with forty skipped
// quotes across a dozen works has at most two dozen distinct names, and asking
// the people table twelve times for what is one `IN` is the shape of thing that
// turns a settings screen into a slow one.
//
// A NAME WITH NO ROW KEEPS ITS EMPTY PATH, which is not a failure: a credit is a
// string on the work until somebody fetches the person behind it, and the chip
// draws its own stand-in. Matching is by name because that is the only key a
// credit column has — the same join `cast.go` and the anthology screen make.
func (s *Server) fillExcludedFaces(uid int64, groups []excludedGroup) {
	want := map[string]bool{}
	for _, g := range groups {
		for _, p := range g.People {
			if p.Name != "" {
				want[p.Name] = true
			}
		}
	}
	if len(want) == 0 {
		return
	}
	args := []any{uid}
	for name := range want {
		args = append(args, name)
	}
	rows, err := s.Store.DB.Query(
		`SELECT name, COALESCE(image_path, '') FROM people WHERE user_id = ? AND name IN (`+
			strings.TrimSuffix(strings.Repeat("?,", len(want)), ",")+`)`, args...)
	if err != nil {
		// THE LIST IS STILL WORTH DRAWING WITHOUT FACES. This is decoration on a
		// screen whose subject is the quotes, so a failure here dims the chips
		// rather than failing the request.
		olog.Warnf(olog.CodeReviewFacesQuery, "[review] could not read faces for the skipped list: %v", err)
		return
	}
	defer rows.Close()
	faces := map[string]string{}
	for rows.Next() {
		var name, path string
		if err := rows.Scan(&name, &path); err != nil {
			continue
		}
		faces[name] = path
	}
	for i := range groups {
		for j := range groups[i].People {
			groups[i].People[j].ImagePath = faces[groups[i].People[j].Name]
		}
	}
}
