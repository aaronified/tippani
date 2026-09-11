package httpapi

import (
	"net/http"

	"tippani/internal/olog"
)

// GET /books/{id}/chapters — the chapters this book's own highlights already name.
//
// WHY AN ENDPOINT AND NOT A CLIENT-SIDE DERIVATION. The forms that need this — the
// capture surface and the highlight editor — could read `/annotations?book_id=N`
// and pull the chapter columns out of it, and that is what a first draft did. It
// fetches every quote of the book (a few hundred rows, each with its text, tags,
// sticker coordinates and review state) to offer a dozen strings in a dropdown, on
// a form whose whole point is being quick. This answers the actual question in a
// query that touches two columns.
//
// WHY PER BOOK AND NOT IN /search/vocabulary. The vocabulary endpoint is the
// reader's whole library, deliberately, because that is what the search box
// narrows over. A chapter name is not that kind of word: "The Whale" belongs to one
// book, and offering every chapter title in the library while typing a locator for
// THIS one would be a dropdown that is wrong far more often than it is right.
//
// THE PAIR TRAVELS TOGETHER, and that is the reason this returns objects rather
// than two lists of strings. 0044 split the chapter into a number and a name
// precisely because they are independent — a numbered novel fills one, an essay
// collection the other — but when a book has BOTH, they are a mapping the reader
// typed once and should not have to remember: choosing "The Whale" can fill 42
// beside it. A pair of parallel string lists cannot express that.
//
// EMPTY IS A LEGITIMATE ANSWER and is not an error: a book whose highlights carry
// no chapter at all answers `{"chapters":[]}`, and the form simply offers nothing.
//
// THE ORDER IS A SORT, AND IT USED TO BE A POPULARITY RANKING. `ORDER BY COUNT(*)
// DESC` put the chapter with the most highlights first, which reads as no order at
// all: the owner, from their phone, "the chapter no. combobox shows 6,2,14,1,12 on
// mobile (the list is fixed irrespective of page refresh)… can we give them a sort
// instead (numerical sort for numbers, ofc)". It was stable precisely because it
// was a real ranking — chapter 6 simply had the most highlights — and that is
// exactly why it looked arbitrary.
//
// THE SORT IS ENTRY ORDER, MOST RECENT FIRST, and the owner arrived at it after
// rejecting two others in turn: "should it not be the last chapter instead? as
// this is a entry aid?", then "better yet, use the entry order. that's the best.
// even works on rereads".
//
// IT IS THE ONLY ONE OF THE THREE THAT SURVIVES A REREAD, which is the whole
// argument. Highest-number-first answers "how far have I got" and is right until
// you go back: annotate chapter 3 of a book you have read to 14 and it offers 14,
// which is where you were months ago. Entry order offers 3, because 3 is what you
// were last typing — and on a first read the two agree anyway, since you enter
// chapters in the order you read them. A popularity ranking answered neither
// question and is what this replaced.
//
// BY `id` RATHER THAN BY `created_at`, and the difference is granularity: the
// timestamp is stored to the second, so every chapter captured in one sitting
// would tie and fall back to something arbitrary. `annotations.id` is INTEGER
// PRIMARY KEY — a rowid alias — so it is monotonic per insert and never ties.
// An import inserts in file order, which for a clippings file IS reading order,
// so a freshly imported book sorts by its last chapter without special-casing.
//
// AND THE NUMBER IS NOT A TIE-BREAK EITHER. There is nothing to break: no two
// rows of this GROUP BY can share a MAX(id).

type chapterOption struct {
	// The number as stored, and 0 for "no number" — the same spelling the column
	// uses. It is a float because 12.5 is where an interlude goes (0044).
	No   float64 `json:"no"`
	Name string  `json:"name"`
	// How many highlights already use this pair. NO LONGER THE SORT — see the
	// ORDER BY below — but still sent, because it is what tells a real chapter
	// from a one-off typo of one when the two sit next to each other.
	Count int `json:"count"`
}

