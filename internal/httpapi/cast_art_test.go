package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// A WORK PAGE'S PICTURES, ONE REQUEST: POST /{books|movies}/{id}/cast/art.
//
// The film is made through the app — added, given its TheTVDB id, its cast
// fetched from a TheTVDB stub (POST /movies/{id}/cast/tvdb), which is what leaves
// a role with a supplier's picture and no file and an actor with a supplier's
// headshot — and the page's request is sent as the page sends it: the names it
// is about to draw. What arrived is read back as the page reads it (the cast
// list, the person's record).
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the suppliers are the server's seams — TheTVDB (srv.TVDB, pointed at a stub
//     of its extended record, newTVDBCastStub) and the picture download
//     (srv.fetchImage) — because a test may not reach the real ones, and the
//     download is held mid-answer where a test needs a request in flight;
//   - whether a second request has joined the first before the first ends is a
//     moment no request can see, so the test that asks it waits until the
//     server's table of passes in progress (srv.castArtFlights) says the second
//     is waiting, and only then lets the first finish;
//   - how long a request keeps starting fetches and waiting (castArtBudget),
//     shortened in the tests that spend it, so they take a fraction of a second
//     and not forty-five;
//   - one test's picture download panics, as a bug in it would, and that
//     request's panic is recovered by the test as net/http recovers it for a
//     real connection;
//   - one test ends a request's context mid-download, which is what a reader
//     closing the tab does to it and which no request can do to another;
//   - how many roles and names one pass takes (castArtRoles, castArtNames), the
//     two twenties the loops it replaces capped themselves at;
//   - one test keeps the system log as serve() keeps it (logging) and reads it
//     as an admin does (GET /admin/logs), for the code a download that failed is
//     logged under (TIP-COVER-001) — the Troubleshooting row an operator follows;
//   - the answer's two names (character_images, portraits), which are the
//     route's contract with the page;
//   - one test serves the handler over a real connection with a write deadline
//     shorter than its pass, because a recorder has no deadline to outlast and
//     the server's own (sixty seconds) is too long to wait out.
//
// What each one guards, in a sentence a person would say: opening a film fetches
// its roles' pictures and its actors' headshots in one request, skipping an actor
// who already has one and asking nothing twice; a book's page asks for no
// headshots; another reader's film is not there; a second request for the same
// film while the first is out joins it, and the pictures are fetched once; a pass
// that has spent its time answers with what arrived; a request that joins a slow
// one answers within its own time, not the other's; a pass that panicked does
// not leave the request waiting on it waiting for good, nor let it take the pass
// for finished; a request whose first was cut short by its reader leaving
// fetches its own names rather than taking the cut pass for finished; a role the
// reader removed has no picture fetched; one pass takes twenty roles and twenty
// names, however many the work has; a picture or a headshot that will not
// download is in the server's log under the code its row names; and a pass
// slower than the server's write deadline still gets its answer to the page.

// countedDownloads stands in for the picture download: every address asked for
// becomes a file in the covers dir, and hold, when set, is waited on before the
// first download answers.
type countedDownloads struct {
	mu    sync.Mutex
	asked []string
	hold  chan struct{} // closed by the test to let the first download finish
	in    chan struct{} // signalled when the first download has begun
}

