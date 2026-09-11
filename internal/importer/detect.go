package importer

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strings"
	"unicode/utf8"
)

// The source slugs Detect answers with. They are the SAME strings the staging
// tables record in `source`, because a second vocabulary mapping onto the first
// is exactly the drift this file exists to remove.
const (
	SourceMarkdown        = "md"
	SourceReadestJSON     = "readest_json"
	SourceBookcision      = "bookcision"
	SourceKindleNotebook  = "kindle_notebook"
	SourceGoodreadsHTML   = "goodreads_html"
	SourceHardcoverHTML   = "hardcover_html"
	SourceIMDb            = "imdb"
	SourceKindleClippings = "kindle_clippings"
)

// detectHead caps how much of a file the signatures look at. Every mark below is
// written near the top by the tool that emits it — a `$format` key, a `data-page`
// attribute, an `id=` on the title element — except the clippings separator,
// which follows the first record. 512 KiB clears all of them and keeps the cost
// of sniffing a 5 MB upload bounded.
const detectHead = 512 << 10

var (
	// A Kindle clippings block separator: ten '=' in the wild, any run of five
	// accepted, alone on its line. kindle_clippings.go's own anchor.
	clipSepAnywhere = regexp.MustCompile(`(?m)^={5,}\r?$`)
	// The IMDb page's Next.js payload names the title it is about, in the shape
	// imdb.go reads it.
	imdbDataTitle = regexp.MustCompile(`"data":\{"title":\{"id":"tt\d+"`)
)

// Detect answers which parser owns these bytes, or "" when nothing does.
//
// IT IS GIVEN NO FILENAME, DELIBERATELY. Four of the seven sources this app has
// always supported are saved as `.html`, so the extension never decided anything
// — and a reader who saved an IMDb page as `imdb quotes` or a Readest export as
// `.txt` has not made a mistake worth a rejection. The `accept` list that used to
// sit on each source card was the operating system HIDING those files from them,
// silently, one dialog removed from the same wrong assumption.
//
// EVERY SIGNATURE BELOW IS A MARK THE FORMAT'S OWN WRITER ALWAYS EMITS, never an
// optional field. That rule is MarkdownKind's, and the bug that wrote it is why:
// detection there once rested on `director:` / `creator:` / a character binding,
// all optional, so a film with no director recorded and no character on any line
// re-imported its own export as a book, silently. Detect returns "" rather than
// guessing, and the caller then tries the parsers in order — a cost they were
// already built to bear, because each errors distinctively on a foreign file.
func Detect(data []byte) string {
	if !LooksLikeText(data) {
		return ""
	}
	head := data
	if len(head) > detectHead {
		head = head[:detectHead]
	}
	s := string(trimBOM(head))

	// JSON first, and Readest before Bookcision. They cannot actually collide —
	// Bookcision wants a top-level `title` and Readest's is at `book.title`, so
	// Bookcision fails cleanly rather than misparsing — but checking the
	// self-describing marker first makes that a rule instead of a coincidence.
	if first := firstNonBlank(s); strings.HasPrefix(first, "{") || strings.HasPrefix(first, "[") {
		if strings.Contains(s, `"$format"`) && strings.Contains(s, ReadestFormat) {
			return SourceReadestJSON
		}
		if bookcisionShape(data) {
			return SourceBookcision
		}
		// A JSON file that is neither is not going to become one further down: the
		// remaining signatures are all HTML or line-oriented text.
		return ""
	}

	switch {
	// The Kindle notebook page names its own title element.
	case strings.Contains(s, `id="annotationBookTitle"`), strings.Contains(s, "kp-notebook-metadata"):
		return SourceKindleNotebook
	// Goodreads needs BOTH marks: `authorOrTitle` alone appears on pages carrying
	// no quotes at all.
	case strings.Contains(s, `class="quoteText">`) && strings.Contains(s, `class="authorOrTitle"`):
		return SourceGoodreadsHTML
	// Hardcover requires the component name as well as the attribute: `data-page="`
	// is a generic Inertia attribute and would claim any other Inertia app's page.
	case strings.Contains(s, `data-page="`) && strings.Contains(s, "UserBookJournals"):
		return SourceHardcoverHTML
	case strings.Contains(s, "__NEXT_DATA__") && imdbDataTitle.MatchString(s):
		return SourceIMDb
	}

	// Markdown: the FIRST non-blank line is frontmatter or a heading — Markdown()'s
	// own detection, unchanged. Which markdown it is (book, catalogue, quotes or
	// anthology) stays MarkdownKind's decision at parse time rather than this
	// function's: one answer per file, made in one place.
	if first := firstNonBlank(s); first == "---" || strings.HasPrefix(first, "# ") {
		return SourceMarkdown
	}
	// Clippings last. A run of '=' alone on a line is the least specific mark here
	// and a markdown file can legitimately carry one as a setext rule, so it only
	// gets to answer once every more specific signature has declined.
	if clipSepAnywhere.MatchString(s) {
		return SourceKindleClippings
	}
	return ""
}

