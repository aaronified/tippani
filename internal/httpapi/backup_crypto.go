package httpapi

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"

	"golang.org/x/crypto/argon2"
)

// Backup encryption (format v2, 1.4.2).
//
// A backup archive is everything: every user's library, the password hashes, the
// metadata API keys. It left the server as a plain tar.gz until 1.4.1, which is
// fine while it sits in <DataDir>/backups and not fine the moment it is
// downloaded to a laptop, synced to a cloud drive, or mailed to yourself — which
// is exactly what a backup is for. So the archive is sealed, and the key is
// derived from something the operator knows rather than something stored beside
// the archive it protects.
//
// WHAT V2 CHANGED, and why v1 lasted an hour.
//
// v1 derived the archive's key straight from "<username>#<password>". Two faults.
//
//  1. Changing your password orphaned every archive made before the change.
//     The archive is a file; its key was a string you had stopped using. This
//     is the footgun v2 exists to close, and it closes it with the recovery key
//     described below rather than by weakening the cipher.
//  2. That secret was ambiguous. The comment asserting "#" could not appear in
//     an account name was simply false — normalizeUsername rejects only empty,
//     over-long, whitespace and control characters — so accountSecret("a#b","cd")
//     and accountSecret("a","b#cd") derived the SAME key. Harmless in practice
//     (no v1 archive was ever made outside this repo's tests) and gone now: the
//     username is not an input to the key at all.
//
// A note on a claim v1 made and v2 should not repeat: a RENAME never orphaned an
// archive. The account name was written into the header at seal time and the
// restore path defaults to it, so an archive made as "alice" still opened as
// "arani" with the era password. What a rename broke was the dialog's label,
// which called your own archive somebody else's. v2 makes the name a label in
// fact as well as in intent.
//
// TWO WAYS IN, and this is the whole point of the format:
//
//	keyWrap   the archive key sealed under Argon2id(secret, per-archive salt),
//	          where secret is your PASSWORD (mode 1) or a passphrase you chose
//	          (mode 2). Portable: it travels with the file and opens it on any
//	          Tippani, on any machine, with no database — which is what makes a
//	          backup a backup.
//	recWrap   the same archive key sealed under this INSTANCE's recovery key
//	          (backup_recovery.go): 32 random bytes in a file inside the data
//	          directory that is deliberately never archived and never swapped out
//	          by a restore. It is what makes "my current password opens every
//	          archive this box ever made" true, because it does not depend on
//	          which password was current when the archive was written.
//
// Off-box, keyWrap is the only way in, so the era password still matters when you
// carry an archive to a fresh machine. That is unavoidable: the only durable
// record of an old password is the archive itself, and a design that could open
// it without one would be a design with a back door.
//
// WHAT THIS DOES NOT DO. It is not a signature: anyone who knows the credentials
// can produce a valid archive, so a restore proves the archive was made by
// someone who knew them, not by you. A stolen archive plus a guessed password is
// still a full compromise — Argon2id makes guessing expensive, not impossible.
// And anyone who can read the data directory holds both the recovery key and the
// database it protects, so the envelope defends the archive in transit and at
// rest elsewhere, never the box itself.
//
// A single fixed key compiled into the binary was considered and rejected: this
// is an MIT-licensed repository, so that constant would be public, and "encrypted
// with a published key" is a claim that reads as protection while providing none.
//
// FORMAT (v2). Bytes 0 through the ident are byte-identical to v1 ON PURPOSE:
// web/frontend/src/secret.js parses this header in the browser to decide which
// credential to ask for, by fixed offset. Appending the new fields rather than
// inserting them keeps one parser correct for both versions, and the browser
// gates on the version byte besides.
//
//	magic      4  "TPBK"
//	version    1  0x02
//	mode       1  0x01 password · 0x02 passphrase
//	salt      16  per-archive, so two archives under the same password get
//	              different keys and neither can be tested against the other
//	nonce     12  per-archive base nonce for the data frames
//	identLen   2  big-endian
//	ident    ...  the account name — A LABEL, so a restore can say whose password
//	              it wants. Empty in passphrase mode, which has nothing to name
//	              and should not hint at the key.
//	--- end of the v1-compatible prefix; it is the AAD for both wraps below ---
//	kwLen      2  big-endian
//	keyWrap  ...  nonce(12) || AES-256-GCM(Argon2id(secret, salt), archiveKey)
//	rwLen      2  big-endian, 0 when absent (passphrase mode, or no instance key)
//	recWrap  ...  nonce(12) || AES-256-GCM(instance recovery key, archiveKey)
//
// then a sequence of AES-256-GCM frames over the tar.gz, each:
//
//	final      1  0x00 · 0x01
//	ctLen      4  big-endian
//	ct       ...
//
// EVERY nonce here is 12 fresh random bytes, and both wraps carry their own.
// That is not decoration: recWrap's key is the instance recovery key, which is
// reused across every archive the box ever writes — the first key in this format
// that is NOT per-archive. Two archives sealed under one key at one nonce leak
// their plaintexts' XOR and, worse, leak GHASH's authentication subkey, which
// makes the wrap forgeable; and since the whole header is the frames' AAD, a
// forgeable wrap is a chosen-archive-key attack on the body. Nothing may derive
// a wrap nonce from the frame nonce, or from a counter, or from nothing.
//
// The frames' additional data is the WHOLE header (prefix and both wraps) plus
// the frame's counter and its final flag. That is what makes the stream
// tamper-evident rather than merely the frames: re-ordering frames breaks the
// counter, splicing frames from another archive breaks the salt binding, editing
// the header — swapping the account label, stripping recWrap to force a password
// prompt — breaks every frame, and flipping a final flag breaks that frame.
// Truncation is caught by absence: a stream that ends without a frame marked
// final is an error, not a short read. That is the failure mode that matters most
// here, because a backup silently missing its tail looks like a backup.
const (
	backupMagic = "TPBK"
	// v1 (1.4.1) is refused rather than read. It shipped for about an hour and no
	// archive of it exists outside this repository's tests; keeping a reader for it
	// would mean keeping the ambiguous "<username>#<password>" secret alive, which
	// is one of the two things v2 exists to remove.
	backupCryptoV1 = 1
	backupCryptoV2 = 2

	backupModePassword   byte = 1
	backupModePassphrase byte = 2

	backupSaltLen  = 16
	backupNonceLen = 12 // AES-GCM standard nonce
	backupKeyLen   = 32 // AES-256
	backupIdentMax = 256
	// A wrap is nonce || GCM(32-byte key) — 12 + 32 + 16.
	backupWrapLen = backupNonceLen + backupKeyLen + 16
	// The fixed part of the header, up to and including identLen.
	backupPrefixFixed = 4 + 1 + 1 + backupSaltLen + backupNonceLen + 2
	// 1 MiB plaintext frames. Big enough that the per-frame 21 bytes of overhead
	// and the AEAD setup are noise against a multi-hundred-MB archive; small
	// enough that encrypting one never needs more than a couple of MB live, which
	// matters on the ~25 MB idle-RSS budget this server holds itself to.
	backupChunk = 1 << 20
)

