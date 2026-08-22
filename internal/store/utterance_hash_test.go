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
	if utt == DialogueDedupeHash(line, &s, &e, "", "") {
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
	base := DialogueDedupeHash("Not today", &s2, &e6, "", "")
	for _, padded := range []string{"Not today ", " Not today", "  Not today  ", "Not  today"} {
		if got := DialogueDedupeHash(padded, &s2, &e6, "", ""); got != base {
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
		if DialogueDedupeHash(text, nil, nil, "", "") != DedupeHash(text) {
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
	if got := DialogueDedupeHash("Not today", &s1, &e1, "", ""); got != want {
		t.Fatalf("the hash of a well-formed episoded line moved: %s vs %s", got, want)
	}
}

// The episode still qualifies: two occurrences of one catchphrase are two
// quotes, which is why this hash exists at all.
func TestDialogueHashStillSeparatesEpisodes(t *testing.T) {
	s1, e1, e2 := 1, 1, 2
	a := DialogueDedupeHash("Not today", &s1, &e1, "", "")
	b := DialogueDedupeHash("Not today", &s1, &e2, "", "")
	if a == b {
		t.Fatal("the same line in two episodes must be two quotes")
	}
	if a == DedupeHash("Not today") {
		t.Fatal("an episoded line must not collide with the un-episoded one")
	}
}

// ---------------------------------------------------------------------------
// 0047: a game's act and quest
// ---------------------------------------------------------------------------
//
// A game is one `movies` row, exactly as a series is, so a bark reused in two
// quests is two quotes by the same argument that made the episode discriminate.
// The two tests above — TestDialogueHashIsUnchangedWithoutAnEpisode and
// TestDialogueHashIsStableForWellFormedText — are the proof that adding them
// rewrote nothing on disk, and they are deliberately left saying what they said.

// The guard is the whole property: with no season, no episode, no act and no
// quest, the result must be DedupeHash byte for byte, or every film row in every
// existing database needs rehashing.
func TestDialogueHashIsUnchangedWithNoLocatorAtAll(t *testing.T) {
	for _, text := range []string{"Here is looking at you", "  padded  ", "Smart “quotes” too"} {
		if DialogueDedupeHash(text, nil, nil, "", "") != DedupeHash(text) {
			t.Errorf("DialogueDedupeHash(%q) with no locator diverged from DedupeHash", text)
		}
	}
	// WHITESPACE-ONLY COUNTS AS ABSENT. A "- act:" with a blank value, or a form
	// field holding one space, must take the same fast path — otherwise it emits
	// "text\x1fa" and the next import of the same file forks a duplicate. This is
	// the fault normalizeQuoteText's own header describes, one field over.
	const line = "Here is looking at you"
	for _, pair := range [][2]string{{" ", ""}, {"", "\t"}, {"  ", " "}, {"\n", "\n"}} {
		if DialogueDedupeHash(line, nil, nil, pair[0], pair[1]) != DedupeHash(line) {
			t.Errorf("act=%q quest=%q read as a locator; whitespace-only must count as absent", pair[0], pair[1])
		}
	}
}

// Season and episode with an empty act and quest must hash EXACTLY as they did
// before 0047, or every episoded row on disk is stranded. The value is stated as
// the string being hashed rather than as a digest, so what is being claimed is
// readable: the suffix is written first and act/quest append after it.
func TestDialogueHashIsUnchangedForAnEpisodedLine(t *testing.T) {
	s1, e1 := 1, 1
	if got, want := DialogueDedupeHash("Not today", &s1, &e1, "", ""),
		DedupeHashOfJoined("not today\x1fs1e1"); got != want {
		t.Fatalf("an episoded line's hash moved when act and quest were added:\n got %s\nwant %s", got, want)
	}
	// And whitespace-only act/quest must not disturb it either.
	if got, want := DialogueDedupeHash("Not today", &s1, &e1, " ", "  "),
		DedupeHashOfJoined("not today\x1fs1e1"); got != want {
		t.Fatal("a blank act changed an episoded line's hash")
	}
}

// The encoding, pinned. Each new field is introduced by its own \x1f plus a
// one-letter tag, and the empty season/episode segment stays where it was — so a
// game's string is the text, an empty locator segment, then the act, then the
// quest.
func TestAGameLineHashesTheWayThisFileSaysItDoes(t *testing.T) {
	if got, want := DialogueDedupeHash("Bark", nil, nil, "2", "The Well"),
		DedupeHashOfJoined("bark\x1f\x1fa2\x1fqthe well"); got != want {
		t.Fatalf("the game encoding is not what it claims to be:\n got %s\nwant %s", got, want)
	}
	if got, want := DialogueDedupeHash("Bark", nil, nil, "2", ""),
		DedupeHashOfJoined("bark\x1f\x1fa2"); got != want {
		t.Fatalf("an act with no quest is not encoded as claimed:\n got %s\nwant %s", got, want)
	}
	if got, want := DialogueDedupeHash("Bark", nil, nil, "", "The Well"),
		DedupeHashOfJoined("bark\x1f\x1fqthe well"); got != want {
		t.Fatalf("a quest with no act is not encoded as claimed:\n got %s\nwant %s", got, want)
	}
}

// The reason act and quest are in the hash at all: the same bark in two quests is
// two quotes. Without this, only the first could ever be stored — it would hit
// UNIQUE (movie_id, dedupe_hash) and be folded into the other, or worse be
// relabelled with the newer quest by the importer's enrichment.
func TestAGameLineIsDiscriminatedByItsActAndQuest(t *testing.T) {
	const bark = "Sure is a hot one today."
	seen := map[string]string{}
	for _, c := range []struct{ name, act, quest string }{
		{"no locator", "", ""},
		{"act 1", "1", ""},
		{"act 2", "2", ""},
		{"quest only", "", "The Well"},
		{"another quest only", "", "The Bridge"},
		{"act 1, the well", "1", "The Well"},
		{"act 2, the well", "2", "The Well"},
		{"act 1, the bridge", "1", "The Bridge"},
	} {
		h := DialogueDedupeHash(bark, nil, nil, c.act, c.quest)
		if prev, dup := seen[h]; dup {
			t.Errorf("%q and %q hash identically; the act and the quest must discriminate", c.name, prev)
		}
		seen[h] = c.name
	}
}

// Normalisation applies to the new fields as it does to everything else: a
// trailing space or a smart apostrophe in a quest name must not fork a duplicate.
func TestAGameLineIgnoresHowItsQuestWasTyped(t *testing.T) {
	const bark = "Sure is a hot one today."
	base := DialogueDedupeHash(bark, nil, nil, "2", "The Ranger's Well")
	for _, c := range []struct{ act, quest string }{
		{" 2 ", "The Ranger's Well"},
		{"2", "  The   Ranger's Well  "},
		{"2", "the ranger's well"},
		{"2", "The Ranger’s Well"},
	} {
		if got := DialogueDedupeHash(bark, nil, nil, c.act, c.quest); got != base {
			t.Errorf("act=%q quest=%q hashed differently from the same line typed plainly", c.act, c.quest)
		}
	}
}

// The separators have to separate, and the naive encoding — appending "a"+act
// followed by "q"+quest inside one segment — fails exactly this pair. \x1f cannot
// occur in normalised quote text, so nothing typed can forge one.
func TestAGameLineCannotForgeItsOwnLocator(t *testing.T) {
	const bark = "a line"
	if DialogueDedupeHash(bark, nil, nil, "xqy", "") == DialogueDedupeHash(bark, nil, nil, "x", "y") {
		t.Fatal(`act="xqy" collides with act="x", quest="y"; the fields need their own separator each`)
	}
	if DialogueDedupeHash("a line a2", nil, nil, "", "") == DialogueDedupeHash("a line", nil, nil, "2", "") {
		t.Fatal("a line whose TEXT spells out an act collides with one that genuinely has that act")
	}
	// A game's locator must not collide with a show's, either: they are different
	// facts about different media and the hashes appear side by side in exports.
	s1, e1 := 1, 1
	if DialogueDedupeHash(bark, &s1, &e1, "", "") == DialogueDedupeHash(bark, nil, nil, "1", "1") {
		t.Fatal("S1E1 collides with act 1 / quest 1")
	}
}
