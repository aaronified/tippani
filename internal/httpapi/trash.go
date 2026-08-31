package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"tippani/internal/olog"
)

// The bin: a delete that can be taken back.
//
// Every delete in this app was final. What makes it recoverable is not a
// `deleted_at` column — that would put a predicate in front of every query,
// count, stat, export, FTS trigger and dedupe check in the app, and the one that
// gets forgotten shows a deleted quote in a quiz six months later. Instead the
// row is really deleted, exactly as before, and a JSON snapshot of its whole
// subtree is parked in `trash` (migration 0031).
//
// ONE ENTRY PER USER ACTION. Deleting a book bins the book, its forty quotes,
// their tag joins, their review schedule, its genres and its read log as one row,
// restored whole. There is no way to end up with a quote whose book is missing.
//
// WHAT TRAVELS IS DECLARED, NOT DISCOVERED. Walking the foreign-key graph looks
// like the robust choice and is not: `item_reviews` (kind, item_id),
// `work_reads` (kind, work_id) and now `anthology_entries` (kind, item_id) carry no
// foreign key at all and are cleared by AFTER DELETE triggers instead, so an FK
// walk would silently drop somebody's memory half-life, their entire read log and
// the commentary they wrote about a passage — and the restore would look like it
// worked. See migration 0031's header, which records this and two other things
// the schema does that a reader would not guess.
//
// COLUMNS, on the other hand, are discovered: every row is read with `SELECT *`
// and keyed by the column names the driver reports. A snapshot that lists its
// columns by hand is a snapshot that stops carrying the column added next
// release, and the failure surfaces months later as a field quietly reset to its
// default.

// trashKinds are the five content kinds that get a bin, plus the account entry
// admin deletion writes. Tags, people, stickers and avatars still delete
// outright: a tag is vocabulary and a person is a reference row, and neither is
// the thing somebody means when they say they deleted something by accident.
var trashKinds = map[string]bool{
	"book": true, "movie": true, "annotation": true, "dialogue": true, "quote": true,
}

// trashTable maps a kind to the table its primary row lives in.
var trashTable = map[string]string{
	"book":       "books",
	"movie":      "movies",
	"annotation": "annotations",
	"dialogue":   "dialogues",
	"quote":      "utterances",
}

// reviewKindFor maps a quote kind to its polymorphic `item_reviews.kind`. The
// three names are historical and deliberately not tidied: 'screen' predates
// 'dialogue' as the word for a film line, and renaming it in the schema would be
// a rebuild of a table nothing else needs to touch.
var reviewKindFor = map[string]string{
	"annotation": "book",
	"dialogue":   "screen",
	"quote":      "utterance",
}

// trashRow is one bin entry as the API reports it. `Contents` is filled only when
// a single entry is read, because the list view shows a summary and the expansion
// reads the payload it already has.
type trashRow struct {
	ID         int64  `json:"id"`
	Kind       string `json:"kind"`
	Label      string `json:"label"`
	ChildCount int    `json:"child_count"`
	DeletedAt  string `json:"deleted_at"`
	Files      int    `json:"files"`
}

// snapshot is the payload: table name -> whole rows, in no particular order. The
// restore knows the order to put them back in; the snapshot only has to be
// complete.
type snapshot map[string][]map[string]any

// ---------------------------------------------------------------------------
// reading rows generically
// ---------------------------------------------------------------------------

