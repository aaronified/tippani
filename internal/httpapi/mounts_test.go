package httpapi

// A mounted library, through the API only.
//
// WHAT THIS KNOWS: PUT /admin/mounts with a folder, the scan and attach and refuse
// routes under /sources, and the shapes they answer. It builds the library folder on
// disk itself, and reads the folder afterwards for the one claim an answer cannot make:
// that nothing under a mount was ever removed or written.

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

)

type foundList struct {
	Candidates []foundCandidate `json:"candidates"`
	Scan       struct {
		State     string `json:"state"`
		JobID     int64  `json:"job_id"`
		Scanned   int    `json:"scanned"`
		Found     int    `json:"found"`
		Unclaimed int    `json:"unclaimed"`
	} `json:"scan"`
}

const andorSRT = "1\n00:00:01,000 --> 00:00:03,000\nSomething first.\n\n" +
	"2\n00:00:04,000 --> 00:00:07,000\nI burn my life to make a sunrise that I know I will never see.\n"

func writeFiles(t *testing.T, root string, files map[string][]byte) {
	t.Helper()
	for rel, data := range files {
		p := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

// A library on disk, and a reader whose library matches some of it.
func mountFixture(t *testing.T) (srv *Server, c *testClient, root string, film, show, book int64) {
	srv = newTestServer(t)
	c = signupAdmin(t, srv.Handler())
	root = t.TempDir()
	epubMeta := `<dc:title>Dust of Dreams: The Malazan Book of the Fallen 9</dc:title><dc:creator>Steven Erikson</dc:creator><dc:identifier>urn:isbn:9781409091530</dc:identifier>`
	writeFiles(t, root, map[string][]byte{
		"movies/V for Vendetta (2005) {tmdb-752}/V for Vendetta (2005).en.srt":       []byte(filmSRT),
		"movies/V for Vendetta (2005) {tmdb-752}/V for Vendetta (2005).en.hi.srt":    []byte(filmSRT),
		"movies/V for Vendetta (2005) {tmdb-752}/V for Vendetta (2005).sv.srt":       []byte(filmSRT),
		"movies/Not In My Library (1999)/Not In My Library (1999).en.srt":            []byte(filmSRT),
		"shows/Andor (2022) {tvdb-393189}/Season 01/Andor - S01E04 - Name.en.srt":    []byte(andorSRT),
		"shows/Andor (2022) {tvdb-393189}/Season 01/Andor - S01E05 - Another.en.srt": []byte(andorSRT),
		"books/Dust of Dreams.epub": epubWithMeta(t, epubMeta),
		"books/ignore me.txt":       []byte("not a source extension"),
	})
	film = c.newScreen("V for Vendetta", "movie")
	show = c.newScreen("Andor", "show")
	book = c.newBook("Dust of Dreams")
	for _, q := range []string{
		"UPDATE movies SET tmdb_id = 752, release_year = 2005 WHERE id = " + strconv.FormatInt(film, 10),
		"UPDATE movies SET tvdb_id = 393189 WHERE id = " + strconv.FormatInt(show, 10),
		"UPDATE books SET isbn = '9781409091530' WHERE id = " + strconv.FormatInt(book, 10),
	} {
		if _, err := srv.Store.DB.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	c.newLine(film, "People should not be afraid of their governments.", nil)
	c.newLine(show, "I burn my life to make a sunrise that I know I will never see.", map[string]any{"season": 1, "episode": 4})
	c.newHighlight(book, "A line of the book that matters to its reader, long enough to find.")
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)
	return
}

// startScan presses Scan on the folder and returns the job's id.
func (c *testClient) startScan() int64 {
	c.t.Helper()
	rec := c.do("POST", "/sources/scan", map[string]any{"mount_id": "library"})
	if rec.Code != http.StatusAccepted && rec.Code != http.StatusOK {
		c.t.Fatalf("Scan answered %d: %s", rec.Code, rec.Body)
	}
	return decode[struct {
		JobID int64 `json:"job_id"`
	}](c.t, rec).JobID
}

// found reads what the folder's scan has stored for this reader.
func (c *testClient) found() foundList {
	c.t.Helper()
	return decode[foundList](c.t, c.mustDo("GET", "/sources/found?mount_id=library", nil, 200))
}

// scan presses Scan once, waits for the job to finish, and reads the findings.
func (c *testClient) scan() foundList {
	c.t.Helper()
	c.waitJob(c.startScan(), "succeeded")
	return c.found()
}

func byTitle(l foundList) map[string]foundCandidate {
	out := map[string]foundCandidate{}
	for _, c := range l.Candidates {
		out[c.Title+"|"+c.Episode] = c
	}
	return out
}

func TestOnlyTheAdminChoosesFoldersAndAReaderNeverSeesAPath(t *testing.T) {
	srv, admin, root, _, _, _ := mountFixture(t)
	cara := addUser(t, srv.Handler(), admin, "cara")
	cara.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "x", Path: root}}}, http.StatusForbidden)
	cara.mustDo("GET", "/admin/mounts", nil, http.StatusForbidden)
	got := cara.mustDo("GET", "/sources/mounts", nil, 200).Body.String()
	if !strings.Contains(got, "library") || strings.Contains(got, root) {
		t.Fatalf("a reader may name a folder but never see where it is: %s", got)
	}
	admin.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "BAD ID", Path: root}}}, http.StatusBadRequest)
	admin.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "ok", Path: filepath.Join(root, "missing")}}}, http.StatusBadRequest)
}

