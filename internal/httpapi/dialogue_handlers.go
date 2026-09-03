package httpapi

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// episodeRef is the show half of a dialogue's locator: which episode the line is
// from. A film is one runtime, so its timestamp locates a line completely; a
// series with sixty episodes needs to say which of them "01:12:40" belongs to.
//
// Both are POINTERS because null — not 0 — is what "unset" means here: season 0
// is a real season, the one specials and pilots live in, so 0 and "not recorded"
// cannot share a value. Films leave both null; the rule lives in normalize rather
// than in a CHECK because SQLite cannot reach across to movies.media_type (0025).
type episodeRef struct {
	Season  *int `json:"season"`
	Episode *int `json:"episode"`
}

// Sanity ceilings, not domain truths: they exist so a client that sends a
// timestamp or a year where a season belongs is told so, rather than storing it.
const (
	maxSeason  = 999
	maxEpisode = 9999
)

// normalize applies the shows-only rule and checks the rest, returning a
// client-facing message or "" (the house shape — cf. normalizeStatus,
// normalizeMediaType). It needs the parent's media_type, so it is called after the
// movie is loaded rather than from dialogueReq.validate — which keeps a malformed
// line answering 400 and a missing movie answering 404, in that order.
//
// A film's lines are CLEARED rather than refused. Flipping a show to a film in the
// Edit form leaves its dialogues holding episode numbers that no longer mean
// anything; refusing them would make every later edit of those lines fail, with no
// way to fix it from a form that (correctly) does not offer the fields. Clearing
// heals the line on its next save, and matches the importer's forgiveness for the
// same case (writeMovieDialogues).
func (e *episodeRef) normalize(mediaType string) string {
	if mediaType != "show" {
		*e = episodeRef{}
		return ""
	}
	if (e.Season != nil && *e.Season < 0) || (e.Episode != nil && *e.Episode < 0) {
		return "season and episode cannot be negative"
	}
	if (e.Season != nil && *e.Season > maxSeason) || (e.Episode != nil && *e.Episode > maxEpisode) {
		return fmt.Sprintf("season must be at most %d and episode at most %d", maxSeason, maxEpisode)
	}
	// A season with no episode is fine — sometimes all anyone remembers is the
	// season a line was in. The reverse is not: an episode number means nothing
	// without its season, and would sort ahead of every numbered season.
	if e.Episode != nil && e.Season == nil {
		return "an episode needs the season it is in"
	}
	return ""
}

// gameRef is the game half of a dialogue's locator, and it is the same shape as
// episodeRef for the same reason: a game is a movies row (0040), so the rule that
// a game's lines are placed by ACT and QUEST while a film's are not cannot live in
// a CHECK either — SQLite cannot reach across to movies.media_type from here.
//
// Free text rather than numbers, unlike season and episode. "Act II" and
// "Prologue" are both real answers, a quest has a name and not an index, and half
// the games worth quoting number neither. So there is no zero-means-unset problem
// to solve and no pointer to carry: empty IS unset, which is also the column
// default (0047).
//
// BOTH ARE IDENTITY, not decoration — 0047 folds them into the dedupe hash the
// way 0025 folded in season and episode. A bark reused in two quests is two
// quotes, which is the TV catchphrase argument one medium over.
type gameRef struct {
	Act   string `json:"act"`
	Quest string `json:"quest"`
}

// normalize applies the games-only rule, in the shape episodeRef.normalize uses
// and for the reason written there: a line whose work was retargeted from a game
// to a film is CLEARED rather than refused, because refusing it would make every
// later edit of that line fail from a form that (correctly) no longer offers the
// field. There is nothing else to check — the caps are applied in validate,
// beside timestamp's, because a cap does not depend on the medium.
func (g *gameRef) normalize(mediaType string) string {
	if mediaType != "game" {
		*g = gameRef{}
	}
	return ""
}