// queryMaps runs a query and returns each row as column -> value, using the
// column names the driver reports rather than a list written here.
//
// TEXT arrives from this driver as []byte, which JSON would encode as base64 and
// hand back as a string that no longer matches — so bytes are converted on the
// way in. No table in this schema stores a BLOB; if one ever does, this line is
// the thing that was wrong.
func queryMaps(tx *sql.Tx, query string, args ...any) ([]map[string]any, error) {
	rows, err := tx.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	var out []map[string]any
	for rows.Next() {
		cells := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range cells {
			ptrs[i] = &cells[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			if b, ok := cells[i].([]byte); ok {
				row[c] = string(b)
			} else {
				row[c] = cells[i]
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// intOf reads an integer out of a snapshot row, whatever numeric shape JSON left
// it in (int64 on the way out of SQLite, float64 on the way back through JSON).
func intOf(v any) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case float64:
		return int64(n), true
	case int:
		return int64(n), true
	}
	return 0, false
}

func stringOf(v any) string {
	switch s := v.(type) {
	case string:
		return s
	case []byte:
		return string(s)
	}
	return ""
}

// ids pulls one column out of a row set.
func ids(rows []map[string]any, col string) []int64 {
	out := make([]int64, 0, len(rows))
	for _, r := range rows {
		if n, ok := intOf(r[col]); ok {
			out = append(out, n)
		}
	}
	return out
}

// inList renders "(?, ?, ?)" plus its arguments for an IN clause. Returns ok=false
// for an empty list, because `IN ()` is a syntax error and the caller wants to
// skip the query entirely rather than build one that cannot run.
func inList(vals []int64) (string, []any, bool) {
	if len(vals) == 0 {
		return "", nil, false
	}
	args := make([]any, len(vals))
	marks := make([]string, len(vals))
	for i, v := range vals {
		args[i] = v
		marks[i] = "?"
	}
	return "(" + strings.Join(marks, ", ") + ")", args, true
}

// ---------------------------------------------------------------------------
// collecting the subtree
// ---------------------------------------------------------------------------

// collected is everything trashAndDelete needs to write one bin entry.
type collected struct {
	TrashID  int64 // the bin entry that was written, for the toast's Undo
	Label    string
	Children int      // quotes that travel with it, for the summary line
	Files    []string // image filenames to park
	Payload  snapshot
}

// collect reads the whole subtree of one item, filtering ownership IN THE SAME
// STATEMENT as the read. A row belonging to somebody else is not found, which is
// the house rule: 404, never 403.
func collect(tx *sql.Tx, uid int64, kind string, id int64) (*collected, error) {
	switch kind {
	case "book":
		return collectWork(tx, uid, "book", id)
	case "movie":
		return collectWork(tx, uid, "movie", id)
	case "annotation", "dialogue", "quote":
		return collectQuote(tx, uid, kind, id)
	}
	return nil, fmt.Errorf("trash: unknown kind %q", kind)
}

// collectWork gathers a book or a film: the work, its genre joins, every quote
// under it with their tag joins and review rows, and its read log.
func collectWork(tx *sql.Tx, uid int64, kind string, id int64) (*collected, error) {
	work := "books"
	quotes := "annotations"
	quoteFK := "book_id"
	joinTable := "annotation_tags"
	joinFK := "annotation_id"
	genreJoin := "book_genres"
	genreFK := "book_id"
	reviewKind := "book"
	if kind == "movie" {
		work, quotes, quoteFK = "movies", "dialogues", "movie_id"
		joinTable, joinFK = "dialogue_tags", "dialogue_id"
		genreJoin, genreFK = "movie_genres", "movie_id"
		reviewKind = "screen"
	}

	rows, err := queryMaps(tx, `SELECT * FROM `+work+` WHERE id = ? AND user_id = ?`, id, uid)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, sql.ErrNoRows
	}
	out := &collected{Payload: snapshot{work: rows}}
	out.Label = stringOf(rows[0]["title"])

	// The cover or poster. Stickers are NOT collected: a sticker is a library row
	// of its own that many quotes may wear, so parking its file would blank the
	// seal on every other quote using it.
	fileCol := "cover_path"
	if kind == "movie" {
		fileCol = "poster_path"
	}
	if f := stringOf(rows[0][fileCol]); f != "" {
		out.Files = append(out.Files, f)
	}

	if err := collectGenres(tx, uid, out, genreJoin, genreFK, id); err != nil {
		return nil, err
	}

	qs, err := queryMaps(tx, `SELECT * FROM `+quotes+` WHERE `+quoteFK+` = ?`, id)
	if err != nil {
		return nil, err
	}
	out.Children = len(qs)
	if len(qs) > 0 {
		out.Payload[quotes] = qs
		if err := collectTagJoins(tx, uid, out, joinTable, joinFK, ids(qs, "id")); err != nil {
			return nil, err
		}
		if err := collectReviews(tx, out, reviewKind, ids(qs, "id")); err != nil {
			return nil, err
		}
		if err := collectAnthologyEntries(tx, out, reviewKind, ids(qs, "id")); err != nil {
			return nil, err
		}
	}

	// The read log, which has no foreign key and is cleared by a trigger (0024).
	reads, err := queryMaps(tx,
		`SELECT * FROM work_reads WHERE user_id = ? AND kind = ? AND work_id = ?`, uid, kind, id)
	if err != nil {
		return nil, err
	}
	if len(reads) > 0 {
		out.Payload["work_reads"] = reads
	}
	// The cast, on the same terms (0048): no foreign key, cleared by a trigger,
	// invisible to any walk. Tombstones come too — a tombstone is a decision the
	// reader made about this work's cast, and restoring a film without it would
	// let the next refetch put back a row they deleted on purpose.
	cast, err := queryMaps(tx,
		`SELECT * FROM work_cast WHERE user_id = ? AND kind = ? AND work_id = ?`, uid, kind, id)
	if err != nil {
		return nil, err
	}
	if len(cast) > 0 {
		out.Payload["work_cast"] = cast
	}
	return out, nil
}

// collectQuote gathers one quote of any of the three kinds: the row, its tag
// joins and its review schedule.
func collectQuote(tx *sql.Tx, uid int64, kind string, id int64) (*collected, error) {
	table := trashTable[kind]
	// Ownership: a standalone quote carries user_id on the row; the other two are
	// reached through their parent work. Either way it is one statement.
	var query string
	switch kind {
	case "annotation":
		query = `SELECT a.* FROM annotations a JOIN books b ON b.id = a.book_id
		         WHERE a.id = ? AND b.user_id = ?`
	case "dialogue":
		query = `SELECT d.* FROM dialogues d JOIN movies m ON m.id = d.movie_id
		         WHERE d.id = ? AND m.user_id = ?`
	default:
		query = `SELECT * FROM utterances WHERE id = ? AND user_id = ?`
	}
	rows, err := queryMaps(tx, query, id, uid)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, sql.ErrNoRows
	}
	out := &collected{Payload: snapshot{table: rows}}
	out.Label = quoteLabel(rows[0])

	joinTable, joinFK := "annotation_tags", "annotation_id"
	switch kind {
	case "dialogue":
		joinTable, joinFK = "dialogue_tags", "dialogue_id"
	case "quote":
		joinTable, joinFK = "utterance_tags", "utterance_id"
	}
	if err := collectTagJoins(tx, uid, out, joinTable, joinFK, []int64{id}); err != nil {
		return nil, err
	}
	if err := collectReviews(tx, out, reviewKindFor[kind], []int64{id}); err != nil {
		return nil, err
	}
	if err := collectAnthologyEntries(tx, out, reviewKindFor[kind], []int64{id}); err != nil {
		return nil, err
	}
	return out, nil
}

// collectTagJoins carries the join rows AND the tags they name.
//
// The tag rows travel because a tag can be deleted between the delete and the
// restore — tags are managed vocabulary and outlive the quotes that used them —
// and a join row pointing at a tag that is gone fails the foreign key. The
// restore re-creates any missing tag by NAME, which is also why the name has to
// be here and not just the id.
func collectTagJoins(tx *sql.Tx, uid int64, out *collected, joinTable, joinFK string, quoteIDs []int64) error {
	marks, args, ok := inList(quoteIDs)
	if !ok {
		return nil
	}
	joins, err := queryMaps(tx, `SELECT * FROM `+joinTable+` WHERE `+joinFK+` IN `+marks, args...)
	if err != nil {
		return err
	}
	if len(joins) == 0 {
		return nil
	}
	out.Payload[joinTable] = joins
	tagMarks, tagArgs, ok := inList(ids(joins, "tag_id"))
	if !ok {
		return nil
	}
	tags, err := queryMaps(tx,
		`SELECT * FROM tags WHERE user_id = ? AND id IN `+tagMarks, append([]any{uid}, tagArgs...)...)
	if err != nil {
		return err
	}
	if len(tags) > 0 {
		out.Payload["tags"] = mergeRows(out.Payload["tags"], tags)
	}
	return nil
}

// collectGenres carries the genre joins and the genre rows they name, for the
// same reason tags travel — and one more: genres are garbage-collected on delete
// (gcGenres), so a genre whose last book this was is gone before the transaction
// ends. The restore puts it back by name.
func collectGenres(tx *sql.Tx, uid int64, out *collected, joinTable, joinFK string, workID int64) error {
	joins, err := queryMaps(tx, `SELECT * FROM `+joinTable+` WHERE `+joinFK+` = ?`, workID)
	if err != nil {
		return err
	}
	if len(joins) == 0 {
		return nil
	}
	out.Payload[joinTable] = joins
	marks, args, ok := inList(ids(joins, "genre_id"))
	if !ok {
		return nil
	}
	genres, err := queryMaps(tx,
		`SELECT * FROM genres WHERE user_id = ? AND id IN `+marks, append([]any{uid}, args...)...)
	if err != nil {
		return err
	}
	if len(genres) > 0 {
		out.Payload["genres"] = mergeRows(out.Payload["genres"], genres)
	}
	return nil
}

// collectReviews carries the spaced-repetition schedule. It has no foreign key
// and is deleted by a trigger, so it has to be read before the delete and put
// back explicitly — losing it means a restored quote comes back as a brand-new
// card, which is a quiet way to lose months of review history.
func collectReviews(tx *sql.Tx, out *collected, reviewKind string, itemIDs []int64) error {
	marks, args, ok := inList(itemIDs)
	if !ok {
		return nil
	}
	revs, err := queryMaps(tx,
		`SELECT * FROM item_reviews WHERE kind = ? AND item_id IN `+marks,
		append([]any{reviewKind}, args...)...)
	if err != nil {
		return err
	}
	if len(revs) > 0 {
		out.Payload["item_reviews"] = mergeRows(out.Payload["item_reviews"], revs)
	}
	return nil
}

// collectAnthologyEntries carries a quote's place in every anthology it is in,
// AND the commentary written about it there.
//
// THE THIRD TABLE OF THIS SHAPE, and the one with the most to lose. item_reviews
// holds a half-life the app computed and work_reads holds dates; this holds a
// sentence the reader wrote, which exists nowhere else in the library. A quote
// deleted and put back without it comes back missing from every anthology it was
// in, with its commentary gone — and the bin would report a successful restore.
//
// Scoped by anthology OWNER as well as by item, so a payload can only ever carry
// entries from the caller's own anthologies. That is redundant today (an entry
// cannot be created against a quote its anthology's owner does not own) and it is
// the line that keeps this correct if that ever stops being true.
func collectAnthologyEntries(tx *sql.Tx, out *collected, entryKind string, itemIDs []int64) error {
	marks, args, ok := inList(itemIDs)
	if !ok {
		return nil
	}
	rows, err := queryMaps(tx, `
		SELECT e.* FROM anthology_entries e
		JOIN anthologies an ON an.id = e.anthology_id
		WHERE e.kind = ? AND e.item_id IN `+marks, append([]any{entryKind}, args...)...)
	if err != nil {
		return err
	}
	if len(rows) > 0 {
		out.Payload["anthology_entries"] = append(out.Payload["anthology_entries"], rows...)
	}
	return nil
}

// mergeRows appends without duplicating by id, for the aux tables that two
// branches can both reach (a book's genres, a quote's tags).
func mergeRows(have, add []map[string]any) []map[string]any {
	seen := map[int64]bool{}
	for _, r := range have {
		if n, ok := intOf(r["id"]); ok {
			seen[n] = true
		}
	}
	for _, r := range add {
		n, ok := intOf(r["id"])
		if ok && seen[n] {
			continue
		}
		have = append(have, r)
		seen[n] = true
	}
	return have
}

// quoteLabel is what a binned quote says in the list: its own first words, since
// a quote has no title. Cut on a word boundary rather than mid-word — the label
// is read by a person, and "The margins are where the reader answ" is worse than
// one word shorter.
func quoteLabel(row map[string]any) string {
	text := strings.TrimSpace(stringOf(row["quote"]))
	if text == "" {
		text = strings.TrimSpace(stringOf(row["note"]))
	}
	text = strings.Join(strings.Fields(text), " ")
	const max = 80
	if len(text) <= max {
		return text
	}
	cut := text[:max]
	if i := strings.LastIndex(cut, " "); i > 40 {
		cut = cut[:i]
	}
	return cut + "…"
}

// ---------------------------------------------------------------------------
// writing the bin entry
// ---------------------------------------------------------------------------

// trashAndDelete bins one item and deletes it, in the caller's transaction.
//
// The order is the design: read the subtree, write the snapshot, then delete — so
// the delete's own cascades and triggers run exactly as they always have, against
// rows that are already safely copied. Nothing about the existing delete logic
// changes; this is a step in front of it.
//
// File parking is NOT here. It happens after the commit, in parkFiles, because
// moving a file is the one step the database cannot roll back: a parked file whose
// transaction failed is garbage the purge collects, whereas a deleted file whose
// row survived is a cover nobody can get back. It fails towards keeping the file.
func (s *Server) trashAndDelete(tx *sql.Tx, uid int64, kind string, id int64) (*collected, error) {
	if !trashKinds[kind] {
		return nil, fmt.Errorf("trash: %q is not a binnable kind", kind)
	}
	got, err := collect(tx, uid, kind, id)
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(got.Payload)
	if err != nil {
		return nil, err
	}
	files, err := json.Marshal(got.Files)
	if err != nil {
		return nil, err
	}
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		uid, kind, got.Label, got.Children, string(payload), string(files))
	if err != nil {
		return nil, err
	}
	if got.TrashID, err = res.LastInsertId(); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(
		`DELETE FROM `+trashTable[kind]+` WHERE id = ?`, id); err != nil {
		return nil, err
	}
	return got, nil
}

