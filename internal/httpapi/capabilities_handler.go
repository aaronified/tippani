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
//
//	409s carrying the existing row, and the shared quote shape (dialogues
//	gained colour, so both kinds serialise the same fields).
//
// 2 — the bin: every content delete answers with a `trash_id`, and /trash lists,
//
//	reads, restores and empties. Plus the fifth bulk endpoint (/quotes/bulk) and
//	colour on all three quote bulk bodies.
//
// 3 — what a selection can do. Quotes gained `sticker_id` and `review` on their
//
//	bulk bodies; works gained `review`, bulk delete (one bin entry for the whole
//	selection, quotes and all), bulk shelf state, and POST /metadata/fill, which
//	writes only the fields that were empty. Every list response carries
//	`review_excluded`.
//
// 4 — a book has three credits. `translator` and `editor` on the single-book
//
//	shape (create, read, update) and in the Markdown frontmatter, and both are
//	`people` kinds, so they take portraits, bios, links, renames and the orphan
//	sweep exactly as an author does. Absent from the LIST row on purpose: the
//	Library tile shows one credit and always has.
//
// 5 — a standalone quote knows what kind it is. `category` (proverb · speech ·
//
//	other), `language` and `translation` on the quote shape and on its LIST
//	row, `?category=` and `?language=` filters, and both carried through the
//	Markdown round trip. Present on the list row, unlike the book credits
//	above: the category IS the board, so a client cannot draw the board
//	without it. Plus `GET`/`POST /quotes/starters` — ten curated proverbs per
//	language, written only when asked, because a proverb is content and
//	seeding content nobody chose is the app writing in their collection.
//
// 6 — the review loop asks more than one kind of question. A card's `direction`
//
//	is drawn from a per-kind table rather than from a two-way toggle, and the
//	first new entry is `flip`: the quote on one side, its source on the other,
//	graded by the reader. A flip card carries NO options, which is how a client
//	recognises it without knowing the name — and is what lets a client that
//	has never heard of a later direction still render it as something a person
//	can answer instead of as an empty multiple choice.
//
//	This also fixes a deck that served nothing: a question that could not be
//	built used to drop its card while the badge went on counting it, so a
//	library with one work in it showed cards due and served none.
const apiRevision = 6

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
	// A review card can be a flip card: no options, reveal, self-grade. A client
	// that knows this string can render one; a client that does not will meet a
	// card with an empty `options` array, which is why "no options means flip" is
	// the rule rather than a direction allowlist.
	"review-directions", // `direction` drawn from a per-kind table; `flip` is the first addition
	// Stop the quiz asking about something without deleting it: `review` on all five
	// bulk bodies, and `review_excluded` on every list row.
	//
	// Since 1.14.2 a CHILD row also reports its parent work's flag as the shared
	// `work_review_excluded`, and all five search hit shapes carry
	// `review_excluded`. Additive, and no revision bump: a client
	// that does not know the names reads them as absent, which is false, which is
	// exactly the behaviour it had before. Named here rather than as a second
	// feature string because it is the same capability finally reported in full —
	// the deck has excluded a child of an excluded work since 0033, and the row
	// simply never said so.
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
	// A standalone quote's category, language and translation — and therefore the
	// three boards. One feature name for the three fields because they are one
	// idea and no client would support the category without the language: a
	// Proverbs board with no way to say which language is the board 0035 exists to
	// replace.
	"quote-categories", // category/language/translation + ?category=/?language=
	// Ten curated proverbs per language, written only when asked for. Named
	// separately from quote-categories because it is genuinely optional: a client
	// can show the three boards perfectly well and never offer to fill one.
	"proverb-starters", // GET/POST /quotes/starters
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
