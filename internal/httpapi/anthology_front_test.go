package httpapi

// AN ANTHOLOGY'S FRONT MATTER (0090): a cover, an epigraph and a dedication.
//
// The failures these guard: a rename that clears them (the full-state PUT has never heard of them),
// a cover file that outlives its anthology, and a file that loses the reader's line breaks.

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func pngWithPad(pad int) []byte {
	return append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, make([]byte, 700+pad)...)
}

type frontDetail struct {
	Anthology struct {
		CoverPath  string `json:"cover_path"`
		Epigraph   string `json:"epigraph"`
		Dedication string `json:"dedication"`
	} `json:"anthology"`
}

func frontOf(t *testing.T, c *testClient, id int64) frontDetail {
	t.Helper()
	return decode[frontDetail](t, c.mustDo("GET", "/anthologies/"+itoa(id), nil, http.StatusOK))
}

func setFront(t *testing.T, c *testClient, id int64, epigraph, dedication string) {
	t.Helper()
	c.mustDo("PUT", "/anthologies/"+itoa(id)+"/front",
		map[string]any{"epigraph": epigraph, "dedication": dedication}, http.StatusNoContent)
}

func TestTheEpigraphAndDedicationAreKeptAndSurviveARename(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an := newAnthology(t, c, "Front")
	setFront(t, c, an.ID, "Time is the substance I am made of.\n— Borges", "For R.")
	// The anthology's own PUT has never heard of front matter and must not clear it.
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID), map[string]any{"title": "Front, renamed", "intro": "Hello."}, http.StatusNoContent)

	got := frontOf(t, c, an.ID).Anthology
	if got.Epigraph != "Time is the substance I am made of.\n— Borges" || got.Dedication != "For R." {
		t.Errorf("front matter after a rename: %+v", got)
	}
}

func TestFrontMatterIsBoundedAndIsNotSomebodyElses(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	an := newAnthology(t, c, "Mine")
	c.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front",
		map[string]any{"epigraph": strings.Repeat("x", anthologyFrontMax+1), "dedication": ""}, http.StatusBadRequest)
	bob := addUser(t, h, c, "bob")
	bob.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/front", map[string]any{"epigraph": "x"}, http.StatusNotFound)
	bob.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/cover", nil, http.StatusNotFound)
}

func TestACoverIsUploadedReplacedAndRemovedWithItsFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Covered")

	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(1), http.StatusOK)
	first := frontOf(t, c, an.ID).Anthology.CoverPath
	if first == "" {
		t.Fatal("no cover after the upload")
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), first)); err != nil {
		t.Fatalf("the cover file was not stored: %v", err)
	}

	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(2), http.StatusOK)
	second := frontOf(t, c, an.ID).Anthology.CoverPath
	if second == first {
		t.Fatal("a different picture kept the same name")
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), first)); err == nil {
		t.Errorf("the replaced cover's file is still on disk")
	}

	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID)+"/cover", nil, http.StatusNoContent)
	if frontOf(t, c, an.ID).Anthology.CoverPath != "" {
		t.Errorf("the cover is still named after it was removed")
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), second)); err == nil {
		t.Errorf("the removed cover's file is still on disk")
	}
}

func TestDeletingAnAnthologyDeletesItsCoverFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Covered")
	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(3), http.StatusOK)
	cover := frontOf(t, c, an.ID).Anthology.CoverPath

	c.mustDo("DELETE", "/anthologies/"+itoa(an.ID), nil, http.StatusNoContent)

	if _, err := os.Stat(filepath.Join(srv.coversDir(), cover)); err == nil {
		t.Errorf("the cover file outlived its anthology")
	}
}

