package jobs_test

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"tippani/internal/jobs"
)

// A REQUEST'S JOB: RECORDED WHEN IT LOOKED OUTWARD, AND ONLY THEN.
//
// WHAT IT KNOWS, declared: the package's exported API, standing in for the two
// callers that do not exist yet (the request logger that makes a *Lazy per request
// and finishes it, and the outbound hook that logs into it), and the jobs and
// job_logs tables it reads back — the endpoints that would show them are a later
// stage. The route table is the test's own stand-in for httpapi's.
//
// What each one guards, in a sentence a person would say: a lookup that went out
// is kept as a job with every line it made, a request that looked nowhere leaves
// no job, nothing is written until the request ends, an import is kept even with
// nothing to say, a route nobody named is kept under its pattern, a request that
// talks too much keeps its first five hundred lines and says how many more there
// were, and a line logged after its request ended is not lost.

func kinds(pattern string) string {
	return map[string]string{
		"POST /books/lookup":  "lookup.book",
		"POST /images/search": "lookup.images",
	}[pattern]
}

func TestALookupThatWentOutIsKeptAsAJobWithItsLines(t *testing.T) {
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (4, 'mitra', 'x')`)
	lb := attached(t, st)

	l := jobs.NewLazy(lb, kinds)
	ctx := jobs.WithRecorder(context.Background(), l)
	l.Viewer(4, "mitra", st.Generation())
	l.Route("POST /books/lookup")
	jobs.From(ctx).Subject("  The Left Hand of Darkness\n")
	jobs.From(ctx).Log(jobs.LevelInfo, "GET openlibrary.org/search.json?title=%s → %d", "The+Left+Hand", 200)
	jobs.From(ctx).Log(jobs.LevelWarn, "GET https://www.googleapis.com/books/v1/volumes?key=%s → 429", "SECRET")

	// Nothing is written while the request runs.
	flush(t, lb)
	if n := count(t, st.DB, `SELECT count(*) FROM jobs`) + count(t, st.DB, `SELECT count(*) FROM job_logs`); n != 0 {
		t.Fatalf("%d row(s) written before the request ended", n)
	}

	l.Finish(200)
	l.Finish(200) // the second does nothing
	flush(t, lb)

	var uid sql.NullInt64
	var kind, subject, state, errText string
	var queued int
	if err := st.DB.QueryRow(`SELECT user_id, kind, subject, state, error, queued FROM jobs`).
		Scan(&uid, &kind, &subject, &state, &errText, &queued); err != nil {
		t.Fatal(err)
	}
	if uid.Int64 != 4 || kind != "lookup.book" || subject != "The Left Hand of Darkness⏎" || state != "succeeded" || errText != "" || queued != 0 {
		t.Fatalf("row: user %v kind %q subject %q state %q error %q queued %d", uid, kind, subject, state, errText, queued)
	}
	got := strings1(t, st.DB, `SELECT level || ' ' || line FROM job_logs ORDER BY id`)
	want := []string{
		"info GET openlibrary.org/search.json?title=The+Left+Hand → 200",
		"warn GET https://www.googleapis.com/books/v1/volumes?key=… → 429",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("lines:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	if n := count(t, st.DB, `SELECT count(*) FROM jobs`); n != 1 {
		t.Fatalf("%d jobs after finishing twice, want 1", n)
	}
}

func TestARequestThatLookedNowhereLeavesNoJob(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)
	l := jobs.NewLazy(lb, kinds)
	l.Viewer(1, "aro", st.Generation())
	l.Route("POST /books/lookup")
	l.Subject("Dune") // a subject alone is not a job: the answer came from nowhere
	l.Finish(200)
	flush(t, lb)
	if n := count(t, st.DB, `SELECT count(*) FROM jobs`); n != 0 {
		t.Fatalf("a request that logged nothing left %d job(s)", n)
	}
}

// A restore is the example because it is a route that calls Begin: an import did
// until 3.1.0, when it became a queued job.
func TestBeginKeepsARestoreEvenWithNothingToSay(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)

	l := jobs.NewLazy(lb, kinds)
	ctx := jobs.WithRecorder(context.Background(), l)
	l.Route("POST /admin/restore/upload")
	jobs.Begin(ctx, "restore", "tippanibackup.tpbk")
	l.Finish(422)

	// A route no table names, which logged: kept under its pattern.
	u := jobs.NewLazy(lb, kinds)
	u.Route("POST /people/{id}/wander")
	u.Log(jobs.LevelInfo, "GET somewhere → 200")
	u.Finish(200)

	// Begin with no request job in the context does nothing and does not panic.
	jobs.Begin(context.Background(), "restore", "ignored")
	flush(t, lb)

	got := strings1(t, st.DB, `SELECT kind || '|' || subject || '|' || state || '|' || error || '|' || coalesce(user_id, 'NULL') FROM jobs ORDER BY id`)
	want := []string{"restore|tippanibackup.tpbk|failed|HTTP 422|NULL", "request|POST /people/{id}/wander|succeeded||NULL"}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("rows:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

func TestARequestThatTalksTooMuchKeepsItsFirstFiveHundredLines(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)
	l := jobs.NewLazy(lb, kinds)
	l.Route("POST /images/search")
	for i := range 620 {
		l.Log(jobs.LevelInfo, "line %d", i)
	}
	l.Finish(200)
	flush(t, lb)

	got := strings1(t, st.DB, `SELECT line FROM job_logs ORDER BY id`)
	if len(got) != 501 || got[0] != "line 0" || got[499] != "line 499" || got[500] != "120 more lines were not kept" {
		t.Fatalf("%d lines kept, first %q, last two %q", len(got), got[0], got[len(got)-2:])
	}
}

func TestALineLoggedAfterItsRequestEndedIsNotLost(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)
	l := jobs.NewLazy(lb, kinds)
	l.Route("POST /books/lookup")
	l.Log(jobs.LevelInfo, "during")
	l.Finish(200)
	l.Log(jobs.LevelWarn, "after: GET %s → error", "https://x.test/?token=abc")
	flush(t, lb)
	if got := strings1(t, st.DB, `SELECT level || ' ' || line FROM system_logs`); len(got) != 1 || got[0] != "warn after: GET https://x.test/?token=… → error" {
		t.Fatalf("system log: %q", got)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM job_logs`); n != 1 {
		t.Fatalf("the job has %d lines, want the 1 from during the request", n)
	}
}

func TestAContextCarriesItsRecorderAndNeverATypedNil(t *testing.T) {
	bare := context.Background()
	if jobs.From(bare) != nil {
		t.Fatal("a bare context carries a recorder")
	}
	var nilLazy *jobs.Lazy
	if r := jobs.From(jobs.WithRecorder(bare, nilLazy)); r != nil {
		t.Fatalf("a nil *Lazy came back as a non-nil recorder %v", r)
	}
	if r := jobs.From(jobs.WithRecorder(bare, nil)); r != nil {
		t.Fatalf("a nil recorder came back as %v", r)
	}
	l := jobs.NewLazy(nil, nil) // no logbook: logs into nothing, and does not panic
	r := jobs.From(jobs.WithRecorder(bare, l))
	if r != jobs.Recorder(l) {
		t.Fatal("the recorder put in is not the one that comes out")
	}
	r.Log(jobs.LevelInfo, "%s", "fine")
	l.Finish(500)
}
