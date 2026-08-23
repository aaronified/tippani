package httpapi

import (
	"net/http"
	"testing"
)

// THE QUIZ'S "WHO SAID THIS?" POOL COMES FROM THE MAPPING (0048).
//
// This file used to hold TestAGamesTypedVoiceCastIsNotYetAQuizDistractor: a
// tripwire that ASSERTED THE DEFECT, written to fail the day somebody pointed
// quizPools at work_cast so that a known gap was announced rather than
// discovered. It has fired, and these are its fixtures with the assertions turned
// round.
//
// WHY IT WAS LIFTED HERE and not, as it planned, in the commit that drops
// movies.cast_json. Making applyReverifyMovie's cast_json write FILL-ONLY was
// correct and fixed a real defect — /metadata/fill applies through that function,
// and a bulk button with no human in it was rewriting the one pre-0048 copy of
// what the provider said. But castActors was the column's last reader, so the
// freeze starved it: an approved cast diff now writes the mapping and not the
// blob, and the pool went permanently stale, while resyncMovieFromSource still
// replaces the blob whole — one title answering "who else is in this film?" two
// different ways depending on which button the reader pressed. Unfreezing the
// blob hands the first defect back. Moving the reader fixes both, and takes the
// deferral with it.

// poolCast is one work's distractor pool as quizPools builds it.
func poolCast(t *testing.T, srv *Server, uid, movieID int64) []string {
	t.Helper()
	pools, err := srv.quizPools(uid, reviewScope{screen: true}, 1)
	if err != nil {
		t.Fatal(err)
	}
	return pools.byKey[kindScreen+":"+itoa(movieID)].cast
}

// A GAME'S TYPED VOICE CAST IS A DISTRACTOR NOW — the deferral, lifted.
//
// IGDB has no credit endpoint and the Wikidata join finds nothing for most titles
// (TIP-META-018: 14 of 24 measured games had no usable voice cast), so
// movies.cast_json is '[]' for nearly every game and always was. The voice cast
// somebody had just finished typing fed the quote form's autofill, the film page,
// the portrait resolver and the export — and did not feed the one screen that
// would ask them about it.
func TestAGamesTypedVoiceCastFeedsTheQuiz(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	film := createFilm(t, c, "Heat", "Michael Mann")

	// The game's voice cast exists ONLY in work_cast, which for a game is the
	// normal state and not an unusual fixture.
	for _, pair := range [][2]string{
		{"GLaDOS", "Ellen McLain"},
		{"Wheatley", "Stephen Merchant"},
		{"Cave Johnson", "J.K. Simmons"},
	} {
		c.mustDo("POST", "/movies/"+itoa(game)+"/cast", map[string]any{
			"character": pair[0], "actor": pair[1],
		}, http.StatusCreated)
	}
	var blob string
	if err := srv.Store.DB.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, game).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if blob != "[]" {
		t.Fatalf("cast_json = %q — typing a cast row must not write the blob, or this test proves nothing", blob)
	}

	// THE FILM IS THE CONTROL, and it is what says the loader reads the mapping
	// rather than merely reading something: its mapping and its blob disagree, the
	// way they do on every title whose cast has been corrected or approved since
	// 0048, and only one of the two answers is the reader's.
	seedProviderCast(t, srv, 1, "movie", film,
		[2]string{"Neil McCauley", "Robert De Niro"}, [2]string{"Vincent Hanna", "Al Pacino"})
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Nobody","actor":"A Name The Mapping Does Not Have"}]`, film); err != nil {
		t.Fatal(err)
	}

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated)

	// uid 1 is the admin this suite's signup creates, as seedProviderCast assumes.
	pools, err := srv.quizPools(1, reviewScope{screen: true}, 1)
	if err != nil {
		t.Fatal(err)
	}

	gameCast := pools.byKey[kindScreen+":"+itoa(game)].cast
	want := []string{"Ellen McLain", "Stephen Merchant", "J.K. Simmons"}
	if len(gameCast) != len(want) {
		t.Fatalf("the game's pool = %+v, want %+v — a game's credits live in the mapping "+
			"and nowhere else, so reading the blob offered the card nothing at all", gameCast, want)
	}
	for i := range want {
		if gameCast[i] != want[i] {
			t.Fatalf("the game's pool[%d] = %q, want %q — billing order is roughly \"how likely "+
				"is this person to be the answer\", so it is the order of the wrong answers too",
				i, gameCast[i], want[i])
		}
	}

	filmCast := pools.byKey[kindScreen+":"+itoa(film)].cast
	if len(filmCast) != 2 || filmCast[0] != "Robert De Niro" || filmCast[1] != "Al Pacino" {
		t.Fatalf("the film's pool = %+v, want the mapping's two actors — a stale blob is "+
			"exactly what an approved cast diff leaves behind", filmCast)
	}

	// AND THE CARD IS ACTUALLY ASKABLE, which is the end of the chain and the only
	// part the reader sees. Before this the game's whole pool was the one actor
	// already saved on a quoted line — which the distractor design calls the
	// inferior pool in as many words, because offering people the reader has
	// already quoted makes the answer guessable from familiarity.
	card := reviewCard{Kind: kindScreen, ID: game, Direction: dirSpeaker,
		Quote: "The cake is a lie.", Title: "Portal 2", Character: "GLaDOS", Actor: "Ellen McLain"}
	if !attachSpeaker(&card, kindScreen+":"+itoa(game), pools, 7) {
		t.Fatal("no speaker card from a three-strong typed voice cast")
	}
	if len(card.Options) < speakerMinOptions {
		t.Fatalf("too few faces to be a question: %+v", card.Options)
	}
	if card.Options[card.Answer] != "Ellen McLain" {
		t.Fatalf("the answer option is not the line's voice actor: %+v (answer %d)", card.Options, card.Answer)
	}
	// The game's OWN cast supplies the distractors first, which is the whole point
	// of the direction — three actors from elsewhere in the library make the answer
	// guessable from familiarity rather than from the game. (The card still widens
	// to the library for its fourth face, because two distractors is one short of
	// quizOptions; that fallback is not what is under test here.)
	offered := map[string]bool{}
	for _, o := range card.Options {
		offered[o] = true
	}
	for _, a := range []string{"Stephen Merchant", "J.K. Simmons"} {
		if !offered[a] {
			t.Errorf("%q is in this game's voice cast and was not offered: %+v", a, card.Options)
		}
	}
}

