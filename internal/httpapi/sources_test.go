package httpapi

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// A work's source file, through the API only: upload, replace, look up, delete.
//
// WHAT THIS FILE KNOWS: the addresses PUT/GET /sources and DELETE /sources/{id},
// the form fields subject / subject_id / episode / file, the words in the
// answers, and — for the two guards that are about disk — that the data
// directory has a Sources folder. It declares the last because "the first file
// is gone from disk, not just from the row" is a claim about disk and nothing
// the API shows can stand in for it.

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
		// LIVE files only: what the bin has parked under Sources/.trash is not live, and is
		// counted by parkedSourceFiles (sources_bin_test.go).
		if e.Name() == ".trash" {
			continue
		}
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

// MIXING SUPPLIERS: TMDB's metadata with TheTVDB's character art.
//
// The two halves are already separate controls — a re-sync pulls the record from
// the source the title is pinned to, and POST /movies/{id}/cast/tvdb pulls only
// the cast, from TheTVDB, whatever the pin says. What connected them was a
// column: that route needs `movies.tvdb_id` on the row and refuses to search for
// one, so a title that loses its TheTVDB id loses the only picture of a character
// in costume this app can get.
//
// And a re-sync erased it. The record is written from ONE supplier's payload,
// TMDB's details carry no TheTVDB id, so every id column was written from a
// response that could not know two of them.

// A RE-SYNC FROM ONE SUPPLIER MUST NOT ERASE ANOTHER'S ID. The rule was already
// written for imdb_id — "a supplier is the authority on what it knows, never on
// what it does not" — and applied to one column out of four.
func TestARefetchKeepsTheOtherSuppliersIDs(t *testing.T) {
	stub := &castStub{cast: `[{"id":1,"character":"Chell","name":"Alésia Glidewell"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	// The reader adopts TheTVDB's id for this title — the whole point being to
	// keep TMDB's record and reach TheTVDB's per-role art with it.
	// A full-state PUT, like every other save in this app — the panel sends the
	// whole record and this is the field the reader changed.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{"title": m.Title, "tvdb_id": 297762}, http.StatusOK)
	if got := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200)); got.TVDBID != 297762 {
		t.Fatalf("the id did not save: %+v", got)
	}

	// Re-fetch the metadata from TMDB, which is the ordinary "this record is
	// stale" button and knows nothing about TheTVDB.
	resyncFromTMDB(t, c, m.ID)

	after := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200))
	if after.TVDBID != 297762 {
		t.Fatalf("re-fetching from TMDB erased the TheTVDB id (%d) — the character art goes with it", after.TVDBID)
	}
	// And the supplier's OWN id is still authoritative: this is a re-sync of that
	// record, so it writes it.
	if after.TMDBID != 603 {
		t.Errorf("the pinned supplier's own id did not survive its own re-sync: %+v", after)
	}
}

// The same rule from the other end, and the case that shows it is about the
// COLUMN rather than about TheTVDB: a title with an IGDB id must not lose it to a
// film re-sync either.
func TestARefetchKeepsAnIGDBIDToo(t *testing.T) {
	stub := &castStub{cast: `[]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{"title": m.Title, "igdb_id": 1942}, http.StatusOK)
	resyncFromTMDB(t, c, m.ID)
	if after := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200)); after.IGDBID != 1942 {
		t.Fatalf("re-fetching erased the IGDB id: %+v", after)
	}
}

// Two things a quote can now say that it could not before (0070).
//
// ── A quote can name who it reaches us through.
//
// The owner's case: "socrates' speeches are known from plato's paraphrasing."
// Socrates is the speaker; Plato is neither the speaker nor the person spoken to.
// He is the reason there is a text. Before this there was nowhere to put him but
// the note, where nothing can group by him, cite him or find him — so the promise
// under test is not only that the field stores, but that the NAME IS A WAY IN.
//
// ── A line of film dialogue can say where it stops.
//
// "Film timestamp: start and end". A line occupies a stretch of the runtime, and
// the app has only ever recorded where that stretch begins.
const (
	apology      = "The unexamined life is not worth living"
	socrates     = "Socrates"
	plato        = "Plato"
	platoApology = "Apology"
)

func TestASpeechNamesWhoItReachesUsThrough(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, map[string]any{
		"quote":         apology,
		"speaker":       socrates,
		"kind":          "speech",
		"work_title":    platoApology,
		"source_author": plato,
	})
	if u.SourceAuthor != plato {
		t.Fatalf("create dropped the source author: got %q", u.SourceAuthor)
	}
	// FOUR NAMES ON ONE ROW AND NONE OF THEM IS ANOTHER. The point of a fifth
	// column rather than reusing one is that the reader means four different
	// things; a field that quietly landed in `speaker` would make Plato the person
	// who said this.
	if u.Speaker != socrates {
		t.Fatalf("the source author overwrote the speaker: %q", u.Speaker)
	}

	// THE READ IS A SEPARATE CLAIM FROM THE WRITE — the pair that broke for
	// occasion_circa, which was accepted, stored and never sent back, so it was
	// write-only across the whole app for a release. The list is the read (there is
	// no single-quote GET) and it is the right assertion anyway: the card's
	// attribution line draws this.
	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 || list.Utterances[0].SourceAuthor != plato {
		t.Fatalf("list row lacks the source author: %+v", list.Utterances)
	}

	// Editable and clearable: an attribution somebody got wrong has to be
	// removable, not only replaceable.
	body := map[string]any{"quote": apology, "speaker": socrates, "source_author": "Xenophon", "color": "yellow"}
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	after := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if after.Utterances[0].SourceAuthor != "Xenophon" {
		t.Fatalf("update did not take: got %q", after.Utterances[0].SourceAuthor)
	}
	body["source_author"] = ""
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK)
	cleared := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if cleared.Utterances[0].SourceAuthor != "" {
		t.Fatalf("clearing the source author did not take: got %q", cleared.Utterances[0].SourceAuthor)
	}
}

