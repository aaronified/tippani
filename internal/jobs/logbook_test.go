package jobs_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"tippani/internal/jobs"
	"tippani/internal/outbound"
)

// THE LOGBOOK, THROUGH WHAT IT PROMISES.
//
// WHAT IT KNOWS, declared: the package's exported API, and the three tables it
// writes (0079's jobs, job_logs and system_logs), which these tests read back and
// sometimes seed. Nothing observable over HTTP could serve yet: the endpoints that
// read the logs are a later stage of 3.1.0, and the tables are what the logbook
// promises to fill. Standing in for a restore, a recovery or a factory reset, it
// calls the store's Swap and, once, moves another database file into its place.
// The bounds are the real ones (8 MB, 16384 lines); the one test that needs
// smaller numbers is in seams_test.go and says so. One test sets TIPPANI_LOG_HOLD
// (LogHoldEnv), the logbook's declared test seam, to prove it holds only offline
// and only until Close.
//
// What each one guards, in a sentence a person would say: the lines from before
// the database opened are still in the log; a key in a provider's error never
// reaches the log, and neither does a forged line break or a terminal escape; a
// line for a job that is gone never costs anybody else their lines, and a line
// for a job in a file swapped out never lands on the job with its id in the file
// swapped in; an in-request job lands with its lines, and with no owner when the
// database was swapped under it or its reader's account was deleted before it
// landed; when the log falls behind, request lines go first and a job's lines
// last, and the log says how many went; no line is ever left waiting with nothing
// to write it; thirty days on, old lines and finished jobs go and a job still
// waiting does not; and the test seam that holds every line for shutdown's last
// flush never holds a server that can reach the internet.

