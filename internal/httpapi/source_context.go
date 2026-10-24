package httpapi

// What a work's source file says around each of its quotes, stored as rows.
//
// THE FILE IS NOT A READ PATH. It is where context comes from ONCE: on attach, and
// on a rescan that fills in the quotes added since. A quote opens its surroundings
// from one source_context row (GET /quotes/{kind}/{id}/context), so it works whether
// the file is still there, was pruned, or sat on a mount that is unplugged. That is
// the guard "the context endpoint opens no file", and handleGetContext holds it by
// having no way to: it never touches the Sources directory.
//
// THE MATCH IS TOLERANT ON BOTH SIDES (internal/srcmatch): accents and punctuation
// are ignored and small deviations are absorbed by an edit budget, because neither
// the reader's quote nor the file is clean. What is not found, or is ambiguous (a
// short line appearing a dozen times), gets no row and is counted: a guess about
// where a quote sits is worse than saying so.

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"tippani/internal/ebook"
	"tippani/internal/importer"
	"tippani/internal/olog"
	"tippani/internal/srcmatch"
	"tippani/internal/subs"
)

// THE CEILING is what extraction stores: one global number, not anyone's preference,
// generous on purpose. Narrowing is then a trim of what is already stored and needs
// no file, at any tier, forever; only exceeding the ceiling needs the file back. At
// ten paragraphs either side the stored context is still an order of magnitude
// smaller than the book it came from.
const (
	ceilingParagraphs = 10
	ceilingCues       = 15
	// The default window the panel shows until a work or a quote says otherwise.
	defaultParagraphs = 2
	defaultCues       = 5
	// A cue span stops at a silence this long. It is an absurdity stop, not scene
	// detection: nine stops in a two-hour film, and a film has a hundred scenes.
	silenceMs = 30000
)

const (
	unitParagraph = "paragraph"
	unitCue       = "cue"
)

// sourceUnits turns a stored file into the lines the matcher works over.
func sourceUnits(format string, data []byte) (units []srcmatch.Unit, unit string, err error) {
	switch format {
	case importer.SourceFormatSRT, importer.SourceFormatVTT, importer.SourceFormatASS, importer.SourceFormatLRC:
		cues, err := subs.Parse(format, data)
		if err != nil {
			return nil, "", err
		}
		for _, c := range cues {
			units = append(units, srcmatch.Unit{Text: c.Text, Start: c.Start, End: c.End})
		}
		return units, unitCue, nil
	case importer.SourceFormatEPUB:
		ps, err := ebook.Read(data)
		if err != nil {
			return nil, "", err
		}
		for _, p := range ps {
			units = append(units, srcmatch.Unit{Text: p.Text, Doc: p.Doc})
		}
		return units, unitParagraph, nil
	case importer.SourceFormatTXT:
		for _, p := range textParagraphs(string(data)) {
			units = append(units, srcmatch.Unit{Text: p})
		}
		if len(units) == 0 {
			return nil, "", errors.New("the text file holds no text")
		}
		return units, unitParagraph, nil
	}
	return nil, "", errors.New("unreadable source format " + format)
}

var blankLines = regexp.MustCompile(`\n[ \t]*\n+`)

// textParagraphs splits plain text into paragraphs on blank lines. A text with no
// blank lines at all (hard-wrapped, or one line per sentence) falls back to a unit
// per line, since one enormous paragraph would make every span the whole file.
func textParagraphs(s string) []string {
	s = strings.ReplaceAll(strings.ReplaceAll(strings.TrimPrefix(s, "\xef\xbb\xbf"), "\r\n", "\n"), "\r", "\n")
	var out []string
	for _, p := range blankLines.Split(s, -1) {
		if p = strings.Join(strings.Fields(p), " "); p != "" {
			out = append(out, p)
		}
	}
	if len(out) < 3 {
		var lines []string
		for _, l := range strings.Split(s, "\n") {
			if l = strings.Join(strings.Fields(l), " "); l != "" {
				lines = append(lines, l)
			}
		}
		if len(lines) > 20 {
			return lines
		}
	}
	return out
}

// workQuote is one quote that a source file could hold the surroundings of.
type workQuote struct {
	subject string
	id      int64
	text    string
}

