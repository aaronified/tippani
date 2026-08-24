package httpapi

import (
	"strings"
	"testing"
)

// What each rule DOES about what it found, and — worth more than the rest — what it
// leaves alone.
//
// cleanup.go's own header says every one of these rules has a false positive that is
// somebody's real writing. That is still true; what changed is that a finding is now
// answerable, so the guard is no longer "never rewrite" but "rewrite exactly the
// spans that were shown, and never empty a field". Both halves are asserted here.
//
// Invisible characters are written as escapes for the reason cleanup.go writes its
// own class that way: a test whose input cannot be seen cannot be reviewed.
const (
	nbsp       = "\u00a0"
	zwsp       = "\u200b"
	softHyphen = "\u00ad"
	bom        = "\ufeff"
	wordJoiner = "\u2060"
)

func TestCleanupFixRewritesExactlyWhatWasFound(t *testing.T) {
	for _, tc := range []struct {
		name string
		rule string
		in   string
		want string
	}{
		{
			name: "a no-break space becomes a real space, not nothing",
			rule: "invisible",
			in:   "two" + nbsp + "words",
			want: "two words",
		},
		{
			name: "the four that are nothing are removed",
			rule: "invisible",
			in:   "wha" + zwsp + "le" + softHyphen + "s" + bom + " and" + wordJoiner + " more",
			want: "whales and more",
		},
		{
			name: "padding at both ends goes, and the words do not",
			rule: "edge-space",
			in:   "   call me Ishmael  ",
			want: "call me Ishmael",
		},
		{
			name: "a run of spaces inside a line becomes one",
			rule: "double-space",
			in:   "call  me   Ishmael",
			want: "call me Ishmael",
		},
		{
			name: "a tab run becomes one space too, since the rule reports it",
			rule: "double-space",
			in:   "call\t\tme",
			want: "call me",
		},
		{
			name: "the space before closing punctuation goes and the punctuation stays",
			rule: "space-before-punctuation",
			in:   "call me Ishmael , then",
			want: "call me Ishmael, then",
		},
		{
			name: "a word broken across a line is joined",
			rule: "hyphen-break",
			in:   "conti- nuation of the thought",
			want: "continuation of the thought",
		},
		{
			name: "a hyphen at a line end is joined too",
			rule: "hyphen-break",
			in:   "conti-\nnuation",
			want: "continuation",
		},
		{
			name: "doubled commas collapse to one",
			rule: "repeated-punctuation",
			in:   "the whale,, the sea",
			want: "the whale, the sea",
		},
		{
			name: "a run of exclamation marks collapses to one",
			rule: "repeated-punctuation",
			in:   "there she blows!!!",
			want: "there she blows!",
		},
		{
			name: "four dots become the three that are an ellipsis",
			rule: "repeated-punctuation",
			in:   "and then.... nothing",
			want: "and then... nothing",
		},
		{
			name: "two dots become one full stop",
			rule: "repeated-punctuation",
			in:   "and then.. nothing",
			want: "and then. nothing",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, changed := cleanupApplyRule(tc.in, tc.rule)
			if !changed {
				t.Fatalf("%s did not fire on %q", tc.rule, tc.in)
			}
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
			// And the rewrite is idempotent: accepting the same finding twice is a
			// no-op rather than a second edit. The page can be open in two tabs.
			again, changedAgain := cleanupApplyRule(got, tc.rule)
			if changedAgain && again != got {
				t.Errorf("not idempotent: %q became %q on a second pass", got, again)
			}
		})
	}
}

// The three properties that hold for every rule, present and future. Written as a
// loop over the rule set rather than as cases, so a rule added without a thought
// about them fails here.
func TestCleanupFixHoldsForEveryRule(t *testing.T) {
	// EVERY RULE IS EITHER FIXABLE OR EXPLICITLY NOT, with a reason. This replaces a
	// case that asserted every rule must be fixable — which was the assumption that
	// shipped two rewrites able to destroy real text (see cleanupUnfixable).
	for _, r := range cleanupRules {
		_, why := cleanupUnfixable[r.ID]
		if cleanupFixable(r.ID) == why {
			t.Errorf("rule %s is neither fixable nor recorded as unfixable (or is both)", r.ID)
		}
	}
	for id := range cleanupUnfixable {
		if _, ok := cleanupRuleByID(id); !ok {
			t.Errorf("cleanupUnfixable names %s, which is not a rule", id)
		}
		if cleanupFixable(id) {
			t.Errorf("%s is listed as unfixable and has a fix", id)
		}
	}

	// A rule may not empty a field. These are the inputs that are ENTIRELY what a
	// rule reports, which is where an unguarded fix blanks a card.
	for _, in := range []string{"   ", "[12]", "  \n  ", "!!!", "..", nbsp, zwsp + bom} {
		for _, r := range cleanupRules {
			got, changed := cleanupApplyRule(in, r.ID)
			if changed && strings.TrimSpace(in) != "" && strings.TrimSpace(got) == "" {
				t.Errorf("%s emptied %q", r.ID, in)
			}
		}
	}

	// A rule that does not fire changes nothing and says so — which is what accept
	// reports as `stale` rather than as an error.
	for _, r := range cleanupRules {
		if got, changed := cleanupApplyRule("call me Ishmael", r.ID); changed || got != "call me Ishmael" {
			t.Errorf("%s fired on clean text: %q", r.ID, got)
		}
	}

	// An unknown rule is refused rather than treated as a no-op that reports success.
	if _, changed := cleanupApplyRule("call  me", "delete-everything"); changed {
		t.Error("an unknown rule reported a change")
	}
}

