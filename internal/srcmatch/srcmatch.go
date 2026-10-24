// Package srcmatch finds where a quote sits inside the file it came from.
//
// It is the one algorithm both halves of docs/plans/work-source-files.md and
// docs/plans/locators-from-files.md need: context cannot be cut from a file until
// the quote has been found in it, and a position cannot be proposed for one either.
// The file's lines arrive as Units (a subtitle's cues, an ebook's paragraphs); a
// quote comes back as a range of them.
//
// IT IS TOLERANT ON BOTH SIDES, because neither side is clean (the owner: free-text
// searches "need to be accepting of small deviations in the text and the quote").
// Measured on the owner's own film, 30 of 30 stored lines found their place: 12
// verbatim after the fold, 12 within 5% edit distance, 6 within 15%, none missed.
// The deviations are real — a subtitle file with every accented letter dropped
// ("Voilà" printed as "Voil "), a reader's own tidied punctuation, an ellipsis
// where two passages were joined, a word the reader mistyped.
//
// So the match is: fold both sides, align the quote to the best-fitting stretch of
// the file by edit distance with a free start and a free end ("align, do not
// window"), and accept it only within a budget that scales with the quote's length.
// A short line ("Yes.") would match a dozen places, so ambiguity is REPORTED rather
// than resolved — a guess about where a quote sits is worse than saying it sits in
// several places.
//
// Everything here is pure: no database, no file, no HTTP. The tests are fixtures.
package srcmatch

import (
	"sort"
	"strings"
	"unicode"

	"tippani/internal/store"
)

// Unit is one line of the file as the file has it: a cue, or a paragraph. Doc is
// the chapter the unit belongs to (an EPUB's spine document; 0 for a subtitle),
// which is what the extractor refuses to cross. Start and End are milliseconds for
// a cue and zero for a paragraph.
type Unit struct {
	Text  string
	Doc   int
	Start int64
	End   int64
}

// Fold is the lossy comparison form: both sides pass through it before anything is
// measured. It builds on the dedupe fold (store.CastKey: smart punctuation to ASCII,
// lower case, whitespace collapsed) and then goes further, because the same words
// arrive differently from different files:
//
//   - accents are dropped ("Voilà" and "Voila" are one word; a subtitle that lost the
//     letter altogether is handled by the edit budget, not here);
//   - apostrophes vanish ("don't" and "dont" and "don’t"), while every other
//     punctuation mark becomes a space, so "well—well" is two words;
//   - what is left is letters and digits, single-spaced.
//
// The owner's rule for fuzzy matching: "all punctuation, timestamp will be ignored".
func Fold(s string) string {
	s = store.CastKey(s)
	var b strings.Builder
	b.Grow(len(s))
	space := true // swallow leading separators
	for _, r := range s {
		switch {
		case r == '\'' || r == '`':
			continue // joins, never splits
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(base(r))
			space = false
		default:
			if !space {
				b.WriteByte(' ')
				space = true
			}
		}
	}
	return strings.TrimRight(b.String(), " ")
}

// base drops the accent from a Latin letter. A table rather than Unicode
// decomposition: the dependency budget here is three modules, and the letters that
// matter are the Latin-1 and Latin Extended-A ranges a book or a subtitle actually
// carries. A rune outside the table is returned unchanged, so a non-Latin script is
// compared as itself.
func base(r rune) rune {
	if r < 0xC0 {
		return r
	}
	if b, ok := accentBase[r]; ok {
		return b
	}
	return r
}

var accentBase = func() map[rune]rune {
	m := map[rune]rune{}
	add := func(base rune, accented string) {
		for _, r := range accented {
			m[r] = base
		}
	}
	add('a', "àáâãäåāăą")
	add('c', "çćĉċč")
	add('d', "ďđ")
	add('e', "èéêëēĕėęě")
	add('g', "ĝğġģ")
	add('h', "ĥħ")
	add('i', "ìíîïĩīĭįı")
	add('j', "ĵ")
	add('k', "ķ")
	add('l', "ĺļľŀł")
	add('n', "ñńņňŉ")
	add('o', "òóôõöøōŏő")
	add('r', "ŕŗř")
	add('s', "śŝşš")
	add('t', "ţťŧ")
	add('u', "ùúûüũūŭůűų")
	add('w', "ŵ")
	add('y', "ýÿŷ")
	add('z', "źżž")
	// Ligatures and the German sharp s fold to their first letter: the second is
	// what a lossy file drops, and the budget absorbs it.
	m['æ'], m['œ'], m['ß'] = 'a', 'o', 's'
	return m
}()

// Index is a file's units folded and laid end to end, with everything needed to
// answer "where is this quote" quickly and to map a position back to a unit.
type Index struct {
	units  []Unit
	hay    []rune
	unitOf []int32            // rune offset → index in units
	words  map[string][]int32 // folded word → rune offsets where it starts
}

