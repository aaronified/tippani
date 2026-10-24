package httpapi

// Corrections from the file, as the bucketiser sees pairs of strings and as a reader
// meets them through the API.
//
// WHAT THIS FILE KNOWS: the classifier is the observable unit for the pure table (a
// pair of strings in, a bucket out), and the API half knows PUT /sources, the three
// /corrections routes and their fields. It reads a quote's stored text and, for the
// "edited since it arrived" marker, writes updated_at straight into the database: the
// column has one-second resolution, so a real edit made in the same second as the
// creation could not be told apart from no edit at all.

import (
	"net/http"
	"strings"
	"testing"
)

const corrSRT = "1\n00:00:01,000 --> 00:00:03,000\nVoilà, the café is closed.\n\n" +
	"2\n00:01:00,000 --> 00:01:03,000\nRemember, remember the fifth of November.\n\n" +
	"3\n00:02:00,000 --> 00:02:03,000\nGovernments should be afraid of their people.\n\n" +
	"4\n00:03:00,000 --> 00:03:03,000\nPeople should not be afraid of their governments.\n"

type corrList struct {
	Buckets []struct {
		ID     string `json:"id"`
		Count  int    `json:"count"`
		Edited int    `json:"edited"`
	} `json:"buckets"`
	Proposals []corrProposal  `json:"proposals"`
	WrongFile []corrWrongFile `json:"wrong_file"`
}

func (l corrList) count(bucket string) int {
	for _, b := range l.Buckets {
		if b.ID == bucket {
			return b.Count
		}
	}
	return -1
}

func (l corrList) of(id int64) (corrProposal, bool) {
	for _, p := range l.Proposals {
		if p.ID == id {
			return p, true
		}
	}
	return corrProposal{}, false
}

func (c *testClient) corrections() corrList {
	c.t.Helper()
	return decode[corrList](c.t, c.mustDo("GET", "/corrections", nil, 200))
}

func (s *Server) quoteOf(t *testing.T, id int64) string {
	t.Helper()
	var q string
	if err := s.Store.DB.QueryRow(`SELECT quote FROM dialogues WHERE id = ?`, id).Scan(&q); err != nil {
		t.Fatal(err)
	}
	return q
}

func corrFixture(t *testing.T) (*Server, *testClient, map[string]int64, int64) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("V for Vendetta", "movie")
	ids := map[string]int64{
		"accents": c.newLine(film, "Voila, the cafe is closed.", nil),
		"word":    c.newLine(film, "Remember, remember the fifth of Novembr.", nil),
		"extend":  c.newLine(film, "Governments should be afraid of their", nil),
		"clean":   c.newLine(film, "People should not be afraid of their governments.", nil),
	}
	c.putSource(sourceFields("screen", film), "v.srt", []byte(corrSRT))
	return srv, c, ids, film
}

func corrItemOf(p corrProposal) corrItem {
	return corrItem{Kind: p.Kind, ID: p.ID, Quote: p.Quote, Proposed: p.Proposed}
}

func TestTheReaderSeesBucketsWithCountsAndNothingIsWrittenByLooking(t *testing.T) {
	srv, c, ids, _ := corrFixture(t)
	got := c.corrections()
	if got.count(corrAccents) != 1 || got.count(corrOneWord) != 1 || got.count(corrExtend) != 1 {
		t.Fatalf("%+v", got.Buckets)
	}
	if _, ok := got.of(ids["clean"]); ok {
		t.Fatal("a quote already in the file's words is not a proposal")
	}
	p, _ := got.of(ids["accents"])
	if p.Proposed != "Voilà, the café is closed." || p.Bucket != corrAccents {
		t.Fatalf("%+v", p)
	}
	if srv.quoteOf(t, ids["accents"]) != "Voila, the cafe is closed." {
		t.Fatal("looking at proposals wrote the quote")
	}
}

