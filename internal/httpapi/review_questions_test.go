package httpapi

import (
	"strings"
	"testing"
)

// The in-depth review controls — what a reader may say about their own deck, and
// the three things they may not.
//
// THE RULES ARE THE FEATURE. Handing over the deck's repertoire is easy; the
// work is in the ways it can be handed over badly, and all three of those fail
// SILENTLY — an empty deck, a self-marked daily score, a book with no question
// it can be asked. None of them errors. Each one just quietly produces a screen
// that does nothing, which is why they are pinned here rather than trusted to
// the interface that happens to be in front of them today.

func dirsOf(list []string) string { return strings.Join(list, ",") }

func TestReviewQuestionsDefaultsWhenUnset(t *testing.T) {
	q := parseReviewQuestions("")
	def := defaultReviewQuestions()
	if dirsOf(q.daily) != dirsOf(def.daily) || dirsOf(q.practice) != dirsOf(def.practice) {
		t.Fatalf("empty blob must be the defaults: %+v", q)
	}
	// And a reader who has never touched it stores NOTHING, so a later change to
	// the defaults reaches them instead of being frozen at signup.
	if got := q.blob(); got != "" {
		t.Fatalf("defaults must serialise to the empty string, got %q", got)
	}
}

// RULE 1 — an unknown direction is dropped, not rejected. A backup taken on a
// newer build has to restore onto an older one.
func TestReviewQuestionsDropsUnknownDirections(t *testing.T) {
	q := parseReviewQuestions(`{"daily":["source","telepathy","cloze"]}`)
	if dirsOf(q.daily) != "source,cloze" {
		t.Fatalf("daily = %v, want the two it recognises", q.daily)
	}
	// The deck it did not mention is untouched, which is the whole reason each
	// deck is a POINTER: "not mentioned" and "explicitly empty" are different
	// requests and both unmarshal to nil without one.
	if dirsOf(q.practice) != dirsOf(defaultReviewQuestions().practice) {
		t.Fatalf("practice = %v, want it left alone", q.practice)
	}
}

// RULE 2 — the daily deck cannot be made self-scoring, however the preference
// arrives. This is 1.15.3's decision, and making the repertoire configurable
// would otherwise hand it back by accident.
func TestReviewQuestionsRefuseFlipInTheDailyDeck(t *testing.T) {
	q := parseReviewQuestions(`{"daily":["source","flip","cloze"]}`)
	for _, d := range q.daily {
		if d == dirFlip {
			t.Fatal("the daily deck must never offer a self-marked card, whatever the stored preference says")
		}
	}
	// It stays available in Practice, where nothing is being defended.
	q2 := parseReviewQuestions(`{"practice":["cloze","flip"]}`)
	if dirsOf(q2.practice) != "cloze,flip" {
		t.Fatalf("practice = %v, want flip kept", q2.practice)
	}
}

// RULE 3 — and the sharp half of it. A deck holding ONLY "who said this?" is not
// empty, and is empty for every book and every standalone quote in the library,
// because only a line of dialogue has a speaker.
func TestReviewQuestionsRefuseADeckThatCannotAskABook(t *testing.T) {
	def := defaultReviewQuestions()
	for _, blob := range []string{
		`{"daily":[]}`,
		`{"daily":["speaker"]}`,
		`{"daily":["nonsense"]}`,
	} {
		q := parseReviewQuestions(blob)
		if dirsOf(q.daily) != dirsOf(def.daily) {
			t.Fatalf("%s: daily = %v, want the defaults back", blob, q.daily)
		}
	}
	// Practice is held to the same rule, and flip counts as universal: a deck of
	// nothing but flip cards is a legitimate thing to ask for.
	q := parseReviewQuestions(`{"practice":["flip"]}`)
	if dirsOf(q.practice) != "flip" {
		t.Fatalf("practice = %v, want flip alone to be allowed", q.practice)
	}
}

// The stored form is CANONICAL, so toggling something off and back on produces
// the same bytes. Without it, two accounts with identical settings hold
// different strings and a diff of preferences means nothing.
func TestReviewQuestionsSerialiseInATableOrder(t *testing.T) {
	a := parseReviewQuestions(`{"daily":["cloze","source"],"practice":["flip","cloze"]}`).blob()
	b := parseReviewQuestions(`{"daily":["source","cloze"],"practice":["cloze","flip"]}`).blob()
	if a != b {
		t.Fatalf("order must not survive a round trip:\n a = %s\n b = %s", a, b)
	}
	if !strings.Contains(a, `"daily":["source","cloze"]`) {
		t.Fatalf("blob = %s, want the table's own order", a)
	}
}

