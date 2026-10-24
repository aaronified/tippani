package httpapi

// A work keeps the file its quotes came from.
//
// A quote out of context can read as nonsense, and the file it came from is the
// context. This is the store half of docs/plans/work-source-files.md: one source
// file per (work, role), uploaded by the reader who owns the work.
//
// THE LINE THIS FILE HOLDS, because the app used to say "Tippani holds no book
// files" and the boundary was always SERVING, not storing:
//
//   - nothing here renders a source, and nothing here hands one back. There is no
//     route that returns the bytes, no ServeFile, no redirect to Sources/. What
//     leaves the server from a source is extracted spans of text, in a later
//     release, sized by the request.
//   - nothing here takes a path from a request. The client names a WORK; the
//     filename on disk is random and is never sent anywhere, so there is no
//     traversal to defend against, only none to reach.
//   - nothing here fetches. A source is uploaded, never looked up.
//
// FORMAT BY BYTES (importer.SourceFormat), never by extension. A subtitle saved
// as `.txt` is a subtitle.

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"tippani/internal/ebook"
	"tippani/internal/importer"
	"tippani/internal/olog"
)

// maxSourceUpload is above the 12 MB font and cover precedent because those are
// images and this is a book. An illustrated novel fits; an audiobook is not
// invited. There is no per-user total: a quota is a feature with a settings page,
// a counter and an eviction policy, and the sizes are visible to whoever owns the
// disk.
const maxSourceUpload = 25 << 20

// The subjects a source can belong to, in the media words the rest of the app
// uses. `screen` is the movies table, whose rows are films and shows.
const (
	sourceBook      = "book"
	sourceScreen    = "screen"
	sourceUtterance = "utterance"
)

// episodeKey is `s01e04`: one subtitle covers one episode, so a show's source
// carries the episode in subject_key. Lower-case and unpadded-tolerant so "S1E4"
// and "s01e04" are one episode.
var episodeKey = regexp.MustCompile(`^s(\d{1,3})e(\d{1,4})$`)

func (s *Server) sourcesDir() string { return filepath.Join(s.DataDir, "Sources") }

// sourceSubject is what a request resolved to: the row key, plus the formats the
// subject can carry. Resolving it is also the ownership check, in the same query
// that reads the row, so a work that is not the reader's is "not found" and never
// "forbidden".
type sourceSubject struct {
	Subject string
	ID      int64
	Key     string
	Formats map[string]bool
}

// sourceFormatsFor is the table from the plan, "What can carry a source".
var (
	subtitleFormats = map[string]bool{importer.SourceFormatSRT: true, importer.SourceFormatVTT: true, importer.SourceFormatASS: true}
	textFormats     = map[string]bool{importer.SourceFormatEPUB: true, importer.SourceFormatTXT: true}
	lyricFormats    = map[string]bool{importer.SourceFormatTXT: true, importer.SourceFormatLRC: true}
)

type sourceErr struct {
	status int
	msg    string
}

func (e *sourceErr) Error() string { return e.msg }

