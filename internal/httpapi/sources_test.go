package httpapi

// A work's source file, through the API only: upload, replace, look up, delete.
//
// WHAT THIS FILE KNOWS: the addresses PUT/GET /sources and DELETE /sources/{id},
// the form fields subject / subject_id / episode / file, the words in the
// answers, and — for the two guards that are about disk — that the data
// directory has a Sources folder. It declares the last because "the first file
// is gone from disk, not just from the row" is a claim about disk and nothing
// the API shows can stand in for it.

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

const srtSample = "1\n00:00:01,000 --> 00:00:03,000\nHello there.\n\n2\n00:00:04,000 --> 00:00:06,000\nGeneral Kenobi.\n"

// epubSample is the two things SourceFormat looks for: the zip signature and the
// EPUB mimetype entry in the first bytes. It is not a readable book and does not
// need to be: this store never opens one.
func epubSample() []byte {
	return append([]byte("PK\x03\x04\x14\x00\x00\x00\x00\x00mimetypeapplication/epub+zip"), make([]byte, 64)...)
}

func (c *testClient) putSource(fields map[string]string, name string, content []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		_ = mw.WriteField(k, v)
	}
	fw, err := mw.CreateFormFile("file", name)
	if err != nil {
		c.t.Fatal(err)
	}
	_, _ = fw.Write(content)
	_ = mw.Close()
	return c.doRaw("PUT", "/sources", &buf, mw.FormDataContentType())
}

func sourceFields(subject string, id int64, extra ...string) map[string]string {
	m := map[string]string{"subject": subject, "subject_id": strconv.FormatInt(id, 10)}
	for i := 0; i+1 < len(extra); i += 2 {
		m[extra[i]] = extra[i+1]
	}
	return m
}

func (c *testClient) newBook(title string) int64 {
	c.t.Helper()
	return idOf(c.t, c.mustDo("POST", "/books", map[string]any{"title": title}, http.StatusCreated).Body.Bytes())
}

func (c *testClient) newScreen(title, mediaType string) int64 {
	c.t.Helper()
	return idOf(c.t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": mediaType}, http.StatusCreated).Body.Bytes())
}

func sourceFilesOnDisk(t *testing.T, srv *Server) []string {
	t.Helper()
	ents, err := os.ReadDir(srv.sourcesDir())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range ents {
		out = append(out, e.Name())
	}
	return out
}

type sourceAnswer struct {
	State   string          `json:"state"`
	Sources []workSourceRow `json:"sources"`
}

func TestAFilmTakesASubtitleAndAnswersWhatItHolds(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")

	none := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200))
	if none.State != "none" || len(none.Sources) != 0 {
		t.Fatalf("a film with no file should say none, got %+v", none)
	}

	rec := c.putSource(sourceFields("screen", film), "sw.srt", []byte(srtSample))
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}
	got := decode[workSourceRow](t, rec)
	if got.Format != "srt" || got.Role != "subtitle" || got.State != "file" || got.Name != "sw.srt" || got.Bytes != int64(len(srtSample)) {
		t.Fatalf("row = %+v", got)
	}
	if len(got.SHA256) != 64 {
		t.Fatalf("sha256 not recorded: %q", got.SHA256)
	}
	if strings.Contains(rec.Body.String(), "path") {
		t.Fatalf("the stored filename must never be sent to a client: %s", rec.Body)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 1 {
		t.Fatalf("expected one file on disk, got %d", n)
	}
	have := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200))
	if have.State != "file" || len(have.Sources) != 1 {
		t.Fatalf("lookup = %+v", have)
	}
}

