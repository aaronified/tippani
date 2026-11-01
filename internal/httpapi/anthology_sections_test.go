package httpapi

// SECTIONS IN AN ANTHOLOGY (0089), and its grouping setting.
//
// A section is a heading the reader writes among the passages. The failures these guard are the
// quiet ones: a renumber that moves a passage into the wrong section, a new passage that ties with
// a trailing heading, a section that cannot be moved the way a passage can.

import (
	"net/http"
	"sort"
	"strings"
	"testing"
)

type sectionedDetail struct {
	Anthology anthologyRow          `json:"anthology"`
	Entries   []anthologyEntryRow   `json:"entries"`
	Sections  []anthologySectionRow `json:"sections"`
}

func sectioned(t *testing.T, c *testClient, id int64) sectionedDetail {
	t.Helper()
	return decode[sectionedDetail](t, c.mustDo("GET", "/anthologies/"+itoa(id), nil, http.StatusOK))
}

// slotOrder reads the page the way the client does: entries and sections together, by position.
func slotOrder(d sectionedDetail) []string {
	type slot struct {
		pos float64
		key string
	}
	var all []slot
	for _, e := range d.Entries {
		all = append(all, slot{e.Position, e.Kind + ":" + itoa(e.ItemID)})
	}
	for _, s := range d.Sections {
		all = append(all, slot{s.Position, "section:" + itoa(s.ID)})
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].pos < all[j].pos })
	out := make([]string, len(all))
	for i, s := range all {
		out[i] = s.key
	}
	return out
}

func addSection(t *testing.T, c *testClient, id int64, title string, after map[string]any) anthologySectionRow {
	t.Helper()
	body := map[string]any{"title": title, "prose": "About " + title + "."}
	if after != nil {
		body["after"] = after
	}
	return decode[anthologySectionRow](t, c.mustDo("POST", "/anthologies/"+itoa(id)+"/sections", body, http.StatusCreated))
}

func threeBook(t *testing.T, c *testClient) (anthologyRow, int64, int64, int64) {
	t.Helper()
	a, b, cq, _ := taggedShelf(t, c)
	an := newAnthology(t, c, "Sectioned")
	addEntries(t, c, an.ID, []map[string]any{
		{"kind": "book", "item_id": a}, {"kind": "book", "item_id": b}, {"kind": "book", "item_id": cq},
	})
	return an, a, b, cq
}

func TestASectionIsPlacedWhereItWasAskedAndReadsInPlace(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, a, b, cq := threeBook(t, c)

	mid := addSection(t, c, an.ID, "Middle", map[string]any{"kind": "book", "item_id": a})
	end := addSection(t, c, an.ID, "End", nil)

	want := []string{"book:" + itoa(a), "section:" + itoa(mid.ID), "book:" + itoa(b), "book:" + itoa(cq), "section:" + itoa(end.ID)}
	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, want) {
		t.Errorf("order = %v, want %v", got, want)
	}
}

func TestASectionMovesThroughTheSameRouteAsAPassage(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, a, b, cq := threeBook(t, c)
	s := addSection(t, c, an.ID, "Moves", map[string]any{"kind": "book", "item_id": a})

	// a, [Moves] b c  ->  the heading goes to the top, and takes b and c with it.
	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "section", "item_id": s.ID, "after": nil,
	}, http.StatusOK)
	want := []string{"section:" + itoa(s.ID), "book:" + itoa(b), "book:" + itoa(cq), "book:" + itoa(a)}
	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, want) {
		t.Errorf("order = %v, want %v", got, want)
	}
	// And a passage can be dropped directly after a heading.
	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "book", "item_id": a, "after": map[string]any{"kind": "section", "item_id": s.ID},
	}, http.StatusOK)
	want = []string{"section:" + itoa(s.ID), "book:" + itoa(a), "book:" + itoa(b), "book:" + itoa(cq)}
	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, want) {
		t.Errorf("order after dropping a passage under the heading = %v, want %v", got, want)
	}
}