// resolveSourceSubject turns (subject, subject_id, episode) into the row key. The
// error carries the HTTP answer, so both the upload and the lookup say the same
// thing about the same bad request.
func (s *Server) resolveSourceSubject(uid int64, subject string, id int64, episode string) (*sourceSubject, *sourceErr) {
	if id <= 0 {
		return nil, &sourceErr{http.StatusBadRequest, "a source belongs to a work: say which one"}
	}
	switch subject {
	case sourceBook:
		if episode != "" {
			return nil, &sourceErr{http.StatusBadRequest, "a book has no episodes"}
		}
		var one int
		err := s.Store.DB.QueryRow(`SELECT 1 FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&one)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &sourceErr{http.StatusNotFound, "book not found"}
		}
		if err != nil {
			return nil, &sourceErr{http.StatusInternalServerError, "load book"}
		}
		return &sourceSubject{Subject: sourceBook, ID: id, Formats: textFormats}, nil

	case sourceScreen:
		var mediaType string
		err := s.Store.DB.QueryRow(`SELECT media_type FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&mediaType)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &sourceErr{http.StatusNotFound, "title not found"}
		}
		if err != nil {
			return nil, &sourceErr{http.StatusInternalServerError, "load title"}
		}
		key := ""
		switch mediaType {
		case "game":
			// The owner's: "games have no equivalent." Absent from the menu, and
			// refused here for a client that offers it anyway.
			return nil, &sourceErr{http.StatusBadRequest, "a game has no subtitle file"}
		case "show":
			m := episodeKey.FindStringSubmatch(strings.ToLower(strings.TrimSpace(episode)))
			if m == nil {
				return nil, &sourceErr{http.StatusBadRequest, "a show's subtitle covers one episode: say which, as s01e04"}
			}
			season, _ := strconv.Atoi(m[1])
			ep, _ := strconv.Atoi(m[2])
			key = fmt.Sprintf("s%02de%02d", season, ep)
		default:
			if strings.TrimSpace(episode) != "" {
				return nil, &sourceErr{http.StatusBadRequest, "a film has no episodes"}
			}
		}
		return &sourceSubject{Subject: sourceScreen, ID: id, Key: key, Formats: subtitleFormats}, nil

	case sourceUtterance:
		if episode != "" {
			return nil, &sourceErr{http.StatusBadRequest, "a quote has no episodes"}
		}
		var kind, speaker, occasion, workTitle string
		err := s.Store.DB.QueryRow(
			`SELECT kind, speaker, occasion, work_title FROM utterances WHERE id = ? AND user_id = ?`,
			id, uid).Scan(&kind, &speaker, &occasion, &workTitle)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &sourceErr{http.StatusNotFound, "quote not found"}
		}
		if err != nil {
			return nil, &sourceErr{http.StatusInternalServerError, "load quote"}
		}
		var formats map[string]bool
		switch kind {
		case "essay", "poem":
			formats = textFormats
		case "song":
			formats = lyricFormats
		default:
			// A speech has a recording and this app holds no audio; letters,
			// proverbs and the rest have no file form at all.
			return nil, &sourceErr{http.StatusBadRequest, "this kind of quote has no source file"}
		}
		key := utteranceWorkKey(speaker, occasion, workTitle)
		if key == "" {
			return nil, &sourceErr{http.StatusBadRequest, "this quote names no work to hang a file on"}
		}
		// An utterance has no work row, so its title is its identity: two essays
		// sharing a title share one file. subject_id stays 0.
		return &sourceSubject{Subject: sourceUtterance, Key: key, Formats: formats}, nil
	}
	return nil, &sourceErr{http.StatusBadRequest, "subject must be book, screen or utterance"}
}

// workSourceRow is what the client is told about a stored source. THERE IS NO PATH
// IN IT, on purpose: the filename on disk is not the client's business, and a
// field that is never sent cannot be sent back.
type workSourceRow struct {
	ID        int64  `json:"id"`
	Subject   string `json:"subject"`
	SubjectID int64  `json:"subject_id"`
	Episode   string `json:"episode,omitempty"`
	Role      string `json:"role"`
	Format    string `json:"format"`
	Name      string `json:"name"`
	Bytes     int64  `json:"bytes"`
	SHA256    string `json:"sha256"`
	Origin    string `json:"origin"`
	PrunedAt  string `json:"pruned_at,omitempty"`
	CreatedAt string `json:"created_at"`
	// State is the one word the screens branch on, not a pair of booleans that
	// can disagree: file (bytes are held) or pruned (the row is all that is left).
	State string `json:"state"`
	// Context is what reading the file found, answered by an upload: how many of the
	// work's quotes were placed in it, and how many could not be (ambiguous or not
	// found). Absent on a lookup.
	Context      *contextStats `json:"context,omitempty"`
	ContextError string        `json:"context_error,omitempty"`
}

const sourceCols = `id, subject, subject_id, subject_key, role, format, name, bytes, sha256, origin, pruned_at, created_at, path`