func TestASecondUploadReplacesTheFirstBytesIncluded(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")

	first := c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))
	firstFiles := sourceFilesOnDisk(t, srv)
	second := c.putSource(sourceFields("screen", film), "b.srt", []byte(strings.ReplaceAll(srtSample, "Hello", "Howdy")))
	if first.Code != http.StatusCreated || second.Code != http.StatusOK {
		t.Fatalf("statuses: first %d, second %d (want 201 then 200)", first.Code, second.Code)
	}
	now := sourceFilesOnDisk(t, srv)
	if len(now) != 1 || now[0] == firstFiles[0] {
		t.Fatalf("the first file should be gone and one new one held: before %v, after %v", firstFiles, now)
	}
	have := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200))
	if len(have.Sources) != 1 || have.Sources[0].Name != "b.srt" {
		t.Fatalf("expected one row naming the second upload, got %+v", have.Sources)
	}
}

func TestFormatComesFromTheBytesNotTheName(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("V for Vendetta", "movie")
	// The owner's own file arrived as `.ass.txt`.
	ass := "[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,Hello\n"
	got := decode[workSourceRow](t, c.putSource(sourceFields("screen", film), "vendetta.ass.txt", []byte(ass)))
	if got.Format != "ass" {
		t.Fatalf("an .ass.txt is an ass: %+v", got)
	}
	got = decode[workSourceRow](t, c.putSource(sourceFields("screen", film), "vendetta.mp4", []byte(srtSample)))
	if got.Format != "srt" {
		t.Fatalf("a subtitle named .mp4 is still a subtitle: %+v", got)
	}
}

func TestWhatASubjectCannotCarryIsRefusedInWords(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("A Film", "movie")
	game := c.newScreen("A Game", "game")
	book := c.newBook("A Book")
	show := c.newScreen("A Show", "show")

	cases := []struct {
		name    string
		fields  map[string]string
		content []byte
		want    string
	}{
		{"a game has no equivalent", sourceFields("screen", game), []byte(srtSample), "game"},
		{"a film takes no ebook", sourceFields("screen", film), epubSample(), "epub"},
		{"a book takes no subtitle", sourceFields("book", book), []byte(srtSample), "srt"},
		{"a show needs its episode", sourceFields("screen", show), []byte(srtSample), "episode"},
		{"a film has no episode", sourceFields("screen", film, "episode", "s01e01"), []byte(srtSample), "episode"},
		{"an unknown subject", sourceFields("album", 1), []byte(srtSample), "subject"},
		{"an empty file is nothing", sourceFields("screen", film), nil, "isn't"},
		{"a zip that is not an ebook", sourceFields("book", book), []byte("PK\x03\x04\x14\x00\x00\x00\x00\x00hello"), "isn't"},
	}
	for _, tc := range cases {
		rec := c.putSource(tc.fields, "f", tc.content)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: want 400, got %d %s", tc.name, rec.Code, rec.Body)
			continue
		}
		if !strings.Contains(rec.Body.String(), tc.want) {
			t.Errorf("%s: the answer should say %q, got %s", tc.name, tc.want, rec.Body)
		}
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("a refused upload must leave no file behind, found %d", n)
	}
}

