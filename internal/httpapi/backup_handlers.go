package httpapi

import (
	"archive/tar"
	"compress/gzip"
	"context"
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
	"strconv"
	"strings"
	"sync"
	"time"

	"tippani/internal/auth"
	"tippani/internal/jobs"
	"tippani/internal/metadata"
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
// Since 1.4.1 that tar.gz is sealed inside an AES-256-GCM envelope, and since
// 1.4.2 it has two ways in: the password (or passphrase) you typed, which travels
// with the file, and this instance's recovery key, which does not travel and does
// not care which password was current when the archive was written. See
// backup_crypto.go for the format and backup_recovery.go for the key. Archives
// written before 1.4.1 are plain gzip and still restore — openArchive decides
// which of the three it is holding, once, before it tries any key.

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

// backupCreds is what a caller offers to unlock an archive: the typed secret, and
// the typed "RESTORE" for the one case that has no key to stand for intent (a
// pre-1.4.1 plain archive). Which of Password / Passphrase applies is decided by
// the archive's own header, never by the caller.
//
// RecoveryOK is the entitlement to use this instance's recovery key, and it is
// deliberately NOT inferred inside openArchive. The recovery key opens any archive
// this box made without the era password, which is the point — and it means the
// key alone must never be sufficient, or a stolen session cookie could overwrite
// the whole instance with no credential at all. (It could, briefly: the first
// draft of this handed the recovery path to anyone who asked, and the round-trip
// test caught a restore succeeding with an empty body.) The handler sets it, and
// each of the two kinds of caller earns it differently — see handleRestore and
// handleOnboardRestore.
type backupCreds struct {
	Password   string
	Passphrase string
	Confirm    string
	RecoveryOK bool
}

// secret returns the string that opens `h`'s portable wrap, or "" when the caller
// did not supply the kind this archive wants.
func (c backupCreds) secret(h *backupHeader) string {
	if h.Mode == backupModePassphrase {
		return c.Passphrase
	}
	return c.Password
}

// openArchive opens the archive at `path` and returns a reader over the PLAINTEXT
// tar.gz, decrypting when the archive is sealed. It reports (status, msg) on
// failure. `encrypted` tells the caller whether a key was involved, which is what
// decides whether a typed confirmation is still required.
//
// TWO WAYS IN, tried in this order:
//
//	portable  the typed password or passphrase, against the header's keyWrap.
//	          First because it is the one that works everywhere — on this box, on a
//	          fresh box, on any machine with the file and the credential.
//	recovery  this instance's recovery key, against the header's recWrap. Only
//	          reachable on the box that made the archive, and the reason a password
//	          CHANGE no longer orphans anything (backup_recovery.go).
//
// Both attempts read from the same header, parsed once, and neither touches the
// stream — so a failed first attempt cannot leave the reader mid-header. (An
// earlier draft re-ran the whole parse per attempt, which reported a perfectly
// good archive as "not a valid tar.gz" whenever the first key was wrong.)
//
// Everything here happens BEFORE anything live is touched, so a wrong credential
// is a 401 with the current data untouched.
func (s *Server) openArchive(path string, creds backupCreds) (rc io.ReadCloser, encrypted bool, code int, msg string) {
	f, err := os.Open(path)
	if err != nil {
		olog.Errorf(olog.CodeBackupExtract, "[backup] open archive: %v", err)
		return nil, false, http.StatusInternalServerError, "internal error"
	}
	h, herr := readBackupHeader(f)
	if errors.Is(herr, errNotEncrypted) {
		// Pre-1.4.1 plain gzip. Decided once, here, and never inferred from a
		// failed key attempt. Rewind and hand back the raw file.
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

	var archiveKey []byte
	if secret := creds.secret(h); secret != "" {
		if k, err := h.UnwrapSecret(secret); err == nil {
			archiveKey = k
		}
	}
	if archiveKey == nil && h.Recoverable() && creds.RecoveryOK {
		// The recovery path costs a credential like any other — the caller's password,
		// verified by the handler (creds.RecoveryOK). What the recovery key removes is
		// the requirement that it be the password from the archive's OWN ERA.
		if instKey, err := s.loadRecoveryKey(); err != nil {
			olog.Warnf(olog.CodeBackupExtract, "[backup] instance recovery key unreadable: %v", err)
		} else if instKey != nil {
			if k, err := h.UnwrapRecovery(instKey); err == nil {
				archiveKey = k
			}
		}
	}
	if archiveKey == nil {
		f.Close()
		return nil, true, http.StatusUnauthorized, s.badKeyMessage(h)
	}

	dec, derr := newBackupDecReader(f, h, archiveKey)
	if derr != nil {
		f.Close()
		olog.Errorf(olog.CodeBackupExtract, "[backup] frame reader: %v", derr)
		return nil, true, http.StatusInternalServerError, "internal error"
	}
	return readerCloser{Reader: dec, closer: f}, true, 0, ""
}

// badKeyMessage says what would open this archive without saying whether the
// credential just tried was close. It never distinguishes "no such account" from
// "wrong password" — that stays undifferentiated, so nothing here is an oracle —
// but it does distinguish WHICH KIND of secret is wanted, and whether this box can
// recover the archive on its own, because an operator being asked for the wrong
// kind of thing has no way to work that out from "does not open this backup".
func (s *Server) badKeyMessage(h *backupHeader) string {
	if h.Mode == backupModePassphrase {
		return "this backup was sealed with a passphrase — it is the only way in, and it is not stored anywhere"
	}
	instKey, _ := s.loadRecoveryKey()
	if h.Recoverable() && instKey != nil {
		// The recovery key was tried (or would have been) and did not fit, so the
		// archive came from somewhere else.
		// The recovery key exists and did not fit: the archive was made on a
		// different instance. Say so, or the operator retypes forever.
		return "this backup was not made on this server, so its own password is the only way in — the account it names is “" + h.Account + "”"
	}
	if h.Recoverable() {
		return "this server has no recovery key yet, so this backup needs the password that was current when it was made — the account it names is “" + h.Account + "”"
	}
	return "the password does not open this backup — it needs the one that was current when it was made"
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
//
// The instance recovery key is listed here, and both halves matter. Never
// ARCHIVED, because an archive that carries the key to itself is not an encrypted
// archive. Never SWAPPED, so a restore rearranges the whole data directory around
// it and the key survives — which is the entire reason it is a file and not a
// column (see backup_recovery.go).
func (s *Server) controlEntry(name string) bool {
	if name == backupsDirName || name == recoveryKeyFile {
		return true
	}
	for _, p := range []string{".backup-", ".restore-", preRestorePrefix, recoveryKeyFile + ".new-"} {
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
	mode, account, recoverable, err := peekArchive(filepath.Join(dir, name))
	switch {
	case err != nil:
		// Unreadable header: say nothing rather than guess. The restore attempt
		// will produce the real error.
		m["key"] = "unknown"
	case mode == backupModePassphrase:
		m["key"] = "passphrase"
	case mode == backupModePassword:
		m["key"] = "password"
		m["account"] = account
	default:
		m["key"] = "none"
	}
	// Whether THIS box can open it without the era password — a boolean, never the
	// key. It is what lets the restore prompt say "your password will open this"
	// instead of naming an account and hoping.
	if recoverable {
		if instKey, kerr := s.loadRecoveryKey(); kerr == nil && instKey != nil {
			m["recoverable"] = true
		}
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
	mode, account, secret, ok := sealCredentials(w, r)
	if !ok {
		return
	}

	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()

	// The password is verified INSIDE the lock, and after it, because a concurrent
	// password change between the check and the seal would otherwise leave an
	// archive sealed under a password that no longer exists. Verified at all — the
	// session already authorises this — because a typo would produce a perfectly
	// valid archive that nothing can ever open, and you would find out on the day
	// you needed it.
	if mode == backupModePassword && !s.passwordIsCallers(r, secret) {
		writeErr(w, http.StatusUnauthorized, "that is not your password — the archive would be sealed with a key you could not reproduce")
		return
	}
	// The API's synchronous backup runs in its request, and is kept as a job
	// like the queued one, under the same kind.
	jobs.Begin(r.Context(), "backup", "")

	// Not the request's context: a backup a reader started finishes and is kept if
	// they close the tab, as it always has. Only a queued one can be stopped.
	meta, err := s.createBackup(context.Background(), userID(r), account, mode, secret)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, backupErrorText(err))
		return
	}
	// Same shape GET /admin/backup returns — including how it is keyed — so the
	// card can render the new archive without a second round trip.
	writeJSON(w, http.StatusOK, map[string]any{"backup": meta})
	s.notifyAfter(w, r, userID(r), "backup", "Backup ready", backupReady(meta))
}

// runBackup is the backup job: the kept archive, made as POST /admin/backup
// makes it (createBackup), sealed with the credential the job was queued with,
// which the queue kept in memory for it alone (backupKey). Its result is the
// archive as GET /admin/backup describes it, and the phone is told as the route
// tells it.
//
// THE PASSWORD IS ASKED AGAIN HERE, INSIDE THE LOCK, as the route asks it: the
// job may have waited behind somebody's two-hour fill, and a password changed
// meanwhile would seal an archive under a password that no longer exists. That
// is a failure the owner reruns (with the password they have now), not a 401:
// there is no request to answer. Whether the owner is still an admin was asked
// by the queue as it claimed the job, a moment before this ran (jobs.Runner's
// execute), and is not asked twice.
//
// ANOTHER BACKUP OR A RESTORE HOLDING THE LOCK FAILS THE JOB rather than waiting
// for it: the route answers 409 to the same, and a job that waited on the lock
// would hold the queue behind a restore's upload for as long as it took.
//
// A STOP LEAVES NO ARCHIVE AND KEEPS THE OLD ONE. The archive is written under
// its partial name and promoted last; a Stop before the promote ends the writing
// between two files (or mid-file), removes the partial file and its staging, and
// the archive the server kept before is as it was (createBackup). The snapshot
// itself, VACUUM INTO, is a database call and carries no context: a Stop landing
// in it is answered as soon as it returns.
func runBackup(s *Server, ctx context.Context, j *jobs.Job) error {
	key, ok := j.Secret().(backupKey)
	if !ok {
		return errors.New("this backup has no credential to seal it with — run it again")
	}
	if !s.backupMu.TryLock() {
		return errors.New("a backup or restore is already running")
	}
	defer s.backupMu.Unlock()
	owner := j.Owner()
	account := key.account
	if key.mode == backupModePassword {
		if !s.passwordIs(owner.UserID, key.secret) {
			return errors.New("your password changed since this backup was started — run it again")
		}
		// The label says whose password opens it, and that is the account as it
		// is named now.
		account = owner.Username
	}
	meta, err := s.createBackup(ctx, owner.UserID, account, key.mode, key.secret)
	if err != nil {
		if ctx.Err() != nil {
			j.Stopping()
			j.Log(jobs.LevelInfo, "no archive was made: stopped before it was sealed, and the one kept before is as it was")
			return ctx.Err()
		}
		return errors.New(backupErrorText(err))
	}
	name, _ := meta["name"].(string)
	size, _ := meta["size"].(int64)
	j.Log(jobs.LevelInfo, "%s — sealed with %s, %s", name, sealedWith(key.mode, account), humanBytes(size))
	if err := j.SetResult(meta); err != nil {
		return err
	}
	s.notify(ctx, owner.UserID, "backup", "Backup ready", backupReady(meta))
	return nil
}

// sealedWith is what a backup's line says it was sealed with.
func sealedWith(mode byte, account string) string {
	if mode == backupModePassword {
		return account + "'s password"
	}
	return "a passphrase"
}

// backupError is a backup that could not be made: the sentence the reader is
// told, and the cause, which has been logged with its code where it happened.
// The sentence is the one the API's backup has always answered for that step, so
// a handler and a job that make an archive say the same thing about one that
// failed, and neither says more than the sentence.
type backupError struct {
	msg string
	err error
}

func (e *backupError) Error() string { return e.msg }
func (e *backupError) Unwrap() error { return e.err }

// backupErrorText is what a reader is told about a failed backup.
func backupErrorText(err error) string {
	var be *backupError
	if errors.As(err, &be) {
		return be.msg
	}
	return "internal error"
}

// createBackup makes the kept archive: a new dated archive in <DataDir>/backups,
// sealed with the credential given, promoted from its partial file, and every
// older one dropped (the newest backup is always the only one kept). It answers
// the archive as GET /admin/backup describes it.
//
// NO REQUEST IN IT. POST /admin/backup calls it in its request and the backup job
// calls it from the queue, so uid and account are the owner's, taken from
// whichever started it. The caller holds backupMu, and has checked a password
// against the account: both are the caller's because the two take the lock and
// check the password differently. The request checks the caller's password once
// it holds the lock; a queued backup checks the owner's current hash when it
// runs, since the account may have changed its password while it waited
// (backupKey).
//
// ctx is a queued backup's, which a Stop ends (runBackup): it is asked before the
// snapshot, before every file the archive takes and during each, and last before
// the promote. Ended at any of them, nothing is promoted and the partial file is
// removed, and its error is ctx's, unlogged — a Stop is not a failure.
func (s *Server) createBackup(ctx context.Context, uid int64, account string, mode byte, secret string) (map[string]any, error) {
	if err := os.MkdirAll(s.backupsDir(), 0o700); err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] backups dir: %v", err)
		return nil, &backupError{"internal error", err}
	}
	name := backupPrefix + time.Now().UTC().Format(backupTimeLayout) + backupExt
	final := filepath.Join(s.backupsDir(), name)
	partial := final + ".partial"
	if err := s.sealArchive(ctx, uid, account, mode, secret, partial); err != nil {
		return nil, err
	}
	// The last step a Stop can land before: after it, the archive is the kept one.
	if err := s.backupStep(ctx, "promote"); err != nil {
		_ = os.Remove(partial)
		return nil, err
	}
	_ = os.Remove(final) // same-second re-create: Windows rename won't overwrite
	if err := os.Rename(partial, final); err != nil {
		_ = os.Remove(partial)
		olog.Errorf(olog.CodeBackupArchive, "[backup] promote archive: %v", err)
		return nil, &backupError{"backup archive could not be written", err}
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
		return nil, &backupError{"internal error", err}
	}
	olog.Printf("[backup] created %s (%d bytes)", name, info.Size())
	return s.backupMetaAt(s.backupsDir(), name, info), nil
}

// backupReady is what a new kept archive's notification says, whoever made it.
func backupReady(meta map[string]any) string {
	name, _ := meta["name"].(string)
	size, _ := meta["size"].(int64)
	return name + " (" + humanBytes(size) + ") is on the server."
}

// backupStep is where a backup asks whether to go on: before its snapshot
// ("snapshot"), before each file it archives ("file"), before each read of a
// file's copy ("copy", ctxReader) and before its promote ("promote").
// backupSeam runs first, when a test has set it.
func (s *Server) backupStep(ctx context.Context, step string) error {
	if s.backupSeam != nil {
		s.backupSeam(ctx, step)
	}
	return ctx.Err()
}

// ctxReader is r, ended by ctx: a Stop landing in the middle of a large file —
// the snapshot of a big library, on a slow disk — ends the copy there, not at
// the file's end. Each read is a step of the backup's ("copy").
type ctxReader struct {
	s   *Server
	ctx context.Context
	r   io.Reader
}

func (c ctxReader) Read(p []byte) (int, error) {
	if err := c.s.backupStep(c.ctx, "copy"); err != nil {
		return 0, err
	}
	return c.r.Read(p)
}

// sealArchive snapshots the live database and writes it, sealed with the chosen
// credential, to dest, for account uid. Its caller holds backupMu and has
// verified the credential. Its errors are *backupError, logged here, or ctx's
// (createBackup), with dest and the staging removed.
func (s *Server) sealArchive(ctx context.Context, uid int64, account string, mode byte, secret, dest string) error {
	if err := s.backupStep(ctx, "snapshot"); err != nil {
		return err
	}
	// The instance recovery key, created on first use. Taken BEFORE the snapshot
	// on purpose: it must exist and be settled on disk before anything is written,
	// and it is deliberately NOT inside the snapshot (controlEntry excludes it), so
	// no archive ever carries the key that opens it. A passphrase archive gets none
	// — that is what choosing a passphrase means.
	var instKey []byte
	if mode == backupModePassword {
		var err error
		if instKey, err = s.ensureRecoveryKey(); err != nil {
			olog.Errorf(olog.CodeBackupArchive, "[backup] recovery key: %v", err)
			return &backupError{"the instance recovery key could not be read or created", err}
		}
	}
	// Deliberately logs the MODE and never the key: an operator debugging "why
	// will this not open" needs to know which credential it wants, and nothing
	// more. Same reason there is no key material in any error message.
	olog.Printf("[backup] backup requested by user %d (%s), sealed with %s", uid, account, keyModeName(mode))

	staging, err := os.MkdirTemp(s.DataDir, ".backup-")
	if err != nil {
		olog.Errorf(olog.CodeBackupArchive, "[backup] staging dir: %v", err)
		return &backupError{"internal error", err}
	}
	defer os.RemoveAll(staging)

	// Consistent live snapshot: VACUUM INTO (no WAL sidecars, writers unaffected).
	snap := filepath.Join(staging, "tippani.db")
	if err := s.Store.VacuumInto(snap); err != nil {
		olog.Errorf(olog.CodeBackupSnapshot, "[backup] snapshot failed: %v", err)
		return &backupError{"database snapshot failed", err}
	}
	// Without the job history and the system log, which belong to this server
	// rather than to the library (store.StripJournal says why). Failing to strip
	// fails the backup: an archive is a file that leaves the server, and the log
	// holds every request anybody made.
	if err := store.StripJournal(snap); err != nil {
		olog.Errorf(olog.CodeBackupStrip, "[backup] could not leave the job history and logs out of the snapshot: %v", err)
		return &backupError{"database snapshot failed", err}
	}

	if err := s.writeBackupArchive(ctx, dest, snap, mode, account, secret, instKey); err != nil {
		_ = os.Remove(dest)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		olog.Errorf(olog.CodeBackupArchive, "[backup] archive write failed: %v", err)
		return &backupError{"backup archive could not be written", err}
	}
	return nil
}

// sealCredentials reads how an archive is to be sealed: the caller's password, or
// a passphrase of their choosing. It writes its own 400; false means it did.
func sealCredentials(w http.ResponseWriter, r *http.Request) (mode byte, account, secret string, ok bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	mode, account, secret, msg := sealWith(req.Password, req.Passphrase, username(r))
	if msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return 0, "", "", false
	}
	return mode, account, secret, true
}