func countDownloads(srv *Server) *countedDownloads {
	d := &countedDownloads{in: make(chan struct{}, 1)}
	srv.fetchImage = func(_ context.Context, rawURL, dir string) (string, error) {
		d.mu.Lock()
		d.asked = append(d.asked, rawURL)
		first, hold := len(d.asked) == 1, d.hold
		name := fmt.Sprintf("%016x.jpg", len(d.asked))
		d.mu.Unlock()
		if first && hold != nil {
			d.in <- struct{}{}
			<-hold
		}
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	return d
}

func (d *countedDownloads) list() []string {
	d.mu.Lock()
	defer d.mu.Unlock()
	return append([]string(nil), d.asked...)
}

// suicideSquad is a film of c's whose cast came from TheTVDB: Amanda Waller with
// a picture of the role and Viola Davis's headshot, Harley Quinn with Margot
// Robbie's headshot and no picture of the role.
func suicideSquad(t *testing.T, srv *Server, c *testClient) int64 {
	t.Helper()
	film := filmWithTVDBID(t, c, "Suicide Squad", 297762)
	_, client, done := newTVDBCastStub(t, tvdbSuicideSquad)
	t.Cleanup(done)
	srv.TVDB = client
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast/tvdb", nil, http.StatusOK)
	return film
}

type castArtAnswer struct {
	CharacterImages int `json:"character_images"`
	Portraits       int `json:"portraits"`
}

func askCastArt(c *testClient, path string, names ...string) *httptest.ResponseRecorder {
	return c.do("POST", path+"/cast/art", map[string]any{"names": names})
}

func TestAWorksPicturesArriveInOneRequest(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	film := suicideSquad(t, srv, alice)
	book := createdID(t, alice, "/books", map[string]any{"title": "Suicide Squad: the novel", "author": "Someone"})
	// Margot Robbie already has a headshot of the reader's choosing.
	srv.fetchUserImage = func(_ context.Context, _, dir string) (string, error) {
		name := "00000000000000aa.jpg"
		return name, os.WriteFile(filepath.Join(dir, name), []byte("jpeg"), 0o600)
	}
	alice.mustDo("PUT", "/people/id/"+itoa(recordID(t, alice, "Margot Robbie")),
		map[string]any{"image_url": "https://example.test/margot.jpg"}, http.StatusOK)
	d := countDownloads(srv)

	// A book's page asks for no headshots, whatever names it sends.
	if got := decode[castArtAnswer](t, askCastArt(alice, "/books/"+itoa(book), "Viola Davis")); got != (castArtAnswer{}) || len(d.list()) != 0 {
		t.Fatalf("a book's page: %+v, downloads %v; want nothing asked", got, d.list())
	}

	got := decode[castArtAnswer](t, askCastArt(alice, "/movies/"+itoa(film), "Viola Davis", "Margot Robbie", "Viola Davis", " "))
	if got != (castArtAnswer{CharacterImages: 1, Portraits: 1}) {
		t.Fatalf("the film's pictures: %+v, want Amanda Waller's picture and Viola Davis's headshot", got)
	}
	if want := []string{"https://artworks.thetvdb.com/waller.jpg", "https://artworks.thetvdb.com/head412.jpg"}; strings.Join(d.list(), " ") != strings.Join(want, " ") {
		t.Fatalf("downloaded %v, want %v", d.list(), want)
	}
	for _, row := range castOf(t, alice, "/movies/"+itoa(film)).Cast {
		if row.Character == "Amanda Waller" && row.CharacterImagePath == "" {
			t.Fatal("Amanda Waller's picture was fetched and is not on her row")
		}
	}
	viola := decode[struct {
		ImagePath string `json:"image_path"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(recordID(t, alice, "Viola Davis")), nil, http.StatusOK))
	alice.mustDo("GET", "/covers/"+viola.ImagePath, nil, http.StatusOK)

	// Opened again, there is nothing left to fetch, and nothing is asked.
	if again := decode[castArtAnswer](t, askCastArt(alice, "/movies/"+itoa(film), "Viola Davis", "Margot Robbie")); again != (castArtAnswer{}) || len(d.list()) != 2 {
		t.Fatalf("the second opening: %+v, downloads %v", again, d.list())
	}
	// Bob has no such film, and nothing is looked up for him.
	if rec := askCastArt(bob, "/movies/"+itoa(film), "Viola Davis"); rec.Code != http.StatusNotFound || len(d.list()) != 2 {
		t.Fatalf("bob's request for alice's film: %d, downloads %v", rec.Code, d.list())
	}
}

func TestASecondRequestForTheSamePicturesJoinsTheFirst(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	d := countDownloads(srv)
	d.hold = make(chan struct{})
	path := "/movies/" + itoa(film)

	answers := make([]*httptest.ResponseRecorder, 2)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); answers[0] = askCastArt(alice, path, "Viola Davis") }()
	d.began(t)
	// The board and the Details panel both draw Viola Davis; the panel also
	// draws Margot Robbie.
	go func() { defer wg.Done(); answers[1] = askCastArt(alice, path, "Viola Davis", "Margot Robbie") }()
	waitForJoin(t, srv, castArtKey{uid: accountID(t, alice, "alice"), kind: "movie", id: film})
	close(d.hold)
	wg.Wait()

	var got [2]castArtAnswer
	for i, rec := range answers {
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: %d %s", i+1, rec.Code, rec.Body)
		}
		got[i] = decode[castArtAnswer](t, rec)
	}
	// The second hears what the first fetched, and then what it asked for that
	// the first had not: Margot Robbie's headshot.
	if got[0] != (castArtAnswer{1, 1}) || got[1] != (castArtAnswer{1, 2}) {
		t.Fatalf("the answers: %+v, want {1 1} and {1 2}", got)
	}
	counts := map[string]int{}
	for _, u := range d.list() {
		counts[u]++
	}
	if len(counts) != 3 || counts["https://artworks.thetvdb.com/waller.jpg"] != 1 || counts["https://artworks.thetvdb.com/head412.jpg"] != 1 {
		t.Fatalf("downloaded %v, want each of the three pictures once", d.list())
	}
}

// waitForJoin waits until a request has joined the pass in progress for key.
func waitForJoin(t *testing.T, srv *Server, key castArtKey) {
	t.Helper()
	for deadline := time.Now().Add(20 * time.Second); ; {
		srv.castArtFlights.mu.Lock()
		f := srv.castArtFlights.m[key]
		joined := f != nil && f.waiting == 1
		srv.castArtFlights.mu.Unlock()
		if joined {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("the second request never joined the first")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// began waits until the first held download has begun.
func (d *countedDownloads) began(t *testing.T) {
	t.Helper()
	select {
	case <-d.in:
	case <-time.After(20 * time.Second):
		t.Fatal("the first request never began a download")
	}
}

// THE BUDGET IS THE REQUEST'S. The board asks and its download hangs; the
// Details panel asks for the same film and joins it. The panel's request answers
// once its own time is spent — while the board's download is still out — rather
// than waiting the board's pass out and then spending a budget of its own.
func TestARequestThatJoinsASlowOneAnswersWithinItsOwnTime(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	was := castArtBudget
	castArtBudget = 300 * time.Millisecond
	t.Cleanup(func() { castArtBudget = was })
	d := countDownloads(srv)
	d.hold = make(chan struct{})
	path := "/movies/" + itoa(film)

	board := make(chan *httptest.ResponseRecorder, 1)
	go func() { board <- askCastArt(alice, path, "Viola Davis") }()
	d.began(t)
	panel := make(chan *httptest.ResponseRecorder, 1)
	go func() { panel <- askCastArt(alice, path, "Viola Davis", "Margot Robbie") }()
	waitForJoin(t, srv, castArtKey{uid: accountID(t, alice, "alice"), kind: "movie", id: film})

	var rec *httptest.ResponseRecorder
	select {
	case rec = <-panel:
	case <-time.After(20 * time.Second):
		close(d.hold)
		t.Fatal("the request that joined a slow one waited on it past its own time")
	}
	// Nothing had arrived when it answered: the board's download is still out.
	if got := decode[castArtAnswer](t, rec); rec.Code != http.StatusOK || got != (castArtAnswer{}) {
		t.Fatalf("the panel's answer: %d %+v, want 200 and nothing arrived yet", rec.Code, got)
	}
	close(d.hold)
	if got := decode[castArtAnswer](t, <-board); got != (castArtAnswer{CharacterImages: 1}) {
		t.Fatalf("the board's answer: %+v, want the one picture it started", got)
	}
	if want := []string{"https://artworks.thetvdb.com/waller.jpg"}; !slices.Equal(d.list(), want) {
		t.Fatalf("downloaded %v, want only %v: neither request starts a fetch past its time", d.list(), want)
	}
}

// A PASS THAT PANICS IS STILL OVER. net/http recovers the request and the server
// goes on; the request that had joined it, and any after, must run a pass of
// their own rather than wait on the one that is gone or take it for finished.
func TestAPicturePassThatPanickedDoesNotHoldUpTheRequestWaitingOnIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	d := countDownloads(srv)
	download := srv.fetchImage
	var panicked atomic.Bool
	in, hold := make(chan struct{}), make(chan struct{})
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		if panicked.CompareAndSwap(false, true) {
			close(in)
			<-hold
			panic("a bug in the picture download")
		}
		return download(ctx, rawURL, dir)
	}
	path := "/movies/" + itoa(film)
	first := make(chan bool, 1)
	go func() {
		defer func() { first <- recover() != nil }()
		askCastArt(alice, path, "Viola Davis")
	}()
	select {
	case <-in:
	case <-time.After(20 * time.Second):
		t.Fatal("the first request never began a download")
	}
	second := make(chan *httptest.ResponseRecorder, 1)
	go func() { second <- askCastArt(alice, path, "Viola Davis") }()
	waitForJoin(t, srv, castArtKey{uid: accountID(t, alice, "alice"), kind: "movie", id: film})
	close(hold)
	if !<-first {
		t.Fatal("the first request did not panic")
	}

	select {
	case rec := <-second:
		if got := decode[castArtAnswer](t, rec); got != (castArtAnswer{CharacterImages: 1, Portraits: 1}) {
			t.Fatalf("the request that waited on the pass that panicked: %+v, downloads %v; want the picture and the headshot", got, d.list())
		}
	case <-time.After(20 * time.Second):
		t.Fatal("the request that joined the pass that panicked is waiting on it still")
	}
}

// askCastArtIn is askCastArt in a request whose context the test holds, as the
// reader's tab holds a real one.
func askCastArtIn(ctx context.Context, c *testClient, path string, names ...string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]any{"names": names})
	req := httptest.NewRequest("POST", apiPath(path+"/cast/art"), bytes.NewReader(body)).WithContext(ctx)
	req.AddCookie(c.cookie)
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	return rec
}

// THE FIRST REQUEST'S READER LEFT. The board asks for Viola Davis and its tab is
// closed while Amanda Waller's picture is still downloading; the Details panel,
// open in another tab, had asked for the same name and joined it. The picture in
// hand is kept, the closed tab's pass starts nothing more, and the panel's
// request looks up the headshot itself — the pass it joined never got to it.
func TestARequestWhoseFirstWasCutShortFetchesItsOwnNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	d := countDownloads(srv)
	d.hold = make(chan struct{})
	path := "/movies/" + itoa(film)

	tab, closeTab := context.WithCancel(context.Background())
	defer closeTab()
	board := make(chan *httptest.ResponseRecorder, 1)
	go func() { board <- askCastArtIn(tab, alice, path, "Viola Davis") }()
	d.began(t)
	panel := make(chan *httptest.ResponseRecorder, 1)
	go func() { panel <- askCastArt(alice, path, "Viola Davis") }()
	waitForJoin(t, srv, castArtKey{uid: accountID(t, alice, "alice"), kind: "movie", id: film})
	closeTab()
	close(d.hold)
	<-board

	if got := decode[castArtAnswer](t, <-panel); got != (castArtAnswer{CharacterImages: 1, Portraits: 1}) {
		t.Fatalf("the panel's answer: %+v, downloads %v; want the picture the board fetched and the headshot it fetched itself", got, d.list())
	}
	if want := []string{"https://artworks.thetvdb.com/waller.jpg", "https://artworks.thetvdb.com/head412.jpg"}; !slices.Equal(d.list(), want) {
		t.Fatalf("downloaded %v, want %v", d.list(), want)
	}
}

// A ROLE THE READER REMOVED IS NOT FETCHED. Deleting a supplier's role keeps it
// as a tombstone, so the next cast fetch does not bring it back — its picture's
// address still on it. Opening the film must not download the picture of a role
// nobody can see.
func TestARoleTheReaderRemovedHasNoPictureFetched(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	path := "/movies/" + itoa(film)
	for _, row := range castOf(t, alice, path+"/cast").Cast {
		if row.Character == "Amanda Waller" {
			alice.mustDo("DELETE", "/cast/"+itoa(row.ID), nil, http.StatusNoContent)
		}
	}
	d := countDownloads(srv)

	if got := decode[castArtAnswer](t, askCastArt(alice, path)); got != (castArtAnswer{}) || len(d.list()) != 0 {
		t.Fatalf("a film whose only role with a picture was removed: %+v, downloads %v; want nothing fetched", got, d.list())
	}
}

// tvdbEnsemble is a TheTVDB record whose cast is roles from to to, each with a
// picture of its own and its actor's headshot.
func tvdbEnsemble(from, to int) string {
	var roles []string
	for i := from; i <= to; i++ {
		roles = append(roles, fmt.Sprintf(`{"name":"Role %02d","personName":"Actor %02d","peopleType":"Actor","peopleId":%d,`+
			`"personImgURL":"https://artworks.thetvdb.com/head%02d.jpg","image":"https://artworks.thetvdb.com/role%02d.jpg"}`,
			i, i, 1000+i, i, i))
	}
	return `{"data":{"id":297763,"name":"The Ensemble","year":"2016","characters":[` + strings.Join(roles, ",") + `]}}`
}

// TWENTY ROLES AND TWENTY NAMES A PASS, whatever the work has. A supplier sends
// at most twenty roles, but a work can hold more: a role the reader corrected is
// kept when the supplier later lists a different cast. So the film here has
// twenty-one roles with a picture to fetch — the twenty TheTVDB lists now and one
// the reader renamed from the cast it listed before — and the page sends
// twenty-one actors' names. One opening fetches twenty of each.
func TestAPicturePassTakesTwentyRolesAndTwentyNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := filmWithTVDBID(t, alice, "The Ensemble", 297763)
	path := "/movies/" + itoa(film)
	stub, client, done := newTVDBCastStub(t, tvdbEnsemble(1, 20))
	t.Cleanup(done)
	srv.TVDB = client
	alice.mustDo("POST", path+"/cast/tvdb", nil, http.StatusOK)
	for _, row := range castOf(t, alice, path+"/cast").Cast {
		if row.Character == "Role 01" {
			alice.mustDo("PUT", "/cast/"+itoa(row.ID), map[string]any{"character": "Role One", "actor": "Actor 01"}, http.StatusOK)
		}
	}
	stub.body = tvdbEnsemble(21, 40)
	alice.mustDo("POST", path+"/cast/tvdb", nil, http.StatusOK)
	pending, names := 0, []string{}
	for _, row := range castOf(t, alice, path+"/cast").Cast {
		if row.CharacterImageURL != "" && row.CharacterImagePath == "" {
			pending++
			names = append(names, row.Actor)
		}
	}
	if pending != 21 {
		t.Fatalf("the film has %d roles with a picture to fetch, want 21: %v", pending, names)
	}
	d := countDownloads(srv)

	got := decode[castArtAnswer](t, askCastArt(alice, path, names...))
	if got != (castArtAnswer{CharacterImages: 20, Portraits: 20}) || len(d.list()) != 40 {
		t.Fatalf("one opening of a film with 21 of each: %+v, %d downloads; want 20 pictures, 20 headshots", got, len(d.list()))
	}
}

// A PICTURE THAT WILL NOT DOWNLOAD IS IN THE LOG WHERE ITS ROW SAYS. The image
// host refuses both of the film's pictures — Amanda Waller's and Viola Davis's
// headshot. The page draws without them, and an admin looking for why finds a
// line for each under TIP-COVER-001, naming the address it asked for.
func TestAPictureThatWillNotDownloadIsLoggedUnderItsCode(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "", errors.New("the image host answered 503")
	}

	if got := decode[castArtAnswer](t, askCastArt(alice, "/movies/"+itoa(film), "Viola Davis")); got != (castArtAnswer{}) {
		t.Fatalf("a film whose pictures will not download: %+v, want nothing arrived", got)
	}
	for _, addr := range []string{"artworks.thetvdb.com/waller.jpg", "artworks.thetvdb.com/head412.jpg"} {
		page := alice.logs(url.Values{"q": {addr}})
		found := false
		for _, l := range page.Lines {
			found = found || (l.Code == "TIP-COVER-001" && l.Level == "error")
		}
		if !found {
			t.Errorf("no TIP-COVER-001 error names %s: %+v", addr, page.Lines)
		}
	}
}

func TestAPicturePassThatHasSpentItsTimeAnswersWithWhatArrived(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	was := castArtBudget
	castArtBudget = 50 * time.Millisecond
	t.Cleanup(func() { castArtBudget = was })
	d := countDownloads(srv)
	slow := srv.fetchImage
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		time.Sleep(100 * time.Millisecond) // a supplier slower than the budget
		return slow(ctx, rawURL, dir)
	}

	got := decode[castArtAnswer](t, askCastArt(alice, "/movies/"+itoa(film), "Viola Davis", "Margot Robbie"))
	if got != (castArtAnswer{CharacterImages: 1}) || len(d.list()) != 1 {
		t.Fatalf("a pass past its budget: %+v, downloads %v; want the one picture it started and nothing after", got, d.list())
	}
}

func TestAPicturePassSlowerThanTheWriteDeadlineStillAnswers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	d := countDownloads(srv)
	slow := srv.fetchImage
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		time.Sleep(300 * time.Millisecond)
		return slow(ctx, rawURL, dir)
	}
	ts := httptest.NewUnstartedServer(h)
	ts.Config.WriteTimeout = 200 * time.Millisecond
	ts.Start()
	defer ts.Close()

	req, err := http.NewRequest("POST", ts.URL+apiPath("/movies/"+itoa(film)+"/cast/art"),
		strings.NewReader(`{"names":["Viola Davis"]}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(alice.cookie)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("a pass slower than the write deadline lost its answer: %v", err)
	}
	defer res.Body.Close()
	var got castArtAnswer
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("a pass slower than the write deadline: %d, %v", res.StatusCode, err)
	}
	if got != (castArtAnswer{1, 1}) || len(d.list()) != 2 {
		t.Fatalf("the slow pass: %+v, downloads %v", got, d.list())
	}
}
