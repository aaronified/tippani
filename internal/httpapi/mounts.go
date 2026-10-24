package httpapi

// A mounted library as a source of the files a work's quotes came from.
//
// A reader with three hundred books does not upload three hundred times. The operator
// mounts the folders the library already lives in, read-only (`:ro` is THEIR guarantee;
// internal/mount is the app's), and the reader presses Scan. Nothing is copied: a mounted
// source's row points at a path inside the mount, Sources/ stays empty for it, and context
// and locators read through. Context is stored when the file is attached, so it survives
// the mount going away; what the mount gives instead of the space argument is that a rescan
// is free and repeatable.
//
// THE SCAN ONLY PROPOSES. It writes no source row on its own. What it finds is listed as
// "attach this file to this work", exact where an identifier matched (a folder's {tmdb-N},
// an EPUB's ISBN or ASIN) and for a look where only a name did, and the reader accepts or
// refuses. A refusal is remembered, so declining a file stays declined through rescans.
//
// NO PATH FROM THE CLIENT, EVER. A candidate carries a TOKEN the server signed, naming the
// mount, the relative path and the work. The client hands the token back; the server
// verifies it and decodes the path itself, so the only paths that can reach the disk are
// ones this process chose to offer. The signing key is random per process, so a token does
// not survive a restart, which only means "scan again".
//
// A scan starts only when a reader presses Scan: never on boot, never on a timer. One press
// queues a job (library_scan.go, ADR-0917-A) that walks the whole folder and stores its
// findings and checkpoint in the database as it goes. Nothing is capped and no second press
// is needed. The job ends when the folder does, or when the reader presses Stop.

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	"tippani/internal/ebook"
	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/mount"
	"tippani/internal/olog"
	"tippani/internal/srcmatch"
)

const (
	settingLibraryMounts = "library_mounts"
	maxMounts            = 8
	// A file over the source cap is skipped, as an upload would be refused.
	scanMaxBytes = maxSourceUpload
)

// mountCfg is one configured folder. Path is the container path the operator mounted;
// it is shown only to an administrator.
type mountCfg struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Path  string `json:"path"`
}

var mountID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

func (s *Server) loadMounts() []mountCfg {
	raw, err := s.Store.GetSetting(settingLibraryMounts)
	if err != nil || raw == "" {
		return nil
	}
	var out []mountCfg
	if json.Unmarshal([]byte(raw), &out) != nil {
		return nil
	}
	return out
}

func (s *Server) mountByID(id string) (*mount.Root, *mountCfg, error) {
	for _, m := range s.loadMounts() {
		if m.ID == id {
			r, err := mount.Open(m.Path)
			if err != nil {
				return nil, &m, err
			}
			return r, &m, nil
		}
	}
	return nil, nil, errors.New("no such library folder")
}

// ---- admin: which folders -------------------------------------------------------

