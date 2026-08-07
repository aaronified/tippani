package httpapi

import (
	"archive/tar"
	"compress/gzip"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"tippani/internal/auth"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// Backup & restore (§ backup, .claude/plans/backup-restore-plan.md, adjusted):
// backups are created SERVER-SIDE into <DataDir>/backups — a tar.gz holding a
// VACUUM INTO snapshot of the database plus everything else in the data dir —
// and only the newest one is kept (its date is its name). The file is served
// for download, and restore replaces the whole data dir from that kept archive
// in-process: no Docker socket, no container recreation.
//
// Since 1.4.1 that tar.gz is sealed inside an AES-256-GCM envelope keyed off the
// operator's own credentials — see backup_crypto.go for the format and for why
// the key is not a constant in the binary. Archives written before 1.4.1 are
// plain gzip and still restore: openArchive sniffs which it is holding.

const (
	backupsDirName   = "backups"
	backupPrefix     = "tippani-backup-"
	backupTimeLayout = "20060102-150405"
	preRestorePrefix = ".pre-restore-"

	// The extension changed with the envelope. Calling a sealed archive ".tar.gz"
	// would be a lie that costs someone an afternoon: gunzip refuses it, and the
	// error says nothing about why. ".tpbk" says what it is. Pre-1.4.1 archives
	// keep their name and keep restoring — an operator who dropped one into
	// <data>/backups for the first-run restore path must not be stranded by a
	// server upgrade.
	backupExt       = ".tpbk"
	backupLegacyExt = ".tar.gz"

	maxRestoreEntries = 200_000
	maxRestoreBytes   = 8 << 30 // decompression-bomb guard
	maxRestoreUpload  = 2 << 30 // 2 GiB cap on an uploaded restore archive (413 beyond)
)

// backupCreds is what a caller offers to unlock an archive. Exactly one of the
// two paths applies, decided by the archive's own header rather than by the
// caller: Password (with Username, defaulting to the name in that header) for an
// account-keyed archive, Passphrase for a passphrase-keyed one. A pre-1.4.1 plain
// archive needs neither, and Confirm — the typed "RESTORE" — carries the intent
// in that one case, because there is no key there to stand for it.
type backupCreds struct {
	Username   string
	Password   string
	Passphrase string
	Confirm    string
}

// secretFor resolves the passphrase that opens an archive with header `h`, or an
// HTTP status + message saying what is missing.
func (c backupCreds) secretFor(h *backupHeader) (string, int, string) {
	switch h.Mode {
	case backupModePassphrase:
		if c.Passphrase == "" {
			return "", http.StatusUnauthorized, "this backup was sealed with a passphrase — enter it to restore"
		}
		return c.Passphrase, 0, ""
	case backupModeAccount:
		// The header names the account the archive was made under. A caller may
		// override it (restoring someone else's archive onto this box), but the
		// common case — your own backup — needs only the password.
		user := c.Username
		if user == "" {
			user = h.Account
		}
		if user == "" || c.Password == "" {
			return "", http.StatusUnauthorized, "this backup was sealed with an account password — enter that account and its password"
		}
		return accountSecret(user, c.Password), 0, ""
	}
	return "", http.StatusBadRequest, "the backup header names an unknown key mode"
}

// openArchive opens the archive at `path` and returns a reader over the PLAINTEXT
// tar.gz, decrypting when the archive is sealed. It reports (status, msg) on
// failure. `encrypted` tells the caller whether a key was involved, which is what
// decides whether a typed confirmation is still required.
//
// The wrong key fails HERE, before anything live has been touched: the decrypting
// reader verifies frame zero as it is constructed.
func openArchive(path string, creds backupCreds) (rc io.ReadCloser, encrypted bool, code int, msg string) {
	f, err := os.Open(path)
	if err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] open archive: %v", err)
		return nil, false, http.StatusInternalServerError, "internal error"
	}
	h, herr := readBackupHeader(f)
	if errors.Is(herr, errNotEncrypted) {
		// Pre-1.4.1 plain gzip. Rewind and hand back the raw file.
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			f.Close()
			return nil, false, http.StatusInternalServerError, "internal error"
		}
		return f, false, 0, ""
	}
	if herr != nil {
		f.Close()
		return nil, true, http.StatusBadRequest, herr.Error()
	}
	secret, code, msg := creds.secretFor(h)
	if code != 0 {
		f.Close()
		return nil, true, code, msg
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		f.Close()
		return nil, true, http.StatusInternalServerError, "internal error"
	}
	dec, _, derr := newBackupDecReader(f, secret)
	if derr != nil {
		f.Close()
		if errors.Is(derr, errBadKey) {
			return nil, true, http.StatusUnauthorized, errBadKey.Error()
		}
		return nil, true, http.StatusBadRequest, derr.Error()
	}
	return readerCloser{Reader: dec, closer: f}, true, 0, ""
}

