package httpapi

import (
	"crypto/rand"
	"errors"
	"os"
	"path/filepath"

	"tippani/internal/olog"
)

// The instance recovery key (1.4.2) — what makes "my current password opens every
// archive this box ever made" true.
//
// THE PROBLEM. Until 1.4.2 an archive's key came from the password that was
// current when it was written, so changing your password orphaned every archive
// made before the change. The archive is a file on a laptop; its key was a string
// you have stopped using and may not remember.
//
// WHAT THIS IS. 32 random bytes in <DataDir>/.recovery-key. Every archive's header
// carries its own archive key sealed under these bytes as well as under the typed
// password (backup_crypto.go), so a restore has two ways in and only one of them
// depends on which password was current at seal time.
//
// WHY A FILE, and not a column. Two earlier designs were wrong in the same way,
// and the way is instructive.
//
//	in users.recovery_wrap    A restore replaces the users table wholesale, so
//	                          restoring ANY archive — or a factory reset, or
//	                          deleting the account — silently destroyed the key,
//	                          and with it every existing archive's second way in.
//	                          The only surviving copy went to .pre-restore-<ts>,
//	                          which the NEXT restore deletes. Two of the most
//	                          ordinary operations there are, in order, and no
//	                          error at any point.
//	wrapped under a password  Re-wrapping needs both plaintexts, which the HTTP
//	                          password-change handler has and `tippani user passwd`
//	                          — the only forgot-my-password route on a self-hosted
//	                          box — does not. So the documented recovery path
//	                          destroyed the recovery key, at exactly the moment it
//	                          was needed.
//
// A file in the data directory has neither failure. controlEntry() lists it, which
// buys both halves of what it needs from one line: writeBackupArchive skips
// control entries, so the key never travels inside the archive it opens (an
// archive carrying its own key is not an encrypted archive); and moveTopLevel
// skips them too, so a restore swaps the whole data directory around it and the
// key survives. A factory reset deletes the database and leaves it, which is
// deliberate — "I reset to clear a corrupt database, now let me restore last
// night's archive" is the scenario a recovery key exists for.
//
// WHAT GUARDS IT. Not encryption: the key sits in the clear beside the database it
// protects, because anyone who can read one can read the other, and the envelope
// exists to defend the archive once it LEAVES the box. What guards a restore is
// unchanged from 1.4.1 — an admin session, plus a password the server verifies —
// so the recovery path still costs a deliberate act, it just no longer costs the
// right act to be impossible.
//
// It is never logged, never returned by any endpoint, and never included in a
// backup. The only thing the API says about it is whether an archive can be
// recovered on this box, which is a boolean.
const recoveryKeyFile = ".recovery-key"

func (s *Server) recoveryKeyPath() string { return filepath.Join(s.DataDir, recoveryKeyFile) }

// loadRecoveryKey returns this instance's recovery key, or nil when the file does
// not exist yet (no backup has been made on this box). A file of the wrong length
// is an error, not a silently-tolerated key: a truncated key would seal archives
// nothing could open.
func (s *Server) loadRecoveryKey() ([]byte, error) {
	b, err := os.ReadFile(s.recoveryKeyPath())
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(b) != backupKeyLen {
		return nil, errors.New("the instance recovery key file is corrupt (wrong length)")
	}
	return b, nil
}

// ensureRecoveryKey returns the instance recovery key, creating it on first use.
//
// Written 0600 and via a temp file + rename, so a crash mid-write cannot leave a
// half-written key that would seal an unopenable archive. Never rotated: rotating
// would orphan every archive already sealed under the old bytes, which is the
// exact failure this whole file exists to prevent.
func (s *Server) ensureRecoveryKey() ([]byte, error) {
	if key, err := s.loadRecoveryKey(); err != nil || key != nil {
		return key, err
	}
	key := make([]byte, backupKeyLen)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp(s.DataDir, recoveryKeyFile+".new-")
	if err != nil {
		return nil, err
	}
	name := tmp.Name()
	if _, err := tmp.Write(key); err != nil {
		tmp.Close()
		_ = os.Remove(name)
		return nil, err
	}
	if err := tmp.Chmod(0o600); err != nil {
		// Windows has no mode bits to speak of; a failure here is not fatal.
		olog.Warnf(olog.CodeBackupArchive, "[backup] could not chmod the recovery key: %v", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return nil, err
	}
	if err := renameWithRetry(name, s.recoveryKeyPath()); err != nil {
		_ = os.Remove(name)
		return nil, err
	}
	// Says that a key now exists, and nothing about what it is.
	olog.Printf("[backup] instance recovery key created — archives sealed from now on can be restored on this box with any admin password")
	return key, nil
}