// ---------------------------------------------------------------------------
// parked files
// ---------------------------------------------------------------------------

// trashDir is where a binned item's images wait. Under MediaCover so it shares
// the same volume — parking has to be a rename, not a copy, or a cover-heavy
// delete would double its disk use for thirty days.
func (s *Server) trashDir() string { return filepath.Join(s.coversDir(), "trash") }

// parkFiles moves images out of the cover store and into the bin's own corner,
// after the transaction has committed. Best-effort per file, and biased towards
// keeping: a file that will not move stays where it is, which leaves a cover
// visible for a book that is in the bin. That is a cosmetic wrong; the other
// direction loses the picture for good.
func (s *Server) parkFiles(names []string) {
	if len(names) == 0 {
		return
	}
	if err := os.MkdirAll(s.trashDir(), 0o700); err != nil {
		olog.Warnf(olog.CodeTrashFile, "[trash] park: cannot create %s: %v", s.trashDir(), err)
		return
	}
	for _, n := range names {
		if !coverFile.MatchString(n) {
			continue // never a path, only a filename the server generated
		}
		from := filepath.Join(s.coversDir(), n)
		to := filepath.Join(s.trashDir(), n)
		if err := os.Rename(from, to); err != nil && !errors.Is(err, os.ErrNotExist) {
			olog.Warnf(olog.CodeTrashFile, "[trash] park %s: %v", n, err)
		}
	}
}

