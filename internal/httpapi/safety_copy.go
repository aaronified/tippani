package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
)

// THE SAFETY COPY IS A QUEUED JOB WITH A ONE-TIME DOWNLOAD (3.1.0).
//
// The owner's answer of 28 September, that "every backup" queues: the copy a
// restore or a reset takes first is a backup, and it had been sealed in its
// request and streamed into the response, beside whatever the queue was running
// and past any Stop. Now POST /admin/backup/safety checks the credential (a 400
// or a 401 at once, as the kept backup's route does) and queues a job of kind
// backup.safety, which seals the copy and publishes it for one download, GET
// /admin/backup/safety/{token}; the restore and reset prompts follow the job and
// download the copy when it has finished. Restore and reset themselves stay
// immediate: they swap the database the queue lives in.
//
// WHERE THE COPY WAITS, AND WHERE IT NEVER IS. The job seals into
// <data>/.safety-<random>.tpbk, a control entry (controlEntry): never archived by
// a backup made while it waits, never moved aside by a restore, and never in
// <data>/backups, which holds exactly one archive — the one a restore from the
// server reads. A safety copy there would become what the next restore restores,
// the copy of what it is about to replace (Design-decisions, "Two more gaps
// closed before 3.0.0"), and GET /admin/backup would list it.
//
// ONE DOWNLOAD, BY ITS OWNER, FOR A FEW MINUTES. The token is 128 random bits,
// and it is not the credential on its own: the download also needs the session
// of the admin whose job made it. Another admin and a reader are answered 404,
// the same as a token that does not exist; somebody with the token and no
// session is stopped at sign-in (requireAuth's 401) before the token is looked
// at. The first GET that gets past that spends the token (a HEAD is refused,
// handleSafetyDownload), whether or not the file reaches the end, and the file
// goes when that request ends: a copy cut short is taken again, as the streamed
// one was. The safety note that lets a restore or a reset go (safetyNote) is set
// only when the whole file has left, as it always was.
//
// THE FILE GOES WITH ITS TOKEN, AND NOTHING WAKES ON A TIMER TO TAKE IT. The
// invariant "nothing wakes on a timer" rules out a timer that deletes an expired
// copy the moment it expires. So an expired copy is taken whenever the copies are
// next looked at — another copy published or asked for, a download, the Server
// card's read of GET /admin/backup — and every .safety- file is removed at start
// (CleanupBackupStaging), when no token can name it. A new copy replaces its
// owner's earlier one, so an admin who takes the copy twice leaves one file on
// the disk, not two. A restore and a factory reset drop every copy and its file
// (forgetAccountGrants), as they forget every other grant issued against the
// accounts they replace, and deleting an account drops its copy.

const (
	// safetyCopyPrefix is how a safety copy's file is named in the data directory,
	// and a control entry's prefix (controlEntry).
	safetyCopyPrefix = ".safety-"
	// safetyCopyRoute is the download's address under /api, and the prefix a kept
	// request line blanks the token after (keptPath).
	safetyCopyRoute = "/admin/backup/safety/"
)

// safetyCopyTTL is how long a sealed copy waits for its download. A few minutes,
// like a share image's: the prompt that asked for it downloads it within a poll
// of the job ending, and a copy nobody fetched is a whole library's worth of
// disk. A variable so the test of a copy nobody fetched can wait a moment
// instead of five minutes.
var safetyCopyTTL = 5 * time.Minute

// safetyCopy is one sealed copy waiting for its download.
type safetyCopy struct {
	uid     int64
	path    string // the file, <data>/.safety-….tpbk
	name    string // what the download calls it
	size    int64
	expires time.Time
}

// safetyCopies is every copy waiting, by token. The zero value is ready.
type safetyCopies struct {
	mu sync.Mutex
	m  map[string]safetyCopy
}

// sweepLocked drops every copy past its time, with its file. Called with mu held.
func (c *safetyCopies) sweepLocked(now time.Time) {
	for token, cp := range c.m {
		if now.After(cp.expires) {
			delete(c.m, token)
			removeSafetyFile(cp.path)
		}
	}
}

// sweep is sweepLocked, taking the lock.
func (c *safetyCopies) sweep() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sweepLocked(time.Now())
}

// publish keeps cp under a new token and returns it. The owner's earlier copy, if
// one is still waiting, goes with its file: the new one is the copy they asked for.
func (c *safetyCopies) publish(cp safetyCopy) (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b[:])
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sweepLocked(time.Now())
	for t, old := range c.m {
		if old.uid == cp.uid {
			delete(c.m, t)
			removeSafetyFile(old.path)
		}
	}
	if c.m == nil {
		c.m = map[string]safetyCopy{}
	}
	c.m[token] = cp
	return token, nil
}

