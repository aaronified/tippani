package httpapi

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// Two things a quote can now say that it could not before (0070).
//
// ── A quote can name who it reaches us through.
//
// The owner's case: "socrates' speeches are known from plato's paraphrasing."
// Socrates is the speaker; Plato is neither the speaker nor the person spoken to.
// He is the reason there is a text. Before this there was nowhere to put him but
// the note, where nothing can group by him, cite him or find him — so the promise
// under test is not only that the field stores, but that the NAME IS A WAY IN.
//
// ── A line of film dialogue can say where it stops.
//
// "Film timestamp: start and end". A line occupies a stretch of the runtime, and
// the app has only ever recorded where that stretch begins.
const (
	apology      = "The unexamined life is not worth living"
	socrates     = "Socrates"
	plato        = "Plato"
	platoApology = "Apology"
)

func TestASpeechNamesWhoItReachesUsThrough(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, map[string]any{
		"quote":         apology,
		"speaker":       socrates,
		"kind":          "speech",
		"work_title":    platoApology,
		"source_author": plato,
	})
	if u.SourceAuthor != plato {
		t.Fatalf("create dropped the source author: got %q", u.SourceAuthor)
	}
	// FOUR NAMES ON ONE ROW AND NONE OF THEM IS ANOTHER. The point of a fifth
	// column rather than reusing one is that the reader means four different
	// things; a field that quietly landed in `speaker` would make Plato the person
	// who said this.
	if u.Speaker != socrates {
		t.Fatalf("the source author overwrote the speaker: %q", u.Speaker)
	}

	// THE READ IS A SEPARATE CLAIM FROM THE WRITE — the pair that broke for
	// occasion_circa, which was accepted, stored and never sent back, so it was
	// write-only across the whole app for a release. The list is the read (there is
	// no single-quote GET) and it is the right assertion anyway: the card's
	// attribution line draws this.
	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 || list.Utterances[0].SourceAuthor != plato {
		t.Fatalf("list row lacks the source author: %+v", list.Utterances)
	}

	// Editable and clearable: an attribution somebody got wrong has to be
	// removable, not only replaceable.
	body := map[string]any{"quote": apology, "speaker": socrates, "source_author": "Xenophon", "color": "yellow"}
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	after := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if after.Utterances[0].SourceAuthor != "Xenophon" {
		t.Fatalf("update did not take: got %q", after.Utterances[0].SourceAuthor)
	}
	body["source_author"] = ""
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	cleared := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if cleared.Utterances[0].SourceAuthor != "" {
		t.Fatalf("clearing the source author did not take: got %q", cleared.Utterances[0].SourceAuthor)
	}
}

// THE WHOLE REASON TO RECORD PLATO is to find the Socrates lines by typing Plato.
// A name stored outside the search index is a name you can only reach by
// remembering which quote it sits on — which is the thing you were looking up. So
// this searches for a word that appears in NO other column of the row.
func TestTheSourceAuthorFindsTheQuoteHeTransmits(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{
		"quote":         apology,
		"speaker":       socrates,
		"kind":          "speech",
		"source_author": plato,
	})

	res := decode[searchResults](t, c.mustDo("GET", "/search?q="+url.QueryEscape(plato), nil, http.StatusOK))
	if len(res.Quotes) != 1 {
		t.Fatalf("searching the source author found %d quotes, want 1 — is source_author in utterances_fts?", len(res.Quotes))
	}
	if res.Quotes[0].Quote != apology {
		t.Fatalf("found the wrong quote: %q", res.Quotes[0].Quote)
	}
}

// A line of dialogue holds both ends of its stretch, and a game's line holds
// neither — which is the same rule the start has obeyed since 0047, applied to
// the end. A form that offered a box the server threw away would be offering to
// record something it does not keep.
func TestAFilmLineKeepsBothEndsAndAGameLineKeepsNone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Stalker"}, http.StatusCreated))
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id":      film.ID,
		"quote":         "Let everything that's been planned come true",
		"timestamp":     "01:12:40",
		"timestamp_end": "01:13:02",
	}, http.StatusCreated))
	if d.Timestamp != "01:12:40" || d.TimestampEnd != "01:13:02" {
		t.Fatalf("the film line lost an end: %q .. %q", d.Timestamp, d.TimestampEnd)
	}

	// The list is what the card reads, and a range the card cannot see is a range
	// the reader never gets back.
	list := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film.ID), nil, http.StatusOK))
	if len(list.Dialogues) != 1 || list.Dialogues[0].TimestampEnd != "01:13:02" {
		t.Fatalf("list row lacks the end: %+v", list.Dialogues)
	}

	// A GAME HAS NO RUNTIME TO POINT INTO, either end. The server clears rather
	// than refuses (normalizeLocator's stated rule), so this asserts the clearing.
	game := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Disco Elysium", "media_type": "game",
	}, http.StatusCreated))
	g := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id":      game.ID,
		"quote":         "You are not a bad person",
		"timestamp":     "00:04:00",
		"timestamp_end": "00:04:11",
		"act":           "Day Two",
		"quest":         "Kim Kitsuragi",
	}, http.StatusCreated))
	if g.Timestamp != "" || g.TimestampEnd != "" {
		t.Fatalf("a game's line kept a runtime: %q .. %q", g.Timestamp, g.TimestampEnd)
	}
	if g.Act != "Day Two" || g.Quest != "Kim Kitsuragi" {
		t.Fatalf("clearing the runtime took the game's own locators with it: %q / %q", g.Act, g.Quest)
	}
}

// AN EXPORT THAT CANNOT BE RE-IMPORTED IS DATA LOSS WITH A SUCCESS MESSAGE. Both
// new fields are written by the exporter, so both have to be read back by the
// parser — otherwise a reader who exports a film and re-imports the file finds the
// ends gone and nothing said so.
func TestBothNewFieldsSurviveTheirOwnExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Stalker"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Let everything come true",
		"timestamp": "01:12:40", "timestamp_end": "01:13:02",
	}, http.StatusCreated)
	newUtterance(t, c, map[string]any{
		"quote": apology, "speaker": socrates, "kind": "speech", "source_author": plato,
	})

	movieMD := c.mustDo("POST", "/export/movies", map[string]any{"ids": []int64{film.ID}}, http.StatusOK).Body.String()
	if !strings.Contains(movieMD, "timestamp_end: 01:13:02") {
		t.Fatalf("the film export omits the end:\n%s", movieMD)
	}
	quoteMD := c.mustDo("POST", "/export/quotes", map[string]any{}, http.StatusOK).Body.String()
	if !strings.Contains(quoteMD, "source_author: "+plato) {
		t.Fatalf("the quote export omits the source author:\n%s", quoteMD)
	}
}