// unparkFiles moves images back on a restore. The same bias applies in reverse
// and for the same reason: a file that will not come back is a missing cover on a
// restored row, not a missing row.
func (s *Server) unparkFiles(names []string) {
	for _, n := range names {
		if !coverFile.MatchString(n) {
			continue
		}
		from := filepath.Join(s.trashDir(), n)
		to := filepath.Join(s.coversDir(), n)
		if err := os.Rename(from, to); err != nil && !errors.Is(err, os.ErrNotExist) {
			olog.Warnf(olog.CodeTrashFile, "[trash] unpark %s: %v", n, err)
		}
	}
}

// removeParked deletes parked images for good — called by the purge, never by a
// delete.
func (s *Server) removeParked(names []string) {
	for _, n := range names {
		if coverFile.MatchString(n) {
			_ = os.Remove(filepath.Join(s.trashDir(), n))
		}
	}
}

// fileList decodes a trash row's `files` column.
func fileList(raw string) []string {
	var out []string
	if raw == "" {
		return nil
	}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		olog.Warnf(olog.CodeTrashFile, "[trash] unreadable file list %q: %v", raw, err)
		return nil
	}
	return out
}

// ---------------------------------------------------------------------------
// the handler shape every binnable delete now has
// ---------------------------------------------------------------------------

