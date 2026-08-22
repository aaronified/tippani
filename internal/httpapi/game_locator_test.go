package httpapi

// Where a line is, per medium — the one rule in this file that no CHECK can
// enforce, because a game, a film and a show are all `movies` rows (0025, 0040)
// and SQLite cannot reach across from `dialogues` to `movies.media_type`.
//
// So it is a Go rule, and a Go rule with three medium-shaped halves is three
// places to forget one. normalizeLocator is the one place; these are the tests
// that say it ran.
//
// EVERY REFUSAL HERE IS A CLEAR, NOT A 400, and that is the decision worth
// stating rather than discovering. episodeRef.normalize made it first and wrote
// the reason down: a work retargeted from a show to a film leaves its lines
// holding episode numbers that mean nothing, and refusing them would make every
// later edit of those lines fail from a form that (correctly) no longer offers
// the field. The same argument covers act, quest and episode_name — and it is
// stronger for the timestamp, because nothing in the shipped capture forms gates
// that box by media type, so a 400 would refuse every game line the app itself
// is currently able to send.
//
// A malformed value is still a 400. Too long is too long on any medium.

import (
	"net/http"
	"testing"

	"tippani/internal/store"
)

func newWork(t *testing.T, c *testClient, title, mediaType string) int64 {
	t.Helper()
	return idOf(t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": mediaType}, http.StatusCreated).Body.Bytes())
}

func newLine(t *testing.T, c *testClient, body map[string]any) dialogueRow {
	t.Helper()
	return decode[dialogueRow](t, c.mustDo("POST", "/dialogues", body, http.StatusCreated))
}

// The table is the rule: one row per (medium, field it does and does not keep).
// Written as one POST and one read-back so a field kept on create and dropped on
// fetch cannot pass.
func TestALineIsLocatedTheWayItsMediumLocatesThings(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	game := newWork(t, c, "Disco Elysium", "game")
	film := newWork(t, c, "Casablanca", "movie")
	show := newWork(t, c, "The Wire", "show")

	for _, tc := range []struct {
		name    string
		work    int64
		body    map[string]any
		wantAct string
		wantQst string
		wantTS  string
		wantEpN string
		wantSea bool // an episode number survived
	}{
		{
			// The point of the whole change: a game's line is placed by its act
			// and its quest, and both come back.
			name:    "a game keeps its act and its quest",
			work:    game,
			body:    map[string]any{"quote": "the tribunal", "act": "2", "quest": "The Whirling"},
			wantAct: "2", wantQst: "The Whirling",
		},
		{
			// The case a 400 would have broken: AddSurface sends a timestamp for
			// every screen work, game included, and no form gates it yet.
			name:    "and a game is not given a timestamp, which is dropped rather than refused",
			work:    game,
			body:    map[string]any{"quote": "a bark", "act": "1", "timestamp": "01:12:40"},
			wantAct: "1",
		},
		{
			// A game has no run and no episodes either — same rule as a film's,
			// inherited from episodeRef.normalize, which is why act and quest
			// could not simply have been bolted onto it.
			name:    "nor a season and an episode",
			work:    game,
			body:    map[string]any{"quote": "another bark", "quest": "The Well", "season": 1, "episode": 2},
			wantQst: "The Well",
		},
		{
			name: "a film keeps its timestamp and is refused an act and a quest",
			work: film,
			body: map[string]any{
				"quote": "here's looking at you", "timestamp": "01:40:00",
				"act": "3", "quest": "Letters of Transit", "episode_name": "Pilot",
			},
			wantTS: "01:40:00",
		},
		{
			name: "a show keeps its episode, its name and its timestamp",
			work: show,
			body: map[string]any{
				"quote": "all the pieces matter", "season": 1, "episode": 6,
				"episode_name": "The Wire", "timestamp": "00:22:10",
			},
			wantTS: "00:22:10", wantEpN: "The Wire", wantSea: true,
		},
		{
			// An episode name is a name for an episode. A film has none, so
			// there is nothing for the name to be the name of.
			name: "but a film is refused an episode name",
			work: film,
			body: map[string]any{"quote": "round up the usual suspects", "episode_name": "Pilot"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"movie_id": tc.work}
			for k, v := range tc.body {
				body[k] = v
			}
			created := newLine(t, c, body)
			// Read it back through a second endpoint, so a value the create
			// response echoed from the request rather than from the row cannot
			// pass. fetchDialogue and the list share dialogueCols, so this covers
			// the SELECT as well as the INSERT.
			fetched := decode[struct {
				Dialogues []dialogueRow `json:"dialogues"`
			}](t, c.mustDo("GET", "/dialogues?id="+itoa(created.ID), nil, http.StatusOK)).Dialogues
			if len(fetched) != 1 {
				t.Fatalf("the line did not come back: %+v", fetched)
			}
			for _, got := range []dialogueRow{created, fetched[0]} {
				if got.Act != tc.wantAct {
					t.Errorf("act = %q, want %q", got.Act, tc.wantAct)
				}
				if got.Quest != tc.wantQst {
					t.Errorf("quest = %q, want %q", got.Quest, tc.wantQst)
				}
				if got.Timestamp != tc.wantTS {
					t.Errorf("timestamp = %q, want %q", got.Timestamp, tc.wantTS)
				}
				if got.EpisodeName != tc.wantEpN {
					t.Errorf("episode_name = %q, want %q", got.EpisodeName, tc.wantEpN)
				}
				if (got.Episode != nil) != tc.wantSea {
					t.Errorf("episode = %v, want present=%v", got.Episode, tc.wantSea)
				}
			}
		})
	}
}

