package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// ---- fixtures ---------------------------------------------------------------

// A two-quote book export, the shape §5b(a) round-trips.
const stagedBookMD = "---\ntitle: Sandworm Studies\nauthor: Liet Kynes\n---\n\n" +
	"## Chapter 1\n\n" +
	"> The spice must flow.\n- loc: p.142\n- tags: politics\n\n" +
	"> Fear is the mind-killer.\n- loc: 610-612\n- color: blue\n"

// A catalogue export: the `type:` line is what routes it to the film importer.
const stagedFilmMD = "---\ntitle: The Long Goodbye\ndirector: Robert Altman\nyear: 1973\ntype: movie\n---\n\n" +
	"> Nobody cares but me.\n- character: Philip Marlowe\n- timestamp: 01:02:03\n\n" +
	"> It's okay with me.\n- character: Philip Marlowe\n- timestamp: 00:04:30\n"

// ---- helpers ----------------------------------------------------------------

type stagedQueue struct {
	Pending int              `json:"pending"`
	Total   int              `json:"total"`
	Batches []stagedBatchRow `json:"batches"`
	Works   []stagedWorkRow  `json:"works"`
	Quotes  []stagedQuoteRow `json:"quotes"`
}

type stageReply struct {
	BatchID int64               `json:"batch_id"`
	Staged  int                 `json:"staged"`
	Pending int                 `json:"pending"`
	Works   []stagedWorkPreview `json:"works"`
	Dupes   []dupHint           `json:"possible_duplicates"`
}

type approveReply struct {
	Approved int            `json:"approved"`
	Added    int            `json:"added"`
	Skipped  int            `json:"skipped"`
	Enriched int            `json:"enriched"`
	Pending  int            `json:"pending"`
	BookIDs  []int64        `json:"book_ids"`
	MovieIDs []int64        `json:"movie_ids"`
	Books    []bookSummary  `json:"books"`
	Movies   []movieSummary `json:"movies"`
	Dupes    []dupHint      `json:"possible_duplicates"`
}

// stage uploads a file and asserts it staged cleanly, returning the reply. Every
// staging test begins with one.
func stage(t *testing.T, c *testClient, route, name string, body []byte) stageReply {
	t.Helper()
	rec := c.importFile(route, name, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: got %d: %s", route, rec.Code, rec.Body)
	}
	return decode[stageReply](t, rec)
}

func queue(t *testing.T, c *testClient, query string) stagedQueue {
	t.Helper()
	return decode[stagedQueue](t, c.mustDo("GET", "/import/staged"+query, nil, 200))
}

func stagedIDs(q stagedQueue) []int64 {
	ids := make([]int64, 0, len(q.Quotes))
	for _, sq := range q.Quotes {
		ids = append(ids, sq.ID)
	}
	return ids
}

// ---- the core property ------------------------------------------------------