func TestApplyingABucketRewritesTheQuoteAndOnlyThatBucket(t *testing.T) {
	srv, c, ids, _ := corrFixture(t)
	p, _ := c.corrections().of(ids["accents"])
	res := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrAccents, "bulk": true, "items": []corrItem{corrItemOf(p)}}, 200))
	if res["applied"] != 1 {
		t.Fatalf("%+v", res)
	}
	if got := srv.quoteOf(t, ids["accents"]); got != "Voilà, the café is closed." {
		t.Fatalf("stored %q", got)
	}
	if other := srv.quoteOf(t, ids["word"]); !strings.Contains(other, "Novembr.") {
		t.Fatalf("another bucket rode along: %q", other)
	}
	// The same press again is stale: the proposal is gone.
	again := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrAccents, "bulk": true, "items": []corrItem{corrItemOf(p)}}, 200))
	if again["applied"] != 0 || again["stale"] != 1 {
		t.Fatalf("%+v", again)
	}
	// The dedupe hash followed the words, so the corrected text added again is a duplicate.
	var hash string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(dedupe_hash, '') FROM dialogues WHERE id = ?`, ids["accents"]).Scan(&hash); err != nil || hash == "" {
		t.Fatalf("hash %q err %v", hash, err)
	}
}

func TestACorrectionsBulkPressNeverCrossesBuckets(t *testing.T) {
	srv, c, ids, _ := corrFixture(t)
	p, _ := c.corrections().of(ids["word"])
	res := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrAccents, "bulk": true, "items": []corrItem{corrItemOf(p)}}, 200))
	if res["applied"] != 0 || res["skipped"] != 1 {
		t.Fatalf("%+v", res)
	}
	if !strings.Contains(srv.quoteOf(t, ids["word"]), "Novembr") {
		t.Fatal("written across buckets")
	}
	c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": "everything", "items": []corrItem{corrItemOf(p)}}, http.StatusBadRequest)
}

func TestKeepMineIsDurableAcrossARescan(t *testing.T) {
	srv, c, ids, film := corrFixture(t)
	p, _ := c.corrections().of(ids["word"])
	res := decode[map[string]int](t, c.mustDo("POST", "/corrections/ignore",
		map[string]any{"items": []corrItem{corrItemOf(p)}}, 200))
	if res["ignored"] != 1 {
		t.Fatalf("%+v", res)
	}
	if _, ok := c.corrections().of(ids["word"]); ok {
		t.Fatal("a refused correction came back")
	}
	// A rescan of the same file rebuilds the context rows; the refusal holds.
	c.putSource(sourceFields("screen", film), "v.srt", []byte(corrSRT))
	if _, ok := c.corrections().of(ids["word"]); ok {
		t.Fatal("a rescan re-asked a refused correction")
	}
	if !strings.Contains(srv.quoteOf(t, ids["word"]), "Novembr") {
		t.Fatal("refusing rewrote the quote")
	}
}

func TestAQuoteTheReaderEditedIsMarkedAndBulkSkipsItButOnePressStillApplies(t *testing.T) {
	srv, c, ids, _ := corrFixture(t)
	if _, err := srv.Store.DB.Exec(
		`UPDATE dialogues SET updated_at = datetime('now', '+1 minute') WHERE id = ?`, ids["accents"]); err != nil {
		t.Fatal(err)
	}
	got := c.corrections()
	p, _ := got.of(ids["accents"])
	if !p.Edited {
		t.Fatalf("not marked: %+v", p)
	}
	if o, _ := got.of(ids["word"]); o.Edited {
		t.Fatal("an untouched quote is marked as edited")
	}
	bulk := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrAccents, "bulk": true, "items": []corrItem{corrItemOf(p)}}, 200))
	if bulk["applied"] != 0 || bulk["skipped_edited"] != 1 {
		t.Fatalf("%+v", bulk)
	}
	one := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrAccents, "bulk": false, "items": []corrItem{corrItemOf(p)}}, 200))
	if one["applied"] != 1 {
		t.Fatalf("%+v", one)
	}
}

func TestAQuoteChangedSinceTheReaderLookedIsStaleAndNotOverwritten(t *testing.T) {
	srv, c, ids, _ := corrFixture(t)
	p, _ := c.corrections().of(ids["word"])
	if _, err := srv.Store.DB.Exec(`UPDATE dialogues SET quote = ? WHERE id = ?`, "My own wording entirely", ids["word"]); err != nil {
		t.Fatal(err)
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/corrections/accept",
		map[string]any{"bucket": corrOneWord, "items": []corrItem{corrItemOf(p)}}, 200))
	if res["applied"] != 0 || res["stale"] != 1 {
		t.Fatalf("%+v", res)
	}
	if srv.quoteOf(t, ids["word"]) != "My own wording entirely" {
		t.Fatal("an edited quote was overwritten")
	}
}

func TestAWorkWhoseQuotesAllDifferWholesaleGetsOneRowNotOnePerQuote(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Wrong cut", "movie")
	// Four lines, each with four of its eight words a letter off: close enough for the
	// matcher to place, far enough to be a wholesale difference in every one.
	lines := []string{
		"alpha bravo charlie delta echo foxtrot golf hotel",
		"india juliet kilo lima mike november oscar papa",
		"quebec romeo sierra tango uniform victor whiskey xray",
		"yankee zulu amber bronze copper dahlia ember fennel",
	}
	var srt strings.Builder
	for i, l := range lines {
		n := itoa(int64(i))
		srt.WriteString(itoa(int64(i+1)) + "\n00:0" + n + ":00,000 --> 00:0" + n + ":02,000\n" + l + "\n\n")
		words := strings.Fields(l)
		for j := 0; j < 4; j++ {
			words[j] = words[j][:len(words[j])-1] + "q"
		}
		c.newLine(film, strings.Join(words, " "), nil)
	}
	c.putSource(sourceFields("screen", film), "w.srt", []byte(srt.String()))
	got := c.corrections()
	if len(got.WrongFile) != 1 || got.WrongFile[0].Differing != 4 || got.WrongFile[0].Total != 4 {
		t.Fatalf("wrong-file rows: %+v (proposals %d)", got.WrongFile, len(got.Proposals))
	}
	for _, p := range got.Proposals {
		if p.Bucket == corrWording {
			t.Fatalf("a wrong-file work still lists a wholesale row: %+v", p)
		}
	}
}