func TestLinesFromBeforeTheDatabaseOpenedAreKept(t *testing.T) {
	lb := jobs.NewLogbook()
	lb.System(jobs.LevelInfo, "", "tippani 3.1.0 starting")
	lb.System(jobs.LevelWarn, "TIP-STORE-007", "a one-time pass failed")
	lb.JobLine(7, jobs.LevelInfo, "a job's line from before the store was attached")

	st := openStore(t)
	exec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (7, 'fill', 'running', ?)`, time.Now().UnixMilli())
	// The store has swapped its files once before the logbook is attached, as
	// a boot-time recovery does: the job's line still belongs to this file.
	if err := st.Swap(func() error { return nil }, nil, nil); err != nil {
		t.Fatal(err)
	}
	lb.Attach(st)
	t.Cleanup(func() { closeLogbook(lb) })
	flush(t, lb)

	got := strings1(t, st.DB, `SELECT level || '|' || code || '|' || line FROM system_logs ORDER BY id`)
	want := []string{"info||tippani 3.1.0 starting", "warn|TIP-STORE-007|a one-time pass failed"}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("system log after Attach:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	if got := strings1(t, st.DB, `SELECT line FROM job_logs WHERE job_id = 7`); len(got) != 1 {
		t.Fatalf("the job's line from before Attach: %q", got)
	}
}

func TestEveryLinePassesTheOneDoor(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)

	// A provider's error: a key in a URL, a line break, colour codes, a bell, an
	// OSC title escape, a C1 control, and a byte that is not UTF-8.
	lb.System(jobs.LevelError, "", "lookup failed:\r\nGet \"https://www.googleapis.com/books/v1/volumes?q=dune&key=AIzaSECRET\": "+
		"\x1b[31mrefused\x1b[0m\x07 \x1b]0;pwned\x07done\u0085 \xff end\tok")
	// A request line longer than its ceiling, and an error longer than its own.
	lb.System(jobs.LevelRequest, "", "GET /api/books?q="+strings.Repeat("a", 5000))
	lb.System(jobs.LevelError, "", strings.Repeat("é", 6000)) // 12000 bytes, two per character
	// A request line exactly at its ceiling whose last value is a two-byte key:
	// hidden, it is a byte longer, and still inside the ceiling.
	atCap := "GET https://a.test/?q="
	atCap += strings.Repeat("b", 2048-len(atCap)-len("&key=ab")) + "&key=ab"
	lb.System(jobs.LevelRequest, "", atCap)
	// A level and a code nobody knows.
	lb.System("shouting", "not-a-code", "kept anyway")
	// An in-request job whose subject is far too long and holds a key.
	lb.InRequest(jobs.Row{
		Kind: "lookup.book", State: jobs.StateFailed, Error: "Get \"https://api.themoviedb.org/3/x?api_key=K\": 401",
		Subject: "https://a.test/?token=T " + strings.Repeat("x", 300), Created: time.Now(), Finished: time.Now(),
	}, []jobs.Line{{At: time.Now(), Level: jobs.LevelInfo, Text: "GET https://api.themoviedb.org/3/x?api_key=K → 401\nnext"}})
	flush(t, lb)

	lines := strings1(t, st.DB, `SELECT line FROM system_logs ORDER BY id`)
	if len(lines) != 5 {
		t.Fatalf("%d system lines, want 5: %q", len(lines), lines)
	}
	if want := "lookup failed:⏎Get \"https://www.googleapis.com/books/v1/volumes?q=dune&key=…\": refused done � end\tok"; lines[0] != want {
		t.Errorf("the provider's error was kept as\n%q\nwant\n%q", lines[0], want)
	}
	for i, c := range []struct{ limit, orig int }{{2 << 10, len("GET /api/books?q=") + 5000}, {8 << 10, 12000}} {
		l := lines[i+1]
		if len(l) > c.limit {
			t.Errorf("line %d is %d bytes, over its %d ceiling", i+1, len(l), c.limit)
		}
		cut := strings.LastIndex(l, "… ")
		if cut < 0 || !strings.HasSuffix(l, " bytes cut") {
			t.Fatalf("line %d does not end saying what was cut: …%q", i+1, l[max(0, len(l)-40):])
		}
		n, _ := strconv.Atoi(strings.TrimSuffix(l[cut+len("… "):], " bytes cut"))
		if cut+n != c.orig {
			t.Errorf("line %d kept %d bytes and says %d were cut, of %d", i+1, cut, n, c.orig)
		}
		if !utf8.ValidString(l) {
			t.Errorf("line %d was cut inside a character", i+1)
		}
	}
	if l := lines[3]; len(l) > 2<<10 || strings.Contains(l, "key=ab") {
		t.Errorf("a request line at its ceiling with a key in it was kept as %d bytes ending %q", len(l), l[len(l)-30:])
	}
	var lvl, code string
	if err := st.DB.QueryRow(`SELECT level, code FROM system_logs WHERE line = 'kept anyway'`).Scan(&lvl, &code); err != nil {
		t.Fatal(err)
	}
	if lvl != jobs.LevelInfo || code != "" {
		t.Errorf("an unknown level and a malformed code were kept as %q / %q, want info and none", lvl, code)
	}

	var subject, errText string
	if err := st.DB.QueryRow(`SELECT subject, error FROM jobs`).Scan(&subject, &errText); err != nil {
		t.Fatal(err)
	}
	if utf8.RuneCountInString(subject) != 200 || !strings.HasSuffix(subject, "…") || strings.Contains(subject, "=T") {
		t.Errorf("subject kept as %d characters: %q", utf8.RuneCountInString(subject), subject)
	}
	if strings.Contains(errText, "api_key=K") {
		t.Errorf("the job's error kept the key: %q", errText)
	}
	if got := strings1(t, st.DB, `SELECT line FROM job_logs`); len(got) != 1 || got[0] != "GET https://api.themoviedb.org/3/x?api_key=… → 401⏎next" {
		t.Errorf("the in-request job's line was kept as %q", got)
	}
}

func TestALineForAJobThatIsGoneNeverCostsAnybodyTheirs(t *testing.T) {
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (7, 'fill', 'running', 1)`)
	lb := attached(t, st)
	lb.JobLine(7, jobs.LevelInfo, "«Dune» — filled year")
	lb.JobLine(9999, jobs.LevelInfo, "for a job this file never held")
	lb.System(jobs.LevelInfo, "", "and a system line in the same batch")
	lb.JobLine(7, "request", "a job line at a system level")
	flush(t, lb)

	if got := strings1(t, st.DB, `SELECT level || ' ' || line FROM job_logs WHERE job_id = 7 ORDER BY id`); strings.Join(got, "|") != "info «Dune» — filled year|info a job line at a system level" {
		t.Fatalf("job 7's lines: %q", got)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM job_logs WHERE job_id = 9999`); n != 0 {
		t.Fatalf("%d line(s) written for a job that does not exist", n)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs`); n != 1 {
		t.Fatalf("the batch with the orphan line lost the system line: %d kept", n)
	}
}