func TestAPassageAddedAfterATrailingHeadingLandsUnderIt(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, _, _, _ := threeBook(t, c)
	s := addSection(t, c, an.ID, "Last", nil)
	_, _, _, d := taggedShelf(t, c) // a second shelf: its fourth quote is a fresh passage
	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": d}})

	order := slotOrder(sectioned(t, c, an.ID))
	if n := len(order); n != 5 || order[3] != "section:"+itoa(s.ID) || order[4] != "book:"+itoa(d) {
		t.Errorf("a new passage tied with or preceded the trailing heading: %v", order)
	}
}

func TestARenumberAcrossASectionKeepsEveryPassageInItsSection(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an, a, b, cq := threeBook(t, c)
	s := addSection(t, c, an.ID, "Between", map[string]any{"kind": "book", "item_id": a})
	before := slotOrder(sectioned(t, c, an.ID))

	// Squeeze everything into a hair's width, the state a long run of moves leaves behind.
	for i, q := range []string{
		`UPDATE anthology_entries SET position = 1.0 WHERE kind='book' AND item_id=` + itoa(a),
		`UPDATE anthology_sections SET position = 1.00000001 WHERE id=` + itoa(s.ID),
		`UPDATE anthology_entries SET position = 1.00000002 WHERE kind='book' AND item_id=` + itoa(b),
		`UPDATE anthology_entries SET position = 1.00000003 WHERE kind='book' AND item_id=` + itoa(cq),
	} {
		if _, err := srv.Store.DB.Exec(q); err != nil {
			t.Fatalf("setup %d: %v", i, err)
		}
	}
	// A move that needs room between two of them forces the renumber.
	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "book", "item_id": cq, "after": map[string]any{"kind": "section", "item_id": s.ID},
	}, http.StatusOK)

	want := []string{"book:" + itoa(a), "section:" + itoa(s.ID), "book:" + itoa(cq), "book:" + itoa(b)}
	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, want) {
		t.Errorf("after the renumber the order was %v, want %v (it began as %v)", got, want, before)
	}
	// The squeeze is gone: no two slots sit closer than the reorder rule's gap.
	d := sectioned(t, c, an.ID)
	var pos []float64
	for _, e := range d.Entries {
		pos = append(pos, e.Position)
	}
	for _, x := range d.Sections {
		pos = append(pos, x.Position)
	}
	sort.Float64s(pos)
	for i := 1; i < len(pos); i++ {
		if pos[i]-pos[i-1] < anthologyPositionGap {
			t.Errorf("two slots are still squeezed together after the renumber: %v", pos)
		}
	}
}

func TestASectionIsEditedAndDeletedWithoutTouchingThePassages(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, _, _, _ := threeBook(t, c)
	s := addSection(t, c, an.ID, "Old", nil)

	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/sections/"+itoa(s.ID),
		map[string]any{"title": "New", "prose": "Better."}, http.StatusNoContent)
	if got := sectioned(t, c, an.ID).Sections; len(got) != 1 || got[0].Title != "New" || got[0].Prose != "Better." {
		t.Fatalf("after the edit: %+v", got)
	}

	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/sections/"+itoa(s.ID), nil, http.StatusNoContent)
	d := sectioned(t, c, an.ID)
	if len(d.Sections) != 0 || len(d.Entries) != 3 {
		t.Errorf("deleting the heading left %d sections and %d passages, want 0 and 3", len(d.Sections), len(d.Entries))
	}
}

func TestASectionNeedsAHeading(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, _, _, _ := threeBook(t, c)
	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/sections", map[string]any{"title": "   ", "prose": "x"}, http.StatusBadRequest)
}

func TestSomebodyElsesAnthologyCannotBeSectioned(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	an := newAnthology(t, c, "Mine")
	s := addSection(t, c, an.ID, "Mine too", nil)
	bob := addUser(t, h, c, "bob")

	bob.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/sections", map[string]any{"title": "x"}, http.StatusNotFound)
	bob.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/sections/"+itoa(s.ID), map[string]any{"title": "x"}, http.StatusNotFound)
	bob.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/sections/"+itoa(s.ID), nil, http.StatusNotFound)
	bob.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/grouping", map[string]any{"group_by": "work"}, http.StatusNotFound)
	if n := len(sectioned(t, c, an.ID).Sections); n != 1 {
		t.Errorf("the owner's anthology holds %d sections after bob's attempts, want 1", n)
	}
}