// NewIndex folds and indexes units. Units whose text folds to nothing (a line of
// "...", a music note) take no space in the haystack and can never be matched, but
// keep their place in the sequence for the extractor.
func NewIndex(units []Unit) *Index {
	ix := &Index{units: units, words: map[string][]int32{}}
	for i, u := range units {
		f := Fold(u.Text)
		if f == "" {
			continue
		}
		if len(ix.hay) > 0 {
			ix.hay = append(ix.hay, ' ')
			ix.unitOf = append(ix.unitOf, int32(i))
		}
		off := len(ix.hay)
		ix.hay = append(ix.hay, []rune(f)...)
		for range []rune(f) {
			ix.unitOf = append(ix.unitOf, int32(i))
		}
		// Words, by their start offset within the haystack.
		start := -1
		for k := off; k <= len(ix.hay); k++ {
			inWord := k < len(ix.hay) && ix.hay[k] != ' '
			if inWord && start < 0 {
				start = k
			}
			if !inWord && start >= 0 {
				w := string(ix.hay[start:k])
				ix.words[w] = append(ix.words[w], int32(start))
				start = -1
			}
		}
	}
	return ix
}

// Units returns the units the index was built over, in order.
func (ix *Index) Units() []Unit { return ix.units }

// Match is one place a quote was found: the units it spans and how well it fits.
type Match struct {
	First, Last int // indexes into Units(), inclusive
	Dist        int // edit distance between the folded quote and the folded stretch
	Ratio       float64
}

// Exact is true when the folded quote and the folded stretch are identical.
func (m Match) Exact() bool { return m.Dist == 0 }

// Result is what Find answers.
type Result struct {
	// Found is false when nothing fits within the budget. Everything else is then zero.
	Found bool
	Match Match
	// Ambiguous is true when a second place fits nearly as well, so the first is
	// not a place to trust. Alternatives lists the others, best first.
	Ambiguous    bool
	Alternatives []Match
}

// budget is how many edits a quote of n folded characters may differ by and still
// be called the same words. It scales with length — a flat ratio is too loose for a
// short line and too tight for a paragraph — and a very short quote must be exact,
// since a couple of edits turn one short word into another.
func budget(n int) int {
	if n < 8 {
		return 0
	}
	return (n*15 + 99) / 100 // ceil(15%)
}

// Find locates a quote in the file. The quote may be any text; it is folded here.
func (ix *Index) Find(quote string) Result {
	q := []rune(Fold(quote))
	m := len(q)
	if m == 0 || len(ix.hay) == 0 {
		return Result{}
	}
	bud := budget(m)

	cands := ix.candidates(q)
	var found []Match
	for _, c := range cands {
		if mt, ok := ix.align(q, c, bud); ok {
			found = append(found, mt)
		}
	}
	if len(found) == 0 {
		return Result{}
	}
	sort.SliceStable(found, func(i, j int) bool {
		if found[i].Dist != found[j].Dist {
			return found[i].Dist < found[j].Dist
		}
		return found[i].First < found[j].First
	})
	// Distinct places only: two regions that landed on overlapping units are one
	// place found twice.
	var places []Match
	for _, f := range found {
		dup := false
		for _, p := range places {
			if f.First <= p.Last && p.First <= f.Last {
				dup = true
				break
			}
		}
		if !dup {
			places = append(places, f)
		}
	}
	res := Result{Found: true, Match: places[0]}
	if len(places) > 1 {
		// The margin is what "clearly better" means: a second place within one
		// 5%-of-the-quote step of the best is a tie as far as anyone can tell.
		margin := max(1, m/20)
		for _, p := range places[1:] {
			if p.Dist-places[0].Dist < margin {
				res.Ambiguous = true
			}
			res.Alternatives = append(res.Alternatives, p)
		}
	}
	return res
}

// region is a stretch of the haystack worth aligning the quote against.
type region struct{ from, to int }