// take spends token for uid and hands back its copy, whose file is the caller's
// to remove. A token that names no copy, one past its time, or one of somebody
// else's is not taken, and is not spent.
func (c *safetyCopies) take(token string, uid int64) (safetyCopy, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sweepLocked(time.Now())
	cp, ok := c.m[token]
	if !ok || cp.uid != uid {
		return safetyCopy{}, false
	}
	delete(c.m, token)
	return cp, true
}

// drop removes the copy published under token, with its file.
func (c *safetyCopies) drop(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if cp, ok := c.m[token]; ok {
		delete(c.m, token)
		removeSafetyFile(cp.path)
	}
}

// forget drops every copy that match picks (all of them for nil), with its file.
func (c *safetyCopies) forget(match func(safetyCopy) bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for t, cp := range c.m {
		if match == nil || match(cp) {
			delete(c.m, t)
			removeSafetyFile(cp.path)
		}
	}
}

func removeSafetyFile(path string) {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		olog.Warnf(olog.CodeBackupCleanup, "[backup] could not remove the safety copy %s: %v", filepath.Base(path), err)
	}
}

// handleSafetyBackup: POST /admin/backup/safety {password} or {passphrase} →
// 202 {job}. The credential is checked here, a 400 or a 401 before anything
// queues, as the kept backup's is (backupSecret); the job then seals the copy
// (runSafetyBackup). The same copy asked for twice while the first waits is one
// job, the second press answered 409 with its id.
func (s *Server) handleSafetyBackup(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	params, err := readOptionalBody(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	v := viewer(r)
	key, err := backupSecret(s, params, v)
	if err != nil {
		if ref, ok := asRefusal(err); ok {
			writeErr(w, ref.status, ref.msg)
			return
		}
		codedError(w, r, olog.CodeJobRead, "check the safety copy's credential", err)
		return
	}
	s.safetyCopies.sweep()
	// No params: the credential is the job's secret, never its row, and an
	// admin's two presses are one copy to the duplicate check.
	id, err := s.Jobs.Enqueue(v, "backup.safety", "", map[string]any{}, 0, key)
	if err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusAccepted, id, v)
}

// runSafetyBackup is the backup.safety job: the copy sealed as the kept backup
// is (sealArchive), with the credential the job was queued with, into a
// control-prefixed file beside the backups, and published for one download. Its
// result is {name, size, url, expires_at}: what the prompt downloads, from where,
// and until when; url is a bare API path, as a share image's is.
//
// It asks what runBackup asks, where runBackup asks it: the lock, failing rather
// than waiting when a backup or a restore holds it; the owner's password as it is
// now, since the job may have waited; and a Stop, before the snapshot, before
// each file and inside each copy, and last before the copy is published
// ("promote"). A STOP LEAVES NO FILE AND NO TOKEN: the file is removed wherever
// the Stop landed, and a copy is published only after the last place one can.
func runSafetyBackup(s *Server, ctx context.Context, j *jobs.Job) error {
	key, ok := j.Secret().(backupKey)
	if !ok {
		return errors.New("this copy has no credential to seal it with — take it again")
	}
	if !s.backupMu.TryLock() {
		return errors.New("a backup or restore is already running")
	}
	defer s.backupMu.Unlock()
	owner := j.Owner()
	account := key.account
	if key.mode == backupModePassword {
		if !s.passwordIs(owner.UserID, key.secret) {
			return errors.New("your password changed since this copy was asked for — take it again")
		}
		account = owner.Username
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] safety copy name: %v", err)
		return errors.New("internal error")
	}
	dest := filepath.Join(s.DataDir, safetyCopyPrefix+hex.EncodeToString(b[:])+backupExt)
	stopped := func() error {
		_ = os.Remove(dest)
		j.Stopping()
		j.Log(jobs.LevelInfo, "no copy was made: stopped before it was sealed, and nothing of it is left on the server")
		return ctx.Err()
	}
	if err := s.sealArchive(ctx, owner.UserID, account, key.mode, key.secret, dest); err != nil {
		if ctx.Err() != nil {
			return stopped()
		}
		_ = os.Remove(dest)
		return errors.New(backupErrorText(err))
	}
	// The last step a Stop can land before: after it, the copy is there to take.
	if err := s.backupStep(ctx, "promote"); err != nil {
		return stopped()
	}
	info, err := os.Stat(dest)
	if err != nil {
		_ = os.Remove(dest)
		olog.Errorf(olog.CodeBackupArchive, "[backup] stat safety copy: %v", err)
		return errors.New("internal error")
	}
	name := backupPrefix + time.Now().UTC().Format(backupTimeLayout) + "-safety-copy" + backupExt
	expires := time.Now().Add(safetyCopyTTL)
	token, err := s.safetyCopies.publish(safetyCopy{uid: owner.UserID, path: dest, name: name, size: info.Size(), expires: expires})
	if err != nil {
		_ = os.Remove(dest)
		olog.Errorf(olog.CodeBackupArchive, "[backup] safety copy token: %v", err)
		return errors.New("internal error")
	}
	if err := j.SetResult(map[string]any{
		"name": name, "size": info.Size(), "url": safetyCopyRoute + token, "expires_at": expires.UnixMilli(),
	}); err != nil {
		s.safetyCopies.drop(token)
		return err
	}
	j.Log(jobs.LevelInfo, "%s — sealed with %s, %s, for one download within %s", name, sealedWith(key.mode, account),
		humanBytes(info.Size()), inMinutes(safetyCopyTTL))
	return nil
}