// quotesOfSource lists the quotes belonging to the work a source row is for: a
// book's highlights, a film's lines (or one episode's, for a show), or the
// standalone quotes sharing an utterance title.
func (s *Server) quotesOfSource(uid int64, subject string, subjectID int64, key string) ([]workQuote, error) {
	var out []workQuote
	collect := func(rows *sql.Rows, kind string) error {
		defer rows.Close()
		for rows.Next() {
			var q workQuote
			var text sql.NullString
			if err := rows.Scan(&q.id, &text); err != nil {
				return err
			}
			if q.text = strings.TrimSpace(text.String); q.text != "" {
				q.subject = kind
				out = append(out, q)
			}
		}
		return rows.Err()
	}
	switch subject {
	case sourceBook:
		rows, err := s.Store.DB.Query(
			`SELECT a.id, a.quote FROM annotations a JOIN books b ON b.id = a.book_id
			 WHERE b.user_id = ? AND a.book_id = ?`, uid, subjectID)
		if err != nil {
			return nil, err
		}
		return out, collect(rows, "annotation")
	case sourceScreen:
		q := `SELECT d.id, d.quote FROM dialogues d JOIN movies m ON m.id = d.movie_id
		      WHERE m.user_id = ? AND d.movie_id = ?`
		args := []any{uid, subjectID}
		if key != "" {
			// s01e04: a show's subtitle covers one episode.
			m := episodeKey.FindStringSubmatch(key)
			if m == nil {
				return nil, nil
			}
			season, _ := strconv.Atoi(m[1])
			ep, _ := strconv.Atoi(m[2])
			q += ` AND d.season = ? AND d.episode = ?`
			args = append(args, season, ep)
		}
		rows, err := s.Store.DB.Query(q, args...)
		if err != nil {
			return nil, err
		}
		return out, collect(rows, "dialogue")
	case sourceUtterance:
		rows, err := s.Store.DB.Query(
			`SELECT id, quote, speaker, occasion, work_title FROM utterances WHERE user_id = ?`, uid)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			var quote, speaker, occasion, title string
			if err := rows.Scan(&id, &quote, &speaker, &occasion, &title); err != nil {
				return nil, err
			}
			if utteranceWorkKey(speaker, occasion, title) == key && strings.TrimSpace(quote) != "" {
				out = append(out, workQuote{subject: "utterance", id: id, text: quote})
			}
		}
		return out, rows.Err()
	}
	return nil, nil
}

// contextStats is what an extraction found, and is reported to the reader as it is:
// the ambiguous and the unmatched are not failures, they are the quotes the file
// could not place.
type contextStats struct {
	Matched   int `json:"matched"`
	Ambiguous int `json:"ambiguous"`
	Unmatched int `json:"unmatched"`
	// Skipped quotes already had context from this file and were left alone.
	Skipped int `json:"skipped"`
}

// extractContext reads one source file and stores the surroundings of every quote of
// its work that has none yet. IT NEVER OVERWRITES: a rescan fills in the quotes added
// since and leaves the rest alone, so a per-quote adjustment — the reader's own
// judgement — is never clobbered by a mechanical pass. (Replacing the file with a
// DIFFERENT one clears the old rows first, in handlePutSource; one work's context
// never comes from two editions.)
func (s *Server) extractContext(uid int64, src sourceKey, data []byte) (contextStats, error) {
	units, unit, err := sourceUnits(src.format, data)
	if err != nil {
		return contextStats{}, err
	}
	return s.extractContextUnits(uid, src, units, unit)
}