func scanSource(sc interface{ Scan(...any) error }) (workSourceRow, string, error) {
	var r workSourceRow
	var key, path string
	if err := sc.Scan(&r.ID, &r.Subject, &r.SubjectID, &key, &r.Role, &r.Format, &r.Name,
		&r.Bytes, &r.SHA256, &r.Origin, &r.PrunedAt, &r.CreatedAt, &path); err != nil {
		return r, "", err
	}
	if r.Subject == sourceScreen {
		r.Episode = key
	}
	r.State = "file"
	if r.PrunedAt != "" || path == "" {
		r.State = "pruned"
	}
	return r, path, nil
}

// sourceName cleans what the reader called the file, for the row that says which
// file this is. Capped by runes, and never a path.
func sourceName(filename string) string {
	base := filepath.Base(strings.ReplaceAll(strings.TrimSpace(filename), `\`, "/"))
	if base == "." || base == "/" {
		return ""
	}
	if r := []rune(base); len(r) > 160 {
		base = string(r[:160])
	}
	return base
}

// storeSourceFile writes the bytes under a random 16-hex name with NO extension:
// nothing serves these, and an extension's only job is to tell a browser what it
// is getting. The format is in the row.
func (s *Server) storeSourceFile(data []byte) (string, error) {
	if err := os.MkdirAll(s.sourcesDir(), 0o700); err != nil {
		return "", err
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	name := hex.EncodeToString(b[:])
	if err := os.WriteFile(filepath.Join(s.sourcesDir(), name), data, 0o600); err != nil {
		return "", err
	}
	return name, nil
}

// sourceFileName guards the one place a stored name becomes a path. The name came
// from this package, so a value that is not 16 hex characters is a corrupted row,
// and joining it would be how a corrupted row became a traversal.
var sourceFile = regexp.MustCompile(`^[0-9a-f]{16}$`)

func (s *Server) removeSourceFiles(names []string) {
	for _, n := range names {
		if !sourceFile.MatchString(n) {
			continue
		}
		if err := os.Remove(filepath.Join(s.sourcesDir(), n)); err != nil && !errors.Is(err, os.ErrNotExist) {
			// Best-effort, and biased the way the cover removal is: the row is gone,
			// so a leftover file is untidy rather than broken. The orphan sweep
			// (a later release) is what finds it.
			olog.Printf("[sources] could not remove %s: %v", n, err)
		}
	}
}

// handlePutSource: PUT /sources — multipart with `file`, `subject`, `subject_id`
// and, for a show, `episode`. A second upload REPLACES the first: one
// transaction, the new file written before the row changes and the old one
// removed after, so a failure at any step leaves one intact source, never none.
func (s *Server) handlePutSource(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	r.Body = http.MaxBytesReader(w, r.Body, maxSourceUpload+(1<<20))
	f, hdr, err := r.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeErr(w, http.StatusRequestEntityTooLarge,
				fmt.Sprintf("that file is over the %d MB limit for a source", maxSourceUpload>>20))
			return
		}
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxSourceUpload+1))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload malformed")
		return
	}
	if len(data) > maxSourceUpload {
		// Names the size and the cap, never a generic failure.
		writeErr(w, http.StatusRequestEntityTooLarge,
			fmt.Sprintf("that file is %.1f MB; a source is capped at %d MB", float64(len(data))/(1<<20), maxSourceUpload>>20))
		return
	}
	subjectID, _ := strconv.ParseInt(r.FormValue("subject_id"), 10, 64)
	subj, serr := s.resolveSourceSubject(uid, r.FormValue("subject"), subjectID, r.FormValue("episode"))
	if serr != nil {
		if serr.status == http.StatusInternalServerError {
			internalError(w, r, "put source: "+serr.msg, errors.New(serr.msg))
			return
		}
		writeErr(w, serr.status, serr.msg)
		return
	}
	format := importer.SourceFormat(data)
	if format == "" {
		writeErr(w, http.StatusBadRequest,
			"that file isn't a subtitle track, an ebook or a text file this app can use")
		return
	}
	if !subj.Formats[format] {
		writeErr(w, http.StatusBadRequest, "a "+sourceSubjectNoun(subj.Subject)+" cannot take a "+format+" file")
		return
	}
	// READ BEFORE KEPT. A file this app cannot read — a DRM'd ebook (refused by name),
	// a subtitle track with no lines — is refused here rather than stored and found
	// dead later. The lines are used again below to cut the context.
	units, unit, perr := sourceUnits(format, data)
	if perr != nil {
		msg := "that file could not be read: " + perr.Error()
		if errors.Is(perr, ebook.ErrDRM) {
			msg = "that ebook is DRM-protected, and its text cannot be read"
		}
		writeErr(w, http.StatusUnprocessableEntity, msg)
		return
	}
	role := importer.SourceRole(format)
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])

	stored, err := s.storeSourceFile(data)
	if err != nil {
		internalError(w, r, "put source: store file", err)
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeSourceFiles([]string{stored})
		internalError(w, r, "put source: begin", err)
		return
	}
	defer tx.Rollback()

	var oldPath, oldSHA string
	err = tx.QueryRow(
		`SELECT path, sha256 FROM work_sources
		 WHERE user_id = ? AND subject = ? AND subject_id = ? AND subject_key = ? AND role = ?`,
		uid, subj.Subject, subj.ID, subj.Key, role).Scan(&oldPath, &oldSHA)
	replaced := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.removeSourceFiles([]string{stored})
		internalError(w, r, "put source: look up", err)
		return
	}
	var id int64
	if replaced {
		_, err = tx.Exec(
			`UPDATE work_sources SET format = ?, path = ?, origin = 'upload', mount_id = '', name = ?,
			        bytes = ?, sha256 = ?, pruned_at = '', created_at = datetime('now')
			 WHERE user_id = ? AND subject = ? AND subject_id = ? AND subject_key = ? AND role = ?`,
			format, stored, sourceName(hdr.Filename), len(data), hash,
			uid, subj.Subject, subj.ID, subj.Key, role)
		if err == nil {
			err = tx.QueryRow(
				`SELECT id FROM work_sources WHERE user_id = ? AND subject = ? AND subject_id = ? AND subject_key = ? AND role = ?`,
				uid, subj.Subject, subj.ID, subj.Key, role).Scan(&id)
		}
	} else {
		var res sql.Result
		res, err = tx.Exec(
			`INSERT INTO work_sources (user_id, subject, subject_id, subject_key, role, format, path, name, bytes, sha256)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, subj.Subject, subj.ID, subj.Key, role, format, stored, sourceName(hdr.Filename), len(data), hash)
		if err == nil {
			id, err = res.LastInsertId()
		}
	}
	// A DIFFERENT FILE IS A DIFFERENT EDITION: one work's context never comes from two
	// of them, so the old file's rows go and the new file derives its own. The SAME
	// file (same sha256) keeps its rows, and extraction below only fills the gaps.
	if err == nil && replaced && oldSHA != hash {
		_, err = tx.Exec(`DELETE FROM source_context WHERE source_id = ?`, id)
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		s.removeSourceFiles([]string{stored})
		internalError(w, r, "put source: write", err)
		return
	}
	// The row now names the new file; the old one is only disk.
	if replaced {
		s.removeSourceFiles([]string{oldPath})
	}
	row, _, err := scanSource(s.Store.DB.QueryRow(`SELECT `+sourceCols+` FROM work_sources WHERE id = ? AND user_id = ?`, id, uid))
	if err != nil {
		internalError(w, r, "put source: read back", err)
		return
	}
	// THE FILE IS READ NOW, ONCE: every quote this work already has gets its
	// surroundings stored, and the file is never a read path afterwards. The upload
	// itself has succeeded either way; a context that could not be cut says why.
	st, xerr := s.extractContextUnits(uid, sourceKey{
		id: id, subject: subj.Subject, subjectID: subj.ID, key: subj.Key, format: format, path: stored,
	}, units, unit)
	if xerr != nil {
		olog.Printf("[sources] context for source %d: %v", id, xerr)
		row.ContextError = "the file was kept, but its context could not be cut"
	} else {
		row.Context = &st
	}
	status := http.StatusCreated
	if replaced {
		status = http.StatusOK
	}
	writeJSON(w, status, row)
}

