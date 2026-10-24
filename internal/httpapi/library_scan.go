package httpapi

// Library scan (ADR-0917-A, refines ADR-0907).
//
// POST /sources/scan queues a job of kind "library.scan". The scan walks the whole folder
// and stores its progress in SQLite (migration 0087):
//   - the checkpoint (library_scans.cursor), so a Stop, crash or restart resumes;
//   - the findings (library_scan_findings), written in batches, so the reader can
//     review them while the scan runs and after a restart;
//   - the files seen (library_scan_files), so a later scan only reads new or
//     changed files.
//
// The scan runs in slices so it does not hold the job queue (one job at a time) for hours.
// A slice runs for scanSliceTime or until the walk ends. If the walk is not finished and the
// reader did not press Stop, the slice queues the next one and ends, so jobs queued in the
// meantime run first. Progress for the screen comes from library_scans, not from the job row.
//
// The scan only proposes. It writes nothing under the mount, takes no path from
// the client, and starts only when a reader presses Scan.
//
// Memory stays flat: the walk is streamed, one batch of files is held at a time,
// and each EPUB is opened, read and closed before the next.
//
// Tokens are signed when findings are read, from the stored relative path, with the
// per-process key. They do not survive a restart, and a forged one attaches nothing.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/mount"
	"tippani/internal/olog"
)

// libraryScanKind is the queue's kind for a scan.
const libraryScanKind = "library.scan"

const (
	// scanBatch is how many files are judged before findings and checkpoint are
	// committed together. A crash loses at most this many files of work.
	scanBatch = 50
	// scanPause is a short wait after reading an EPUB, to go easy on the disk.
	// Subtitles are judged by path alone and do not pause.
	scanPause = 5 * time.Millisecond
	// scanLogEvery is how many files pass between progress lines in the job log.
	scanLogEvery = 500
	// scanSliceTime is how long one slice of a scan runs before it queues the next.
	scanSliceTime = 60 * time.Second
	// scanLibraryRefresh is the longest the snapshot of the reader's works may go
	// stale during a scan. A work that gets a file, or a file that is refused, stops
	// being proposed within this time.
	scanLibraryRefresh = 5 * time.Second
)

// scanExts are the extensions a scan reports.
var scanExts = map[string]bool{".srt": true, ".vtt": true, ".ass": true, ".epub": true}

// Verdicts a seen file carries (library_scan_files.verdict).
const (
	verdictOK         = "ok"         // identified, or a subtitle named by its path
	verdictSkipped    = "skipped"    // empty, or over the source cap
	verdictUnreadable = "unreadable" // an ebook that would not open
)

// scanParams is the job's params: the folder id only, never a path.
type scanParams struct {
	MountID string `json:"mount_id"`
	// Slice numbers the continuations of one scan (0 for the first job). It makes a
	// continuation's params differ from a new press's.
	Slice int `json:"slice,omitempty"`
}

// sliceTime is the length of a slice; a test sets Server.scanSlice to shorten it.
func (s *Server) sliceTime() time.Duration {
	if s.scanSlice > 0 {
		return s.scanSlice
	}
	return scanSliceTime
}