// sealWith is how an archive is to be sealed, from what the caller sent: the
// passphrase when there is one, else account's password. msg is the 400 when
// neither will do. The API's backup and the backup job read it the same way, so a
// credential one accepts the other does too; whether a password is really the
// account's is the caller's to check.
func sealWith(password, passphrase, account string) (mode byte, acct, secret, msg string) {
	switch {
	case passphrase != "":
		if msg := passphraseProblem(passphrase); msg != "" {
			return 0, "", "", msg
		}
		return backupModePassphrase, "", passphrase, ""
	case password != "":
		return backupModePassword, account, password, ""
	}
	return 0, "", "", "confirm your password, or set a passphrase, to seal the archive"
}

// SAFETY BACKUP — THE COPY TAKEN ON THE WAY TO A RESTORE OR A RESET. The owner:
// an admin "must take a backup and download it before this can be done (as part
// of the process of the reset)". It is streamed to the admin and NEVER KEPT: the
// server keeps one archive, and a restore from the kept one would otherwise
// restore the copy just taken of what it is about to replace. The server notes
// that the download finished, for that admin, and restore and reset refuse
// without a note younger than safetyBackupTTL, and a successful one spends it.
// The note lives in memory, so a restart forgets it and the next attempt asks
// again: failing closed.
const safetyBackupTTL = 30 * time.Minute