func sourceSubjectNoun(subject string) string {
	switch subject {
	case sourceBook:
		return "book"
	case sourceScreen:
		return "film or show"
	}
	return "quote"
}

// handleGetSource: GET /sources?subject=&subject_id=&episode= — what this work
// has, as a state and a row, never the bytes. `none` is a real answer.
func (s *Server) handleGetSource(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := r.URL.Query()
	id, _ := strconv.ParseInt(q.Get("subject_id"), 10, 64)
	subj, serr := s.resolveSourceSubject(uid, q.Get("subject"), id, q.Get("episode"))
	if serr != nil {
		if serr.status == http.StatusInternalServerError {
			internalError(w, r, "get source: "+serr.msg, errors.New(serr.msg))
			return
		}
		writeErr(w, serr.status, serr.msg)
		return
	}
	rows, err := s.Store.DB.Query(
		`SELECT `+sourceCols+` FROM work_sources
		 WHERE user_id = ? AND subject = ? AND subject_id = ? AND subject_key = ? ORDER BY role`,
		uid, subj.Subject, subj.ID, subj.Key)
	if err != nil {
		internalError(w, r, "get source", err)
		return
	}
	defer rows.Close()
	out := []workSourceRow{}
	for rows.Next() {
		row, _, err := scanSource(rows)
		if err != nil {
			internalError(w, r, "get source: scan", err)
			return
		}
		out = append(out, row)
	}
	// A mounted source is `mounted` while its file is where it was and `missing` when the
	// disk is not: a stored file is there or the app has a bug, a mounted one is there or
	// the mount is not, and the remedy differs.
	for i := range out {
		if out[i].Origin == "mount" && out[i].State == "file" {
			out[i].State = s.mountedState(uid, out[i].ID)
		}
	}
	state := "none"
	if len(out) > 0 {
		state = out[0].State
	}
	writeJSON(w, http.StatusOK, map[string]any{"state": state, "sources": out})
}