// firstNonBlank returns the file's first line with content, trimmed. The
// signatures that need it need only that one line, so this beats splitting half
// a megabyte into a slice to look at element zero.
func firstNonBlank(s string) string {
	for len(s) > 0 {
		line := s
		if i := strings.IndexByte(s, '\n'); i >= 0 {
			line, s = s[:i], s[i+1:]
		} else {
			s = ""
		}
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}

// bookcisionShape reports whether the bytes decode as a Bookcision export: an
// object with a non-empty top-level `title` and a `highlights` array.
//
// DECODED RATHER THAN PATTERN-MATCHED, because `"title"` and `"text"` are two of
// the commonest keys in JSON and a substring test over them would claim every
// other tool's export. Bookcision's own parser errors "bookcision: missing title"
// on a file without one, so this asks the same question it does.
func bookcisionShape(data []byte) bool {
	var probe struct {
		Title      string `json:"title"`
		Highlights []struct {
			Text string `json:"text"`
		} `json:"highlights"`
	}
	if json.Unmarshal(trimBOM(data), &probe) != nil {
		return false
	}
	return strings.TrimSpace(probe.Title) != "" && len(probe.Highlights) > 0
}

// NearMiss names a file that is definitely NOT an import, so the row can say what
// it is rather than "unrecognised".
//
// ONE DROP TARGET INVITES EVERY FILE A READER HAS, and answering "unrecognised"
// to a Tippani backup — or to the app's own export archive, which is a zip — is a
// worse failure than the wall of cards was. These are not politeness; they are
// the difference between a target a reader trusts and one they stop using. Each
// is one signature and one string.
//
// "" means the bytes are not a recognised near-miss either, which is the honest
// answer for a text file this build simply cannot read.
func NearMiss(data []byte) string {
	switch {
	// The backup archive's own magic (secret.js: ARCHIVE_MAGIC). Restore is a
	// different door with its own TIP-BACKUP-* codes, and it is gated on an empty
	// users table — nothing import could do with these bytes.
	case len(data) >= 4 && string(data[:4]) == "TPBK":
		return "backup"
	case len(data) >= 4 && data[0] == 'P' && data[1] == 'K' &&
		(data[2] == 3 || data[2] == 5 || data[2] == 7):
		// An EPUB is a zip too, and its `mimetype` entry is the first thing in the
		// archive by specification — so the more specific answer is decided inside
		// the zip case rather than in a branch that could never be reached after it.
		if bytes.Contains(data[:min(len(data), 4096)], []byte("application/epub+zip")) {
			return "epub"
		}
		return "zip"
	case len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n",
		len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF,
		len(data) >= 6 && (string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a"),
		len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image"
	case len(data) >= 4 && (string(data[:4]) == "OTTO" || string(data[:4]) == "wOFF" ||
		string(data[:4]) == "wOF2" || string(data[:4]) == "true" ||
		string(data[:4]) == "\x00\x01\x00\x00"):
		return "font"
	}
	if !LooksLikeText(data) {
		return "binary"
	}
	return ""
}

// LooksLikeText is the one cheap gate before any signature runs.
//
// Every format Tippani imports is text a person could open in an editor — HTML,
// JSON, Markdown, plain text — so this single check separates every near-miss
// above from every real import before one substring test runs. Valid UTF-8 with a
// BOM tolerated, exactly as the parsers already tolerate it, and no NUL in the
// head: a NUL is the one byte no text format emits and nearly every binary one
// does in its first block.
func LooksLikeText(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	head := trimBOM(data)
	const gate = 8 << 10
	whole := len(head) <= gate
	if !whole {
		head = head[:gate]
	}
	if bytes.IndexByte(head, 0) >= 0 {
		return false
	}
	// A rune cut in half at the 8 KiB boundary is not a broken file, so the UTF-8
	// check applies only when the whole file fits inside the gate.
	return !whole || utf8.Valid(head)
}

// trimBOM drops a leading UTF-8 byte-order mark. markdown.go strips its own off
// the first line and kindle_clippings.go strips every one in the file; this is
// the copy the byte-level checks above need, before either of them has a string
// to work on.
func trimBOM(data []byte) []byte {
	return bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
}