type safetyNote struct {
	mu  sync.Mutex
	uid int64
	at  time.Time
}

func (n *safetyNote) set(uid int64) {
	n.mu.Lock()
	n.uid, n.at = uid, time.Now()
	n.mu.Unlock()
}

// fresh reports whether uid downloaded a safety backup within safetyBackupTTL.
func (n *safetyNote) fresh(uid int64) bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.uid == uid && time.Since(n.at) < safetyBackupTTL
}

// clear spends the note: one download buys one restore or reset.
func (n *safetyNote) clear() {
	n.mu.Lock()
	n.uid, n.at = 0, time.Time{}
	n.mu.Unlock()
}

// errNoSafetyBackup is the refusal restore and reset answer without one.
const errNoSafetyBackup = "download a fresh backup first — this replaces everything on the server"

// errSafetySpent is what the last-moment guard returns when the note went stale
// or was spent between the early check and backupMu: the early check runs first,
// so a restore that finished in between has already used the copy this one
// was relying on.
var errSafetySpent = errors.New(errNoSafetyBackup)

// safetyGuard re-reads the note under backupMu, for restoreArchive's late check.
func (s *Server) safetyGuard(uid int64) func() error {
	return func() error {
		if !s.safety.fresh(uid) {
			return errSafetySpent
		}
		return nil
	}
}