// handleDeleteSource: DELETE /sources/{id} — the row and the bytes. A source
// belonging to somebody else is a 404, as every foreign row is.
func (s *Server) handleDeleteSource(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid source id")
		return
	}
	uid := userID(r)
	var path string
	err := s.Store.DB.QueryRow(
		`DELETE FROM work_sources WHERE id = ? AND user_id = ? RETURNING CASE WHEN origin = 'upload' THEN path ELSE '' END`, id, uid).Scan(&path)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "source not found")
		return
	case err != nil:
		internalError(w, r, "delete source", err)
		return
	}
	s.removeSourceFiles([]string{path})
	w.WriteHeader(http.StatusNoContent)
}

// dropSourcesTx deletes the source rows of the given works inside the caller's
// transaction and returns the stored names to remove once it commits. THIS IS
// THE THING COVERS DO NOT DO: a deleted work leaving a 100 KB cover behind is
// invisible, and one leaving a 1.5 MB ebook behind is the same bug with a
// hundred times the bill.
//
// The bin does not carry a source. A restored work comes back without its file,
// as it always did without one it never had; the reader adds it again.
func dropSourcesTx(tx *sql.Tx, uid int64, subject string, ids []int64) ([]string, error) {
	var names []string
	for _, id := range ids {
		rows, err := tx.Query(
			`DELETE FROM work_sources WHERE user_id = ? AND subject = ? AND subject_id = ? RETURNING CASE WHEN origin = 'upload' THEN path ELSE '' END`,
			uid, subject, id)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var p string
			if err := rows.Scan(&p); err != nil {
				rows.Close()
				return nil, err
			}
			if p != "" {
				names = append(names, p)
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return names, nil
}

// sourceSubjectForKind maps the bin's kind word onto a source subject, "" for the
// kinds that carry none. The bin says `movie` where a source says `screen`.
func sourceSubjectForKind(kind string) string {
	switch kind {
	case "book":
		return sourceBook
	case "movie":
		return sourceScreen
	}
	return ""
}

// userSourceFiles lists a user's stored source names, for removal when the
// account is deleted: the row cascade frees the rows, not the bytes.
func (s *Server) userSourceFiles(id int64) []string {
	rows, err := s.Store.DB.Query(`SELECT path FROM work_sources WHERE user_id = ? AND path != '' AND origin = 'upload'`, id)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	return names
}