// readerCloser pairs a derived reader with the file underneath it, so closing the
// pair closes the file.
type readerCloser struct {
	io.Reader
	closer io.Closer
}

func (r readerCloser) Close() error { return r.closer.Close() }

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

// backupName reports whether a filename is one of our archives — sealed (.tpbk)
// or pre-1.4.1 plain (.tar.gz).
func backupName(n string) bool {
	return strings.HasPrefix(n, backupPrefix) &&
		(strings.HasSuffix(n, backupExt) || strings.HasSuffix(n, backupLegacyExt))
}

// newestBackup returns the kept archive's filename and info ("" when none).
// Comparing names picks the newest because the timestamp sits at a fixed offset
// and a fixed width, so it dominates the ordering across both extensions.
func (s *Server) newestBackup() (string, os.FileInfo) {
	entries, err := os.ReadDir(s.backupsDir())
	if err != nil {
		return "", nil
	}
	newest := ""
	for _, e := range entries {
		n := e.Name()
		if e.Type().IsRegular() && backupName(n) && n > newest {
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
	stamp := strings.TrimSuffix(strings.TrimSuffix(strings.TrimPrefix(name, backupPrefix), backupExt), backupLegacyExt)
	if ts, err := time.Parse(backupTimeLayout, stamp); err == nil {
		created = ts
	}
	return map[string]any{"name": name, "created": created.Format(time.RFC3339), "size": info.Size()}
}

// backupMetaAt is backupMeta plus how the archive is keyed, read from its header.
// The UI needs this BEFORE it asks for anything: a passphrase-keyed archive must
// not be met with a password field, and an account-keyed one made under a
// different login has to name that login. `key` is "none" for a pre-1.4.1 plain
// archive, "account" (with `account`) or "passphrase".
func (s *Server) backupMetaAt(dir, name string, info os.FileInfo) map[string]any {
	m := backupMeta(name, info)
	mode, account, err := peekArchive(filepath.Join(dir, name))
	switch {
	case err != nil:
		// Unreadable header: say nothing rather than guess. The restore attempt
		// will produce the real error.
		m["key"] = "unknown"
	case mode == backupModePassphrase:
		m["key"] = "passphrase"
	case mode == backupModeAccount:
		m["key"] = "account"
		m["account"] = account
	default:
		m["key"] = "none"
	}
	return m
}

// handleBackupStatus: GET /admin/backup — {backup: {name, created, size, key,
// account?}} or {backup: null}. Feeds the Settings card: the date it shows, and
// which credential its restore prompt asks for.
func (s *Server) handleBackupStatus(w http.ResponseWriter, r *http.Request) {
	name, info := s.newestBackup()
	if name == "" {
		writeJSON(w, http.StatusOK, map[string]any{"backup": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backup": s.backupMetaAt(s.backupsDir(), name, info)})
}

// handleBackupCreate: POST /admin/backup — build a new dated, sealed archive in
// <DataDir>/backups, then drop every older one (the newest backup is always
// the only one kept). Returns the new archive's metadata.
//
// Body: {"password": "…"} to key it on the caller's own account (the default), or
// {"passphrase": "…"} to key it on a passphrase instead. The password is CHECKED
// against the stored hash before anything is written — not for authorization (the
// session already covers that) but because a typo would otherwise produce a
// perfectly valid archive that nothing can ever open, and you would not find out
// until the day you needed it.
func (s *Server) handleBackupCreate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	mode := backupModeAccount
	account := username(r)
	secret := ""
	switch {
	case req.Passphrase != "":
		if msg := passphraseProblem(req.Passphrase); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		mode = backupModePassphrase
		account = ""
		secret = req.Passphrase
	case req.Password != "":
		var hash string
		if err := s.Store.DB.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, userID(r)).Scan(&hash); err != nil {
			internalError(w, r, "look up caller", err)
			return
		}
		if !auth.CheckPassword(hash, req.Password) {
			writeErr(w, http.StatusUnauthorized, "that is not your password — the archive would be sealed with a key you could not reproduce")
			return
		}
		secret = accountSecret(account, req.Password)
	default:
		writeErr(w, http.StatusBadRequest, "confirm your password, or set a passphrase, to seal the archive")
		return
	}

	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()
	// Deliberately logs the MODE and never the key: an operator debugging "why
	// will this not open" needs to know which credential it wants, and nothing
	// more. Same reason there is no key material in any error message.
	olog.Printf("[backup] backup requested by user %d (%s), sealed with %s", userID(r), account, keyModeName(mode))

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
	name := backupPrefix + time.Now().UTC().Format(backupTimeLayout) + backupExt
	final := filepath.Join(s.backupsDir(), name)
	partial := final + ".partial"

	if err := s.writeBackupArchive(partial, snap, mode, account, secret); err != nil {
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
	// Same shape GET /admin/backup returns — including how it is keyed — so the
	// card can render the new archive without a second round trip.
	writeJSON(w, http.StatusOK, map[string]any{"backup": s.backupMetaAt(s.backupsDir(), name, info)})
}

// keyModeName names a key mode for logs and for the JSON the UI reads.
func keyModeName(mode byte) string {
	switch mode {
	case backupModeAccount:
		return "account"
	case backupModePassphrase:
		return "passphrase"
	}
	return "none"
}

// writeBackupArchive streams the snapshot + every non-control data-dir entry
// into a tar.gz at dest, sealed inside the AES-GCM envelope (backup_crypto.go).
// The layering is tar → gzip → envelope, so the archive compresses before it is
// encrypted; the other order would compress ciphertext, which does not compress.
func (s *Server) writeBackupArchive(dest, snap string, mode byte, account, secret string) error {
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	enc, err := newBackupEncWriter(out, mode, account, secret)
	if err != nil {
		out.Close()
		return err
	}
	gz := gzip.NewWriter(enc)
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
		enc.Close()
		out.Close()
		return werr
	}
	// Every Close here is checked, in order, and enc.Close() is the one that
	// matters most: it writes the frame marked final, without which the archive is
	// indistinguishable from a truncated one and will be refused on restore.
	if err := tw.Close(); err != nil {
		gz.Close()
		enc.Close()
		out.Close()
		return err
	}
	if err := gz.Close(); err != nil {
		enc.Close()
		out.Close()
		return err
	}
	if err := enc.Close(); err != nil {
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

// handleRestore: POST /admin/restore — replace the whole data dir from the kept
// archive: extract to staging with hostile-archive guards, validate the database,
// close the live DB, atomically swap, reopen (migrate + integrity + FTS heal).
// The previous data dir is kept in ONE .pre-restore-<ts> safety generation until
// the next successful restore.
//
// Body: {password, username?} or {passphrase} — whichever the archive's header
// asks for. `confirm: "RESTORE"` is required ONLY for a pre-1.4.1 plain archive:
// for a sealed one, producing the key IS the deliberate act, and asking for a
// typed word on top of a password is ceremony rather than a guard.
func (s *Server) handleRestore(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Confirm    string `json:"confirm"`
		Username   string `json:"username"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	creds := backupCreds{Username: req.Username, Password: req.Password, Passphrase: req.Passphrase, Confirm: req.Confirm}
	s.restoreFromNewest(w, fmt.Sprintf("user %d (%s)", userID(r), username(r)), nil, creds, true)
}

// handleRestoreUpload: POST /admin/restore/upload — restore from an archive the
// admin UPLOADS (typically a backup downloaded from another Tippani server),
// instead of the one kept on this server. multipart/form-data with the file part
// plus whichever credential its header wants (password/username or passphrase),
// and a confirm field only for a pre-1.4.1 plain archive. Same extract → validate
// → swap pipeline; the schema-version gate is what makes a foreign server's DB
// safe, and the envelope is what makes carrying it between boxes safe.
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
	// The archive is sealed even here: a fresh box has nothing to lose, but the
	// archive still has to be opened, so the operator supplies the credential its
	// header names. `confirm` is not required — there is nothing yet to overwrite.
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username   string `json:"username"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	creds := backupCreds{Username: req.Username, Password: req.Password, Passphrase: req.Passphrase}
	s.restoreFromNewest(w, "first-run onboarding", func() error {
		if exists, err := s.usersExist(); err != nil {
			return err
		} else if exists {
			return errOnboardingClosed
		}
		return nil
	}, creds, false)
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
// needConfirm asks the core to require a typed RESTORE for an UNSEALED archive
// (the admin path; onboarding has nothing to lose and skips it).
func (s *Server) restoreFromNewest(w http.ResponseWriter, requestedBy string, guard func() error, creds backupCreds, needConfirm bool) {
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
	s.restoreArchive(w, filepath.Join(s.backupsDir(), name), name, requestedBy, guard, creds, needConfirm)
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
func (s *Server) restoreArchive(w http.ResponseWriter, archive, label, requestedBy string, guard func() error, creds backupCreds, needConfirm bool) {
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

	// Open (and, for a sealed archive, unlock) BEFORE anything live is touched: a
	// wrong password fails here, with the current data untouched and the response
	// a plain 401.
	//
	// Every refusal below logs. The Alert above says a restore was REQUESTED, and
	// an alert with no follow-up reads as one that happened — so a failed attempt
	// has to be as visible as a successful one, not least because repeated 401s
	// here are what a brute-force attempt against an archive looks like.
	src, encrypted, code, msg := openArchive(archive, creds)
	if code != 0 {
		olog.Warnf(olog.CodeBackupExtract, "[backup] restore from %s REFUSED (%d): %s", label, code, msg)
		writeErr(w, code, msg)
		return
	}
	// An UNSEALED archive is the one case with no key to stand for intent, so the
	// typed confirmation still guards it. A sealed one does not need both.
	if needConfirm && !encrypted && creds.Confirm != "RESTORE" {
		src.Close()
		olog.Warnf(olog.CodeBackupExtract, "[backup] restore from %s refused: unsealed archive, no typed confirmation", label)
		writeErr(w, http.StatusBadRequest, `this backup predates 1.4.1 and carries no key — send {"confirm":"RESTORE"} to restore it`)
		return
	}
	extractCode, extractMsg := s.extractBackup(src, stage)
	src.Close()
	if extractCode != 0 {
		writeErr(w, extractCode, extractMsg)
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
		s.rebindDB()
		writeErr(w, http.StatusInternalServerError, "restore failed — previous data is intact")
		return
	}

	// Success: repoint the auth stores at the reopened DB, keep exactly this
	// one safety generation.
	s.rebindDB()
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
// requireConfirm asks the core to gate the swap on a typed RESTORE when — and
// only when — the uploaded archive turns out to be an UNSEALED pre-1.4.1 one (the
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
	archive := filepath.Join(staging, "upload")

	creds, code, msg := spoolUpload(r, archive)
	if code != 0 {
		writeErr(w, code, msg)
		return
	}
	s.restoreArchive(w, archive, "uploaded archive", requestedBy, guard, creds, requireConfirm)
}

// spoolUpload streams a multipart restore upload's `file` part to dest and
// collects the credential fields beside it (confirm · username · password ·
// passphrase). Field order does not matter — every part is read before anything is
// decided, so any client's ordering works — and the irreversible swap (in
// restoreArchive) runs only after the caller has validated what came back.
// Returns (creds, 0, "") on success, or an HTTP status + message; it writes
// nothing outside dest.
//
// Whether those credentials are SUFFICIENT is not decided here: that depends on
// the uploaded archive's own header, which only openArchive has read by then.
func spoolUpload(r *http.Request, dest string) (backupCreds, int, string) {
	var creds backupCreds
	mr, err := r.MultipartReader()
	if err != nil {
		return creds, http.StatusBadRequest, "expected a multipart/form-data upload with a backup file"
	}
	gotFile := false
	// Credential fields are short by construction (see the 20-character ceiling in
	// backup_crypto.go); the limit is a guard, not a policy.
	field := func(part *multipart.Part) string {
		val, _ := io.ReadAll(io.LimitReader(part, 256))
		return strings.TrimSpace(string(val))
	}
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			if isMaxBytes(err) {
				return creds, http.StatusRequestEntityTooLarge, "the backup file is too large"
			}
			return creds, http.StatusBadRequest, "the upload could not be read"
		}
		switch part.FormName() {
		case "confirm":
			creds.Confirm = field(part)
		case "username":
			creds.Username = field(part)
		case "password":
			// Never logged, here or anywhere below.
			creds.Password = field(part)
		case "passphrase":
			creds.Passphrase = field(part)
		case "file":
			out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
			if err != nil {
				_ = part.Close()
				olog.Errorf(olog.CodeBackupUpload, "[backup] spool upload: %v", err)
				return creds, http.StatusInternalServerError, "internal error"
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
					return creds, http.StatusRequestEntityTooLarge, "the backup file is too large"
				}
				olog.Errorf(olog.CodeBackupUpload, "[backup] spool upload: %v", cerr)
				return creds, http.StatusInternalServerError, "the uploaded file could not be saved"
			}
			gotFile = true
		}
		_ = part.Close()
	}
	if !gotFile {
		return creds, http.StatusBadRequest, `no backup file uploaded (send it as the "file" field)`
	}
	return creds, 0, ""
}

// isMaxBytes reports whether err is the sentinel http.MaxBytesReader raises when
// the request body exceeds maxRestoreUpload (surfaced to the client as a 413).
func isMaxBytes(err error) bool {
	var mbe *http.MaxBytesError
	return errors.As(err, &mbe)
}

// extractBackup unpacks the tar.gz arriving on src into stage with hard
// protections. Returns a non-zero HTTP status + message on failure (400
// hostile/malformed, 500 I/O).
//
// src is a PLAINTEXT stream: openArchive has already stripped the encryption
// envelope, so a sealed archive's frames are authenticated as they are read here —
// a byte altered halfway through fails during extraction rather than landing in
// stage and being swapped in.
func (s *Server) extractBackup(src io.Reader, stage string) (int, string) {
	gz, err := gzip.NewReader(src)
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