// Argon2id cost. Deliberately the OWASP floor (m=19 MiB, t=2, p=1) rather than
// something showier: this runs on NAS boxes whose systemd unit sets GOMEMLIMIT to
// 64 MiB, and a 64 MiB scratch buffer inside that budget would thrash the
// collector during the one operation you least want to be fragile. (internal/auth
// makes the same call for the same reason, which is why logins use bcrypt.) All
// three are FIXED, not stored: p in particular changes the output, so a portable
// archive cannot let it vary by machine. Changing any of them means a new version
// byte — and, because these parameters only ever guard the PORTABLE wrap, a
// change costs nothing but a re-backup: the recovery key is not derived from a
// password and so is not affected.
const (
	argonTime    = 2
	argonMemory  = 19 * 1024 // KiB
	argonThreads = 1
)

// Passphrase shape — the opt-in mode. The ceiling matches the password rules
// (see passwordProblem) and for the same reason: this has to be re-typed, on a
// different keyboard, possibly a year later, with an archive that will not open
// if it comes out even one byte different.
//
// It is also the ONLY remaining way to lose an archive outright, now that a
// password change no longer orphans anything: a passphrase archive carries no
// recWrap, on purpose — choosing a passphrase is choosing not to tie the archive
// to this instance or to any login — so a lost passphrase is a lost archive, with
// no recovery path and deliberately no hint stored. The UI says so at the moment
// of choosing.
const (
	minPassphraseChars = 10
	maxPassphraseChars = 20
)

