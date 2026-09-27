package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"reflect"
	"strings"

	"tippani/internal/metadata"
)

// A RE-VERIFY'S REVIEW, OPENED FROM A CHECK THAT FINISHED A WHILE AGO.
//
// The check (the reverify job) stored the preview's items: per field, what was
// stored then and what each supplier says. The reader may open Review minutes or
// days later, from Past jobs, and in between the library can have moved: the
// reader typed a description, a fill filled a year, somebody fetched a cover. A
// review that showed the check's "stored" would offer to fill a field that is no
// longer empty, and the screen ticks an empty field for the reader.
//
// So GET /jobs/{id}/result reads every diff's field again, NOW, puts that value in
// stored, and marks the diff changed when it is not what the check saw. The
// screen never ticks a changed diff, and says why. The apply that follows carries
// what the reader was shown as its expect, and skips a field that moves again
// before the press.
//
// A field the review cannot read now — a row since deleted, a field it does not
// know, a cast whose read failed — is marked changed and keeps the check's value:
// the safe mistake is a box the reader has to tick themselves, never one ticked
// over a value nobody reviewed.
//
// The check keeps a diff without its fresh value when that is the first
// supplier's value in alts (keptDiff), and the review puts it back, so the
// screen reads each diff as the preview always answered it.

// reviewReverify is the reverify kind's review (queuedKind.review).
func reviewReverify(s *Server, uid int64, result json.RawMessage) (any, error) {
	// Each item twice: whole, so every member the check stored goes back as it
	// was (sources, alts, the title), and as the four members that say which row
	// it is.
	var items []map[string]json.RawMessage
	var heads []reverifyHead
	if json.Unmarshal(result, &items) != nil || json.Unmarshal(result, &heads) != nil {
		// Not the preview's shape: nothing to re-read, and handed back as stored.
		return result, nil
	}
	for i, it := range items {
		var diffs []map[string]json.RawMessage
		if json.Unmarshal(it["diffs"], &diffs) != nil || len(diffs) == 0 {
			continue
		}
		now, err := s.reverifyStoredNow(uid, heads[i])
		if err != nil {
			return nil, err
		}
		for _, d := range diffs {
			if _, kept := d["fresh"]; !kept {
				var alts []struct {
					Value json.RawMessage `json:"value"`
				}
				if json.Unmarshal(d["alts"], &alts) == nil && len(alts) > 0 {
					d["fresh"] = alts[0].Value
				}
			}
			var field string
			_ = json.Unmarshal(d["field"], &field)
			cur, known := now[field]
			changed := !known || !sameStored(field, d["stored"], cur)
			if known {
				b, err := json.Marshal(cur)
				if err != nil {
					return nil, err
				}
				d["stored"] = b
			}
			d["changed"] = json.RawMessage(`false`)
			if changed {
				d["changed"] = json.RawMessage(`true`)
			}
		}
		b, err := json.Marshal(diffs)
		if err != nil {
			return nil, err
		}
		it["diffs"] = b
	}
	return items, nil
}

// reverifyHead is which row a preview item is about.
type reverifyHead struct {
	Type string `json:"type"`
	ID   int64  `json:"id"`
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// reverifyStoredNow is what head's row holds now, per diff field, in the shape
// the check's diffs carry it: through the readers the check takes each diff's
// stored side from (storedBookFields, storedMovieFields, storedPersonFields).
// nil when the row is gone. A field it cannot read is left out, and the review
// marks its diff changed.
func (s *Server) reverifyStoredNow(uid int64, head reverifyHead) (map[string]any, error) {
	switch head.Type {
	case "book":
		b, err := s.readStoredBook(uid, head.ID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return storedBookFields(b), nil
	case "movie":
		m, err := s.readStoredMovie(uid, head.ID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		now := storedMovieFields(m)
		if cast, err := loadCastMembers(s.Store.DB, "movie", head.ID); err == nil {
			now["cast"] = cast
		}
		return now, nil
	case "person":
		p, ok := s.getPersonFold(uid, strings.TrimSpace(head.Kind), strings.TrimSpace(head.Name))
		if !ok {
			return nil, nil
		}
		return storedPersonFields(p), nil
	}
	return nil, nil
}

// sameStored reports whether a diff's field holds what the check saw (then, as
// the check stored it) now, compared the way the check compared it: genres as a
// set, a cast by its visible pairs, text without its surrounding space, and every
// kind of empty alike.
func sameStored(field string, then json.RawMessage, now any) bool {
	nowJSON, err := json.Marshal(now)
	if err != nil {
		return false
	}
	switch field {
	case "genres":
		var a, b []string
		if json.Unmarshal(then, &a) != nil || json.Unmarshal(nowJSON, &b) != nil {
			return false
		}
		return sameGenreSet(a, b)
	case "cast":
		var a, b []metadata.CastMember
		if json.Unmarshal(then, &a) != nil || json.Unmarshal(nowJSON, &b) != nil {
			return false
		}
		return sameCast(a, b)
	}
	var a, b any
	if len(then) == 0 || json.Unmarshal(then, &a) != nil || json.Unmarshal(nowJSON, &b) != nil {
		return false
	}
	if emptyJSON(a) && emptyJSON(b) {
		return true
	}
	if as, ok := a.(string); ok {
		bs, ok := b.(string)
		return ok && strings.TrimSpace(as) == strings.TrimSpace(bs)
	}
	return reflect.DeepEqual(a, b)
}

// emptyJSON is whether a decoded JSON value is one of the empties the review
// treats as one: null, "", 0 and [].
func emptyJSON(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(x) == ""
	case float64:
		return x == 0
	case []any:
		return len(x) == 0
	}
	return false
}
