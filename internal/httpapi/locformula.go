package httpapi

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// Bulk location formulae for the import staging queue (ROADMAP 1.2.0).
//
// Editing locations in bulk needs more than a text box: a Kindle export numbers
// by *location* rather than page and the conversion is a division; a PDF's page
// numbers run a few ahead of the print edition's. So the queue offers add,
// subtract, multiply, divide, set and reset over a selection.
//
// Locators are free text — "p.142", "610-612", "42%", "1234", "01:02:03" — and
// stay free text. A transform therefore rewrites the NUMBERS inside the string
// and leaves everything around them exactly as it was: "p.142" minus 5 is
// "p.137", and a range moves at both ends because both ends are numbers.
//
// Timestamps are the one shape where digit-by-digit arithmetic would be wrong
// ("01:02:03" plus 60 seconds is not "61:62:63"), so a value containing a time
// pattern converts to seconds, shifts, and re-renders with the component count
// and zero-padding it arrived with. Detection is by VALUE, not by which field was
// picked: a staged row carries both locator sets so it can be retargeted across
// kinds, and an audiobook "location" of 2:15:00 deserves the same treatment as a
// film timestamp.
//
// Results clamp at zero and division rounds to the precision the input showed.
// Nothing here compounds silently: staged_quotes keeps location_orig /
// timestamp_orig, and `reset` restores that as-imported snapshot, so a formula
// applied by mistake is undone rather than lived with.

// Formula operations. Names are spelled out rather than symbolic so the wire
// format reads the way the UI labels it.
const (
	locOpAdd      = "add"
	locOpSubtract = "subtract"
	locOpMultiply = "multiply"
	locOpDivide   = "divide"
	locOpSet      = "set"
	locOpReset    = "reset"
)

// locFormula is the wire shape of one bulk locator transform.
type locFormula struct {
	Field string  `json:"field"` // location | timestamp
	Op    string  `json:"op"`
	Value float64 `json:"value"` // add/subtract/multiply/divide
	Text  string  `json:"text"`  // set
}

// validate reports a client-facing message, or "" when the formula is usable.
func (f *locFormula) validate() string {
	f.Field = strings.TrimSpace(f.Field)
	if f.Field == "" {
		f.Field = "location"
	}
	if f.Field != "location" && f.Field != "timestamp" {
		return "formula field must be location or timestamp"
	}
	f.Op = strings.ToLower(strings.TrimSpace(f.Op))
	switch f.Op {
	case locOpAdd, locOpSubtract, locOpMultiply, locOpDivide:
		if math.IsNaN(f.Value) || math.IsInf(f.Value, 0) {
			return "formula value must be a number"
		}
		if f.Op == locOpDivide && f.Value == 0 {
			return "cannot divide a location by zero"
		}
	case locOpSet:
		var ok bool
		if f.Text, ok = trimCap(f.Text, 128); !ok {
			return "formula text too long (max 128 characters)"
		}
	case locOpReset:
	default:
		return "formula op must be add, subtract, multiply, divide, set or reset"
	}
	return ""
}

// timePattern finds a clock-shaped run: M:SS, MM:SS, H:MM:SS or HH:MM:SS. The
// minute and second fields must be two digits, which is what tells a timestamp
// apart from a chapter:verse locator like "3:1" — that one takes the plain numeric
// path. A match is only treated as a clock when it is NOT touching a digit on
// either side: "2:255" matches "2:25" partially, and rewriting that would leave
// the stray "5" stranded beside a re-rendered time, which is wrong under every
// reading. Only matched runs are rewritten, so "~01:02:03" keeps its tilde.
var timePattern = regexp.MustCompile(`(\d{1,3}):([0-5]\d)(?::([0-5]\d))?`)

// numberPattern finds one numeric run: a decimal part so "12.5%" shifts as a
// single number rather than as a 12 and a 5, and comma groups so "1,234" is one
// number too. The group alternative needs digits on both sides of the comma, which
// leaves a comma-separated LIST ("12, 15") to be shifted element by element.
var numberPattern = regexp.MustCompile(`\d+(?:,\d{3})+|\d+(?:\.\d+)?`)

// maxLocNumber caps a rewritten locator. Locators are page numbers, Kindle
// locations and percentages: a quadrillion is already absurd, and the cap is what
// stops a multiply from reaching +Inf (which formatted as the literal "+Inf") or
// overflowing the int64 conversion in shiftTimestamp (which produced a NEGATIVE
// clock). Clamping beats rejecting: the row is still staged, and reset undoes it.
const maxLocNumber = 1e15

// applyLocFormula returns cur rewritten by the formula. orig is the as-imported
// snapshot, used only by reset. An empty cur stays empty for the arithmetic ops:
// a row that never had a location must not acquire a "0".
func applyLocFormula(f *locFormula, cur, orig string) string {
	switch f.Op {
	case locOpReset:
		return orig
	case locOpSet:
		return f.Text
	}
	if strings.TrimSpace(cur) == "" {
		return cur
	}
	// Clocks first, every one of them: a timestamp range ("01:02:03 - 01:04:10")
	// has to move at both ends, exactly as a page range does.
	if out, hit := shiftClocks(f, cur); hit {
		return out
	}
	return numberPattern.ReplaceAllStringFunc(cur, func(run string) string {
		bare := strings.ReplaceAll(run, ",", "")
		n, err := strconv.ParseFloat(bare, 64)
		if err != nil { // unreachable for this pattern; leave the text alone if it ever is
			return run
		}
		return renderNumber(run, arith(f, n))
	})
}

