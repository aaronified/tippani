package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// THE PEOPLE CONSOLE'S FETCH MISSING, AS A JOB: started as the console starts it
// (POST /jobs {kind: "people", ids}), watched as Settings › Jobs watches it, and
// each record read back as its panel reads it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it (queueing, jobs_api_test.go); the
// suppliers are the server's seams — Open Library's author resolution
// (srv.resolveAuthor) and the portrait download (srv.fetchImage, through
// downloads) — because a test may not reach the real ones, and one test holds
// the resolution until its request is cancelled, so that Stop is pressed with a
// record in hand; and
// the job's wire fields and its counts' names, which the People screen's flash
// reads (jobs.js's jobOutcome: ok, failed, first_error).
//
// What each one guards, in a sentence a person would say: a people fetch fetches
// each record, says in its log what it found or why it failed, and counts the
// fetched and the failed with the reason the first one failed, in the words the
// row's own Fetch would have said, under the names the screen reads; another
// reader's record is not fetched; and Stop ends it at once, leaving the record in
// hand untouched.

// recordID is a person's record id as the People console lists it.
func recordID(t *testing.T, c *testClient, name string) int64 {
	t.Helper()
	for _, p := range decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
		if p.Name == name {
			return p.ID
		}
	}
	t.Fatalf("no record named %q in the People console", name)
	return 0
}

// leGuinResolves makes Open Library know one author and fail on everybody else.
func leGuinResolves(srv *Server) {
	srv.resolveAuthor = func(_ context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		if name != "Ursula K. Le Guin" {
			return metadata.AuthorResolution{}, errors.New("open library: status 503")
		}
		return metadata.AuthorResolution{
			Key: "OL2A", Name: name, Bio: "An American author.",
			ImageURL: "https://covers.openlibrary.org/a/id/2-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/OL2A"},
		}, nil
	}
}

func TestAPeopleJobFetchesEachRecordAndSaysWhyTheFirstOneFailed(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	leGuinResolves(srv)
	downloads(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	for _, name := range []string{"Ursula K. Le Guin", "Nobody Known"} {
		alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	bob.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Bob's author"}, http.StatusOK)
	leGuin, nobody, bobs := recordID(t, alice, "Ursula K. Le Guin"), recordID(t, alice, "Nobody Known"), recordID(t, bob, "Bob's author")

	job := alice.waitJob(alice.mustStart("people", map[string]any{"ids": []int64{leGuin, nobody, bobs}}).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the fetch's progress: %d of %d", job.Done, job.Total)
	}
	// The reason is the one the row's Fetch shows for a lookup that failed, and
	// it is the first failure's: bob's record, which is not alice's, came after.
	countsAre(t, job, map[string]any{"ok": float64(1), "failed": float64(2), "first_error": errPortraitLookup})

	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Ursula K. Le Guin» — found portrait, identity (openlibrary), bio, links",
		"warn «Nobody Known» — failed: " + errPortraitLookup,
		fmt.Sprintf("warn person #%d — failed: not found", bobs),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the fetch's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's author") {
		t.Errorf("alice's fetch names bob's record:\n%s", log)
	}

	got := decode[struct {
		Bio       string `json:"bio"`
		ImagePath string `json:"image_path"`
		Links     string `json:"links"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(leGuin), nil, http.StatusOK))
	if got.Bio != "An American author." || got.ImagePath == "" || got.Links != "https://openlibrary.org/authors/OL2A" {
		t.Fatalf("Le Guin after the fetch: %+v", got)
	}
	if b := decode[struct {
		Source string `json:"source"`
	}](t, bob.mustDo("GET", "/people/id/"+itoa(bobs), nil, http.StatusOK)); b.Source != "" {
		t.Fatalf("bob's record was fetched by alice's job: %+v", b)
	}
}

// A Stop pressed while the second record is being resolved ends the fetch there:
// the first record keeps what was fetched for it, and the second is left as it
// was, counted neither fetched nor failed.
func TestAPeopleJobStoppedWithARecordInHandLeavesThatRecordUntouched(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	leGuinResolves(srv)
	resolve := srv.resolveAuthor
	asked := make(chan struct{}, 1)
	srv.resolveAuthor = func(ctx context.Context, name string, titles []string) (metadata.AuthorResolution, error) {
		if name == "Second" {
			asked <- struct{}{}
			<-ctx.Done() // the second record's resolution never answers
			return metadata.AuthorResolution{}, ctx.Err()
		}
		return resolve(ctx, "Ursula K. Le Guin", titles)
	}
	downloads(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	for _, name := range []string{"First", "Second"} {
		alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	first, second := recordID(t, alice, "First"), recordID(t, alice, "Second")

	job := alice.mustStart("people", map[string]any{"ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fetch never asked Open Library about the second record")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d records, want the one fetched before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"ok": float64(1), "failed": float64(0), "first_error": ""})
	bio := func(id int64) string {
		return decode[struct {
			Bio string `json:"bio"`
		}](t, alice.mustDo("GET", "/people/id/"+itoa(id), nil, http.StatusOK)).Bio
	}
	if bio(first) == "" || bio(second) != "" {
		t.Fatalf("after the stop: the first record's bio %q, the second's %q; want the first fetched and the second untouched",
			bio(first), bio(second))
	}
}
