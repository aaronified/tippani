package search

import "strings"

// VocabTerm is one indexed term and its document frequency (fts5vocab 'row'
// doc), used as the popularity tie-breaker when several terms are equally close.
type VocabTerm struct {
	Term string
	Doc  int64
}

// Correct applies bounded typo correction to a query's tokens against the
// indexed vocabulary, for the zero-hit fuzzy-search pass (docs/PLAN.md §4). It is
// a pure function: the handler harvests candidate terms from the fts5vocab
// tables and passes them in; the corrected tokens flow back through PrefixQuery,
// so the raw-input-never-reaches-MATCH invariant is preserved.
//
// A token is left UNCHANGED when it is too short to correct (< 3 runes), is one
// of the candidate terms, or is a prefix of one — the last case preserves
// PrefixQuery typeahead semantics ("shaw" is a live prefix of "shawshank", not a
// typo). The prefix check only sees the terms the caller passes in, so the
// handler harvests without an upper length bound for the prefix (last) token so
// longer targets are visible; a token that only prefixes an out-of-harvest term
// falls through to correction, which is harmless (the re-run is user-scoped).
// Otherwise it is replaced by the nearest term within an edit-distance budget
// (1 for 3–5 runes, 2 for longer), tie-broken by lowest distance, then highest
// doc frequency, then lexicographically for determinism.
//
// lastIsPrefix enables prefix edit distance on the final token (typeahead: a
// typo in a word still being typed corrects toward the longer term). changed
// reports whether any token was actually replaced — the caller only re-runs the
// search when it was.
func Correct(tokens []string, vocab []VocabTerm, lastIsPrefix bool) (out []string, changed bool) {
	out = make([]string, len(tokens))
	copy(out, tokens)
	for i, tok := range tokens {
		folded := strings.ToLower(tok)
		runes := []rune(folded)
		budget := budgetFor(len(runes))
		if budget == 0 {
			continue // too short to correct
		}
		if isLivePrefix(folded, vocab) {
			continue // an indexed term, or a prefix of one — not a typo
		}
		usePrefix := lastIsPrefix && i == len(tokens)-1
		if best, ok := nearest(runes, budget, usePrefix, vocab); ok && best != folded {
			out[i] = best
			changed = true
		}
	}
	return out, changed
}

// Window returns the indexed-term length range worth harvesting to correct these
// tokens — the union of each correctable token's [len-budget, len+budget] — and
// ok=false when no token is correctable (so the caller can skip the fuzzy pass).
// It bounds the correction CANDIDATE SET the handler feeds to Correct, keeping
// the budget rule in one place.
//
// hi==0 is the "no upper bound" sentinel: when lastIsPrefix and the final token
// is correctable, that token is scored in prefix-distance mode (editDistance
// prefix=true), which matches a short typed token against an arbitrarily LONGER
// term the user is still typing toward ("shawsq" -> "shawshank"). Capping its
// length would silently drop those targets, so the whole harvest goes unbounded
// above; the lower bound still holds (matching a much shorter term needs
// deletions beyond the budget). The handler pairs hi==0 with a popularity LIMIT
// so an unbounded length range can't harvest the entire vocabulary.
func Window(tokens []string, lastIsPrefix bool) (lo, hi int, ok bool) {
	unbounded := false
	for i, tok := range tokens {
		n := len([]rune(tok))
		b := budgetFor(n)
		if b == 0 {
			continue
		}
		l, h := n-b, n+b
		if l < 1 {
			l = 1
		}
		if lastIsPrefix && i == len(tokens)-1 {
			unbounded = true // prefix mode on the last token: no upper length bound
		}
		if !ok || l < lo {
			lo = l
		}
		if !ok || h > hi {
			hi = h
		}
		ok = true
	}
	if unbounded {
		hi = 0
	}
	return lo, hi, ok
}

// isLivePrefix reports whether folded is an indexed term or a prefix of one.
func isLivePrefix(folded string, vocab []VocabTerm) bool {
	for _, v := range vocab {
		if strings.HasPrefix(v.Term, folded) {
			return true
		}
	}
	return false
}

// nearest finds the closest vocab term to runes within budget, tie-broken by
// (distance asc, doc desc, term asc). ok is false when nothing is within budget.
func nearest(runes []rune, budget int, usePrefix bool, vocab []VocabTerm) (term string, ok bool) {
	bestDist := budget + 1
	var bestDoc int64
	for _, v := range vocab {
		d := editDistance(runes, []rune(v.Term), budget, usePrefix)
		if d > budget {
			continue
		}
		switch {
		case d < bestDist,
			d == bestDist && v.Doc > bestDoc,
			d == bestDist && v.Doc == bestDoc && v.Term < term:
			bestDist, bestDoc, term, ok = d, v.Doc, v.Term, true
		}
	}
	return term, ok
}
