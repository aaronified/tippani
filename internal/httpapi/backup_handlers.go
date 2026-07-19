package httpapi

import (
	"archive/tar"
	"compress/gzip"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Backup & restore (§ backup, .claude/plans/backup-restore-plan.md, adjusted):
// backups are created SERVER-SIDE into <DataDir>/backups — a tar.gz holding a
// VACUUM INTO snapshot of the database plus everything else in the data dir —
// and only the newest one is kept (its date is its name). The file is served
// for download, and restore replaces the whole data dir from that kept archive
// in-process: no Docker socket, no container recreation.

const (
	backupsDirName   = "backups"
	backupPrefix     = "tippani-backup-"
	backupTimeLayout = "20060102-150405"
	preRestorePrefix = ".pre-restore-"

	maxRestoreEntries = 200_000
	maxRestoreBytes   = 8 << 30 // decompression-bomb guard
	maxRestoreUpload  = 2 << 30 // 2 GiB cap on an uploaded restore archive (413 beyond)
)

func (s *Server) backupsDir() string { return filepath.Join(s.DataDir, backupsDirName) }

// controlEntry reports whether a top-level data-dir entry belongs to the
// backup/restore machinery (never archived, never swapped out on restore).
func (s *Server) controlEntry(name string) bool {
	if name == backupsDirName {
		return true
	}
	for _, p := range []string{".backup-", ".restore-", preRestorePrefix} {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// liveDBEntry reports whether a top-level entry is the live database or one of
// its sidecars. Skipped when ARCHIVING (the archive carries the VACUUM INTO
// snapshot instead) but MOVED like everything else during the restore swap —
// the restored tippani.db replaces it.
func (s *Server) liveDBEntry(name string) bool {
	db := filepath.Base(s.Store.Path())
	return name == db || name == db+"-wal" || name == db+"-shm" || strings.HasPrefix(name, db+".recover")
}

// newestBackup returns the kept archive's filename and info ("" when none).
func (s *Server) newestBackup() (string, os.FileInfo) {
	entries, err := os.ReadDir(s.backupsDir())
	if err != nil {
		return "", nil
	}
	newest := ""
	for _, e := range entries {
		n := e.Name()
		if e.Type().IsRegular() && strings.HasPrefix(n, backupPrefix) && strings.HasSuffix(n, ".tar.gz") && n > newest {
			newest = n
		}
	}
	if newest == "" {
		return "", nil
	}
	info, err := os.Stat(filepath.Join(s.backupsDir(), newest))
	if err != nil {
		return "", nil
	}
	return newest, info
}

func backupMeta(name string, info os.FileInfo) map[string]any {
	created := info.ModTime().UTC()
	if ts, err := time.Parse(backupTimeLayout, strings.TrimSuffix(strings.TrimPrefix(name, backupPrefix), ".tar.gz")); err == nil {
		created = ts
	}
	return map[string]any{"name": name, "created": created.Format(time.RFC3339), "size": info.Size()}
}

// handleBackupStatus: GET /admin/backup — {backup: {name, created, size}} or
// {backup: null}. Feeds the Settings card (the restore block shows the date).
func (s *Server) handleBackupStatus(w http.ResponseWriter, r *http.Request) {
	name, info := s.newestBackup()
	if name == "" {
		writeJSON(w, http.StatusOK, map[string]any{"backup": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backup": backupMeta(name, info)})
}

// handleBackupCreate: POST /admin/backup — build a new dated archive in
// <DataDir>/backups, then drop every older one (the newest backup is always
// the only one kept). Returns the new archive's metadata.
func (s *Server) handleBackupCreate(w http.ResponseWriter, r *http.Request) {
	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()
	olog.Printf("[backup] backup requested by user %d (%s)", userID(r), username(r))

	staging, err := os.MkdirTemp(s.DataDir, ".backup-")
	if err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] staging dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer os.RemoveAll(staging)

	// Consistent live snapshot: VACUUM INTO (no WAL sidecars, writers unaffected).
	snap := filepath.Join(staging, "tippani.db")
	if err := s.Store.VacuumInto(snap); err != nil {
		olog.Errorf(olog.CodeBackupSnapshot, "[backup] snapshot failed: %v", err)
		writeErr(w, http.StatusInternalServerError, "database snapshot failed")
		return
	}

	if err := os.MkdirAll(s.backupsDir(), 0o700); err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] backups dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	name := backupPrefix + time.Now().UTC().Format(backupTimeLayout) + ".tar.gz"
	final := filepath.Join(s.backupsDir(), name)
	partial := final + ".partial"

	if err := s.writeBackupArchive(partial, snap); err != nil {
		_ = os.Remove(partial)
		olog.Errorf(olog.CodeBackupArchive, "[backup] archive write failed: %v", err)
		writeErr(w, http.StatusInternalServerError, "backup archive could not be written")
		return
	}
	_ = os.Remove(final) // same-second re-create: Windows rename won't overwrite
	if err := os.Rename(partial, final); err != nil {
		_ = os.Remove(partial)
		olog.Errorf(olog.CodeBackupArchive, "[backup] promote archive: %v", err)
		writeErr(w, http.StatusInternalServerError, "backup archive could not be written")
		return
	}

	// The new archive exists — drop every older backup (and stray partials) so
	// exactly one, the latest, stays on the server.
	if entries, err := os.ReadDir(s.backupsDir()); err == nil {
		for _, e := range entries {
			if n := e.Name(); n != name && (strings.HasPrefix(n, backupPrefix) || strings.HasSuffix(n, ".partial")) {
				if err := os.Remove(filepath.Join(s.backupsDir(), n)); err != nil {
					olog.Warnf(olog.CodeBackupCleanup, "[backup] could not drop old backup %s: %v", n, err)
				}
			}
		}
	}

	info, err := os.Stat(final)
	if err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] stat new archive: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	olog.Printf("[backup] created %s (%d bytes)", name, info.Size())
	writeJSON(w, http.StatusOK, map[string]any{"backup": backupMeta(name, info)})
}

// writeBackupArchive streams the snapshot + every non-control data-dir entry
// into a tar.gz at dest.
func (s *Server) writeBackupArchive(dest, snap string) error {
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	gz := gzip.NewWriter(out)
	tw := tar.NewWriter(gz)

	addFile := func(src, name string) error {
		info, err := os.Stat(src)
		if err != nil {
			return err
		}
		hdr := &tar.Header{Name: name, Mode: 0o600, Size: info.Size(), ModTime: info.ModTime()}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		f, err := os.Open(src)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(tw, f)
		return err
	}

	werr := func() error {
		if err := addFile(snap, "tippani.db"); err != nil {
			return fmt.Errorf("snapshot: %w", err)
		}
		tops, err := os.ReadDir(s.DataDir)
		if err != nil {
			return err
		}
		for _, top := range tops {
			if s.controlEntry(top.Name()) || s.liveDBEntry(top.Name()) {
				continue
			}
			base := filepath.Join(s.DataDir, top.Name())
			err := filepath.WalkDir(base, func(p string, d os.DirEntry, err error) error {
				if err != nil {
					return err
				}
				rel, err := filepath.Rel(s.DataDir, p)
				if err != nil {
					return err
				}
				name := filepath.ToSlash(rel)
				if d.IsDir() {
					return tw.WriteHeader(&tar.Header{Name: name + "/", Typeflag: tar.TypeDir, Mode: 0o700, ModTime: time.Now()})
				}
				if !d.Type().IsRegular() {
					return nil // symlinks etc. are never archived
				}
				if err := addFile(p, name); err != nil {
					// A cover deleted mid-walk is benign; anything else is real.
					if errors.Is(err, os.ErrNotExist) {
						return nil
					}
					return err
				}
				return nil
			})
			if err != nil {
				return err
			}
		}
		return nil
	}()
	if werr != nil {
		tw.Close()
		gz.Close()
		out.Close()
		return werr
	}
	if err := tw.Close(); err != nil {
		gz.Close()
		out.Close()
		return err
	}
	if err := gz.Close(); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// handleBackupDownload: GET /admin/backup/download — stream the kept archive.
func (s *Server) handleBackupDownload(w http.ResponseWriter, r *http.Request) {
	name, _ := s.newestBackup()
	if name == "" {
		writeErr(w, http.StatusNotFound, "no backup on the server yet — create one first")
		return
	}
	// A multi-hundred-MB archive can outlive the server's 60s write timeout.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	http.ServeFile(w, r, filepath.Join(s.backupsDir(), name))
}

// handleRestore: POST /admin/restore {"confirm":"RESTORE"} — replace the whole
// data dir from the kept archive: extract to staging with hostile-archive
// guards, validate the database, close the live DB, atomically swap, reopen
// (migrate + integrity + FTS heal). The previous data dir is kept in ONE
// .pre-restore-<ts> safety generation until the next successful restore.
func (s *Server) handleRestore(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Confirm string `json:"confirm"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Confirm != "RESTORE" {
		writeErr(w, http.StatusBadRequest, `confirmation required: send {"confirm":"RESTORE"}`)
		return
	}
	s.restoreFromNewest(w, fmt.Sprintf("user %d (%s)", userID(r), username(r)), nil)
}

// handleRestoreUpload: POST /admin/restore/upload — restore from an archive the
// admin UPLOADS (typically a backup downloaded from another Tippani server),
// instead of the one kept on this server. multipart/form-data with a confirm
// field (= RESTORE) and a file part (= the .tar.gz). Same extract → validate →
// swap pipeline; the schema-version gate is what makes a foreign server's DB safe.
func (s *Server) handleRestoreUpload(w http.ResponseWriter, r *http.Request) {
	s.restoreFromUpload(w, r, true, fmt.Sprintf("user %d (%s)", userID(r), username(r)), nil)
}

// handleOnboardRestore: POST /auth/restore — the onboarding twin of
// /admin/restore. Self-guards like /auth/signup: it only works while the users
// table is empty (a fresh box whose operator dropped an archive into
// <data>/backups), so it needs no session and no typed confirmation — there is
// nothing yet to lose. Rate-limited: restore is expensive and unauthenticated.
//
// The users-empty check here is a fast rejection, not the real guard: a slow
// multi-GB extraction could otherwise finish long after a legitimate signup
// landed and swap that new admin away. The atomic guard is the closure passed to
// restoreFromNewest, re-checked under backupMu just before the swap, paired with
// handleSignup taking backupMu around its INSERT (so a signup can't commit while
// a restore holds the lock). Together they make "users empty" hold at the swap.
func (s *Server) handleOnboardRestore(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiter.Allow(s.clientIP(r) + "|restore") {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}
	if exists, err := s.usersExist(); err != nil {
		internalError(w, r, "check for existing users", err)
		return
	} else if exists {
		writeErr(w, http.StatusForbidden, "onboarding is closed; log in and restore from Settings")
		return
	}
	s.restoreFromNewest(w, "first-run onboarding", func() error {
		if exists, err := s.usersExist(); err != nil {
			return err
		} else if exists {
			return errOnboardingClosed
		}
		return nil
	})
}

// handleOnboardRestoreUpload: POST /auth/restore/upload — the upload twin of
// /auth/restore, for the move-to-a-new-box path: a fresh server with no users,
// where the operator restores a backup file downloaded from the old box without
// SSHing an archive into <data>/backups first. Self-guards exactly like
// handleOnboardRestore (users-empty gate + rate limit + last-moment re-guard);
// no typed confirmation — there is nothing yet to lose.
func (s *Server) handleOnboardRestoreUpload(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiter.Allow(s.clientIP(r) + "|restore-upload") {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}
	if exists, err := s.usersExist(); err != nil {
		internalError(w, r, "check for existing users", err)
		return
	} else if exists {
		writeErr(w, http.StatusForbidden, "onboarding is closed; log in and restore from Settings")
		return
	}
	s.restoreFromUpload(w, r, false, "first-run onboarding", func() error {
		if exists, err := s.usersExist(); err != nil {
			return err
		} else if exists {
			return errOnboardingClosed
		}
		return nil
	})
}

// usersExist reports whether the users table has any row — the onboarding gate.
func (s *Server) usersExist() (bool, error) {
	var exists bool
	err := s.Store.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users)`).Scan(&exists)
	return exists, err
}

// errOnboardingClosed is the sentinel the onboard-restore late guard returns
// when a user appeared between the request and the swap — mapped to 409 below.
var errOnboardingClosed = errors.New("someone finished onboarding while this restore was preparing; not overwriting the new account")

// restoreFromNewest restores from the archive kept on this server (the one "Back
// up now" created). It authorizes nothing itself — callers have. guard is passed
// straight through to the core's last-moment re-check (onboarding uses it).
func (s *Server) restoreFromNewest(w http.ResponseWriter, requestedBy string, guard func() error) {
	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()

	name, _ := s.newestBackup()
	if name == "" {
		writeErr(w, http.StatusBadRequest, "no backup on the server — create one first")
		return
	}
	s.restoreArchive(w, filepath.Join(s.backupsDir(), name), name, requestedBy, guard)
}

// restoreArchive is the shared restore core behind every path — the kept archive
// (restoreFromNewest) and an uploaded one (restoreFromUpload). It extracts
// archive to staging with hostile-archive guards, validates the staged database,
// then — the point of no return — closes the live DB, atomically swaps the whole
// data dir, and reopens it (migrate + integrity + FTS heal) in-process. label
// names the source in logs. The caller MUST already hold backupMu (which
// serializes restore against backup, signup, and other restores). guard, if
// non-nil, runs under that lock immediately before the swap — the onboarding
// path uses it to re-verify users-empty at the last moment (a non-nil error
// there aborts the restore, nothing having been touched). The previous data dir
// is kept in ONE .pre-restore-<ts> safety generation until the next restore.
func (s *Server) restoreArchive(w http.ResponseWriter, archive, label, requestedBy string, guard func() error) {
	// Extract + validate + swap + reopen can outlive the server's 60s
	// WriteTimeout on a large library; clear the write deadline so the final
	// JSON still reaches the client (mirrors handleBackupDownload).
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})

	olog.Alertf("[backup] RESTORE from %s requested by %s", label, requestedBy)

	staging, err := os.MkdirTemp(s.DataDir, ".restore-")
	if err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] restore staging dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer os.RemoveAll(staging)
	stage := filepath.Join(staging, "stage")

	if code, msg := s.extractBackup(archive, stage); code != 0 {
		writeErr(w, code, msg)
		return
	}
	if msg := validateRestoredDB(filepath.Join(stage, "tippani.db")); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}

	// Last-moment re-guard (onboarding): a signup can only have committed while
	// backupMu was free, so re-checking now — still holding the lock — sees it.
	if guard != nil {
		if err := guard(); err != nil {
			if errors.Is(err, errOnboardingClosed) {
				writeErr(w, http.StatusConflict, err.Error())
			} else {
				olog.Errorf(olog.CodeHTTPInternal, "[backup] restore guard check failed: %v", err)
				writeErr(w, http.StatusInternalServerError, "internal error")
			}
			return
		}
	}

	// ---- point of no return: swap ----
	// A unique per-restore safety dir. Second precision alone collides when two
	// restores land in the same second (restore, then restore a different upload) —
	// os.Mkdir would fail, and worse, the name would alias this generation onto the
	// previous one so a rollback could grab the wrong directory. MkdirTemp
	// guarantees a fresh name; the timestamp still makes it human-sortable.
	ts := time.Now().UTC().Format(backupTimeLayout)
	preDir, mkErr := os.MkdirTemp(s.DataDir, preRestorePrefix+ts+"-")
	if mkErr != nil {
		olog.Errorf(olog.CodeBackupSwap, "[backup] create pre-restore dir: %v", mkErr)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := s.Store.CloseForSwap(); err != nil {
		olog.Alertf("[backup] closing live db before swap returned: %v (continuing)", err)
	}
	swapErr := func() error {
		if err := s.moveTopLevel(s.DataDir, preDir); err != nil {
			return fmt.Errorf("move current data aside: %w", err)
		}
		if err := moveEntries(stage, s.DataDir); err != nil {
			return fmt.Errorf("move restored data in: %w", err)
		}
		// The archive's snapshot is canonically named tippani.db; the live file
		// can differ (tests). Land it under the name the store reopens.
		if base := filepath.Base(s.Store.Path()); base != "tippani.db" {
			if err := renameWithRetry(filepath.Join(s.DataDir, "tippani.db"), filepath.Join(s.DataDir, base)); err != nil {
				return fmt.Errorf("rename restored db: %w", err)
			}
		}
		return s.Store.ReopenAfterSwap()
	}()
	if swapErr != nil {
		olog.Errorf(olog.CodeBackupSwap, "[backup] restore swap failed: %v — rolling back", swapErr)
		failDir := filepath.Join(staging, "failed")
		rbErr := func() error {
			if err := os.Mkdir(failDir, 0o700); err != nil {
				return err
			}
			if err := s.moveTopLevel(s.DataDir, failDir); err != nil {
				return err
			}
			if err := moveEntries(preDir, s.DataDir); err != nil {
				return err
			}
			return s.Store.ReopenAfterSwap()
		}()
		if rbErr != nil {
			olog.Errorf(olog.CodeBackupRollback,
				"[backup] ROLLBACK FAILED (%v) — exiting for a clean boot; previous data is in %s", rbErr, preDir)
			os.Exit(1)
		}
		s.Sessions.DB = s.Store.DB
		writeErr(w, http.StatusInternalServerError, "restore failed — previous data is intact")
		return
	}

	// Success: repoint sessions, keep exactly this one safety generation.
	s.Sessions.DB = s.Store.DB
	preBase := filepath.Base(preDir)
	if entries, err := os.ReadDir(s.DataDir); err == nil {
		for _, e := range entries {
			if n := e.Name(); strings.HasPrefix(n, preRestorePrefix) && n != preBase {
				if err := os.RemoveAll(filepath.Join(s.DataDir, n)); err != nil {
					olog.Warnf(olog.CodeBackupCleanup, "[backup] could not drop old safety copy %s: %v", n, err)
				}
			}
		}
	}
	olog.Alertf("[backup] RESTORE applied from %s — previous data kept in %s", label, preDir)
	// The caller's session may not exist in the restored database.
	http.SetCookie(w, s.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Restore complete — log in again."})
}

// restoreFromUpload streams an uploaded archive to disk, then runs the shared
// restore core over it. It acquires backupMu up front (fail-fast 409) and holds
// it across the whole upload+swap, and clears both the read and write deadlines —
// a multi-GB upload outlives the server's 30s ReadTimeout / 60s WriteTimeout.
// requireConfirm gates the swap on a leading confirm=RESTORE form field (the
// admin path; onboarding has nothing to lose and skips it). guard is passed
// through to the core's last-moment re-check.
func (s *Server) restoreFromUpload(w http.ResponseWriter, r *http.Request, requireConfirm bool, requestedBy string, guard func() error) {
	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()

	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Time{})
	_ = rc.SetWriteDeadline(time.Time{})
	r.Body = http.MaxBytesReader(w, r.Body, maxRestoreUpload)

	staging, err := os.MkdirTemp(s.DataDir, ".restore-")
	if err != nil {
		olog.Errorf(olog.CodeBackupUpload, "[backup] restore upload staging dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer os.RemoveAll(staging)
	archive := filepath.Join(staging, "upload.tar.gz")

	if code, msg := spoolUpload(r, archive, requireConfirm); code != 0 {
		writeErr(w, code, msg)
		return
	}
	s.restoreArchive(w, archive, "uploaded archive", requestedBy, guard)
}

// spoolUpload streams a multipart restore upload's `file` part to dest. When
// requireConfirm, success is gated on a `confirm` field equal to RESTORE (the
// admin "type RESTORE" guard; onboarding has nothing to lose and skips it).
// Field order does not matter — the confirmation is evaluated once every part has
// been read, so any client's ordering works — and the irreversible swap (in
// restoreArchive) runs only when this returns success. Returns (0, "") on success
// or an HTTP status + message; it writes nothing outside dest, whose contents the
// caller validates afterward.
func spoolUpload(r *http.Request, dest string, requireConfirm bool) (int, string) {
	mr, err := r.MultipartReader()
	if err != nil {
		return http.StatusBadRequest, "expected a multipart/form-data upload with a backup file"
	}
	confirmed := !requireConfirm
	gotFile := false
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			if isMaxBytes(err) {
				return http.StatusRequestEntityTooLarge, "the backup file is too large"
			}
			return http.StatusBadRequest, "the upload could not be read"
		}
		switch part.FormName() {
		case "confirm":
			val, _ := io.ReadAll(io.LimitReader(part, 64))
			if strings.TrimSpace(string(val)) == "RESTORE" {
				confirmed = true
			}
		case "file":
			out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
			if err != nil {
				_ = part.Close()
				olog.Errorf(olog.CodeBackupUpload, "[backup] spool upload: %v", err)
				return http.StatusInternalServerError, "internal error"
			}
			_, cerr := io.Copy(out, part)
			if cerr == nil {
				cerr = out.Close()
			} else {
				out.Close()
			}
			if cerr != nil {
				_ = part.Close()
				if isMaxBytes(cerr) {
					return http.StatusRequestEntityTooLarge, "the backup file is too large"
				}
				olog.Errorf(olog.CodeBackupUpload, "[backup] spool upload: %v", cerr)
				return http.StatusInternalServerError, "the uploaded file could not be saved"
			}
			gotFile = true
		}
		_ = part.Close()
	}
	if requireConfirm && !confirmed {
		return http.StatusBadRequest, `confirmation required: send a "confirm" field set to RESTORE`
	}
	if !gotFile {
		return http.StatusBadRequest, `no backup file uploaded (send it as the "file" field)`
	}
	return 0, ""
}