type mountStatus struct {
	mountCfg
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// handleGetMounts: GET /admin/mounts.
func (s *Server) handleGetMounts(w http.ResponseWriter, r *http.Request) {
	out := []mountStatus{}
	for _, m := range s.loadMounts() {
		st := mountStatus{mountCfg: m, OK: true}
		if _, err := mount.Open(m.Path); err != nil {
			st.OK, st.Error = false, err.Error()
		}
		out = append(out, st)
	}
	writeJSON(w, http.StatusOK, map[string]any{"mounts": out})
}

// handlePutMounts: PUT /admin/mounts {mounts}. A mount is a property of the box, not of a
// reader, so it is the administrator's, through the global settings table; every reader's
// scan then sees the same folders. Files on it are the operator's, not another reader's
// rows, so that is not a breach of per-user isolation: what a scan PROPOSES is per user.
func (s *Server) handlePutMounts(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Mounts []mountCfg `json:"mounts"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Mounts) > maxMounts {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("at most %d library folders", maxMounts))
		return
	}
	seen := map[string]bool{}
	clean := make([]mountCfg, 0, len(req.Mounts))
	current := map[string]bool{}
	for _, m := range s.loadMounts() {
		current[m.ID] = true
	}
	// A REMOVED FOLDER'S ID IS SPOKEN FOR. Files attached from it still carry that id and a path
	// relative to it, so a different folder given the same id would silently take over their
	// rows: a rescan would read an unrelated file at the same relative path as the old source.
	orphaned := map[string]bool{}
	if rows, err := s.Store.DB.Query(`SELECT DISTINCT mount_id FROM work_sources WHERE origin = 'mount'`); err == nil {
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil && !current[id] {
				orphaned[id] = true
			}
		}
		rows.Close()
	}
	for _, m := range req.Mounts {
		m.ID, m.Label, m.Path = strings.TrimSpace(m.ID), strings.TrimSpace(m.Label), strings.TrimSpace(m.Path)
		if !mountID.MatchString(m.ID) {
			writeErr(w, http.StatusBadRequest, "a folder's id is lower-case letters, digits and hyphens")
			return
		}
		if seen[m.ID] {
			writeErr(w, http.StatusBadRequest, "two folders share the id "+m.ID)
			return
		}
		seen[m.ID] = true
		if orphaned[m.ID] && !current[m.ID] {
			writeErr(w, http.StatusBadRequest, "the id "+m.ID+" belonged to a folder that was removed and files attached from it still point at it: choose another name")
			return
		}
		if m.Label == "" {
			m.Label = m.ID
		}
		if _, err := mount.Open(m.Path); err != nil {
			writeErr(w, http.StatusBadRequest, "cannot read the folder "+m.Path+": "+err.Error())
			return
		}
		clean = append(clean, m)
	}
	// Scan rows of a removed or repointed folder are deleted: the id may be reused.
	for _, old := range s.loadMounts() {
		kept := false
		for _, m := range clean {
			if m.ID == old.ID && m.Path == old.Path {
				kept = true
			}
		}
		if !kept {
			s.forgetLibraryScans(old.ID)
		}
	}
	raw, _ := json.Marshal(clean)
	v := string(raw)
	if len(clean) == 0 {
		v = ""
	}
	if err := s.Store.SetSetting(settingLibraryMounts, v); err != nil {
		internalError(w, r, "save library folders", err)
		return
	}
	s.handleGetMounts(w, r)
}

// handleListMounts: GET /sources/mounts — what a reader may scan: ids and labels, and
// never a path.
func (s *Server) handleListMounts(w http.ResponseWriter, r *http.Request) {
	out := []map[string]string{}
	for _, m := range s.loadMounts() {
		out = append(out, map[string]string{"id": m.ID, "label": m.Label})
	}
	writeJSON(w, http.StatusOK, map[string]any{"mounts": out})
}

// ---- signed candidates ----------------------------------------------------------

type foundToken struct {
	Mount   string `json:"m"`
	Rel     string `json:"p"`
	Subject string `json:"s"`
	ID      int64  `json:"i"`
	Key     string `json:"k,omitempty"`
	Bucket  string `json:"b"`
}

func (s *Server) tokenKey() []byte {
	s.mountKeyOnce.Do(func() {
		s.mountKey = make([]byte, 32)
		_, _ = rand.Read(s.mountKey)
	})
	return s.mountKey
}

func (s *Server) signFound(t foundToken) string {
	body, _ := json.Marshal(t)
	mac := hmac.New(sha256.New, s.tokenKey())
	mac.Write(body)
	return base64.RawURLEncoding.EncodeToString(body) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Server) verifyFound(tok string) (foundToken, bool) {
	var t foundToken
	i := strings.IndexByte(tok, '.')
	if i < 0 {
		return t, false
	}
	body, err1 := base64.RawURLEncoding.DecodeString(tok[:i])
	sig, err2 := base64.RawURLEncoding.DecodeString(tok[i+1:])
	if err1 != nil || err2 != nil {
		return t, false
	}
	mac := hmac.New(sha256.New, s.tokenKey())
	mac.Write(body)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return t, false
	}
	return t, json.Unmarshal(body, &t) == nil
}

// ---- the scan -------------------------------------------------------------------

// foundCandidate is one proposal: this file for this work.
type foundCandidate struct {
	Token   string `json:"token"`
	Mount   string `json:"mount"`
	Rel     string `json:"rel"` // for the reader to read; never trusted coming back
	Format  string `json:"format"`
	Subject string `json:"subject"`
	WorkID  int64  `json:"work_id"`
	Title   string `json:"title"`
	Episode string `json:"episode,omitempty"`
	// How says what made the match: "id" is an identifier both sides hold (exact);
	// "title" is a name (a proposal).
	How    string `json:"how"`
	Bucket string `json:"bucket"` // exact | review
}

type scanWork struct {
	id      int64
	title   string
	author  string
	year    int
	media   string
	tmdb    int64
	tvdb    int64
	isbn    string
	asin    string
	foldedT string
	foldedA string
}

// scanLibrary reads what a scan can attach to: works that HAVE quotes (a file for a work
// with nothing to place in it is not worth proposing) and do not have a file yet.
func (s *Server) scanLibrary(uid int64) (books, movies []scanWork, haveBook map[int64]bool, haveFilm map[string]bool, quoted map[string]bool, err error) {
	haveBook, haveFilm, quoted = map[int64]bool{}, map[string]bool{}, map[string]bool{}

	rows, err := s.Store.DB.Query(`SELECT subject, subject_id, subject_key FROM work_sources WHERE user_id = ?`, uid)
	if err != nil {
		return
	}
	for rows.Next() {
		var sub, key string
		var id int64
		if rows.Scan(&sub, &id, &key) == nil {
			if sub == sourceBook {
				haveBook[id] = true
			} else if sub == sourceScreen {
				haveFilm[strconv.FormatInt(id, 10)+"|"+key] = true
			}
		}
	}
	rows.Close()

	brows, err := s.Store.DB.Query(
		`SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.isbn, ''), COALESCE(b.asin, '')
		 FROM books b WHERE b.user_id = ? AND EXISTS (SELECT 1 FROM annotations a WHERE a.book_id = b.id)`, uid)
	if err != nil {
		return
	}
	for brows.Next() {
		var b scanWork
		if brows.Scan(&b.id, &b.title, &b.author, &b.isbn, &b.asin) == nil {
			b.foldedT, b.foldedA = srcmatch.Fold(b.title), srcmatch.Fold(b.author)
			books = append(books, b)
		}
	}
	brows.Close()

	mrows, err := s.Store.DB.Query(
		`SELECT m.id, m.title, COALESCE(m.release_year, 0), m.media_type, COALESCE(m.tmdb_id, 0), COALESCE(m.tvdb_id, 0)
		 FROM movies m WHERE m.user_id = ? AND m.media_type != 'game'
		   AND EXISTS (SELECT 1 FROM dialogues d WHERE d.movie_id = m.id)`, uid)
	if err != nil {
		return
	}
	for mrows.Next() {
		var m scanWork
		if mrows.Scan(&m.id, &m.title, &m.year, &m.media, &m.tmdb, &m.tvdb) == nil {
			m.foldedT = srcmatch.Fold(m.title)
			movies = append(movies, m)
		}
	}
	mrows.Close()

	// Which episodes have lines: a show's subtitle is only worth proposing for one.
	drows, err := s.Store.DB.Query(
		`SELECT d.movie_id, COALESCE(d.season, 0), COALESCE(d.episode, 0) FROM dialogues d
		 JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ? GROUP BY d.movie_id, d.season, d.episode`, uid)
	if err != nil {
		return
	}
	for drows.Next() {
		var id int64
		var se, ep int
		if drows.Scan(&id, &se, &ep) == nil {
			quoted[strconv.FormatInt(id, 10)+"|"+fmt.Sprintf("s%02de%02d", se, ep)] = true
		}
	}
	drows.Close()
	return
}

// ignoredFound lists attach proposals the reader refused, by "work kind:id:mount:rel".
func (s *Server) ignoredFound(uid int64) map[string]bool {
	out := map[string]bool{}
	rows, err := s.Store.DB.Query(
		`SELECT kind, item_id, match_hash FROM cleanup_ignores WHERE user_id = ? AND field = 'source' AND rule = 'source-attach'`, uid)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var kind, h string
		var id int64
		if rows.Scan(&kind, &id, &h) == nil {
			out[kind+":"+strconv.FormatInt(id, 10)+":"+h] = true
		}
	}
	return out
}

func foundIgnoreKey(subject string, id int64, mountID, rel string) string {
	kind := "work-" + subject
	return kind + ":" + strconv.FormatInt(id, 10) + ":" + mountID + ":" + rel
}

// matchSubtitle names the work a subtitle belongs to from its folder and file name.
func (s *Server) matchSubtitle(mountID, rel string, movies []scanWork, have map[string]bool, quoted map[string]bool, ignored map[string]bool) (foundCandidate, int, bool) {
	n, ok := mount.ParseSubtitle(rel)
	if !ok {
		return foundCandidate{}, 0, false
	}
	want := "movie"
	if n.IsShow {
		want = "show"
	}
	var hit *scanWork
	how := ""
	for i := range movies {
		m := &movies[i]
		if m.media != want {
			continue
		}
		switch {
		case n.TMDB != "" && m.tmdb != 0 && strconv.FormatInt(m.tmdb, 10) == n.TMDB:
			hit, how = m, "id"
		case n.IsShow && n.TVDB != "" && m.tvdb != 0 && strconv.FormatInt(m.tvdb, 10) == n.TVDB:
			hit, how = m, "id"
		}
		if hit != nil {
			break
		}
	}
	if hit == nil {
		ft := srcmatch.Fold(n.Title)
		for i := range movies {
			m := &movies[i]
			if m.media != want || m.foldedT != ft || ft == "" {
				continue
			}
			if n.Year != 0 && m.year != 0 && n.Year != m.year {
				continue
			}
			hit, how = m, "title"
			break
		}
	}
	if hit == nil {
		return foundCandidate{}, 0, false
	}
	key := ""
	if n.IsShow {
		key = fmt.Sprintf("s%02de%02d", n.Season, n.Episode)
	}
	workKey := strconv.FormatInt(hit.id, 10)
	if have[workKey+"|"+key] {
		return foundCandidate{}, 0, false
	}
	// A film in the list has lines by construction; a show's subtitle is only worth
	// proposing for an episode that has some.
	if n.IsShow && !quoted[workKey+"|"+key] {
		return foundCandidate{}, 0, false
	}
	if ignored[foundIgnoreKey(sourceScreen, hit.id, mountID, rel)] {
		return foundCandidate{}, 0, false
	}
	bucket := bucketReview
	if how == "id" {
		bucket = bucketExact
	}
	c := foundCandidate{
		Mount: mountID, Rel: rel, Format: "subtitle", Subject: sourceScreen, WorkID: hit.id, Title: hit.title,
		Episode: key, How: how, Bucket: bucket,
	}
	c.Token = s.signFound(foundToken{Mount: mountID, Rel: rel, Subject: sourceScreen, ID: hit.id, Key: key, Bucket: bucket})
	return c, n.Rank, true
}

// epubIdentity is the few EPUB fields a match is judged on. It is stored in
// library_scan_files.meta, so an unchanged file can be matched again without opening it.
type epubIdentity struct {
	Title   string   `json:"t"`
	Creator string   `json:"c"`
	ISBNs   []string `json:"i,omitempty"`
	ASINs   []string `json:"a,omitempty"`
}

// readEPUBIdentity opens one EPUB through the mount and reads its metadata.
// It reads through a handle, not the whole file: the zip directory and package document
// are a few kilobytes at the end of a file that may be tens of megabytes.
func readEPUBIdentity(root *mount.Root, rel string) (epubIdentity, error) {
	f, size, err := root.OpenReader(rel)
	if err != nil {
		return epubIdentity{}, err
	}
	defer f.Close()
	meta, err := ebook.ReadMetaAt(f, size)
	if err != nil {
		return epubIdentity{}, err
	}
	return epubIdentity{Title: meta.Title, Creator: meta.Creator, ISBNs: meta.ISBNs, ASINs: meta.ASINs}, nil
}

// matchEPUB identifies a book by what is IN the file: an ISBN or ASIN both sides hold is
// exact, and otherwise the folded title (the file's often carries a subtitle the library's
// lacks) with the author agreeing is a proposal.
func (s *Server) matchEPUB(meta epubIdentity, mountID, rel string, books []scanWork, have map[int64]bool, quoted, ignored map[string]bool) (foundCandidate, bool) {
	var hit *scanWork
	how := ""
	isbns := map[string]bool{}
	for _, i := range meta.ISBNs {
		if n := metadata.NormalizeISBN(i); n != "" {
			isbns[n] = true
		}
	}
	for i := range books {
		b := &books[i]
		bi := metadata.NormalizeISBN(b.isbn)
		if (bi != "" && isbns[bi]) || (b.asin != "" && containsFold(meta.ASINs, b.asin)) {
			hit, how = b, "id"
			break
		}
	}
	if hit == nil {
		ft := srcmatch.Fold(meta.Title)
		fa := srcmatch.Fold(meta.Creator)
		for i := range books {
			b := &books[i]
			if b.foldedT == "" || ft == "" {
				continue
			}
			if !(ft == b.foldedT || strings.HasPrefix(ft, b.foldedT+" ")) {
				continue
			}
			if b.foldedA != "" && fa != "" && !wordsWithin(b.foldedA, fa) {
				continue
			}
			hit, how = b, "title"
			break
		}
	}
	if hit == nil || have[hit.id] || ignored[foundIgnoreKey(sourceBook, hit.id, mountID, rel)] {
		return foundCandidate{}, false
	}
	bucket := bucketReview
	if how == "id" {
		bucket = bucketExact
	}
	c := foundCandidate{Mount: mountID, Rel: rel, Format: "epub", Subject: sourceBook, WorkID: hit.id, Title: hit.title, How: how, Bucket: bucket}
	c.Token = s.signFound(foundToken{Mount: mountID, Rel: rel, Subject: sourceBook, ID: hit.id, Bucket: bucket})
	return c, true
}

func containsFold(list []string, v string) bool {
	for _, x := range list {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}

// wordsWithin reports whether every word of a appears among the words of b, or the
// reverse: "erikson" within "steven erikson", and "steven erikson" within "erikson".
func wordsWithin(a, b string) bool {
	in := func(x, y string) bool {
		set := map[string]bool{}
		for _, w := range strings.Fields(y) {
			set[w] = true
		}
		for _, w := range strings.Fields(x) {
			if !set[w] {
				return false
			}
		}
		return true
	}
	return in(a, b) || in(b, a)
}

// ---- attach and refuse ----------------------------------------------------------

// handleAttachFound: POST /sources/attach-found {bucket, tokens}. Each token is verified,
// its work re-resolved to this reader (a work that is not theirs is simply not attached),
// and the file read through the mount, never copied. The context is cut as it is for an
// upload. Bulk acts within one bucket and never across: a token of the other bucket is
// skipped and counted.
func (s *Server) handleAttachFound(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bucket string   `json:"bucket"`
		Tokens []string `json:"tokens"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Bucket != bucketExact && req.Bucket != bucketReview {
		writeErr(w, http.StatusBadRequest, "bucket must be exact or review")
		return
	}
	if len(req.Tokens) == 0 || len(req.Tokens) > 500 {
		writeErr(w, http.StatusBadRequest, "send between 1 and 500 files")
		return
	}
	uid := userID(r)
	attached, skipped, failed := 0, 0, 0
	var total contextStats
	done := []string{}
	for _, tok := range req.Tokens {
		t, ok := s.verifyFound(tok)
		if !ok {
			failed++
			continue
		}
		if t.Bucket != req.Bucket {
			skipped++
			continue
		}
		st, ok := s.attachFound(uid, t)
		if !ok {
			failed++
			continue
		}
		attached++
		s.dropFindings(uid, t, false)
		done = append(done, tok)
		total.Matched += st.Matched
		total.Ambiguous += st.Ambiguous
		total.Unmatched += st.Unmatched
		total.Skipped += st.Skipped
	}
	// `done` names the tokens that attached, so a screen drops exactly those and keeps the ones
	// that failed, to be retried or refused, instead of making them vanish with a count.
	writeJSON(w, http.StatusOK, map[string]any{"attached": attached, "skipped": skipped, "failed": failed, "done": done, "context": total})
}