// A corrupt preference must not be able to break the one screen that would fix
// it — so it reads as the defaults rather than as an error.
func TestReviewQuestionsSurviveRubbish(t *testing.T) {
	def := defaultReviewQuestions()
	for _, blob := range []string{"{", "null", "[]", `{"daily":"source"}`, "not json at all"} {
		q := parseReviewQuestions(blob)
		if dirsOf(q.daily) != dirsOf(def.daily) || dirsOf(q.practice) != dirsOf(def.practice) {
			t.Fatalf("%q must read as the defaults, got %+v", blob, q)
		}
	}
}

// directionsForMode is where the repertoire actually bites, and the interesting
// case is the intersection with the KIND: a reader can enable a set that is
// perfectly valid and still leave one kind of card with nothing.
func TestDirectionsForModeHonoursTheRepertoire(t *testing.T) {
	on := parseReviewQuestions(`{"daily":["cloze"]}`).forDeck(reviewDeckDaily)
	got := directionsForMode(kindBook, true, on)
	if dirsOf(got) != "cloze" {
		t.Fatalf("book directions = %v, want only the one asked for", got)
	}
	// nil is "everything this build can ask" — what the internal callers pass and
	// what every caller passed before the controls existed. Spelled out rather
	// than counted: a count is a number that has to be edited every time a
	// direction is added, and editing it is indistinguishable from not noticing
	// that a direction went missing.
	if got := dirsOf(directionsForMode(kindBook, true, nil)); got != "source,quote,cloze,cloze-mcq,author" {
		t.Fatalf("nil must mean unfiltered: %v", got)
	}
	// A film line is asked who SAID it and never who wrote it; a speech is asked
	// the same question out of its own column.
	if got := dirsOf(directionsForMode(kindScreen, true, nil)); got != "source,quote,cloze,cloze-mcq,speaker" {
		t.Fatalf("screen directions = %v", got)
	}
	if got := dirsOf(directionsForMode(kindUtterance, true, nil)); got != "source,quote,cloze,cloze-mcq,speaker" {
		t.Fatalf("utterance directions = %v", got)
	}
}

// THE BELT-AND-BRACES CASE. review_questions.go guarantees a universal direction
// survives, so this cannot happen through the normaliser — but the guarantee
// lives in another file, and if it ever breaks the symptom would be a deck with
// no cards rather than a compile error.
func TestDirectionsForModeNeverReturnsNothing(t *testing.T) {
	// A hand-built set that the normaliser would have refused.
	on := map[string]bool{dirSpeaker: true}
	got := directionsForMode(kindBook, true, on)
	if len(got) == 0 {
		t.Fatal("a book card must always have something to be asked, even from an impossible repertoire")
	}
}

// The round trip through the preferences endpoint, because the normaliser is
// only useful if loadPrefs and the PUT both run it.
func TestPreferencesNormaliseTheQuestionBlob(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srQuestions": `{"daily":["source","flip"],"practice":["cloze"]}`,
	}, 200)

	type meResp struct {
		Preferences struct {
			SRQuestions string `json:"srQuestions"`
		} `json:"preferences"`
	}
	me := decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	got := me.Preferences.SRQuestions
	if strings.Contains(got, "flip") && strings.Contains(got, `"daily":["source","flip"`) {
		t.Fatalf("the daily deck kept a self-marked card through the API: %s", got)
	}
	if !strings.Contains(got, `"practice":["cloze"]`) {
		t.Fatalf("practice = %s, want the single type it asked for", got)
	}

	// Empty string is Back to defaults, and must come back as empty rather than
	// as "leave it alone" — which is what the older `!= ""` string fields do and
	// is exactly the trap this one had to avoid.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srQuestions": ""}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.SRQuestions != "" {
		t.Fatalf("back to defaults left %q behind", me.Preferences.SRQuestions)
	}
}