func TestGroupingIsOneOfTheKnownWaysAndIsKept(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an := newAnthology(t, c, "Grouped")
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/grouping", map[string]any{"group_by": "chapter"}, http.StatusBadRequest)
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/grouping", map[string]any{"group_by": "person"}, http.StatusNoContent)
	if got := sectioned(t, c, an.ID).Anthology.GroupBy; got != "person" {
		t.Errorf("group_by = %q, want person", got)
	}
	// Editing the anthology's other settings does not clear it: it is not part of the full-state PUT.
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID), map[string]any{"title": "Grouped, renamed", "intro": ""}, http.StatusNoContent)
	if got := sectioned(t, c, an.ID).Anthology.GroupBy; got != "person" {
		t.Errorf("group_by = %q after a rename, want it kept", got)
	}
}

func TestDeletingAnAnthologyDeletesItsSections(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Gone")
	addSection(t, c, an.ID, "Heading", nil)
	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID), nil, http.StatusNoContent)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM anthology_sections`).Scan(&n); err != nil || n != 0 {
		t.Errorf("%d sections left after the anthology was deleted (err %v)", n, err)
	}
}

func TestAnAccountRoundTripKeepsSectionsAndGrouping(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	an := newAnthology(t, bob, "Parts")
	addSection(t, bob, an.ID, "Part one", nil)
	bob.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/grouping", map[string]any{"group_by": "work"}, http.StatusNoContent)

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+itoa(bobID), nil, http.StatusOK)
	restore(t, admin, binOf(t, admin).Trash[0].ID, http.StatusOK)

	again := &testClient{t: t, h: h}
	rec := again.do("POST", "/auth/login", map[string]string{"username": "bob", "password": "supersecret"})
	if rec.Code != 200 {
		t.Fatalf("bob cannot log in after the restore: %d", rec.Code)
	}
	again.cookie = cookieOf(t, rec)
	d := sectioned(t, again, an.ID)
	if len(d.Sections) != 1 || d.Sections[0].Title != "Part one" {
		t.Errorf("sections after the account came back: %+v", d.Sections)
	}
	if d.Anthology.GroupBy != "work" {
		t.Errorf("group_by after the account came back: %q", d.Anthology.GroupBy)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// A SECTION IN THE FILES an anthology leaves the app as.

func TestMarkdownCarriesASectionAboveTheEntryItOpens(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, a, b, _ := threeBook(t, c)
	addSection(t, c, an.ID, "The second thought", map[string]any{"kind": "book", "item_id": a})
	_ = b

	md := exportAnthology(t, c, an.ID)
	heading := strings.Index(md, "\n# The second thought\n")
	prose := strings.Index(md, "About The second thought.")
	second := strings.Index(md, "Waste no more time arguing.")
	first := strings.Index(md, "Think of the whole of existence.")
	if heading < 0 || !(first < heading && heading < prose && prose < second) {
		t.Errorf("the heading is not between the first and second passages (first %d, heading %d, prose %d, second %d):\n%s",
			first, heading, prose, second, md)
	}
}

func TestASectionSurvivesTheMarkdownRoundTripOnTheEntryItOpens(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	an, a, _, _ := threeBook(t, alice)
	addSection(t, alice, an.ID, "Part two", map[string]any{"kind": "book", "item_id": a})
	md := exportAnthology(t, alice, an.ID)

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "sectioned.md", md)
	if staged.Staged != 3 {
		t.Fatalf("staged %d rows, want 3 (a heading is not a passage)", staged.Staged)
	}
	approveBatch(t, bob, staged.BatchID)

	rebuilt := listAnthologies(t, bob)[0]
	d := sectioned(t, bob, rebuilt.ID)
	if len(d.Sections) != 1 || d.Sections[0].Title != "Part two" || d.Sections[0].Prose != "About Part two." {
		t.Fatalf("sections after the import: %+v", d.Sections)
	}
	order := slotOrder(d)
	if len(order) != 4 || !strings.HasPrefix(order[1], "section:") {
		t.Errorf("the heading is not second in the rebuilt anthology: %v", order)
	}
}

func TestTheEPUBOpensAChapterAtEachSection(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, a, _, _ := threeBook(t, c)
	addSection(t, c, an.ID, "Chapter two", map[string]any{"kind": "book", "item_id": a})

	z := exportEPUB(t, c, an.ID)
	body := epubFile(t, z, "OEBPS/anthology.xhtml")
	if !strings.Contains(body, `<h1 class="section" id="s1">Chapter two</h1>`) {
		t.Errorf("no chapter opener in the book:\n%s", body)
	}
	if !strings.Contains(epubFile(t, z, "OEBPS/toc.ncx"), `<text>Chapter two</text>`) {
		t.Errorf("the section is not in the contents")
	}
	if !strings.Contains(epubFile(t, z, "OEBPS/style.css"), "page-break-before: always") {
		t.Errorf("a section does not start a page")
	}
}

// A SECTION MOVES AS A CHAPTER DOES: the heading and the passages under it, up to the next heading.

func fourBook(t *testing.T, c *testClient) (anthologyRow, [4]int64) {
	t.Helper()
	a, b, cq, d := taggedShelf(t, c)
	an := newAnthology(t, c, "Chapters")
	addEntries(t, c, an.ID, []map[string]any{
		{"kind": "book", "item_id": a}, {"kind": "book", "item_id": b},
		{"kind": "book", "item_id": cq}, {"kind": "book", "item_id": d},
	})
	return an, [4]int64{a, b, cq, d}
}

func book(id int64) string { return "book:" + itoa(id) }

func TestASectionMovesWithThePassagesUnderIt(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, q := fourBook(t, c)
	s1 := addSection(t, c, an.ID, "One", map[string]any{"kind": "book", "item_id": q[0]})
	s2 := addSection(t, c, an.ID, "Two", map[string]any{"kind": "book", "item_id": q[2]})
	// a, [One] b c, [Two] d
	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "section", "item_id": s1.ID, "after": map[string]any{"kind": "book", "item_id": q[3]},
	}, http.StatusOK)

	want := []string{book(q[0]), "section:" + itoa(s2.ID), book(q[3]), "section:" + itoa(s1.ID), book(q[1]), book(q[2])}
	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, want) {
		t.Errorf("order = %v, want %v (the heading and its two passages move together)", got, want)
	}
}

func TestASectionMovesToTheTopWithItsPassages(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, q := fourBook(t, c)
	addSection(t, c, an.ID, "One", map[string]any{"kind": "book", "item_id": q[0]})
	s2 := addSection(t, c, an.ID, "Two", map[string]any{"kind": "book", "item_id": q[2]})

	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "section", "item_id": s2.ID, "after": nil,
	}, http.StatusOK)

	order := slotOrder(sectioned(t, c, an.ID))
	if len(order) != 6 || order[0] != "section:"+itoa(s2.ID) || order[1] != book(q[3]) {
		t.Errorf("the second chapter did not come first with its passage: %v", order)
	}
}

func TestASectionCannotMoveIntoThePassagesUnderIt(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, q := fourBook(t, c)
	s1 := addSection(t, c, an.ID, "One", map[string]any{"kind": "book", "item_id": q[0]})
	before := slotOrder(sectioned(t, c, an.ID))

	c.mustDo("POST", "/anthologies/"+itoa(an.ID)+"/order", map[string]any{
		"kind": "section", "item_id": s1.ID, "after": map[string]any{"kind": "book", "item_id": q[2]},
	}, http.StatusBadRequest)

	if got := slotOrder(sectioned(t, c, an.ID)); !equalStrings(got, before) {
		t.Errorf("a refused move changed the order: %v became %v", before, got)
	}
}