// isMaxBytes reports whether err is the sentinel http.MaxBytesReader raises when
// the request body exceeds maxRestoreUpload (surfaced to the client as a 413).
func isMaxBytes(err error) bool {
	var mbe *http.MaxBytesError
	return errors.As(err, &mbe)
}

// extractBackup unpacks archive into stage with hard protections. Returns a
// non-zero HTTP status + message on failure (400 hostile/malformed, 500 I/O).
func (s *Server) extractBackup(archive, stage string) (int, string) {
	f, err := os.Open(archive)
	if err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] open archive: %v", err)
		return http.StatusInternalServerError, "internal error"
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return http.StatusBadRequest, "the backup archive is not a valid tar.gz"
	}
	defer gz.Close()
	if err := os.MkdirAll(stage, 0o700); err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] make stage dir: %v", err)
		return http.StatusInternalServerError, "internal error"
	}

	tr := tar.NewReader(gz)
	var entries, total int64
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return 0, ""
		}
		if err != nil {
			return http.StatusBadRequest, "the backup archive is corrupt or truncated"
		}
		if entries++; entries > maxRestoreEntries {
			return http.StatusBadRequest, "the backup archive has too many entries"
		}
		name := hdr.Name
		if strings.Contains(name, `\`) || strings.Contains(name, ":") {
			return http.StatusBadRequest, "the backup archive contains an unsafe path"
		}
		clean := path.Clean(name)
		if clean == "." || path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
			if hdr.Typeflag == tar.TypeDir && clean == "." {
				continue
			}
			return http.StatusBadRequest, "the backup archive contains an unsafe path"
		}
		dest := filepath.Join(stage, filepath.FromSlash(clean))
		if dest != stage && !strings.HasPrefix(dest, stage+string(filepath.Separator)) {
			return http.StatusBadRequest, "the backup archive contains an unsafe path"
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(dest, 0o700); err != nil {
				olog.Errorf(olog.CodeBackupExtract, "[backup] extract dir %s: %v", clean, err)
				return http.StatusInternalServerError, "internal error"
			}
		case tar.TypeReg:
			if total += hdr.Size; total > maxRestoreBytes {
				return http.StatusBadRequest, "the backup archive expands too large"
			}
			if err := os.MkdirAll(filepath.Dir(dest), 0o700); err != nil {
				olog.Errorf(olog.CodeBackupExtract, "[backup] extract parent %s: %v", clean, err)
				return http.StatusInternalServerError, "internal error"
			}
			out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
			if err != nil {
				olog.Errorf(olog.CodeBackupExtract, "[backup] extract %s: %v", clean, err)
				return http.StatusInternalServerError, "internal error"
			}
			_, cerr := io.Copy(out, io.LimitReader(tr, maxRestoreBytes+1))
			if cerr == nil {
				cerr = out.Close()
			} else {
				out.Close()
			}
			if cerr != nil {
				olog.Errorf(olog.CodeBackupExtract, "[backup] extract %s: %v", clean, cerr)
				return http.StatusInternalServerError, "internal error"
			}
		default:
			// Symlinks, hard links, devices, FIFOs: a Tippani backup never
			// contains them — the archive is hostile or foreign.
			return http.StatusBadRequest, "the backup archive contains an unsupported entry type"
		}
	}
}

// validateRestoredDB sanity-checks the staged database before anything live is
// touched. Empty string = valid; anything else is the 400 message.
func validateRestoredDB(dbPath string) string {
	f, err := os.Open(dbPath)
	if err != nil {
		return "the backup archive has no tippani.db at its root"
	}
	header := make([]byte, 16)
	_, rerr := io.ReadFull(f, header)
	f.Close()
	if rerr != nil || string(header) != "SQLite format 3\x00" {
		return "the backup's tippani.db is not a SQLite database"
	}
	db, err := sql.Open("sqlite", "file:"+dbPath+"?mode=ro")
	if err != nil {
		return "the backup's tippani.db could not be opened"
	}
	defer db.Close()
	var check string
	if err := db.QueryRow(`PRAGMA quick_check`).Scan(&check); err != nil || strings.TrimSpace(check) != "ok" {
		return "the backup's tippani.db fails its integrity check"
	}
	var version int
	// No schema_version table (ancient/foreign file) reads as 0 — restorable.
	_ = db.QueryRow(`SELECT COALESCE(MAX(version),0) FROM schema_version`).Scan(&version)
	if max, err := store.MaxMigrationVersion(); err == nil && version > max {
		return "this backup was made by a newer Tippani — update the server first, then restore"
	}
	return ""
}

// moveTopLevel renames every non-control top-level entry of dir into destDir.
func (s *Server) moveTopLevel(dir, destDir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if s.controlEntry(e.Name()) {
			continue
		}
		if err := renameWithRetry(filepath.Join(dir, e.Name()), filepath.Join(destDir, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// moveEntries renames every entry of dir into destDir (same volume → atomic).
func moveEntries(dir, destDir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if err := renameWithRetry(filepath.Join(dir, e.Name()), filepath.Join(destDir, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// renameWithRetry tolerates Windows briefly holding handles (the same lag
// store.removeWithRetry absorbs after closing the database).
func renameWithRetry(from, to string) error {
	var err error
	for i := 0; i < 10; i++ {
		if err = os.Rename(from, to); err == nil {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("rename %s -> %s: %w", from, to, err)
}

// CleanupBackupStaging removes orphaned backup/restore staging dirs left by a
// crash mid-operation. Called from serve() at boot; .pre-restore-* safety
// copies are deliberately kept.
func CleanupBackupStaging(dataDir string) {
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		n := e.Name()
		if strings.HasPrefix(n, ".backup-") || strings.HasPrefix(n, ".restore-") {
			if err := os.RemoveAll(filepath.Join(dataDir, n)); err != nil {
				olog.Warnf(olog.CodeBackupCleanup, "[backup] could not remove orphaned staging %s: %v", n, err)
			} else {
				olog.Printf("[backup] removed orphaned staging %s", n)
			}
		}
	}
}