// binDelete is the body of a delete handler that goes to the bin: one
// transaction that snapshots and removes, then the file parking, then the
// response.
//
// One helper rather than five hand-written handlers, because the ORDER is the
// correctness argument and it is identical for all five kinds — read the subtree,
// write the snapshot, delete, commit, only then touch the filesystem. Five copies
// of an order is five chances to get it wrong once.
//
//	inTx  runs inside the same transaction, after the delete: the genre
//	      garbage-collection a work's delete has always done.
//	after runs once it is committed: the orphan-people sweep, which reads.
func (s *Server) binDelete(w http.ResponseWriter, r *http.Request, kind, notFound string,
	inTx func(*sql.Tx) error, after func()) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid "+kind+" id")
		return
	}
	uid := userID(r)
	olog.Tracef("[trash] delete kind=%s uid=%v id=%v", kind, uid, id)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "delete "+kind+": begin tx", err)
		return
	}
	defer tx.Rollback()
	got, err := s.trashAndDelete(tx, uid, kind, id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, notFound)
		return
	case err != nil:
		// THE DELETE IS REFUSED, not made final. A snapshot that could not be
		// written is the one case where carrying on would lose the thing this
		// whole feature exists to keep.
		olog.Warnf(olog.CodeTrashWrite, "[trash] could not bin %s %d for user %d: %v", kind, id, uid, err)
		internalError(w, r, "delete "+kind+": bin it first", err)
		return
	}
	if inTx != nil {
		if err := inTx(tx); err != nil {
			internalError(w, r, "delete "+kind+": after-delete work", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "delete "+kind+": commit", err)
		return
	}
	s.parkFiles(got.Files)
	if after != nil {
		after()
	}
	// `trash_id` is what the client's Undo posts back. It rides on the delete
	// response rather than being looked up afterwards, so an Undo cannot pick the
	// wrong entry when two deletes land in the same second.
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "trash_id": got.TrashID})
}

// ---------------------------------------------------------------------------
// the retention window
// ---------------------------------------------------------------------------

// trashDayChoices are the offered windows, and NEVER IS -1 RATHER THAN 0.
//
// That is the whole subtlety of this setting. `preferences` is one JSON blob with
// defaults applied on read, so a field nobody has ever set is absent and
// unmarshals to the zero value — which means 0 cannot also mean "never expire".
// If it did, every account that predates the bin would read as "never", the purge
// would never run for any of them, and the bin would grow forever because of a
// missing key. -1 is unambiguous: it can only have been written on purpose.
//
// 30 days is the default. The reason to want a shorter window is usually wanting
// something gone NOW, which is what "Empty now" is for.
var trashDayChoices = map[int]bool{7: true, 30: true, 90: true, trashNever: true}

// trashNever is the retention window that does not expire.
const trashNever = -1

// defaultTrashDays is what every account starts with, and what every account that
// predates the bin reads as.
const defaultTrashDays = 30

// normalizeTrashDays maps a stored value onto an offered one, so a hand-edited
// preferences blob or a restored archive from a future version cannot turn the
// purge off by accident.
func normalizeTrashDays(v int) int {
	if trashDayChoices[v] {
		return v
	}
	return defaultTrashDays
}

// trashDays is the caller's retention window, in days, with 0 meaning never.
// Reads the preference and falls back to the default rather than failing: a bin
// list that 500s because a preference could not be read is worse than a list.
func (s *Server) trashDays(uid int64) int {
	p, err := s.loadPrefs(uid)
	if err != nil {
		olog.Warnf(olog.CodeTrashPurge, "[trash] could not read the retention window for user %d: %v", uid, err)
		return defaultTrashDays
	}
	return p.TrashDays
}

// ---------------------------------------------------------------------------
// the purge
// ---------------------------------------------------------------------------

// purgeStampKey records the day the last sweep ran, so the daily one is a date
// comparison rather than a timer.
const purgeStampKey = "trash_purged_on"

// PurgeTrash removes every entry past its owner's retention window, and the files
// those entries were holding, then collects any parked file no entry references.
//
// NO SCHEDULER, DELIBERATELY. It runs at startup and then at most once a day, on
// the first request that notices the date has changed. A ticker would mean a
// goroutine and a wakeup on a machine that is otherwise asleep; a self-hosted box
// gets switched off, and "30 days" meaning 30 days OF THE APP BEING ALIVE is the
// honest reading of a promise made by a program that is not running.
//
// The window is PER USER, because the setting is: two accounts on one instance can
// keep their bins for different lengths of time, so the sweep asks each owner's
// preference rather than applying one number to the table.
func (s *Server) PurgeTrash() {
	uids, err := allUserIDs(s.Store.DB)
	if err != nil {
		olog.Warnf(olog.CodeTrashPurge, "[trash] purge: list users: %v", err)
		return
	}
	total := 0
	for _, uid := range uids {
		days := s.trashDays(uid)
		if days == trashNever {
			continue
		}
		// The cutoff is computed by SQLite in its own time format, against the same
		// clock that wrote deleted_at. Comparing in Go would mean parsing that
		// format and picking a timezone, and both are ways to be a day out.
		rows, err := s.Store.DB.Query(
			`SELECT id, files FROM trash
			 WHERE user_id = ? AND deleted_at < datetime('now', ?)`,
			uid, fmt.Sprintf("-%d days", days))
		if err != nil {
			olog.Warnf(olog.CodeTrashPurge, "[trash] purge: read expired for user %d: %v", uid, err)
			continue
		}
		var expired []int64
		var files []string
		for rows.Next() {
			var id int64
			var raw string
			if err := rows.Scan(&id, &raw); err != nil {
				continue
			}
			expired = append(expired, id)
			files = append(files, fileList(raw)...)
		}
		rows.Close()
		for _, id := range expired {
			if _, err := s.Store.DB.Exec(`DELETE FROM trash WHERE id = ? AND user_id = ?`, id, uid); err != nil {
				olog.Warnf(olog.CodeTrashPurge, "[trash] purge: delete entry %d: %v", id, err)
				continue
			}
			total++
		}
		// Files after the rows: a file removed for a row that then failed to delete
		// would be a bin entry that restores without its cover.
		s.removeParked(files)
	}
	s.sweepOrphanParked()
	if total > 0 {
		olog.Printf("[trash] purged %d expired entr%s", total, plural(total, "y", "ies"))
	}
}