// extractContextUnits is extractContext over lines already read, which is what an
// upload has in hand: it parsed the file once to refuse one it cannot read.
func (s *Server) extractContextUnits(uid int64, src sourceKey, units []srcmatch.Unit, unit string) (contextStats, error) {
	var st contextStats
	quotes, err := s.quotesOfSource(uid, src.subject, src.subjectID, src.key)
	if err != nil {
		return st, err
	}
	have := map[string]bool{}
	rows, err := s.Store.DB.Query(`SELECT subject, item_id FROM source_context WHERE user_id = ? AND source_id = ?`, uid, src.id)
	if err != nil {
		return st, err
	}
	for rows.Next() {
		var sub string
		var id int64
		if err := rows.Scan(&sub, &id); err == nil {
			have[sub+":"+strconv.FormatInt(id, 10)] = true
		}
	}
	rows.Close()

	ix := srcmatch.NewIndex(units)
	opt := srcmatch.Options{Sep: "\n\n"}
	ceilBefore, ceilAfter := ceilingParagraphs, ceilingParagraphs
	if unit == unitCue {
		opt = srcmatch.Options{Sep: "\n", MaxGapMs: silenceMs}
		ceilBefore, ceilAfter = ceilingCues, ceilingCues
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		return st, err
	}
	defer tx.Rollback()
	for _, q := range quotes {
		if have[q.subject+":"+strconv.FormatInt(q.id, 10)] {
			st.Skipped++
			continue
		}
		res := ix.Find(q.text)
		switch {
		case !res.Found:
			st.Unmatched++
			continue
		case res.Ambiguous:
			st.Ambiguous++
			continue
		}
		c := ix.Context(res.Match, ceilBefore, ceilAfter, opt)
		startAt, endAt := "", ""
		if unit == unitCue {
			startAt, endAt = clockText(c.Start), clockText(c.End)
		}
		if _, err := tx.Exec(
			`INSERT INTO source_context (user_id, source_id, subject, item_id, before, body, after, unit,
			        stored_before, stored_after, match_dist, bound_before, bound_after, start_at, end_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, src.id, q.subject, q.id, c.Before, c.Body, c.After, unit,
			c.TookBefore, c.TookAfter, res.Match.Dist, b2i(c.BoundBefore), b2i(c.BoundAfter), startAt, endAt); err != nil {
			return st, err
		}
		st.Matched++
	}
	return st, tx.Commit()
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// clockText prints milliseconds as HH:MM:SS, the shape a film's timestamp is written in
// everywhere else in the app (and the one that sorts lexically).
func clockText(ms int64) string {
	s := ms / 1000
	return pad2(s/3600) + ":" + pad2(s%3600/60) + ":" + pad2(s%60)
}

func pad2(n int64) string {
	if n < 10 {
		return "0" + strconv.FormatInt(n, 10)
	}
	return strconv.FormatInt(n, 10)
}

// sourceKey is a stored source row as extraction needs it.
type sourceKey struct {
	id        int64
	subject   string
	subjectID int64
	key       string
	format    string
	path      string
}

// readSourceFile reads a stored source's bytes, refusing a name that is not ours.
func (s *Server) readSourceFile(path string) ([]byte, error) {
	if !sourceFile.MatchString(path) {
		return nil, errors.New("the stored file name is not one this app wrote")
	}
	return os.ReadFile(filepath.Join(s.sourcesDir(), path))
}

// ---- GET /quotes/{kind}/{id}/context ------------------------------------------------

// contextAnswer is what the panel draws. The effective window is rendered out of the
// stored one here — narrowing is a trim of rows, never a file read.
type contextAnswer struct {
	Before string `json:"before"`
	Body   string `json:"body"`
	After  string `json:"after"`
	Unit   string `json:"unit"`
	// Span is the window shown: units before and after. Stored is what the row holds,
	// the most the panel can widen to without the file. BoundBefore/After say the
	// span ran out at a chapter edge, a long silence or the end of the work.
	Span        window `json:"span"`
	Stored      window `json:"stored"`
	BoundBefore bool   `json:"bound_before"`
	BoundAfter  bool   `json:"bound_after"`
	Start       string `json:"start,omitempty"`
	End         string `json:"end,omitempty"`
}

type window struct {
	Before int `json:"before"`
	After  int `json:"after"`
}

// handleGetContext: GET /quotes/{kind}/{id}/context. One indexed row; NO FILE IS
// OPENED, and nothing in this handler can: it has no path to one.
func (s *Server) handleGetContext(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid quote id")
		return
	}
	kind := r.PathValue("kind")
	if kind != "annotation" && kind != "dialogue" && kind != "utterance" {
		writeErr(w, http.StatusBadRequest, "kind must be annotation, dialogue or utterance")
		return
	}
	uid := userID(r)
	var a contextAnswer
	var before, after string
	var wantB, wantA sql.NullInt64
	var bb, ba int
	err := s.Store.DB.QueryRow(
		`SELECT before, body, after, unit, stored_before, stored_after, want_before, want_after,
		        bound_before, bound_after, start_at, end_at
		 FROM source_context WHERE user_id = ? AND subject = ? AND item_id = ?`, uid, kind, id).
		Scan(&before, &a.Body, &after, &a.Unit, &a.Stored.Before, &a.Stored.After, &wantB, &wantA, &bb, &ba, &a.Start, &a.End)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "this quote has no context")
		return
	}
	if err != nil {
		internalError(w, r, "get context", err)
		return
	}
	sep, def := "\n\n", defaultParagraphs
	if a.Unit == unitCue {
		sep, def = "\n", defaultCues
	}
	// The effective pair: the quote's own adjustment where it has one, else the global
	// default, and never more than what is stored.
	span := window{Before: def, After: def}
	if wantB.Valid {
		span.Before = int(wantB.Int64)
	}
	if wantA.Valid {
		span.After = int(wantA.Int64)
	}
	// "Show more", for this read only: the panel may ask for a wider window than the
	// setting, up to what is stored. It changes nothing and is forgotten on close.
	if v, err := strconv.Atoi(r.URL.Query().Get("before")); err == nil && v >= 0 {
		span.Before = v
	}
	if v, err := strconv.Atoi(r.URL.Query().Get("after")); err == nil && v >= 0 {
		span.After = v
	}
	span.Before = min(span.Before, a.Stored.Before)
	span.After = min(span.After, a.Stored.After)
	a.Span = span
	a.Before = lastUnits(before, sep, span.Before)
	a.After = firstUnits(after, sep, span.After)
	// A bound describes the window SHOWN: the span ran out at a chapter edge, a long
	// silence or the end of the work only if the window reaches everything stored on that
	// side. A narrowed window that stops short of the stored edge is stopped by the
	// setting, and saying "end of the chapter" over it would be wrong.
	a.BoundBefore = bb == 1 && span.Before >= a.Stored.Before
	a.BoundAfter = ba == 1 && span.After >= a.Stored.After
	writeJSON(w, http.StatusOK, a)
}

// lastUnits returns the last n units of stored context text, which is how a narrower
// window is cut out of a wider stored one.
func lastUnits(text, sep string, n int) string {
	if n <= 0 || text == "" {
		return ""
	}
	parts := strings.Split(text, sep)
	if n >= len(parts) {
		return text
	}
	return strings.Join(parts[len(parts)-n:], sep)
}

func firstUnits(text, sep string, n int) string {
	if n <= 0 || text == "" {
		return ""
	}
	parts := strings.Split(text, sep)
	if n >= len(parts) {
		return text
	}
	return strings.Join(parts[:n], sep)
}

// handleRescanSource: POST /sources/{id}/rescan — fill in context for the quotes this
// work has gained since the file was attached. It never overwrites a row, so a
// per-quote adjustment survives it.
func (s *Server) handleRescanSource(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid source id")
		return
	}
	uid := userID(r)
	var src sourceKey
	var pruned string
	err := s.Store.DB.QueryRow(
		`SELECT id, subject, subject_id, subject_key, format, path, pruned_at FROM work_sources WHERE id = ? AND user_id = ?`,
		id, uid).Scan(&src.id, &src.subject, &src.subjectID, &src.key, &src.format, &src.path, &pruned)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "source not found")
		return
	case err != nil:
		internalError(w, r, "rescan source", err)
		return
	}
	if pruned != "" || src.path == "" {
		// The panel says "re-add the file", which is a different sentence from "no source".
		writeErr(w, http.StatusConflict, "the file was pruned: add it again to find context for new quotes")
		return
	}
	data, err := s.readSourceFile(src.path)
	if err != nil {
		writeErr(w, http.StatusConflict, "the file is not where it was: add it again")
		return
	}
	st, err := s.extractContext(uid, src, data)
	if err != nil {
		olog.Printf("[sources] rescan of source %d: %v", src.id, err)
		writeErr(w, http.StatusUnprocessableEntity, "that file could not be read: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"context": st})
}

// handleContextIDs: GET /sources/context-ids?subject=&subject_id= — which quotes of a
// work have stored context, as ids. A card asks it once per work so the "In context"
// action can be ABSENT where it would show nothing (the registry's rule: absent, not
// disabled), without every quote list query learning a new column. A work that is not
// the reader's answers an empty list, which leaks nothing: the filter is the owner.
//
// For standalone quotes (subject=utterance) there is no work row, so every utterance
// of the reader's that has context is listed.
func (s *Server) handleContextIDs(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := r.URL.Query()
	subject := q.Get("subject")
	if subject != sourceBook && subject != sourceScreen && subject != sourceUtterance {
		writeErr(w, http.StatusBadRequest, "subject must be book, screen or utterance")
		return
	}
	query := `SELECT sc.item_id FROM source_context sc JOIN work_sources ws ON ws.id = sc.source_id
	          WHERE sc.user_id = ? AND ws.subject = ?`
	args := []any{uid, subject}
	if subject != sourceUtterance {
		id, _ := strconv.ParseInt(q.Get("subject_id"), 10, 64)
		if id <= 0 {
			writeErr(w, http.StatusBadRequest, "say which work")
			return
		}
		query += ` AND ws.subject_id = ?`
		args = append(args, id)
	}
	rows, err := s.Store.DB.Query(query, args...)
	if err != nil {
		internalError(w, r, "context ids", err)
		return
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			internalError(w, r, "context ids: scan", err)
			return
		}
		ids = append(ids, id)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ids": ids})
}
