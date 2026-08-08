package store

import "testing"

// UtteranceDedupeHash inverts the rule the other two kinds share: for a quote
// with no work, the occasion is a locator AND it discriminates. These tests pin
// both halves of that — what must collide, and what must not.

func TestUtteranceHashDiscriminatesByOccasion(t *testing.T) {
	const line = "Give me blood, and I will give you freedom"

	// The roadmap's rule, stated as a test: the same words on two occasions are
	// two quotes. Under the plain DedupeHash rule all four of these would be one
	// row, and the second onwards would hit UNIQUE and be silently folded in.
	cases := []struct {
		name                            string
		speaker, occasion, occasionDate string
	}{
		{"the Burma broadcast", "Subhas Chandra Bose", "Burma Radio broadcast", "1944"},
		{"the same speech a year earlier", "Subhas Chandra Bose", "Burma Radio broadcast", "1943"},
		{"a different occasion, same year", "Subhas Chandra Bose", "Singapore rally", "1944"},
		{"somebody else entirely", "Someone Else", "Burma Radio broadcast", "1944"},
	}
	seen := map[string]string{}
	for _, c := range cases {
		h := UtteranceDedupeHash(line, c.speaker, c.occasion, c.occasionDate)
		if prev, dup := seen[h]; dup {
			t.Errorf("%q and %q hash identically; the occasion must discriminate", c.name, prev)
		}
		seen[h] = c.name
	}
}

func TestUtteranceHashCollapsesTheSameOccasion(t *testing.T) {
	const line = "Give me blood, and I will give you freedom"
	a := UtteranceDedupeHash(line, "Subhas Chandra Bose", "Burma Radio broadcast", "1944")

	// Re-importing the same file must be a no-op, so the same occasion has to
	// reach the same hash through the normalisation the other two rules use:
	// smart punctuation folded, whitespace collapsed, case ignored.
	same := []struct {
		name                            string
		text                            string
		speaker, occasion, occasionDate string
	}{
		{"identical", line, "Subhas Chandra Bose", "Burma Radio broadcast", "1944"},
		{"padded whitespace", "  Give me blood,   and I will give you freedom ", " Subhas Chandra Bose ", "Burma Radio broadcast", "1944"},
		{"different case", line, "subhas chandra bose", "burma radio BROADCAST", "1944"},
	}
	for _, c := range same {
		if got := UtteranceDedupeHash(c.text, c.speaker, c.occasion, c.occasionDate); got != a {
			t.Errorf("%s: hashed differently from the identical occasion; a re-import would duplicate it", c.name)
		}
	}
}

// place and medium are deliberately NOT folded in. Refining them is the common
// case — "Burma" becomes "Rangoon", "radio" becomes "Azad Hind Radio" — and if
// they discriminated, the refinement would fork a duplicate on the next import
// rather than enriching the row already there.
//
// There is no assertion to make about them here beyond the signature: they are
// not parameters. This test exists to state that it is a decision rather than an
// omission, and to fail loudly if someone widens the signature without reading
// the reasoning above it.
func TestUtteranceHashIgnoresPlaceAndMedium(t *testing.T) {
	const line = "Give me blood, and I will give you freedom"
	// Same speaker, occasion and date; the caller varies place and medium by
	// simply not being able to pass them. Two rows differing only in those two
	// columns are the same quote.
	a := UtteranceDedupeHash(line, "Bose", "a broadcast", "1944")
	b := UtteranceDedupeHash(line, "Bose", "a broadcast", "1944")
	if a != b {
		t.Fatal("the hash depends on something outside its arguments")
	}
}

// A proverb, or a line remembered without knowing who said it, has no occasion
// to be qualified by — and two copies of the same unattributed words are the
// same quote. Falling back to DedupeHash byte-for-byte is what makes that true.
func TestUtteranceHashWithNoOccasionMatchesThePlainRule(t *testing.T) {
	const proverb = "Least said, soonest mended"
	if got, want := UtteranceDedupeHash(proverb, "", "", ""), DedupeHash(proverb); got != want {
		t.Fatalf("an unattributed quote must hash as plain text.\ngot  %s\nwant %s", got, want)
	}
	// Whitespace-only fields count as absent, or a stray space in a form field
	// would quietly produce a second copy of the same proverb.
	if got, want := UtteranceDedupeHash(proverb, "  ", "\t", " "), DedupeHash(proverb); got != want {
		t.Fatal("whitespace-only occasion fields must read as no occasion at all")
	}
}

