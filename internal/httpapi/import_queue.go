package httpapi

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"

	"tippani/internal/jobs"
	"tippani/internal/olog"
)

// AN IMPORT IS A QUEUED JOB (3.1.0).
//
// The owner's ask, of Settings › Jobs: "If any eligible action is run, a job will
// be created and queued … No action should skip through." An import was an
// in-request job — staged in its request, kept as a row afterwards — and so it
// skipped the queue: it ran beside whatever the queue was running, and nothing on
// the Jobs screen could stop it or say it was waiting. Now the route reads the
// upload, keeps the bytes in the spool, queues a job of kind `import` and answers
// 202 {job}; the job stages the file and keeps, as its result, what the request
// used to answer (importAnswer). The Import screen follows the job and reads that
// answer exactly as it read the request's.
//
// REJECTED: keeping the bytes in the job's params. A params row is read by every
// list of jobs and every duplicate check, and five megabytes of base64 in it would
// be read with each; and a params object is canonicalised through a JSON decode on
// every insert. The spool is a file per upload, named at random, beside the
// database and never inside an archive (controlEntry).
//
// THE SPOOL'S LIFETIME, which is the other half of the design:
//   - a job that runs removes its file once it has read it, whatever the file
//     turned out to be, so a succeeded or failed import leaves nothing;
//   - a job that is interrupted (the server stopped, or restarted, before or while
//     it ran) keeps its file, and can be run again while the file is kept
//     (queuedKind.runnableAgain);
//   - every other file — a job stopped before it ran, a job pruned after thirty
//     days, an account deleted, a database restored or reset under its jobs — is
//     swept by sweepSpool, which keeps only the files a waiting, running or
//     interrupted import names. The sweep runs where something might have left one:
//     at start (SweepSpool), after a Stop, after an account is deleted, before an
//     upload is spooled, and after the log's prune.

// importAuto is the source an import from the drop target is queued under: the
// file says what it is when the job reads it (stageAuto).
const importAuto = "auto"

// spoolDirName is where an upload waits for its job, under the data directory.
// It is a control entry: never archived, never moved by a restore.
const spoolDirName = ".jobs-spool"

// spoolName is the shape of a spooled file's name, and the only shape a job's
// params may name: random, flat, never a path.
var spoolName = regexp.MustCompile(`^[0-9a-f]{32}\.upload$`)

// importAnswer is what an import says: the status its request answered with
// before imports queued, and the body. The job keeps it as its result
// ({status, body}), and the Import screen reads it back as it read the request.
type importAnswer struct {
	Status int            `json:"status"`
	Body   map[string]any `json:"body"`
	// ready is what the phone is told once the answer is kept, "" for nothing.
	ready string
}

// importParams is an import job's params, as queueImport stores them.
type importParams struct {
	Source   string `json:"source"` // an importSources slug, or importAuto
	As       string `json:"as"`     // the reader's "Read this as…", with importAuto only
	Filename string `json:"filename"`
	Spool    string `json:"spool"` // the uploaded file's name in the spool
}

func (s *Server) spoolDir() string { return filepath.Join(s.DataDir, spoolDirName) }

// spoolFile is the path of a spooled file, if name is one a spool could hold.
func (s *Server) spoolFile(name string) (string, bool) {
	if !spoolName.MatchString(name) {
		return "", false
	}
	return filepath.Join(s.spoolDir(), name), true
}

// handleImportAuto is the one endpoint the drop target posts to: the file is
// queued as it is, and its job reads what it is (stageAuto).
func (s *Server) handleImportAuto(w http.ResponseWriter, r *http.Request) {
	s.queueImport(w, r, importAuto)
}

// queueImport is every import route: POST /import/auto and the eight per-source
// routes. It answers what can be answered without reading the file — no file, one
// over 5 MB, an override naming no format — and queues the rest.
func (s *Server) queueImport(w http.ResponseWriter, r *http.Request, source string) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	data, filename, ok := readUpload(w, r)
	if !ok {
		return
	}
	p := importParams{Source: source, Filename: filename}
	if source == importAuto {
		// An unknown slug is a client bug, not a file problem, and saying so now
		// beats queueing a job that can only refuse it.
		if p.As = r.FormValue("as"); p.As != "" {
			if _, known := importSources[p.As]; !known {
				writeErr(w, http.StatusBadRequest, "unknown import source: "+p.As)
				return
			}
		}
	}
	// Anything a Stop, a restore or a reset left behind goes first, so the spool
	// holds no more than the jobs that name it.
	s.sweepSpool()
	v := viewer(r)
	id, err := s.spoolAndQueue(v, p, data)
	var spoolErr *spoolWriteError
	switch {
	case errors.As(err, &spoolErr):
		codedError(w, r, olog.CodeImportStage, "spool the upload", spoolErr.err)
		return
	case err != nil:
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusAccepted, id, v)
}

// spoolWriteError is an upload the spool could not keep (a full disk), told apart
// from the queue's refusals, which have answers of their own.
type spoolWriteError struct{ err error }

func (e *spoolWriteError) Error() string { return e.err.Error() }

// spoolAndQueue keeps data in the spool and queues its import. The two happen
// under the spool's lock, which the sweep takes too: a sweep between the write and
// the insert would find a file no job names yet, and remove the upload the job is
// about to be given. A refused job takes its file with it.
func (s *Server) spoolAndQueue(v jobs.Owner, p importParams, data []byte) (int64, error) {
	s.spoolMu.Lock()
	defer s.spoolMu.Unlock()
	name, err := s.writeSpool(data)
	if err != nil {
		return 0, &spoolWriteError{err}
	}
	p.Spool = name
	id, err := s.Jobs.Enqueue(v, "import", p.Filename, p, 1, nil)
	if err != nil {
		path, _ := s.spoolFile(name)
		_ = os.Remove(path)
		return 0, err
	}
	return id, nil
}