// TestStagedImportHoldsUntilApproved is the whole point of the release: an import
// writes nothing into the library, is invisible to search and to the review deck,
// and only an explicit approval turns it into rows.
func TestStagedImportHoldsUntilApproved(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	if res.BatchID == 0 || res.Staged != 2 || res.Pending != 2 {
		t.Fatalf("staging reply: %+v", res)
	}
	if len(res.Works) != 1 || res.Works[0].Kind != "book" || res.Works[0].Title != "Sandworm Studies" ||
		res.Works[0].Staged != 2 || res.Works[0].TargetID != 0 {
		t.Fatalf("staged works: %+v", res.Works)
	}

	// Nothing in the library.
	if anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)); len(anns.Annotations) != 0 {
		t.Fatalf("staging created annotations: %+v", anns.Annotations)
	}
	// Nothing in search, either — the property the separate tables exist for.
	if hits := decode[searchResults](t, c.mustDo("GET", "/search?q=spice", nil, 200)); len(hits.Annotations) != 0 || len(hits.Books) != 0 {
		t.Fatalf("staged text is searchable: %+v", hits)
	}
	// Nothing in the review deck.
	if rev := decode[map[string]any](t, c.mustDo("GET", "/review/daily?offset=0", nil, 200)); rev["items"] != nil {
		if items, ok := rev["items"].([]any); ok && len(items) != 0 {
			t.Fatalf("staged quotes entered the deck: %+v", items)
		}
	}

	// The queue reports them, with their locators and tags intact.
	q := queue(t, c, "")
	if q.Pending != 2 || q.Total != 2 || len(q.Batches) != 1 || len(q.Works) != 1 || len(q.Quotes) != 2 {
		t.Fatalf("queue: pending=%d total=%d batches=%d works=%d quotes=%d",
			q.Pending, q.Total, len(q.Batches), len(q.Works), len(q.Quotes))
	}
	if b := q.Batches[0]; b.Source != "md" || b.Filename != "sandworm.md" || b.Quotes != 2 || b.Works != 1 {
		t.Fatalf("batch row: %+v", b)
	}
	byLoc := map[string]stagedQuoteRow{}
	for _, sq := range q.Quotes {
		byLoc[sq.Location] = sq
	}
	first, ok := byLoc["p.142"]
	if !ok || first.Chapter != "Chapter 1" || first.Color != "yellow" ||
		len(first.Tags) != 1 || first.Tags[0] != "politics" || first.LocationOrig != "p.142" {
		t.Fatalf("staged quote: %+v", q.Quotes)
	}
	if byLoc["610-612"].Color != "blue" {
		t.Fatalf("staged colour: %+v", byLoc["610-612"])
	}

	// Approve, and now it is real.
	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	if ap.Approved != 2 || ap.Added != 2 || ap.Skipped != 0 || ap.Pending != 0 {
		t.Fatalf("approve: %+v", ap)
	}
	if len(ap.BookIDs) != 1 || len(ap.Books) != 1 || !ap.Books[0].Created {
		t.Fatalf("approve books: %+v", ap.Books)
	}
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(anns.Annotations) != 2 {
		t.Fatalf("approved annotations: %+v", anns.Annotations)
	}
	if hits := decode[searchResults](t, c.mustDo("GET", "/search?q=spice", nil, 200)); len(hits.Annotations) != 1 {
		t.Fatalf("approved text must be searchable: %+v", hits)
	}
	// The queue is empty, and the emptied batch is gone with it.
	if q := queue(t, c, ""); q.Pending != 0 || len(q.Batches) != 0 || len(q.Works) != 0 {
		t.Fatalf("queue after approve: %+v", q)
	}
	// Tags only enter the vocabulary at approval.
	tags := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !containsTag(tags.Tags, "politics") {
		t.Fatalf("approved tags should join the vocabulary: %+v", tags.Tags)
	}
}

// TestStagedTagsStayOutOfTheVocabulary: a tag that exists only in an unapproved
// import must not show up in the user's tag list — the reason staged tags are
// denormalized text rather than join rows.
func TestStagedTagsStayOutOfTheVocabulary(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	tags := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if containsTag(tags.Tags, "politics") {
		t.Fatalf("an unapproved tag leaked into the vocabulary: %+v", tags.Tags)
	}
}

func containsTag(tags []tagRow, name string) bool {
	for _, tg := range tags {
		if strings.EqualFold(tg.Name, name) {
			return true
		}
	}
	return false
}

// TestStagedApproveIsIdempotentPerBatch: importing the same file twice stages two
// batches; approving both adds the quotes once. The dedupe that used to happen at
// import time now happens at approval, against the library.
func TestStagedApproveIsIdempotentPerBatch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	b := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	if a.BatchID == b.BatchID {
		t.Fatal("two uploads must be two batches")
	}
	if q := queue(t, c, ""); q.Pending != 4 || len(q.Batches) != 2 {
		t.Fatalf("both batches should be queued: %+v", q)
	}

	first := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": a.BatchID}, 200))
	if first.Added != 2 {
		t.Fatalf("first approve: %+v", first)
	}
	second := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": b.BatchID}, 200))
	if second.Added != 0 || second.Skipped != 2 {
		t.Fatalf("second approve must be a no-op: %+v", second)
	}
	if len(second.BookIDs) != 1 || second.BookIDs[0] != first.BookIDs[0] {
		t.Fatalf("second approve should join the same book: %+v", second)
	}
	if anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)); len(anns.Annotations) != 2 {
		t.Fatalf("re-approval doubled the quotes: %d", len(anns.Annotations))
	}
}

// ---- bulk edits -------------------------------------------------------------

