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
	"errors"
	"testing"
)

func TestAWorkingSourceIsNotReportedAtAll(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "fandom", 4, "", nil)
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("a source that answered is on the fault list: %+v", got)
	}
}

// ONE MISS IS A MISS. This is the case that decides whether the feature is worth
// having: an image search for a minor character in a Bengali film genuinely has
// nothing behind it, and reporting that as a fault would fill the card on the first
// day with things nobody can fix.
func TestOneEmptyAnswerIsNotAFault(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "google-scrape", 0, "", nil)
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("a single empty search was called a fault: %+v", got)
	}
}

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

// AND A FAILURE IN THE MIDDLE OF A DRY SPELL DOES NEITHER THING TO IT. The run
// counts calls that WORKED and found nothing; a timeout is not evidence either way,
// so extending the run would inflate it and clearing it would hide a real fault
// behind one flaky request.
func TestAFailureNeitherExtendsNorClearsAnEmptyRun(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "fandom", 0, "", nil)
	r.record(faultAreaPictures, "fandom", 0, "", nil)
	r.record(faultAreaPictures, "fandom", 0, "", errors.New("boom"))
	if got := r.faults(); len(got) != 1 || got[0].Kind != "error" {
		t.Fatalf("the failure itself should be the fault right now: %+v", got)
	}
	// One more empty answer and the run reaches the threshold: 2 before the
	// failure, the failure carrying 2 forward, then the third.
	r.record(faultAreaPictures, "fandom", 0, "", nil)
	got := r.faults()
	if len(got) != 1 {
		t.Fatalf("want one fault, got %+v", got)
	}
	if got[0].Kind != "empty" || got[0].Run != emptyRunFault {
		t.Errorf("the run did not survive the failure intact: %+v", got[0])
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

// SORTED, because a list that reorders itself between two renders of the same page
// reads as things changing when nothing has — and a sync.Map's Range is explicitly
// unordered, so without this the card would shuffle on every poll.
func TestTheFaultListIsOrdered(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "wikimedia", 0, "", errors.New("x"))
	r.record(faultAreaFilms, "tvdb", 0, "", errors.New("x"))
	r.record(faultAreaPictures, "fandom", 0, "", errors.New("x"))
	r.record(faultAreaBooks, "google", 0, "", errors.New("x"))
	got := r.faults()
	want := []struct{ area, source string }{
		{faultAreaBooks, "google"},
		{faultAreaFilms, "tvdb"},
		{faultAreaPictures, "fandom"},
		{faultAreaPictures, "wikimedia"},
	}
	if len(got) != len(want) {
		t.Fatalf("want %d faults, got %+v", len(want), got)
	}
	for i, w := range want {
		if got[i].Area != w.area || got[i].Source != w.source {
			t.Fatalf("row %d is %s/%s, want %s/%s — the card will shuffle between polls",
				i, got[i].Area, got[i].Source, w.area, w.source)
		}
	}
}

// A SOURCE NOBODY ASKED IS NOT A SOURCE. An unconfigured supplier never runs, so it
// never records, so it never appears — which is the correct answer: "you have not
// set up IGDB" is a key field's job and is already said there, and a fault row
// saying it too would be the same fact on one screen twice.
func TestASourceThatWasNeverAskedIsNotAFault(t *testing.T) {
	var r lookupRegistry
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("an untouched registry reported faults: %+v", got)
	}
}

// AN EMPTY SOURCE NAME IS DROPPED RATHER THAN STORED UNDER "". A tier with no name
// is a bug in the ladder, and a fault row the card cannot label is worse than no
// row: the reader is told something is broken and not what.
func TestAnUnnamedSourceIsNotRecorded(t *testing.T) {
	var r lookupRegistry
	r.record(faultAreaPictures, "", 0, "", errors.New("boom"))
	if got := r.faults(); len(got) != 0 {
		t.Fatalf("a nameless source reached the card: %+v", got)
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

// THE COVER PROBE IS NOT A SEARCH AND IS NOT JUDGED AS ONE.
//
// `amazon-by-id` composes a cover URL from an ISBN or an ASIN and asks whether a
// picture is there. Given a book with neither it correctly does nothing and returns
// nothing — which, counted as an empty answer, would build a permanent run and put
// "Amazon found nothing" on the card of every reader who searches covers by title. A
// probe that was never given anything to probe with has not failed.
func TestTheCoverProbeIsNotTreatedAsASupplier(t *testing.T) {
	if got := faultSourceOf("amazon-by-id"); got != "" {
		t.Errorf("the by-id cover probe is recorded as %q, so it will accumulate a fault it cannot avoid", got)
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
