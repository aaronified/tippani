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

// Backup encryption (1.4.1).
//
// A backup archive is everything: every user's library, the password hashes, the
// metadata API keys. Until 1.4.1 it left the server as a plain tar.gz, which is
// fine while it sits in <data>/backups and not fine the moment it is downloaded
// to a laptop, synced to a cloud drive, or mailed to yourself — which is exactly
// what a backup is for. So the archive is now sealed, and the key is derived from
// something the operator knows rather than something stored on the box (a key
// file beside the archive it protects is a lock taped to its own key).
//
// TWO MODES, because "who holds the key" has two honest answers:
//
//	account     the default. The passphrase is "<account name>#<password>" — your
//	            own login, nothing new to remember. It travels: the same name and
//	            password open the archive on a fresh install on another machine,
//	            which is what makes a backup portable. The archive header carries
//	            the account NAME in the clear so a restore can say whose password
//	            it needs; the password itself is never written anywhere.
//	passphrase  opt-in, for anyone who would rather the archive not be bound to a
//	            login at all (or who is about to change that password). Ten to
//	            twenty characters, and if it is lost the archive is lost — there
//	            is no recovery path and deliberately no hint stored.
//
// WHAT THIS DOES NOT DO. It is not a signature: anyone who knows the credentials
// can produce a valid archive, so a restore proves the archive was made by
// someone who knew them, not by you. And a stolen archive plus a guessed password
// is still a full compromise — Argon2id makes guessing expensive, not impossible.
//
// A single fixed key compiled into the binary was considered and rejected: this
// is an MIT-licensed repository, so that constant would be public, and "encrypted
// with a published key" is a claim that reads as protection while providing none.
// Portability is better served by credentials the operator already has.
//
// FORMAT (v1). Little in here is novel; the notes are on the parts that are
// load-bearing.
//
//	magic     4  "TPBK"
//	version   1  0x01 — the KDF cost parameters below are part of what this pins
//	mode      1  0x01 account · 0x02 passphrase
//	salt     16  per-archive, so two archives under the same password get
//	             different keys and neither can be tested against the other
//	nonce    12  per-archive base; each frame's nonce is this XOR its counter
//	identLen  2  big-endian
//	ident   ...  the account name (mode 1) — empty in mode 2, which has nothing
//	             to name and should not hint at what the passphrase might be
//
// then a sequence of AES-256-GCM frames, each:
//
//	final     1  0x00 · 0x01
//	ctLen     4  big-endian
//	ct      ...
//
// The additional data for each frame is the WHOLE header plus the frame's counter
// and its final flag, which is what makes the stream tamper-evident rather than
// merely the frames: re-ordering frames breaks the counter, splicing frames from
// another archive breaks the salt binding, editing the header (say, swapping the
// account name for one whose password you know) breaks every frame, and flipping
// a final flag breaks that frame. Truncation is caught by its absence — a stream
// that ends without a frame marked final is an error, not a short read, which is
// the failure mode that matters most here: a backup silently missing its tail is
// worse than no backup, because it looks like one.
const (
	backupMagic    = "TPBK"
	backupCryptoV1 = 1

	backupModeAccount    byte = 1
	backupModePassphrase byte = 2

	backupSaltLen  = 16
	backupNonceLen = 12 // AES-GCM standard nonce
	backupIdentMax = 256
	// 1 MiB plaintext frames. Big enough that the per-frame 21 bytes of overhead
	// and the AEAD setup are noise against a multi-hundred-MB archive; small
	// enough that encrypting one never needs more than a couple of MB live, which
	// matters on the ~25 MB idle-RSS budget this server holds itself to.
	backupChunk = 1 << 20
)

