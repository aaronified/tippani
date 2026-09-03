package httpapi

import (
	"encoding/json"
	"strings"

	"tippani/internal/store"
)

// What an expanded bin entry shows, beyond the quotes it is holding.
//
// WHY THE FLAT LIST WAS NOT ENOUGH. snapshotContents answers "what lines went
// with this", which is the right answer for one deleted highlight and useless for
// a bulk delete: "5 books" expanded into 340 quote texts with nothing saying which
// book each came from. A reader who deleted a shelf and wants one title back could
// see every line they had ever kept and still not find the book.
//
// So an entry now also reports its WORKS — one row per book or film in the
// payload, with the cover and its own share of the quotes — and its RECORD, for
// the person and character entries whose payload is a reversal rather than a
// snapshot and which had nothing to expand at all.
//
// STILL NOT A DATABASE DUMP. The fields here are the ones a row needs to be
// recognisable and openable: a title, a cover, a count, an id. Everything else the
// payload holds stays in the payload — snapshotContents' note applies word for
// word, and the endpoint that opens one of these works is where the rest is read,
// once, for the one work asked for.

// trashWork is one book or film inside an entry.
type trashWork struct {
	Kind   string `json:"kind"` // book | movie, the app's own words
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Cover  string `json:"cover"`
	Quotes int    `json:"quotes"`
}

// trashRecord is the person or character an identity entry took.
type trashRecord struct {
	Kind  string `json:"kind"` // person | character
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Image string `json:"image_path"`
}

// workTables pairs a snapshot's work table with the child table whose rows point
// at it, and the column they point with. A table rather than a switch for the
// reason trashTable is one: the two halves of "what is a work here" have to agree,
// and a third kind added to one and not the other is a work that expands to no
// quotes with nothing saying why.
var workTables = []struct {
	Kind      string
	Table     string
	Children  string
	ParentCol string
}{
	{Kind: "book", Table: "books", Children: "annotations", ParentCol: "book_id"},
	{Kind: "movie", Table: "movies", Children: "dialogues", ParentCol: "movie_id"},
}

// snapshotWorks lists the works in a payload with each one's own quote count.
//
// The counts are computed from the payload rather than from the database, because
// the database no longer has these rows — that is what being in the bin means. A
// count read live would be zero for every work here.
func snapshotWorks(snap snapshot) []trashWork {
	out := []trashWork{}
	for _, wt := range workTables {
		rows := snap[wt.Table]
		if len(rows) == 0 {
			continue
		}
		// One pass over the children per work table, not per work: a shelf of
		// forty books with nine thousand highlights is a real payload, and the
		// nested walk it replaces was quadratic in the thing most likely to be big.
		counts := map[int64]int{}
		for _, child := range snap[wt.Children] {
			if id, ok := intOf(child[wt.ParentCol]); ok {
				counts[id]++
			}
		}
		for _, row := range rows {
			id, ok := intOf(row["id"])
			if !ok {
				continue
			}
			title := strings.TrimSpace(stringOf(row["title"]))
			out = append(out, trashWork{
				Kind:   wt.Kind,
				ID:     id,
				Title:  title,
				Cover:  strings.TrimSpace(stringOf(row["cover_path"])),
				Quotes: counts[id],
			})
		}
	}
	return out
}

// snapshotRecord reads the person or character out of an identity entry.
//
// These entries were the blank ones: their payload is a store.RecordDeleteUndo,
// which snapshotContents cannot read at all, so expanding "Mikhail Bulgakov"
// showed an empty list under a chevron that had promised something. The face and
// the name are what the row is, and the same shape carries both kinds because
// RecordDeleteUndo does.
func snapshotRecord(kind, payload string) *trashRecord {
	var want string
	switch kind {
	case "person-delete", "person-merge":
		want = "person"
	case "character-delete", "character-merge":
		want = "character"
	default:
		return nil
	}
	var u store.RecordDeleteUndo
	if err := json.Unmarshal([]byte(payload), &u); err != nil || u.Row == nil {
		// A merge's payload is a different struct and will not decode into this
		// one; that is not an error worth logging, it is a kind with no single
		// record to show.
		return nil
	}
	name := strings.TrimSpace(stringOf(u.Row["name"]))
	if name == "" {
		return nil
	}
	return &trashRecord{
		Kind:  want,
		ID:    u.ID,
		Name:  name,
		Image: strings.TrimSpace(stringOf(u.Row["image_path"])),
	}
}