// candidates picks where to align. Edit distance of the quote against every offset
// of a whole book is O(n·m) — 1.5 MB by 200 characters is hundreds of millions of
// steps for ONE quote — so the words decide WHERE to look: the quote's rarer words
// are looked up in the file's word index, every occurrence votes for the diagonal it
// implies, and the best-supported few diagonals become regions. The filter chooses
// where to align, never how far to reach.
func (ix *Index) candidates(q []rune) []region {
	m := len(q)
	type qw struct {
		w   string
		off int
		n   int // occurrences in the file
	}
	var ws []qw
	start := -1
	for k := 0; k <= m; k++ {
		inWord := k < m && q[k] != ' '
		if inWord && start < 0 {
			start = k
		}
		if !inWord && start >= 0 {
			w := string(q[start:k])
			ws = append(ws, qw{w: w, off: start, n: len(ix.words[w])})
			start = -1
		}
	}
	// Rarest first, skipping words the file does not have at all (a typo or a dropped
	// letter); a quote with no word in common falls through to nothing.
	sort.SliceStable(ws, func(i, j int) bool { return ws[i].n < ws[j].n })
	const maxWords, maxOccur = 8, 4000
	votes := map[int]int{}
	used := 0
	for _, w := range ws {
		if w.n == 0 || w.n > maxOccur {
			continue
		}
		if used >= maxWords {
			break
		}
		used++
		for _, pos := range ix.words[w.w] {
			votes[int(pos)-w.off]++
		}
	}
	if len(votes) == 0 {
		return nil
	}
	// Diagonals that fall within half a quote of each other are one place: the same
	// passage voted for by several of its words, a little out of step because of
	// an edit between them. Anything further apart is a different place, and must get
	// a region of its own or a nearby repeat is shadowed by the first.
	diags := make([]int, 0, len(votes))
	for d := range votes {
		diags = append(diags, d)
	}
	sort.Ints(diags)
	type cluster struct{ lo, hi, n int }
	var cs []cluster
	gap := m/2 + 4
	for _, d := range diags {
		if k := len(cs) - 1; k >= 0 && d-cs[k].hi <= gap {
			cs[k].hi = d
			cs[k].n += votes[d]
			continue
		}
		cs = append(cs, cluster{d, d, votes[d]})
	}
	sort.SliceStable(cs, func(i, j int) bool { return cs[i].n > cs[j].n })
	const maxRegions = 12
	if len(cs) > maxRegions {
		cs = cs[:maxRegions]
	}
	pad := budget(m) + 4
	var out []region
	for _, c := range cs {
		out = append(out, region{max(0, c.lo-pad), min(len(ix.hay), c.hi+m+pad)})
	}
	return out
}

// align finds the best-fitting substring of one region: Sellers' variant of
// Wagner–Fischer, with row zero all zeros (the stretch may START anywhere) and the
// answer read off the last row's minimum (it may END anywhere). The start of the
// best alignment is carried through the table so the span falls out without a
// traceback.
func (ix *Index) align(q []rune, r region, bud int) (Match, bool) {
	hay := ix.hay[r.from:r.to]
	m, n := len(q), len(hay)
	if n == 0 {
		return Match{}, false
	}
	prevD := make([]int, n+1)
	prevS := make([]int, n+1)
	curD := make([]int, n+1)
	curS := make([]int, n+1)
	for j := 0; j <= n; j++ {
		prevD[j], prevS[j] = 0, j
	}
	for i := 1; i <= m; i++ {
		curD[0], curS[0] = i, 0
		for j := 1; j <= n; j++ {
			cost := 1
			if q[i-1] == hay[j-1] {
				cost = 0
			}
			// Diagonal, then up (a quote character the stretch lacks), then left
			// (a stretch character the quote lacks). Ties prefer the diagonal and so
			// the shorter, tighter span.
			d, s := prevD[j-1]+cost, prevS[j-1]
			if v := prevD[j] + 1; v < d {
				d, s = v, prevS[j]
			}
			if v := curD[j-1] + 1; v < d {
				d, s = v, curS[j-1]
			}
			curD[j], curS[j] = d, s
		}
		prevD, curD = curD, prevD
		prevS, curS = curS, prevS
	}
	bestJ, bestD := -1, bud+1
	for j := 1; j <= n; j++ {
		// The shortest stretch among equals, so a trailing space or a neighbour's
		// first letters are not swept in for free.
		if prevD[j] < bestD {
			bestD, bestJ = prevD[j], j
		}
	}
	if bestJ < 0 {
		return Match{}, false
	}
	from, to := r.from+prevS[bestJ], r.from+bestJ // [from, to)
	for from < to && ix.hay[from] == ' ' {
		from++
	}
	if from >= to {
		return Match{}, false
	}
	// A verbatim hit that starts or ends inside a word is not the quote ("yes" is in
	// "yesterday"). A fuzzy one may, since a dropped space is one of the deviations
	// the budget exists for.
	if bestD == 0 && !(ix.boundary(from-1) && ix.boundary(to)) {
		return Match{}, false
	}
	return Match{
		First: int(ix.unitOf[from]),
		Last:  int(ix.unitOf[to-1]),
		Dist:  bestD,
		Ratio: float64(bestD) / float64(m),
	}, true
}

// boundary reports whether offset k in the haystack is a word edge: before the start,
// after the end, or a space.
func (ix *Index) boundary(k int) bool {
	return k < 0 || k >= len(ix.hay) || ix.hay[k] == ' '
}