func passphraseProblem(p string) string {
	switch {
	case len(p) < minPassphraseChars:
		return "passphrase must be at least 10 characters"
	case len(p) > maxPassphraseChars:
		return "passphrase must be at most 20 characters"
	case !asciiPrintable(p):
		return "passphrase may use letters, digits and punctuation only — no accents or non-Latin characters"
	}
	return ""
}

// errBadKey is what every wrong-credential path returns, and it is returned from
// exactly ONE place: opening a wrap. Deliberately one error for "wrong password",
// "wrong passphrase" and "this box's recovery key does not fit", so nothing
// distinguishes a valid account from an invalid one to whoever is guessing.
//
// It must never cover a FRAME failure. In v1 it did, and the inference was sound
// there because the derived key's first and only test was frame zero. In v2 the
// credential is proven the moment a wrap opens, so a frame that fails afterwards
// means the body was altered or truncated — and reporting that as "wrong
// password" tells an operator whose archive has been damaged to go and doubt
// their memory instead.
var errBadKey = errors.New("the password or passphrase does not open this backup")

// errArchiveDamaged is the other side of that line.
var errArchiveDamaged = errors.New("the backup archive failed its integrity check — it is damaged or was altered")

// errNotEncrypted marks a stream that does not begin with the magic. Reported
// separately because archives written before 1.4.1 are plain gzip, and the
// restore path still reads those.
var errNotEncrypted = errors.New("not an encrypted Tippani backup")

// backupHeader is a parsed header. Prefix and Raw are kept as the exact bytes
// read, because they are additional data for the wraps and the frames
// respectively and must be byte-identical to what was sealed — re-serialising
// would risk a difference that is invisible here and fatal a year from now.
type backupHeader struct {
	Version byte
	Mode    byte
	Salt    []byte
	Nonce   []byte
	Account string
	KeyWrap []byte
	RecWrap []byte
	Prefix  []byte // AAD for the two wraps
	Raw     []byte // AAD for the frames
	Size    int
}

// Recoverable reports whether this archive carries an instance-recovery wrap —
// which is what lets the UI say "your current password will open this" instead of
// naming whichever account sealed it.
func (h *backupHeader) Recoverable() bool { return len(h.RecWrap) > 0 }

func readBackupHeader(r io.Reader) (*backupHeader, error) {
	fixed := make([]byte, backupPrefixFixed)
	if _, err := io.ReadFull(r, fixed); err != nil {
		return nil, errNotEncrypted
	}
	if string(fixed[0:4]) != backupMagic {
		return nil, errNotEncrypted
	}
	h := &backupHeader{Version: fixed[4], Mode: fixed[5]}
	switch h.Version {
	case backupCryptoV2:
	case backupCryptoV1:
		return nil, errors.New(
			"this backup was written by 1.4.1, whose archive format was replaced in 1.4.2 — restore it with 1.4.1, or make a fresh backup")
	default:
		return nil, fmt.Errorf("this backup was written by a newer Tippani (format v%d) — update the server first", h.Version)
	}
	if h.Mode != backupModePassword && h.Mode != backupModePassphrase {
		return nil, errors.New("the backup header names an unknown key mode")
	}
	off := 6
	h.Salt = append([]byte(nil), fixed[off:off+backupSaltLen]...)
	off += backupSaltLen
	h.Nonce = append([]byte(nil), fixed[off:off+backupNonceLen]...)
	off += backupNonceLen
	identLen := int(binary.BigEndian.Uint16(fixed[off:]))
	if identLen > backupIdentMax {
		return nil, errors.New("the backup header is malformed")
	}
	ident := make([]byte, identLen)
	if _, err := io.ReadFull(r, ident); err != nil {
		return nil, errors.New("the backup header is truncated")
	}
	h.Account = string(ident)
	// Everything up to here is the v1-compatible prefix, and the wraps' AAD.
	h.Prefix = append(append([]byte(nil), fixed...), ident...)

	kw, err := readWrap(r)
	if err != nil {
		return nil, err
	}
	rw, err := readWrap(r)
	if err != nil {
		return nil, err
	}
	if len(kw) != backupWrapLen {
		return nil, errors.New("the backup header is malformed")
	}
	if len(rw) != 0 && len(rw) != backupWrapLen {
		return nil, errors.New("the backup header is malformed")
	}
	h.KeyWrap, h.RecWrap = kw, rw
	h.Raw = append(append([]byte(nil), h.Prefix...), wrapBytes(kw)...)
	h.Raw = append(h.Raw, wrapBytes(rw)...)
	h.Size = len(h.Raw)
	return h, nil
}