// A factory reset or a restore swaps the database file under the logbook. A job's
// line logged while the files move is for the job with that id in the old file;
// in the new one, whose ids start again, the same id is somebody else's job, and
// the line must not land there. A line logged after the swap is for the new one.
func TestALineForAJobInTheFileBeforeASwapNeverLandsOnAnotherJob(t *testing.T) {
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (1, 'fill', 'running', ?)`, time.Now().UnixMilli())
	// The file that takes its place, where job 1 is another reader's lookup.
	fresh := openStore(t)
	exec(t, fresh.DB, `INSERT INTO jobs (id, kind, queued, state, created_at) VALUES (1, 'lookup.book', 0, 'succeeded', ?)`, time.Now().UnixMilli())
	freshPath := fresh.Path()
	if err := fresh.Close(); err != nil {
		t.Fatal(err)
	}
	lb := attached(t, st)

	if err := st.Swap(func() error {
		lb.JobLine(1, jobs.LevelInfo, "for the old job 1, logged as the files moved")
		for _, sidecar := range []string{"-wal", "-shm"} {
			os.Remove(st.Path() + sidecar)
		}
		return os.Rename(freshPath, st.Path())
	}, nil, nil); err != nil {
		t.Fatal(err)
	}
	lb.JobLine(1, jobs.LevelInfo, "for the new job 1")
	flush(t, lb)

	if got := strings1(t, st.DB, `SELECT line FROM job_logs WHERE job_id = 1 ORDER BY id`); strings.Join(got, "|") != "for the new job 1" {
		t.Fatalf("job 1 of the new file has %q, want only its own line", got)
	}
}

func TestAnInRequestJobLandsWithItsLinesAndNoOwnerOnceItsIdMayBeSomebodyElses(t *testing.T) {
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (3, 'aro', 'x')`)
	lb := attached(t, st)

	start := time.Now().Add(-2 * time.Second)
	end := time.Now()
	row := jobs.Row{UserID: 3, Username: "aro", Gen: st.Generation(), Kind: "lookup.book",
		Subject: "Dune", State: jobs.StateSucceeded, Created: start, Finished: end}
	lb.InRequest(row, []jobs.Line{
		{At: start, Level: jobs.LevelInfo, Text: "GET openlibrary.org/search.json?title=Dune → 200"},
		{At: end, Level: jobs.LevelWarn, Text: "GET www.googleapis.com/books/v1/volumes → 429"},
	})
	flush(t, lb)

	var uid sql.NullInt64
	var queued int
	var state, username, kind string
	var created, started, finished int64
	if err := st.DB.QueryRow(`SELECT user_id, username, kind, queued, state, created_at, started_at, finished_at FROM jobs`).
		Scan(&uid, &username, &kind, &queued, &state, &created, &started, &finished); err != nil {
		t.Fatal(err)
	}
	if !uid.Valid || uid.Int64 != 3 || username != "aro" || kind != "lookup.book" || queued != 0 || state != "succeeded" {
		t.Fatalf("row: user %v %q kind %q queued %d state %q", uid, username, kind, queued, state)
	}
	if created != start.UnixMilli() || started != start.UnixMilli() || finished != end.UnixMilli() {
		t.Fatalf("times: created %d started %d finished %d, want %d %d %d", created, started, finished,
			start.UnixMilli(), start.UnixMilli(), end.UnixMilli())
	}
	if got := strings1(t, st.DB, `SELECT level FROM job_logs ORDER BY id`); strings.Join(got, ",") != "info,warn" {
		t.Fatalf("its lines, in order: %q", got)
	}

	// The same request again, its user read before the store swapped files (a
	// restore, a recovery): in the file it lands in, id 3 may be somebody else.
	stale := row
	stale.Gen = st.Generation()
	if err := st.Swap(func() error { return nil }, nil, nil); err != nil {
		t.Fatal(err)
	}
	lb.InRequest(stale, nil)
	// And a request with no account at all, which failed.
	lb.InRequest(jobs.Row{Kind: "", Subject: "POST /auth/restore/upload", State: "weird",
		Error: "HTTP 500", Created: end, Finished: end}, nil)
	flush(t, lb)

	// Read BEFORE any account is deleted, while id 3 is still aro in this file:
	// after a delete, 0079's trigger clears every row of the account, and a stale
	// row that had landed as aro's would read ownerless too.
	rows := `SELECT coalesce(user_id, 'NULL') || ' ' || kind || ' ' || state || ' ' || error FROM jobs ORDER BY id`
	got := strings1(t, st.DB, rows)
	want := []string{"3 lookup.book succeeded ", "NULL lookup.book succeeded ", "NULL request failed HTTP 500"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("rows after a swap:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}

	// A request whose reader's account was deleted before its row landed, in the
	// same file, and whose id was then given to somebody new.
	gone := row
	gone.Gen = st.Generation()
	exec(t, st.DB, `DELETE FROM users WHERE id = 3`)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (3, 'newcomer', 'x')`)
	lb.InRequest(gone, nil)
	flush(t, lb)

	got = strings1(t, st.DB, rows)
	// The first row, owned when it landed, lost its owner to 0079's trigger at
	// the delete, as every row of a deleted account does.
	want = []string{"NULL lookup.book succeeded ", "NULL lookup.book succeeded ", "NULL request failed HTTP 500", "NULL lookup.book succeeded "}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("rows after the delete:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

// THE DROP ORDER, AT THE REAL BOUND OF 16384 LINES. Everything is logged before
// Attach, so no drainer takes anything out mid-way and every drop is decided by
// the rule alone.
func TestWhenTheLogFallsBehindRequestLinesGoFirstAndJobLinesLast(t *testing.T) {
	const bound = 16384

	// First, a full buffer of request lines with a few info lines among them:
	// a warning pushes out a request line, not an info line, and a request
	// line with nothing below it is the one that goes.
	mixed := jobs.NewLogbook()
	for i := range bound - 3 {
		mixed.System(jobs.LevelRequest, "", fmt.Sprintf("req %d", i))
	}
	for i := range 3 {
		mixed.System(jobs.LevelInfo, "", fmt.Sprintf("info %d", i))
	}
	for i := range 3 {
		mixed.System(jobs.LevelWarn, "", fmt.Sprintf("warn %d", i))
	}
	mixed.System(jobs.LevelTrace, "", "trace 0")
	st0 := openStore(t)
	mixed.Attach(st0)
	t.Cleanup(func() { closeLogbook(mixed) })
	flush(t, mixed)
	byLevel := strings1(t, st0.DB, `SELECT level || ' ' || count(*) FROM system_logs WHERE code = '' GROUP BY level ORDER BY level`)
	if want := fmt.Sprintf("info 3|request %d|warn 3", bound-6); strings.Join(byLevel, "|") != want {
		t.Fatalf("kept by level: %q, want %q", strings.Join(byLevel, "|"), want)
	}
	if first := strings1(t, st0.DB, `SELECT line FROM system_logs WHERE level = 'request' ORDER BY id LIMIT 1`); first[0] != "req 3" {
		t.Fatalf("the oldest request line kept is %q: the three oldest should have gone", first[0])
	}

	// Then the whole order, down to a buffer of nothing but a job's lines.
	lb := jobs.NewLogbook()
	sys := func(level, format string, n int) {
		for i := range n {
			lb.System(level, "", fmt.Sprintf(format, i))
		}
	}
	job := 0
	jobLines := func(n int) {
		for range n {
			lb.JobLine(1, jobs.LevelInfo, fmt.Sprintf("job %d", job))
			job++
		}
	}
	sys(jobs.LevelRequest, "req %d", bound)  // full
	sys(jobs.LevelInfo, "info-a %d", 3)      // push out req 0-2
	sys(jobs.LevelWarn, "warn %d", 3)        // push out req 3-5
	sys(jobs.LevelRequest, "late-req %d", 3) // nothing lower to push out: dropped
	sys(jobs.LevelInfo, "info-b %d", 3)      // push out req 6-8
	jobLines(bound - 9)                      // push out every request left
	jobLines(2)                              // push out info-a 0-1
	sys(jobs.LevelAsset, "asset %d", 1)      // dropped
	sys(jobs.LevelInfo, "info-c %d", 1)      // nothing lower left: dropped
	jobLines(5)                              // push out info-a 2, info-b 0-2; the fifth is dropped

	st := openStore(t)
	exec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (1, 'fill', 'running', 1)`)
	lb.Attach(st)
	t.Cleanup(func() { closeLogbook(lb) })
	flush(t, lb)

	kept := strings1(t, st.DB, `SELECT level || ' ' || code || ' ' || line FROM system_logs ORDER BY id`)
	// Pushed-out and dropped lines: all bound requests, 3 late, 1 asset, 3+3 info,
	// 1 info-c, 1 job line.
	dropped := bound + 3 + 1 + 6 + 1 + 1
	want := []string{
		fmt.Sprintf("warn TIP-LOG-003 %d log lines were not kept (the log was writing slower than lines arrived)", dropped),
		"warn  warn 0", "warn  warn 1", "warn  warn 2",
	}
	if strings.Join(kept, "\n") != strings.Join(want, "\n") {
		t.Fatalf("system lines kept:\n%s\nwant:\n%s", strings.Join(kept, "\n"), strings.Join(want, "\n"))
	}
	if n, want := count(t, st.DB, `SELECT count(*) FROM job_logs`), bound-9+2+4; n != want {
		t.Fatalf("%d job lines kept, want %d", n, want)
	}
	last := strings1(t, st.DB, `SELECT line FROM job_logs ORDER BY id DESC LIMIT 1`)
	if want := fmt.Sprintf("job %d", job-2); last[0] != want {
		t.Fatalf("the newest job line kept is %q, want %q (the one after it had no room)", last[0], want)
	}
}

