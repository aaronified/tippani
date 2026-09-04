package httpapi

import (
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// The character pictures a page of quotes needs, resolved once for the whole
// page.
//
// WHY THE SERVER DOES THIS AND NOT THE CLIENT. A quote names its character as
// TEXT — `dialogues.character`, `annotations.character` — and the picture lives on
// a `work_cast` row found by the FOLDED name (0048's `character_key`). Two things
// make that a server job:
//
//   THE FOLD CANNOT BE DONE IN SQL. store.CastKey folds typographic punctuation,
//   collapses whitespace and drops case, and SQLite's lower() has no Unicode
//   tables — it lowercases ASCII and leaves every other codepoint alone. 0048
//   says so in capitals, which is why a LEFT JOIN on the key is not an option and
//   the match is made in Go.
//
//   THE CLIENT CANNOT DO IT EITHER, for the pages that matter. A film page has
//   one work's cast in hand, but Search and Home show lines from many works at
//   once; asking the browser for a cast per work would be a request per work on
//   a page of twenty results, and it would still need CastKey in JavaScript —
//   a second implementation of a fold that must agree exactly with the Go one.
//
// So a row arrives with its pictures attached and the client renders them. ONE
// QUERY FOR THE WHOLE PAGE, in the shape the tag lists beside it already use.
//
// A LINE CAN NAME MORE THAN ONE CHARACTER, entered like tags and split on the
// reader's own separators, so this is a LIST per row and not one path. The server
// splits, because the split and the fold have to agree and both live here.

// characterImage is one character on a quote and the picture stored for them.
// `Name` is the character as the reader typed them on the line, not as the cast
// row spells them: the line is what they are looking at.
// AN ALIAS RATHER THAN A TWIN. store.QuoteLine carries the same list for the
// identity panels' lines, and the fold that builds it lives here — so one type
// serves both and there is no pair of identical structs to keep in step.
type characterImage = store.LineFace

// castFace is what the fold FINDS for one name on a line: the picture to draw,
// and the two ids the chip needs to open something.
//
// THE IDS ARE THE WHOLE REASON THIS IS A STRUCT. A chip is a door — the owner's
// ruling, "all chips will be buttons, that's their function" — and it opens the
// work-level character popup, which is keyed on the CAST ROW rather than the
// record: a work can bill one character twice (the young Vito and the old one),
// so the record id alone does not name a screen. Both ride along because the
// query that finds the picture already has them.
type castFace struct {
	Path        string
	CastID      int64
	CharacterID int64
}

// characterImageRef is one row's claim on the lookup: which work, and the raw
// character text off the line.
type characterImageRef struct {
	WorkID    int64
	Character string
}

// loadCharacterImages returns, per (work, folded character), the stored picture
// for it — empty map when there is nothing to find, never an error the caller has
// to care about. A missing picture is the normal case, so this is best-effort:
// the chip falls back to the actor and the page renders either way.
func (s *Server) loadCharacterImages(uid int64, kind string, refs []characterImageRef) map[string]castFace {
	if len(refs) == 0 {
		return nil
	}
	ids := map[int64]bool{}
	for _, r := range refs {
		ids[r.WorkID] = true
	}
	in := make([]string, 0, len(ids))
	args := []any{uid, kind}
	for id := range ids {
		in = append(in, "?")
		args = append(args, id)
	}
	out := map[string]castFace{}
	// THE RECORD'S OWN PICTURE IS THE FALLBACK, and leaving it out was a bug you
	// could only find by merging: set a character's picture on the book you are
	// reading, merge that record with the same character in another book, and the
	// second book's quotes drew no face at all. The merge joins the RECORDS — it
	// does not, and must not, copy a per-work picture onto every appearance, since
	// "what this character looks like in THIS work" is the finer grain the column
	// exists for.
	//
	// So the per-work picture wins where there is one and the record's default
	// stands in where there is not, which is what "default" has meant on the
	// record since it gained the field.
	//
	// AND EVERY CAST ROW COMES BACK NOW, not only the ones with a picture. That
	// filter was right while this fed a row of faces — a face with no picture is
	// nothing to draw — and wrong the moment the chip became a door: a character
	// the reader has in the cast but has never found a portrait for is exactly as
	// openable as one they have, and dropping the row here left the chip with a
	// name, no face and nowhere to go. The empty path still says "no picture".
	rows, err := s.Store.DB.Query(
		`SELECT wc.work_id, wc.character_key,
		        CASE WHEN wc.character_image_path <> '' THEN wc.character_image_path
		             ELSE COALESCE(c.image_path, '') END,
		        wc.id, COALESCE(wc.character_id, 0)
		   FROM work_cast wc
		   LEFT JOIN characters c ON c.id = wc.character_id AND c.user_id = wc.user_id
		  WHERE wc.user_id = ? AND wc.kind = ? AND wc.origin <> 'removed'
		    AND wc.work_id IN (`+strings.Join(in, ",")+`)`, args...)
	if err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] character images for %d %s work(s): %v", len(ids), kind, err)
		return nil
	}
	defer rows.Close()
	for rows.Next() {
		var workID int64
		var key string
		var f castFace
		if err := rows.Scan(&workID, &key, &f.Path, &f.CastID, &f.CharacterID); err != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] character image row scan failed: %v", err)
			continue
		}
		out[characterImageKey(workID, key)] = f
	}
	return out
}

// characterImageKey pairs a work with an ALREADY-FOLDED character key. The
// separator is the unit separator, as store.ProviderKey uses, because it cannot
// occur in a name.
func characterImageKey(workID int64, foldedName string) string {
	return strconv.FormatInt(workID, 10) + "\x1f" + foldedName
}

// characterImagesFor turns one row's raw character text into the list its chips
// draw: ONE ENTRY PER CHARACTER NAMED ON THE LINE, in the order the reader typed
// them, each carrying that character's picture or an empty path when there is
// none.
//
// IT USED TO EMIT ONLY THE ONES WITH A PICTURE, and that was right while the
// client drew a row of face discs: a disc with no picture is a picture of
// nobody. The client now draws a CHIP per entry — a face and a NAME — and a chip
// reads without a picture, so a name dropped here is a name the card cannot
// show. Worse, the card stops printing its own character text once any chip
// draws, so "Rick, Ilsa, Sam" with one stored portrait showed one chip and lost
// two names outright.
//
// "no picture" is still distinguishable from "no character", which is what the
// old shape was protecting: an entry that exists with an empty path is a
// character nobody has a picture of, and no entry at all is a name the line does
// not carry. The client's ladder (this picture → the performer's → a hashed
// silhouette) needs exactly that.
func characterImagesFor(found map[string]castFace, seps metadata.CreditSeps, workID int64, character string) []characterImage {
	if strings.TrimSpace(character) == "" {
		return nil
	}
	var out []characterImage
	for _, name := range metadata.SplitCredits(character, seps) {
		// Absent from `found` is the ordinary case, not a failure: a reader can
		// type any name on a line, and only the ones the work's cast knows have a
		// row behind them. Those get a door; the rest are a name and a face.
		f := found[characterImageKey(workID, store.CastKey(name))]
		out = append(out, characterImage{
			Name:        name,
			Path:        f.Path,
			CastID:      f.CastID,
			CharacterID: f.CharacterID,
		})
	}
	return out
}