// dialogueReq is quoteReq plus the screen locator: who says the line, when in the
// runtime, and — for a show — which episode. See quote.go for the shared half.
type dialogueReq struct {
	quoteReq
	MovieID   int64  `json:"movie_id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	episodeRef
	gameRef
	// The episode's NAME, beside its number (0047). NOT inside episodeRef, though
	// it belongs to the same locator, because episodeRef is embedded in the review
	// card and in the search hit as well — and neither of those selects this
	// column, so putting it there would put an `episode_name` on two more wires
	// that is permanently empty. Cleared for anything but a show, in
	// normalizeLocator.
	EpisodeName string `json:"episode_name"`
}

// normalizeLocator applies EVERY per-medium locator rule in one call, so that
// "which locator fields does this medium have" has one answer rather than three
// scattered ones. Called where episodeRef.normalize used to be called, with the
// same contract: after the movie is loaded, before hash().
//
// EACH RULE CLEARS RATHER THAN REFUSES, which is episodeRef.normalize's decision
// and its stated reason (read it). It matters more here than it did there:
// nothing in the shipped capture forms gates the timestamp box by media type, so
// every game line taken through the app today arrives carrying one. A 400 would
// refuse all of them, and the forms are not being changed in this pass.
//
// Both embedded structs have a method called `normalize`, so neither is promoted
// and the selector has to be qualified. That is a feature: an unqualified
// d.normalize() does not compile, which is a better failure than one of the two
// rules silently not running.
func (d *dialogueReq) normalizeLocator(mediaType string) string {
	if msg := d.episodeRef.normalize(mediaType); msg != "" {
		return msg
	}
	if msg := d.gameRef.normalize(mediaType); msg != "" {
		return msg
	}
	// A GAME HAS NO TIMESTAMP. It is placed by its act and its quest, which is what
	// 0047 put in the hash — and a timestamp left beside them would be a second
	// locator saying what the first already said, in a unit the medium does not
	// have.
	if mediaType == "game" {
		d.Timestamp = ""
	}
	// An episode name with no episode is a name for nothing.
	if mediaType != "show" {
		d.EpisodeName = ""
	}
	return ""
}

// hash shadows quoteReq.hash to qualify a show's line by its episode and a game's
// by its act and quest — see store.DialogueDedupeHash for why those four
// discriminate and a book's chapter does not. A film, and any line with no
// locator at all, hashes exactly as quoteReq would, byte for byte, so this
// changes nothing for them.
//
// MUST BE CALLED AFTER normalizeLocator. A film still carrying stale episode
// numbers would hash as though it were a show, and one still carrying a stale
// quest would hash as though it were a game — either way forking a duplicate of
// a line that is already on the record.
func (d *dialogueReq) hash() string {
	return store.DialogueDedupeHash(d.Quote, d.Season, d.Episode, d.Act, d.Quest)
}

func (d *dialogueReq) validate() string {
	if msg := d.quoteReq.validate(); msg != "" {
		return msg
	}
	// Unlike an annotation, a dialogue is always a spoken line — there is no
	// note-only form, because a thought about a film belongs on the film.
	if d.Quote == "" {
		return "quote is required"
	}
	var ok bool
	if d.Character, ok = trimCap(d.Character, 128); !ok {
		return "character too long (max 128 characters)"
	}
	if d.Actor, ok = trimCap(d.Actor, 128); !ok {
		return "actor too long (max 128 characters)"
	}
	if d.Timestamp, ok = trimCap(d.Timestamp, 128); !ok {
		return "timestamp too long (max 128 characters)"
	}
	// The game's locator and the show's episode name (0047). Capped HERE rather
	// than in normalizeLocator, beside timestamp and for the same reason: a cap is
	// a property of the column and not of the medium, so a value too long to store
	// is refused whether or not this medium is the one that keeps it.
	if d.Act, ok = trimCap(d.Act, 128); !ok {
		return "act too long (max 128 characters)"
	}
	if d.Quest, ok = trimCap(d.Quest, 128); !ok {
		return "quest too long (max 128 characters)"
	}
	// 200, an episode TITLE rather than a locator: episode names are sentences
	// ("The One Where Everybody Finds Out"), which is the shape of an occasion and
	// twice the length of a character's name.
	if d.EpisodeName, ok = trimCap(d.EpisodeName, 200); !ok {
		return "episode name too long (max 200 characters)"
	}
	return ""
}

// autofillActor implements the PLAN §3b rule: when actor is empty, map each
// character named on the line to who plays them in the work's CAST MAPPING
// (work_cast, 0048) — folded and trimmed. A line can credit several characters
// (the client picks them as comma-joined tokens), so we split on commas, resolve
// each against the mapping, and join the unique actors in order. Characters with
// no match contribute nothing; a fully unmatched line yields "".
//
// THE SOURCE CHANGED AND THE RULE DID NOT. Until 0048 this read `movies.cast_json`,
// a blob only a metadata fetch could write — which is why it produced NOTHING for
// a game, every time, for every game whose Wikidata voice lookup came back empty,
// and why a wrongly-billed minor role could never be corrected into it. Now the
// same rule reads a table the reader can edit, so naming the voice actor once
// fills every line that character speaks.
//
// A READER-TYPED ACTOR STILL WINS, unchanged and first: this fills a gap, it never
// overwrites an answer. `dialogues.actor` is not going anywhere either — it stays
// stored, FTS-indexed, faceted, exported and imported, and the mapping is the
// SOURCE that fills it rather than a replacement for it.
//
// The querier is an interface because two of the four callers hold *sql.DB and two
// hold the *sql.Tx they are writing in, and the read is identical either way.
func autofillActor(q castQuerier, kind string, workID int64, character, actor string) string {
	if actor != "" || strings.TrimSpace(character) == "" {
		return actor
	}
	var actors []string
	seen := map[string]bool{}
	for _, ch := range strings.Split(character, ",") {
		ch = strings.TrimSpace(ch)
		if ch == "" {
			continue
		}
		a := castActorFor(q, kind, workID, ch)
		if a == "" {
			continue
		}
		// Folded rather than lowercased, so one actor spelt two ways across two
		// cast rows is still named once. store.CastKey is the same fold the rows
		// are keyed by, which is what makes that true.
		k := store.CastKey(a)
		if seen[k] {
			continue
		}
		seen[k] = true
		actors = append(actors, a)
	}
	return strings.Join(actors, ", ")
}

// refillMovieActors applies the auto-fill rule retroactively: for the movie's
// dialogues whose actor is still empty, fill it from the (freshly merged) cast
// mapping by matching character. This is what lets correcting a movie's metadata
// flow through to dialogues imported before the cast existed. Runs in the
// caller's tx; returns how many rows were filled.
//
// IT ONLY EVER FILLS AN EMPTY ACTOR, and that is deliberate rather than an
// oversight: correcting a cast row does NOT rewrite the lines that already carry
// the old name, because an actor the reader typed must not be silently rewritten
// by a metadata edit. The deliberate remedy for that already exists and is
// asked for explicitly — POST /movies/{id}/remap-speakers.
//
// The candidate lines are collected BEFORE anything is resolved or written. The
// resolve is now a query of its own against work_cast rather than a walk over an
// unmarshalled blob, so the loop would otherwise be reading and writing on the
// same connection while its own Rows is still open.
//
// IT LINKS WHAT IT FILLS, and only what it fills. 0059 gave the actor column a
// record to point at, and a name written here is a name like any other — a line
// the cast filled in must reach the performer's panel exactly as a typed one
// does. Syncing just the rows it wrote rather than the whole film keeps the cost
// proportional to the fill: a resync that changes nothing writes nothing.
func refillMovieActors(tx *sql.Tx, uid, movieID int64, seps metadata.CreditSeps) (int, error) {
	rows, err := tx.Query(
		`SELECT id, COALESCE(character, '') FROM dialogues WHERE movie_id = ? AND (actor IS NULL OR actor = '')`,
		movieID)
	if err != nil {
		return 0, err
	}
	type candidate struct {
		id        int64
		character string
	}
	var todo []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.character); err != nil {
			rows.Close()
			return 0, err
		}
		todo = append(todo, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	type fill struct {
		id    int64
		actor string
	}
	var fills []fill
	for _, c := range todo {
		if a := autofillActor(tx, "movie", movieID, c.character, ""); a != "" {
			fills = append(fills, fill{c.id, a})
		}
	}
	for _, f := range fills {
		if _, err := tx.Exec(
			`UPDATE dialogues SET actor = ?, updated_at = datetime('now') WHERE id = ?`, f.actor, f.id); err != nil {
			return 0, err
		}
		if err := store.SyncQuotePerson(tx, uid, store.KindScreen, f.id, seps); err != nil {
			return 0, err
		}
		if err := store.SyncQuoteCast(tx, uid, "movie", f.id, seps); err != nil {
			return 0, err
		}
	}
	return len(fills), nil
}

// dialogueRow is quoteRow plus the screen locator. See quote.go for the shared
// half.
type dialogueRow struct {
	quoteRow
	MovieID   int64  `json:"movie_id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	episodeRef
	gameRef
	// See dialogueReq.EpisodeName for why this is not inside episodeRef.
	EpisodeName string `json:"episode_name"`
	// EVERY CHARACTER NAMED ON THIS LINE, in the order they are named, each with
	// the picture stored for them or an empty path when there is none (0050;
	// cast_images.go says why the server resolves this and not the client, and why
	// a pictureless character is listed rather than dropped). Omitted entirely
	// only when the line names nobody.
	CharacterImages []characterImage `json:"character_images,omitempty"`
	// WHO SAID IT, which is not the same question as who is NAMED above — see
	// quote_speaker.go. Beside Character for that field's own reason: an utterance
	// has no cast to point into, so this cannot be promoted to quoteRow.
	SpeakerCast *quoteSpeakerCast `json:"speaker_cast,omitempty"`
	// The film's exclusion is quoteRow.WorkReviewExcluded, shared with
	// annotations rather than spelled movie_review_excluded here.
}

