package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The three fields both suppliers were already sending — 0061.
//
// Nothing new is fetched to fill them: Google's volumeInfo has carried
// `subtitle`, `publisher` and `pageCount` since the API existed, and Open
// Library's search doc has carried `subtitle`, `publisher` and
// `number_of_pages_median` for as long as the app has queried it. They were
// parsed by nobody, so the Details form could not offer a row it had no value
// for.

const googleEditionJSON = `{"items":[{"id":"vol1","volumeInfo":{
  "title":"The Master and Margarita",
  "subtitle":"A Novel",
  "authors":["Mikhail Bulgakov"],
  "publisher":"Penguin Classics",
  "pageCount":503,
  "publishedDate":"2016",
  "industryIdentifiers":[{"type":"ISBN_13","identifier":"9780143108276"}]}}]}`

const olEditionJSON = `{"docs":[{
  "key":"/works/OL1W",
  "title":"The Master and Margarita",
  "subtitle":"a novel of Moscow",
  "author_name":["Mikhail Bulgakov"],
  "first_publish_year":1967,
  "publisher":["Grove Press","Harper & Row","Penguin"],
  "number_of_pages_median":384}]}`

func editionServers(t *testing.T, google, ol string) {
	t.Helper()
	g := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(google))
	}))
	o := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The fields list is what decides whether OL answers with these at all —
		// a doc field not asked for is absent, silently, and the parse below
		// would then be reading nothing forever.
		for _, want := range []string{"subtitle", "publisher", "number_of_pages_median"} {
			if !strings.Contains(r.URL.Query().Get("fields"), want) {
				t.Errorf("open library was not asked for %q: %q", want, r.URL.Query().Get("fields"))
			}
		}
		_, _ = w.Write([]byte(ol))
	}))
	t.Cleanup(func() { g.Close(); o.Close() })
	setBases(t, g.URL, o.URL)
}

func TestTheMergeTakesGooglesEditionFactsAndOpenLibrarysWorkFacts(t *testing.T) {
	editionServers(t, googleEditionJSON, olEditionJSON)
	got, err := SearchBooks(context.Background(), "9780143108276", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d candidates, want one merged record", len(got))
	}
	m := got[0]
	// GOOGLE WINS ALL THREE, and this is the mirror image of the title rule
	// rather than a contradiction of it: Open Library describes the WORK — every
	// publisher that has ever printed it, the median extent across all of them —
	// and a publisher and a page count are questions about the copy in your hand.
	if m.Publisher != "Penguin Classics" {
		t.Errorf("publisher = %q, want Google's edition-level answer", m.Publisher)
	}
	if m.Pages != 503 {
		t.Errorf("pages = %d, want Google's 503 rather than the median 384", m.Pages)
	}
	if m.Subtitle != "A Novel" {
		t.Errorf("subtitle = %q", m.Subtitle)
	}
	// And the work-level facts still come from Open Library, unchanged.
	if m.PublishedYear != 1967 {
		t.Errorf("year = %d, want the first publication", m.PublishedYear)
	}
}

func TestOpenLibraryAnswersWhereGoogleIsSilent(t *testing.T) {
	// A Google record with none of the three, which is ordinary — the API omits
	// `publisher` and `pageCount` on plenty of volumes.
	bare := `{"items":[{"id":"vol1","volumeInfo":{"title":"The Master and Margarita",
	  "industryIdentifiers":[{"type":"ISBN_13","identifier":"9780143108276"}]}}]}`
	editionServers(t, bare, olEditionJSON)
	got, err := SearchBooks(context.Background(), "9780143108276", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	m := got[0]
	// THE FIRST OF THE LIST, not a join of it: OL's `publisher` is every house
	// that has ever printed the work, and "Grove Press, Harper & Row, Penguin" is
	// not the name of a publisher.
	if m.Publisher != "Grove Press" {
		t.Errorf("publisher = %q, want the first of Open Library's list", m.Publisher)
	}
	if m.Pages != 384 {
		t.Errorf("pages = %d, want the median where Google said nothing", m.Pages)
	}
	if m.Subtitle != "a novel of Moscow" {
		t.Errorf("subtitle = %q", m.Subtitle)
	}
}

// THE RULE, NOT THE ORDER. The merge starts from the first candidate, so a
// "Google wins" assertion made through SearchBooks passes whenever Google
// happens to be ranked first — which it usually is, and which is not the rule.
// This calls the merge with Open Library's record FIRST, where only the rule
// itself can produce the right answer.
func TestGoogleWinsTheEditionFactsWhicheverOrderTheyArriveIn(t *testing.T) {
	ol := BookCandidate{
		Source: "openlibrary", OpenLibraryID: "/works/OL1W",
		Title: "The Master and Margarita", Subtitle: "a novel of Moscow",
		Publisher: "Grove Press", Pages: 384, PublishedYear: 1967,
	}
	google := BookCandidate{
		Source: "google", GoogleID: "vol1",
		Title: "The Master and Margarita (Penguin Classics)", Subtitle: "A Novel",
		Publisher: "Penguin Classics", Pages: 503, PublishedYear: 2016,
	}
	got := mergeSameBook([]BookCandidate{ol, google})
	if len(got) != 1 {
		t.Fatalf("merge produced %d records", len(got))
	}
	m := got[0]
	if m.Publisher != "Penguin Classics" || m.Pages != 503 || m.Subtitle != "A Novel" {
		t.Fatalf("open library first still has to lose the edition facts: %+v", m)
	}
	// And the work facts still go the other way in the same call, which is what
	// makes the two rules one rule rather than two preferences.
	if m.PublishedYear != 1967 || m.Title != "The Master and Margarita" {
		t.Fatalf("the work facts moved: %q %d", m.Title, m.PublishedYear)
	}
}
