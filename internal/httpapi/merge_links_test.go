package httpapi

import "testing"

// A FETCH THAT FOLDS LINKS INTO A RECORD KEEPS THE NAMES A READER GAVE THEM.
//
// A record's links are one free-text field, and a fetch rewrites the whole of it
// to fold in what it found — which is where a name the reader typed beside a link
// (`https://… | Their essays`) would be lost, silently and for good.
//
// WHAT IT KNOWS, declared, because a test here may not know the code: the fold by
// its name, mergeLinks, and that it takes the stored field and the fetched links
// by provider. This is the pure tier's test moved across the boundary. Until
// 3.1.0 the fold was people.jsx's mergeLinks, where the function IS the observable
// unit, and its first two cases below were the two in
// web/frontend/test/pure/link-names.test.js ("a fetch that rewrites the whole
// field"); the fold moved to the server with the People row's Fetch, and the cases
// came with it, verbatim. The SPA's rule link-fold-keeps-names.test.js holds this
// file to them by name, so the file, the test's name and both cases' strings stay.
// The same fold through the routes a reader presses — a person's Fetch and a
// person's re-verify — is driven in person_fetch_test.go and reverify_test.go.
//
// What each case guards, in a sentence a person would say: a fetch leaves the
// names on my links alone and adds the link it found; a link I never named stays
// exactly as I typed it; two links on one line with a name after them are still
// two links, and the name stays on the one it was written against; an address
// the browser takes with a bare % in it is an address here too, and keeps its
// name.
func TestMergeLinksKeepsTheReadersNames(t *testing.T) {
	const (
		imdb  = "https://www.imdb.com/name/nm0000123/"
		mine  = "https://example.org/essays"
		other = "https://example.net/talks"
		tmdb  = "https://www.themoviedb.org/person/1"
	)

	t.Run("a fetch leaves the names the reader gave alone", func(t *testing.T) {
		stored := "https://www.imdb.com/name/nm0000123/ | The other one\nhttps://example.org/essays | Their essays"
		got := mergeLinks(stored, map[string]string{"tmdb": tmdb})
		after := parseLinks(got)
		if after.labels[imdb] != "The other one" || after.labels[mine] != "Their essays" {
			t.Fatalf("the names after the fold: %q, from\n%s", after.labels, got)
		}
		if after.known["tmdb"] == "" {
			t.Fatalf("the fetched link did not land:\n%s", got)
		}
		// And where each line goes: the providers in their order, then the rest.
		want := imdb + " | The other one\n" + tmdb + "\n" + mine + " | Their essays"
		if got != want {
			t.Fatalf("the folded field:\n%s\nwant\n%s", got, want)
		}
	})

	t.Run("a link nobody has named stays unnamed rather than gaining an empty one", func(t *testing.T) {
		if got := mergeLinks("https://example.org/essays", map[string]string{}); got != mine {
			t.Fatalf("the folded field: %q, want %q", got, mine)
		}
	})

	t.Run("two addresses on one line stay two, and the name stays on the last", func(t *testing.T) {
		// The field has always split on whitespace, which is why the separator is a
		// pipe: naming something on a line of two links may not make them one.
		got := mergeLinks(mine+" "+other+" | Their talks", nil)
		if want := mine + "\n" + other + " | Their talks"; got != want {
			t.Fatalf("the folded field:\n%s\nwant\n%s", got, want)
		}
	})

	t.Run("an address with a bare % in it is still an address, and keeps its name", func(t *testing.T) {
		// A browser takes a % that begins no escape as it is; Go's own parser
		// does not, and the name on the link went with it.
		const sale = "https://example.org/sale-50%-off"
		if got, want := mergeLinks(sale+" | The sale", nil), sale+" | The sale"; got != want {
			t.Fatalf("the folded field: %q, want %q", got, want)
		}
		// And a provider's page with one is still that provider's, and wins over
		// the one fetched.
		const search = "https://www.imdb.com/find?q=100%"
		after := parseLinks(mergeLinks(search+" | My search", map[string]string{"imdb": imdb}))
		if after.known["imdb"] != search || after.labels[search] != "My search" {
			t.Fatalf("a stored IMDb page with a bare %%: known %q, names %q", after.known, after.labels)
		}
		// Something with no scheme is no address, % or not, and takes no name.
		if got := mergeLinks("50%-off | A name", nil); got != "50%-off" {
			t.Fatalf("the folded field: %q, want the token without a name", got)
		}
	})
}