func TestAShowsSubtitleIsPerEpisode(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("A Show", "show")

	a := c.putSource(sourceFields("screen", show, "episode", "S1E4"), "a.srt", []byte(srtSample))
	b := c.putSource(sourceFields("screen", show, "episode", "s01e05"), "b.srt", []byte(srtSample))
	again := c.putSource(sourceFields("screen", show, "episode", "s01e04"), "c.srt", []byte(srtSample))
	if a.Code != 201 || b.Code != 201 {
		t.Fatalf("two episodes are two sources: %d %d", a.Code, b.Code)
	}
	if again.Code != 200 {
		t.Fatalf("S1E4 and s01e04 are one episode, so this replaces: %d %s", again.Code, again.Body)
	}
	got := decode[workSourceRow](t, a)
	if got.Episode != "s01e04" {
		t.Fatalf("episode should be normalised, got %q", got.Episode)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 2 {
		t.Fatalf("two episodes should hold two files, got %d", n)
	}
}

func TestAnEssayTakesAnEbookAndASongTakesLyrics(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	mk := func(kind, title string) int64 {
		return idOf(t, c.mustDo("POST", "/quotes", map[string]any{
			"quote": "a line of " + title, "speaker": "Someone", "work_title": title, "kind": kind,
		}, http.StatusCreated).Body.Bytes())
	}
	essay, song, speech := mk("essay", "On Liberty"), mk("song", "Jana Gana Mana"), mk("speech", "A Speech")

	if rec := c.putSource(sourceFields("utterance", essay), "e.epub", testEPUB(t, "")); rec.Code != http.StatusCreated {
		t.Fatalf("essay + epub: %d %s", rec.Code, rec.Body)
	}
	lrc := "[00:01.00]first line\n[00:05.50]second line\n"
	row := decode[workSourceRow](t, c.putSource(sourceFields("utterance", song), "s.lrc", []byte(lrc)))
	if row.Format != "lrc" || row.Role != "text" {
		t.Fatalf("a song's lrc: %+v", row)
	}
	if rec := c.putSource(sourceFields("utterance", song), "s.epub", epubSample()); rec.Code != http.StatusBadRequest {
		t.Fatalf("a song takes lyrics, not an ebook: %d", rec.Code)
	}
	if rec := c.putSource(sourceFields("utterance", speech), "s.txt", []byte("words")); rec.Code != http.StatusBadRequest {
		t.Fatalf("a speech has a recording and no file form: %d", rec.Code)
	}
}

func TestTwoEssaysSharingATitleShareOneFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	mk := func(title, quote string) int64 {
		return idOf(t, c.mustDo("POST", "/quotes", map[string]any{
			"quote": quote, "speaker": "Mill", "work_title": title, "kind": "essay",
		}, http.StatusCreated).Body.Bytes())
	}
	a, b := mk("On Liberty", "first passage"), mk("on  liberty", "second passage")
	c.putSource(sourceFields("utterance", a), "x.txt", []byte("some text"))
	if rec := c.putSource(sourceFields("utterance", b), "y.txt", []byte("other text")); rec.Code != http.StatusOK {
		t.Fatalf("a respelling of the title is the same work, so this replaces: %d", rec.Code)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 1 {
		t.Fatalf("one work, one file: got %d", n)
	}
}

func TestOverTheCapNamesTheSizeAndTheCap(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Big")
	rec := c.putSource(sourceFields("book", book), "big.txt", bytes.Repeat([]byte("a"), maxSourceUpload+10))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("want 413, got %d %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "25 MB") {
		t.Fatalf("the answer should name the cap: %s", rec.Body)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("nothing should be stored: %d", n)
	}
}

func TestAnotherReadersWorkAndSourceAreNotFound(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	film := admin.newScreen("Mine", "movie")
	row := decode[workSourceRow](t, admin.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample)))

	id := strconv.FormatInt(film, 10)
	if rec := cara.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample)); rec.Code != http.StatusNotFound {
		t.Fatalf("uploading to somebody else's film: want 404, got %d", rec.Code)
	}
	if rec := cara.do("GET", "/sources?subject=screen&subject_id="+id, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("looking at somebody else's film: want 404, got %d", rec.Code)
	}
	if rec := cara.do("DELETE", "/sources/"+strconv.FormatInt(row.ID, 10), nil); rec.Code != http.StatusNotFound {
		t.Fatalf("deleting somebody else's source: want 404, got %d", rec.Code)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 1 {
		t.Fatalf("the owner's file must survive: %d", n)
	}
}

func TestNoRouteHandsASourceBack(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	row := decode[workSourceRow](t, c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample)))
	id := strconv.FormatInt(row.ID, 10)
	disk := sourceFilesOnDisk(t, srv)[0]

	// The addresses a download would plausibly live at. Not one may answer 200,
	// and none of them may carry the file's words.
	for _, p := range []string{
		"/sources/" + id, "/sources/" + id + "/file", "/sources/" + id + "/download",
		"/sources/file/" + disk, "/Sources/" + disk, "/sources/" + disk, "/media/Sources/" + disk,
	} {
		rec := c.do("GET", p, nil)
		if rec.Code == http.StatusOK && strings.Contains(rec.Body.String(), "General Kenobi") {
			t.Errorf("GET %s served the source file", p)
		}
	}
	// And the lookup that does exist says nothing of the file's contents or name.
	rec := c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200)
	if strings.Contains(rec.Body.String(), "General Kenobi") || strings.Contains(rec.Body.String(), disk) {
		t.Fatalf("lookup leaked the file: %s", rec.Body)
	}
}