// THE OTHER BOUND, BYTES. Errors of a full 8 KB each fill 8 MB long before 16384
// lines, and nothing is lower than an error, so the newcomers go.
func TestTheLogIsBoundedByBytesAsWellAsLines(t *testing.T) {
	lb := jobs.NewLogbook()
	const sent = 1100
	for i := range sent {
		lb.System(jobs.LevelError, "", fmt.Sprintf("%04d ", i)+strings.Repeat("x", 9000))
	}
	st := openStore(t)
	lb.Attach(st)
	t.Cleanup(func() { closeLogbook(lb) })
	flush(t, lb)

	kept := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE code = ''`)
	if kept*(8<<10) > 8<<20 || kept < 900 {
		t.Fatalf("%d 8 KB lines kept of %d; an 8 MB bound keeps a little under 1024", kept, sent)
	}
	if first := strings1(t, st.DB, `SELECT substr(line, 1, 4) FROM system_logs WHERE code = '' ORDER BY id LIMIT 1`); first[0] != "0000" {
		t.Fatalf("the first line kept is %q: the oldest errors should be the ones kept", first[0])
	}
	note := strings1(t, st.DB, `SELECT line FROM system_logs WHERE code = 'TIP-LOG-003'`)
	if want := fmt.Sprintf("%d log lines were not kept", sent-kept); len(note) != 1 || !strings.HasPrefix(note[0], want) {
		t.Fatalf("the note: %q, want it to start %q", note, want)
	}
}

// THE LOST WAKEUP. The drainer exits when it finds nothing to write, and a line
// logged in that same instant must start another rather than wait for the next
// line to come along. Thousands of exits, from one logger waiting each time and
// from eight racing, and every line lands.
func TestNoLineIsLeftWaitingWithNothingToWriteIt(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)

	for i := range 300 {
		lb.System(jobs.LevelInfo, "", "one at a time "+strconv.Itoa(i))
		flush(t, lb) // the drainer is idle or gone after this, every time
	}

	var wg sync.WaitGroup
	for g := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range 400 {
				lb.System(jobs.LevelInfo, "", fmt.Sprintf("racer %d line %d", g, i))
				if i%7 == 0 {
					time.Sleep(time.Duration(i%3) * 100 * time.Microsecond)
				}
			}
		}()
	}
	wg.Wait()
	flush(t, lb)
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs`); n != 300+8*400 {
		t.Fatalf("%d lines landed, want %d", n, 300+8*400)
	}
}