// inMinutes is a duration as a log line says it: "5 minutes".
func inMinutes(d time.Duration) string {
	if m := int(d / time.Minute); m > 1 {
		return strconv.Itoa(m) + " minutes"
	}
	return d.String()
}

// errNoSafetyCopy is the download's 404, whatever the reason: it says nothing
// about whether a copy of somebody else's is behind the token.
const errNoSafetyCopy = "no such copy — it has been downloaded already, or it waited too long; take it again"

// handleSafetyDownload: GET /admin/backup/safety/{token} — the copy, once, to
// the admin whose job sealed it; 404 to everybody else and for a token spent or
// past its time. The file is removed when the request ends, whichever way, and
// the safety note is set only once the whole file has left.
func (s *Server) handleSafetyDownload(w http.ResponseWriter, r *http.Request) {
	// ONLY A GET SPENDS THE TOKEN. The router answers a HEAD at a GET's address,
	// and the server throws a HEAD's body away: let in, a HEAD (curl -I, a
	// download manager asking the size first) would spend the one download and set
	// the safety note with not a byte of the copy delivered, and the restore or
	// the reset would then go ahead on a copy nobody has.
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeErr(w, http.StatusMethodNotAllowed, "the copy is handed over by a GET, once")
		return
	}
	// A reader is told what anybody is told of a copy that is not theirs: that
	// there is none. requireAdmin's 403 would say that there is something here an
	// admin could have.
	var cp safetyCopy
	ok := false
	if isAdmin(r) {
		cp, ok = s.safetyCopies.take(r.PathValue("token"), userID(r))
	}
	if !ok {
		writeErr(w, http.StatusNotFound, errNoSafetyCopy)
		return
	}
	defer removeSafetyFile(cp.path)
	f, err := os.Open(cp.path)
	if errors.Is(err, os.ErrNotExist) {
		// Its file was swept from under its token (the start's sweep, by hand while
		// the server ran): there is no copy to hand over.
		writeErr(w, http.StatusNotFound, errNoSafetyCopy)
		return
	}
	if err != nil {
		internalError(w, r, "open safety copy", err)
		return
	}
	defer f.Close()
	// A whole library can outlive the server's 60s write deadline.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+cp.name+`"`)
	w.Header().Set("Content-Length", strconv.FormatInt(cp.size, 10))
	w.Header().Set("Cache-Control", "no-store")
	// NOTED ONLY WHEN THE WHOLE FILE LEFT. A copy that stopped halfway is not a
	// backup, and the note is what lets the destructive step run.
	if n, err := io.Copy(w, f); err != nil || n != cp.size {
		olog.Warnf(olog.CodeBackupArchive, "[backup] safety copy download cut short at %d of %d bytes: %v", n, cp.size, err)
		return
	}
	s.safety.set(userID(r))
	olog.Printf("[backup] safety copy downloaded by user %d (%s)", userID(r), username(r))
}

// cleanupSafetyCopies is the start's half of the copies' lifetime: every
// .safety- file in the data directory, since no token outlives the process that
// published it. CleanupBackupStaging calls it.
func cleanupSafetyCopies(dataDir string, entries []os.DirEntry) {
	for _, e := range entries {
		if n := e.Name(); strings.HasPrefix(n, safetyCopyPrefix) {
			if err := os.RemoveAll(filepath.Join(dataDir, n)); err != nil {
				olog.Warnf(olog.CodeBackupCleanup, "[backup] could not remove the safety copy %s left by the last run: %v", n, err)
			} else {
				olog.Printf("[backup] removed the safety copy %s the last run left undownloaded", n)
			}
		}
	}
}
