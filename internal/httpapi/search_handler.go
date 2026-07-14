package httpapi

import (
	"database/sql"
	"net/http"
	"strconv"

	"tippani/internal/olog"
	"tippani/internal/search"
)

type bookHit struct {
	ID            int64    `json:"id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	CoverPath     string   `json:"cover_path"`
	Genres        []string `json:"genres"` // array, matching GET /books (the UI maps over it)
	PublishedYear int      `json:"published_year"`
	Series        string   `json:"series"`
	SeriesIndex   float64  `json:"series_index"`
}

type annotationHit struct {
	ID            int64  `json:"id"`
	BookID        int64  `json:"book_id"`
	BookTitle     string `json:"book_title"`
	BookCoverPath string `json:"book_cover_path"` // group header art (§ search grouping)
	// Parent-book fields, so an annotation-only group (a book matched purely via
	// its annotations) can still be grouped by author/decade/series/genre.
	BookAuthor string   `json:"book_author"`
	BookYear   int      `json:"book_published_year"`
	BookSeries string   `json:"book_series"`
	BookGenres []string `json:"book_genres"`
	Quote      string   `json:"quote"`
	Note       string   `json:"note"`
}

type movieHit struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Director    string   `json:"director"`
	ReleaseYear int      `json:"release_year"`
	PosterPath  string   `json:"poster_path"`
	Genres      []string `json:"genres"`
	Series      string   `json:"series"`
	SeriesIndex float64  `json:"series_index"`
}

type dialogueHit struct {
	ID              int64  `json:"id"`
	MovieID         int64  `json:"movie_id"`
	MovieTitle      string `json:"movie_title"`
	MoviePosterPath string `json:"movie_poster_path"` // group header art
	// Parent-movie fields, mirroring annotationHit — so a dialogue-only group
	// still groups by director/decade/series/genre.
	MovieDirector string   `json:"movie_director"`
	MovieYear     int      `json:"movie_release_year"`
	MovieSeries   string   `json:"movie_series"`
	MovieGenres   []string `json:"movie_genres"`
	Quote         string   `json:"quote"`
	Character     string   `json:"character"`
	Actor         string   `json:"actor"`
	Timestamp     string   `json:"timestamp"`
}

// handleSearch implements
// GET /search?q=&scope=all|books|annotations|movies|dialogues&limit=
// (PLAN §4). Structured filters (tag/color/book_id/movie_id) live on the
// list endpoints instead — not duplicated here (KISS).
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeErr(w, http.StatusBadRequest, "q is required")
		return
	}
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "all"
	}
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}

	// PrefixQuery (not Query) so every token matches as a prefix — this is a
	// typeahead search box, so "shaws" finds "shawshank" and "shaw red" finds
	// "Shawshank Redemption" (PLAN §4). Still escaped/quoted per-token; raw
	// input never reaches MATCH.
	match := search.PrefixQuery(q)
	uid := userID(r)
	olog.Tracef("[search] handleSearch uid=%d scope=%q q=%q limit=%d", uid, scope, q, limit)
	resp := struct {
		Books       []bookHit       `json:"books"`
		Annotations []annotationHit `json:"annotations"`
		Movies      []movieHit      `json:"movies"`
		Dialogues   []dialogueHit   `json:"dialogues"`
	}{
		Books: []bookHit{}, Annotations: []annotationHit{},
		Movies: []movieHit{}, Dialogues: []dialogueHit{},
	}

	wantBooks := scope == "all" || scope == "books"
	wantAnnotations := scope == "all" || scope == "annotations"
	wantMovies := scope == "all" || scope == "movies"
	wantDialogues := scope == "all" || scope == "dialogues"

	if wantBooks {
		rows, err := s.ftsQuery("books_fts", `
			SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.cover_path, ''),
			       COALESCE(b.published_year, 0), COALESCE(b.series, ''), COALESCE(b.series_index, 0)
			FROM books_fts
			JOIN books b ON b.id = books_fts.rowid
			WHERE books_fts MATCH ? AND b.user_id = ?
			ORDER BY bm25(books_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			internalError(w, r, "search books", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			h := bookHit{Genres: []string{}}
			if err := rows.Scan(&h.ID, &h.Title, &h.Author, &h.CoverPath,
				&h.PublishedYear, &h.Series, &h.SeriesIndex); err != nil {
				olog.Warnf(olog.CodeSearchRowScan, "[search] book result row scan failed: %v", err)
				continue
			}
			resp.Books = append(resp.Books, h)
		}
		rows.Close()
	}

	if wantAnnotations {
		rows, err := s.ftsQuery("annotations_fts", `
			SELECT a.id, a.book_id, b.title, COALESCE(b.cover_path, ''),
			       COALESCE(a.quote, ''), COALESCE(a.note, ''),
			       COALESCE(b.author, ''), COALESCE(b.published_year, 0), COALESCE(b.series, '')
			FROM annotations_fts
			JOIN annotations a ON a.id = annotations_fts.rowid
			JOIN books b ON b.id = a.book_id
			WHERE annotations_fts MATCH ? AND b.user_id = ?
			ORDER BY bm25(annotations_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			internalError(w, r, "search annotations", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			h := annotationHit{BookGenres: []string{}}
			if err := rows.Scan(&h.ID, &h.BookID, &h.BookTitle, &h.BookCoverPath, &h.Quote, &h.Note,
				&h.BookAuthor, &h.BookYear, &h.BookSeries); err != nil {
				olog.Warnf(olog.CodeSearchRowScan, "[search] annotation result row scan failed: %v", err)
				continue
			}
			resp.Annotations = append(resp.Annotations, h)
		}
		rows.Close()
	}

	if wantMovies {
		rows, err := s.ftsQuery("movies_fts", `
			SELECT m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0),
			       COALESCE(m.poster_path, ''), COALESCE(m.series, ''), COALESCE(m.series_index, 0)
			FROM movies_fts
			JOIN movies m ON m.id = movies_fts.rowid
			WHERE movies_fts MATCH ? AND m.user_id = ?
			ORDER BY bm25(movies_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			internalError(w, r, "search movies", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			h := movieHit{Genres: []string{}}
			if err := rows.Scan(&h.ID, &h.Title, &h.Director, &h.ReleaseYear, &h.PosterPath,
				&h.Series, &h.SeriesIndex); err != nil {
				olog.Warnf(olog.CodeSearchRowScan, "[search] movie result row scan failed: %v", err)
				continue
			}
			resp.Movies = append(resp.Movies, h)
		}
		rows.Close()
	}

	if wantDialogues {
		rows, err := s.ftsQuery("dialogues_fts", `
			SELECT d.id, d.movie_id, m.title, COALESCE(m.poster_path, ''), d.quote,
			       COALESCE(d.character, ''), COALESCE(d.actor, ''), COALESCE(d.timestamp, ''),
			       COALESCE(m.director, ''), COALESCE(m.release_year, 0), COALESCE(m.series, '')
			FROM dialogues_fts
			JOIN dialogues d ON d.id = dialogues_fts.rowid
			JOIN movies m ON m.id = d.movie_id
			WHERE dialogues_fts MATCH ? AND m.user_id = ?
			ORDER BY bm25(dialogues_fts)
			LIMIT ?`, match, uid, limit)
		if err != nil {
			internalError(w, r, "search dialogues", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			h := dialogueHit{MovieGenres: []string{}}
			if err := rows.Scan(&h.ID, &h.MovieID, &h.MovieTitle, &h.MoviePosterPath, &h.Quote,
				&h.Character, &h.Actor, &h.Timestamp,
				&h.MovieDirector, &h.MovieYear, &h.MovieSeries); err != nil {
				olog.Warnf(olog.CodeSearchRowScan, "[search] dialogue result row scan failed: %v", err)
				continue
			}
			resp.Dialogues = append(resp.Dialogues, h)
		}
		rows.Close()
	}

	// Genre names as arrays (genre_text is space-joined and can't be split
	// safely — names contain spaces). One map per kind, applied to both the
	// parent hits and the child hits so grouping-by-genre works on every group.
	if wantBooks || wantAnnotations {
		if byBook, err := s.genreNames(uid, "book"); err == nil {
			for i := range resp.Books {
				if gs := byBook[resp.Books[i].ID]; gs != nil {
					resp.Books[i].Genres = gs
				}
			}
			for i := range resp.Annotations {
				if gs := byBook[resp.Annotations[i].BookID]; gs != nil {
					resp.Annotations[i].BookGenres = gs
				}
			}
		}
	}
	if wantMovies || wantDialogues {
		if byMovie, err := s.genreNames(uid, "movie"); err == nil {
			for i := range resp.Movies {
				if gs := byMovie[resp.Movies[i].ID]; gs != nil {
					resp.Movies[i].Genres = gs
				}
			}
			for i := range resp.Dialogues {
				if gs := byMovie[resp.Dialogues[i].MovieID]; gs != nil {
					resp.Dialogues[i].MovieGenres = gs
				}
			}
		}
	}

	olog.Tracef("[search] handleSearch uid=%d results books=%d annotations=%d movies=%d dialogues=%d",
		uid, len(resp.Books), len(resp.Annotations), len(resp.Movies), len(resp.Dialogues))
	writeJSON(w, http.StatusOK, resp)
}

// ftsQuery runs an FTS5 MATCH query and, if it fails, reconstructs the given
// external-content index once and retries. These indexes (books_fts, …) are kept
// in sync by triggers but can still end up corrupt — a NULL-vs-'' drift between
// what a row was indexed with and what a delete/update trigger passes, or genuine
// page-level damage from an unclean shutdown — which surfaces only at query time
// as "database disk image is malformed" and turned every search into an opaque
// 500.
//
// Recovery mirrors the startup path (store.RepairFTS): RepairIndex does a
// DROP + recreate + rebuild, which discards the corrupt shadow pages instead of
// re-reading them. This matters because a bare 'rebuild' has to read the same bad
// %_data b-tree to clear it, so on page-level corruption it re-hits SQLITE_CORRUPT
// and can't self-heal — which is exactly what the old code did and why searches
// stayed broken until a restart. RepairIndex serializes with any concurrent
// search's repair (and with admin reindex / startup repair) via the store lock,
// so two corrupt-index queries don't race on the DROP.
func (s *Server) ftsQuery(ftsTable, query string, args ...any) (*sql.Rows, error) {
	rows, err := s.Store.DB.Query(query, args...)
	if err == nil {
		return rows, nil
	}
	olog.Warnf(olog.CodeSearchQuery, "%s query failed (%v); reconstructing index and retrying", ftsTable, err)
	if rbErr := s.Store.RepairIndex(ftsTable); rbErr != nil {
		olog.Errorf(olog.CodeSearchRepair, "%s reconstruction failed: %v — restart the server or run Profile → Rebuild search index to fully recover", ftsTable, rbErr)
		return nil, err
	}
	olog.Printf("[search] %s reconstructed; retrying query", ftsTable)
	return s.Store.DB.Query(query, args...)
}
