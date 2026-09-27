package httpapi

import (
	"context"
	"strings"

	"tippani/internal/jobs"
)

// WHAT KIND OF JOB A REQUEST IS, WHEN IT BECOMES ONE.
//
// A request becomes an in-request job when it looks outward (the outbound hook
// logs a line into its *jobs.Lazy) or when its handler names it with jobs.Begin.
// The first way needs no handler to say anything, so the kind comes from the
// route the request matched: this table, keyed by the mux pattern exactly as it
// is registered in Handler (without the /api prefix, which the outer mux strips).
//
// THE KIND IS DATA, NOT PROSE. The Jobs tab composes a job's title from its kind
// and subject in the reader's language (settings.jobs.kind.<kind>), so a kind is
// a key and never a sentence, and it keeps the shape jobs.kindShape allows. Two
// routes that do the same thing share one: creating a book and saving an edit to
// one both fetch a cover, and both read as "saved a work" in the list.
//
// A route this table does not know is still kept, as kind "request" with its
// pattern for a subject: an outward call nobody expected is exactly the one worth
// seeing, and it should not wait for somebody to add a row here.
var jobKinds = map[string]string{
	// The lookups a reader types into — as fast as ever, never queued, each one
	// kept (the owner's: "single manual lookups … run in their request").
	"POST /books/lookup":    "lookup.book",
	"POST /movies/lookup":   "lookup.movie",
	"POST /images/search":   "lookup.images",
	"POST /people/portrait": "lookup.portrait",
	"POST /people/lookup":   "lookup.links",
	// One person's portrait and links together, the People row's Fetch.
	"POST /people/id/{id}/fetch":  "lookup.person",
	"POST /metadata/reverify":     "lookup.reverify",
	"POST /cast/{id}/image":       "lookup.cast-image",
	"POST /movies/{id}/cast/imdb": "lookup.cast-imdb",
	"POST /movies/{id}/cast/tvdb": "lookup.cast-tvdb",
	// A work page's pictures, its pending role pictures and headshots in one
	// request (cast_art_handlers.go).
	"POST /books/{id}/cast/art":  "lookup.cast-art",
	"POST /movies/{id}/cast/art": "lookup.cast-art",

	// Saving something whose picture is fetched from an address, on save.
	"POST /books":                "work.save",
	"PUT /books/{id}":            "work.save",
	"POST /movies":               "work.save",
	"PUT /movies/{id}":           "work.save",
	"PUT /people":                "person.save",
	"PUT /people/id/{id}":        "person.save",
	"PUT /characters/{id}/image": "character.save",

	// The chunked routes an API caller loops, which the app's own Fill gaps and
	// Fetch covers stopped looping in 3.1.0, and the single apply the field-offers
	// panel sends when a reader takes a supplier's value for one work. Named as
	// the queued kinds that replaced the screens' loops are, so the two read alike
	// in Past jobs.
	"POST /metadata/fill":           "fill",
	"POST /covers/refetch":          "covers",
	"POST /metadata/reverify/apply": "reverify-apply",

	// The imports (every route stages; a handler that calls jobs.Begin names the
	// kind itself) and the API's synchronous backup.
	"POST /import/auto":             "import",
	"POST /import/markdown":         "import",
	"POST /import/readest-json":     "import",
	"POST /import/bookcision":       "import",
	"POST /import/hardcover-html":   "import",
	"POST /import/goodreads-html":   "import",
	"POST /import/kindle-notebook":  "import",
	"POST /import/imdb-quotes":      "import",
	"POST /import/kindle-clippings": "import",
	"POST /admin/backup":            "backup",

	// The admin's questions to somebody else's server.
	"GET /admin/update/check":       "update.check",
	"POST /admin/update/apply":      "update.apply",
	"POST /admin/metadata/test":     "metadata.test",
	"POST /auth/notifications/test": "notify.test",

	// Single sign-on, which looks outward to the operator's own provider before
	// anybody is signed in (these two routes note their pattern themselves:
	// routed, in server.go).
	"GET /auth/oidc/login":    "signin.oidc",
	"GET /auth/oidc/callback": "signin.oidc",
}

// jobKind is the kind for a route pattern, or "" for one the table does not know
// (jobs.Lazy then keeps it as "request").
func jobKind(pattern string) string { return jobKinds[pattern] }

// jobSubject names what the request's job is about — the title, the ISBN, the
// name the reader typed — when the request is part of one, and does nothing
// otherwise. Data, not prose: the Jobs tab composes the title around it in the
// reader's language, and an empty subject leaves whatever was named before.
//
// ONLY A HANDLER CALLS IT, at its entry point. The functions a handler shares
// with a queued job (fetchPerson, reverifyBook, …) never name a subject: in a
// job, the recorder in the context is the job itself, and naming it after each
// item would rename a job of five hundred items five hundred times.
func jobSubject(ctx context.Context, subject string) {
	if subject = strings.TrimSpace(subject); subject == "" {
		return
	}
	if rec := jobs.From(ctx); rec != nil {
		rec.Subject(subject)
	}
}
