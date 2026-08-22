package store

import "testing"

// The dedupe hash's WIRE FORMAT, pinned to literals computed outside this package.
//
// WHY A GOLDEN, when every other test in this file family asserts a relation. The
// rest of them say things like
//
//	if want := DialogueDedupeHash(text, n(1), n(2), "", ""); got != want
//
// which is the right shape for testing the backfill — but it cannot see an encoding
// change, because both sides of the comparison are the function under test. Reorder
// the suffix, pad the episode number, swap the separator, and every one of those
// assertions still passes while EVERY EPISODED ROW ALREADY ON DISK is stranded on a
// hash nothing will ever compute again. The failure is silent, it is permanent
// without a rehash, and it looks like duplicates appearing months later.
//
// hash.go states the property these literals defend: "WHEN ALL FOUR ARE EMPTY THE
// RESULT IS BYTE-IDENTICAL TO DedupeHash(text), and that property is load-bearing
// rather than incidental. It is what says NO ROW ON DISK NEEDS REHASHING." A claim
// that strong deserves a value it cannot restate for itself.
//
// The three literals are sha256 of, respectively:
//
//	hello world
//	hello world \x1f s1e2
//	hello world \x1f s1e2 \x1f a2
//
// computed with sha256sum, not with this package. If one of them fails, do NOT
// update it to match the code — that is the mistake it exists to prevent. Work out
// what changed the encoding and whether every stored hash has been migrated.
func TestDialogueDedupeHashWireFormat(t *testing.T) {
	const (
		text     = "Hello World" // normalises to "hello world": lowercased, ws-collapsed
		plain    = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
		episoded = "b926c6b7d2b72f9f9bf898355e82eb18e3dddf3c9204457d02860bd19ca0261d"
		withAct  = "ce16e073e6f3e708f07fc66df333a1fac664315b48f80957ada2a409d170e8ad"
	)
	one, two := 1, 2

	for _, c := range []struct {
		name           string
		season, episod *int
		act, quest     string
		want           string
	}{
		// The identity case, stated twice over: no locator at all hashes as the bare
		// text, which is what a film and an un-episoded line have on disk today.
		{"no locator at all", nil, nil, "", "", plain},

		// AND THE SAME BYTES when the two new columns are present but empty, which is
		// the state of every dialogue row written before 0047 — the columns did not
		// exist, so they default to ''. This case is the whole no-rehash argument.
		{"empty act and quest are not a locator", nil, nil, "", "", plain},

		// Whitespace-only is empty too. hash.go's guard TrimSpaces rather than testing
		// for "", because a form box holding one space would otherwise emit a suffix
		// and fork a duplicate of a row that already exists.
		{"whitespace act is not a locator", nil, nil, "   ", " \t ", plain},

		// The pre-0047 episoded encoding, unchanged. This is the literal that says
		// existing show rows keep the hash they were stored with.
		{"season and episode", &one, &two, "", "", episoded},

		// And act appends AFTER the episode suffix, behind its own separator.
		{"act appends after the episode", &one, &two, "2", "", withAct},
	} {
		t.Run(c.name, func(t *testing.T) {
			got := DialogueDedupeHash(text, c.season, c.episod, c.act, c.quest)
			if got != c.want {
				t.Fatalf("wire format changed\n got %s\nwant %s\nSee this file's comment before touching the literal.", got, c.want)
			}
		})
	}

	// The relation hash.go claims, asserted directly rather than inferred from the
	// literals above.
	if DialogueDedupeHash(text, nil, nil, "", "") != DedupeHash(text) {
		t.Fatal("the all-empty case is no longer byte-identical to DedupeHash: every row on disk is stranded")
	}

	// AND THE SEPARATOR CANNOT BE FORGED. hash.go's property 3: the naive encoding —
	// appending "a"+act+"q"+quest inside one segment — makes these two collide, and a
	// collision here means one of the two lines can never be saved.
	if DialogueDedupeHash(text, nil, nil, "xqy", "") == DialogueDedupeHash(text, nil, nil, "x", "y") {
		t.Fatal(`act="xqy" collides with act="x" quest="y": the separator is forgeable`)
	}
}