// readWrap reads one uint16-length-prefixed blob, refusing a length that is
// neither absent nor exactly a wrap — a hostile length must not become a hostile
// allocation.
func readWrap(r io.Reader) ([]byte, error) {
	var l [2]byte
	if _, err := io.ReadFull(r, l[:]); err != nil {
		return nil, errors.New("the backup header is truncated")
	}
	n := int(binary.BigEndian.Uint16(l[:]))
	if n == 0 {
		return nil, nil
	}
	if n != backupWrapLen {
		return nil, errors.New("the backup header is malformed")
	}
	b := make([]byte, n)
	if _, err := io.ReadFull(r, b); err != nil {
		return nil, errors.New("the backup header is truncated")
	}
	return b, nil
}

// wrapBytes re-serialises a wrap with its length prefix, for the AAD.
func wrapBytes(b []byte) []byte {
	var l [2]byte
	binary.BigEndian.PutUint16(l[:], uint16(len(b)))
	return append(l[:], b...)
}

// deriveKey turns a typed secret + salt into the key that opens keyWrap. The one
// place the cost parameters are applied, so sealing and opening cannot drift.
func deriveKey(secret string, salt []byte) []byte {
	return argon2.IDKey([]byte(secret), salt, argonTime, argonMemory, argonThreads, backupKeyLen)
}

// seal / open — the wrap primitive. `key` is 32 bytes; `aad` is the header prefix.
func sealWrap(key, plain, aad []byte) ([]byte, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, backupNonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return append(nonce, gcm.Seal(nil, nonce, plain, aad)...), nil
}

func openWrap(key, wrap, aad []byte) ([]byte, error) {
	if len(wrap) != backupWrapLen {
		return nil, errBadKey
	}
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	out, err := gcm.Open(nil, wrap[:backupNonceLen], wrap[backupNonceLen:], aad)
	if err != nil {
		return nil, errBadKey
	}
	return out, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// UnwrapSecret recovers the archive key from a typed password or passphrase.
func (h *backupHeader) UnwrapSecret(secret string) ([]byte, error) {
	return openWrap(deriveKey(secret, h.Salt), h.KeyWrap, h.Prefix)
}

// UnwrapRecovery recovers the archive key from this instance's recovery key.
func (h *backupHeader) UnwrapRecovery(instKey []byte) ([]byte, error) {
	if len(h.RecWrap) == 0 {
		return nil, errBadKey
	}
	return openWrap(instKey, h.RecWrap, h.Prefix)
}

// peekArchive reports how an archive on disk is keyed, for the UI: it has to know
// whether to ask for a password (and whose), a passphrase, or nothing at all,
// BEFORE the restore starts. A plain pre-1.4.1 archive comes back as mode 0.
func peekArchive(path string) (mode byte, account string, recoverable bool, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, "", false, err
	}
	defer f.Close()
	h, err := readBackupHeader(f)
	if errors.Is(err, errNotEncrypted) {
		return 0, "", false, nil
	}
	if err != nil {
		return 0, "", false, err
	}
	return h.Mode, h.Account, h.Recoverable(), nil
}