func TestAScanProposesWhatItCanNameAndCountsWhatItCannot(t *testing.T) {
	_, c, _, film, show, book := mountFixture(t)
	got := c.scan()
	by := byTitle(got)

	v := by["V for Vendetta|"]
	if v.WorkID != film || v.How != "id" || v.Bucket != "exact" || v.Format != "subtitle" {
		t.Fatalf("the folder's {tmdb-752} is an exact match: %+v", v)
	}
	// Of the three tracks for that film, the plain English one is proposed.
	if !strings.HasSuffix(v.Rel, "V for Vendetta (2005).en.srt") {
		t.Fatalf("competing tracks: the plain English one should win, got %s", v.Rel)
	}
	a := by["Andor|s01e04"]
	if a.WorkID != show || a.How != "id" || a.Bucket != "exact" {
		t.Fatalf("an episode with lines is proposed by its tvdb id: %+v", a)
	}
	if _, ok := by["Andor|s01e05"]; ok {
		t.Fatal("an episode with no lines has nothing to place in a subtitle")
	}
	b := by["Dust of Dreams|"]
	if b.WorkID != book || b.How != "id" || b.Format != "epub" {
		t.Fatalf("an ISBN inside the file is an exact match, though the title carries a subtitle: %+v", b)
	}
	if got.Scan.Unclaimed < 1 {
		t.Fatalf("the film not in the library is counted, not hidden: %+v", got)
	}
	for _, cand := range got.Candidates {
		if strings.Contains(cand.Token, "\\") || cand.Token == "" {
			t.Fatalf("every candidate carries a signed token: %+v", cand)
		}
	}
}

func TestAttachingReadsThroughTheMountAndCopiesNothing(t *testing.T) {
	srv, c, root, film, _, _ := mountFixture(t)
	line := c.newLine(film, "Governments should be afraid of their people.", nil)
	var toks []string
	for _, cand := range c.scan().Candidates {
		if cand.Bucket == "exact" && cand.Subject == "screen" && cand.WorkID == film {
			toks = append(toks, cand.Token)
		}
	}
	res := decode[struct {
		Attached int          `json:"attached"`
		Context  contextStats `json:"context"`
	}](t, c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": toks}, 200))
	if res.Attached != 1 || res.Context.Matched != 2 {
		t.Fatalf("%+v", res)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("a mounted file is never copied: %d files in Sources", n)
	}
	var origin, mountID, rel string
	if err := srv.Store.DB.QueryRow(`SELECT origin, mount_id, path FROM work_sources WHERE subject_id = ?`, film).Scan(&origin, &mountID, &rel); err != nil {
		t.Fatal(err)
	}
	if origin != "mount" || mountID != "library" || filepath.IsAbs(rel) || strings.Contains(rel, root) {
		t.Fatalf("the row points INSIDE the mount by a relative path: %s %s %s", origin, mountID, rel)
	}
	if got := c.contextOf("dialogue", line); !strings.Contains(got.Body, "afraid of their people") {
		t.Fatalf("%+v", got)
	}
	// A file attached means the work no longer appears in a scan.
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			t.Fatalf("an attached work is proposed again: %+v", cand)
		}
	}
}

func TestATamperedOrForeignTokenAttachesNothing(t *testing.T) {
	srv, admin, _, film, _, _ := mountFixture(t)
	cara := addUser(t, srv.Handler(), admin, "cara")
	var tok string
	for _, cand := range admin.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			tok = cand.Token
		}
	}
	forged := tok[:len(tok)-2] + "AA"
	for name, c := range map[string]*testClient{"a forged token": admin, "another reader's": cara} {
		use := tok
		if name == "a forged token" {
			use = forged
		}
		res := decode[map[string]any](t, c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": []string{use}}, 200))
		if res["attached"].(float64) != 0 {
			t.Fatalf("%s attached: %+v", name, res)
		}
	}
	// A path is not a token, however it is dressed.
	res := decode[map[string]any](t, admin.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": []string{"../../etc/passwd"}}, 200))
	if res["attached"].(float64) != 0 || res["failed"].(float64) != 1 {
		t.Fatalf("%+v", res)
	}
}

func TestARefusedFileIsNotOfferedAgain(t *testing.T) {
	_, c, _, film, _, _ := mountFixture(t)
	var tok, refused string
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			tok, refused = cand.Token, cand.Rel
		}
	}
	res := decode[map[string]int](t, c.mustDo("POST", "/sources/ignore-found", map[string]any{"tokens": []string{tok}}, 200))
	if res["ignored"] != 1 {
		t.Fatalf("%+v", res)
	}
	// The REFUSED FILE does not come back. Refusal is per file and per work, as Cleanup's is, so
	// the next-best track for the same film may be offered in its place.
	for _, cand := range c.scan().Candidates {
		if cand.Rel == refused {
			t.Fatalf("a refused file came back: %+v", cand)
		}
	}
}

