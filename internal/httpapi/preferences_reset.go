package httpapi

import (
	"encoding/json"
	"net/http"
)

// RESETTING A SECTION IS DELETING KEYS, NOT WRITING DEFAULTS.
//
// WHY THERE IS A SECOND ROUTE AT ALL. `PUT /auth/me/preferences` is a partial
// update whose whole convention is "a field I did not send, or sent empty, is a
// field I am not touching" — `if in.SRDaily != nil && *in.SRDaily != 0`, and the
// same guard on every string and number beside it. That convention is what lets
// one card PUT its own field without clobbering another's, and it is also what
// makes it structurally incapable of clearing anything: an empty value is the
// signal for "leave it alone". Settings' "Reset section" was built on that PUT,
// sending "" for every key in the section, and therefore did nothing at all —
// worse than nothing, because the four typed fields in a review reset (`srSeen`
// is a float, `srPracticeCounts`, `srLadder` and `srSubmit` are bools) could not
// even unmarshal from "", so the whole body was rejected and the other six were
// not written either. The reader saw every row return to its default, and the
// next load brought all of it back.
//
// AND DEFAULTS ARE NOT THE ANSWER EITHER. A body full of defaults would be a
// second copy of every default in the app, in a file that is not where any of
// them is written, and the day one moves the reset starts restoring a value
// nobody chose. The defaults already have one home: `loadPrefs` normalises on
// READ — `clampInt(p.SRDaily, 5, 20, reviewQuota)`, `srScopeValid`,
// `normalizeReviewTier` — so a key that is simply ABSENT from the stored blob
// reads back as its default, every time, from the one place that knows it.
//
// So this deletes. Preferences are a JSON object in `users.preferences`; the
// keys named here are removed from it and the rest is left exactly as it was.
// That needs no table of fields and no table of defaults, which is why it is
// eleven lines of work rather than a parallel copy of the update handler.
func (s *Server) handleResetPreferences(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var in struct {
		Keys []string `json:"keys"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request")
		return
	}
	// A CAP, BECAUSE THE LIST IS A CLIENT'S. The largest section this app has is
	// well under this; a body asking to delete thousands of keys is not a Settings
	// screen and there is no reason to spend the parse on it.
	if len(in.Keys) == 0 || len(in.Keys) > 100 {
		writeErr(w, http.StatusBadRequest, "keys must name between 1 and 100 preferences")
		return
	}
	var raw string
	if err := s.Store.DB.QueryRow(
		`SELECT preferences FROM users WHERE id = ?`, userID(r)).Scan(&raw); err != nil {
		internalError(w, r, "load prefs", err)
		return
	}
	// THE RAW OBJECT, NOT THE TYPED STRUCT. Round-tripping through `prefs` would
	// write back every zero value as an explicit field, which is the opposite of
	// deleting: the key would still be there, holding a zero, and `loadPrefs` would
	// go on clamping a stored 0 rather than an absent one. Both read the same today
	// and they are not the same thing, and the difference is what a restore of this
	// blob into a later version would turn on.
	obj := map[string]json.RawMessage{}
	if raw != "" {
		// Bad stored JSON is not this route's to repair — the same position
		// `loadPrefs` takes, where an unparseable blob reads as all defaults. There
		// is nothing to delete out of it, and a reset is already what the reader
		// asked for.
		_ = json.Unmarshal([]byte(raw), &obj)
	}
	for _, k := range in.Keys {
		delete(obj, k)
	}
	next, err := json.Marshal(obj)
	if err != nil {
		internalError(w, r, "marshal prefs", err)
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE users SET preferences = ? WHERE id = ?`, string(next), userID(r)); err != nil {
		internalError(w, r, "save prefs", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