// The other half of full-state: a PUT runs the same rule, so retargeting a game
// to a film and saving the line heals it instead of failing forever. This is the
// case episodeRef.normalize's comment is actually about, one medium over.
func TestRetargetingAWorkHealsItsLinesOnTheNextSave(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	work := newWork(t, c, "Alan Wake", "game")
	line := newLine(t, c, map[string]any{
		"movie_id": work, "quote": "it's not a lake, it's an ocean",
		"act": "Episode 1", "quest": "Nightmare",
	})
	if line.Act == "" {
		t.Fatal("the game line did not take its act to begin with")
	}

	// The reader decides it is really a show after all.
	c.mustDo("PUT", "/movies/"+itoa(work),
		map[string]any{"title": "Alan Wake", "media_type": "show"}, http.StatusOK)

	got := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(line.ID), map[string]any{
		"quote": "it's not a lake, it's an ocean",
		"act":   "Episode 1", "quest": "Nightmare",
		"season": 1, "episode": 1, "episode_name": "Nightmare",
	}, http.StatusOK))
	if got.Act != "" || got.Quest != "" {
		t.Errorf("a show's line kept a game's locator: act=%q quest=%q", got.Act, got.Quest)
	}
	if got.EpisodeName != "Nightmare" || got.Episode == nil || *got.Episode != 1 {
		t.Errorf("the show locator did not land: %+v", got)
	}
}

// A cap is a property of the column and not of the medium, so it is refused on
// every medium — including the one that will not keep the value anyway. A 400
// here rather than a clear because a client sending 300 characters into a 128
// column has a bug, and silently truncating it would lose the reader's words.
func TestALocatorTooLongToStoreIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	game := newWork(t, c, "Outer Wilds", "game")
	film := newWork(t, c, "Solaris", "movie")

	long := func(n int) string {
		b := make([]byte, n)
		for i := range b {
			b[i] = 'x'
		}
		return string(b)
	}
	for _, tc := range []struct {
		field string
		work  int64
		value string
	}{
		{"act", game, long(129)},
		{"quest", game, long(129)},
		{"episode_name", game, long(201)},
		// The medium that drops the field still refuses one it could not store.
		{"act", film, long(129)},
	} {
		body := map[string]any{"movie_id": tc.work, "quote": "a line " + tc.field + itoa(tc.work), tc.field: tc.value}
		c.mustDo("POST", "/dialogues", body, http.StatusBadRequest)
	}
}

// THE IDENTITY HALF. 0047 folded act and quest into the dedupe hash for the same
// reason 0025 folded in season and episode: a bark reused in two quests is two
// quotes, and the same bark saved twice in one quest is one.
//
// The failure this guards against is silent in both directions. Left out of the
// hash, the second quest's copy is refused as a duplicate and the line is simply
// missing. Folded in wrongly — say act and quest concatenated inside one segment
// — act "xq" and quest "" would collide with act "x" and quest "y", and the
// collision would land on whichever the reader saved second.
func TestTheSameBarkInTwoQuestsIsTwoLines(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	game := newWork(t, c, "Skyrim", "game")

	const bark = "I used to be an adventurer like you."
	first := newLine(t, c, map[string]any{"movie_id": game, "quote": bark, "quest": "Whiterun"})
	second := newLine(t, c, map[string]any{"movie_id": game, "quote": bark, "quest": "Riften"})
	if first.ID == second.ID {
		t.Fatal("the same bark in two quests collapsed into one line")
	}

	// Twice in one quest is still one line, which is the property that makes the
	// hash a dedupe hash rather than a serial number.
	c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": game, "quote": bark, "quest": "Riften"}, http.StatusConflict)

	// And a film's line is unaffected: with no locator at all the hash is
	// byte-identical to the plain text hash, which is what lets every row already
	// on disk keep the value it has. Asserted against the store function rather
	// than inferred, because that identity is the migration's whole argument.
	if store.DialogueDedupeHash(bark, nil, nil, "", "") != store.DedupeHash(bark) {
		t.Fatal("an unlocated line must hash as the bare text, or existing rows need rewriting")
	}
	if store.DialogueDedupeHash(bark, nil, nil, "xq", "") == store.DialogueDedupeHash(bark, nil, nil, "x", "y") {
		t.Fatal("act and quest must not be able to forge each other's boundary")
	}
}

// A whitespace-only act is the same as no act, all the way through the stack: it
// takes the early return in DialogueDedupeHash, so a form field holding a space
// cannot fork a duplicate of a line that was saved without one.
func TestASpaceIsNotAnAct(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	game := newWork(t, c, "Hollow Knight", "game")

	const line = "No cost too great."
	plain := newLine(t, c, map[string]any{"movie_id": game, "quote": line})
	if plain.Act != "" {
		t.Fatalf("act came back %q on a line that sent none", plain.Act)
	}
	c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": game, "quote": line, "act": "   "}, http.StatusConflict)
}
