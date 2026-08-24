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

type chapterOption struct {
	// The number as stored, and 0 for "no number" — the same spelling the column
	// uses. It is a float because 12.5 is where an interlude goes (0044).
	No   float64 `json:"no"`
	Name string  `json:"name"`
	// How many highlights already use this pair. The form sorts by it, so the
	// chapter you are working through is near the top rather than alphabetically
	// buried, and a one-off typo sinks instead of sitting next to the real name.
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
		ORDER BY COUNT(*) DESC, COALESCE(a.chapter_no, 0), COALESCE(a.chapter, '')`, id)
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
