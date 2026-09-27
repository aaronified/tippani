package httpapi

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
)

// THE SYSTEM LOG, FOR AN ADMIN: GET /admin/logs, a page at a time, newest first,
// and GET /admin/logs.md, the same lines as a Markdown download. They read
// system_logs, which the logbook fills with every line the server prints, the
// standard logger's included, and one line per request (request_log.go says
// what that line keeps and leaves out).
//
// THE FILTERS ARE THE SCREEN'S, AND THE EXPORT TAKES THE SAME ONES. Levels (by
// default everything but file requests and traces, which are most of the log and
// the least of what anybody opens it for); a time range, from and to, unix ms,
// both inclusive; and a keyword, matched case-insensitively and LITERALLY — a %
// or an _ somebody types is the character they saw in a line, not a wildcard, so
// "50%" does not find "500 errors". The export of "what is shown" is every line
// the filters select, not only the page on screen; ?all=1 is everything kept.
//
// THIRTY DAYS, HOWEVER FAR BACK from REACHES. The prune deletes older lines when
// it next runs; the reads stop at thirty days now, so what is shown does not
// depend on whether it has run yet.

// defaultLogLevels are the levels shown when the request names none.
var defaultLogLevels = []string{jobs.LevelError, jobs.LevelWarn, jobs.LevelInfo, jobs.LevelRequest}

var systemLogLevels = map[string]bool{
	jobs.LevelError: true, jobs.LevelWarn: true, jobs.LevelInfo: true,
	jobs.LevelRequest: true, jobs.LevelAsset: true, jobs.LevelTrace: true,
}

// The page sizes GET /admin/logs answers with.
const (
	logsPageDefault = 200
	logsPageMax     = 1000
)

// logFilter is what the system log is narrowed to.
type logFilter struct {
	levels   []string // nil: every level
	from, to int64    // unix ms; to 0: no upper bound
	keyword  string
	all      bool // ?all=1: every level, every line kept
}

// parseLogFilter reads the filters from a request's query: ?all=1 is
// everything kept, and otherwise level, from, to and q.
func parseLogFilter(q url.Values) (logFilter, string) {
	f := logFilter{from: time.Now().Add(-jobsRetention).UnixMilli()}
	if q.Get("all") == "1" {
		f.all = true
		return f, ""
	}
	f.levels = listParam(q["level"])
	if len(f.levels) == 0 {
		f.levels = defaultLogLevels
	}
	for _, l := range f.levels {
		if !systemLogLevels[l] {
			return f, "unknown level " + strconv.Quote(l)
		}
	}
	for name, dst := range map[string]*int64{"from": &f.from, "to": &f.to} {
		s := strings.TrimSpace(q.Get(name))
		if s == "" {
			continue
		}
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n < 0 {
			return f, name + " must be a time in unix milliseconds"
		}
		if name == "from" {
			n = max(n, f.from)
		}
		*dst = n
	}
	f.keyword = strings.TrimSpace(q.Get("q"))
	return f, ""
}

// likeLiteral is s as a LIKE pattern that matches s anywhere, with LIKE's own
// wildcards and the escape character taken as themselves (ESCAPE '\').
func likeLiteral(s string) string {
	return "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s) + "%"
}

// where is f as SQL over system_logs, and its arguments.
func (f logFilter) where() (string, []any) {
	parts, args := []string{"at >= ?"}, []any{f.from}
	if f.to > 0 {
		parts, args = append(parts, "at <= ?"), append(args, f.to)
	}
	if len(f.levels) > 0 {
		parts = append(parts, "level IN ("+placeholders(len(f.levels))+")")
		for _, l := range f.levels {
			args = append(args, l)
		}
	}
	if f.keyword != "" {
		p := likeLiteral(f.keyword)
		parts, args = append(parts, `(line LIKE ? ESCAPE '\' OR code LIKE ? ESCAPE '\')`), append(args, p, p)
	}
	return strings.Join(parts, " AND "), args
}

