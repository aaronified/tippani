package httpapi

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/signature"
)

// A PERSON'S SIGNATURE: an image beside their portrait, drawn under their quote on
// a shared card.
//
// TWO ROUTES, PREVIEW AND SAVE, AND NEITHER KEEPS STATE BETWEEN THEM. The owner's
// ruling is that the reader sees the cleaned signature before anything is saved,
// with one slider for the ink. The cleaner is deterministic, so the save sends the
// same file and the same strength again and gets the same bytes; nothing is parked
// on the server between the two presses, which is a thing that would need a
// lifetime, a sweep and a limit. The price is one extra upload of a photo, paid on
// a reader's own machine.
//
// A FILE IS SHARED BETWEEN ROWS, so nothing here deletes one without asking whether
// another row still names it (removeSignatureFile). The file's name is the hash of
// its bytes (metadata.StoreSignature): two readers with the same signature hold one
// file, and one of them removing theirs must leave the other's.

// signatureFiles serialises the two halves that must not interleave: storing a
// file and committing the row that names it, against deciding that nobody names a
// file and deleting it. Without it a removal could look at the references between
// another reader's store and their commit, find none, and delete the file the
// commit was about to point at. The sections it covers are short and local, and
// signatures are rare, so one lock is the right size.
var signatureFiles sync.Mutex

// The ink slider's range, as the cleaner takes it.
const (
	minInk = 0.0
	maxInk = 1.0
)

// signatureInput is what a preview and a save are both given: the file, and the
// ink strength it is to be cleaned at.
type signatureInput struct {
	data     []byte
	strength float64
}

// readSignatureInput reads the multipart body: "file", and an optional "strength"
// in [0,1] (the cleaner's default where it is absent). It writes the error itself.
func readSignatureInput(w http.ResponseWriter, r *http.Request) (signatureInput, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (an image under 10 MB)")
		return signatureInput{}, false
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return signatureInput{}, false
	}
	in := signatureInput{data: data, strength: signature.DefaultStrength}
	if v := strings.TrimSpace(r.FormValue("strength")); v != "" {
		n, err := strconv.ParseFloat(v, 64)
		if err != nil || n < minInk || n > maxInk {
			writeErr(w, http.StatusBadRequest, "ink strength must be a number from 0 to 1")
			return signatureInput{}, false
		}
		in.strength = n
	}
	return in, true
}

// cleanSignature turns what was uploaded into what would be stored: the cleaned
// PNG for a raster, the file itself for an SVG (a vector has no paper to remove).
// The error is a sentence for the reader.
func cleanSignature(in signatureInput) ([]byte, error) {
	out, err := signature.Clean(in.data, in.strength)
	if err == nil {
		return out, nil
	}
	if errors.Is(err, signature.ErrUnsupported) {
		// Not a raster the cleaner reads. An SVG is kept as it is, if it passes the
		// same script check a sticker does; anything else is not a signature.
		if svgErr := metadata.ValidSVG(in.data); svgErr == nil {
			return in.data, nil
		}
		if bytes.HasPrefix(in.data, []byte("RIFF")) && bytes.Contains(in.data[:min(len(in.data), 16)], []byte("WEBP")) {
			return nil, errors.New("WebP can't be cleaned here — save it as a PNG or JPEG and try again")
		}
		return nil, signature.ErrUnsupported
	}
	return nil, err
}

// handleSignaturePreview: POST /people/id/{id}/signature/preview, multipart "file"
// and "strength". Cleans and answers the image; writes nothing, and reads no row
// beyond proving the record is the caller's, so a preview is a lookup a reader
// can press as often as they like.
func (s *Server) handleSignaturePreview(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.identityTarget(w, r, "people"); !ok {
		return
	}
	in, ok := readSignatureInput(w, r)
	if !ok {
		return
	}
	out, err := cleanSignature(in)
	if err != nil {
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	mime := "image/png"
	if !bytes.HasPrefix(out, []byte("\x89PNG")) {
		mime = "image/svg+xml"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"image": "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(out),
		"kind":  strings.TrimPrefix(mime, "image/"),
	})
}

// handlePersonSignatureUpload: POST /people/id/{id}/signature, multipart "file",
// "strength" and an optional "source". Cleans, stores under the hash of the result
// and points the record at it. An upload is a reader asking for this signature, so
// it also clears the memory that a removed one is not to be fetched back.
func (s *Server) handlePersonSignatureUpload(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	in, ok := readSignatureInput(w, r)
	if !ok {
		return
	}
	out, err := cleanSignature(in)
	if err != nil {
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	source := pickedPictureSource(r.FormValue("source"))

	signatureFiles.Lock()
	name, err := metadata.StoreSignature(out, s.coversDir())
	if err != nil {
		signatureFiles.Unlock()
		writeErr(w, http.StatusBadRequest, "that isn't an image a signature can be made from")
		return
	}
	var old string
	_ = s.Store.DB.QueryRow(`SELECT signature_path FROM people WHERE id = ? AND user_id = ?`, id, uid).Scan(&old)
	_, err = s.Store.DB.Exec(
		`UPDATE people SET signature_path = ?, signature_source = ?, signature_removed = 0
		  WHERE id = ? AND user_id = ?`, name, source, id, uid)
	signatureFiles.Unlock()
	if err != nil {
		s.removeSignatureFile(name)
		internalError(w, r, "save signature", err)
		return
	}
	if old != "" && old != name {
		s.removeSignatureFile(old)
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "signature_path": name, "signature_source": source})
}

// removeSignatureFile deletes a stored signature if, and only if, nothing names it:
// no person row, and no bin row's parked files. The name is validated first so a
// bad database value can never point outside MediaCover. Best-effort, like every
// file removal here: a file left behind is an orphan the next sweep can see, and a
// file deleted from under a row is a broken picture.
func (s *Server) removeSignatureFile(name string) {
	if !coverFile.MatchString(name) {
		return
	}
	signatureFiles.Lock()
	defer signatureFiles.Unlock()
	if s.signatureNamed(name) {
		return
	}
	if err := os.Remove(filepath.Join(s.coversDir(), name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		olog.Warnf(olog.CodeCoverFetch, "[signature] could not remove %s: %v", name, err)
	}
}

// signatureNamed is whether any person row, or any bin row, still names the file.
// Errs toward "named": a query that fails must keep a file, never delete one.
func (s *Server) signatureNamed(name string) bool {
	var n int
	if err := s.Store.DB.QueryRow(`SELECT count(*) FROM people WHERE signature_path = ?`, name).Scan(&n); err != nil || n > 0 {
		return true
	}
	// A bin row parks its images' names as a JSON array in `files`. The name is
	// 16 hex digits and an extension, so a quoted LIKE cannot match part of another.
	err := s.Store.DB.QueryRow(`SELECT count(*) FROM trash WHERE files LIKE ?`, `%"`+name+`"%`).Scan(&n)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return true
	}
	return n > 0
}