// The hash is the ignore key, so what it is and is not sensitive to IS the behaviour
// of the Ignored bucket. These are 0052's two arguments as assertions.
func TestCleanupMatchHashIsPerFindingNotPerField(t *testing.T) {
	// The same finding in a longer text hashes the same, so accepting some OTHER
	// rule on the field cannot revive an ignored one.
	a := cleanupMatchHash("the whale[12] surfaced", "reference-mark")
	b := cleanupMatchHash("the whale[12] surfaced, and the sea besides", "reference-mark")
	if a != b || a == "" {
		t.Errorf("the hash moved when text around the finding changed (%q vs %q)", a, b)
	}
	// A different finding hashes differently, so one ignore cannot bury another.
	if c := cleanupMatchHash("the whale[13] surfaced", "reference-mark"); c == a {
		t.Error("two different findings share a hash; one ignore would silence both")
	}
	// And the rule is part of the key: two rules on one field are two answers.
	if cleanupMatchHash("call  me ,", "double-space") == cleanupMatchHash("call  me ,", "space-before-punctuation") {
		t.Error("the rule is not part of the hash")
	}
	// An unknown rule has no hash rather than a misleading one.
	if cleanupMatchHash("x", "delete-everything") != "" {
		t.Error("an unknown rule produced a hash")
	}
}

// The text the two withdrawn fixes destroyed. Each of these is prose a reader keeps,
// and each was silently rewritten by a rule whose detector was only ever meant to
// LIST. The assertion is that no accept is offered for them at all — not that the
// rewrite is better, because there is no rewrite that is right more often than wrong.
func TestCleanupRefusesToRewriteWhatItCannotJudge(t *testing.T) {
	for _, tc := range []struct {
		rule, in, wouldHaveBecome string
	}{
		{"pronunciation", "the ratio was 1/2 and then 3/4 of it", "the ratio was 14 of it"},
		{"pronunciation", "see https://example.com/path", "see https:/path"},
		{"pronunciation", "on 12/05/1998 he wrote", "on 121998 he wrote"},
		{"reference-mark", "Apollo11 lifted off", "Apollo lifted off"},
		{"reference-mark", "COVID19 changed it", "COVID changed it"},
	} {
		t.Run(tc.rule+": "+tc.in, func(t *testing.T) {
			// It is still FOUND — the reader sees it and can ignore it.
			rule, ok := cleanupRuleByID(tc.rule)
			if !ok || len(rule.find(tc.in)) == 0 {
				t.Fatalf("%s no longer finds %q; this case is vacuous", tc.rule, tc.in)
			}
			// And it cannot be accepted.
			if got, changed := cleanupApplyRule(tc.in, tc.rule); changed {
				t.Errorf("%s offered to rewrite %q as %q (it once produced %q)", tc.rule, tc.in, got, tc.wouldHaveBecome)
			}
		})
	}

	// The narrower version of the same mistake, in a rule that KEEPS its fix: the
	// space-before-punctuation pattern spans line breaks, so a closing bracket at the
	// start of a line — a stage direction, a list, a quoted poem — would have had its
	// two lines joined.
	for _, in := range []string{"a line\n) closing", "the end\n. next", "one\n\t, two"} {
		if got, changed := cleanupApplyRule(in, "space-before-punctuation"); changed {
			t.Errorf("joined two lines: %q became %q", in, got)
		}
	}
	// While the case it exists for still works.
	if got, changed := cleanupApplyRule("call me Ishmael , then", "space-before-punctuation"); !changed || got != "call me Ishmael, then" {
		t.Errorf("got %q (changed=%v), want the space before the comma gone", got, changed)
	}
}