// writeSpool writes data to a new file in the spool and returns its name. The
// name is random, and the file is created exclusively, so no two uploads share one.
func (s *Server) writeSpool(data []byte) (string, error) {
	if err := os.MkdirAll(s.spoolDir(), 0o700); err != nil {
		return "", err
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	name := hex.EncodeToString(b[:]) + ".upload"
	path, _ := s.spoolFile(name)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		_ = os.Remove(path)
		return "", err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return name, nil
}

// runImport is the import job: the upload, read from the spool, staged as the
// route used to stage it, and what the route used to answer kept as the result.
// A file the stagers refuse, or a server fault, fails the job with the answer's
// own sentence; the result holds the answer either way, since the Import screen
// shows a refusal as it showed the request's.
func runImport(s *Server, ctx context.Context, j *jobs.Job) error {
	var p importParams
	if err := j.Params(&p); err != nil {
		return errors.New("this import's record could not be read")
	}
	path, ok := s.spoolFile(p.Spool)
	if !ok {
		return errors.New("this import names no uploaded file")
	}
	data, err := os.ReadFile(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return errors.New("the uploaded file is no longer kept — upload it again")
	case err != nil:
		olog.Errorf(olog.CodeImportStage, "[import] job #%d reading its upload: %v", j.ID(), err)
		return fmt.Errorf("the uploaded file could not be read (%s)", olog.CodeImportStage)
	}
	uid := j.Owner().UserID
	var ans importAnswer
	switch stage, known := importSources[p.Source]; {
	case p.Source == importAuto:
		ans = s.stageAuto(ctx, uid, p.As, data, p.Filename)
	case known:
		noteJob(ctx, jobs.LevelInfo, "read as %s, the format its route names", p.Source)
		ans = stage(s, ctx, uid, data, p.Filename)
	default:
		ans = importRefused(ctx, "unknown import source: "+p.Source)
	}
	// Read, and staged or refused: a rerun would do the same to the same bytes, so
	// the file goes now, whatever the answer. Only a job that never got this far —
	// interrupted — keeps its file for a rerun.
	_ = os.Remove(path)
	j.Progress(1, 1)
	if err := j.SetResult(ans); err != nil {
		return err
	}
	if ans.ready != "" {
		s.notify(ctx, uid, "import", "Import ready to review", ans.ready)
	}
	if ans.Status >= http.StatusBadRequest {
		msg, _ := ans.Body["error"].(string)
		if msg == "" {
			msg = http.StatusText(ans.Status)
		}
		return errors.New(msg)
	}
	return nil
}

// importRunnableAgain is whether a finished import can be run again: only while
// the file it uploaded is still kept, which is only while it was interrupted
// before it read it. A rerun without the file could only fail.
func importRunnableAgain(s *Server, params string) bool {
	var p importParams
	if json.Unmarshal([]byte(params), &p) != nil {
		return false
	}
	path, ok := s.spoolFile(p.Spool)
	if !ok {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

// countImport is what Past jobs says of an import: the quotes it staged.
func countImport(result json.RawMessage) map[string]any {
	var a struct {
		Status int `json:"status"`
		Body   struct {
			Staged *float64 `json:"staged"`
		} `json:"body"`
	}
	if json.Unmarshal(result, &a) != nil || a.Status >= http.StatusBadRequest || a.Body.Staged == nil {
		return nil
	}
	return map[string]any{"staged": *a.Body.Staged}
}

// SweepSpool removes every spooled upload no waiting, running or interrupted
// import names. serve() calls it once at start, after the queue's Boot has marked
// what the last run left interrupted, so an import the restart cut off keeps its
// file for a rerun and one stopped before it ran does not. It also hands the
// log's prune the same sweep, so an import pruned after thirty days takes its file
// with it.
func (s *Server) SweepSpool() {
	if s.Logbook != nil {
		s.Logbook.AfterPrune(s.sweepSpool)
	}
	s.sweepSpool()
}

// sweepSpool removes the spooled uploads no waiting, running or interrupted import
// names. It keeps everything when it cannot read the jobs: a file kept a while too
// long costs disk, and one removed from under a job costs the reader's upload.
func (s *Server) sweepSpool() {
	s.spoolMu.Lock()
	defer s.spoolMu.Unlock()
	entries, err := os.ReadDir(s.spoolDir())
	if err != nil || len(entries) == 0 {
		return
	}
	keep := map[string]bool{}
	rows, err := s.Store.DB.Query(`SELECT json_extract(params, '$.spool') FROM jobs
		WHERE kind = 'import' AND state IN ('queued', 'running', 'interrupted') AND json_valid(params)`)
	if err != nil {
		olog.Warnf(olog.CodeImportStage, "[import] the upload spool was not swept: %v", err)
		return
	}
	for rows.Next() {
		var name sql.NullString
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			olog.Warnf(olog.CodeImportStage, "[import] the upload spool was not swept: %v", err)
			return
		}
		keep[name.String] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeImportStage, "[import] the upload spool was not swept: %v", err)
		return
	}
	for _, e := range entries {
		if keep[e.Name()] {
			continue
		}
		if err := os.RemoveAll(filepath.Join(s.spoolDir(), e.Name())); err != nil {
			olog.Warnf(olog.CodeImportStage, "[import] could not remove the spooled upload %s: %v", e.Name(), err)
		}
	}
}
