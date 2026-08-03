package httpapi

import (
	"net/http"

	"tippani/internal/buildinfo"
)

// A version handshake for independently-updated clients.
//
// The SPA ships inside the binary, so it is always exactly as new as the server
// and never needed one. An installed Android APK does not: it and the server on
// a NAS update on entirely separate schedules, so sooner or later one is older
// than the other. Without somewhere to ask, the app discovers that as an
// unexplained 404 halfway through saving a capture.
//
// Unauthenticated and cheap, because the app needs it before it holds a token
// — during pairing, and on resume to decide whether to prompt for an update.

// apiRevision increments whenever the API gains something a client can depend
// on, or changes in a way an older client would notice. It is deliberately a
// single integer rather than a version of each route: a client only ever needs
// "is this server new enough for me".
//
// 1 — device tokens, pairing, list paging, capture noted_at/source, duplicate
//     409s carrying the existing row, and the shared quote shape (dialogues
//     gained colour, so both kinds serialise the same fields).
const apiRevision = 1

// apiFeatures names what this server can do, so a client can light up or hide a
// screen instead of probing for a 404. Names are stable once published: an old
// app will keep looking for the string it was built against.
var apiFeatures = []string{
	"device-tokens",     // Authorization: Bearer <device token>
	"device-pairing",    // POST /auth/devices/pair + /claim
	"list-paging",       // limit/offset on books, movies, annotations, dialogues
	"capture-noted-at",  // noted_at and source accepted on create
	"conflict-existing", // duplicate-create 409s carry the existing row
	"quote-parity",      // annotations and dialogues share one shape; dialogues have colour
}

// minClientRevision is the oldest client API revision this server still serves
// correctly. Nothing has been removed yet, so every client is welcome; when a
// breaking change does land, this rises and the app can say so plainly instead
// of failing mid-save.
const minClientRevision = 1

func (s *Server) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"version":             buildinfo.Version,
		"api_revision":        apiRevision,
		"min_client_revision": minClientRevision,
		"features":            apiFeatures,
	})
}
