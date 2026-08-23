package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"tippani/internal/store"
)

// THE ACTOR→PORTRAIT RESOLVER READS THE MAPPING (0048).
//
// Pinning an actor to a provider id from the cast of a film they are IN is the
// whole reason this path exists: the film is the disambiguator, so the id is
// exact. The fallback when nothing is pinned is a by-name person search that the
// code's own comment calls namesake-prone.
//
// Until 0048 the lookup read movies.cast_json — a blob no /cast edit has ever
// written. So the two things the mapping added, a corrected name and a game's
// voice cast, were exactly the two the resolver could not see, and every one of
// them fell through to the namesake-prone search. Both tests below are that fall.

// portraitTMDB is a fake TMDB that ALSO answers the person endpoints, so a
// by-name fallback SUCCEEDS. That is what makes these tests assertions: without
// it the fallback fails too, and a broken lookup is indistinguishable from a
// correct one that found nothing.
func portraitTMDB(t *testing.T, cast string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			_, _ = fmt.Fprint(w, `{"results":[{"id":603,"title":"Portal 2","release_date":"2011-04-19"}]}`)
		case "/movie/603":
			_, _ = fmt.Fprintf(w, `{"id":603,"title":"Portal 2","overview":"A test.","release_date":"2011-04-19",
				"credits":{"cast":%s,"crew":[]}}`, cast)
		case "/search/person":
			// The namesake. A different id, and a headshot of somebody else.
			_, _ = fmt.Fprint(w, `{"results":[{"id":111111,"profile_path":"/namesake.jpg"}]}`)
		default:
			// Every /person/{id} lookup, whichever id got there.
			_, _ = fmt.Fprintf(w, `{"id":0,"biography":"A bio.","birthday":"1943-08-17",
				"profile_path":"%s"}`, "/from-person-"+r.URL.Path[len("/person/"):])
		}
	}))
}

// A NAME THE READER CORRECTS MUST GO ON MATCHING.
//
// The mapping fills dialogues.actor now, so a quote saved after a correction
// carries the corrected spelling and the people page shows it. The blob still
// held the provider's misspelling, so the lookup missed and resolveActorMeta fell
// through to the by-name search — pinning whatever namesake TMDB returns first,
// on a person whose exact id was sitting on the cast row all along.
func TestACorrectedActorNameStillPinsThePortraitFromTheCast(t *testing.T) {
	srv := newTestServer(t)
	fake := portraitTMDB(t, `[{"id":380,"character":"Neil McCauley","name":"Robert De Nero","profile_path":"/de.jpg"}]`)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "bbbbbbbbbbbbbbbb.jpg", nil
	}
	c := signupAdmin(t, srv.Handler())

	m := addFromTMDB(t, c)
	misspelt := castRowFor(t, c, m.ID, "Neil McCauley")
	if misspelt.Actor != "Robert De Nero" {
		t.Fatalf("fixture: %+v", misspelt)
	}
	c.mustDo("PUT", "/cast/"+itoa(misspelt.ID), map[string]any{
		"character": "Neil McCauley", "actor": "Robert De Niro",
	}, http.StatusOK)

	// The chip on the people page exists because a quote names them — and the name
	// the quote carries is the corrected one, taken from the mapping on save.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Don't let yourself get attached.", "character": "Neil McCauley",
	}, http.StatusCreated))
	if d.Actor != "Robert De Niro" {
		t.Fatalf("the auto-fill should have taken the corrected name: %+v", d)
	}

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "actor", "name": "Robert De Niro"}, http.StatusOK))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "tmdb" || res.Person.SourceID != "380" {
		t.Fatalf("actor identity = %s:%s — the cast row's own person id is exact, and the "+
			"by-name search it fell back to is namesake-prone",
			res.Person.Source, res.Person.SourceID)
	}
	if fetched != "https://image.tmdb.org/t/p/original/de.jpg" {
		t.Fatalf("fetched %q, want the cast row's own headshot", fetched)
	}
}

// A GAME'S VOICE ACTOR HAS NOWHERE ELSE TO COME FROM. For most games the blob is
// '[]' (TIP-META-018 measures it: 14 of 24 titles have no Wikidata credits at
// all), and the whole point of the mapping is that the voice cast can now be
// typed or seeded into it. Read from the blob, every one of those actors resolved
// by name.
//
// It also pins the SOURCE WORD. The row names its own supplier now, so a
// Wikidata-seeded credit says 'wikidata' where the blob path labelled it from the
// film's tmdb_id/tvdb_id and said 'tvdb' about a QID. A QID is not a TMDB person
// id and must never be handed to /person/{id}; nor may the by-name search be
// allowed to replace it with a namesake's, which is what this fake returns.
func TestAGamesVoiceActorResolvesFromItsOwnCastRow(t *testing.T) {
	srv := newTestServer(t)
	fake := portraitTMDB(t, `[]`)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	var fetched string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		fetched = rawURL
		return "cccccccccccccccc.jpg", nil
	}
	c := signupAdmin(t, srv.Handler())

	game := createGame(t, c, "Portal 2", "Valve")
	// The shape the Wikidata voice-cast join writes: a QID for a person id and a
	// Commons portrait. Written directly because the provider path for it is a
	// second best-effort request that a test has no business standing up.
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
		                        provider_key, person_id, image_url, billing, origin, source)
		 VALUES (1, 'movie', ?, 'GLaDOS', ?, 'Ellen McLain', ?, ?, 'Q3050810',
		         'https://commons/mclain.jpg', 0, 'provider', 'wikidata')`,
		game, store.CastKey("GLaDOS"), store.CastKey("Ellen McLain"),
		store.ProviderKey("GLaDOS", "Ellen McLain")); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLaDOS",
	}, http.StatusCreated)

	res := decode[portraitResp](t, c.mustDo("POST", "/people/portrait",
		map[string]any{"kind": "actor", "name": "Ellen McLain"}, http.StatusOK))
	if !res.Resolved || !res.Image {
		t.Fatalf("portrait not resolved: %+v", res)
	}
	if res.Person.Source != "wikidata" || res.Person.SourceID != "Q3050810" {
		t.Fatalf("identity = %s:%s — a game's credit is Wikidata's, and a QID must not "+
			"be swapped for whatever a by-name TMDB search returns first",
			res.Person.Source, res.Person.SourceID)
	}
	if fetched != "https://commons/mclain.jpg" {
		t.Fatalf("fetched %q, want the cast row's own headshot", fetched)
	}
}

// A DELETED CREDIT IS NOT A PLACE TO GET A HEADSHOT FROM. The tombstone keeps the
// row's names and its facts so a refetch can decline to resurrect it — which
// makes it exactly the kind of row a lookup that forgets to filter will find.
func TestADeletedCastRowGivesNoPortrait(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Heat"}, http.StatusCreated))
	seeded := seedProviderCast(t, srv, 1, "movie", m.ID, [2]string{"Neil McCauley", "Robert De Niro"})
	c.mustDo("DELETE", "/cast/"+itoa(seeded[0]), nil, http.StatusNoContent)

	// No TMDB key, so there is no fallback to confuse the answer with: the only
	// thing that could resolve this is the tombstone.
	src, pid, img := srv.actorPortraitFromCast(1, "Robert De Niro")
	if src != "" || pid != "" || img != "" {
		t.Fatalf("a tombstone answered a portrait lookup: %q %q %q", src, pid, img)
	}
}
