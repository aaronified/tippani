package httpapi

import (
	"database/sql"
	"net/http"
	"strings"
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
	WorkID int64 `json:"work_id"`
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
	Art    string          `json:"art"`
	People []string        `json:"people"`
	Quotes []excludedQuote `json:"quotes"`
}

// creditNames — a credit column into at most two names.
//
// IT SPLITS ON THE COMMON THREE AND NOT ON THE READER'S OWN SETTING, which is a
// deliberate narrowing. `creditSeparators` is a preference because a library can
// hold names that contain a comma ("Rowling, J. K.") and the reader knows which
// their shelf uses; honouring it here would mean loading a preference into a list
// endpoint that otherwise needs none. What this feeds is a row of chips under a
// title — a hint at who wrote the thing, not the canonical credit — so the cost
// of splitting a name that holds a comma is one chip too many on one row, and the
// work's own page still shows it whole.
//
// TWO IS THE CEILING because the row it lands in is a phone's width. A work with
// four authors shows two; the count is not printed, because "and 2 more" in a
// chip row is a chip that answers nothing.
func creditNames(credit string) []string {
	if strings.TrimSpace(credit) == "" {
		return nil
	}
	parts := strings.FieldsFunc(credit, func(r rune) bool {
		return r == ',' || r == ';' || r == '&'
	})
	out := make([]string, 0, 2)
	for _, p := range parts {
		if n := strings.TrimSpace(p); n != "" {
			out = append(out, n)
			if len(out) == 2 {
				break
			}
		}
	}
	return out
}

// excludedFrom lists one source's excluded rows, newest work first. The text is
// truncated by the CLIENT and not here: a row is a quote and the screen decides
// how much of one it can draw, which is the difference between a list that can be
// redesigned and a list whose shape is baked into a handler.
func (s *Server) excludedFrom(uid int64, rs reviewSource) ([]excludedGroup, error) {
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
		// it has no artwork at all.
		q = `SELECT 0, COALESCE(x.work_title, ''), '', COALESCE(x.speaker, ''), x.id,
		            COALESCE(NULLIF(x.quote, ''), COALESCE(x.note, ''))
		     FROM ` + rs.table + ` x
		     WHERE x.user_id = ? AND COALESCE(x.review_excluded, 0) = 1
		     ORDER BY x.id DESC`
	} else {
		q = `SELECT p.id, COALESCE(p.title, ''), COALESCE(` + art + `, ''), COALESCE(` + credit + `, ''), x.id,
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
		var title, art, credit, text string
		if err := rows.Scan(&workID, &title, &art, &credit, &id, &text); err != nil {
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
			out = append(out, excludedGroup{
				WorkID: workID, Kind: rs.kind, Title: title, Art: art,
				// SPLIT HERE RATHER THAN ON THE SCREEN. A credit column holds one
				// string with the reader's own separators in it, and the client
				// already has a setting for what those are — but this list is the
				// one place that would have to learn it a second time. Two names
				// is the honest ceiling for a chip row on a phone.
				People: creditNames(credit),
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
	var groups []excludedGroup
	for _, rs := range []reviewSource{bookSource(), screenSource(), utteranceSource()} {
		got, err := s.excludedFrom(uid, rs)
		if err != nil && err != sql.ErrNoRows {
			writeErr(w, http.StatusInternalServerError, "could not read what is excluded")
			return
		}
		groups = append(groups, got...)
	}
	if groups == nil {
		groups = []excludedGroup{}
	}
	n := 0
	for _, g := range groups {
		n += len(g.Quotes)
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": groups, "total": n})
}