// dialogueCols includes the LEFT-JOINed spaced-repetition state (see
// dialogueReviewJoin); every SELECT using it must add that join. It also reads
// `m.review_excluded`, so every SELECT using it must join `movies m` — both of
// them already did, because that join IS the ownership check.
//
// act, quest and episode_name (0047) carry NO COALESCE, unlike every nullable
// column beside them: they are NOT NULL with an empty-string default, so the empty
// string is what a row predating the columns actually holds and there is no NULL
// for a COALESCE to catch. Wrapping them anyway would read as though there were.
const dialogueCols = `d.id, d.movie_id, d.quote, COALESCE(d.note, ''), d.translation, d.color, COALESCE(d.character, ''),
	COALESCE(d.actor, ''), COALESCE(d.timestamp, ''), d.season, d.episode,
	d.act, d.quest, d.episode_name,
	d.favorite, d.sticker_id, d.sticker_x, d.sticker_y,
	COALESCE(d.noted_at, ''), d.created_at, d.updated_at,
	r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
	d.review_excluded, m.review_excluded,
	COALESCE(d.speaker_cast_id, 0)`

// dialogueOrder is the one true dialogue order, used by the list and the export
// so a file reads in the order the screen shows: through the run, then through
// each episode, then through the game's acts and quests, then down the runtime. A
// film's season/episode are always null, so this collapses to the timestamp order
// dialogues have always had; an un-episoded show line falls to the end of its
// group rather than the front (season 0 is a real season and sorts first, which is
// where specials belong).
//
// ACT AND QUEST ARE BYTE-NEUTRAL FOR EVERY ROW THAT IS NOT A GAME'S, which is why
// they can be slipped in without moving a single export golden: they are NOT NULL
// with an empty-string default (0047), so every film and show line compares equal
// on both and the tie is broken by the same timestamp and id as before. No
// `IS NULL` guard for the same reason — there is no NULL here to sort to one end.
//
// THE COST, stated rather than found later: this is a TEXT sort over free text, so
// act "10" comes before act "2". Padding it would be inventing a numbering the
// medium does not have (see gameRef), and the alternative — a natural sort in Go
// — cannot be expressed in the SQL the export shares with the list.
//
// `p` is the dialogues table's alias, or "" when the query has none.
func dialogueOrder(p string) string {
	if p != "" {
		p += "."
	}
	return ` ORDER BY (` + p + `season IS NULL), ` + p + `season, (` + p + `episode IS NULL), ` + p + `episode,
		` + p + `act, ` + p + `quest,
		(` + p + `timestamp IS NULL), ` + p + `timestamp, ` + p + `id`
}