// Argon2id cost. Deliberately the OWASP floor (m=19 MiB, t=2, p=1) rather than
// something showier: this runs on NAS boxes whose systemd unit sets GOMEMLIMIT to
// 64 MiB, and a 64 MiB scratch buffer inside that budget would thrash the
// collector during the one operation you least want to be fragile. All three are
// FIXED, not stored: p in particular changes the output, so a portable archive
// cannot let it vary by machine. Changing any of them means a new version byte.
const (
	argonTime    = 2
	argonMemory  = 19 * 1024 // KiB
	argonThreads = 1
	argonKeyLen  = 32 // AES-256
)

// Passphrase shape — the opt-in mode. The ceiling matches the password rules
// (see passwordProblem) and for the same reason: this has to be re-typed, on a
// different keyboard, possibly a year later, with an archive that will not open
// if it comes out even one byte different.
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

// accountSecret is the mode-1 passphrase. The separator is "#" because it cannot
// appear in an account name (usernames are validated on creation) — without a
// separator that the first field cannot contain, "ab" + "cd" and "a" + "bcd"
// would derive the same key.
func accountSecret(username, password string) string {
	return username + "#" + password
}

// errBadKey is what every wrong-credential path returns. It is deliberately one
// error for "wrong password", "wrong passphrase" and "wrong account": the caller
// turns it into a 401 with a single message, so nothing distinguishes a valid
// account name from an invalid one to whoever is guessing.
var errBadKey = errors.New("the password or passphrase does not open this backup")

// backupHeader is a parsed archive header. Size is how many bytes it occupied,
// so the frame reader knows where the ciphertext starts, and Raw is the exact
// bytes, because they are the AEAD's additional data and must be byte-identical
// to what was sealed (re-serialising would risk a difference that is invisible
// here and fatal a year from now).
type backupHeader struct {
	Version byte
	Mode    byte
	Salt    []byte
	Nonce   []byte
	Account string
	Raw     []byte
	Size    int
}

// readBackupHeader parses a header from r. A stream that does not begin with the
// magic is reported as errNotEncrypted, NOT as corruption: archives written
// before 1.4.1 are plain gzip and must keep restoring.
var errNotEncrypted = errors.New("not an encrypted Tippani backup")

func readBackupHeader(r io.Reader) (*backupHeader, error) {
	fixed := make([]byte, 4+1+1+backupSaltLen+backupNonceLen+2)
	if _, err := io.ReadFull(r, fixed); err != nil {
		return nil, errNotEncrypted
	}
	if string(fixed[0:4]) != backupMagic {
		return nil, errNotEncrypted
	}
	h := &backupHeader{Version: fixed[4], Mode: fixed[5]}
	if h.Version != backupCryptoV1 {
		return nil, fmt.Errorf("this backup was written by a newer Tippani (format v%d) — update the server first", h.Version)
	}
	if h.Mode != backupModeAccount && h.Mode != backupModePassphrase {
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
	h.Raw = append(append([]byte(nil), fixed...), ident...)
	h.Size = len(h.Raw)
	return h, nil
}

// peekArchive reports how an archive on disk is keyed, for the UI: it has to know
// whether to ask for a password (and whose) or a passphrase BEFORE the restore
// starts. A plain pre-1.4.1 archive comes back as mode 0.
func peekArchive(path string) (mode byte, account string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, "", err
	}
	defer f.Close()
	h, err := readBackupHeader(f)
	if errors.Is(err, errNotEncrypted) {
		return 0, "", nil
	}
	if err != nil {
		return 0, "", err
	}
	return h.Mode, h.Account, nil
}

