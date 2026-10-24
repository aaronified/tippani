package httpapi

// Proposed times for film lines, through the API only.
//
// WHAT THIS FILE KNOWS: PUT /sources to give a film its subtitle, then the three
// routes under /locators, and the answers' fields. It reads a line's stored time
// straight from the database for the one claim a response cannot make: that a
// REFUSED, STALE or SKIPPED press wrote nothing.

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

const filmSRT = "1\n00:00:01,000 --> 00:00:03,000\nGood evening, London.\n\n" +
	"2\n00:01:02,500 --> 00:01:04,000\nPeople should not be afraid of their governments.\n\n" +
	"3\n00:02:10,000 --> 00:02:12,000\nGovernments should be afraid of their people.\n\n" +
	"4\n00:03:00,000 --> 00:03:03,000\nRemember, remember the fifth of November.\n"

type proposalList struct {
	Proposals []locatorProposal `json:"proposals"`
	Counts    map[string]int    `json:"counts"`
}

func (c *testClient) proposals() proposalList {
	c.t.Helper()
	return decode[proposalList](c.t, c.mustDo("GET", "/locators/proposals", nil, 200))
}

func itemOf(p locatorProposal) locatorItem {
	return locatorItem{ID: p.ID, Proposed: p.Proposed, ProposedEnd: p.ProposedEnd, Current: p.Current, CurrentEnd: p.CurrentEnd}
}

func (s *Server) timeOf(t *testing.T, id int64) (string, string) {
	t.Helper()
	var ts, end string
	if err := s.Store.DB.QueryRow(`SELECT COALESCE(timestamp, ''), timestamp_end FROM dialogues WHERE id = ?`, id).Scan(&ts, &end); err != nil {
		t.Fatal(err)
	}
	return ts, end
}

// one exact line, one fuzzy (a reader's typo), one already timed correctly.
func locatorFixture(t *testing.T) (*Server, *testClient, int64, int64, int64) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("V for Vendetta", "movie")
	exact := c.newLine(film, "People should not be afraid of their governments.", nil)
	fuzzy := c.newLine(film, "Governments should be afrad of their people", nil)
	timed := c.newLine(film, "Good evening, London.", map[string]any{"timestamp": "00:00:01", "timestamp_end": "00:00:03"})
	c.putSource(sourceFields("screen", film), "v.srt", []byte(filmSRT))
	return srv, c, exact, fuzzy, timed
}