// The field separator has to separate. Without \x1f between the fields,
// ("ab","c") and ("a","bc") concatenate to the same string.
func TestUtteranceHashFieldsCannotBleedIntoEachOther(t *testing.T) {
	const line = "a line"
	if UtteranceDedupeHash(line, "ab", "c", "") == UtteranceDedupeHash(line, "a", "bc", "") {
		t.Fatal("adjacent occasion fields collide; they need a separator between them")
	}
	// And a quote whose TEXT spells out an occasion must not collide with one
	// that genuinely has that occasion.
	if UtteranceDedupeHash("a line Bose", "", "", "") == UtteranceDedupeHash("a line", "Bose", "", "") {
		t.Fatal("text and occasion are not separated; a quote could forge another's identity")
	}
}

// The three kinds must not collide with each other where they share a text.
// They live in different tables so a collision cannot violate a constraint, but
// the hashes appear in exports and dedupe reports, and two kinds agreeing by
// accident would read as a relationship that is not there.
func TestUtteranceHashDiffersFromTheOtherKinds(t *testing.T) {
	const line = "the same words exactly"
	plain := DedupeHash(line)
	utt := UtteranceDedupeHash(line, "Bose", "a rally", "1944")
	if utt == plain {
		t.Fatal("an utterance with an occasion hashes as if it had none")
	}
	s, e := 2, 5
	if utt == DialogueDedupeHash(line, &s, &e) {
		t.Fatal("an utterance collides with an episoded dialogue")
	}
}

// DialogueDedupeHash had the same trailing-whitespace fault UtteranceDedupeHash
// was caught with in review: strings.Fields ran over the JOINED string, so a
// space beside the \x1f separator became a token boundary and the same line
// stored with a trailing space hashed differently from the one without.
//
// The consequence is not an error. It is a recurring catchphrase that stages
// twice, months apart, because one copy was pasted with a stray space — the
// exact failure the qualified hash was introduced to stop.
func TestDialogueHashIgnoresSurroundingWhitespace(t *testing.T) {
	s2, e6 := 2, 6
	base := DialogueDedupeHash("Not today", &s2, &e6)
	for _, padded := range []string{"Not today ", " Not today", "  Not today  ", "Not  today"} {
		if got := DialogueDedupeHash(padded, &s2, &e6); got != base {
			t.Errorf("DialogueDedupeHash(%q) differs from the unpadded line — "+
				"a stray space makes a second copy of the same quote", padded)
		}
	}
}

// The guarantee the whole design rests on: with no episode the result is
// byte-identical to DedupeHash, so every film and un-episoded line keeps the
// hash already on disk and nothing needs rewriting for them.
func TestDialogueHashIsUnchangedWithoutAnEpisode(t *testing.T) {
	for _, text := range []string{"Here is looking at you", "  padded  ", "Smart “quotes” too"} {
		if DialogueDedupeHash(text, nil, nil) != DedupeHash(text) {
			t.Errorf("DialogueDedupeHash(%q, nil, nil) diverged from DedupeHash", text)
		}
	}
}

// A well-formed line's hash must NOT move, or the fix would silently rewrite
// every episoded row in every existing database and invite a collision on each.
// These are the values the old code produced for text with no stray whitespace.
func TestDialogueHashIsStableForWellFormedText(t *testing.T) {
	s1, e1 := 1, 1
	// Reconstructed the way the old code built it: fold, join, then normalise.
	// For text with single internal spaces and no padding the two orders agree,
	// which is what makes the fix safe to ship without a rewrite.
	want := DedupeHashOfJoined("not today\x1fs1e1")
	if got := DialogueDedupeHash("Not today", &s1, &e1); got != want {
		t.Fatalf("the hash of a well-formed episoded line moved: %s vs %s", got, want)
	}
}

// The episode still qualifies: two occurrences of one catchphrase are two
// quotes, which is why this hash exists at all.
func TestDialogueHashStillSeparatesEpisodes(t *testing.T) {
	s1, e1, e2 := 1, 1, 2
	a := DialogueDedupeHash("Not today", &s1, &e1)
	b := DialogueDedupeHash("Not today", &s1, &e2)
	if a == b {
		t.Fatal("the same line in two episodes must be two quotes")
	}
	if a == DedupeHash("Not today") {
		t.Fatal("an episoded line must not collide with the un-episoded one")
	}
}
