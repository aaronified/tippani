package httpapi

import (
	"archive/zip"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// Export (PLAN §6b): Obsidian-friendly markdown. One renderer, three
// endpoints. A book export is valid §5b(a) importer input, so re-importing
// one is a dedupe no-op (movie exports are export-only — no importer).

func (s *Server) handleExportBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid book id")
		return
	}
	olog.Tracef("[export] handleExportBook uid=%v id=%v", userID(r), id)
	b, err := s.fetchBook(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "book not found")
		return
	case err != nil:
		internalError(w, r, "fetch book", err)
		return
	}
	md, err := s.renderBookExport(b)
	if err != nil {
		internalError(w, r, "render book export", err)
		return
	}
	serveMarkdown(w, sanitizeFilename(b.Title)+".md", md)
}

func (s *Server) handleExportMovie(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	olog.Tracef("[export] handleExportMovie uid=%v id=%v", userID(r), id)
	m, err := s.fetchMovie(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		internalError(w, r, "fetch movie", err)
		return
	}
	md, err := s.renderMovieExport(m)
	if err != nil {
		internalError(w, r, "render movie export", err)
		return
	}
	serveMarkdown(w, sanitizeFilename(m.Title)+".md", md)
}

// handleExportAll zips every book and movie the user owns as
// books/<title>.md + movies/<title>.md. Rendered up front so errors can
// still answer 500 before any zip bytes go out.
func (s *Server) handleExportAll(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[export] handleExportAll uid=%v", uid)
	type entry struct{ name, body string }
	var entries []entry
	used := map[string]bool{}
	for _, kind := range []string{"books", "movies"} {
		ids, err := s.ownedIDs(uid, kind)
		if err != nil {
			internalError(w, r, "list owned ids", err)
			return
		}
		for _, id := range ids {
			var title, md string
			if kind == "books" {
				b, ferr := s.fetchBook(uid, id)
				if ferr == nil {
					title = b.Title
					md, ferr = s.renderBookExport(b)
				}
				err = ferr
			} else {
				m, ferr := s.fetchMovie(uid, id)
				if ferr == nil {
					title = m.Title
					md, ferr = s.renderMovieExport(m)
				}
				err = ferr
			}
			if err != nil {
				internalError(w, r, "render export", err)
				return
			}
			entries = append(entries, entry{zipName(used, kind, title), md})
		}
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="tippani-export.zip"`)
	zw := zip.NewWriter(w)
	for _, e := range entries {
		f, err := zw.Create(e.name)
		if err != nil {
			return // headers already sent; the client sees a truncated zip
		}
		if _, err := f.Write([]byte(e.body)); err != nil {
			return
		}
	}
	_ = zw.Close()
}

// handleExportBooks renders a chosen set of books — the in-view/filtered set
// the UI passes, or all when ids is empty — as ONE multi-book markdown file.
// Each book keeps its own "---" frontmatter block, so the file re-imports as
// many books (multi-book import). Missing/unowned ids are skipped.
func (s *Server) handleExportBooks(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[export] handleExportBooks")
	s.exportSet(w, r, "books", "tippani-books.md")
}

// handleExportMovies is the movie/show counterpart (dialogue exports).
func (s *Server) handleExportMovies(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[export] handleExportMovies")
	s.exportSet(w, r, "movies", "tippani-titles.md")
}

func (s *Server) exportSet(w http.ResponseWriter, r *http.Request, kind, filename string) {
	uid := userID(r)
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	ids := body.IDs
	if len(ids) == 0 {
		var err error
		if ids, err = s.ownedIDs(uid, kind); err != nil {
			internalError(w, r, "list owned ids", err)
			return
		}
	}
	var sb strings.Builder
	n := 0
	for _, id := range ids {
		var md string
		if kind == "books" {
			b, err := s.fetchBook(uid, id)
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			if err == nil {
				md, err = s.renderBookExport(b)
			}
			if err != nil {
				internalError(w, r, "render book export", err)
				return
			}
		} else {
			m, err := s.fetchMovie(uid, id)
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			if err == nil {
				md, err = s.renderMovieExport(m)
			}
			if err != nil {
				internalError(w, r, "render movie export", err)
				return
			}
		}
		if n > 0 {
			sb.WriteString("\n\n")
		}
		sb.WriteString(md)
		n++
	}
	serveMarkdown(w, filename, sb.String())
}

func (s *Server) ownedIDs(uid int64, table string) ([]int64, error) {
	rows, err := s.Store.DB.Query(
		`SELECT id FROM `+table+` WHERE user_id = ? ORDER BY id`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] ownedIDs row scan failed: %v", err)
			continue
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] ownedIDs row iteration failed: %v", err)
		return ids, err
	}
	return ids, nil
}

func serveMarkdown(w http.ResponseWriter, filename, body string) {
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body))
}

// renderBookExport renders one book as §5b(a) markdown: frontmatter, then
// annotations in insertion (id) order grouped by chapter in first-seen order.
// Chapterless quotes come first with no heading — they must precede any "## "
// line or a re-import would misattribute them.
func (s *Server) renderBookExport(b *bookDetail) (string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT id, COALESCE(quote, ''), COALESCE(note, ''), color, COALESCE(chapter, ''),
		       COALESCE(location, ''), favorite, rating, COALESCE(noted_at, '')
		FROM annotations WHERE book_id = ? ORDER BY id`, b.ID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var anns []annotationRow
	for rows.Next() {
		var a annotationRow
		if err := rows.Scan(&a.ID, &a.Quote, &a.Note, &a.Color, &a.Chapter,
			&a.Location, &a.Favorite, &a.Rating, &a.NotedAt); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] book annotation row scan failed: %v", err)
			continue
		}
		anns = append(anns, a)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] book annotation row iteration failed: %v", err)
		return "", err
	}
	tags, err := s.exportTags(b.ID, "annotation", "book_id")
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	writeFrontmatter(&sb,
		kv{"title", b.Title},
		kv{"author", b.Author},
		kv{"isbn", b.ISBN},
		kv{"year", zeroBlank(b.PublishedYear)},
		kv{"genres", strings.Join(b.Genres, ", ")})

	order := []string{""}
	grouped := map[string][]annotationRow{}
	for _, a := range anns {
		if _, seen := grouped[a.Chapter]; !seen && a.Chapter != "" {
			order = append(order, a.Chapter)
		}
		grouped[a.Chapter] = append(grouped[a.Chapter], a)
	}
	for _, ch := range order {
		if ch != "" {
			sb.WriteString("\n## ")
			sb.WriteString(ch)
			sb.WriteString("\n")
		}
		for _, a := range grouped[ch] {
			sb.WriteString("\n")
			writeQuoteBlock(&sb, a.Quote, a.Note, func(note string) {
				writeBinding(&sb, "note", note)
				if a.Color != "yellow" {
					writeBinding(&sb, "color", a.Color)
				}
				writeBinding(&sb, "tags", strings.Join(tags[a.ID], ", "))
				writeBinding(&sb, "loc", a.Location)
				writeBinding(&sb, "date", dateOnly(a.NotedAt))
				writeFavoriteRating(&sb, a.Favorite, a.Rating)
			})
		}
	}
	return sb.String(), nil
}

