package httpapi

import (
	"net/http"
	"testing"
)

// What an expanded entry reports, and the two entries that used to report nothing.

type trashEntryResp struct {
	Entry struct {
		ID         int64  `json:"id"`
		Kind       string `json:"kind"`
		Label      string `json:"label"`
		ChildCount int    `json:"child_count"`
	} `json:"entry"`
	Contents []struct {
		Text string `json:"text"`
	} `json:"contents"`
	Works []struct {
		Kind   string `json:"kind"`
		ID     int64  `json:"id"`
		Title  string `json:"title"`
		Cover  string `json:"cover"`
		Quotes int    `json:"quotes"`
	} `json:"works"`
	Record *struct {
		Kind  string `json:"kind"`
		Name  string `json:"name"`
		Image string `json:"image_path"`
	} `json:"record"`
}

type binnedResp struct {
	TrashID int64 `json:"trash_id"`
}

// A BULK DELETE IS ONE ENTRY, and the works are the only thing in it a reader can
// recognise. Each carries its OWN count, which is the whole point: the flat list
// this replaces said 3 quotes for an entry holding two books, and did not say
// which book either quote came from.
func TestAnEntryReportsItsWorksWithTheirOwnCounts(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b1 := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Idiot", "author": "Dostoevsky"}, http.StatusCreated))
	b2 := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Demons", "author": "Dostoevsky"}, http.StatusCreated))
	for _, q := range []string{"one", "two"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": b1.ID, "quote": q}, http.StatusCreated)
	}
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b2.ID, "quote": "three"}, http.StatusCreated)

	binned := decode[binnedResp](t, c.mustDo("POST", "/books/bulk/delete", map[string]any{
		"ids":     []int64{b1.ID, b2.ID},
		"confirm": bulkDeletePhrase("book", 2),
	}, http.StatusOK))

	got := decode[trashEntryResp](t, c.mustDo("GET", "/trash/"+itoa(binned.TrashID), nil, http.StatusOK))
	if len(got.Works) != 2 {
		t.Fatalf("entry reports %d works, want 2: %+v", len(got.Works), got.Works)
	}
	byTitle := map[string]int{}
	for _, w := range got.Works {
		if w.Kind != "book" {
			t.Fatalf("work kind %q, want book", w.Kind)
		}
		if w.ID == 0 {
			t.Fatalf("work has no id: %+v", w)
		}
		byTitle[w.Title] = w.Quotes
	}
	// Two and one, not three and three, and not three and zero.
	if byTitle["The Idiot"] != 2 || byTitle["Demons"] != 1 {
		t.Fatalf("quote counts are %+v, want The Idiot 2 and Demons 1", byTitle)
	}
}

// A DELETED PERSON EXPANDED TO NOTHING, and worse than nothing: its payload is a
// reversal rather than a snapshot, so reading it as a snapshot failed the request
// outright. The row is the name and the face, and both come back now.
func TestAnIdentityEntryReportsItsRecordRatherThanFailing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Marina Tsvetaeva"}, http.StatusOK)
	id := personIDFor(t, srv, 1, "Marina Tsvetaeva")
	del := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/people/"+itoa(id), nil, http.StatusOK))
	if del.TrashID == 0 {
		t.Fatal("the delete parked no undo")
	}

	got := decode[trashEntryResp](t, c.mustDo("GET", "/trash/"+itoa(del.TrashID), nil, http.StatusOK))
	if got.Record == nil {
		t.Fatalf("no record on the entry: %+v", got)
	}
	if got.Record.Kind != "person" || got.Record.Name != "Marina Tsvetaeva" {
		t.Fatalf("record is %+v", got.Record)
	}
	// And it does not pretend to hold works or quotes.
	if len(got.Works) != 0 || len(got.Contents) != 0 {
		t.Fatalf("identity entry reports works %+v contents %+v", got.Works, got.Contents)
	}
}

// A CHARACTER IS THE SAME SHAPE, which is the reason one struct carries both.
func TestADeletedCharacterReportsItsRecord(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	made := decode[struct{ ID int64 }](t, c.mustDo("POST", "/characters",
		map[string]any{"name": "Prince Myshkin"}, http.StatusCreated))
	del := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/characters/"+itoa(made.ID), nil, http.StatusOK))

	got := decode[trashEntryResp](t, c.mustDo("GET", "/trash/"+itoa(del.TrashID), nil, http.StatusOK))
	if got.Record == nil || got.Record.Kind != "character" || got.Record.Name != "Prince Myshkin" {
		t.Fatalf("record is %+v", got.Record)
	}
}

// ONE DELETED BOOK IS STILL ONE WORK, so the expansion is the same shape whether
// the entry came from a bulk delete or a single one. A reader should not have to
// learn two layouts for the same question.
func TestASingleDeletedBookIsAlsoReportedAsAWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Notes from Underground"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b.ID, "quote": "I am a sick man"}, http.StatusCreated)
	del := decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/books/"+itoa(b.ID), nil, http.StatusOK))

	got := decode[trashEntryResp](t, c.mustDo("GET", "/trash/"+itoa(del.TrashID), nil, http.StatusOK))
	if len(got.Works) != 1 || got.Works[0].Title != "Notes from Underground" || got.Works[0].Quotes != 1 {
		t.Fatalf("works are %+v", got.Works)
	}
}