// frameNonce derives frame n's nonce from the archive's base nonce. XOR rather
// than "write the counter into the low bytes" so all 12 bytes stay
// archive-specific: with the low 8 overwritten, two archives would share the
// first 4 bytes of every nonce.
//
// Used for FRAMES ONLY. The wraps get their own random nonces (see sealWrap) —
// recWrap's key is reused across archives, so a derived nonce there would be the
// one misuse AES-GCM does not survive.
func frameNonce(base []byte, n uint64) []byte {
	out := make([]byte, backupNonceLen)
	copy(out, base)
	binary.BigEndian.PutUint64(out[4:], binary.BigEndian.Uint64(base[4:])^n)
	return out
}

// frameAAD is the additional data for frame n: the whole header, the counter, and
// the final flag. See the format notes above for what each one buys.
func frameAAD(hdr []byte, n uint64, final byte) []byte {
	aad := make([]byte, 0, len(hdr)+9)
	aad = append(aad, hdr...)
	var ctr [8]byte
	binary.BigEndian.PutUint64(ctr[:], n)
	aad = append(aad, ctr[:]...)
	return append(aad, final)
}

// ---- writing ---------------------------------------------------------------

// backupEncWriter seals what is written to it into framed AES-GCM and forwards it
// to dst. Close MUST be called and MUST be checked: it writes the final frame,
// which is the only thing that distinguishes a complete archive from a truncated
// one.
type backupEncWriter struct {
	dst  io.Writer
	gcm  cipher.AEAD
	hdr  []byte
	base []byte
	buf  []byte
	n    uint64
	done bool
}

// newBackupEncWriter writes the header to dst and returns a writer over the
// frames. `account` is recorded in the clear for mode 1 (so a restore can say
// whose password it wants) and ignored for mode 2. `instKey`, when non-nil, adds
// the recovery wrap — the caller passes nil for passphrase mode, which must not
// have one.
func newBackupEncWriter(dst io.Writer, mode byte, account, secret string, instKey []byte) (*backupEncWriter, error) {
	if mode == backupModePassphrase {
		account = ""
		instKey = nil
	}
	if len(account) > backupIdentMax {
		return nil, errors.New("account name too long to record in the archive header")
	}
	if instKey != nil && len(instKey) != backupKeyLen {
		return nil, errors.New("recovery key is the wrong length")
	}
	salt := make([]byte, backupSaltLen)
	base := make([]byte, backupNonceLen)
	archiveKey := make([]byte, backupKeyLen)
	for _, b := range [][]byte{salt, base, archiveKey} {
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
	}

	prefix := make([]byte, 0, backupPrefixFixed+len(account))
	prefix = append(prefix, backupMagic...)
	prefix = append(prefix, backupCryptoV2, mode)
	prefix = append(prefix, salt...)
	prefix = append(prefix, base...)
	var il [2]byte
	binary.BigEndian.PutUint16(il[:], uint16(len(account)))
	prefix = append(prefix, il[:]...)
	prefix = append(prefix, account...)

	keyWrap, err := sealWrap(deriveKey(secret, salt), archiveKey, prefix)
	if err != nil {
		return nil, err
	}
	var recWrap []byte
	if instKey != nil {
		if recWrap, err = sealWrap(instKey, archiveKey, prefix); err != nil {
			return nil, err
		}
		// A wrap nobody has ever exercised is discovered broken on the day it is
		// needed, so exercise it now — the same reason handleBackupCreate verifies
		// the password against the stored hash before writing anything.
		if got, err := openWrap(instKey, recWrap, prefix); err != nil || string(got) != string(archiveKey) {
			return nil, errors.New("the recovery wrap did not round-trip — refusing to write an archive this instance could not recover")
		}
	}

	hdr := append(append([]byte(nil), prefix...), wrapBytes(keyWrap)...)
	hdr = append(hdr, wrapBytes(recWrap)...)

	gcm, err := newGCM(archiveKey)
	if err != nil {
		return nil, err
	}
	if _, err := dst.Write(hdr); err != nil {
		return nil, err
	}
	return &backupEncWriter{dst: dst, gcm: gcm, hdr: hdr, base: base, buf: make([]byte, 0, backupChunk)}, nil
}

