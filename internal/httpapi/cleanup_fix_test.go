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
			name: "a bracketed footnote index goes entirely",
			rule: "reference-mark",
			in:   "the whale[12] surfaced",
			want: "the whale surfaced",
		},
		{
			name: "a digit welded to a word loses the digit and keeps the word",
			rule: "reference-mark",
			in:   "his conscience12 troubled him",
			want: "his conscience troubled him",
		},
		{
			name: "a superscript index goes",
			rule: "reference-mark",
			in:   "the whale¹ surfaced",
			want: "the whale surfaced",
		},
		{
			name: "a pronunciation gloss goes",
			rule: "pronunciation",
			in:   "cetacean /sɪˈteɪʃən/ means whale",
			want: "cetacean  means whale",
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
	// Every rule the scan reports must be answerable, or the page has a finding with
	// no accept button. None is in that state today; if one is added deliberately,
	// this is where the decision is recorded.
	for _, r := range cleanupRules {
		if !cleanupFixable(r.ID) {
			t.Errorf("rule %s has no fix, so it can only be ignored — deliberate?", r.ID)
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