// renderMovieExport mirrors renderBookExport for dialogues: no chapter
// headings, dialogue order (timestamp IS NULL), timestamp, id (PLAN §3b).
func (s *Server) renderMovieExport(m *movieDetail) (string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT id, quote, COALESCE(note, ''), COALESCE(character, ''), COALESCE(actor, ''),
		       COALESCE(timestamp, ''), favorite, rating
		FROM dialogues WHERE movie_id = ?
		ORDER BY (timestamp IS NULL), timestamp, id`, m.ID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var dlgs []dialogueRow
	for rows.Next() {
		var d dialogueRow
		if err := rows.Scan(&d.ID, &d.Quote, &d.Note, &d.Character, &d.Actor,
			&d.Timestamp, &d.Favorite, &d.Rating); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] movie dialogue row scan failed: %v", err)
			continue
		}
		dlgs = append(dlgs, d)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] movie dialogue row iteration failed: %v", err)
		return "", err
	}
	tags, err := s.exportTags(m.ID, "dialogue", "movie_id")
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	writeFrontmatter(&sb,
		kv{"title", m.Title},
		kv{"director", m.Director},
		kv{"year", zeroBlank(m.ReleaseYear)},
		kv{"genres", strings.Join(m.Genres, ", ")},
		kv{"type", typeIfShow(m.MediaType)}) // only shows carry a type line (round-trip)
	for _, d := range dlgs {
		sb.WriteString("\n")
		writeQuoteBlock(&sb, d.Quote, d.Note, func(note string) {
			writeBinding(&sb, "character", d.Character)
			writeBinding(&sb, "actor", d.Actor)
			writeBinding(&sb, "timestamp", d.Timestamp)
			writeBinding(&sb, "note", note)
			writeBinding(&sb, "tags", strings.Join(tags[d.ID], ", "))
			writeFavoriteRating(&sb, d.Favorite, d.Rating)
		})
	}
	return sb.String(), nil
}

// exportTags maps annotation/dialogue id -> sorted tag names for one book or
// movie in a single query (kind: "annotation"/"dialogue"; parentCol:
// "book_id"/"movie_id").
func (s *Server) exportTags(parentID int64, kind, parentCol string) (map[int64][]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT j.`+kind+`_id, t.name FROM `+kind+`_tags j
		JOIN tags t ON t.id = j.tag_id
		JOIN `+kind+`s o ON o.id = j.`+kind+`_id
		WHERE o.`+parentCol+` = ? ORDER BY t.name`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]string{}
	for rows.Next() {
		var id int64
		var n string
		if err := rows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] tag row scan failed: %v", err)
			continue
		}
		out[id] = append(out[id], n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] tag row iteration failed: %v", err)
		return out, err
	}
	return out, nil
}