// THE DESIGN'S CENTRAL CLAIM: unplug the volume and every stored context still opens. What
// changes is the state, which says the file is not where it was.
func TestWhenTheMountGoesAwayContextStillOpensAndTheStateSaysMissing(t *testing.T) {
	srv, c, root, film, _, _ := mountFixture(t)
	line := c.newLine(film, "Governments should be afraid of their people.", nil)
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": []string{cand.Token}}, 200)
		}
	}
	state := func() string {
		return decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200)).State
	}
	if got := state(); got != "mounted" {
		t.Fatalf("state = %q", got)
	}
	if err := os.RemoveAll(filepath.Join(root, "movies")); err != nil {
		t.Fatal(err)
	}
	if got := state(); got != "missing" {
		t.Fatalf("state = %q", got)
	}
	if got := c.contextOf("dialogue", line); got.Body == "" {
		t.Fatalf("context must open with the file gone: %+v", got)
	}
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM work_sources WHERE subject_id = ?`, film).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if rec := c.do("POST", "/sources/"+strconv.FormatInt(id, 10)+"/rescan", nil); rec.Code != http.StatusConflict {
		t.Fatalf("a rescan with the file gone says so: %d %s", rec.Code, rec.Body)
	}
}

// NOTHING UNDER A MOUNT IS EVER REMOVED: deleting the work, the source or the account
// removes rows, never bytes the operator owns.
func TestDeletingAMountedWorkOrSourceNeverTouchesTheFileOnTheMount(t *testing.T) {
	srv, c, root, film, _, book := mountFixture(t)
	for _, cand := range c.scan().Candidates {
		if cand.Subject == "screen" || cand.Subject == "book" {
			c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": cand.Bucket, "tokens": []string{cand.Token}}, 200)
		}
	}
	list := func() int {
		n := 0
		_ = filepath.Walk(root, func(_ string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() {
				n++
			}
			return nil
		})
		return n
	}
	before := list()
	c.mustDo("DELETE", "/movies/"+strconv.FormatInt(film, 10), nil, 200)
	var src int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM work_sources WHERE subject = 'book' AND subject_id = ?`, book).Scan(&src); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/sources/"+strconv.FormatInt(src, 10), nil, http.StatusNoContent)
	if after := list(); after != before {
		t.Fatalf("the mount lost files: %d -> %d", before, after)
	}
}

func TestARefusalIsForgottenWithTheWorkSoAReusedIdInheritsNone(t *testing.T) {
	srv, c, _, film, _, _ := mountFixture(t)
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			c.mustDo("POST", "/sources/ignore-found", map[string]any{"tokens": []string{cand.Token}}, 200)
		}
	}
	count := func() int {
		var n int
		_ = srv.Store.DB.QueryRow(`SELECT count(*) FROM cleanup_ignores WHERE kind = 'work-screen' AND item_id = ?`, film).Scan(&n)
		return n
	}
	if count() == 0 {
		t.Fatal("setup: the refusal should be stored")
	}
	c.mustDo("DELETE", "/movies/"+strconv.FormatInt(film, 10), nil, 200)
	if count() != 0 {
		t.Fatal("a deleted work's refusals must go with it: ids are reused, and the next work given this one would inherit them")
	}
}

// Files attached from a folder carry its id and a path relative to it. A DIFFERENT folder
// given the same id would silently take over their rows.
func TestARemovedFoldersIdCannotBeGivenToAnotherFolderWhileFilesPointAtIt(t *testing.T) {
	_, c, root, film, _, _ := mountFixture(t)
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": cand.Bucket, "tokens": []string{cand.Token}}, 200)
		}
	}
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{}}, 200)
	other := t.TempDir()
	rec := c.do("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: other}}})
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "choose another name") {
		t.Fatalf("a new folder must not take over a removed folder's id: %d %s", rec.Code, rec.Body)
	}
	// The same folder under a new id is fine, and the old rows read as missing, not as someone
	// else's files.
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library-2", Label: "Library", Path: root}}}, 200)
}
