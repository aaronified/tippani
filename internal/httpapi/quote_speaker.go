package httpapi

import (
	"strings"

	"tippani/internal/olog"
)

// THE SPEAKER A QUOTE POINTS AT, resolved once for a whole page of quotes.
//
// WHY THIS IS NOT characterImagesFor NEXT DOOR, which already turns a line's
// character text into faces. The two answer different questions and only one of
// them is a speaker:
//
//	character_images  WHO IS NAMED ON THIS LINE. Derived at read time by folding
//	                  the line's own `character` text and matching it against the
//	                  work's cast. A line naming three characters yields three.
//	speaker_cast_id   WHO SAID IT. A stored link into `work_cast`, written by
//	                  store.SyncQuoteCast on every quote write and maintained
//	                  through a character merge. Exactly one, or none.
//
// A line can name a room full of people and be spoken by one of them, so the
// second cannot be derived from the first. It also survives what the first does
// not: merge two records and the stored link follows the surviving row, while a
// name match silently re-resolves to whatever now folds the same way.
//
// ONE QUERY FOR THE PAGE, in the shape the character-image lookup beside it
// already uses. Best-effort in the same way too — a page of quotes must render
// whether or not this resolves, and a quote with no speaker is the normal case.
type quoteSpeakerCast struct {
	// The cast row itself, which is what the client hands back when it asks the
	// character panel to open on THIS billing — see identity.jsx, where a work
	// billing one character twice needs the row and not just the work.
	CastID int64 `json:"cast_id"`
	// The `characters` record behind the row, and the chip's whole destination.
	// Zero when the row has never been linked to one, in which case the client
	// draws the chip WITHOUT its press: a link to a page that does not exist is
	// worse than no link, but the name is still the thing the row exists to show
	// — and on a line naming several characters none of the others has a record
	// behind it either, so a chip that does not open is the ordinary case rather
	// than a broken one.
	CharacterID int64 `json:"character_id,omitempty"`
	// WHAT THIS WORK BILLS THEM AS, which is the name to print. `work_cast`'s own
	// column, never rewritten by a merge — a novel's "the professor" is a film's
	// "Woland" and the card is about this work.
	Name string `json:"name"`
	// THE RECORD'S CANONICAL NAME, which is the name to HASH. The pack is explicit
	// (handoff 1.8): hash the canonical name, never the billing, "otherwise a
	// person changes face between two books". Omitted when it equals Name, which
	// is the overwhelmingly common case and keeps it off the wire for most rows.
	RecordName string `json:"record_name,omitempty"`
	// This work's picture of them, falling back to the record's default — the same
	// ladder, and for the same merge reason, that loadCharacterImages spells out.
	Image string `json:"image,omitempty"`
	// WHO PLAYED THEM, and their portrait. Two fields rather than folding the
	// portrait into Image above, because the card wants BOTH: the chip is two
	// lines, the character over the actor, and a character with no picture of
	// their own should wear the face of whoever played them rather than no face
	// at all. Folding them would have made that fall-back invisible to the client
	// and unable to say whose face it was showing.
	//
	// Empty on a book, where work_cast.actor_id is null by design (0056) — a
	// novel bills a character and nobody plays them.
	Actor      string `json:"actor,omitempty"`
	ActorImage string `json:"actor_image,omitempty"`
}

// loadQuoteSpeakers resolves cast ids to the chip's payload. Empty map rather
// than an error: see the type's header.
//
// `origin <> 'removed'` IS LOAD-BEARING AND EASY TO MISS. A tombstone is not a
// DELETE — 0048 keeps a removed provider row precisely so a refetch recognises
// and skips it — so the foreign key's ON DELETE SET NULL never fires and a quote
// written before the removal keeps a live-looking speaker_cast_id pointing at a
// row the reader has deleted. store.CharacterLines guards the same way for the
// same reason.
func (s *Server) loadQuoteSpeakers(uid int64, castIDs []int64) map[int64]quoteSpeakerCast {
	if len(castIDs) == 0 {
		return nil
	}
	seen := map[int64]bool{}
	in := make([]string, 0, len(castIDs))
	args := []any{uid}
	for _, id := range castIDs {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		in = append(in, "?")
		args = append(args, id)
	}
	if len(in) == 0 {
		return nil
	}
	// `wc.user_id = ?` is restated even though a cast id reaching here came off a
	// row already scoped to this reader. store/quote_cast.go makes the rule
	// explicit — per-user isolation is not something a helper gets to assume — and
	// the failure it prevents is silent: an unowned id yields no chip, which is
	// the 404-shaped answer this app promises, rather than somebody else's name.
	rows, err := s.Store.DB.Query(
		`SELECT wc.id, COALESCE(wc.character_id, 0), COALESCE(wc.character, ''),
		        COALESCE(c.name, ''),
		        CASE WHEN wc.character_image_path <> '' THEN wc.character_image_path
		             ELSE COALESCE(c.image_path, '') END,
		        COALESCE(wc.actor, ''), COALESCE(p.image_path, '')
		   FROM work_cast wc
		   LEFT JOIN characters c ON c.id = wc.character_id AND c.user_id = wc.user_id
		   LEFT JOIN people p ON p.id = wc.actor_id AND p.user_id = wc.user_id
		  WHERE wc.user_id = ? AND wc.origin <> 'removed'
		    AND wc.id IN (`+strings.Join(in, ",")+`)`, args...)
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] quote speakers for %d row(s): %v", len(in), err)
		return nil
	}
	defer rows.Close()
	out := map[int64]quoteSpeakerCast{}
	for rows.Next() {
		var sp quoteSpeakerCast
		var record string
		if err := rows.Scan(&sp.CastID, &sp.CharacterID, &sp.Name, &record, &sp.Image, &sp.Actor, &sp.ActorImage); err != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] quote speaker row scan failed: %v", err)
			continue
		}
		// A row billing nothing is not a speaker anybody can be shown.
		if strings.TrimSpace(sp.Name) == "" {
			continue
		}
		if record != "" && record != sp.Name {
			sp.RecordName = record
		}
		out[sp.CastID] = sp
	}
	return out
}

// speakerFor is the attach step, written once because both list handlers and both
// single-row fetches do exactly this. Returns nil for "no speaker", which is what
// omitempty needs to leave the field off the wire entirely.
func speakerFor(found map[int64]quoteSpeakerCast, castID int64) *quoteSpeakerCast {
	if castID == 0 || len(found) == 0 {
		return nil
	}
	sp, ok := found[castID]
	if !ok {
		return nil
	}
	return &sp
}