// ---- rendering helpers ----

type kv struct{ key, val string }

// writeFrontmatter emits the YAML frontmatter block, skipping empty values.
func writeFrontmatter(sb *strings.Builder, pairs ...kv) {
	sb.WriteString("---\n")
	for _, p := range pairs {
		if p.val != "" {
			sb.WriteString(p.key)
			sb.WriteString(": ")
			sb.WriteString(p.val)
			sb.WriteString("\n")
		}
	}
	sb.WriteString("---\n")
}

// writeQuoteBlock emits the "> " blockquote then the entry's bindings.
// Note-only annotations put the note in the blockquote (a bare "- note:"
// entry would not be importable), so the bindings callback receives the
// possibly-consumed note.
func writeQuoteBlock(sb *strings.Builder, quote, note string, bindings func(note string)) {
	text := quote
	if text == "" {
		text, note = note, ""
	}
	for _, line := range strings.Split(text, "\n") {
		sb.WriteString("> ")
		sb.WriteString(line)
		sb.WriteString("\n")
	}
	bindings(note)
}

// writeBinding emits one "- key: value" line for non-empty values, with the
// value whitespace-collapsed onto the single line the importer expects.
func writeBinding(sb *strings.Builder, key, val string) {
	if val = strings.Join(strings.Fields(val), " "); val != "" {
		sb.WriteString("- ")
		sb.WriteString(key)
		sb.WriteString(": ")
		sb.WriteString(val)
		sb.WriteString("\n")
	}
}

func writeFavoriteRating(sb *strings.Builder, favorite bool, rating int) {
	if favorite {
		sb.WriteString("- favorite: true\n")
	}
	if rating > 0 {
		sb.WriteString("- rating: ")
		sb.WriteString(strconv.Itoa(rating))
		sb.WriteString("\n")
	}
}

func zeroBlank(n int) string {
	if n == 0 {
		return ""
	}
	return strconv.Itoa(n)
}

// typeIfShow emits "show" for a show and "" for a movie, so the export only
// carries a "type:" line when it matters (shows re-import as shows).
func typeIfShow(mediaType string) string {
	if mediaType == "show" {
		return "show"
	}
	return ""
}

// dateOnly emits the YYYY-MM-DD prefix of a stored noted_at (annotations are
// day-granular in the export, so a manual add's "…HH:MM:SS" drops its time and
// re-imports stably); a value that isn't a leading ISO date passes through.
func dateOnly(s string) string {
	if len(s) >= 10 && s[4] == '-' && s[7] == '-' {
		return s[:10]
	}
	return s
}

// sanitizeFilename makes a title safe as a download/zip member name:
// reserved and control characters become "-", surrounding spaces/dots go,
// 120 runes max, empty falls back to "untitled" (PLAN §6b).
func sanitizeFilename(name string) string {
	s := strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f || strings.ContainsRune(`/\:*?"<>|`, r) {
			return '-'
		}
		return r
	}, name)
	s = strings.Trim(s, " .")
	if rs := []rune(s); len(rs) > 120 {
		s = strings.Trim(string(rs[:120]), " .")
	}
	if s == "" {
		return "untitled"
	}
	return s
}

// zipName builds "<dir>/<sanitized title>.md", deduping collisions with
// " (2)", " (3)", … suffixes.
func zipName(used map[string]bool, dir, title string) string {
	base := dir + "/" + sanitizeFilename(title)
	name := base
	for n := 2; used[name]; n++ {
		name = fmt.Sprintf("%s (%d)", base, n)
	}
	used[name] = true
	return name + ".md"
}
