package jobs

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"tippani/internal/outbound"
)

// THE ONE DOOR. Everything the logbook keeps — a system line, a job's line, an
// in-request job's lines, a job's error, a job's subject — passes through clean
// before it is buffered, and nothing reaches the log tables any other way.
//
// Why one door rather than care at each call site: the text arriving here is
// mostly not the app's own. It is a provider's error ("Get "https://…?key=…":
// dial tcp …"), a title a reader typed, a file name an import was handed, a
// request path a stranger chose. Any of those can carry a key, a line break
// that forges a second log line, or an escape sequence that repaints the
// terminal of whoever cats an export. A rule enforced at forty call sites is
// enforced at thirty-nine.

const (
	// capShort is the ceiling for request and file lines: one per request, so
	// the log's bulk, and nothing a person needs past two kilobytes of.
	capShort = 2 << 10
	// capLong is the ceiling for everything else: an error with its cause
	// chain, a job's line naming what it found.
	capLong = 8 << 10
	// subjectRunes is a job's subject's ceiling. A subject is data shown in a
	// title — a searched name, a file name — so it is cut in characters, not
	// bytes, and ends in an ellipsis rather than a byte count.
	subjectRunes = 200
)

// clean makes s safe to keep as one log line at level: line breaks become ⏎,
// control characters and terminal escape sequences go, invalid UTF-8 becomes
// U+FFFD, every URL loses its secrets (outbound.RedactText), and the result is
// cut to the level's ceiling, ending "… N bytes cut".
//
// The order matters: redaction runs before the cut, so the cut is made on the
// text that is kept, its count of bytes cut is true, and nothing changes the line
// after it is cut — redacting afterwards could push a line past its ceiling (a
// one- or two-byte value becomes the three-byte "…"). And clean(clean(s)) ==
// clean(s), so a line cleaned early (a *Lazy cleans as it collects) passes the
// door again unchanged.
func clean(level, s string) string {
	return capBytes(outbound.RedactText(stripControls(s)), capFor(level))
}

// cleanSubject is clean for a job's subject: the same stripping and redaction,
// cut at subjectRunes characters.
func cleanSubject(s string) string {
	s = strings.TrimSpace(outbound.RedactText(stripControls(s)))
	if utf8.RuneCountInString(s) <= subjectRunes {
		return s
	}
	r := []rune(s)
	return string(r[:subjectRunes-1]) + "…"
}

func capFor(level string) int {
	if level == LevelRequest || level == LevelAsset {
		return capShort
	}
	return capLong
}

// stripControls is clean's first pass. CR LF (or a lone CR or LF) becomes one ⏎,
// so a multi-line error stays one line that says where it broke, and a newline
// in a request path cannot start a forged line of its own. Tab stays. Every
// other C0 and C1 control goes, DEL too, and so does every ESC sequence with
// its parameters (CSI, OSC and its string-type relatives, and the two-byte
// kind), so an export opened in a terminal prints what was logged and not what
// the text told the terminal to do.
func stripControls(s string) string {
	s = strings.ToValidUTF8(s, "�")
	if !needsStripping(s) {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		switch {
		case r == '\r':
			b.WriteString("⏎")
			i += size
			if i < len(s) && s[i] == '\n' {
				i++
			}
			continue
		case r == '\n':
			b.WriteString("⏎")
		case r == 0x1b:
			i += escLen(s[i:])
			continue
		case r == 0x9b: // C1 CSI: the one-character spelling of ESC [
			i += size + csiTail(s[i+size:])
			continue
		case r == '\t':
			b.WriteByte('\t')
		case r < 0x20 || r == 0x7f || (r >= 0x80 && r <= 0x9f):
			// dropped
		default:
			b.WriteString(s[i : i+size])
		}
		i += size
	}
	return b.String()
}

// needsStripping is stripControls' fast path: most lines are plain text, and a
// request line is written for every request.
func needsStripping(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < 0x20 && c != '\t' || c == 0x7f {
			return true
		}
		// U+0080..U+009F are C2 80..C2 9F in UTF-8.
		if c == 0xc2 && i+1 < len(s) && s[i+1] >= 0x80 && s[i+1] <= 0x9f {
			return true
		}
	}
	return false
}

// escLen is how many bytes of s (which starts with ESC) the escape sequence
// takes. A string-type sequence (OSC and DCS, SOS, PM, APC) runs to BEL or
// ESC \; one with no terminator loses only its two introducing bytes, so a
// stray ESC ] cannot swallow the rest of the line.
func escLen(s string) int {
	if len(s) < 2 {
		return len(s)
	}
	switch s[1] {
	case '[':
		return 2 + csiTail(s[2:])
	case ']', 'P', 'X', '^', '_':
		for j := 2; j < len(s); j++ {
			if s[j] == 0x07 {
				return j + 1
			}
			if s[j] == 0x1b && j+1 < len(s) && s[j+1] == '\\' {
				return j + 2
			}
		}
		return 2
	}
	// ESC, intermediates (0x20-0x2F), one final byte.
	j := 1
	for j < len(s) && s[j] >= 0x20 && s[j] <= 0x2f {
		j++
	}
	if j < len(s) && s[j] >= 0x30 && s[j] <= 0x7e {
		j++
	}
	return j
}

// csiTail is the length of a control sequence's parameters, intermediates and
// final byte, after its introducer.
func csiTail(s string) int {
	j := 0
	for j < len(s) && s[j] >= 0x30 && s[j] <= 0x3f {
		j++
	}
	for j < len(s) && s[j] >= 0x20 && s[j] <= 0x2f {
		j++
	}
	if j < len(s) && s[j] >= 0x40 && s[j] <= 0x7e {
		j++
	}
	return j
}

// capBytes cuts s to at most limit bytes, the cut on a character boundary and
// the ending saying how many bytes went: "… 1234 bytes cut". The ending counts
// against the limit, so the stored line never exceeds it.
func capBytes(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	// The count can only be shorter than len(s) in digits, so reserving room
	// for that many is always enough.
	reserve := len("…  bytes cut") + len(strconv.Itoa(len(s)))
	keep := limit - reserve
	for keep > 0 && !utf8.RuneStart(s[keep]) {
		keep--
	}
	return s[:keep] + "… " + strconv.Itoa(len(s)-keep) + " bytes cut"
}

// codeShape is what a system line's code must look like to be kept as one: the
// shape olog's codes take (TIP-<SUBSYS>-<NNN>). Anything else is text, and stays
// in the line.
var codeShape = regexp.MustCompile(`^TIP-[A-Z]+-[0-9]+$`)