// attachFound stores one mounted source and cuts its context. false is any refusal: the
// work is not this reader's, it already has a file, the file is gone or cannot be read.
func (s *Server) attachFound(uid int64, t foundToken) (contextStats, bool) {
	var st contextStats
	root, _, err := s.mountByID(t.Mount)
	if err != nil {
		return st, false
	}
	subj, serr := s.resolveSourceSubject(uid, t.Subject, t.ID, t.Key)
	if serr != nil {
		return st, false
	}
	data, err := root.ReadFile(t.Rel, scanMaxBytes)
	if err != nil {
		return st, false
	}
	format := importer.SourceFormat(data)
	if format == "" || !subj.Formats[format] {
		return st, false
	}
	units, unit, err := sourceUnits(format, data)
	if err != nil {
		return st, false
	}
	role := importer.SourceRole(format)
	sum := sha256.Sum256(data)
	res, err := s.Store.DB.Exec(
		`INSERT INTO work_sources (user_id, subject, subject_id, subject_key, role, format, path, origin, mount_id, name, bytes, sha256)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'mount', ?, ?, ?, ?)
		 ON CONFLICT (user_id, subject, subject_id, subject_key, role) DO NOTHING`,
		uid, subj.Subject, subj.ID, subj.Key, role, format, t.Rel, t.Mount, sourceName(path.Base(t.Rel)), len(data), hex.EncodeToString(sum[:]))
	if err != nil {
		olog.Printf("[sources] attach mounted file: %v", err)
		return st, false
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return st, false // it gained a file since the scan
	}
	id, _ := res.LastInsertId()
	st, err = s.extractContextUnits(uid, sourceKey{
		id: id, subject: subj.Subject, subjectID: subj.ID, key: subj.Key, format: format, path: t.Rel,
	}, units, unit)
	if err != nil {
		olog.Printf("[sources] context for mounted source %d: %v", id, err)
	}
	return st, true
}