// dialogueReviewJoin attaches the per-line review row (kind='screen') that
// dialogueCols reads. Kept as a fragment so the list and single-fetch queries
// share one definition.
const dialogueReviewJoin = ` LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id`

func (s *Server) fetchDialogue(uid, id int64) (*dialogueRow, error) {
	var d dialogueRow
	// A local, not a field: the column is the link and what ships is the resolved
	// chip. See the annotation side, which does the same.
	var castID int64
	err := s.Store.DB.QueryRow(`
		SELECT `+dialogueCols+`
		FROM dialogues d JOIN movies m ON m.id = d.movie_id`+dialogueReviewJoin+`
		WHERE d.id = ? AND m.user_id = ?`, id, uid).
		Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Translation, &d.Color, &d.Character,
			&d.Actor, &d.Timestamp, &d.Season, &d.Episode,
			&d.Act, &d.Quest, &d.EpisodeName,
			&d.Favorite, &d.StickerID, &d.StickerX, &d.StickerY,
			&d.NotedAt, &d.CreatedAt, &d.UpdatedAt,
			&d.Reviewed, &d.Stability, &d.LastReviewedAt, &d.LastResult,
			&d.ReviewExcluded, &d.WorkReviewExcluded, &castID)
	if err != nil {
		return nil, err
	}
	d.SpeakerCast = speakerFor(s.loadQuoteSpeakers(uid, []int64{castID}), castID)
	d.Tags = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM dialogue_tags dt JOIN tags t ON t.id = dt.tag_id
		WHERE dt.dialogue_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeDlgRowScan, "[dlg] fetchDialogue tag row scan failed: %v", err)
			continue
		}
		d.Tags = append(d.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dlg] fetchDialogue tag row iteration failed: %v", err)
	}
	return &d, nil
}

