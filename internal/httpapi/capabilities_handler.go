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
// 2 — the bin: every content delete answers with a `trash_id`, and /trash lists,
//     reads, restores and empties. Plus the fifth bulk endpoint (/quotes/bulk) and
//     colour on all three quote bulk bodies.
// 3 — what a selection can do. Quotes gained `sticker_id` and `review` on their
//     bulk bodies; works gained `review`, bulk delete (one bin entry for the whole
//     selection, quotes and all), bulk shelf state, and POST /metadata/fill, which
//     writes only the fields that were empty. Every list response carries
//     `review_excluded`.
// 4 — a book has three credits. `translator` and `editor` on the single-book
//     shape (create, read, update) and in the Markdown frontmatter, and both are
//     `people` kinds, so they take portraits, bios, links, renames and the orphan
//     sweep exactly as an author does. Absent from the LIST row on purpose: the
//     Library tile shows one credit and always has.
const apiRevision = 4

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
	// A client that knows this string can offer its own Undo: every content delete
	// answers with the bin entry it wrote, and POST /trash/{id}/restore puts it back.
	// Without it, a delete is final as far as that client knows.
	"trash-bin", // GET/DELETE /trash, POST /trash/{id}/restore, trash_id on deletes
	// Standalone quotes gained the bulk endpoint the other two kinds already had, and
	// all three accept `color`.
	"bulk-quotes", // POST /quotes/bulk
	"bulk-colour", // `color` on the annotation/dialogue/quote bulk bodies
	// What a selection of works can do. Named separately from the quote bulk
	// features because a client can perfectly well offer one board's selection and
	// not the other's — the Library and the Quotes screen are different screens.
	"bulk-works", // POST /books|movies/bulk/delete and /bulk/status
	// Stop the quiz asking about something without deleting it: `review` on all five
	// bulk bodies, and `review_excluded` on every list row.
	"review-exclusion",
	// Fetch only what is MISSING from a selection's metadata and touch nothing that
	// is already there — the unattended half of re-verify.
	"metadata-fill", // POST /metadata/fill
	// A selection can be sealed or unsealed at once. 0 clears.
	"bulk-sticker", // `sticker_id` on the three quote bulk bodies
	// The release history, served from the binary rather than from GitHub. A client
	// that knows this string can show what changed without a network.
	"changelog", // GET /changelog
	// The other two people a book is by. Named as one feature rather than two
	// because they arrived together and no client would sensibly support one:
	// `translator`/`editor` on the book shape, and both accepted wherever a person
	// kind is (people, portraits, rename, lookup).
	"book-credits",
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
