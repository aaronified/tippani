package httpapi

import (
	"net/http"
	"testing"
)

// MERGING ONE TAG INTO ANOTHER, AND THE COLLISION THAT MAKES IT HARD.
//
// A near-duplicate pair — "translation" and "on translation" — is a pair a reader
// has used interchangeably, so some quotes carry one, some the other, and SOME
// CARRY BOTH. Both join tables are PRIMARY KEY (quote, tag), so the obvious
// implementation (`UPDATE annotation_tags SET tag_id = keep WHERE tag_id = drop`)
// aborts the whole transaction on the first quote that already has both — and the
// merge does nothing while looking, from the client, like a 500 on a good request.
//
// So the case below MAKES that quote deliberately. Without it a merge written the
// naive way passes every assertion here.

type tagMergeResp struct {
	Tag   tagRow `json:"tag"`
	Moved int    `json:"moved"`
}

func TestMergingATagKeepsEveryQuoteThatCarriedEitherOne(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))

	// One quote under each name, and ONE UNDER BOTH — the row that collides.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "only the loser's name", "tags": []string{"on translation"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "only the survivor's name", "tags": []string{"translation"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "both names at once", "tags": []string{"translation", "on translation"},
	}, http.StatusCreated)
	// A FILM LINE TOO, because the tag joins are two tables and a merge that only
	// learned one would leave every dialogue pointing at a tag that is gone.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "here's looking at you", "tags": []string{"on translation"},
	}, http.StatusCreated)

	before := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	var keep, drop int64
	for _, tg := range before.Tags {
		switch tg.Name {
		case "translation":
			keep = tg.ID
		case "on translation":
			drop = tg.ID
		}
	}
	if keep == 0 || drop == 0 {
		t.Fatalf("both tags should exist before the merge: %v", tagNames(before.Tags))
	}

	got := decode[tagMergeResp](t, c.mustDo("POST", "/tags/merge",
		map[string]any{"keep_id": keep, "drop_ids": []int64{drop}}, http.StatusOK))

	// THE SURVIVOR CARRIES EVERY QUOTE EITHER NAME CARRIED, counted once. Three
	// annotations mentioned one or the other; one film line did. A merge that
	// dropped the collision row would report three.
	if got.Tag.Annotations != 3 || got.Tag.Dialogues != 1 {
		t.Fatalf("the survivor lost quotes in the merge: %+v", got.Tag)
	}
	// AND `moved` IS WHAT GAINED THE TAG, not what was touched: the quote that
	// already carried both gains nothing, so two of the three, plus the line.
	if got.Moved != 2 {
		t.Fatalf("moved should count the quotes that gained the tag, got %d", got.Moved)
	}
	after := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	for _, tg := range after.Tags {
		if tg.Name == "on translation" {
			t.Fatalf("the merged-away tag is still in the vocabulary")
		}
	}
}

// ANOTHER ACCOUNT'S TAG IS NOT THERE, which for this endpoint means two separate
// things and the second is the dangerous one: a merge INTO somebody else's tag
// must not quietly delete your own on the way.
func TestMergingTagsCannotReachAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	other := addUser(t, h, owner, "intruder")

	book := decode[bookDetail](t, owner.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	owner.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "mine", "tags": []string{"keepme", "dropme"},
	}, http.StatusCreated)
	mine := decode[tagsResp](t, owner.mustDo("GET", "/tags", nil, http.StatusOK))
	var keep, drop int64
	for _, tg := range mine.Tags {
		switch tg.Name {
		case "keepme":
			keep = tg.ID
		case "dropme":
			drop = tg.ID
		}
	}

	// Merging MY tag into a stranger's is a 404 — and the interesting half is
	// that `dropme` has to survive it. A loop that checked only the losers would
	// have deleted it before discovering the survivor was not there.
	other.mustDo("POST", "/tags/merge",
		map[string]any{"keep_id": keep, "drop_ids": []int64{drop}}, http.StatusNotFound)
	still := decode[tagsResp](t, owner.mustDo("GET", "/tags", nil, http.StatusOK))
	found := 0
	for _, tg := range still.Tags {
		if tg.Name == "keepme" || tg.Name == "dropme" {
			found++
		}
	}
	if found != 2 {
		t.Fatalf("a stranger's merge removed one of my tags: %v", tagNames(still.Tags))
	}
}