func (w *backupEncWriter) Write(p []byte) (int, error) {
	total := len(p)
	for len(p) > 0 {
		room := backupChunk - len(w.buf)
		take := min(room, len(p))
		w.buf = append(w.buf, p[:take]...)
		p = p[take:]
		if len(w.buf) == backupChunk {
			if err := w.flush(0); err != nil {
				return total - len(p), err
			}
		}
	}
	return total, nil
}

func (w *backupEncWriter) flush(final byte) error {
	ct := w.gcm.Seal(nil, frameNonce(w.base, w.n), w.buf, frameAAD(w.hdr, w.n, final))
	var head [5]byte
	head[0] = final
	binary.BigEndian.PutUint32(head[1:], uint32(len(ct)))
	if _, err := w.dst.Write(head[:]); err != nil {
		return err
	}
	if _, err := w.dst.Write(ct); err != nil {
		return err
	}
	w.n++
	w.buf = w.buf[:0]
	return nil
}

// Close seals whatever is buffered as the final frame. Calling it twice is a
// no-op rather than an error, so a deferred Close beside an explicit one is safe.
func (w *backupEncWriter) Close() error {
	if w.done {
		return nil
	}
	w.done = true
	return w.flush(1)
}

// ---- reading ---------------------------------------------------------------

// backupDecReader verifies and decrypts frames and reads out as plaintext. It is
// constructed from an ALREADY-UNWRAPPED archive key, which is what keeps the
// wrong-credential decision in one place: by the time a frame is read, the key
// has proven itself, so a frame failure can only mean damage.
type backupDecReader struct {
	src  io.Reader
	gcm  cipher.AEAD
	hdr  []byte
	base []byte
	buf  []byte
	n    uint64
	eof  bool
	any  bool // has any frame been opened? distinguishes "empty" from "truncated"
}

// newBackupDecReader continues from wherever `src` is positioned — immediately
// after the header that produced `h`. Nothing re-reads or re-seeks the stream, so
// trying a second key never leaves the reader mid-header (a v1-era bug: a failed
// attempt left the file positioned past the magic, and the retry then reported a
// perfectly good archive as "not a valid tar.gz").
func newBackupDecReader(src io.Reader, h *backupHeader, archiveKey []byte) (*backupDecReader, error) {
	gcm, err := newGCM(archiveKey)
	if err != nil {
		return nil, err
	}
	return &backupDecReader{src: src, gcm: gcm, hdr: h.Raw, base: h.Nonce}, nil
}

// frame reads, verifies and decrypts one frame into buf.
func (r *backupDecReader) frame() error {
	var head [5]byte
	if _, err := io.ReadFull(r.src, head[:]); err != nil {
		// Running out of frames without having seen one marked final is the
		// truncation case, and it must be loud.
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			if !r.any {
				return errors.New("the backup archive has no contents — it is truncated")
			}
			return errors.New("the backup archive is truncated — its final block is missing")
		}
		return err
	}
	final := head[0]
	if final > 1 {
		return errArchiveDamaged
	}
	ctLen := int(binary.BigEndian.Uint32(head[1:]))
	if ctLen > backupChunk+r.gcm.Overhead() || ctLen < r.gcm.Overhead() {
		// A hostile length must not become a hostile allocation.
		return errArchiveDamaged
	}
	ct := make([]byte, ctLen)
	if _, err := io.ReadFull(r.src, ct); err != nil {
		return errors.New("the backup archive is truncated")
	}
	pt, err := r.gcm.Open(nil, frameNonce(r.base, r.n), ct, frameAAD(r.hdr, r.n, final))
	if err != nil {
		// NOT errBadKey. The key opened a wrap to get here.
		return errArchiveDamaged
	}
	r.any = true
	r.buf = pt
	r.n++
	if final == 1 {
		r.eof = true
	}
	return nil
}

func (r *backupDecReader) Read(p []byte) (int, error) {
	for len(r.buf) == 0 {
		if r.eof {
			return 0, io.EOF
		}
		if err := r.frame(); err != nil {
			return 0, err
		}
	}
	n := copy(p, r.buf)
	r.buf = r.buf[n:]
	return n, nil
}
