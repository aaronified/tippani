// WHAT THE METADATA CARD IS ALLOWED TO CALL BROKEN.
//
// The owner's report is the whole of why this file exists: "those two cannot be the
// only metadata faults. add all kinds of faults there. like now i can see that
// google photo search is yielding zero results, zilch."
//
// THE HARD PART IS NOT COLLECTING THE ANSWERS, IT IS DECIDING WHICH ARE FAULTS. A
// search that finds nothing is usually a search that found nothing, and a card that
// said so would be a card nobody reads by the second week. What makes the owner's
// case a fault is not the zero — it is that the zero keeps happening. So every case
// below is about the fold: when a run starts, when it resets, and what a failure in
// the middle of one does to it.

package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// A RUN IS. Three different subjects in a row finding nothing is no longer about
// the subjects — it is the source, which is exactly what the owner was looking at.
func TestARunOfEmptyAnswersIsAFault(t *testing.T) {
	var r lookupRegistry
	for i := 0; i < emptyRunFault; i++ {
		r.record(faultAreaPictures, "google-scrape", 0, "google is showing a consent page instead of results", nil)
	}
	got := r.faults()
	if len(got) != 1 {
		t.Fatalf("want one fault after %d empty answers, got %+v", emptyRunFault, got)
	}
	if got[0].Kind != "empty" {
		t.Errorf("an empty run was reported as %q, which is a different thing to do about it", got[0].Kind)
	}
	if got[0].Run != emptyRunFault {
		t.Errorf("the run is %d, so the reader is told the wrong number of misses", got[0].Run)
	}
	// THE NOTE IS THE ACTIONABLE HALF. "Nothing found seven times" says something is
	// wrong; "google is showing a consent page" says what to do about it, and the
	// rung already knew.
	if got[0].Note == "" {
		t.Error("the rung's own account of the miss was dropped, so the row says a number and nothing else")
	}
	// AND NOT AN ERROR, because nothing errored: a card that said the lookup failed
	// would send the reader to check a key that is working.
	if got[0].Error != "" {
		t.Errorf("an empty run carries an error string: %q", got[0].Error)
	}
}

// FINDING ONE THING ENDS THE RUN, and it has to end it rather than decrement it:
// the question is "has this stopped working", and one answer proves it has not.
func TestFindingSomethingClearsTheRun(t *testing.T) {
	var r lookupRegistry
	for i := 0; i < emptyRunFault+4; i++ {
		r.record(faultAreaPictures, "wikimedia", 0, "", nil)
	}
	if len(r.faults()) != 1 {
		t.Fatal("the run did not become a fault, so this case is not testing what it says")
	}
	r.record(faultAreaPictures, "wikimedia", 1, "", nil)
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("a source that answered is still reported broken: %+v", got)
	}
	// AND THE NEXT MISS STARTS FROM ONE rather than from where the old run left
	// off — otherwise a source that works intermittently accumulates a fault it
	// never earns.
	r.record(faultAreaPictures, "wikimedia", 0, "", nil)
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("one miss after a success was reported as the old run continuing: %+v", got)
	}
}

// A CALL THAT FAILED IS A FAULT ON ITS OWN, with no run to accumulate: a timeout or
// a 500 is not ambiguous the way a zero is, so there is nothing to wait for.
func TestAFailedCallIsAFaultImmediately(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaFilms, "tvdb", 0, "", errors.New("dial tcp: i/o timeout"))
	got := r.faults()
	if len(got) != 1 {
		t.Fatalf("want one fault from one failure, got %+v", got)
	}
	if got[0].Kind != "error" || got[0].Error == "" {
		t.Errorf("a failure was not reported as one: %+v", got[0])
	}
}

// THE SAME SUPPLIER IN TWO AREAS IS TWO SOURCES, and this is not bookkeeping: a
// TheTVDB that answers film lookups fine and has stopped returning character art is
// one real thing this app does, and a registry keyed on the name alone would have
// the picture miss cancel the lookup's success.
func TestASupplierIsTrackedPerAreaRatherThanByName(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaFilms, "tvdb", 6, "", nil)
	for i := 0; i < emptyRunFault; i++ {
		r.record(faultAreaPictures, "tvdb", 0, "", nil)
	}
	got := r.faults()
	if len(got) != 1 {
		t.Fatalf("want the picture rung alone, got %+v", got)
	}
	if got[0].Area != faultAreaPictures {
		t.Errorf("the working film lookup was reported instead: %+v", got[0])
	}
}

// A SOURCE THAT HAS WORKED HERE GETS A LONGER ROPE, and this is the case that keeps
// the feature usable rather than merely correct. Wikimedia and Fandom miss often and
// correctly — plenty of characters have no article — so a single threshold would sit
// a working Fandom permanently on the fault list, three obscure characters being all
// it takes. "Has produced a picture in this process" and "never has" are different
// claims and the card should not make them with the same confidence.
func TestASourceThatHasAnsweredBeforeIsGivenLonger(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "fandom", 3, "", nil) // it works here
	for i := 0; i < emptyRunFault; i++ {
		r.record(faultAreaPictures, "fandom", 0, "", nil)
	}
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("a source that works here was accused after %d misses: %+v", emptyRunFault, got)
	}
	for i := emptyRunFault; i < emptyRunFaultAfterHit; i++ {
		r.record(faultAreaPictures, "fandom", 0, "", nil)
	}
	got := r.faults()
	if len(got) != 1 {
		t.Fatalf("want a fault at %d misses, got %+v", emptyRunFaultAfterHit, got)
	}
	if got[0].Run != emptyRunFaultAfterHit {
		t.Errorf("the run is %d, want %d", got[0].Run, emptyRunFaultAfterHit)
	}
}