func (s *Server) handleCreateDialogue(w http.ResponseWriter, r *http.Request) {
	var req dialogueReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[dlg] handleCreateDialogue uid=%d movie=%d", uid, req.MovieID)
	// The cast no longer travels with this row: it is a table of its own now, and
	// the media type is all this read still needs — only a show's lines may carry
	// an episode. The ownership check is why the read stays.
	var mediaType string
	err := s.Store.DB.QueryRow(
		`SELECT COALESCE(media_type, 'movie') FROM movies WHERE id = ? AND user_id = ?`,
		req.MovieID, uid).Scan(&mediaType)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		internalError(w, r, "load movie", err)
		return
	}
	if msg := req.normalizeLocator(mediaType); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	req.Actor = autofillActor(s.Store.DB, "movie", req.MovieID, req.Character, req.Actor)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	id, err := nextID(tx, "dialogues")
	if err != nil {
		internalError(w, r, "reserve dialogue id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO dialogues (id, movie_id, quote, note, translation, color, character, actor, timestamp, season, episode,
		                       act, quest, episode_name,
		                       favorite, source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y,
		                       review_excluded)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?,
		        -- Inherited from the film, exactly as a highlight inherits from its
		        -- book. See the annotation create path.
		        (SELECT COALESCE(review_excluded, 0) FROM movies WHERE id = ?)) ON CONFLICT DO NOTHING`,
		// req.Translation is a plain string for the reason the three 0047 columns
		// below are: 0051's column is NOT NULL DEFAULT '' and nullable("") is nil.
		id, req.MovieID, req.Quote, nullable(req.Note), req.Translation, req.Color, nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Season, req.Episode,
		// PLAIN STRINGS, not nullable(): these three are NOT NULL DEFAULT '' (0047),
		// and nullable("") is nil, which is the constraint violation rather than the
		// empty value. Every new column in 0047 has this trap.
		req.Act, req.Quest, req.EpisodeName,
		req.Favorite, req.Source,
		req.hash(), nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY, req.MovieID)
	if err != nil {
		internalError(w, r, "insert dialogue", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this movie
		// Release the connection before the lookup — see the annotation create
		// path for why holding the tx across it self-deadlocks the 4-connection
		// pool. The INSERT matched nothing, so there is no work to commit.
		_ = tx.Rollback()

		// Same contract as the annotation create path: return the row that
		// already holds the slot so an outbox retry is idempotent.
		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM dialogues WHERE movie_id = ? AND dedupe_hash = ?`,
			req.MovieID, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusConflict, "duplicate dialogue") // concurrently deleted
			return
		case err != nil:
			internalError(w, r, "locate duplicate dialogue", err)
			return
		}
		existing, err := s.fetchDialogue(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate dialogue")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate dialogue", err)
			return
		}
		writeConflictExisting(w, "duplicate dialogue", existing)
		return
	}
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := store.SyncQuotePerson(tx, uid, store.KindScreen, id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link actor", err)
		return
	}
	// AND THE CAST ROW THE LINE NAMES, which is the other half of the same fact.
	// The link above says who the human is; this says which ROLE on this film —
	// which is what a picture, a character record and "everything this character
	// said" all hang off. See store/quote_cast.go.
	if err := store.SyncQuoteCast(tx, uid, "movie", id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link dialogue speaker", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		internalError(w, r, "fetch dialogue", err)
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) handleListDialogues(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[dlg] handleListDialogues uid=%d movie_id=%q tag=%q", uid, r.URL.Query().Get("movie_id"), r.URL.Query().Get("tag"))
	q := `
		SELECT ` + dialogueCols + `
		FROM dialogues d JOIN movies m ON m.id = d.movie_id` + dialogueReviewJoin + `
		WHERE m.user_id = ?`
	args := []any{uid}
	if v := r.URL.Query().Get("movie_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid movie_id")
			return
		}
		q += ` AND d.movie_id = ?`
		args = append(args, id)
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM dialogue_tags dt JOIN tags t ON t.id = dt.tag_id
		                   WHERE dt.dialogue_id = d.id AND t.name = ?)`
		args = append(args, v)
	}
	// One row, for the review card's in-card edit — see idFilter.
	if !idFilter(w, r, "d", &q, &args) {
		return
	}
	if !colorFilter(w, r, "d", &q, &args) {
		return
	}
	if !favoriteFilter(w, r, "d", &q, &args) {
		return
	}
	// Season, episode, then lexical timestamp order, untimed lines last
	// (PLAN §3b — deliberate KISS).
	q += dialogueOrder("d")
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list dialogues", err)
		return
	}
	defer rows.Close()
	items := []dialogueRow{}
	// Parallel to `items` — the link is a column, the chip is a join, and the join
	// is made once after the loop exactly as the character pictures below are.
	castIDs := []int64{}
	for rows.Next() {
		var d dialogueRow
		var castID int64
		d.Tags = []string{}
		if err := rows.Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Translation, &d.Color, &d.Character,
			&d.Actor, &d.Timestamp, &d.Season, &d.Episode,
			&d.Act, &d.Quest, &d.EpisodeName,
			&d.Favorite, &d.StickerID, &d.StickerX, &d.StickerY,
			&d.NotedAt, &d.CreatedAt, &d.UpdatedAt,
			&d.Reviewed, &d.Stability, &d.LastReviewedAt, &d.LastResult,
			&d.ReviewExcluded, &d.WorkReviewExcluded, &castID); err != nil {
			// See annotation_handlers: never silently drop a row — a scan error is a
			// SELECT/struct drift and would present as an unexplained empty list.
			olog.Warnf(olog.CodeDlgRowScan, "[dialogues] list row scan failed (schema/query drift?): %v", err)
			continue
		}
		items = append(items, d)
		castIDs = append(castIDs, castID)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dialogues] list row iteration failed: %v", err)
	}
	if found := s.loadQuoteSpeakers(uid, castIDs); len(found) > 0 {
		for i := range items {
			items[i].SpeakerCast = speakerFor(found, castIDs[i])
		}
	}
	// One query fills every row's character pictures, in the shape the tag lists
	// below use. Best-effort: a page with no character art renders exactly as it
	// did before.
	refs := make([]characterImageRef, 0, len(items))
	for _, d := range items {
		if d.Character != "" {
			refs = append(refs, characterImageRef{WorkID: d.MovieID, Character: d.Character})
		}
	}
	// Unconditional, for the reason annotation_handlers.go gives at the same
	// place: the list is who the line NAMES, and a library with no art still has
	// names on its lines.
	found := s.loadCharacterImages(uid, "movie", refs)
	seps := s.creditSeps(uid)
	for i := range items {
		items[i].CharacterImages = characterImagesFor(found, seps, items[i].MovieID, items[i].Character)
	}

	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT dt.dialogue_id, t.name FROM dialogue_tags dt
		JOIN tags t ON t.id = dt.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		internalError(w, r, "load dialogue tags", err)
		return
	}
	defer tagRows.Close()
	byDlg := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeDlgRowScan, "[dlg] list tag row scan failed: %v", err)
			continue
		}
		byDlg[id] = append(byDlg[id], n)
	}
	if err := tagRows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dlg] list tag row iteration failed: %v", err)
	}
	for i := range items {
		if ts := byDlg[items[i].ID]; ts != nil {
			items[i].Tags = ts
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"dialogues": items})
}

func (s *Server) handleUpdateDialogue(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid dialogue id")
		return
	}
	var req dialogueReq // full new state; movie_id in the body is ignored
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[dlg] handleUpdateDialogue uid=%d id=%d", uid, id)
	var movieID int64
	var mediaType string
	var wasFavorite bool
	err := s.Store.DB.QueryRow(`
		SELECT d.movie_id, COALESCE(m.media_type, 'movie'), d.favorite
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE d.id = ? AND m.user_id = ?`, id, uid).Scan(&movieID, &mediaType, &wasFavorite)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "dialogue not found")
		return
	case err != nil:
		internalError(w, r, "load dialogue", err)
		return
	}
	if msg := req.normalizeLocator(mediaType); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	req.Actor = autofillActor(s.Store.DB, "movie", movieID, req.Character, req.Actor)
	hash := req.hash()
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM dialogues WHERE movie_id = ? AND dedupe_hash = ? AND id <> ?)`,
		movieID, hash, id).Scan(&clash); err != nil {
		internalError(w, r, "check duplicate dialogue", err)
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "duplicate dialogue")
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE dialogues SET quote = ?, note = ?, translation = ?, color = ?, character = ?, actor = ?, timestamp = ?,
		       season = ?, episode = ?, act = ?, quest = ?, episode_name = ?,
		       favorite = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		req.Quote, nullable(req.Note), req.Translation, req.Color, nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Season, req.Episode,
		// Plain strings — NOT NULL DEFAULT '', see the create path.
		req.Act, req.Quest, req.EpisodeName,
		req.Favorite, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
		internalError(w, r, "update dialogue", err)
		return
	}
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := store.SyncQuotePerson(tx, uid, store.KindScreen, id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link actor", err)
		return
	}
	// AND THE CAST ROW THE LINE NAMES, which is the other half of the same fact.
	// The link above says who the human is; this says which ROLE on this film —
	// which is what a picture, a character record and "everything this character
	// said" all hang off. See store/quote_cast.go.
	if err := store.SyncQuoteCast(tx, uid, "movie", id, s.creditSeps(uid)); err != nil {
		internalError(w, r, "link dialogue speaker", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	s.gcOrphanPeople(uid, "actor") // a changed actor name can orphan the old one
	// Favouriting a dialogue counts as "seeing" it (marginal half-life bump);
	// only on the false→true transition.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindScreen, id)
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		internalError(w, r, "fetch dialogue", err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// handleDeleteDialogue bins the line, then deletes it (see trash.go).
func (s *Server) handleDeleteDialogue(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	s.binDelete(w, r, "dialogue", "dialogue not found", nil, func() {
		// The last line an actor was credited on can leave their metadata behind.
		// Deliberately NOT undone by a restore: a person row is a reference row
		// that re-fetches, not part of the quote.
		s.gcOrphanPeople(uid, "actor")
	})
}