// Past the retention, in more than one chunk, with no timer: the first write
// after start prunes, a write within the hour does not, and the Jobs tab opening
// (PruneSoon) does.
func TestThirtyDaysOnOldLinesAndFinishedJobsGoAndAWaitingJobStays(t *testing.T) {
	st := openStore(t)
	day := int64(24 * time.Hour / time.Millisecond)
	now := time.Now().UnixMilli()
	old := now - 31*day
	seed := func(db *sql.DB) {
		tx, err := db.Begin()
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback()
		for i := range 4500 { // more than two chunks of 2000
			if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'request', ?)`, old+int64(i), "old "+strconv.Itoa(i)); err != nil {
				t.Fatal(err)
			}
		}
		for i := range 5 {
			if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', ?)`, now-day, "recent "+strconv.Itoa(i)); err != nil {
				t.Fatal(err)
			}
		}
		for _, j := range []struct {
			id       int
			state    string
			finished any
			lines    int
		}{
			{1, "succeeded", old, 4100}, // old and finished: goes, lines first
			{2, "interrupted", old, 0},  // old, finished, no lines: goes
			{3, "queued", nil, 3},       // started 40 days ago and still waiting: stays
			{4, "running", nil, 2},      // still running: stays
			{5, "failed", now - day, 2}, // finished yesterday: stays
		} {
			if _, err := tx.Exec(`INSERT INTO jobs (id, kind, state, created_at, finished_at) VALUES (?, 'fill', ?, ?, ?)`,
				j.id, j.state, now-40*day, j.finished); err != nil {
				t.Fatal(err)
			}
			for i := range j.lines {
				if _, err := tx.Exec(`INSERT INTO job_logs (job_id, at, level, line) VALUES (?, ?, 'info', ?)`, j.id, old, "l"+strconv.Itoa(i)); err != nil {
					t.Fatal(err)
				}
			}
		}
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
	}
	seed(st.DB)

	lb := attached(t, st)
	lb.System(jobs.LevelInfo, "", "the first line after start")
	flush(t, lb)
	eventually(t, "the first write's prune", func() bool {
		return count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line LIKE 'old %'`) == 0 &&
			count(t, st.DB, `SELECT count(*) FROM jobs WHERE id IN (1, 2)`) == 0
	})
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line LIKE 'recent %' OR line = 'the first line after start'`); n != 6 {
		t.Fatalf("%d of the 6 recent lines survived the prune", n)
	}
	for id, lines := range map[int]int{1: 0, 3: 3, 4: 2, 5: 2} {
		if n := count(t, st.DB, `SELECT count(*) FROM job_logs WHERE job_id = ?`, id); n != lines {
			t.Errorf("job %d has %d lines after the prune, want %d", id, n, lines)
		}
	}
	if got := strings1(t, st.DB, `SELECT group_concat(id) FROM (SELECT id FROM jobs ORDER BY id)`); got[0] != "3,4,5" {
		t.Fatalf("jobs left: %s, want 3,4,5", got[0])
	}

	// Within the hour a write does not prune again...
	exec(t, st.DB, `INSERT INTO system_logs (at, level, line) VALUES (?, 'request', 'old again')`, old)
	lb.System(jobs.LevelInfo, "", "a write within the hour")
	flush(t, lb)
	time.Sleep(300 * time.Millisecond)
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line = 'old again'`); n != 1 {
		t.Fatal("a write within the hour of the last prune pruned again")
	}
	// ...and the tab opening does.
	lb.PruneSoon()
	eventually(t, "PruneSoon's prune", func() bool {
		return count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line = 'old again'`) == 0
	})
}