// handleScanMount: POST /sources/scan {mount_id}. Returns 202 {job_id, running: false}
// for a new scan, or 200 {job_id, running: true} when this reader already has a slice of a
// scan of the folder queued or running. That gives one scan per user and folder.
func (s *Server) handleScanMount(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	var req struct {
		MountID string `json:"mount_id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	_, cfg, err := s.mountByID(strings.TrimSpace(req.MountID))
	if cfg == nil {
		writeErr(w, http.StatusNotFound, "no such library folder")
		return
	}
	if err != nil {
		// "The file is not where it was" has a remedy; "there is no source" does not.
		writeErr(w, http.StatusConflict, "that folder cannot be read right now: "+err.Error())
		return
	}
	// The check and the enqueue are one step, so two presses cannot start two chains.
	s.scanStart.Lock()
	defer s.scanStart.Unlock()
	if live, _ := s.liveScanJob(userID(r), cfg.ID); live != 0 {
		writeJSON(w, http.StatusOK, map[string]any{"job_id": live, "running": true})
		return
	}
	id, err := s.Jobs.Enqueue(viewer(r), libraryScanKind, cfg.Label, scanParams{MountID: cfg.ID}, 0, nil)
	var dup *jobs.ErrDuplicate
	switch {
	case errors.As(err, &dup):
		writeJSON(w, http.StatusOK, map[string]any{"job_id": dup.ID, "running": true})
	case err != nil:
		s.writeJobRefusal(w, r, err)
	default:
		writeJSON(w, http.StatusAccepted, map[string]any{"job_id": id, "running": false})
	}
}

// ---- the job ----

// scanState is a folder's row in library_scans.
type scanState struct {
	pass      int
	cursor    string
	files     int
	unclaimed int
	skipped   int
}

// scanRow is one judged file that is not yet committed.
type scanRow struct {
	f       mount.Found
	verdict string
	meta    string // an ebook's identity, as JSON
	cand    *foundCandidate
	rank    int
}

// libraryScan is the state of one run of the job. It is dropped when the run returns.
type libraryScan struct {
	s       *Server
	j       *jobs.Job
	ctx     context.Context
	root    *mount.Root
	mountID string
	uid     int64
	st      scanState
	slice   int
	// deadline ends the slice; sliceOver is set when it did.
	deadline  time.Time
	sliceOver bool

	// Snapshot of the reader's works, refreshed every scanLibraryRefresh.
	books, movies []scanWork
	haveBook      map[int64]bool
	haveFilm      map[string]bool
	quoted        map[string]bool
	ignored       map[string]bool
	refreshed     time.Time

	batch    []scanRow
	readDisk bool // an ebook was opened since the last commit
	sinceLog int
	estimate int // how many files the folder held when last seen, for the bar; 0 is unknown
	err      error
}

// runLibraryScan is the kind's run.
func runLibraryScan(s *Server, ctx context.Context, j *jobs.Job) error {
	var p scanParams
	if err := j.Params(&p); err != nil {
		return errors.New("this scan's record could not be read")
	}
	root, cfg, err := s.mountByID(p.MountID)
	if cfg == nil {
		return errors.New("that library folder is no longer set up")
	}
	if err != nil {
		return fmt.Errorf("that folder cannot be read right now: %w", err)
	}
	sc := &libraryScan{s: s, j: j, ctx: ctx, root: root, mountID: cfg.ID, uid: j.Owner().UserID,
		slice: p.Slice, deadline: time.Now().Add(s.sliceTime())}
	return sc.run()
}

func (sc *libraryScan) run() error {
	if err := sc.begin(); err != nil {
		return fmt.Errorf("read where the last scan stopped: %w", err)
	}
	if err := sc.refresh(true); err != nil {
		return fmt.Errorf("read the library: %w", err)
	}
	if sc.st.cursor != "" {
		sc.j.Log(jobs.LevelInfo, "continuing after %d files already scanned", sc.st.files)
	}
	res := sc.root.Walk(sc.st.cursor, scanExts, sc.visit)
	if sc.err != nil {
		_ = sc.flush(res.Skipped.Irregular + res.Skipped.Outside + res.Skipped.Unreadable)
		return sc.err
	}
	skipped := res.Skipped.Irregular + res.Skipped.Outside + res.Skipped.Unreadable
	if err := sc.flush(skipped); err != nil {
		return err
	}
	if !res.Stopped {
		if err := sc.finish(); err != nil {
			return err
		}
	}
	found := sc.countFindings()
	continued := false
	switch {
	case res.Stopped && sc.sliceOver && !sc.j.Stopping():
		// The walk is not finished and nobody pressed Stop: queue the next slice.
		if _, err := sc.j.Continue(scanParams{MountID: sc.mountID, Slice: sc.slice + 1}); err != nil {
			sc.j.Log(jobs.LevelWarn, "could not queue the next part of the scan (%v); press Scan to carry on", err)
		} else {
			continued = true
			sc.j.Log(jobs.LevelInfo, "scanned %d files, %d found so far; the scan carries on in a new job", sc.st.files, found)
		}
	case res.Stopped:
		sc.j.Log(jobs.LevelInfo, "stopped after %d files, %d found; pressing Scan again carries on from here", sc.st.files, found)
	default:
		sc.j.Log(jobs.LevelInfo, "scanned %d files, %d found, %d not matched", sc.st.files, found, sc.st.unclaimed)
	}
	sc.j.Progress(sc.st.files, 0)
	return sc.j.SetResult(map[string]any{"scanned": sc.st.files, "found": found, "unclaimed": sc.st.unclaimed, "complete": !res.Stopped, "continued": continued})
}

// begin reads the checkpoint. An unfinished pass resumes, a finished one starts the next
// pass, and a folder never scanned starts the first.
func (sc *libraryScan) begin() error {
	tx, err := sc.s.Store.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var done bool
	err = tx.QueryRow(`SELECT pass, cursor, done, files_seen, unclaimed, skipped FROM library_scans WHERE user_id = ? AND mount_id = ?`,
		sc.uid, sc.mountID).Scan(&sc.st.pass, &sc.st.cursor, &done, &sc.st.files, &sc.st.unclaimed, &sc.st.skipped)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		sc.st = scanState{pass: 1}
	case err != nil:
		return err
	case done:
		sc.st = scanState{pass: sc.st.pass + 1}
	}
	var known int
	if err := tx.QueryRow(`SELECT count(*) FROM library_scan_files WHERE user_id = ? AND mount_id = ?`, sc.uid, sc.mountID).Scan(&known); err != nil {
		return err
	}
	sc.estimate = known
	if _, err := tx.Exec(`INSERT INTO library_scans (user_id, mount_id, pass, cursor, done, files_seen, unclaimed, skipped, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
		ON CONFLICT (user_id, mount_id) DO UPDATE SET pass = excluded.pass, cursor = excluded.cursor, done = 0,
		  files_seen = excluded.files_seen, unclaimed = excluded.unclaimed, skipped = excluded.skipped, updated_at = excluded.updated_at`,
		sc.uid, sc.mountID, sc.st.pass, sc.st.cursor, sc.st.files, sc.st.unclaimed, sc.st.skipped, time.Now().UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}

// refresh re-reads the reader's works and refusals when the snapshot is stale or forced.
func (sc *libraryScan) refresh(force bool) error {
	if !force && time.Since(sc.refreshed) < scanLibraryRefresh {
		return nil
	}
	books, movies, haveBook, haveFilm, quoted, err := sc.s.scanLibrary(sc.uid)
	if err != nil {
		return err
	}
	sc.books, sc.movies, sc.haveBook, sc.haveFilm, sc.quoted = books, movies, haveBook, haveFilm, quoted
	sc.ignored = sc.s.ignoredFound(sc.uid)
	sc.refreshed = time.Now()
	return nil
}

// visit is the walk's callback. It judges one file and holds it until its batch commits.
// Returning false ends the walk (Stop or error); that file is not handled, so the
// checkpoint never passes it.
func (sc *libraryScan) visit(f mount.Found) bool {
	if sc.ctx.Err() != nil {
		sc.j.Stopping()
		return false
	}
	if !sc.s.goOn(sc.j, sc.st.files+len(sc.batch)) {
		return false
	}
	if err := sc.refresh(false); err != nil {
		sc.err = fmt.Errorf("read the library: %w", err)
		return false
	}
	sc.batch = append(sc.batch, sc.judge(f))
	if len(sc.batch) >= scanBatch {
		if err := sc.flush(0); err != nil {
			sc.err = err
			return false
		}
		// The slice ends only at a batch boundary, so each slice makes progress.
		if time.Now().After(sc.deadline) {
			sc.sliceOver = true
			return false
		}
	}
	return true
}

// judge decides what one file is. A subtitle is judged by its path. An EPUB is opened only
// when it is new or changed; otherwise the stored identity is matched again against the
// current library without touching the disk.
func (sc *libraryScan) judge(f mount.Found) scanRow {
	row := scanRow{f: f, verdict: verdictOK}
	if f.Size > scanMaxBytes || f.Size == 0 {
		row.verdict = verdictSkipped
		return row
	}
	var c foundCandidate
	matched := false
	if strings.ToLower(path.Ext(f.Rel)) == ".epub" {
		id, verdict, meta := sc.epubIdentityOf(f)
		row.verdict, row.meta = verdict, meta
		if verdict == verdictOK {
			c, matched = sc.s.matchEPUB(id, sc.mountID, f.Rel, sc.books, sc.haveBook, sc.quoted, sc.ignored)
		}
	} else {
		c, row.rank, matched = sc.s.matchSubtitle(sc.mountID, f.Rel, sc.movies, sc.haveFilm, sc.quoted, sc.ignored)
	}
	if matched {
		c.Token = "" // minted when findings are read, not stored
		row.cand = &c
	} else {
		sc.st.unclaimed++
	}
	return row
}

// epubIdentityOf returns the stored identity when size and mtime are unchanged, and reads
// the file otherwise.
func (sc *libraryScan) epubIdentityOf(f mount.Found) (epubIdentity, string, string) {
	var size, mtime int64
	var verdict, meta string
	err := sc.s.Store.DB.QueryRow(`SELECT size, mtime, verdict, meta FROM library_scan_files WHERE user_id = ? AND mount_id = ? AND rel = ?`,
		sc.uid, sc.mountID, f.Rel).Scan(&size, &mtime, &verdict, &meta)
	if err == nil && size == f.Size && mtime == f.ModTime {
		var id epubIdentity
		if verdict == verdictOK && json.Unmarshal([]byte(meta), &id) != nil {
			// A stored identity that cannot be decoded is read again.
			return sc.readEPUB(f)
		}
		return id, verdict, meta
	}
	return sc.readEPUB(f)
}

// readEPUB opens one EPUB and reads its identity. It is the only place a scan reads file bytes.
func (sc *libraryScan) readEPUB(f mount.Found) (epubIdentity, string, string) {
	sc.readDisk = true
	id, err := readEPUBIdentity(sc.root, f.Rel)
	// Pause, but end early on Stop.
	select {
	case <-sc.ctx.Done():
	case <-time.After(scanPause):
	}
	if err != nil {
		return epubIdentity{}, verdictUnreadable, ""
	}
	b, _ := json.Marshal(id)
	return id, verdictOK, string(b)
}

// upsertFinding stores a finding. It replaces the one stored for the same work only if
// that one is from an older pass, or the new one is a stronger match, a lower-ranked
// subtitle track, or a shorter path.
const upsertFinding = `INSERT INTO library_scan_findings
	(user_id, mount_id, subject, work_id, episode, rel, format, title, how, bucket, rank, pass)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT (user_id, mount_id, subject, work_id, episode) DO UPDATE SET
	  rel = excluded.rel, format = excluded.format, title = excluded.title, how = excluded.how,
	  bucket = excluded.bucket, rank = excluded.rank, pass = excluded.pass
	WHERE library_scan_findings.pass < excluded.pass
	   OR excluded.bucket < library_scan_findings.bucket
	   OR (excluded.bucket = library_scan_findings.bucket AND (excluded.rank < library_scan_findings.rank
	       OR (excluded.rank = library_scan_findings.rank AND length(excluded.rel) < length(library_scan_findings.rel))))`

// flush commits the batch (files seen, findings and checkpoint) in one short
// transaction. skipped is what the walk refused, added once at the end.
func (sc *libraryScan) flush(skipped int) error {
	if len(sc.batch) == 0 && skipped == 0 {
		return nil
	}
	tx, err := sc.s.Store.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, row := range sc.batch {
		if _, err := tx.Exec(`INSERT INTO library_scan_files (user_id, mount_id, rel, size, mtime, verdict, meta, pass)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (user_id, mount_id, rel) DO UPDATE SET size = excluded.size, mtime = excluded.mtime,
			  verdict = excluded.verdict, meta = excluded.meta, pass = excluded.pass`,
			sc.uid, sc.mountID, row.f.Rel, row.f.Size, row.f.ModTime, row.verdict, row.meta, sc.st.pass); err != nil {
			return err
		}
		if c := row.cand; c != nil {
			if _, err := tx.Exec(upsertFinding, sc.uid, sc.mountID, c.Subject, c.WorkID, c.Episode, c.Rel, c.Format, c.Title, c.How, c.Bucket, row.rank, sc.st.pass); err != nil {
				return err
			}
		}
	}
	sc.st.files += len(sc.batch)
	sc.st.skipped += skipped
	if n := len(sc.batch); n > 0 {
		sc.st.cursor = sc.batch[n-1].f.Rel
	}
	if _, err := tx.Exec(`UPDATE library_scans SET cursor = ?, files_seen = ?, unclaimed = ?, skipped = ?, updated_at = ? WHERE user_id = ? AND mount_id = ?`,
		sc.st.cursor, sc.st.files, sc.st.unclaimed, sc.st.skipped, time.Now().UnixMilli(), sc.uid, sc.mountID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	// Drop references to this batch's files before the next batch.
	sc.sinceLog += len(sc.batch)
	clear(sc.batch)
	sc.batch = sc.batch[:0]
	if sc.readDisk {
		// Reading an EPUB leaves garbage, and Go returns freed pages to the OS slowly.
		// The container is capped at 128 MB, so release them after every batch that
		// read an EPUB.
		debug.FreeOSMemory()
		sc.readDisk = false
	}
	total := 0
	if sc.estimate > sc.st.files {
		total = sc.estimate
	}
	sc.j.Progress(sc.st.files, total)
	if sc.sinceLog >= scanLogEvery {
		sc.sinceLog = 0
		sc.j.Log(jobs.LevelInfo, "scanned %d files, %d found", sc.st.files, sc.countFindings())
	}
	return nil
}

// finish ends a pass that reached the end of the folder. It deletes files and findings
// from older passes (files that are gone, proposals nothing supports now) and marks the
// pass done, so the next scan starts a new pass.
func (sc *libraryScan) finish() error {
	tx, err := sc.s.Store.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, q := range []string{
		`DELETE FROM library_scan_files WHERE user_id = ? AND mount_id = ? AND pass < ?`,
		`DELETE FROM library_scan_findings WHERE user_id = ? AND mount_id = ? AND pass < ?`,
	} {
		if _, err := tx.Exec(q, sc.uid, sc.mountID, sc.st.pass); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`UPDATE library_scans SET done = 1, cursor = '', updated_at = ? WHERE user_id = ? AND mount_id = ?`,
		time.Now().UnixMilli(), sc.uid, sc.mountID); err != nil {
		return err
	}
	return tx.Commit()
}

func (sc *libraryScan) countFindings() int {
	n, _ := countFindingsOf(sc.s.Store.DB, sc.uid, sc.mountID)
	return n
}

func countFindingsOf(db *sql.DB, uid int64, mountID string) (int, error) {
	var n int
	err := db.QueryRow(`SELECT count(*) FROM library_scan_findings f WHERE `+findingsShown, uid, mountID).Scan(&n)
	return n, err
}

// ---- reading findings ----

// findingsShown is the WHERE clause (alias f, args: user, mount) for findings a reader is
// offered: the work still exists and is theirs, it has no source file yet, and the reader
// has not refused this file. It is checked on read as well as on write, so a proposal never
// outlives an upload or a refusal.
const findingsShown = `f.user_id = ? AND f.mount_id = ?
	AND ((f.subject = 'book' AND EXISTS (SELECT 1 FROM books b WHERE b.id = f.work_id AND b.user_id = f.user_id))
	  OR (f.subject = 'screen' AND EXISTS (SELECT 1 FROM movies m WHERE m.id = f.work_id AND m.user_id = f.user_id)))
	AND NOT EXISTS (SELECT 1 FROM work_sources w WHERE w.user_id = f.user_id AND w.subject = f.subject
	                AND w.subject_id = f.work_id AND w.subject_key = f.episode)
	AND NOT EXISTS (SELECT 1 FROM cleanup_ignores c WHERE c.user_id = f.user_id AND c.kind = 'work-' || f.subject
	                AND c.item_id = f.work_id AND c.field = 'source' AND c.rule = 'source-attach'
	                AND c.match_hash = f.mount_id || ':' || f.rel)`

// scanStatus is what the screen reads of a folder's scan.
type scanStatus struct {
	// State is none, queued, running, partial (stopped; Scan resumes it) or done.
	State     string `json:"state"`
	JobID     int64  `json:"job_id,omitempty"`
	Scanned   int    `json:"scanned"`
	Found     int    `json:"found"`
	Unclaimed int    `json:"unclaimed"`
	Skipped   int    `json:"skipped"`
}

// liveScanJob is this reader's queued or running scan of the folder, if any.
func (s *Server) liveScanJob(uid int64, mountID string) (id int64, state string) {
	held := s.heldStops()
	err := s.Store.DB.QueryRow(heldCTE+`SELECT id, `+shownState+` FROM jobs
		WHERE kind = ? AND user_id = ? AND queued = 1 AND json_valid(params) AND json_extract(params, '$.mount_id') = ?
		  AND `+shownState+` IN ('queued', 'running') ORDER BY id DESC LIMIT 1`,
		jobs.HeldJSON(held), libraryScanKind, uid, mountID).Scan(&id, &state)
	if err != nil {
		return 0, ""
	}
	return id, state
}

func (s *Server) scanStatusOf(uid int64, mountID string) (scanStatus, error) {
	st := scanStatus{State: "none"}
	var done bool
	err := s.Store.DB.QueryRow(`SELECT done, files_seen, unclaimed, skipped FROM library_scans WHERE user_id = ? AND mount_id = ?`, uid, mountID).
		Scan(&done, &st.Scanned, &st.Unclaimed, &st.Skipped)
	switch {
	case errors.Is(err, sql.ErrNoRows):
	case err != nil:
		return st, err
	case done:
		st.State = "done"
	default:
		st.State = "partial"
	}
	if id, state := s.liveScanJob(uid, mountID); id != 0 {
		st.JobID, st.State = id, state
	}
	n, err := countFindingsOf(s.Store.DB, uid, mountID)
	st.Found = n
	return st, err
}

// handleFoundFiles: GET /sources/found?mount_id=[&status=1]. Returns {scan, candidates}:
// the stored findings for this reader and folder, with tokens signed now, and the scan's
// progress. With status=1 it returns only the progress, which the screen polls while a scan
// runs, because the list can be large.
func (s *Server) handleFoundFiles(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("mount_id"))
	if _, cfg, _ := s.mountByID(id); cfg == nil {
		writeErr(w, http.StatusNotFound, "no such library folder")
		return
	}
	uid := userID(r)
	st, err := s.scanStatusOf(uid, id)
	if err != nil {
		internalError(w, r, "read the scan", err)
		return
	}
	if r.URL.Query().Get("status") == "1" {
		writeJSON(w, http.StatusOK, map[string]any{"scan": st})
		return
	}
	rows, err := s.Store.DB.Query(`SELECT f.subject, f.work_id, f.episode, f.rel, f.format,
		COALESCE(CASE f.subject WHEN 'book' THEN (SELECT title FROM books b WHERE b.id = f.work_id)
		                        ELSE (SELECT title FROM movies m WHERE m.id = f.work_id) END, f.title),
		f.how, f.bucket
		FROM library_scan_findings f WHERE `+findingsShown+` ORDER BY f.bucket, 6, f.episode, f.rel`, uid, id)
	if err != nil {
		internalError(w, r, "read the findings", err)
		return
	}
	defer rows.Close()
	out := []foundCandidate{}
	for rows.Next() {
		c := foundCandidate{Mount: id}
		if err := rows.Scan(&c.Subject, &c.WorkID, &c.Episode, &c.Rel, &c.Format, &c.Title, &c.How, &c.Bucket); err != nil {
			internalError(w, r, "read the findings", err)
			return
		}
		c.Token = s.signFound(foundToken{Mount: id, Rel: c.Rel, Subject: c.Subject, ID: c.WorkID, Key: c.Episode, Bucket: c.Bucket})
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		internalError(w, r, "read the findings", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scan": st, "candidates": out})
}

// dropFindings removes findings made moot by a token that was accepted (the work has its
// file, in every folder) or refused (only that file's proposal).
func (s *Server) dropFindings(uid int64, t foundToken, refusal bool) {
	q, args := `DELETE FROM library_scan_findings WHERE user_id = ? AND subject = ? AND work_id = ? AND episode = ?`,
		[]any{uid, t.Subject, t.ID, t.Key}
	if refusal {
		q += ` AND mount_id = ? AND rel = ?`
		args = append(args, t.Mount, t.Rel)
	}
	if _, err := s.Store.DB.Exec(q, args...); err != nil {
		olog.Printf("[sources] drop scan findings for work %s:%s: %v", t.Subject, strconv.FormatInt(t.ID, 10), err)
	}
}

// forgetLibraryScans removes all readers' scan rows for a folder id.
func (s *Server) forgetLibraryScans(mountID string) {
	for _, table := range []string{"library_scans", "library_scan_findings", "library_scan_files"} {
		if _, err := s.Store.DB.Exec(`DELETE FROM `+table+` WHERE mount_id = ?`, mountID); err != nil {
			olog.Printf("[sources] forget scans of folder %s: %v", mountID, err)
		}
	}
}