// sweepOrphanParked deletes parked files no bin entry names.
//
// These exist because parking is the one step outside the transaction and it fails
// towards keeping the file (see parkFiles). It is also the only cleanup path for a
// user whose account was deleted: their trash rows cascade with the user row, and
// the files they named do not.
func (s *Server) sweepOrphanParked() {
	entries, err := os.ReadDir(s.trashDir())
	if err != nil {
		return // no parked files yet, or the directory is unreadable — nothing to do
	}
	referenced := map[string]bool{}
	rows, err := s.Store.DB.Query(`SELECT files FROM trash`)
	if err != nil {
		olog.Warnf(olog.CodeTrashPurge, "[trash] sweep: read file lists: %v", err)
		return // without the full list, deleting anything would be a guess
	}
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			// A row that will not scan is a row whose files are unknown, and deleting
			// files on an incomplete list is exactly the mistake to avoid here.
			olog.Warnf(olog.CodeTrashPurge, "[trash] sweep: unreadable file list; skipping the sweep")
			rows.Close()
			return
		}
		for _, f := range fileList(raw) {
			referenced[f] = true
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTrashPurge, "[trash] sweep: %v", err)
		return
	}
	for _, e := range entries {
		if e.IsDir() || referenced[e.Name()] {
			continue
		}
		_ = os.Remove(filepath.Join(s.trashDir(), e.Name()))
	}
}

// purgeIfNewDay runs the sweep at most once a calendar day, from whichever request
// happens to be first after midnight. Cheap enough to call on any request: one
// settings read, and a string compare.
func (s *Server) purgeIfNewDay() {
	today, err := s.today()
	if err != nil {
		return
	}
	last, err := s.Store.GetSetting(purgeStampKey)
	if err != nil || last == today {
		return
	}
	// Stamp BEFORE sweeping, not after. Two requests can arrive in the same
	// millisecond after midnight; stamping first means the loser does nothing
	// instead of running a second concurrent sweep over the same rows.
	if err := s.Store.SetSetting(purgeStampKey, today); err != nil {
		olog.Warnf(olog.CodeTrashPurge, "[trash] purge: stamp the day: %v", err)
		return
	}
	s.PurgeTrash()
}