// ---- the numbers behind the schedule ---------------------------------------
//
// EVERY VALUE IS CLAMPED, AND THE CLAMPS ARE THE FEATURE. These multiply a
// half-life on every answer, so a bad one does not produce a wrong screen — it
// produces a schedule that is quietly useless and stays that way. A grow of 0.5
// SHORTENS a card on every correct answer, so a quote you know perfectly is
// asked more and more often for ever. Nothing errors, nothing looks broken, and
// it would take weeks to notice.

func TestReviewTuningRefusesANumberThatMeansItsOpposite(t *testing.T) {
	d := defaultReviewTuning()
	for _, tc := range []struct {
		name string
		blob string
	}{
		{"a grow below 1 shortens on every success", `{"grow":0.5}`},
		{"a shrink of 1 or more lengthens on every failure", `{"shrink":1.5}`},
		{"a shrink of exactly 1 does nothing at all", `{"shrink":1}`},
		{"a harder question worth less than an easy one", `{"clozeGrow":0.4}`},
		{"a grow of zero freezes every card", `{"grow":0}`},
	} {
		got := parseReviewTuning(tc.blob)
		if got.Grow != d.Grow || got.Shrink != d.Shrink || got.ClozeGrow != d.ClozeGrow {
			t.Errorf("%s: %s — want the defaults back", tc.name, got)
		}
	}
}

// A rung outside the bounds every due-ness query floors and caps against is a
// card that is due for ever or never; a ladder that does not ascend is a card
// that cannot climb.
func TestReviewTuningRequiresALadderThatClimbs(t *testing.T) {
	d := defaultReviewTuning()
	for _, blob := range []string{
		`{"ladder1":30,"ladder2":7,"ladder3":100}`,
		`{"ladder1":7,"ladder2":7,"ladder3":100}`,
		`{"ladder1":7,"ladder2":30,"ladder3":100000}`,
		`{"ladder1":0,"ladder2":30,"ladder3":100}`,
	} {
		got := parseReviewTuning(blob)
		if got.ladder() != d.ladder() {
			t.Errorf("%s gave %v, want the default ladder", blob, got.ladder())
		}
	}
	// And a legal one is kept.
	// Inside the bounds every due-ness query clamps to: reviewMinStability is the
	// floor, so a rung below it is a rung the schedule would raise anyway.
	if got := parseReviewTuning(`{"ladder1":10,"ladder2":20,"ladder3":60}`); got.ladder() != [3]float64{10, 20, 60} {
		t.Errorf("a climbing ladder inside the bounds must be kept: %v", got.ladder())
	}
}

func TestReviewTuningDefaultsStoreNothing(t *testing.T) {
	if got := defaultReviewTuning().blob(); got != "" {
		t.Fatalf("blob = %q, want empty so a later change to the defaults reaches the account", got)
	}
	if got := parseReviewTuning(""); got != defaultReviewTuning() {
		t.Fatalf("empty must read as the defaults: %s", got)
	}
	for _, blob := range []string{"{", "null", "[]", `{"grow":"fast"}`, "nonsense"} {
		if got := parseReviewTuning(blob); got != defaultReviewTuning() {
			t.Errorf("%q must read as the defaults, got %s", blob, got)
		}
	}
}

// The tuning has to reach the scheduler, or it is a settings screen with no
// effect — which is the failure a preference is most likely to have.
func TestReviewTuningReachesTheSchedule(t *testing.T) {
	slow := clampTuning(reviewTuning{Grow: 1.2, Shrink: 0.9, ClozeGrow: 1, ClozeShrink: 1,
		ClozeWords: 30, Ladder1: 7, Ladder2: 30, Ladder3: 100})
	fast := defaultReviewTuning()
	// Adaptive, correct answer, same card: a smaller grow must give a shorter
	// half-life. If the tuning were ignored these would be equal.
	gotSlow := nextStability(true, "got", 10, 1, true, slow)
	gotFast := nextStability(true, "got", 10, 1, true, fast)
	if !(gotSlow < gotFast) {
		t.Fatalf("grow is not reaching nextStability: %g vs %g", gotSlow, gotFast)
	}
	// And the cloze weighting.
	heavy := fast
	heavy.ClozeGrow = 2
	if weighByDifficulty(dirCloze, "got", 10, 20, heavy) <= weighByDifficulty(dirCloze, "got", 10, 20, fast) {
		t.Fatal("clozeGrow is not reaching weighByDifficulty")
	}
}