func TestAcceptingAnExactBucketWritesTheTimesAndAnotherPressIsStale(t *testing.T) {
	srv, c, exact, fuzzy, _ := locatorFixture(t)
	var items []locatorItem
	for _, p := range c.proposals().Proposals {
		if p.Bucket == "exact" {
			items = append(items, itemOf(p))
		}
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": items}, 200))
	if res["applied"] != 1 || res["stale"] != 0 {
		t.Fatalf("%+v", res)
	}
	if ts, end := srv.timeOf(t, exact); ts != "00:01:02" || end != "00:01:04" {
		t.Fatalf("stored %q %q", ts, end)
	}
	if ts, _ := srv.timeOf(t, fuzzy); ts != "" {
		t.Fatalf("the fuzzy line must not ride along with the exact press: %q", ts)
	}
	// The same press again: the proposal is gone, so it is stale and writes nothing.
	again := decode[map[string]int](t, c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": items}, 200))
	if again["applied"] != 0 || again["stale"] != 1 {
		t.Fatalf("%+v", again)
	}
}

// "Bulk acts within one bucket and never across buckets": an exact press is not a way
// to accept something that wants an eye.
func TestABulkPressNeverCrossesBuckets(t *testing.T) {
	srv, c, _, fuzzy, _ := locatorFixture(t)
	var fz locatorItem
	for _, p := range c.proposals().Proposals {
		if p.ID == fuzzy {
			fz = itemOf(p)
		}
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": []locatorItem{fz}}, 200))
	if res["applied"] != 0 || res["skipped"] != 1 {
		t.Fatalf("%+v", res)
	}
	if ts, _ := srv.timeOf(t, fuzzy); ts != "" {
		t.Fatalf("written across buckets: %q", ts)
	}
	c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "everything", "items": []locatorItem{fz}}, http.StatusBadRequest)
}

func TestALineEditedSinceTheReaderLookedIsStaleAndNotOverwritten(t *testing.T) {
	srv, c, exact, _, _ := locatorFixture(t)
	var it locatorItem
	for _, p := range c.proposals().Proposals {
		if p.ID == exact {
			it = itemOf(p)
		}
	}
	// The reader types their own time before pressing.
	if _, err := srv.Store.DB.Exec(`UPDATE dialogues SET timestamp = '00:09:09' WHERE id = ?`, exact); err != nil {
		t.Fatal(err)
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": []locatorItem{it}}, 200))
	if res["applied"] != 0 || res["stale"] != 1 {
		t.Fatalf("%+v", res)
	}
	if ts, _ := srv.timeOf(t, exact); ts != "00:09:09" {
		t.Fatalf("overwrote the reader's own edit: %q", ts)
	}
}

// The route applies what the SERVER proposes. A client cannot use it to set a time.
func TestTheRouteWillNotWriteATimeItDidNotPropose(t *testing.T) {
	srv, c, exact, _, _ := locatorFixture(t)
	var it locatorItem
	for _, p := range c.proposals().Proposals {
		if p.ID == exact {
			it = itemOf(p)
		}
	}
	it.Proposed = "09:09:09"
	res := decode[map[string]int](t, c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": []locatorItem{it}}, 200))
	if res["applied"] != 0 || res["stale"] != 1 {
		t.Fatalf("%+v", res)
	}
	if ts, _ := srv.timeOf(t, exact); ts != "" {
		t.Fatalf("wrote a client-chosen time: %q", ts)
	}
}

func TestARefusalIsDurableAcrossARescanAndADifferentProposalIsANewOne(t *testing.T) {
	srv, c, exact, _, _ := locatorFixture(t)
	var it locatorItem
	for _, p := range c.proposals().Proposals {
		if p.ID == exact {
			it = itemOf(p)
		}
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/locators/ignore", map[string]any{"items": []locatorItem{it}}, 200))
	if res["ignored"] != 1 {
		t.Fatalf("%+v", res)
	}
	for _, p := range c.proposals().Proposals {
		if p.ID == exact {
			t.Fatal("a refused proposal came back")
		}
	}
	// A rescan against the same file proposes the same time: still refused.
	var film, src int64
	if err := srv.Store.DB.QueryRow(`SELECT subject_id, id FROM work_sources`).Scan(&film, &src); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", "/sources/"+strconv.FormatInt(src, 10)+"/rescan", nil, 200)
	for _, p := range c.proposals().Proposals {
		if p.ID == exact {
			t.Fatal("a rescan revived a refused proposal")
		}
	}
	// A different cut of the film proposes a different time for the same line: that is
	// a new proposal, because it is one.
	shifted := strings.ReplaceAll(filmSRT, "00:01:02,500 --> 00:01:04,000", "00:01:07,500 --> 00:01:09,000")
	c.putSource(sourceFields("screen", film), "v2.srt", []byte(shifted))
	found := false
	for _, p := range c.proposals().Proposals {
		if p.ID == exact && p.Proposed == "00:01:07" {
			found = true
		}
	}
	if !found {
		t.Fatal("a different time for the same line should be offered again")
	}
}

func TestAnotherReadersProposalsAreNotYoursToSeeOrAccept(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	film := admin.newScreen("Mine", "movie")
	line := admin.newLine(film, "People should not be afraid of their governments.", nil)
	admin.putSource(sourceFields("screen", film), "v.srt", []byte(filmSRT))

	if got := cara.proposals(); len(got.Proposals) != 0 {
		t.Fatalf("leaked: %+v", got)
	}
	var it locatorItem
	for _, p := range admin.proposals().Proposals {
		it = itemOf(p)
	}
	res := decode[map[string]int](t, cara.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": []locatorItem{it}}, 200))
	if res["applied"] != 0 {
		t.Fatalf("%+v", res)
	}
	if ts, _ := srv.timeOf(t, line); ts != "" {
		t.Fatalf("another reader wrote my line's time: %q", ts)
	}
}