// TestStagedBulkEdit covers the fields POST /annotations/bulk can set, plus the
// one it cannot: removing a tag.
func TestStagedBulkEdit(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	upd := decode[map[string]int](t, c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids":      ids,
		"add_tags": []string{"reread", "politics"}, // politics is already on one row
		"color":    "pink",
		"favorite": true,
		"chapter":  "Chapter One",
	}, 200))
	if upd["updated"] != 2 {
		t.Fatalf("updated: %+v", upd)
	}
	q := queue(t, c, "")
	for _, sq := range q.Quotes {
		if sq.Color != "pink" || !sq.Favorite || sq.Chapter != "Chapter One" {
			t.Fatalf("bulk fields: %+v", sq)
		}
		if !hasName(sq.Tags, "reread") || !hasName(sq.Tags, "politics") {
			t.Fatalf("bulk add_tags: %+v", sq.Tags)
		}
		if countName(sq.Tags, "politics") != 1 {
			t.Fatalf("add_tags must not duplicate an existing tag: %+v", sq.Tags)
		}
	}

	// Removing a tag — the thing the live bulk endpoint has no way to express.
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"batch_id":    res.BatchID,
		"remove_tags": []string{"POLITICS"}, // case-insensitive
	}, 200)
	for _, sq := range queue(t, c, "").Quotes {
		if hasName(sq.Tags, "politics") {
			t.Fatalf("remove_tags left the tag on: %+v", sq.Tags)
		}
		if !hasName(sq.Tags, "reread") {
			t.Fatalf("remove_tags removed the wrong tag: %+v", sq.Tags)
		}
	}

	// The edits survive into the library.
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200)
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(anns.Annotations) != 2 {
		t.Fatalf("approved: %+v", anns.Annotations)
	}
	for _, a := range anns.Annotations {
		if a.Color != "pink" || !a.Favorite || a.Chapter != "Chapter One" {
			t.Fatalf("edited quote did not land: %+v", a)
		}
		if !hasName(a.Tags, "reread") || hasName(a.Tags, "politics") {
			t.Fatalf("edited tags did not land: %+v", a.Tags)
		}
	}
}

func hasName(names []string, want string) bool {
	return countName(names, want) > 0
}

func countName(names []string, want string) int {
	n := 0
	for _, s := range names {
		if strings.EqualFold(s, want) {
			n++
		}
	}
	return n
}

// ---- retargeting ------------------------------------------------------------