// THE WHOLE REASON TO RECORD PLATO is to find the Socrates lines by typing Plato.
// A name stored outside the search index is a name you can only reach by
// remembering which quote it sits on — which is the thing you were looking up. So
// this searches for a word that appears in NO other column of the row.
func TestTheSourceAuthorFindsTheQuoteHeTransmits(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{
		"quote":         apology,
		"speaker":       socrates,
		"kind":          "speech",
		"source_author": plato,
	})

	res := decode[searchResults](t, c.mustDo("GET", "/search?q="+url.QueryEscape(plato), nil, http.StatusOK))
	if len(res.Quotes) != 1 {
		t.Fatalf("searching the source author found %d quotes, want 1 — is source_author in utterances_fts?", len(res.Quotes))
	}
	if res.Quotes[0].Quote != apology {
		t.Fatalf("found the wrong quote: %q", res.Quotes[0].Quote)
	}
}

// A line of dialogue holds both ends of its stretch, and a game's line holds
// neither — which is the same rule the start has obeyed since 0047, applied to
// the end. A form that offered a box the server threw away would be offering to
// record something it does not keep.
func TestAFilmLineKeepsBothEndsAndAGameLineKeepsNone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Stalker"}, http.StatusCreated))
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id":      film.ID,
		"quote":         "Let everything that's been planned come true",
		"timestamp":     "01:12:40",
		"timestamp_end": "01:13:02",
	}, http.StatusCreated))
	if d.Timestamp != "01:12:40" || d.TimestampEnd != "01:13:02" {
		t.Fatalf("the film line lost an end: %q .. %q", d.Timestamp, d.TimestampEnd)
	}

	// The list is what the card reads, and a range the card cannot see is a range
	// the reader never gets back.
	list := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(film.ID), nil, http.StatusOK))
	if len(list.Dialogues) != 1 || list.Dialogues[0].TimestampEnd != "01:13:02" {
		t.Fatalf("list row lacks the end: %+v", list.Dialogues)
	}

	// A GAME HAS NO RUNTIME TO POINT INTO, either end. The server clears rather
	// than refuses (normalizeLocator's stated rule), so this asserts the clearing.
	game := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Disco Elysium", "media_type": "game",
	}, http.StatusCreated))
	g := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id":      game.ID,
		"quote":         "You are not a bad person",
		"timestamp":     "00:04:00",
		"timestamp_end": "00:04:11",
		"act":           "Day Two",
		"quest":         "Kim Kitsuragi",
	}, http.StatusCreated))
	if g.Timestamp != "" || g.TimestampEnd != "" {
		t.Fatalf("a game's line kept a runtime: %q .. %q", g.Timestamp, g.TimestampEnd)
	}
	if g.Act != "Day Two" || g.Quest != "Kim Kitsuragi" {
		t.Fatalf("clearing the runtime took the game's own locators with it: %q / %q", g.Act, g.Quest)
	}
}

// The backup half of a work's source file: what the archive carries, who may
// change that, and what a restore says it did not get. Through the API only.
// It shares sources_test.go's helpers.

func sourceEntries(names []string) int {
	n := 0
	for _, name := range names {
		if strings.HasPrefix(name, "Sources/") && !strings.HasSuffix(name, "/") {
			n++
		}
	}
	return n
}

func archiveOf(t *testing.T, srv *Server, ka keptArchive) []string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(srv.backupsDir(), ka.Name))
	if err != nil {
		t.Fatal(err)
	}
	return tarNames(t, plaintextOf(t, raw, testPw))
}

func TestABackupCarriesSourceFilesOnlyWhenAsked(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))

	if got := decode[map[string]bool](t, c.mustDo("GET", "/admin/backup/sources", nil, 200)); got["include"] {
		t.Fatal("the default is off")
	}
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 0 {
		t.Fatalf("default archive carried %d source files", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": true}, 200)
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 1 {
		t.Fatalf("with the setting on the archive should carry the file, got %d", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": false}, 200)
	if n := sourceEntries(archiveOf(t, srv, backupNow(c))); n != 0 {
		t.Fatalf("switched back off, got %d", n)
	}
	c.mustDo("PUT", "/admin/backup/sources", map[string]any{}, http.StatusBadRequest)
}

func TestTheBackupSettingIsTheAdminsAlone(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	cara.mustDo("GET", "/admin/backup/sources", nil, http.StatusForbidden)
	cara.mustDo("PUT", "/admin/backup/sources", map[string]any{"include": true}, http.StatusForbidden)
}

func TestARestoreSaysWhichSourcesTheArchiveDidNotCarry(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("Star Wars", "movie")
	book := c.newBook("Dust of Dreams")
	c.putSource(sourceFields("screen", film), "a.srt", []byte(srtSample))
	c.putSource(sourceFields("book", book), "d.txt", []byte("prose"))
	backupNow(c) // default: the rows travel, the files do not
	safetyBackup(t, c)

	rec := c.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, 200)
	var got struct {
		Missing int             `json:"sources_missing"`
		List    []missingSource `json:"sources_missing_list"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Missing != 2 || len(got.List) != 2 {
		t.Fatalf("the restore should name both works whose file it lacks: %s", rec.Body)
	}
	titles := got.List[0].Title + "|" + got.List[1].Title
	if !strings.Contains(titles, "Star Wars") || !strings.Contains(titles, "Dust of Dreams") {
		t.Fatalf("missing sources are named by work: %s", titles)
	}
}