// today is the server's date as SQLite sees it, so the stamp and every
// `deleted_at` are written by one clock in one format.
func (s *Server) today() (string, error) {
	var d string
	err := s.Store.DB.QueryRow(`SELECT date('now')`).Scan(&d)
	return d, err
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

// ---------------------------------------------------------------------------
// an account
// ---------------------------------------------------------------------------

// accountTables is the whole of a user's data, in restore order: parents before
// children, and the user row first because everything else references it.
//
// DECLARED, like every other snapshot in this file, and for a sharper version of
// the same reason: a table added next release that belongs to a user and is NOT
// listed here means deleting an account silently drops it from the bin, so the
// restore comes back missing something nobody thought to check. The
// account-round-trip test compares this list against every table with a `user_id`
// column, so adding one to the schema fails the build rather than the restore.
var accountTables = []string{
	"users",
	// characters beside people, and person_alias/character_alias after both,
	// because this list is in RESTORE order and each alias row references its
	// record. An alias is the ONLY evidence a merge ever happened: without it a
	// restored library re-splits into the four Bulgakovs the reader spent an
	// afternoon folding into one, and re-creates them silently on the next
	// credit write, because resolving a name is what consults the alias table.
	"genres", "tags", "stickers", "people", "person_kinds", "characters",
	"person_alias", "character_alias",
	"books", "movies",
	// boards BEFORE utterances, because this list is in RESTORE order (parents
	// first) and the delete walks it backwards. utterances.board_id is ON DELETE
	// RESTRICT — the rule that no quote is ever orphaned — so a delete that
	// removed the boards first would be refused by the database rather than
	// cascading, which is exactly what it did before this line moved here.
	"boards",
	"annotations", "dialogues", "utterances",
	// anthologies BEFORE its entries, and its entries AFTER the three quote tables,
	// because this list is in restore order and an entry references both ends. The
	// anthologies row carries the reader's own prose — the introduction and the
	// commentary on every entry — which is the only thing in this snapshot that
	// exists nowhere else in the library: a quote can be re-highlighted, and a
	// sentence somebody wrote about why it sits third cannot.
	"anthologies", "anthology_entries",
	"book_genres", "movie_genres",
	"annotation_tags", "dialogue_tags", "utterance_tags",
	// work_cast beside work_reads, and for the same reason: both hang off a work
	// by a polymorphic (kind, work_id) pair with no foreign key, so nothing walks
	// to them. A cast row is also the only thing here that a reader TYPED about a
	// work rather than about a quote — a voice actor no provider lists exists
	// nowhere else at all.
	"item_reviews", "work_reads", "work_cast",
	// work_field_source with them, and for a third version of the same reason:
	// it hangs off a work by the same polymorphic (kind, work_id) pair, so nothing
	// walks to it either. Worth KEEPING rather than skipping — it records which
	// supplier last wrote each field, and a restored library that lost it would
	// answer "where did this come from" with silence for every work, which is the
	// one answer that is indistinguishable from never having been fetched.
	"work_field_source",
	// work_person with them: it hangs off a work by the same polymorphic
	// (kind, work_id) pair, so nothing walks to it. It carries credit_as and
	// the ordering a work prints its credits in — neither of which is
	// recoverable from the cached column, because that column is composed FROM
	// these rows. Restore without it and every co-authored work comes back as
	// one person named after the whole credit line.
	"work_person",
	// cleanup_ignores (0052) hangs off a quote by the same polymorphic (kind,
	// item_id) pair, so nothing walks to it either — and what it holds is a
	// judgement the reader made about their own words: "that finding is my real
	// writing, stop asking". Dropped from the snapshot, a restored account would be
	// re-offered every finding it had already dismissed, on a page whose whole
	// usefulness is that it does not do that.
	"cleanup_ignores",
	"import_batches", "staged_works", "staged_quotes",
	// A reader's own uploaded type (0039). It is data rather than a credential —
	// a font somebody found and chose — so it comes back with the account, and
	// its file is parked beside the covers by userCoverFiles.
	"user_fonts",
}

// accountSkipTables are the user-owned tables a restore deliberately does NOT put
// back, with the reason each: they are credentials, and a credential that
// out-survives the account it belonged to is a credential nobody chose to reissue.
//
//	sessions       browser logins. Restoring them would hand a live cookie back
//	               to whoever had it when the account was deleted.
//	device_tokens  paired phones. Pairing again is one QR scan; silently
//	               re-arming a bearer token is not a decision to make for
//	               somebody.
//	quiz_sessions  today's quiz, which is a day's scratch state and not data.
var accountSkipTables = map[string]bool{
	"sessions": true, "device_tokens": true, "quiz_sessions": true,
}

// binAccount snapshots an entire account and its library into ONE bin entry,
// owned by the admin doing the deleting.
//
// The owner matters: `trash.user_id` is whose bin the row sits in, and putting an
// account entry in the deleted user's own bin would have it cascade away in the
// same statement that made it necessary. It is also who may put it back.
func (s *Server) binAccount(tx *sql.Tx, adminID, targetID int64, username string, files []string) (int64, error) {
	snap := snapshot{}
	children := 0
	for _, table := range accountTables {
		var rows []map[string]any
		var err error
		switch table {
		case "users":
			rows, err = queryMaps(tx, `SELECT * FROM users WHERE id = ?`, targetID)
		case "person_kinds":
			rows, err = queryMaps(tx,
				`SELECT * FROM person_kinds WHERE person_id IN (SELECT id FROM people WHERE user_id = ?)`, targetID)
		case "annotations":
			rows, err = queryMaps(tx,
				`SELECT * FROM annotations WHERE book_id IN (SELECT id FROM books WHERE user_id = ?)`, targetID)
		case "dialogues":
			rows, err = queryMaps(tx,
				`SELECT * FROM dialogues WHERE movie_id IN (SELECT id FROM movies WHERE user_id = ?)`, targetID)
		case "book_genres":
			rows, err = queryMaps(tx,
				`SELECT * FROM book_genres WHERE book_id IN (SELECT id FROM books WHERE user_id = ?)`, targetID)
		case "movie_genres":
			rows, err = queryMaps(tx,
				`SELECT * FROM movie_genres WHERE movie_id IN (SELECT id FROM movies WHERE user_id = ?)`, targetID)
		case "annotation_tags":
			rows, err = queryMaps(tx,
				`SELECT * FROM annotation_tags WHERE annotation_id IN
				   (SELECT a.id FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?)`, targetID)
		case "dialogue_tags":
			rows, err = queryMaps(tx,
				`SELECT * FROM dialogue_tags WHERE dialogue_id IN
				   (SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)`, targetID)
		case "anthology_entries":
			// Polymorphic on one side and a real foreign key on the other, so it is
			// reached through the ANTHOLOGY rather than through the three parents: an
			// entry belongs to the account that owns its anthology, and the quote it
			// points at is that account's by construction (an entry cannot be created
			// against a quote the caller does not own — see quoteOwned).
			rows, err = queryMaps(tx,
				`SELECT * FROM anthology_entries WHERE anthology_id IN (SELECT id FROM anthologies WHERE user_id = ?)`,
				targetID)
		case "utterance_tags":
			rows, err = queryMaps(tx,
				`SELECT * FROM utterance_tags WHERE utterance_id IN (SELECT id FROM utterances WHERE user_id = ?)`, targetID)
		case "item_reviews":
			// Polymorphic and user-blind, so it is reached through each parent kind
			// in turn — the same three-way join the stats page has to make.
			rows, err = queryMaps(tx, `
				SELECT * FROM item_reviews WHERE
				  (kind = 'book'      AND item_id IN (SELECT a.id FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?))
				  OR (kind = 'screen' AND item_id IN (SELECT d.id FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?))
				  OR (kind = 'utterance' AND item_id IN (SELECT id FROM utterances WHERE user_id = ?))`,
				targetID, targetID, targetID)
		case "staged_works":
			rows, err = queryMaps(tx,
				`SELECT * FROM staged_works WHERE batch_id IN (SELECT id FROM import_batches WHERE user_id = ?)`, targetID)
		case "staged_quotes":
			rows, err = queryMaps(tx,
				`SELECT * FROM staged_quotes WHERE staged_work_id IN
				   (SELECT w.id FROM staged_works w JOIN import_batches i ON i.id = w.batch_id WHERE i.user_id = ?)`, targetID)
		default:
			rows, err = queryMaps(tx, `SELECT * FROM `+table+` WHERE user_id = ?`, targetID)
		}
		if err != nil {
			return 0, fmt.Errorf("%s: %w", table, err)
		}
		if len(rows) > 0 {
			snap[table] = rows
		}
		switch table {
		case "annotations", "dialogues", "utterances":
			children += len(rows)
		}
	}
	payload, err := json.Marshal(snap)
	if err != nil {
		return 0, err
	}
	fileJSON, err := json.Marshal(files)
	if err != nil {
		return 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, 'account', ?, ?, ?, ?)`,
		adminID, username, children, string(payload), string(fileJSON))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// ---------------------------------------------------------------------------
// a selection
// ---------------------------------------------------------------------------

// binSelection deletes many quotes of one kind as ONE bin entry.
//
// Every item's subtree is collected exactly as a single delete collects it, and the
// payloads are merged into one snapshot. That is what makes the restore free: it
// walks the payload's tables in foreign-key order, and a payload holding forty
// annotations is the same shape as one holding a single annotation.
//
// One entry rather than forty is the decision (see migration 0032). Forty entries
// would be a wall of rows for a single act, and undoing that act would mean forty
// restores that can each half-fail.
func (s *Server) binSelection(tx *sql.Tx, uid int64, kind string, ids []int64) (int64, int, error) {
	if !trashKinds[kind] {
		return 0, 0, fmt.Errorf("trash: %q is not a binnable kind", kind)
	}
	merged := snapshot{}
	var files []string
	done := 0
	for _, id := range ids {
		got, err := collect(tx, uid, kind, id)
		if errors.Is(err, sql.ErrNoRows) {
			// Not this user's, or gone between the ownership filter and here. Skipped
			// rather than failing the batch: the filter already refused the ids that
			// were never theirs, so this is a race, and a race should not cost
			// somebody the other forty deletions they asked for.
			continue
		}
		if err != nil {
			return 0, 0, err
		}
		for table, rows := range got.Payload {
			merged[table] = append(merged[table], rows...)
		}
		files = append(files, got.Files...)
		if _, err := tx.Exec(`DELETE FROM `+trashTable[kind]+` WHERE id = ?`, id); err != nil {
			return 0, 0, err
		}
		done++
	}
	if done == 0 {
		return 0, 0, sql.ErrNoRows
	}
	payload, err := json.Marshal(merged)
	if err != nil {
		return 0, 0, err
	}
	fileJSON, err := json.Marshal(files)
	if err != nil {
		return 0, 0, err
	}
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, 'selection', ?, ?, ?, ?)`,
		uid, selectionLabel(kind, done), done, string(payload), string(fileJSON))
	if err != nil {
		return 0, 0, err
	}
	id, err := res.LastInsertId()
	return id, done, err
}

