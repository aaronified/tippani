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
		       COALESCE(chapter_no, 0), COALESCE(location, ''), character, favorite,
		       COALESCE(noted_at, '')
		FROM annotations WHERE book_id = ? ORDER BY id`, b.ID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var anns []annotationRow
	for rows.Next() {
		var a annotationRow
		// `character` carries no COALESCE: it is NOT NULL DEFAULT '' (0047), so the
		// empty string is what a row predating the column actually holds and there is
		// no NULL for a COALESCE to catch. Same rule as dialogueCols.
		if err := rows.Scan(&a.ID, &a.Quote, &a.Note, &a.Color, &a.Chapter,
			&a.ChapterNo, &a.Location, &a.Character, &a.Favorite, &a.NotedAt); err != nil {
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
		// writeFrontmatter drops an empty value, so a book with neither of these
		// exports byte-for-byte as it did before 0034 — which is what keeps the
		// existing export fixtures honest rather than merely updated.
		kv{"translator", b.Translator},
		kv{"editor", b.Editor},
		// The two languages (0047), beside the two credits and for the same reason
		// they sit there: which edition this is, and what it was written in, are
		// facts about the same act of translation. Empty values are dropped, so a
		// book with neither exports byte-for-byte as it did before.
		kv{"language", b.Language},
		kv{"orig_language", b.OrigLanguage},
		kv{"isbn", b.ISBN},
		kv{"year", zeroBlank(b.PublishedYear)},
		kv{"genres", strings.Join(b.Genres, ", ")},
		kv{"series", seriesFrontmatter(b.Series, b.SeriesIndex)},
		// A BOOK FILE NOW SAYS THAT IT IS A BOOK, unconditionally and in the same
		// slot the catalogue export writes its own type line.
		//
		// It never did, and got away with it only because nothing a book carried was
		// decisive for another kind. 0047 broke that: an annotation has a CHARACTER,
		// and "- character:" is one of the bindings MarkdownKind reads as "this is a
		// film" (movie_markdown.go). So a book with no author and no isbn — both
		// dropped when empty — whose first highlight named a character would have
		// re-imported as a FILM, with every chapter heading discarded on the way.
		//
		// This is exactly the hole mediaTypeLine was made unconditional to close on
		// the catalogue side, and the fix is the same six characters. It changes
		// shipped export bytes, which is the whole cost: wantBookExport moves with it.
		kv{"type", "book"},
		kv{"status", b.Status},
		kv{"progress", progressFrontmatter(b.Status, b.Progress)},
		kv{"page", posFrontmatter(b.Status, b.position)},
		kv{"reads", readsFrontmatter(b.Reads)})

	// GROUPED ON THE RENDERED HEADING, not on the name alone (0044). Two highlights
	// in chapter 7 belong under one "## 7 · The Fall" whether their name field agrees
	// or not, and grouping on `chapter` while printing the pair would have split one
	// chapter into two sections the moment somebody filled in a number.
	order := []string{""}
	grouped := map[string][]annotationRow{}
	for _, a := range anns {
		h := chapterHeading(a.ChapterNo, a.Chapter)
		if _, seen := grouped[h]; !seen && h != "" {
			order = append(order, h)
		}
		grouped[h] = append(grouped[h], a)
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
				// Who says the line, first — the same slot and the same key the
				// dialogue block puts it in, because it is the same fact about a
				// different medium. A novel has speakers and no cast, so there is no
				// `actor` beside it: nobody plays Ahab.
				writeBinding(&sb, "character", a.Character)
				writeBinding(&sb, "note", note)
				if a.Color != "yellow" {
					writeBinding(&sb, "color", a.Color)
				}
				writeBinding(&sb, "tags", strings.Join(tags[a.ID], ", "))
				writeBinding(&sb, "loc", a.Location)
				writeBinding(&sb, "date", dateOnly(a.NotedAt))
				writeFavorite(&sb, a.Favorite)
			})
		}
	}
	return sb.String(), nil
}

// renderMovieExport mirrors renderBookExport for dialogues: no chapter
// headings, dialogue order (season, episode, timestamp, id — see dialogueOrder;
// PLAN §3b).
func (s *Server) renderMovieExport(m *movieDetail) (string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT id, quote, COALESCE(note, ''), color, COALESCE(character, ''), COALESCE(actor, ''),
		       COALESCE(timestamp, ''), season, episode, act, quest, episode_name, favorite
		FROM dialogues WHERE movie_id = ?`+dialogueOrder(""), m.ID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var dlgs []dialogueRow
	for rows.Next() {
		var d dialogueRow
		// act/quest/episode_name carry no COALESCE, for the reason dialogueCols
		// states: NOT NULL DEFAULT '' (0047), so there is no NULL to catch.
		if err := rows.Scan(&d.ID, &d.Quote, &d.Note, &d.Color, &d.Character, &d.Actor,
			&d.Timestamp, &d.Season, &d.Episode, &d.Act, &d.Quest, &d.EpisodeName,
			&d.Favorite); err != nil {
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
		// Games only in practice, and empty lines are dropped by writeFrontmatter,
		// so a film's export is byte-identical to what it was before 0042.
		kv{"publisher", m.Publisher},
		kv{"year", zeroBlank(m.ReleaseYear)},
		kv{"genres", strings.Join(m.Genres, ", ")},
		kv{"collection", seriesFrontmatter(m.Series, m.SeriesIndex)},
		kv{"type", mediaTypeLine(m.MediaType)}, // always present: it is what routes the re-import
		kv{"status", m.Status},
		kv{"progress", progressFrontmatter(m.Status, m.Progress)},
		kv{"season", seasonFrontmatter(m.Status, m.position)},
		kv{"episode", posFrontmatter(m.Status, m.position)},
		kv{"reads", readsFrontmatter(m.Reads)})
	for _, d := range dlgs {
		sb.WriteString("\n")
		writeQuoteBlock(&sb, d.Quote, d.Note, func(note string) {
			writeBinding(&sb, "character", d.Character)
			writeBinding(&sb, "actor", d.Actor)
			// Coarse to fine, and only when set: a show's line says which episode
			// it is from, a film's says nothing (both are 0). The keys match the
			// frontmatter's own season/episode, one level down.
			writeBinding(&sb, "season", nullBlank(d.Season))
			writeBinding(&sb, "episode", nullBlank(d.Episode))
			// The episode's NAME sits beside its number, because that is what it
			// names; the game's two locators sit before the timestamp, because they
			// replace it — a game has no runtime to point into (0047). All three are
			// empty for every other medium (the server clears them, see
			// normalizeLocator), so writeBinding drops the lines and a film's export
			// is byte-for-byte what it was.
			writeBinding(&sb, "episode_name", d.EpisodeName)
			writeBinding(&sb, "act", d.Act)
			writeBinding(&sb, "quest", d.Quest)
			writeBinding(&sb, "timestamp", d.Timestamp)
			writeBinding(&sb, "note", note)
			// Same rule as the book export: the default colour is left out, so
			// a file only mentions colour when it was actually chosen.
			if d.Color != "yellow" {
				writeBinding(&sb, "color", d.Color)
			}
			writeBinding(&sb, "tags", strings.Join(tags[d.ID], ", "))
			writeFavorite(&sb, d.Favorite)
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

func writeFavorite(sb *strings.Builder, favorite bool) {
	if favorite {
		sb.WriteString("- favorite: true\n")
	}
}

// writeCirca marks an approximate occasion date — "around 1890" (0047). Written
// only when it is on, like favorite, so a shelf of exact dates exports byte for
// byte as it did before the column existed.
//
// `true` AND NOT `yes`, though the parser's truthy() takes both. Every boolean
// this app writes to a file is `true`, and one key spelling it differently in the
// same block as `- favorite: true` would be a wart a reader has to think about.
//
// Written even when the date itself is empty, which looks odd and is right: the
// column has no cross-field rule (see utteranceReq.OccasionCirca), so a tick
// saved without a year is real stored state, and a file that dropped it would
// silently untick it on the way back in.
func writeCirca(sb *strings.Builder, circa bool) {
	if circa {
		sb.WriteString("- circa: true\n")
	}
}

func zeroBlank(n int) string {
	if n == 0 {
		return ""
	}
	return strconv.Itoa(n)
}

// nullBlank is zeroBlank for a nullable count: only an unset value (null) drops
// its line, and 0 writes "0". That distinction is the whole point of the
// dialogue's season being nullable — season 0 is where a series keeps its
// specials, and a file that dropped it would re-import as "no season recorded".
func nullBlank(n *int) string {
	if n == nil {
		return ""
	}
	return strconv.Itoa(*n)
}

// progressFrontmatter renders the reading percentage, but only while a work is
// actually in progress and actually somewhere past the start. Every other status
// implies its own value (completed is 100, abandoned is 0 — see
// applyStatusChange), so writing the number there would be noise a re-import
// has to ignore anyway.
func progressFrontmatter(status string, progress int) string {
	if progress <= 0 || !inFlight(status) {
		return ""
	}
	return strconv.Itoa(progress) + "%"
}

// posFrontmatter renders a position in the work's own units as "128/320" — the
// page you are on out of the book's pages, or the episode out of the season's.
// Only while in progress: a finished work is at its own end by definition, and an
// abandoned one has no position left (see applyStatusChange), so writing either
// would be noise a re-import has to ignore.
func posFrontmatter(status string, p position) string {
	if p.Unit == PosPercent || p.PosTotal == 0 || !inFlight(status) {
		return ""
	}
	return strconv.Itoa(p.Pos) + "/" + strconv.Itoa(p.PosTotal)
}

// seasonFrontmatter is posFrontmatter for the other half of a show's position.
func seasonFrontmatter(status string, p position) string {
	if p.Unit != PosEpisode || p.SeasonTotal == 0 || !inFlight(status) {
		return ""
	}
	return strconv.Itoa(p.Season) + "/" + strconv.Itoa(p.SeasonTotal)
}

// inFlight covers the statuses where a part-way position still means something:
// on the go, or set down part-way through.
func inFlight(status string) bool {
	return status == StatusReading || status == StatusWatching || status == StatusPaused
}

// readsFrontmatter renders the read log as one value: semicolon-separated reads,
// each "start — finish", with an unfinished read left open-ended and an abandoned
// one marked. Dates stay exactly as partial as they are stored.
//
//	reads: 2019-03-04 — 2019-04-01; 2021 — 2021-02 (abandoned); 2026-07 —
//
// One line rather than a YAML list because writeFrontmatter is a flat key/value
// writer (no YAML dep, PLAN §5b) and the importer reads it back with the same
// hand-rolled split.
func readsFrontmatter(reads []readRow) string {
	parts := make([]string, 0, len(reads))
	for _, r := range reads {
		s := r.StartedAt + " " + readsDash + " " + r.FinishedAt
		if r.Outcome == ReadAbandoned {
			s += " (abandoned)"
		}
		parts = append(parts, strings.TrimSpace(s))
	}
	return strings.Join(parts, "; ")
}

// readsDash separates a read's two dates. An em dash reads as a range to a human
// and cannot appear inside a partial date, so splitting on it is unambiguous.
const readsDash = "—"

// seriesFrontmatter renders a series/collection and its position as one value,
// "Name #1.5", mirroring seriesLabel() in the UI. An empty name yields "" so
// writeFrontmatter drops the line entirely. FormatFloat with precision -1 gives
// "1" for 1.0 and "1.5" for 1.5 — no trailing ".0" to re-parse.
func seriesFrontmatter(name string, idx float64) string {
	if name == "" {
		return ""
	}
	if idx == 0 {
		return name
	}
	return name + " #" + strconv.FormatFloat(idx, 'f', -1, 64)
}

// typeIfShow emits "show" for a show and "" for a movie, so the export only
// carries a "type:" line when it matters (shows re-import as shows).
// mediaTypeLine is the catalogue export's "type:" frontmatter value. It is
// always emitted, for films as well as shows, because it is the only signal that
// reliably tells the importer a file is a catalogue export rather than a book one
// (importer.LooksLikeMovieMarkdown).
//
// It used to be written for shows only, on the reasoning that "movie" is the
// default and a default needn't be stated. That left a film with no director, no
// collection, and no character/actor/timestamp on any line with nothing in it
// that said "film" — so re-importing its own export silently created a BOOK with
// annotations. Six characters of frontmatter is a cheap price for a file that
// cannot be misread.
//
// A GAME WAS STILL BEING WRITTEN OUT AS A FILM, which was the same bug one media
// type further along and shipped for as long as games have (0040/0042). There is
// no such thing as a lossy-but-harmless answer here: the media type is what the
// importer routes on, and a game re-imported as a film has its act and its quest
// stripped by writeMovieDialogues' own per-medium gate on the way in — so the
// file would come back a film with no locator at all. importMediaType and the
// parser have understood "game" since 1.16.0; only the writer never said it.
func mediaTypeLine(mediaType string) string {
	switch mediaType {
	case "show", "game":
		return mediaType
	}
	return "movie" // "" (pre-0006 rows) reads as a film, matching the column default
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

// chapterHeading is the one form a chapter takes wherever it is written as a line
// of text: in a book export's "## " heading, and — spelled identically in
// text.js's chapterLabel — everywhere the interface prints one.
//
//	7 · The Fall    a number and a name
//	7               a number alone (most books)
//	The Fall        a name alone (essays, scripture, anything unnumbered)
//	                neither: no heading at all
//
// A MIDDLE DOT, AND WHY THE SEPARATOR MATTERS MORE THAN IT LOOKS. This string is
// what the importer reads back, so the separator is the whole round trip. "7. The
// Fall" — the printed convention — cannot be parsed without ambiguity once numbers
// may be fractional: "7.5" is either chapter 7.5 or chapter 7 named "5", and no
// rule can tell. The dot this app already uses to join facts has no such collision
// and is not a character a chapter number can contain.
//
// The number is trimmed of a trailing ".0" so chapter 7 reads as "7" rather than
// as "7.0", which is what strconv's shortest form gives us for free.
func chapterHeading(no float64, name string) string {
	name = strings.TrimSpace(name)
	if no == 0 {
		return name
	}
	n := strconv.FormatFloat(no, 'f', -1, 64)
	if name == "" {
		return n
	}
	return n + " · " + name
}