func TestTheCoverIsOneOfTheReadersImages(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an := newAnthology(t, c, "Covered")
	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(4), http.StatusOK)
	cover := frontOf(t, c, an.ID).Anthology.CoverPath

	var uid int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users LIMIT 1`).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, f := range srv.userCoverFiles(uid) {
		found = found || f == cover
	}
	if !found {
		t.Errorf("the account's list of image files does not name the anthology's cover, so deleting the account would leave it")
	}
}

func TestMarkdownCarriesTheEpigraphAndDedicationAndNotTheCover(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, _, _, _ := threeBook(t, c)
	setFront(t, c, an.ID, "Time is the substance I am made of.\n— Borges", "For R.")
	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(5), http.StatusOK)

	md := exportAnthology(t, c, an.ID)
	if !strings.Contains(md, `epigraph: Time is the substance I am made of.\n— Borges`) || !strings.Contains(md, "dedication: For R.") {
		t.Errorf("the front matter is not in the file:\n%s", md)
	}
	if strings.Contains(strings.ToLower(md), "cover") {
		t.Errorf("a cover was written into the Markdown, which carries no images:\n%s", md)
	}
}

func TestTheEpigraphAndDedicationSurviveTheMarkdownRoundTripWithTheirLineBreaks(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	an, _, _, _ := threeBook(t, alice)
	setFront(t, alice, an.ID, "Line one.\nLine two with a \\ backslash.", "For R.")
	md := exportAnthology(t, alice, an.ID)

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "front.md", md)
	approveBatch(t, bob, staged.BatchID)

	got := frontOf(t, bob, listAnthologies(t, bob)[0].ID).Anthology
	if got.Epigraph != "Line one.\nLine two with a \\ backslash." || got.Dedication != "For R." {
		t.Errorf("after the round trip: %q / %q", got.Epigraph, got.Dedication)
	}
}

func TestTheEPUBCarriesTheFrontMatterAndNamesTheCover(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	an, _, _, _ := threeBook(t, c)
	setFront(t, c, an.ID, "Time is the substance.", "For R.")
	uploadPictureTo(t, c, "/anthologies/"+itoa(an.ID)+"/cover", pngWithPad(6), http.StatusOK)
	cover := frontOf(t, c, an.ID).Anthology.CoverPath

	z := exportEPUB(t, c, an.ID)
	body := epubFile(t, z, "OEBPS/anthology.xhtml")
	if !strings.Contains(body, `<p class="dedication">For R.</p>`) || !strings.Contains(body, `<blockquote class="epigraph"><p>Time is the substance.</p></blockquote>`) {
		t.Errorf("the front matter is not in the book:\n%s", body)
	}
	opf := epubFile(t, z, "OEBPS/content.opf")
	id := "i" + strings.ReplaceAll(cover, ".", "-")
	if !strings.Contains(opf, `<meta name="cover" content="`+id+`"/>`) || !strings.Contains(opf, `<item id="`+id+`" href="`+cover+`"`) {
		t.Errorf("the OPF does not name the cover:\n%s", opf)
	}
	found := false
	for _, f := range z.File {
		found = found || f.Name == "OEBPS/"+cover
	}
	if !found {
		t.Errorf("the cover image is not in the book")
	}
}

func TestAnAnthologyWithNoFrontMatterExportsAsItDid(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	an, _, _, _ := threeBook(t, c)
	md := exportAnthology(t, c, an.ID)
	if strings.Contains(md, "epigraph:") || strings.Contains(md, "dedication:") {
		t.Errorf("empty front matter was written:\n%s", md[:200])
	}
	raw, _ := json.Marshal(frontOf(t, c, an.ID))
	if strings.Contains(string(raw), `"cover_path":"`) && !strings.Contains(string(raw), `"cover_path":""`) {
		t.Errorf("a cover was invented: %s", raw)
	}
}

// A WORK'S IDENTITY IN THE FILE, and finding it again on import (0091).

const meditations = "9780140449334"

func bookWithISBN(t *testing.T, c *testClient, title, isbn string) int64 {
	t.Helper()
	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": title, "author": "Marcus Aurelius", "isbn": isbn}, http.StatusCreated))
	return b.ID
}

func highlight(t *testing.T, c *testClient, book int64, quote string) int64 {
	t.Helper()
	return decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": quote}, http.StatusCreated)).ID
}

func TestTheMarkdownNamesTheWorkByItsIdentifiers(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	book := bookWithISBN(t, c, "Meditations", meditations)
	ann := highlight(t, c, book, "Waste no more time arguing.")
	standalone := decode[struct{ ID int64 }](t, c.mustDo("POST", "/quotes", map[string]any{"quote": "A loose line."}, http.StatusCreated)).ID
	an := newAnthology(t, c, "Ids")
	addEntries(t, c, an.ID, []map[string]any{{"kind": "book", "item_id": ann}, {"kind": "utterance", "item_id": standalone}})

	md := exportAnthology(t, c, an.ID)
	if !strings.Contains(md, "- work_ids: isbn="+meditations) {
		t.Errorf("the book's identifier is not in the file:\n%s", md)
	}
	if n := strings.Count(md, "work_ids:"); n != 1 {
		t.Errorf("work_ids is written %d times, want once (the standalone quote has no work)", n)
	}
}