func (s *Server) handleSafetyBackup(w http.ResponseWriter, r *http.Request) {
	mode, account, secret, ok := sealCredentials(w, r)
	if !ok {
		return
	}
	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a backup or restore is already running")
		return
	}
	defer s.backupMu.Unlock()
	if mode == backupModePassword && !s.passwordIsCallers(r, secret) {
		writeErr(w, http.StatusUnauthorized, "that is not your password — the archive would be sealed with a key you could not reproduce")
		return
	}
	jobs.Begin(r.Context(), "backup.safety", "")
	tmp, err := os.CreateTemp(s.DataDir, ".safety-*"+backupExt)
	if err != nil {
		internalError(w, r, "safety backup temp", err)
		return
	}
	dest := tmp.Name()
	_ = tmp.Close()
	defer os.Remove(dest)
	if err := s.sealArchive(context.Background(), userID(r), account, mode, secret, dest); err != nil {
		writeErr(w, http.StatusInternalServerError, backupErrorText(err))
		return
	}
	f, err := os.Open(dest)
	if err != nil {
		internalError(w, r, "open safety backup", err)
		return
	}
	defer f.Close()
	info, _ := f.Stat()
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	name := backupPrefix + time.Now().UTC().Format(backupTimeLayout) + "-safety-copy" + backupExt
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	if info != nil {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	}
	// NOTED ONLY WHEN THE WHOLE FILE LEFT. A copy that stopped halfway is not a
	// backup, and the note is what lets the destructive step run.
	if _, err := io.Copy(w, f); err != nil {
		olog.Warnf(olog.CodeBackupArchive, "[backup] safety backup download cut short: %v", err)
		return
	}
	s.safety.set(userID(r))
	olog.Printf("[backup] safety backup downloaded by user %d (%s)", userID(r), username(r))
}