// AND ONE GOOD ANSWER IS ENOUGH TO EARN IT, permanently within this process. The
// claim "this thing works here" is not undone by a dry spell — that is what the dry
// spell is being measured against.
func TestHavingWorkedOnceOutlastsADrySpell(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "wikimedia", 1, "", nil)
	for i := 0; i < emptyRunFaultAfterHit; i++ {
		r.record(faultAreaPictures, "wikimedia", 0, "", nil)
	}
	if len(r.faults()) != 1 {
		t.Fatal("the long run did not become a fault, so this case is not testing what it says")
	}
	r.record(faultAreaPictures, "wikimedia", 2, "", nil)
	// Back under the LONG threshold, not the short one: it has answered twice now.
	for i := 0; i < emptyRunFault; i++ {
		r.record(faultAreaPictures, "wikimedia", 0, "", nil)
	}
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("the source was demoted to the short threshold after a dry spell: %+v", got)
	}
}

// AND A RUNG IS RECORDED UNDER THE NAME THE READER KNOWS. "google-scrape" is a
// technique; the reader gave permission to a company. The response's own `sources`
// map already makes exactly this translation, and a second table in the client would
// be the same fact in two languages.
func TestARungIsRecordedUnderItsSuppliersName(t *testing.T) {
	for rung, want := range map[string]string{
		// NOT "google": vocab.source.google.label reads "Google Books", which is the
		// book supplier. The picture rung is a different product of the same company
		// and gets its own name, or the card says "Google Books found nothing" about
		// a picture search.
		"google-scrape": "google-images",
		"amazon-search": "amazon",
		"fandom":        "fandom",
		"wikimedia":     "wikimedia",
		"tvdb":          "tvdb",
		"tmdb":          "tmdb",
	} {
		if got := faultSourceOf(rung); got != want {
			t.Errorf("%s is reported as %q, want %q", rung, got, want)
		}
	}
}

// ---- and the plumbing between the two, which is the whole of the ask ----------
//
// EVERY CASE ABOVE TESTS THE FOLD IN ISOLATION, and the DOM cases on the other side
// feed the card a hand-written payload. NOTHING JOINED THEM — a rater deleted the
// `recordLookup` call out of the image ladder and the whole Go suite stayed green,
// then replaced the status payload's `faults` with an empty slice and it stayed green
// again. So the owner's exact report — "google photo search is yielding zero results,
// zilch", and the card saying nothing about it — could be unwired in either place
// without a single test noticing.
//
// This drives a real search through the handler and reads the answer off the real
// status endpoint. It is the only case here that proves the feature exists rather
// than that its parts are correct.

func TestAPictureRungThatKeepsFindingNothingReachesTheStatusCard(t *testing.T) {
	// A Google that answers a perfectly good page with no previews on it — the
	// "markup rotated" case, which is indistinguishable from an honest miss to
	// everything except the reason the scraper now returns.
	google := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `<html><body><div>nothing this understands</div></body></html>`)
	}))
	defer google.Close()

	srv := newTestServer(t)
	metadata.SetFandomAndScrapeBasesForTest(t, "", google.URL)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"google_scrape": true}, 200)

	// ONE SEARCH IS NOT A FAULT, which is the rule the whole design rests on — so
	// this asserts the card stays silent first, and only then earns the row.
	c.mustDo("POST", "/images/search", map[string]any{"kind": "poster", "title": "Heat"}, 200)
	if got := faultsOn(t, c); len(got) != 0 {
		t.Fatalf("one empty search put a fault on the card: %+v", got)
	}

	for i := 1; i < emptyRunFault; i++ {
		c.mustDo("POST", "/images/search",
			map[string]any{"kind": "poster", "title": fmt.Sprintf("Heat %d", i)}, 200)
	}
	got := faultsOn(t, c)
	if len(got) != 1 {
		t.Fatalf("after %d empty searches the card reports %+v", emptyRunFault, got)
	}
	// NAMED BY THE SUPPLIER THE READER KNOWS, not by the rung. "google-scrape" is a
	// technique; and it is google-IMAGES rather than google, because
	// vocab.source.google.label reads "Google Books" and would put a book supplier
	// on a fault about a poster.
	if got[0].Source != "google-images" || got[0].Area != faultAreaPictures {
		t.Errorf("the row names the wrong thing: %+v", got[0])
	}
	if got[0].Kind != "empty" || got[0].Run != emptyRunFault {
		t.Errorf("a dry spell was reported as something else: %+v", got[0])
	}
	// AND THE RUNG'S OWN ACCOUNT OF THE MISS TRAVELLED WITH IT. "Nothing found three
	// times" says something is wrong; "google's results page carried no preview
	// images" says what. It is the half that was being thrown away at the `return
	// nil` every failure used to share.
	if !strings.Contains(got[0].Note, "preview images") {
		t.Errorf("the reason did not reach the card: %q", got[0].Note)
	}
}

// faultsOn reads the card's own source — GET /metadata/status — rather than the
// registry behind it. That is the point of these two cases: the registry is tested
// above, and what was untested is that its answer survives the journey to a payload
// key the client reads.
func faultsOn(t *testing.T, c *testClient) []faultRow {
	t.Helper()
	var body struct {
		Faults []faultRow `json:"faults"`
	}
	if err := json.Unmarshal(c.mustDo("GET", "/metadata/status", nil, 200).Body.Bytes(), &body); err != nil {
		t.Fatalf("status did not decode: %v", err)
	}
	return body.Faults
}