func (s *Server) handleBookChapters(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	olog.Tracef("[book] handleBookChapters uid=%v book=%d", uid, id)

	// OWNERSHIP THROUGH THE PARENT, and a foreign book is a 404 rather than an
	// empty list: an empty list would be a working reply for a book that is not
	// this reader's, which is the difference between "you have no chapters" and
	// "there is no such book here".
	var one int
	if err := s.Store.DB.QueryRow(`SELECT 1 FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&one); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	rows, err := s.Store.DB.Query(`
		SELECT COALESCE(a.chapter_no, 0), COALESCE(a.chapter, ''), COUNT(*)
		FROM annotations a
		WHERE a.book_id = ?
		  AND (COALESCE(a.chapter, '') <> '' OR COALESCE(a.chapter_no, 0) <> 0)
		GROUP BY COALESCE(a.chapter_no, 0), COALESCE(a.chapter, '')
		ORDER BY MAX(a.id) DESC`, id)
	if err != nil {
		codedError(w, r, olog.CodeBookChapters, "list chapters", err)
		return
	}
	defer rows.Close()
	out := []chapterOption{}
	for rows.Next() {
		var c chapterOption
		if err := rows.Scan(&c.No, &c.Name, &c.Count); err != nil {
			codedError(w, r, olog.CodeBookChapters, "scan chapter", err)
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		codedError(w, r, olog.CodeBookChapters, "read chapters", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"chapters": out})
}

// GET /movies/{id}/packs — the DLC names this game's own lines already carry.
//
// IT LIVES IN THIS FILE BECAUSE IT IS THE SAME QUESTION. "What does this work
// already know about its own locators" has one answer per medium — a book's
// chapters, a game's packs — and every argument in the header above transfers
// word for word: it is a two-column query rather than a fetch of every line of
// the film; it is per work rather than library-wide, because "Blood and Wine"
// belongs to one game and offering every pack in the catalogue while typing a
// locator for THIS one would be wrong more often than right; and empty is a
// legitimate answer rather than an error.
//
// A LIST OF NAMES, NOT PAIRS, and that is the one place it differs. A chapter is a
// number and a name that mean each other, so choosing one can fill the other
// (0044). A pack is a name and nothing else — act and quest sit inside it and are
// not implied by it, since one expansion holds many quests. So there is no pairing
// to express and a flat list is the honest shape.
//
// GAMES ARE `movies` ROWS (0040), so the route is under /movies and the media type
// is not checked here: a film's lines carry no pack (normalizeLocator clears it),
// so a film simply answers an empty list. Refusing by media type would mean this
// endpoint had to be right about a fact the writer already enforces.

type packOption struct {
	Name string `json:"name"`
	// How many of this game's lines already name it. NOT the sort any more, for the
	// reason the chapter list gives — and the sort here is the SAME sort, entry
	// order, rather than the alphabetical one a pack's lack of a number first
	// suggested. "Which pack was I last taking lines from" is the question a
	// locator box is asking, and it is the same question on both mediums; two
	// answers to it would be this repo's "similar things behave similarly" broken
	// over a distinction that does not reach the reader.
	Count int `json:"count"`
}

func (s *Server) handleMoviePacks(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	olog.Tracef("[movie] handleMoviePacks uid=%v movie=%d", uid, id)

	// Ownership through the parent, and a foreign film is a 404 rather than an
	// empty list — see the chapters handler for why the difference matters.
	var one int
	if err := s.Store.DB.QueryRow(`SELECT 1 FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&one); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	rows, err := s.Store.DB.Query(`
		SELECT dlc, COUNT(*)
		FROM dialogues
		WHERE movie_id = ? AND dlc <> ''
		GROUP BY dlc
		ORDER BY MAX(id) DESC`, id)
	if err != nil {
		codedError(w, r, olog.CodeBookChapters, "list packs", err)
		return
	}
	defer rows.Close()
	out := []packOption{}
	for rows.Next() {
		var p packOption
		if err := rows.Scan(&p.Name, &p.Count); err != nil {
			codedError(w, r, olog.CodeBookChapters, "scan pack", err)
			return
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		codedError(w, r, olog.CodeBookChapters, "read packs", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"packs": out})
}
