package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
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
// for finished; and a pass slower than the server's write deadline still gets
// its answer to the page.

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
