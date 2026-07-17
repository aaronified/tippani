package search

import (
	"strings"
	"testing"
)

func TestEditDistance(t *testing.T) {
	cases := []struct {
		a, b   string
		budget int
		prefix bool
		want   int
	}{
		{"shawshank", "shawshank", 2, false, 0},
		{"shawshenk", "shawshank", 2, false, 1}, // one substitution
		{"kitten", "sitting", 3, false, 3},
		{"kitten", "sitting", 2, false, 3},       // exceeds budget → sentinel budget+1
		{"abc", "abcdefgh", 2, false, 3},         // length gap > budget → sentinel
		{"shawsh", "shawshank", 2, true, 0},      // exact prefix
		{"shawsq", "shawshank", 2, true, 1},      // prefix typo (q vs h in "shawsh")
		{"shawshenk", "shawshank", 2, true, 1},   // prefix distance still 1
		{"café", "cafe", 1, false, 1},            // unicode: é vs e is one edit
		{"straße", "strasse", 2, false, 2},       // ß vs ss
	}
	for _, c := range cases {
		got := editDistance([]rune(c.a), []rune(c.b), c.budget, c.prefix)
		// Over-budget results are only guaranteed to be reported as budget+1.
		want := c.want
		if want > c.budget {
			want = c.budget + 1
		}
		if got != want {
			t.Errorf("editDistance(%q,%q,budget=%d,prefix=%v) = %d, want %d",
				c.a, c.b, c.budget, c.prefix, got, want)
		}
	}
}

func TestBudgetFor(t *testing.T) {
	for n, want := range map[int]int{0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 12: 2} {
		if got := budgetFor(n); got != want {
			t.Errorf("budgetFor(%d) = %d, want %d", n, got, want)
		}
	}
}

// vocab builds a VocabTerm slice from term:doc pairs.
func vocab(pairs ...any) []VocabTerm {
	var v []VocabTerm
	for i := 0; i < len(pairs); i += 2 {
		v = append(v, VocabTerm{Term: pairs[i].(string), Doc: int64(pairs[i+1].(int))})
	}
	return v
}

func TestWindow(t *testing.T) {
	// Non-prefix: bounded above at n+budget.
	if lo, hi, ok := Window([]string{"shawsq"}, false); !ok || lo != 4 || hi != 8 {
		t.Fatalf("bounded window: lo=%d hi=%d ok=%v, want 4/8/true", lo, hi, ok)
	}
	// Prefix last token: unbounded above (hi==0 sentinel) so a short typed token
	// can reach a much longer indexed term ("shawsq" -> "shawshank").
	if lo, hi, ok := Window([]string{"shawsq"}, true); !ok || lo != 4 || hi != 0 {
		t.Fatalf("prefix window: lo=%d hi=%d ok=%v, want 4/0/true", lo, hi, ok)
	}
	// Union across tokens; a prefix last token still forces unbounded above.
	if lo, hi, ok := Window([]string{"cat", "encyclopeda"}, true); !ok || lo != 2 || hi != 0 {
		t.Fatalf("multi-token prefix window: lo=%d hi=%d ok=%v, want 2/0/true", lo, hi, ok)
	}
	// No correctable token → ok=false (caller skips the fuzzy pass).
	if _, _, ok := Window([]string{"ab", "cd"}, true); ok {
		t.Fatal("all-short tokens should be not-ok")
	}
}

func TestCorrect(t *testing.T) {
	lib := vocab(
		"shawshank", 3, "redemption", 3, "stephen", 5, "king", 5,
		"show", 10, "shawl", 1, "the", 40, "godfather", 2,
	)
	cases := []struct {
		name        string
		tokens      []string
		lastPrefix  bool
		wantOut     []string
		wantChanged bool
	}{
		{"typo corrected", []string{"redemtion"}, false, []string{"redemption"}, true},
		{"exact term untouched", []string{"redemption"}, false, []string{"redemption"}, false},
		{"live prefix survives", []string{"shaw"}, false, []string{"shaw"}, false},
		{"short token never corrected", []string{"th"}, false, []string{"th"}, false},
		{"case folded then corrected", []string{"Redemtion"}, false, []string{"redemption"}, true},
		{"no candidate within budget stays", []string{"xyzzyquux"}, false, []string{"xyzzyquux"}, false},
		{"multi-token: prefix stays, typo fixed", []string{"shaw", "redemtion"}, false, []string{"shaw", "redemption"}, true},
		{"last-token prefix typo", []string{"shawsq"}, true, []string{"shawshank"}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out, changed := Correct(c.tokens, lib, c.lastPrefix)
			if changed != c.wantChanged {
				t.Errorf("changed = %v, want %v (out=%v)", changed, c.wantChanged, out)
			}
			if strings.Join(out, " ") != strings.Join(c.wantOut, " ") {
				t.Errorf("out = %v, want %v", out, c.wantOut)
			}
		})
	}
}

// TestCorrectTieBreak pins the deterministic tie-break: equal distance prefers
// the higher doc count, then the lexicographically smaller term.
func TestCorrectTieBreak(t *testing.T) {
	// "beat" is distance 1 from both "bear" and "beam"; give "beam" the higher
	// doc count so it must win regardless of scan order.
	lib := vocab("bear", 2, "beam", 9, "beat", 0)
	// (no "beat" as a real term here — use a token that isn't a live prefix)
	out, changed := Correct([]string{"beak"}, lib, false)
	if !changed || out[0] != "beam" {
		t.Fatalf("tie-break by doc: got %v (changed=%v), want [beam]", out, changed)
	}

	// Equal doc → lexicographically smaller term wins. "beam" and "bear" are
	// both distance 1 from "beak" with equal doc; they differ at index 3 where
	// 'm' < 'r', so "beam" < "bear" and must win regardless of scan order.
	lib2 := vocab("bear", 4, "beam", 4)
	out2, _ := Correct([]string{"beak"}, lib2, false)
	if out2[0] != "beam" {
		t.Fatalf("tie-break by term: got %v, want [beam]", out2)
	}
}

// TestCorrectOutputIsMatchSafe verifies corrected tokens still produce a safe,
// well-formed PrefixQuery (the invariant that raw input never reaches MATCH).
func TestCorrectOutputIsMatchSafe(t *testing.T) {
	out, _ := Correct([]string{"redemtion"}, vocab("redemption", 1), false)
	q := PrefixQuery(strings.Join(out, " "))
	if q != `"redemption"*` {
		t.Fatalf("PrefixQuery(corrected) = %q, want %q", q, `"redemption"*`)
	}
}
