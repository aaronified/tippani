package httpapi

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"
	"time"

	"tippani/internal/buildinfo"
	"tippani/internal/jobs"
)

// THE MARKDOWN A PERSON EXPORTS TO HAND TO SOMEBODY ELSE: one job's log
// (GET /jobs/{id}/log.md) or the system log (GET /admin/logs.md). Both are one
// shape — a heading, one line saying which version wrote it, when (UTC) and what
// it holds, and the log lines in ONE fenced block — because the person reading it
// is somebody the operator asked for help, holding a file and nothing else.
//
// NO LINE CAN LEAVE THE BLOCK. The fence is always longer than the longest run of
// backticks in any line inside it, so a request path, a provider's error or a
// title somebody typed cannot close the block early and have the rest of the file
// read as Markdown — headings, links, images fetched by whatever renders it. The
// heading's title and every other piece of data outside the block go in a code
// span by the same rule. And every line leaves through jobs.OneLine, the door's
// first pass: what the logbook kept is one line already, but a row that never
// passed the door (a hand-made archive's journal, carried over by a restore) is
// made one line here too, with its terminal escapes gone, so a file cat'ed in a
// terminal prints what was logged and not what the text told the terminal to do.

// longestBackticks is the length of the longest run of backticks in s.
func longestBackticks(s string) int {
	longest, run := 0, 0
	for i := 0; i < len(s); i++ {
		if s[i] == '`' {
			run++
			longest = max(longest, run)
		} else {
			run = 0
		}
	}
	return longest
}

// fence is the fence for a block whose lines' longest backtick run is longest:
// three backticks, or one more than that run.
func fence(longest int) string { return strings.Repeat("`", max(3, longest+1)) }

// codeSpan is s as a CommonMark code span: delimited by one more backtick than
// the longest run inside it, with a space inside each delimiter when s begins or
// ends with a backtick (CommonMark strips exactly that one space back off).
func codeSpan(s string) string {
	s = jobs.OneLine(s)
	d := strings.Repeat("`", longestBackticks(s)+1)
	if strings.HasPrefix(s, "`") || strings.HasSuffix(s, "`") {
		s = " " + s + " "
	}
	return d + s + d
}

// utc is a stored time (unix ms) as an export prints it: UTC, to the second.
func utc(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02 15:04:05")
}

// exportLine is one log line as an export's block holds it: the time in UTC to
// the millisecond, the level, and the text, with the line's TIP code in front of
// it when the text does not already carry it (the logbook's own notes do not).
func exportLine(at int64, level, code, text string) string {
	if code != "" && !strings.Contains(text, code) {
		text = code + " " + text
	}
	return jobs.OneLine(fmt.Sprintf("%s  %-7s  %s",
		time.UnixMilli(at).UTC().Format("2006-01-02 15:04:05.000"), level, text))
}

// aboutLine is an export's second line: the version that wrote it, when, and
// what it holds.
func aboutLine(parts ...string) string {
	return strings.Join(append([]string{
		"Tippani " + codeSpan(buildinfo.Version),
		"exported " + utc(time.Now().UnixMilli()) + " UTC",
	}, parts...), " · ")
}

// mdExport is one export, written by writeMarkdownExport.
type mdExport struct {
	filename string
	heading  string // the heading line's text, after "# "
	about    string
	// longest is the longest backtick run in any line lines will emit, found by
	// a first pass over them: the fence has to be known before the first line.
	longest int
	// lines emits every line of the block, in order, already through
	// exportLine; an error stops it.
	lines func(emit func(line string) error) error
}

// exportIdle is how long an export waits for the client to take its next 64 KB
// before it gives up on it. A variable so the test of a download nobody reads can
// wait a moment instead of a minute.
var exportIdle = 60 * time.Second

// idleDeadline writes to w with a fresh write deadline each time, exportIdle
// from now: a download is allowed as long as it takes, but not a pause that long.
type idleDeadline struct {
	w  http.ResponseWriter
	rc *http.ResponseController
}

func (d idleDeadline) Write(p []byte) (int, error) {
	_ = d.rc.SetWriteDeadline(time.Now().Add(exportIdle))
	return d.w.Write(p)
}

// writeMarkdownExport sends e as a Markdown download. The status and headers are
// sent before the first line, so a read that fails partway can only end the file
// early; the error is returned for the caller to log.
func writeMarkdownExport(w http.ResponseWriter, e mdExport) error {
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+e.filename+`"`)
	// A month of request lines is a large file, and the server's 60 s write
	// deadline is for answers, not downloads, so the deadline moves with each
	// 64 KB written instead (idleDeadline). Clearing it outright, as the backup
	// download does, would let a client that stopped reading — a phone asleep
	// mid-download, a stalled proxy — keep this handler for good.
	bw := bufio.NewWriterSize(idleDeadline{w: w, rc: http.NewResponseController(w)}, 64<<10)
	f := fence(e.longest)
	fmt.Fprintf(bw, "# %s\n\n%s\n\n%s\n", jobs.OneLine(e.heading), jobs.OneLine(e.about), f)
	err := e.lines(func(line string) error {
		_, err := bw.WriteString(line + "\n")
		return err
	})
	fmt.Fprintf(bw, "%s\n", f)
	if ferr := bw.Flush(); err == nil {
		err = ferr
	}
	return err
}