func TestAnEntryIsRelinkedToTheQuoteTheLibraryHasWhenTheIdentifierAndTheWordsMatch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	book := bookWithISBN(t, alice, "Meditations", meditations)
	ann := highlight(t, alice, book, "Waste no more time arguing.")
	an := newAnthology(t, alice, "Mine")
	addEntries(t, alice, an.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	md := exportAnthology(t, alice, an.ID)

	bob := addUser(t, h, alice, "bob")
	bobsBook := bookWithISBN(t, bob, "Meditations (his copy)", meditations)
	bobsAnn := highlight(t, bob, bobsBook, "Waste no more time arguing.")

	staged := stageQuotesMD(t, bob, "mine.md", md)
	ans := decode[map[string]any](t, bob.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": staged.BatchID}, http.StatusOK))
	if got, _ := ans["quotes_relinked"].(float64); got != 1 {
		t.Errorf("quotes_relinked = %v, want 1", ans["quotes_relinked"])
	}
	list := listAnthologies(t, bob)
	d := getAnthology(t, bob, list[0].ID)
	if len(d.Entries) != 1 || d.Entries[0].Kind != "book" || d.Entries[0].ItemID != bobsAnn {
		t.Errorf("the entry is %+v, want his own highlight %d", d.Entries, bobsAnn)
	}
	var utterances int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances WHERE user_id = (SELECT id FROM users WHERE username = 'bob')`).Scan(&utterances); err != nil || utterances != 0 {
		t.Errorf("a standalone copy was made (%d utterances, err %v)", utterances, err)
	}
}

func TestAnEntryStaysStandaloneWithoutAnExactMatch(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	book := bookWithISBN(t, alice, "Meditations", meditations)
	ann := highlight(t, alice, book, "Waste no more time arguing.")
	an := newAnthology(t, alice, "Mine")
	addEntries(t, alice, an.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	md := exportAnthology(t, alice, an.ID)

	// Bob has the book but a different passage of it: the identifier matches, the words do not.
	bob := addUser(t, h, alice, "bob")
	bobsBook := bookWithISBN(t, bob, "Meditations", meditations)
	highlight(t, bob, bobsBook, "Think of the whole of existence.")
	staged := stageQuotesMD(t, bob, "mine.md", md)
	ans := decode[map[string]any](t, bob.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": staged.BatchID}, http.StatusOK))
	if got, _ := ans["quotes_relinked"].(float64); got != 0 {
		t.Errorf("quotes_relinked = %v, want 0", ans["quotes_relinked"])
	}
	d := getAnthology(t, bob, listAnthologies(t, bob)[0].ID)
	if len(d.Entries) != 1 || d.Entries[0].Kind != "utterance" {
		t.Errorf("the entry is %+v, want a standalone quote", d.Entries)
	}
}

func TestAnEntryNamingAWorkTheLibraryLacksStaysStandalone(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	book := bookWithISBN(t, alice, "Meditations", meditations)
	ann := highlight(t, alice, book, "Waste no more time arguing.")
	an := newAnthology(t, alice, "Mine")
	addEntries(t, alice, an.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	md := exportAnthology(t, alice, an.ID)

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "mine.md", md)
	approveBatch(t, bob, staged.BatchID)
	d := getAnthology(t, bob, listAnthologies(t, bob)[0].ID)
	if len(d.Entries) != 1 || d.Entries[0].Kind != "utterance" {
		t.Errorf("the entry is %+v, want a standalone quote", d.Entries)
	}
}

// GROUP HEADERS in the Markdown, which the importer ignores.

func TestTheMarkdownDrawsOneGroupHeaderPerRunAndAnImporterIgnoresThem(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	a, b, cq, _ := taggedShelf(t, alice)
	an := newAnthology(t, alice, "Grouped")
	addEntries(t, alice, an.ID, []map[string]any{{"kind": "book", "item_id": a}, {"kind": "book", "item_id": b}, {"kind": "book", "item_id": cq}})
	addSection(t, alice, an.ID, "Break", map[string]any{"kind": "book", "item_id": b})
	alice.mustDo("PUT", "/anthologies/"+itoa(an.ID)+"/grouping", map[string]any{"group_by": "work"}, http.StatusNoContent)

	md := exportAnthology(t, alice, an.ID)
	// a, b | [Break] | c: the same work in two runs, because a heading ends a run.
	if n := strings.Count(md, "### Meditations"); n != 2 {
		t.Errorf("%d group headers, want 2 (one per run):\n%s", n, md)
	}

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "grouped.md", md)
	if staged.Staged != 3 {
		t.Fatalf("staged %d rows, want 3 (a group header is not a passage)", staged.Staged)
	}
}