// deriveKey turns a secret + salt into the AES key. The one place the cost
// parameters are applied, so encrypt and decrypt cannot drift apart.
func deriveKey(secret string, salt []byte) []byte {
	return argon2.IDKey([]byte(secret), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
}

// frameNonce derives frame n's nonce from the archive's base nonce. XOR rather
// than "write the counter into the low bytes" so all 12 bytes stay
// archive-specific: with the low 8 overwritten, two archives would share the
// first 4 bytes of every nonce, and nonce reuse across archives under the same
// derived key is the one failure AES-GCM does not survive. (The salt already
// makes the key per-archive, so this is belt and braces — which is the right
// amount of care for the one primitive with a catastrophic misuse.)
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
// frames. `account` is stored in the clear for mode 1 (so a restore can say whose
// password it wants) and ignored for mode 2.
func newBackupEncWriter(dst io.Writer, mode byte, account, secret string) (*backupEncWriter, error) {
	if mode == backupModePassphrase {
		account = ""
	}
	if len(account) > backupIdentMax {
		return nil, errors.New("account name too long to record in the archive header")
	}
	salt := make([]byte, backupSaltLen)
	base := make([]byte, backupNonceLen)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	if _, err := rand.Read(base); err != nil {
		return nil, err
	}
	hdr := make([]byte, 0, 36+len(account))
	hdr = append(hdr, backupMagic...)
	hdr = append(hdr, backupCryptoV1, mode)
	hdr = append(hdr, salt...)
	hdr = append(hdr, base...)
	var il [2]byte
	binary.BigEndian.PutUint16(il[:], uint16(len(account)))
	hdr = append(hdr, il[:]...)
	hdr = append(hdr, account...)

	block, err := aes.NewCipher(deriveKey(secret, salt))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
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

// backupDecReader is the inverse: it verifies and decrypts frames from src and
// reads out as plaintext. A wrong key fails on the FIRST frame — nothing is
// written anywhere before that — which is what lets a restore reject bad
// credentials without having touched the live data.
type backupDecReader struct {
	src  io.Reader
	gcm  cipher.AEAD
	hdr  []byte
	base []byte
	buf  []byte
	n    uint64
	eof  bool
	// first tracks whether any frame has been opened yet, so a failure on frame
	// zero can be reported as "wrong credentials" while a failure later — where
	// the key has already proven itself — is reported as a damaged archive.
	first bool
}

// newBackupDecReader parses the header, derives the key from `secret`, and
// returns the plaintext reader plus the parsed header. It eagerly reads and
// verifies the first frame so a wrong password is an error HERE rather than
// halfway through an extraction.
func newBackupDecReader(src io.Reader, secret string) (*backupDecReader, *backupHeader, error) {
	h, err := readBackupHeader(src)
	if err != nil {
		return nil, nil, err
	}
	block, err := aes.NewCipher(deriveKey(secret, h.Salt))
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	r := &backupDecReader{src: src, gcm: gcm, hdr: h.Raw, base: h.Nonce, first: true}
	if err := r.frame(); err != nil {
		return nil, nil, err
	}
	return r, h, nil
}

// frame reads, verifies and decrypts one frame into buf.
func (r *backupDecReader) frame() error {
	var head [5]byte
	if _, err := io.ReadFull(r.src, head[:]); err != nil {
		// Running out of frames without having seen one marked final is the
		// truncation case, and it must be loud.
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			if r.first {
				return errBadKey // not even one frame — treat as unopenable
			}
			return errors.New("the backup archive is truncated — its final block is missing")
		}
		return err
	}
	final := head[0]
	if final > 1 {
		return errors.New("the backup archive is corrupt")
	}
	ctLen := int(binary.BigEndian.Uint32(head[1:]))
	if ctLen > backupChunk+r.gcm.Overhead() || ctLen < r.gcm.Overhead() {
		// A hostile length must not become a hostile allocation.
		return errors.New("the backup archive is corrupt")
	}
	ct := make([]byte, ctLen)
	if _, err := io.ReadFull(r.src, ct); err != nil {
		return errors.New("the backup archive is truncated")
	}
	pt, err := r.gcm.Open(nil, frameNonce(r.base, r.n), ct, frameAAD(r.hdr, r.n, final))
	if err != nil {
		if r.first {
			return errBadKey
		}
		return errors.New("the backup archive failed its integrity check — it is damaged or was altered")
	}
	r.first = false
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