// A closed logbook keeps nothing more and fails nobody: shutdown closes it
// before the store, so a line logged after that must not find a closed pool.
func TestAClosedLogbookKeepsNothingMoreAndBlocksNobody(t *testing.T) {
	st := openStore(t)
	lb := jobs.NewLogbook()
	lb.Attach(st)
	lb.System(jobs.LevelInfo, "", "before close")
	closeLogbook(lb)
	lb.System(jobs.LevelInfo, "", "after close")
	lb.JobLine(1, jobs.LevelInfo, "after close")
	flush(t, lb) // returns at once: nothing is waiting
	if got := strings1(t, st.DB, `SELECT line FROM system_logs`); strings.Join(got, "|") != "before close" {
		t.Fatalf("system log: %q", got)
	}
}

// THE LOG HOLD KEEPS EVERY LINE FOR THE LAST FLUSH, AND HOLDS ONLY OFFLINE.
// TIPPANI_LOG_HOLD (LogHoldEnv) is the logbook's declared test seam: the serve
// tests set it so that shutdown's order decides whether any line is kept at all.
// What it must never do is leave a server that can reach the internet keeping its
// log in memory.
func TestTheLogHoldKeepsEveryLineForTheLastFlushAndHoldsOnlyOffline(t *testing.T) {
	st := openStore(t)
	t.Setenv(jobs.LogHoldEnv, "1")
	kept := func(line string) int {
		return count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line = ?`, line)
	}

	// Online, the switch is ignored, and a line is written as it always is.
	t.Setenv(outbound.EnvVar, "")
	online := jobs.NewLogbook()
	online.Attach(st)
	online.System(jobs.LevelInfo, "", "written while online")
	flush(t, online)
	closeLogbook(online)
	if kept("written while online") != 1 {
		t.Fatal("online, the hold kept a line back")
	}

	// Offline, nothing is written until Close, and Close writes all of it.
	t.Setenv(outbound.EnvVar, "1")
	held := jobs.NewLogbook()
	held.Attach(st)
	held.System(jobs.LevelInfo, "", "held for the last flush")
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	if err := held.Flush(ctx); err == nil || kept("held for the last flush") != 0 {
		t.Fatalf("a held logbook wrote its line before Close (flush: %v)", err)
	}
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := held.Close(ctx); err != nil || kept("held for the last flush") != 1 {
		t.Fatalf("Close did not write the held line (close: %v)", err)
	}
}
