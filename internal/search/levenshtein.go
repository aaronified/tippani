package search

// editDistance computes a bounded Levenshtein distance between rune slices a and
// b. It returns budget+1 as an early-abandon sentinel the moment the distance
// provably exceeds budget, so callers only ever learn "within budget, here's the
// distance" or "too far" — cheap over a large vocabulary.
//
// When prefix is true it returns the distance to the CLOSEST PREFIX of b (the
// minimum over the final DP row) rather than to all of b — for typeahead on the
// last query token, where b may be a longer term the user is still typing toward
// ("shawsh" is a distance-0 prefix of "shawshank").
//
// Two-row Wagner–Fischer. Row minima are non-decreasing (dp[i+1][j] >= min of
// row i for all j), so once a whole row exceeds budget the final cell — and the
// final row's minimum, for the prefix case — must too: a sound early abandon.
func editDistance(a, b []rune, budget int, prefix bool) int {
	la, lb := len(a), len(b)
	// Full-distance lower bound: strings differing in length by more than the
	// budget can't be within it. (Skipped for prefix, where a shorter a can be a
	// close prefix of a much longer b.)
	if !prefix {
		if d := la - lb; d > budget || -d > budget {
			return budget + 1
		}
	}
	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		rowMin := curr[0]
		ai := a[i-1]
		for j := 1; j <= lb; j++ {
			cost := 1
			if ai == b[j-1] {
				cost = 0
			}
			m := prev[j] + 1 // deletion
			if ins := curr[j-1] + 1; ins < m {
				m = ins
			}
			if sub := prev[j-1] + cost; sub < m {
				m = sub
			}
			curr[j] = m
			if m < rowMin {
				rowMin = m
			}
		}
		if rowMin > budget {
			return budget + 1
		}
		prev, curr = curr, prev
	}
	// prev now holds the final row (index la).
	if prefix {
		best := prev[0]
		for j := 1; j <= lb; j++ {
			if prev[j] < best {
				best = prev[j]
			}
		}
		return best
	}
	return prev[lb]
}

// budgetFor is the edit-distance budget allowed for a token of n runes: 1 for
// short tokens (3–5), 2 for longer ones. Tokens shorter than 3 runes are never
// corrected (budget 0) — too little signal, too many false neighbours.
func budgetFor(n int) int {
	switch {
	case n < 3:
		return 0
	case n <= 5:
		return 1
	default:
		return 2
	}
}
