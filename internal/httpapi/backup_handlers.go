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
	olog.Alertf("[backup] RESTORE from %s requested by user %d (%s)", name, userID(r), username(r))

	staging, err := os.MkdirTemp(s.DataDir, ".restore-")
	if err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] restore staging dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer os.RemoveAll(staging)
	stage := filepath.Join(staging, "stage")

	if code, msg := s.extractBackup(filepath.Join(s.backupsDir(), name), stage); code != 0 {
		writeErr(w, code, msg)
		return
	}
	if msg := validateRestoredDB(filepath.Join(stage, "tippani.db")); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}

	// ---- point of no return: swap ----
	if err := s.Store.CloseForSwap(); err != nil {
		olog.Alertf("[backup] closing live db before swap returned: %v (continuing)", err)
	}
	ts := time.Now().UTC().Format(backupTimeLayout)
	preDir := filepath.Join(s.DataDir, preRestorePrefix+ts)
	swapErr := func() error {
		if err := os.Mkdir(preDir, 0o700); err != nil {
			return err
		}
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
	if entries, err := os.ReadDir(s.DataDir); err == nil {
		for _, e := range entries {
			if n := e.Name(); strings.HasPrefix(n, preRestorePrefix) && n != preRestorePrefix+ts {
				if err := os.RemoveAll(filepath.Join(s.DataDir, n)); err != nil {
					olog.Warnf(olog.CodeBackupCleanup, "[backup] could not drop old safety copy %s: %v", n, err)
				}
			}
		}
	}
	olog.Alertf("[backup] RESTORE applied from %s — previous data kept in %s", name, preDir)
	// The caller's session may not exist in the restored database.
	http.SetCookie(w, s.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Restore complete — log in again."})
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
