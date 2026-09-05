package httpapi

import (
	"net/http"
	"testing"
)

// TAKING THE PERFORMER OFF A CREDIT IS NOT TAKING THE CHARACTER OFF THE WORK.
//
// THE REPORT, the owner's, arrived as three symptoms of one cause: "this was
// created by accidentally deleting the actor within the character card. the
// character card opened prior to that. however, that should not make the
// character card inaccessible. and that should also remove the actor from the
// quote (not the work, because that is via a different route)."
//
// The ✕ on a credit row called `DELETE /cast/{id}`, which removes the whole
// casting. So the character left the work — and a character that has left the
// work has no cast row for a quote's chip to open, which is why the chip went
// dead — while the LINE went on printing "played by" the performer the casting
// no longer had, because a film line stores that name itself.
//
// TWO FACTS, TWO ROUTES, AND THE OWNER NAMED THE DISTINCTION: the work is left
// through the sheet's own dashed verb, and this ✕ is only about who is on the
// credit.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a work's cast
// lives in `work_cast` while a line's own credit is `dialogues.actor`.
func TestTakingThePerformerOffLeavesTheCharacterOnTheWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Anand", "media_type": "movie"}, http.StatusCreated))
	row := decode[doorRow](t, c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Anand", "actor": "Rajesh Khanna"}, http.StatusCreated))
	line := decode[struct{ ID int64 }](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "बाबुमोशाय", "character": "Anand", "actor": "Rajesh Khanna",
	}, http.StatusCreated))

	c.mustDo("DELETE", "/cast/"+itoa(row.ID)+"/actor", nil, http.StatusNoContent)

	// ── THE CHARACTER IS STILL ON THE WORK, which is the first half: a casting
	// that is gone has nothing for a chip to open.
	var character, actor, origin string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(character, ''), COALESCE(actor, ''), origin FROM work_cast WHERE id = ?`,
		row.ID).Scan(&character, &actor, &origin); err != nil {
		t.Fatalf("the casting is gone entirely: %v", err)
	}
	if character != "Anand" {
		t.Fatalf("the character left the work: %q", character)
	}
	if origin == "removed" {
		t.Fatal("the casting was tombstoned, so the character's chip has nothing left to open")
	}
	if actor != "" {
		t.Fatalf("the performer is still on the credit: %q", actor)
	}
	var actorID any
	if err := srv.Store.DB.QueryRow(`SELECT actor_id FROM work_cast WHERE id = ?`, row.ID).Scan(&actorID); err != nil {
		t.Fatal(err)
	}
	if actorID != nil {
		t.Fatalf("the credit still points at the person record: %v", actorID)
	}

	// ── AND ITS CHIP STILL OPENS, asked through the read the client actually
	// gates the press on rather than by looking at the column again.
	after := decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/cast", nil, http.StatusOK))
	var found bool
	for _, r := range after.Cast {
		if r.Character != "Anand" {
			continue
		}
		found = true
		if r.CharacterID == 0 {
			t.Error("the casting survived with no character record — its chip opens nothing")
		}
	}
	if !found {
		t.Fatal("the character is not on the work's cast list any more")
	}

	// ── AND THE LINE LOSES THEM TOO, which is the second half. A line's credit is
	// a copy of the casting's answer, so a casting naming nobody must not leave
	// the line naming somebody.
	var lineActor string
	var lineActorID any
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(actor, ''), actor_id FROM dialogues WHERE id = ?`, line.ID).
		Scan(&lineActor, &lineActorID); err != nil {
		t.Fatal(err)
	}
	if lineActor != "" || lineActorID != nil {
		t.Fatalf("the quote still names the performer: %q / %v", lineActor, lineActorID)
	}

	// ── AND THE WORK IS UNTOUCHED, which is the distinction the owner drew: the
	// film is left through a different route and this one must not take it.
	var title string
	if err := srv.Store.DB.QueryRow(`SELECT title FROM movies WHERE id = ?`, film.ID).Scan(&title); err != nil {
		t.Fatalf("the film went with the performer: %v", err)
	}
}
