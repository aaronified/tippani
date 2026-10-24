package srcmatch

import "strings"

// Options says how a span is cut around a match.
//
// The two bounds are the plan's "boundary beats every setting": a chapter start has
// nothing before it IN THE CHAPTER, so the extractor does not cross out of one, and
// nobody has to discover and type a zero. A subtitle has no chapters; a long silence
// is the weaker stand-in, defaulted by the caller and never described as a scene
// break (nine stops in a two-hour film is an absurdity stop, not scene detection).
type Options struct {
	// MaxGapMs stops a span at a silence longer than this between two cues. Zero
	// turns it off, which is what paragraphs want.
	MaxGapMs int64
	// MinChars is the character floor: keep taking whole units outward until at least
	// this many characters are held on a side, unless a boundary stops it first. It
	// exists because a paragraph can be short (a 91-character median in the owner's
	// novel) and two of them are not enough to read. It ROUNDS OUTWARD to the next
	// unit and never cuts at the character it reached.
	MinChars int
	// Sep joins units into text: "\n" for cues, "\n\n" for paragraphs.
	Sep string
}

// Context is a matched span with what surrounds it, as the FILE has it: Body is the
// file's words and not the reader's, because a quote they tidied and the line as
// published are both worth seeing and only one of them is here.
type Context struct {
	Before, Body, After string
	// TookBefore and TookAfter are how many units were taken on each side: the stored
	// pair, which is what lets the panel render a narrower window out of it without
	// the file.
	TookBefore, TookAfter int
	// BoundBefore / BoundAfter say the span ran out at a chapter edge, a long silence
	// or the end of the work rather than at the ceiling, so a short span is short
	// because the work is and never reads as short because the app is broken.
	BoundBefore, BoundAfter bool
	// Start and End are the body's first and last cue times in milliseconds, 0 for
	// paragraphs.
	Start, End int64
}

// Context cuts the span around m. wantBefore and wantAfter are in units (cues or
// paragraphs) and are independent: "nothing before, two after" is the chapter-start
// case, so a single amount could not express the feature.
func (ix *Index) Context(m Match, wantBefore, wantAfter int, o Options) Context {
	us := ix.units
	c := Context{Start: us[m.First].Start, End: us[m.Last].End}
	c.Body = joinUnits(us[m.First:m.Last+1], o.Sep)

	var before []Unit
	chars := 0
	stopped := false
	for i := m.First - 1; i >= 0; i-- {
		if crosses(us[i], us[i+1], o, true) {
			c.BoundBefore = true
			break
		}
		if len(before) >= wantBefore && chars >= o.MinChars {
			stopped = true
			break
		}
		if strings.TrimSpace(us[i].Text) == "" {
			continue
		}
		before = append([]Unit{us[i]}, before...)
		chars += len(us[i].Text)
	}
	// Running out of file short of the ceiling is a boundary too, the quiet one: the
	// start of the work.
	if !c.BoundBefore && !stopped && len(before) < wantBefore {
		c.BoundBefore = true
	}

	var after []Unit
	chars = 0
	stopped = false
	for i := m.Last + 1; i < len(us); i++ {
		if crosses(us[i], us[i-1], o, false) {
			c.BoundAfter = true
			break
		}
		if len(after) >= wantAfter && chars >= o.MinChars {
			stopped = true
			break
		}
		if strings.TrimSpace(us[i].Text) == "" {
			continue
		}
		after = append(after, us[i])
		chars += len(us[i].Text)
	}
	if !c.BoundAfter && !stopped && len(after) < wantAfter {
		c.BoundAfter = true
	}

	c.Before, c.After = joinUnits(before, o.Sep), joinUnits(after, o.Sep)
	c.TookBefore, c.TookAfter = len(before), len(after)
	return c
}

// crosses reports whether stepping from near (inside what has been taken) to far
// (the next candidate) would leave the chapter or span a long silence.
func crosses(far, near Unit, o Options, backwards bool) bool {
	if far.Doc != near.Doc {
		return true
	}
	if o.MaxGapMs > 0 {
		gap := far.Start - near.End
		if backwards {
			gap = near.Start - far.End
		}
		if gap > o.MaxGapMs {
			return true
		}
	}
	return false
}

func joinUnits(us []Unit, sep string) string {
	parts := make([]string, 0, len(us))
	for _, u := range us {
		if t := strings.TrimSpace(u.Text); t != "" {
			parts = append(parts, t)
		}
	}
	return strings.Join(parts, sep)
}