// handleIgnoreFound: POST /sources/ignore-found {tokens}. A refusal as durable as Cleanup's.
func (s *Server) handleIgnoreFound(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tokens []string `json:"tokens"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Tokens) == 0 || len(req.Tokens) > 500 {
		writeErr(w, http.StatusBadRequest, "send between 1 and 500 files")
		return
	}
	uid := userID(r)
	ignored := 0
	for _, tok := range req.Tokens {
		t, ok := s.verifyFound(tok)
		if !ok {
			continue
		}
		// Only a work that is this reader's can be remembered against: the token names it,
		// and the resolve is the ownership check.
		if _, serr := s.resolveSourceSubject(uid, t.Subject, t.ID, t.Key); serr != nil {
			continue
		}
		res, err := s.Store.DB.Exec(
			`INSERT INTO cleanup_ignores (user_id, kind, item_id, field, rule, match_hash)
			 VALUES (?, ?, ?, 'source', 'source-attach', ?)
			 ON CONFLICT (user_id, kind, item_id, field, rule, match_hash) DO NOTHING`,
			uid, "work-"+t.Subject, t.ID, t.Mount+":"+t.Rel)
		if err != nil {
			internalError(w, r, "ignore found file", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			ignored++
		}
		s.dropFindings(uid, t, true)
	}
	writeJSON(w, http.StatusOK, map[string]int{"ignored": ignored})
}

// readMountedSource reads a mounted source's bytes through its mount, for a rescan.
func (s *Server) readMountedSource(mountID, rel string) ([]byte, error) {
	root, _, err := s.mountByID(mountID)
	if err != nil {
		return nil, err
	}
	return root.ReadFile(rel, scanMaxBytes)
}

// mountedState answers "mounted" while a mounted source's file is where it was and
// "missing" when the mount or the file is not. The stored context is unaffected either
// way: it is rows, and it opens whether or not the disk is there.
func (s *Server) mountedState(uid, id int64) string {
	var mountID, rel string
	if err := s.Store.DB.QueryRow(`SELECT mount_id, path FROM work_sources WHERE id = ? AND user_id = ?`, id, uid).Scan(&mountID, &rel); err != nil {
		return "missing"
	}
	root, _, err := s.mountByID(mountID)
	if err != nil || !root.Exists(rel) {
		return "missing"
	}
	return "mounted"
}