// TestStagedRetargetAcrossKinds is the repair for a misdetected file: book
// highlights move onto a film, approval writes dialogues, and the book locators
// they arrived with are never destroyed on the way.
func TestStagedRetargetAcrossKinds(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Dune", "release_year": 2021}, http.StatusCreated))
	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids":      ids,
		"retarget": map[string]any{"kind": "movie", "id": m.ID},
	}, 200)

	// The group now points at the film, and the book locators survive the move —
	// in case the move was itself the mistake.
	q := queue(t, c, "")
	if len(q.Works) != 1 {
		t.Fatalf("retarget should leave one group: %+v", q.Works)
	}
	if w := q.Works[0]; !w.Pinned || w.TargetID != m.ID || w.Kind != "movie" || w.Quotes != 2 {
		t.Fatalf("retargeted work: %+v", w)
	}
	for _, sq := range q.Quotes {
		if sq.Chapter == "" || sq.Location == "" {
			t.Fatalf("retargeting destroyed the book locators: %+v", sq)
		}
	}

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	if ap.Added != 2 || len(ap.MovieIDs) != 1 || ap.MovieIDs[0] != m.ID || len(ap.BookIDs) != 0 {
		t.Fatalf("approve after cross-kind retarget: %+v", ap)
	}
	dlg := decode[dlgList](t, c.mustDo("GET", "/dialogues", nil, 200))
	if len(dlg.Dialogues) != 2 {
		t.Fatalf("dialogues: %+v", dlg.Dialogues)
	}
	if anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)); len(anns.Annotations) != 0 {
		t.Fatalf("nothing should have become an annotation: %+v", anns.Annotations)
	}
	// No stray book was created for the abandoned identity.
	books := decode[struct {
		Books []struct {
			ID int64 `json:"id"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200))
	if len(books.Books) != 0 {
		t.Fatalf("retargeted import still created a book: %+v", books.Books)
	}
}

// TestStagedRetargetSurvivesADeletedTarget: a pinned destination that is deleted
// while the quotes wait must not wedge the queue — approval falls back to
// resolving the parsed identity.
func TestStagedRetargetSurvivesADeletedTarget(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	other := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Somewhere Else"}, http.StatusCreated))
	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"batch_id": res.BatchID,
		"retarget": map[string]any{"kind": "book", "id": other.ID},
	}, 200)
	c.mustDo("DELETE", "/books/"+itoa(other.ID), nil, 200)

	// The queue drops the stale pin from its preview rather than showing a ghost.
	q := queue(t, c, "")
	if len(q.Works) != 1 || q.Works[0].Pinned {
		t.Fatalf("stale pin should not read as pinned: %+v", q.Works)
	}
	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	if ap.Added != 2 || len(ap.BookIDs) != 1 {
		t.Fatalf("approve with a stale pin: %+v", ap)
	}
}

// ---- discarding + partial selections ----------------------------------------

func TestStagedDiscard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	// Discard one row: the group survives with the other.
	one := decode[map[string]int](t, c.mustDo("DELETE", "/import/staged", map[string]any{"ids": ids[:1]}, 200))
	if one["discarded"] != 1 || one["pending"] != 1 {
		t.Fatalf("partial discard: %+v", one)
	}
	if q := queue(t, c, ""); q.Pending != 1 || len(q.Works) != 1 {
		t.Fatalf("queue after partial discard: %+v", q)
	}
	// Discard the rest: the work and its now-empty batch go too.
	rest := decode[map[string]int](t, c.mustDo("DELETE", "/import/staged", map[string]any{"batch_id": res.BatchID}, 200))
	if rest["discarded"] != 1 || rest["pending"] != 0 {
		t.Fatalf("full discard: %+v", rest)
	}
	if q := queue(t, c, ""); len(q.Batches) != 0 || len(q.Works) != 0 {
		t.Fatalf("an emptied batch should be gone: %+v", q)
	}
	// And the library never saw any of it.
	if anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)); len(anns.Annotations) != 0 {
		t.Fatalf("discard wrote to the library: %+v", anns.Annotations)
	}
}

// TestStagedApprovePartialSelection: approving some rows leaves the rest queued.
func TestStagedApprovePartialSelection(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"ids": ids[:1]}, 200))
	if ap.Approved != 1 || ap.Added != 1 || ap.Pending != 1 {
		t.Fatalf("partial approve: %+v", ap)
	}
	if anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)); len(anns.Annotations) != 1 {
		t.Fatalf("only one quote should have landed: %+v", anns.Annotations)
	}
	q := queue(t, c, "")
	if q.Pending != 1 || len(q.Works) != 1 {
		t.Fatalf("the rest must stay queued: %+v", q)
	}
	// The group's preview now points at the book its sibling created.
	if q.Works[0].TargetID == 0 {
		t.Fatalf("preview should have found the freshly created book: %+v", q.Works[0])
	}

	// `all` approves whatever is left.
	rest := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"all": true}, 200))
	if rest.Approved != 1 || rest.Added != 1 || rest.Pending != 0 {
		t.Fatalf("approve all: %+v", rest)
	}
}

// ---- queue reads ------------------------------------------------------------

// TestStagedApproveMergesWorksOntoOneBook: two batches naming the same book,
// approved in one pass, resolve to one library row — and the reply's id list says
// so once, not twice.
func TestStagedApproveMergesWorksOntoOneBook(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	first := "---\ntitle: Sandworm Studies\nauthor: Liet Kynes\n---\n\n> One.\n- loc: p.1\n"
	second := "---\ntitle: Sandworm Studies\nauthor: Liet Kynes\n---\n\n> Two.\n- loc: p.2\n"
	stage(t, c, "/import/markdown", "a.md", []byte(first))
	stage(t, c, "/import/markdown", "b.md", []byte(second))
	if q := queue(t, c, ""); len(q.Works) != 2 || q.Pending != 2 {
		t.Fatalf("two batches should stage two groups: %+v", q)
	}

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"all": true}, 200))
	if ap.Added != 2 || len(ap.Books) != 2 {
		t.Fatalf("both quotes should land, from two groups: %+v", ap)
	}
	if len(ap.BookIDs) != 1 {
		t.Fatalf("both groups resolve to one book, so one id: %+v", ap.BookIDs)
	}
	if ap.Books[0].BookID != ap.BookIDs[0] || ap.Books[1].BookID != ap.BookIDs[0] {
		t.Fatalf("per-group summaries should name the same book: %+v", ap.Books)
	}
	if ap.Books[0].Created == ap.Books[1].Created {
		t.Fatalf("exactly one group should have created the book: %+v", ap.Books)
	}
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(anns.Annotations) != 2 {
		t.Fatalf("annotations: %+v", anns.Annotations)
	}
}

// TestStagedWithinFileDuplicateEnriches: the pre-1.2.0 importer enriched when the
// same passage appeared twice in one file — the second copy donated whatever the
// first lacked. Staging collapses duplicates too, so it has to enrich the row it
// keeps rather than silently dropping the richer copy.
func TestStagedWithinFileDuplicateEnriches(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// The bare copy first, the annotated copy second — the order that loses data if
	// the collision is simply ignored.
	md := "---\ntitle: Twice Told\nauthor: A. Repeater\n---\n\n" +
		"> The same passage, said twice.\n\n" +
		"> The same passage, said twice.\n- loc: p.10\n- color: blue\n- note: the annotated copy\n- tags: politics\n"
	res := stage(t, c, "/import/markdown", "twice.md", []byte(md))
	if res.Staged != 1 {
		t.Fatalf("a within-file duplicate collapses to one row: %+v", res)
	}
	q := queue(t, c, "")
	if len(q.Quotes) != 1 {
		t.Fatalf("quotes: %+v", q.Quotes)
	}
	sq := q.Quotes[0]
	if sq.Location != "p.10" || sq.LocationOrig != "p.10" || sq.Color != "blue" ||
		sq.Note != "the annotated copy" || !hasName(sq.Tags, "politics") {
		t.Fatalf("the kept row should have been enriched by the duplicate: %+v", sq)
	}

	// And it survives approval with those values.
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200)
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(anns.Annotations) != 1 {
		t.Fatalf("annotations: %+v", anns.Annotations)
	}
	if a := anns.Annotations[0]; a.Location != "p.10" || a.Color != "blue" || a.Note != "the annotated copy" {
		t.Fatalf("approved: %+v", a)
	}
}

// TestStagedRepeatedBlocksKeepTheirIdentity: a file naming one book in two
// frontmatter blocks groups into one staged work, and the later block's ISBN and
// series must be backfilled onto it — upsertImportBook did that on a match, so
// staging must too, or the identity is lost before approval can use it.
func TestStagedRepeatedBlocksKeepTheirIdentity(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Dune\nauthor: Frank Herbert\n---\n\n> One.\n\n" +
		"---\ntitle: Dune\nauthor: Frank Herbert\nisbn: 9780441013593\nseries: Dune #1\n---\n\n> Two.\n"
	res := stage(t, c, "/import/markdown", "dune.md", []byte(md))
	if res.Staged != 2 {
		t.Fatalf("both quotes stage: %+v", res)
	}
	// One group, reported once, with the full count — not two entries sharing an id.
	if len(res.Works) != 1 || res.Works[0].Staged != 2 {
		t.Fatalf("the staging reply should merge the two blocks: %+v", res.Works)
	}
	q := queue(t, c, "")
	if len(q.Works) != 1 || q.Works[0].ISBN != "9780441013593" || q.Works[0].Series != "Dune" {
		t.Fatalf("the later block's identity should be backfilled: %+v", q.Works)
	}

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(ap.BookIDs[0]), nil, 200))
	if b.ISBN != "9780441013593" || b.Series != "Dune" || b.SeriesIndex != 1 {
		t.Fatalf("approved book should carry the identity: %+v", b)
	}
}

// TestStagedQueueBeyondSQLiteParameterLimit is the regression guard for the worst
// bug this feature could have shipped with: `all` and `batch_id` expand
// server-side to the whole queue, which is not bounded by the 5000-id cap on an
// explicit list, and SQLite refuses more than 32766 bound parameters in one
// statement. Un-chunked, a single large import made the queue impossible to
// approve, edit OR discard — a file that used to import fine became permanently
// stuck. The count here clears that ceiling on purpose.
func TestStagedQueueBeyondSQLiteParameterLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("stages 33,000 quotes")
	}
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const n = 33_000 // > 32766
	var md strings.Builder
	md.WriteString("---\ntitle: The Very Long File\nauthor: A. Prolific\n---\n\n")
	for i := 0; i < n; i++ {
		md.WriteString("> staged line number ")
		md.WriteString(itoa(int64(i)))
		md.WriteString(" of many.\n- loc: ")
		md.WriteString(itoa(int64(i + 1)))
		md.WriteString("\n\n")
	}
	res := stage(t, c, "/import/markdown", "long.md", []byte(md.String()))
	if res.Staged != n {
		t.Fatalf("staged %d, want %d", res.Staged, n)
	}

	// Every whole-queue operation the UI offers must survive it.
	if q := queue(t, c, "?counts=1"); q.Pending != n {
		t.Fatalf("pending %d, want %d", q.Pending, n)
	}
	upd := decode[map[string]int](t, c.mustDo("POST", "/import/staged/bulk",
		map[string]any{"all": true, "color": "blue"}, 200))
	if upd["updated"] != n {
		t.Fatalf("bulk over the whole queue: %+v", upd)
	}
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"all":     true,
		"formula": map[string]any{"field": "location", "op": "add", "value": 1},
	}, 200)
	c.mustDo("POST", "/import/staged/bulk", map[string]any{"all": true, "add_tags": []string{"bulkbulk"}}, 200)

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	if ap.Added != n || ap.Pending != 0 {
		t.Fatalf("approve the whole batch: added=%d pending=%d want %d/0", ap.Added, ap.Pending, n)
	}

	// And discard, on a second queue of the same size.
	again := stage(t, c, "/import/markdown", "long.md", []byte(md.String()))
	if again.Staged != n {
		t.Fatalf("re-stage: %d", again.Staged)
	}
	disc := decode[map[string]int](t, c.mustDo("DELETE", "/import/staged", map[string]any{"all": true}, 200))
	if disc["discarded"] != n || disc["pending"] != 0 {
		t.Fatalf("discard the whole queue: %+v", disc)
	}
}

// TestStagedQuotelessWorkStillApproves: a book or film exported with no quotes at
// all re-imports as exactly that, and the pre-1.2.0 importer created its row. The
// work must therefore be approvable — otherwise a whole-library export loses every
// unquoted work on the way back in — and discardable, rather than lingering as a
// group no selector can name.
func TestStagedQuotelessWorkStillApproves(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bare := "---\ntitle: Bought But Unread\nauthor: Nobody Yet\nisbn: 9780316769488\n---\n"
	res := stage(t, c, "/import/markdown", "bare.md", []byte(bare))
	if res.Staged != 0 || res.BatchID == 0 {
		t.Fatalf("a quoteless work stages zero quotes but a real batch: %+v", res)
	}
	q := queue(t, c, "")
	if q.Pending != 0 || len(q.Works) != 1 || q.Works[0].Quotes != 0 {
		t.Fatalf("the group should be queued with no quotes: %+v", q)
	}

	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200))
	if ap.Added != 0 || len(ap.BookIDs) != 1 || len(ap.Books) != 1 || !ap.Books[0].Created {
		t.Fatalf("approving a quoteless work must still create the book: %+v", ap)
	}
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(ap.BookIDs[0]), nil, 200))
	if b.Title != "Bought But Unread" || b.ISBN != "9780316769488" {
		t.Fatalf("created book: %+v", b)
	}
	// The queue is empty afterwards — no ghost batch left behind.
	if q := queue(t, c, ""); len(q.Batches) != 0 || len(q.Works) != 0 {
		t.Fatalf("queue after approving a quoteless work: %+v", q)
	}

	// The same group can be discarded instead, and that must also clear it.
	res2 := stage(t, c, "/import/markdown", "bare2.md", []byte("---\ntitle: Also Unread\n---\n"))
	disc := decode[map[string]int](t, c.mustDo("DELETE", "/import/staged", map[string]any{"batch_id": res2.BatchID}, 200))
	if disc["discarded"] != 0 {
		t.Fatalf("nothing to discard but the group: %+v", disc)
	}
	if q := queue(t, c, ""); len(q.Batches) != 0 || len(q.Works) != 0 {
		t.Fatalf("a quoteless group must be discardable: %+v", q)
	}
}

// THE DESTINATION'S ARTWORK REACHES THE QUEUE, BY BOTH ROUTES.
//
// A reader with four Kindle exports of one library wants to narrow the queue to a
// BOOK, not to a file — and a list of titles in a dropdown is the file filter again.
// The poster is what makes it a different control, and `stagedWorkRow` carried no
// path to build one from.
//
// TWO ROUTES, AND THAT IS THE WHOLE REASON THIS FILE EXISTS. A staged group resolves
// its destination one of two ways: `libraryWork` when the reader has PINNED one
// (retarget), and `previewStagedTarget` when the app matched it by title. They are
// different functions with different queries, so a cover added to one leaves exactly
// half of a real queue drawing a blank tile — and which half depends on how each
// group happened to be matched, which is invisible from any single row.
//
// A case covering only the pinned path would pass over that.

// setCover writes artwork straight onto the row. The API has no "set the cover path"
// verb — a cover arrives by upload or by a metadata fetch, neither of which belongs
// in a test about the import queue — so the column is set directly and the queue is
// asked what it reports.
func setCover(t *testing.T, srv *Server, table, col string, id int64, path string) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(`UPDATE `+table+` SET `+col+` = ? WHERE id = ?`, path, id); err != nil {
		t.Fatalf("set %s.%s: %v", table, col, err)
	}
}

func TestTheQueueReportsAPinnedDestinationsArtwork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A film nobody would match this book to by title, so the only way the group
	// reaches it is the reader's own retarget — which is the pinned path.
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Dune", "release_year": 2021}, http.StatusCreated))
	setCover(t, srv, "movies", "poster_path", m.ID, "dune.jpg")

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids": ids, "retarget": map[string]any{"kind": "movie", "id": m.ID},
	}, 200)

	w := queue(t, c, "").Works[0]
	if !w.Pinned {
		t.Fatalf("this case is about the PINNED route and the row is not pinned: %+v", w)
	}
	if w.TargetCover != "dune.jpg" {
		t.Fatalf("pinned destination's artwork missing: %+v", w)
	}
}

// A GROUP BOUND FOR A NEW WORK REPORTS NO ARTWORK, and reports it as "" rather than
// failing. That is the same state `target_title` is already in for such a row, so
// the client needs no second branch — which is the point of the empty string over,
// say, omitting the key.
func TestAGroupThatMatchesNothingReportsNoArtwork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))

	w := queue(t, c, "").Works[0]
	if w.TargetID != 0 {
		t.Fatalf("nothing should have matched: %+v", w)
	}
	if w.TargetCover != "" {
		t.Fatalf("a new work reported artwork it cannot have: %q", w.TargetCover)
	}
}

// EVERY LOCATOR THE QUEUE CARRIES CAN BE CORRECTED IN THE QUEUE.
//
// THE OWNER, on this part of the backlog: "complete import review". The queue's
// own argument, written in the importer, is that "an import guesses, and the queue
// is where a wrong guess gets corrected" — and for twelve fields that argument was
// false. stagedQuoteRow carries all twelve, StagedRow prints FOUR of them — speaker,
// occasion, occasion_date and place, which are positions 13-16 of `bits`
// (StagingPage.jsx:517-540) — and POST /import/staged/bulk could write none: the
// reader could see that a parser had put a speech's occasion in its place field,
// and could do nothing until after approving the row.
//
// COUNT THEM IN `bits` RATHER THAN FROM MEMORY. This comment said "three" in the
// commit written specifically to correct a previous count of "six", because
// occasion_date is easy to miss between occasion and place. The list is twelve lines
// long and reading it is the only way to be right about it.
//
// THE OTHER EIGHT WERE WORSE, because they were not printed either. A show's episode
// name, a game's act and quest, a proverb's region, a letter's recipient and the
// three that name the text a speech reaches a reader through went through the whole
// queue unseen and landed in the library unread.
//
// WHY A TABLE AND NOT ELEVEN TESTS. The decode is by pointer and the write is by
// column name, so the failure mode is a misspelling on ONE field: the request
// succeeds, reports an update, and stores nothing. That is invisible to a test of
// any other field, so every field needs its own round trip and none of them needs
// its own function.

// The eleven, each with the value to send and the reader that gets it back off the
// queue. The getter is what makes this a round trip rather than an echo: it comes
// from GET /import/staged, so a field that decoded into the request and never
// reached a column fails here.
var stagedLocatorFields = []struct {
	json string
	val  string
	get  func(stagedQuoteRow) string
}{
	{"act", "Act II", func(q stagedQuoteRow) string { return q.Act }},
	{"quest", "The Wolven Storm", func(q stagedQuoteRow) string { return q.Quest }},
	{"episode_name", "Ozymandias", func(q stagedQuoteRow) string { return q.EpisodeName }},
	{"speaker", "Hannah Arendt", func(q stagedQuoteRow) string { return q.Speaker }},
	{"occasion", "the Eichmann trial", func(q stagedQuoteRow) string { return q.Occasion }},
	{"place", "Jerusalem", func(q stagedQuoteRow) string { return q.Place }},
	{"region", "Bengal", func(q stagedQuoteRow) string { return q.Region }},
	{"recipient", "Theo van Gogh", func(q stagedQuoteRow) string { return q.Recipient }},
	{"work_title", "Eichmann in Jerusalem", func(q stagedQuoteRow) string { return q.WorkTitle }},
	{"locator", "ch. 15", func(q stagedQuoteRow) string { return q.Locator }},
	{"source_author", "Plato", func(q stagedQuoteRow) string { return q.SourceAuthor }},
	// THE CANONICAL FORM, not the phrase — the column is sorted and grouped as
	// text, so '-0399' is what 399 BCE has to be stored as. The client converts;
	// this asserts the endpoint stores whatever it is handed without mangling it.
	{"occasion_date", "-0399", func(q stagedQuoteRow) string { return q.OccasionDate }},
}

func TestAStagedRowTakesEveryLocatorItCarries(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))
	if len(ids) == 0 {
		t.Fatalf("nothing staged, so nothing below proves anything")
	}
	_ = res

	for _, f := range stagedLocatorFields {
		t.Run(f.json, func(t *testing.T) {
			c.mustDo("POST", "/import/staged/bulk", map[string]any{"ids": ids, f.json: f.val}, 200)
			for _, sq := range queue(t, c, "").Quotes {
				if got := f.get(sq); got != f.val {
					t.Fatalf("%s: sent %q, queue says %q — a field the endpoint decoded and never wrote", f.json, f.val, got)
				}
			}
		})
	}
}

// AN EMPTY STRING CLEARS, and on these eleven that is the case that breaks first.
// Every one is TEXT NOT NULL with the empty string as its DEFAULT, so writing them
// through nullable() — which is correct for chapter and location one block up —
// stores a NULL into a NOT NULL column and fails the whole transaction. The bug would be invisible
// until somebody emptied a box.
func TestClearingAStagedLocatorIsNotAConstraintViolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	set := map[string]any{"ids": ids}
	for _, f := range stagedLocatorFields {
		set[f.json] = f.val
	}
	c.mustDo("POST", "/import/staged/bulk", set, 200)

	clear := map[string]any{"ids": ids}
	for _, f := range stagedLocatorFields {
		clear[f.json] = ""
	}
	c.mustDo("POST", "/import/staged/bulk", clear, 200)
	for _, sq := range queue(t, c, "").Quotes {
		for _, f := range stagedLocatorFields {
			if got := f.get(sq); got != "" {
				t.Fatalf("%s did not clear: %q", f.json, got)
			}
		}
	}
}

// THE LINE THIS ENDPOINT DRAWS, asserted rather than left in a comment: the queue
// corrects where a line CAME FROM and never what it SAYS. A staged row is a record
// of what the file said, so its text, its note and its translation are not writable
// here — wording is fixed after approval, on a row that is yours.
//
// The check is that the value is IGNORED, not that the request fails. The house
// bulk convention is "absent key = leave alone", and an unknown key decodes to
// nothing at all — so a reader who posts one gets a 200 and no change, which is
// what this asserts. A 400 would be a different contract, and not this one.
func TestTheQueueDoesNotRewriteWhatAFileSaid(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	before := queue(t, c, "").Quotes
	ids := stagedIDs(queue(t, c, ""))

	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids":         ids,
		"quote":       "something the file never said",
		"note":        "nor this",
		"translation": "nor this either",
	}, http.StatusOK)

	after := queue(t, c, "").Quotes
	if len(after) != len(before) {
		t.Fatalf("the queue changed shape: %d then %d", len(before), len(after))
	}
	for i, sq := range after {
		if sq.Quote != before[i].Quote {
			t.Fatalf("the text was rewritten: %q -> %q", before[i].Quote, sq.Quote)
		}
		if sq.Note != before[i].Note || sq.Translation != before[i].Translation {
			t.Fatalf("note or translation was rewritten: %+v -> %+v", before[i], sq)
		}
	}
}