// describe is what the export's line says the file holds.
func (f logFilter) describe(requested url.Values) string {
	if f.all {
		return "everything kept, 30 days"
	}
	parts := []string{"levels " + strings.Join(f.levels, ", ")}
	if strings.TrimSpace(requested.Get("from")) != "" {
		parts = append(parts, "from "+utc(f.from)+" UTC")
	} else {
		parts = append(parts, "the last 30 days")
	}
	if f.to > 0 {
		parts = append(parts, "to "+utc(f.to)+" UTC")
	}
	if f.keyword != "" {
		parts = append(parts, "keyword "+codeSpan(f.keyword))
	}
	return strings.Join(parts, ", ")
}

// systemLine is one line of the system log, as GET /admin/logs answers it.
type systemLine struct {
	ID    int64  `json:"id"`
	At    int64  `json:"at"`
	Level string `json:"level"`
	Code  string `json:"code"`
	Line  string `json:"line"`
}

// handleSystemLogs: GET /admin/logs?level=a,b&from=&to=&q=&before=&limit= →
// {lines, more}, newest first; before is the smallest id of the last page.
func (s *Server) handleSystemLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f, msg := parseLogFilter(q)
	if msg == "" {
		var before int64
		var limit int
		if before, limit, msg = pageParams(q, logsPageDefault, logsPageMax); msg == "" {
			s.flushWait(r)
			s.writeSystemLines(w, r, f, before, limit)
			return
		}
	}
	writeErr(w, http.StatusBadRequest, msg)
}

func (s *Server) writeSystemLines(w http.ResponseWriter, r *http.Request, f logFilter, before int64, limit int) {
	where, args := f.where()
	if before > 0 {
		where, args = where+" AND id < ?", append(args, before)
	}
	rows, err := s.Store.DB.Query(`SELECT id, at, level, code, line FROM system_logs WHERE `+where+
		` ORDER BY id DESC LIMIT ?`, append(args, limit+1)...)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the system log", err)
		return
	}
	defer rows.Close()
	lines := []systemLine{}
	for rows.Next() {
		var l systemLine
		if err := rows.Scan(&l.ID, &l.At, &l.Level, &l.Code, &l.Line); err != nil {
			codedError(w, r, olog.CodeJobRead, "read the system log", err)
			return
		}
		lines = append(lines, l)
	}
	if err := rows.Err(); err != nil {
		codedError(w, r, olog.CodeJobRead, "read the system log", err)
		return
	}
	more := len(lines) > limit
	if more {
		lines = lines[:limit]
	}
	writeJSON(w, http.StatusOK, map[string]any{"lines": lines, "more": more})
}

// handleSystemLogsMarkdown: GET /admin/logs.md?…the same filters… or ?all=1 —
// the lines as a Markdown download, oldest first, as a log is read
// (jobs_markdown.go says what is in it and why no line can leave its block).
func (s *Server) handleSystemLogsMarkdown(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f, msg := parseLogFilter(q)
	if msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	s.flushWait(r)
	where, args := f.where()
	// The block holds the lines up to the newest one now, and the fence is
	// measured over exactly those: a line logged while the file is written
	// cannot land in the block unmeasured. gen is the database all of it is read
	// from.
	gen := s.Store.Generation()
	var upTo int64
	var longest int
	err := s.Store.DB.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM system_logs`).Scan(&upTo)
	if err == nil {
		tick := "'`'"
		longest, err = s.longestIn(gen, `SELECT id, at, level, code, line FROM system_logs WHERE `+where+` AND id <= ?
			AND (instr(line, `+tick+`) > 0 OR instr(code, `+tick+`) > 0 OR instr(level, `+tick+`) > 0)`,
			append(args, upTo)...)
	}
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the system log", err)
		return
	}
	stamp := time.Now().UTC().Format("20060102-150405")
	name := "tippani-system-log-" + stamp + ".md"
	if f.all {
		name = "tippani-system-log-all-" + stamp + ".md"
	}
	err = writeMarkdownExport(w, mdExport{
		filename: name,
		heading:  "Tippani — system logs",
		about:    aboutLine(f.describe(q), "times in UTC"),
		longest:  longest,
		lines: func(emit func(string) error) error {
			return s.eachExportLine(gen, emit, `SELECT id, at, level, code, line FROM system_logs WHERE `+where+
				` AND id <= ?`, append(args, upTo)...)
		},
	})
	if err != nil {
		olog.Warnf(olog.CodeJobRead, "[logs] the system log export was not all sent%s: %v", reqSuffix(r), err)
	}
}