func TestDeletingAWorkDeletesItsSourceRowAndBytes(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Dust of Dreams")
	film := c.newScreen("Star Wars", "movie")
	other := c.newScreen("Kept", "movie")
	c.putSource(sourceFields("book", book), "d.txt", []byte("some prose"))
	c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))
	c.putSource(sourceFields("screen", other), "k.srt", []byte(srtSample))
	if n := len(sourceFilesOnDisk(t, srv)); n != 3 {
		t.Fatalf("setup: %d files", n)
	}

	c.mustDo("DELETE", "/books/"+strconv.FormatInt(book, 10), nil, 200)
	c.mustDo("DELETE", "/movies/"+strconv.FormatInt(film, 10), nil, 200)
	if n := len(sourceFilesOnDisk(t, srv)); n != 1 {
		t.Fatalf("the two deleted works' files should be gone and the third kept: %d left", n)
	}
	var rows int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM work_sources`).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("rows left = %d (%v), want 1", rows, err)
	}
}

func TestBulkDeletingWorksDeletesTheirSourcesToo(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	a, b := c.newBook("One"), c.newBook("Two")
	c.putSource(sourceFields("book", a), "a.txt", []byte("prose a"))
	c.putSource(sourceFields("book", b), "b.txt", []byte("prose b"))

	c.mustDo("POST", "/books/bulk/delete", map[string]any{
		"ids": []int64{a, b}, "confirm": bulkDeletePhrase("book", 2),
	}, 200)
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("bulk delete left %d source files", n)
	}
}

func TestDeletingASourceOnItsOwnRemovesRowAndFile(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	row := decode[workSourceRow](t, c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample)))
	c.mustDo("DELETE", "/sources/"+strconv.FormatInt(row.ID, 10), nil, http.StatusNoContent)
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("file remains: %d", n)
	}
	have := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=screen&subject_id="+strconv.FormatInt(film, 10), nil, 200))
	if have.State != "none" {
		t.Fatalf("state = %q", have.State)
	}
}

func TestDeletingAnAccountRemovesItsSourceFiles(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	film := cara.newScreen("Hers", "movie")
	cara.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))
	if n := len(sourceFilesOnDisk(t, srv)); n != 1 {
		t.Fatalf("setup: %d", n)
	}
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'cara'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	admin.mustDo("DELETE", "/admin/users/"+strconv.FormatInt(id, 10), nil, http.StatusOK)
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("an account's source files should go with it: %d left", n)
	}
}

// The directory the files live in is the one place a stored name becomes a path,
// so a row whose name is not what this package writes must not be joined onto it.
func TestAStoredNameThatIsNotOursIsNeverJoinedToAPath(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	outside := filepath.Join(srv.DataDir, "precious.txt")
	if err := os.WriteFile(outside, []byte("do not delete"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_sources (user_id, subject, subject_id, role, format, path) VALUES (1, 'book', ?, 'text', 'txt', '../precious.txt')`, book); err != nil {
		t.Fatal(err)
	}
	row := decode[sourceAnswer](t, c.mustDo("GET", "/sources?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200))
	c.mustDo("DELETE", "/sources/"+strconv.FormatInt(row.Sources[0].ID, 10), nil, http.StatusNoContent)
	if _, err := os.Stat(outside); err != nil {
		t.Fatalf("a hand-edited row reached outside Sources/: %v", err)
	}
}

func TestTheAnswerIsJSON(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	rec := c.do("GET", "/sources?subject=book&subject_id=999", nil)
	var v map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil || rec.Code != http.StatusNotFound {
		t.Fatalf("a missing work is a JSON 404: %d %s", rec.Code, rec.Body)
	}
}