// kindNoun is what a kind is called in a sentence a reader types or reads. The
// server owns these words because the typed confirmation is checked here: a client
// that phrased it differently would be unable to confirm anything.
var kindNoun = map[string][2]string{
	"annotation": {"highlight", "highlights"},
	"dialogue":   {"film line", "film lines"},
	"quote":      {"quote", "quotes"},
	"book":       {"book", "books"},
	"movie":      {"title", "titles"},
}

func nounFor(kind string, n int) string {
	pair, ok := kindNoun[kind]
	if !ok {
		return "items"
	}
	if n == 1 {
		return pair[0]
	}
	return pair[1]
}

// selectionLabel is what the bin row says: "41 quotes".
func selectionLabel(kind string, n int) string {
	return fmt.Sprintf("%d %s", n, nounFor(kind, n))
}

// bulkDeletePhrase is what somebody has to type to delete a selection, and the
// server is where it is checked.
//
// A typed confirmation for something the bin makes recoverable looks like belt and
// braces, and it is not: this is the one action in the app that removes many things
// at once, and the friction is the point. It also cannot be reached by a gesture —
// only by selecting, then pressing Delete in the bar.
func bulkDeletePhrase(kind string, n int) string {
	return fmt.Sprintf("delete %d %s", n, nounFor(kind, n))
}
