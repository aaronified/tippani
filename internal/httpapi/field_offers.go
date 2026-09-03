package httpapi

// What every supplier has to say about one field — the door handoff §1.2 asks
// for, and the one thing the diff it is built on cannot answer.
//
// WHY THE DIFF IS NOT ENOUGH, and it is the central case rather than an edge.
// A field's provenance tag reads "TMDB" precisely BECAUSE TMDB wrote the value,
// so `stored` equals TMDB's answer by construction. diffStr therefore emits no
// diff for that field, and attachMovieAlts only hangs alternatives on diffs that
// already exist — so tapping a TMDB tag to see what TheTVDB says instead would
// open on an empty room, in exactly the situation the door exists for. Re-verify
// answers "what has CHANGED"; a field picker answers "what is on OFFER", and
// those differ on every field a supplier is already credited with.
//
// SO THE OFFERS PASS ASKS EVERY SUPPLIER FOR EVERY FIELD, independently of
// whether anything differs — and it asks through the same `movieAltPickers` /
// `bookAltPickers` tables the diff uses. One table per kind is the rule those
// two carry already: a field that can be reviewed and a field that can be
// offered must not be able to drift apart.
//
// IT IS A FLAG ON RE-VERIFY RATHER THAN A ROUTE OF ITS OWN. A separate endpoint
// would have to repeat the row read, the identity ladder and the per-supplier
// fetch — about 150 lines per kind, all of it the code whose comments keep
// warning about drift — to add one loop at the end of it. The flag is off for
// the reviewer and the filler, so neither pays for a payload it never reads.

import "sort"

// offersSkip names the pickers no field row can open.
//
// A PICTURE IS NOT A FIELD (handoff §1.4) and a cast is not a value: each has
// its own panel with its own affordances, and neither wears a provenance tag on
// the Details list. Offering them would put a whole cast list and two poster
// URLs into every response, for a door that does not exist.
var offersSkip = map[string]bool{"cast": true, "poster": true, "cover": true}

// offersFrom builds one row per field a supplier answered for.
//
// A FIELD NOBODY ANSWERED IS NOT A ROW. altsFor already drops the supplier with
// nothing to say; a field where that leaves nothing is a field with no choice in
// it, and an empty row would draw a picker over "we have no idea".
func offersFrom(stored map[string]any, fields []string, alts func(string) []fieldAlt) []fieldDiff {
	out := []fieldDiff{}
	for _, f := range fields {
		if offersSkip[f] {
			continue
		}
		a := alts(f)
		if len(a) == 0 {
			continue
		}
		// Fresh mirrors Alts[0] so the struct's own invariant holds here too —
		// see fieldDiff. An offers row never reaches the reviewer, but a shape
		// that is true only on some of its instances is a trap for whoever
		// reads the next one.
		out = append(out, fieldDiff{Field: f, Stored: stored[f], Fresh: a[0].Value, Alts: a})
	}
	return out
}

// pickerFields is the key set of a picker table, which is the field list an
// offers pass walks. Written once rather than at each call site so that the two
// kinds cannot end up asking different questions of their own tables.
//
// SORTED, because the tables are maps and a response whose row order changes per
// request cannot be tested and reads as a bug the first time somebody diffs two
// of them. The order is guaranteed by the producer rather than by offersFrom, so
// that nothing sorts a slice it was handed by somebody else.
func pickerFields[T any](pickers map[string]func(*T) any) []string {
	out := make([]string, 0, len(pickers))
	for f := range pickers {
		out = append(out, f)
	}
	sort.Strings(out)
	return out
}