// humanBytes is a size for a sentence: one decimal, binary units.
func humanBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGTPE"[exp])
}

// keyModeName names a key mode for logs and for the JSON the UI reads.
func keyModeName(mode byte) string {
	switch mode {
	case backupModePassword:
		return "password"
	case backupModePassphrase:
		return "passphrase"
	}
	return "none"
}

// writeBackupArchive streams the snapshot + every non-control data-dir entry
// into a tar.gz at dest, sealed inside the AES-GCM envelope (backup_crypto.go).
// The layering is tar → gzip → envelope, so the archive compresses before it is
// encrypted; the other order would compress ciphertext, which does not compress.
func (s *Server) writeBackupArchive(ctx context.Context, dest, snap string, mode byte, account, secret string, instKey []byte) error {
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	enc, err := newBackupEncWriter(out, mode, account, secret, instKey)
	if err != nil {
		out.Close()
		return err
	}
	gz := gzip.NewWriter(enc)
	tw := tar.NewWriter(gz)

	addFile := func(src, name string) error {
		if err := s.backupStep(ctx, "file"); err != nil {
			return err
		}
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
		_, err = io.Copy(tw, ctxReader{s, ctx, f})
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
				if strings.HasPrefix(d.Name(), metadata.DownloadPrefix) {
					return nil // a picture still arriving is not a picture yet
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
	if !s.safety.fresh(userID(r)) {
		writeErr(w, http.StatusPreconditionRequired, errNoSafetyBackup)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Confirm    string `json:"confirm"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	creds := backupCreds{Password: req.Password, Passphrase: req.Passphrase, Confirm: req.Confirm}
	creds.RecoveryOK = s.passwordIsCallers(r, req.Password)
	s.withQueueHeld(w, func() {
		s.restoreFromNewest(w, r, fmt.Sprintf("user %d (%s)", userID(r), username(r)), s.safetyGuard(userID(r)), creds, true)
	})
}

// handleRestoreUpload: POST /admin/restore/upload — restore from an archive the
// admin UPLOADS (typically a backup downloaded from another Tippani server),
// instead of the one kept on this server. multipart/form-data with the file part
// plus whichever credential its header wants (password/username or passphrase),
// and a confirm field only for a pre-1.4.1 plain archive. Same extract → validate
// → swap pipeline; the schema-version gate is what makes a foreign server's DB
// safe, and the envelope is what makes carrying it between boxes safe.
func (s *Server) handleRestoreUpload(w http.ResponseWriter, r *http.Request) {
	if !s.safety.fresh(userID(r)) {
		writeErr(w, http.StatusPreconditionRequired, errNoSafetyBackup)
		return
	}
	// Held from before the upload is read, not only around the swap: a job that
	// started while a large archive uploaded would fail the restore at its last
	// step, after the whole upload, where refusing now costs nothing.
	s.withQueueHeld(w, func() {
		s.restoreFromUpload(w, r, true, fmt.Sprintf("user %d (%s)", userID(r), username(r)), s.safetyGuard(userID(r)))
	})
}

// passwordIsCallers reports whether `pw` is the caller's own current password.
//
// This is what earns the recovery path on the admin routes. The session already
// says who you are; this says you are present and meant it — the same role the
// typed "RESTORE" played in 1.4.1, discharged by something that cannot be guessed
// from the shape of the dialog. An empty password never qualifies.
func (s *Server) passwordIsCallers(r *http.Request, pw string) bool {
	return s.passwordIs(userID(r), pw)
}

// passwordIs reports whether pw is account uid's current password; an empty one
// never is. passwordIsCallers is it for the request's own account; the backup job
// asks it of the account that queued it.
func (s *Server) passwordIs(uid int64, pw string) bool {
	if pw == "" {
		return false
	}
	var hash string
	if err := s.Store.DB.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, uid).Scan(&hash); err != nil {
		return false
	}
	return auth.CheckPassword(hash, pw)
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
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	// The recovery path is free here, and it has to be: there are no users, so there
	// is no password to verify against and nothing a hijacked session could take.
	// It is also the one thing that makes "factory-reset a corrupt database, then
	// restore last night's archive" work — the reset deletes the database and leaves
	// the recovery key, so the archive is still openable without the era password.
	creds := backupCreds{Password: req.Password, Passphrase: req.Passphrase, RecoveryOK: true}
	s.restoreFromNewest(w, r, "first-run onboarding", func() error {
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
func (s *Server) restoreFromNewest(w http.ResponseWriter, r *http.Request, requestedBy string, guard func() error, creds backupCreds, needConfirm bool) {
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
	// Kept as a job from here, whatever becomes of it: a restore that fails at
	// the password is as much worth finding in Past jobs as one that swapped.
	// Its row lands after the swap, in the restored file, with no owner (the
	// account it was pressed under belongs to the replaced one), so it is the
	// admin's to see.
	jobs.Begin(r.Context(), "restore", name)
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
	src, encrypted, code, msg := s.openArchive(archive, creds)
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

	// Last-moment re-guard, still holding backupMu. Onboarding: a signup can only
	// have committed while the lock was free, so re-checking now sees it. Admin:
	// a restore that finished between this one's first check and the lock has
	// spent the safety note.
	if guard != nil {
		if err := guard(); err != nil {
			if errors.Is(err, errOnboardingClosed) {
				writeErr(w, http.StatusConflict, err.Error())
			} else if errors.Is(err, errSafetySpent) {
				writeErr(w, http.StatusPreconditionRequired, err.Error())
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
	// ONE CALL HOLDS THE WHOLE SWAP: the move, the reopen, the carry-over and,
	// when any fails, the rollback, under the store's swap lock (store.Swap). It
	// used to be a close, a move and a reopen as three separate calls, with a
	// second reopen for the rollback, and the logbook's writer would have been
	// free to write into the data dir halfway through the move.
	//
	// The database being replaced lands here, and the carry-over reads the job
	// history and the system log back out of it. The directory is kept until the
	// NEXT restore's cleanup, so it is still there when the carry-over runs, its
	// -wal beside it if the pre-swap checkpoint left one.
	replaced := filepath.Join(preDir, filepath.Base(s.Store.Path()))
	// Whether the move got all of the current data out of the way. The rollback
	// clears the data dir for the old files only once it has (see there).
	asideDone := false
	swapErr := s.Store.Swap(
		func() error {
			if err := s.moveTopLevel(s.DataDir, preDir); err != nil {
				return fmt.Errorf("move current data aside: %w", err)
			}
			asideDone = true
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
			return nil
		},
		// Once the move had everything aside, whatever is in the data dir came from
		// the archive or from opening it (a -wal, a .recover), and all of it goes to
		// staging/failed before the old files come back, so none of it lands beside
		// them. Before that, what is there is live data the move never reached — the
		// database itself, when the entry that failed sorts before it — and it stays
		// where it is. The rollback used to clear the data dir either way, which
		// sent the live database into staging/failed, and nothing keeps that: this
		// function removes staging on its way out, and after a crash the boot sweep
		// (CleanupBackupStaging) does. Meanwhile the store came back on an empty
		// database and the restore answered "previous data is intact".
		func(cause error) error {
			olog.Errorf(olog.CodeBackupSwap, "[backup] restore swap failed: %v — rolling back", cause)
			if asideDone {
				failDir := filepath.Join(staging, "failed")
				if err := os.Mkdir(failDir, 0o700); err != nil {
					return err
				}
				if err := s.moveTopLevel(s.DataDir, failDir); err != nil {
					return err
				}
			}
			return moveEntries(preDir, s.DataDir)
		},
		// Keep the server's own journal, not the archive's (which is empty:
		// archives are stripped, and one from before 3.1.0 never had one). A
		// failure here costs the history and never the restore.
		func(db *sql.DB) error {
			if err := store.CarryJournal(db, replaced); err != nil {
				olog.Warnf(olog.CodeBackupCarry,
					"[backup] the job history and system log could not be carried over from %s: %v — the restored server starts with none", preDir, err)
			}
			return nil
		},
	)
	if swapErr != nil {
		var rb *store.RollbackError
		if errors.As(swapErr, &rb) {
			olog.Errorf(olog.CodeBackupRollback,
				"[backup] ROLLBACK FAILED (%v) — exiting for a clean boot; previous data is in %s", rb.Rollback, preDir)
			os.Exit(1)
		}
		s.rebindDB()
		writeErr(w, http.StatusInternalServerError, "restore failed — previous data is intact")
		return
	}

	// Success: repoint the auth stores at the reopened DB, keep exactly this
	// one safety generation, and forget every pairing code and pending sign-on
	// link issued against the accounts this restore replaced.
	s.rebindDB()
	s.forgetAccountGrants()
	// ONE DOWNLOAD, ONE REPLACEMENT. The copy covered what was here before this
	// restore; a second restore replaces what this one put back, which nobody
	// has a copy of.
	s.safety.clear()
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

// uploadIdle is how long a restore upload may send nothing before it is given
// up. A variable so the test of an upload that stops can wait a moment instead
// of a minute.
var uploadIdle = time.Minute

// idleBody reads a request body with a fresh read deadline before each read,
// uploadIdle from now: an upload may take as long as it takes, but not stop.
type idleBody struct {
	io.ReadCloser
	rc *http.ResponseController
}

func (b idleBody) Read(p []byte) (int, error) {
	_ = b.rc.SetReadDeadline(time.Now().Add(uploadIdle))
	return b.ReadCloser.Read(p)
}

// restoreFromUpload streams an uploaded archive to disk, then runs the shared
// restore core over it. It acquires backupMu up front (fail-fast 409) and holds
// it across the whole upload+swap. A multi-GB upload outlives the server's 30s
// ReadTimeout, so the read deadline moves with each read instead (idleBody), and
// is cleared once the upload is in: the swap after it can outlive it too. The
// write deadline is cleared for the whole request, for the same reason.
//
// A STALLED UPLOAD IS GIVEN UP. The admin routes run this with the job queue held
// (withQueueHeld), taken before the upload so that a job starting mid-upload
// cannot fail the restore at its last step. So while an upload sends nothing, no
// job can start and none is claimed, and an upload that stopped for good (the tab
// open, the link dead) would hold the queue until the TCP connection died. The
// read deadline is what ends it: uploadIdle of silence, and the upload is given
// up with a 408 (TIP-BACKUP-010).
//
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
	// Kept as a job, as restoreFromNewest's is; spoolUpload names it after the
	// file.
	jobs.Begin(r.Context(), "restore", "")

	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Now().Add(uploadIdle))
	_ = rc.SetWriteDeadline(time.Time{})
	r.Body = http.MaxBytesReader(w, idleBody{ReadCloser: r.Body, rc: rc}, maxRestoreUpload)

	staging, err := os.MkdirTemp(s.DataDir, ".restore-")
	if err != nil {
		olog.Errorf(olog.CodeBackupUpload, "[backup] restore upload staging dir: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer os.RemoveAll(staging)
	archive := filepath.Join(staging, "upload")

	creds, code, msg := spoolUpload(r, archive)
	// Cleared once the upload is in, whatever came of it: a deadline left on the
	// connection would cut the server's own read of it (the one that notices a
	// client leaving) in the middle of the swap.
	_ = rc.SetReadDeadline(time.Time{})
	if code != 0 {
		writeErr(w, code, msg)
		return
	}
	// requireConfirm marks the admin routes; onboarding is the other case and earns
	// the recovery path unconditionally (see handleOnboardRestore).
	creds.RecoveryOK = !requireConfirm || s.passwordIsCallers(r, creds.Password)
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
			if errors.Is(err, os.ErrDeadlineExceeded) {
				code, msg := uploadStalled(r)
				return creds, code, msg
			}
			return creds, http.StatusBadRequest, "the upload could not be read"
		}
		switch part.FormName() {
		case "confirm":
			creds.Confirm = field(part)
		case "password":
			// Never logged, here or anywhere below.
			creds.Password = field(part)
		case "passphrase":
			creds.Passphrase = field(part)
		case "file":
			if rec := jobs.From(r.Context()); rec != nil {
				rec.Subject(part.FileName())
			}
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
				if errors.Is(cerr, os.ErrDeadlineExceeded) {
					code, msg := uploadStalled(r)
					return creds, code, msg
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

// uploadStalled is spoolUpload's answer to an upload that stopped arriving
// (idleBody's deadline), logged so an operator whose restore never finished can
// find why. The client is most likely gone; the answer is for one that is not.
func uploadStalled(r *http.Request) (int, string) {
	olog.Warnf(olog.CodeBackupStalled, "[backup] a restore upload sent nothing for %s and was given up%s", uploadIdle, reqSuffix(r))
	return http.StatusRequestTimeout, "the upload stopped arriving, so it was given up; nothing was changed — upload the file again"
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