// THE POOL FOLLOWS AN APPROVED CAST, which is the half the freeze broke.
//
// The blob is written whole by the create-from-source path and then never again
// by an approval — that is what "fill-only" means — so a title whose provider list
// has grown since it was added has a mapping the pool could not see. Measured on
// this fixture: two rows in the mapping, one name in the pool.
//
// AND THREE THINGS ARE LEFT OUT ON PURPOSE, because each would put something on
// the card that is not an answer somebody could pick.
func TestTheQuizPoolFollowsTheMappingAndLeavesOutWhatIsNotAnAnswer(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	// The provider now bills a second person and the reader approves the lot. This
	// is applyReverifyMovie, which writes the mapping and leaves the frozen blob
	// exactly as the create path wrote it.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{"type": "movie", "id": m.ID, "set": map[string]any{
			"cast": []map[string]any{
				{"character": "GLaDOS", "actor": "Ellen McLain", "person_id": "6384"},
				{"character": "Cave Johnson", "actor": "J.K. Simmons", "person_id": "9"},
			},
		}}},
	}, http.StatusOK)

	pool := poolCast(t, srv, 1, m.ID)
	if len(pool) != 2 {
		t.Fatalf("pool = %+v, want both approved actors — the blob still holds only the one "+
			"the create path wrote, so a card built from it goes stale the first time a "+
			"diff is approved and never recovers", pool)
	}

	// A TOMBSTONE IS NOT AN OPTION. The reader deleted the credit; offering it as a
	// wrong answer is the resurrection `origin` exists to refuse.
	gone := castRowFor(t, c, m.ID, "Cave Johnson")
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)
	pool = poolCast(t, srv, 1, m.ID)
	if len(pool) != 1 || pool[0] != "Ellen McLain" {
		t.Fatalf("pool = %+v after a deletion, want just the credit that is still on the list", pool)
	}

	// A ROW WITH NO ACTOR IS NOT AN OPTION either — every book character has none,
	// and so does a game credit whose voice actor is still unknown. A nameless
	// distractor is not a distractor.
	c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{"character": "Chell"},
		http.StatusCreated)
	if pool = poolCast(t, srv, 1, m.ID); len(pool) != 1 {
		t.Fatalf("pool = %+v — a credit with no actor has no face to offer", pool)
	}

	// AND AN ACTOR BILLED TWICE IS ONE FACE. A role played young and old is two
	// credits and one person to choose between.
	seedProviderCast(t, srv, 1, "movie", m.ID,
		[2]string{"Young Vito", "Robert De Niro"}, [2]string{"Vito", "Robert De Niro"})
	pool = poolCast(t, srv, 1, m.ID)
	if len(pool) != 2 {
		t.Fatalf("pool = %+v, want two distinct faces — a double-billed actor is offered once", pool)
	}

	// A BOOK'S CHARACTERS STAY OUT OF THE SCREEN POOL. They are cast rows on the
	// same table, they have no actor by design, and the screen pool is keyed by
	// movies.id — so a book id colliding with a film id is the way they would leak.
	book := createTestBook(t, c, "Moby-Dick", "Herman Melville")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Ahab"},
		http.StatusCreated)
	if got := poolCast(t, srv, 1, m.ID); len(got) != 2 {
		t.Fatalf("pool = %+v after a book gained a character — the screen pool is "+
			"kind = 'movie' only", got)
	}
}