// shiftClocks rewrites every clock run in cur that is not adjacent to a digit,
// reporting whether it found one. When it finds none the caller falls through to
// the plain numeric path, so "2:255" shifts as a 2 and a 255.
func shiftClocks(f *locFormula, cur string) (string, bool) {
	spans := timePattern.FindAllStringIndex(cur, -1)
	if spans == nil {
		return cur, false
	}
	isDigit := func(b byte) bool { return b >= '0' && b <= '9' }
	var b strings.Builder
	last, hit := 0, false
	for _, span := range spans {
		start, end := span[0], span[1]
		if (start > 0 && isDigit(cur[start-1])) || (end < len(cur) && isDigit(cur[end])) {
			continue // a partial match inside a longer number run — not a clock
		}
		hit = true
		b.WriteString(cur[last:start])
		b.WriteString(shiftTimestamp(f, cur[start:end]))
		last = end
	}
	if !hit {
		return cur, false
	}
	b.WriteString(cur[last:])
	return b.String(), true
}

// arith applies the operation and clamps the result into [0, maxLocNumber] — a
// page number below the front cover is not a fact about the book, it is a formula
// that overshot, and neither is a page number past +Inf.
func arith(f *locFormula, n float64) float64 {
	switch f.Op {
	case locOpAdd:
		n += f.Value
	case locOpSubtract:
		n -= f.Value
	case locOpMultiply:
		n *= f.Value
	case locOpDivide:
		n /= f.Value // validate() rejected a zero divisor
	}
	switch {
	case math.IsNaN(n) || n < 0:
		return 0
	case n > maxLocNumber: // includes +Inf
		return maxLocNumber
	}
	return n
}

// renderNumber writes n back in the shape the input had: the same number of
// decimal places (so an integer stays an integer and division rounds), and the
// same zero padding, so "p.007" plus one is "p.008" rather than "p.8".
func renderNumber(orig string, n float64) string {
	// A grouped number keeps its grouping: "1,234" plus one is "1,235".
	if strings.ContainsRune(orig, ',') {
		return groupDigits(renderNumber(strings.ReplaceAll(orig, ",", ""), n))
	}
	decimals := 0
	if dot := strings.IndexByte(orig, '.'); dot >= 0 {
		decimals = len(orig) - dot - 1
	}
	// Round half away from zero, the way a reader expects "1234 ÷ 2 rounds" to
	// behave. FormatFloat alone rounds half to EVEN, which would make 5 ÷ 2 = 2.
	scale := math.Pow(10, float64(decimals))
	out := strconv.FormatFloat(math.Round(n*scale)/scale, 'f', decimals, 64)
	if len(orig) > 1 && orig[0] == '0' && orig != "0" {
		// Pad the integer part back to the original width.
		intWidth := len(orig)
		if decimals > 0 {
			intWidth = strings.IndexByte(orig, '.')
		}
		intPart, frac := out, ""
		if dot := strings.IndexByte(out, '.'); dot >= 0 {
			intPart, frac = out[:dot], out[dot:]
		}
		for len(intPart) < intWidth {
			intPart = "0" + intPart
		}
		out = intPart + frac
	}
	return out
}

// groupDigits re-inserts thousands separators into the integer part, so a grouped
// locator stays grouped after a shift.
func groupDigits(s string) string {
	intPart, frac := s, ""
	if dot := strings.IndexByte(s, '.'); dot >= 0 {
		intPart, frac = s[:dot], s[dot:]
	}
	var b strings.Builder
	for i, r := range intPart {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(r)
	}
	return b.String() + frac
}

// shiftTimestamp converts a clock run to seconds, applies the operation, and
// re-renders it with the component count and leading-zero width it arrived with.
// Two-component values keep two components, so "12:30" plus a minute is "13:30"
// and a shift past the hour reads "75:00" rather than silently growing a field.
func shiftTimestamp(f *locFormula, run string) string {
	m := timePattern.FindStringSubmatch(run)
	if m == nil { // caller matched it; defensive only
		return run
	}
	parts := []string{m[1], m[2]}
	if m[3] != "" {
		parts = append(parts, m[3])
	}
	total := 0.0
	for _, p := range parts {
		v, err := strconv.Atoi(p)
		if err != nil {
			return run
		}
		total = total*60 + float64(v)
	}
	secs := int64(math.Round(arith(f, total)))
	if len(parts) == 2 {
		return fmt.Sprintf("%0*d:%02d", len(parts[0]), secs/60, secs%60)
	}
	return fmt.Sprintf("%0*d:%02d:%02d", len(parts[0]), secs/3600, (secs/60)%60, secs%60)
}
