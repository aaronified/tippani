package httpapi

// Shelf status + the read log (PLAN §3f). One work has one status and a history
// of reads; this file owns the vocabulary, the partial-date format, the legal
// transitions, and the bookkeeping that keeps the two consistent. Books and
// films share every rule here — only the word for "in progress" differs
// ('reading' vs 'watching'), so each caller passes its own kind.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"tippani/internal/importer"
	"tippani/internal/olog"
)

// Status values. The in-progress one is per-side so a file exports the word a
// human would write ("status: reading" / "status: watching"); the other three
// are shared, and "" is the ordinary un-tracked state.
const (
	StatusNone      = ""
	StatusReading   = "reading"  // books
	StatusWatching  = "watching" // films + shows
	StatusPlaying   = "playing"  // games
	StatusPaused    = "paused"
	StatusAbandoned = "abandoned"
	StatusCompleted = "completed"
)

// Read outcomes (work_reads.outcome).
const (
	ReadOpen      = "open"
	ReadFinished  = "finished"
	ReadAbandoned = "abandoned"
)

// activeStatus is the "in progress" word for a work: the only status that pins a
// work to the top of its board and the only one the shelf cap counts.
//
// It takes the media type as well as the kind because a game is PLAYED, not
// watched, and games share the movies table. Taking only the kind — as this did
// until 0040 — would have handed every game the word "watching" with nothing
// raised, which is the silent shape this repo keeps writing up.
func activeStatus(kind, mediaType string) string {
	switch {
	case kind == "book":
		return StatusReading
	case mediaType == "game":
		return StatusPlaying
	default:
		return StatusWatching
	}
}

// movieActiveWords is every in-progress word a row in the movies table may
// carry. Bulk actions need the SET rather than one value, because a selection
// can hold films and games together.
var movieActiveWords = []string{StatusWatching, StatusPlaying}

// shelfCap is how many works may be in progress at once before the client's cap
// dialog asks whether you really mean it. Films are capped hardest: people rarely
// watch two at a time, whereas five part-read books is an ordinary shelf.
//
// The cap is a client-side nudge, deliberately NOT enforced here — the user can
// always wave it through, and a second device must never be told "no".
//
// EVERY ARM IS NAMED AND THERE IS NO BARE DEFAULT. This function used to end in
// `default: return 2`, which meant a media type nobody had thought about
// inherited the film cap silently — a game would have been capped at two
// in-progress on the strength of a fallthrough rather than a decision. Three is
// the decision for games: more than a film, because a long game sits unfinished
// for months and two would nag constantly, but fewer than a book, because you
// cannot really be playing five at once.
func shelfCap(kind, mediaType string) int {
	switch {
	case kind == "book":
		return 5
	case mediaType == "show":
		return 5
	case mediaType == "game":
		return 3
	case mediaType == "movie", mediaType == "":
		return 2
	default:
		// An unrecognised media type is a bug upstream, not a shelf policy. Take
		// the tightest cap so the nudge appears early rather than never, and say
		// so in the log rather than deciding silently.
		olog.Warnf(olog.CodeShelfMediaType, "[shelf] unknown media_type %q for kind %q; using the film cap", mediaType, kind)
		return 2
	}
}

// normalizeStatus validates a status against the vocabulary for one work,
// defaulting "" through unchanged. Returns an error message, "" if ok.
func normalizeStatus(kind, mediaType string, status *string) string {
	*status = strings.ToLower(strings.TrimSpace(*status))
	switch *status {
	case StatusNone, StatusPaused, StatusAbandoned, StatusCompleted:
		return ""
	case activeStatus(kind, mediaType):
		return ""
	}
	return fmt.Sprintf("status must be one of '', %q, 'paused', 'abandoned' or 'completed'", activeStatus(kind, mediaType))
}

// normalizeBulkStatus validates the ONE status word a bulk action carries for a
// selection that may hold more than one media type.
//
// A selection of films and games has no single in-progress word, and the two
// alternatives are both worse than accepting either. Refusing mixed selections
// makes a bulk action fail on a property of its least convenient member, which
// this file's own comment already rejects for the completed-work case. Sending
// the literal word through would write "watching" onto a game. So either active
// word is accepted here and translated PER ROW in the loop, against that row's
// own media type.
func normalizeBulkStatus(kind string, status *string) string {
	*status = strings.ToLower(strings.TrimSpace(*status))
	switch *status {
	case StatusNone, StatusPaused, StatusAbandoned, StatusCompleted:
		return ""
	}
	if kind == "book" {
		if *status == StatusReading {
			return ""
		}
		return fmt.Sprintf("status must be one of '', %q, 'paused', 'abandoned' or 'completed'", StatusReading)
	}
	for _, w := range movieActiveWords {
		if *status == w {
			return ""
		}
	}
	return fmt.Sprintf("status must be one of '', %q, %q, 'paused', 'abandoned' or 'completed'",
		StatusWatching, StatusPlaying)
}

// resolveActiveStatus maps a bulk request's in-progress word onto the word this
// particular row should carry. Non-active statuses pass through unchanged.
func resolveActiveStatus(kind, mediaType, requested string) string {
	if requested == StatusNone || requested == StatusPaused ||
		requested == StatusAbandoned || requested == StatusCompleted {
		return requested
	}
	return activeStatus(kind, mediaType)
}

// partialDate matches the three shapes a read date may take: a bare year, a
// year-month, or a full date. Anything a user knows and nothing they don't —
// "I read it in 2019" is a legitimate answer, and padding it to 2019-01-01 would
// invent a precision that was never there.
var partialDate = regexp.MustCompile(`^\d{4}(-\d{2}(-\d{2})?)?$`)

// normalizePartialDate trims and validates one date. "" (unknown) is legal.
func normalizePartialDate(field string, v *string) string {
	*v = strings.TrimSpace(*v)
	if *v == "" {
		return ""
	}
	if !partialDate.MatchString(*v) {
		return field + " must be YYYY, YYYY-MM or YYYY-MM-DD"
	}
	// Reject the shapes the regexp lets through but a calendar would not, so a
	// stored date is always a real one.
	parts := strings.Split(*v, "-")
	if y, _ := strconv.Atoi(parts[0]); y < 1000 || y > 3000 {
		return field + " year must be between 1000 and 3000"
	}
	if len(parts) > 1 {
		if m, _ := strconv.Atoi(parts[1]); m < 1 || m > 12 {
			return field + " month must be 01-12"
		}
	}
	if len(parts) > 2 {
		if d, _ := strconv.Atoi(parts[2]); d < 1 || d > 31 {
			return field + " day must be 01-31"
		}
		// A day between 1 and 31 is not the same as a day that exists: this
		// accepted 30 February, and 31 April, while the comment above promised
		// "a stored date is always a real one". time.Parse is the calendar —
		// it rejects an out-of-range day and knows which Februaries have 29.
		if _, err := time.Parse("2006-01-02", *v); err != nil {
			return field + " is not a real date"
		}
	}
	return ""
}

// clampProgress folds a percentage into 0-100. Progress only means anything
// while a work is in progress, so every other status stores the value its
// transition implies (see applyStatusChange) rather than whatever was sent.
func clampProgress(p int) int {
	switch {
	case p < 0:
		return 0
	case p > 100:
		return 100
	}
	return p
}

// Position units: how someone counts their way through a work. "" means they
// count in percent and the position columns stay empty.
const (
	PosPercent = ""
	PosPage    = "page"    // books — a physical book has pages, not a percentage
	PosEpisode = "episode" // shows — season + episode, the units a series is made of
)

// posUnitFor is the unit a side may count in: pages for a book, episodes for a
// show. A film has neither, so it tracks in percent only.
func posUnitFor(kind, mediaType string) string {
	if kind == "book" {
		return PosPage
	}
	if mediaType == "show" {
		return PosEpisode
	}
	return PosPercent
}

// position is where someone is in a work, in its own units.
type position struct {
	Unit        string `json:"pos_unit"` // "" | page | episode
	Pos         int    `json:"pos"`
	PosTotal    int    `json:"pos_total"`
	Season      int    `json:"season"`
	SeasonTotal int    `json:"season_total"`
}

// validate checks a position against the unit its side allows. A count needs
// something to count towards — that is the one rule worth enforcing, because a
// page number with no page total cannot become a percentage, and silently
// storing it would leave a bar that never moves.
func (p *position) validate(kind, mediaType string) string {
	allowed := posUnitFor(kind, mediaType)
	switch p.Unit {
	case PosPercent:
		// Tracking by percent: the counters are meaningless, so clear them rather
		// than keeping stale numbers a later unit switch would resurrect.
		*p = position{}
		return ""
	case allowed:
	default:
		if allowed == PosPercent {
			return "a film tracks progress as a percentage only"
		}
		return "pos_unit must be '' or " + strconv.Quote(allowed)
	}
	if p.Pos < 0 || p.PosTotal < 0 || p.Season < 0 || p.SeasonTotal < 0 {
		return "position numbers cannot be negative"
	}
	unitName := "page"
	if p.Unit == PosEpisode {
		unitName = "episode"
	}
	if p.Pos > 0 && p.PosTotal == 0 {
		return "a " + unitName + " number needs a total to count towards"
	}
	if p.PosTotal > 0 && p.Pos > p.PosTotal {
		return unitName + " cannot be past the total"
	}
	if p.Unit == PosEpisode {
		if p.Season > 0 && p.SeasonTotal == 0 {
			return "a season number needs a season total"
		}
		if p.SeasonTotal > 0 && p.Season > p.SeasonTotal {
			return "season cannot be past the total"
		}
	} else {
		p.Season, p.SeasonTotal = 0, 0 // books have no seasons
	}
	return ""
}

// percent turns a position into the canonical 0-100 progress, or -1 when there is
// nothing to derive (tracking by percent, or no total yet) and the client's own
// percentage should stand.
//
// A show spans two dimensions: finishing episode 4 of 10 in season 2 of 5 is
// (1 season done + 0.4 of this one) / 5 = 28%. Whole seasons before the current
// one count in full, which is the only reading that makes the bar move forward
// monotonically as you watch.
func (p position) percent() int {
	if p.Unit == PosPercent || p.PosTotal == 0 {
		return -1
	}
	within := float64(p.Pos) / float64(p.PosTotal)
	if p.Unit == PosEpisode && p.SeasonTotal > 0 && p.Season > 0 {
		within = (float64(p.Season-1) + within) / float64(p.SeasonTotal)
	}
	return clampProgress(int(within*100 + 0.5))
}

// readRow is one entry in a work's read log.
type readRow struct {
	ID         int64  `json:"id"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
	Outcome    string `json:"outcome"`
}

// statusChange is the client's requested transition (PUT /books|movies/:id/status).
// The dates are optional: the client sends today's date by default and whatever
// the user corrected it to otherwise.
type statusChange struct {
	Status     string `json:"status"`
	Progress   int    `json:"progress"`
	StartedAt  string `json:"started_at"`  // move INTO reading/watching: opens a read
	FinishedAt string `json:"finished_at"` // move INTO completed/abandoned: closes it
	position          // pos_unit / pos / pos_total / season / season_total
}

// validate normalizes the request for one side. `mediaType` is the film row's
// movie|show (ignored for books). Returns a message, "" if ok.
func (c *statusChange) validate(kind, mediaType string) string {
	if msg := normalizeStatus(kind, mediaType, &c.Status); msg != "" {
		return msg
	}
	if msg := normalizePartialDate("started_at", &c.StartedAt); msg != "" {
		return msg
	}
	if msg := normalizePartialDate("finished_at", &c.FinishedAt); msg != "" {
		return msg
	}
	if msg := c.position.validate(kind, mediaType); msg != "" {
		return msg
	}
	// A position in the work's own units IS the progress; the client's percentage
	// is only consulted when there is nothing to derive one from.
	if pct := c.position.percent(); pct >= 0 {
		c.Progress = pct
	} else {
		c.Progress = clampProgress(c.Progress)
	}
	return ""
}

// statusTransitionAllowed gates the one rule the lifecycle actually enforces:
// completed is a settled state, and the only way out of it is to start again.
// Pausing or abandoning something you already finished is not a thing that
// happens, so those moves are refused rather than quietly accepted.
//
// Clearing back to "" stays open from every status, completed included — it is
// the undo for a mis-tap, not a lifecycle move, and without it a wrong click
// would be permanent.
func statusTransitionAllowed(kind, mediaType, from, to string) bool {
	if from == to || to == StatusNone {
		return true
	}
	if from == StatusCompleted {
		return to == activeStatus(kind, mediaType)
	}
	return true
}

// applyStatusChange performs a transition inside an open tx: it writes the new
// status + progress and brings the read log along with it. The bookkeeping, in
// one place because status and log must never disagree:
//
//	→ reading/watching  opens a read (started_at), unless one is already open —
//	                    resuming a pause continues that read rather than
//	                    starting a second one. Progress carries over, EXCEPT
//	                    from completed, where a reread starts again at 0.
//	→ paused            leaves the open read open and freezes progress: coming
//	                    back picks up where you left off.
//	→ abandoned         closes the open read as abandoned (finished_at is the
//	                    stop date) and zeroes progress — the number no longer
//	                    stands for anything you want to see.
//	→ completed         closes the open read as finished and fills to 100. With
//	                    no read open (marking something you read years ago) it
//	                    writes a closed read so the count is still right.
//	→ "" (cleared)      drops an open read entirely — nothing was tracked, so
//	                    there is no history to keep — and leaves closed reads
//	                    alone, since those did happen.
//
// progressFor is applied to the work row; the caller has already validated.
func applyStatusChange(tx *sql.Tx, kind, mediaType string, uid, id int64, from string, c statusChange) error {
	active := activeStatus(kind, mediaType)

	// The open read, if any.
	var openID int64
	err := tx.QueryRow(
		`SELECT id FROM work_reads WHERE user_id = ? AND kind = ? AND work_id = ? AND outcome = ?
		 ORDER BY id DESC LIMIT 1`, uid, kind, id, ReadOpen).Scan(&openID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	progress, pos := c.Progress, c.position
	switch c.Status {
	case active:
		if from == StatusCompleted {
			// A reread starts over: back to the beginning, keeping the totals (the
			// book still has that many pages) and, for a show, season 1 of the run.
			progress, pos.Pos = 0, 0
			if pos.SeasonTotal > 0 {
				pos.Season = 1
			}
		}
		if openID == 0 {
			if _, err := tx.Exec(
				`INSERT INTO work_reads (user_id, kind, work_id, started_at, outcome)
				 VALUES (?, ?, ?, ?, ?)`, uid, kind, id, c.StartedAt, ReadOpen); err != nil {
				return err
			}
		} else if c.StartedAt != "" {
			// Resuming: only overwrite the start date if the client sent one.
			if _, err := tx.Exec(`UPDATE work_reads SET started_at = ? WHERE id = ?`, c.StartedAt, openID); err != nil {
				return err
			}
		}
	case StatusPaused:
		// Nothing to do to the log — the read stays open, progress stays put.
	case StatusAbandoned:
		// Progress and position both go to zero — the numbers no longer stand for
		// anything you want to see — but the totals stay, since the book still has
		// that many pages if you ever come back to it.
		progress, pos.Pos, pos.Season = 0, 0, 0
		if openID != 0 {
			if _, err := tx.Exec(`UPDATE work_reads SET finished_at = ?, outcome = ? WHERE id = ?`,
				c.FinishedAt, ReadAbandoned, openID); err != nil {
				return err
			}
		} else if _, err := tx.Exec(
			`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?)`, uid, kind, id, c.StartedAt, c.FinishedAt, ReadAbandoned); err != nil {
			return err
		}
	case StatusCompleted:
		// Finished means the last page of the last season, whatever the counters
		// last said — leaving them mid-book beside a full green bar would be the
		// one place status and position could visibly disagree.
		progress = 100
		pos.Pos, pos.Season = pos.PosTotal, pos.SeasonTotal
		if openID != 0 {
			if _, err := tx.Exec(`UPDATE work_reads SET finished_at = ?, outcome = ? WHERE id = ?`,
				c.FinishedAt, ReadFinished, openID); err != nil {
				return err
			}
		} else if _, err := tx.Exec(
			`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?)`, uid, kind, id, c.StartedAt, c.FinishedAt, ReadFinished); err != nil {
			return err
		}
	case StatusNone:
		// Untracked: zero the position but keep the unit and totals, so putting the
		// book back on the shelf remembers that you count it in pages.
		progress, pos.Pos, pos.Season = 0, 0, 0
		if openID != 0 {
			if _, err := tx.Exec(`DELETE FROM work_reads WHERE id = ?`, openID); err != nil {
				return err
			}
		}
	}

	if kind == "book" {
		_, err = tx.Exec(
			`UPDATE books SET status = ?, progress = ?, pos_unit = ?, pos = ?, pos_total = ?,
			                  updated_at = datetime('now')
			  WHERE id = ? AND user_id = ?`,
			c.Status, progress, pos.Unit, pos.Pos, pos.PosTotal, id, uid)
		return err
	}
	_, err = tx.Exec(
		`UPDATE movies SET status = ?, progress = ?, pos_unit = ?, pos = ?, pos_total = ?,
		                   season = ?, season_total = ?, updated_at = datetime('now')
		  WHERE id = ? AND user_id = ?`,
		c.Status, progress, pos.Unit, pos.Pos, pos.PosTotal, pos.Season, pos.SeasonTotal, id, uid)
	return err
}

// loadReads reads one work's log, oldest first — the order a history is read in.
func loadReads(db interface {
	Query(string, ...any) (*sql.Rows, error)
}, uid int64, kind string, id int64) ([]readRow, error) {
	rows, err := db.Query(
		`SELECT id, started_at, finished_at, outcome FROM work_reads
		  WHERE user_id = ? AND kind = ? AND work_id = ? ORDER BY id`, uid, kind, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []readRow{}
	for rows.Next() {
		var r readRow
		if err := rows.Scan(&r.ID, &r.StartedAt, &r.FinishedAt, &r.Outcome); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// encodeReads / decodeReads carry a parsed read log through staged_works as
// JSON, the same way cast_json and source_metadata carry structure through a
// TEXT column. A bad encode/decode degrades to "no history" rather than failing
// an import of somebody's highlights.
func encodeReads(reads []importer.Read) string {
	if len(reads) == 0 {
		return "[]"
	}
	b, err := json.Marshal(reads)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func decodeReads(s string) []importer.Read {
	var out []importer.Read
	if s == "" || s == "[]" {
		return nil
	}
	_ = json.Unmarshal([]byte(s), &out)
	return out
}

// encodePos / decodePos do the same for a page/season/episode position. "" means
// no position was parsed, which is the ordinary case.
func encodePos(p position) string {
	if p.Unit == PosPercent {
		return ""
	}
	b, err := json.Marshal(p)
	if err != nil {
		return ""
	}
	return string(b)
}

func decodePos(s string) position {
	var p position
	if s == "" {
		return p
	}
	_ = json.Unmarshal([]byte(s), &p)
	return p
}

// bookShelf / movieShelf read one parsed header's shelf fields into the shape the
// write path takes, so the two importer sides converge before they touch the DB.
func bookShelf(b importer.Book) importedShelf {
	in := importedShelf{Status: b.Status, Progress: b.Progress, Reads: b.Reads, Cast: b.Cast}
	if b.PosTotal > 0 {
		in.Pos = position{Unit: PosPage, Pos: b.Pos, PosTotal: b.PosTotal}
	}
	return in
}

func movieShelf(m importer.MovieHeader) importedShelf {
	in := importedShelf{Status: m.Status, Progress: m.Progress, Reads: m.Reads, Cast: m.Cast}
	if m.PosTotal > 0 {
		in.Pos = position{
			Unit: PosEpisode, Pos: m.Pos, PosTotal: m.PosTotal,
			Season: m.Season, SeasonTotal: m.SeasonTotal,
		}
	}
	return in
}

// importedShelf is what a parsed file says about a WORK rather than about any of
// its quotes, in the server's own terms. Built from either side's importer header.
//
// THE CAST RIDES HERE RATHER THAN IN A CALL OF ITS OWN (0048), and the name of
// this struct is the cost of it. Four places hand a parsed header to the write
// path — both branches of upsertImportBook, upsertImportMovie, and
// backfillImportMovie — and a second function beside each of them is precisely
// the shape of this repo's recurring defect: a rule added to three of the four
// sites that need it. Riding in the struct makes the sweep impossible to get
// wrong, because there is nothing to sweep.
//
// The gap it inherits is stated rather than widened: a book RETARGETED by hand in
// the queue never reaches this function at all (resolveApprovalTarget returns the
// pinned id before upsertImportBook runs), so it gets neither the read log nor
// the cast. That is work_reads' own behaviour since 0024 and fixing it is a
// separate piece of work on a separate path.
type importedShelf struct {
	Status   string
	Progress int
	Pos      position
	Reads    []importer.Read
	Cast     []importer.CastEntry
}

// applyImportedShelf writes an imported status/progress/position/read log — and
// the work's cast — onto a work at approval. Fill-empty-only, matching every
// other backfill on the import path (PLAN §5f): a status already set by hand
// always wins, and the read log is only adopted when the work has none —
// re-importing an old export must never duplicate a history that is already
// there, nor overwrite a newer one.
//
// Statuses and positions the server does not recognise are dropped rather than
// rejected: a hand-edited file should not fail an import over one bad word.
//
// The cast is applied by applyImportedCast under the same rule, and it is called
// from inside this function rather than beside its five callers — see
// importedShelf for why that is the sweep-proof arrangement rather than a
// misfiling.
func applyImportedShelf(tx *sql.Tx, kind, mediaType string, uid, workID int64, in importedShelf) error {
	table := "movies"
	if kind == "book" {
		table = "books"
	}
	status, progress, pos := in.Status, in.Progress, in.Pos
	if msg := normalizeStatus(kind, mediaType, &status); msg != "" {
		status, progress, pos = StatusNone, 0, position{}
	}
	if pos.validate(kind, mediaType) != "" {
		pos = position{}
	}
	// A position in the work's own units outranks the file's percentage, exactly as
	// it does on the live path.
	if pct := pos.percent(); pct >= 0 {
		progress = pct
	}
	if status != StatusNone {
		set := `status = CASE WHEN status = '' THEN ? ELSE status END,
		        progress = max(progress, ?), updated_at = datetime('now')`
		args := []any{status, clampProgress(progress)}
		if pos.Unit != PosPercent {
			set += `, pos_unit = CASE WHEN pos_unit = '' THEN ? ELSE pos_unit END,
			         pos = max(pos, ?), pos_total = max(pos_total, ?)`
			args = append(args, pos.Unit, pos.Pos, pos.PosTotal)
			if kind != "book" {
				set += `, season = max(season, ?), season_total = max(season_total, ?)`
				args = append(args, pos.Season, pos.SeasonTotal)
			}
		}
		args = append(args, workID, uid)
		if _, err := tx.Exec(`UPDATE `+table+` SET `+set+` WHERE id = ? AND user_id = ?`, args...); err != nil {
			return err
		}
	}
	// Before the read log's early return, so that a file carrying a cast and no
	// history is not silently a file carrying nothing.
	if err := applyImportedCast(tx, kind, mediaType, uid, workID, in.Cast); err != nil {
		return err
	}
	reads := in.Reads
	if len(reads) == 0 {
		return nil
	}
	var have bool
	if err := tx.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM work_reads WHERE user_id = ? AND kind = ? AND work_id = ?)`,
		uid, kind, workID).Scan(&have); err != nil {
		return err
	}
	if have {
		return nil
	}
	for _, rd := range reads {
		outcome := rd.Outcome
		switch outcome {
		case ReadOpen, ReadFinished, ReadAbandoned:
		default:
			outcome = ReadFinished
			if rd.FinishedAt == "" {
				outcome = ReadOpen
			}
		}
		started, finished := rd.StartedAt, rd.FinishedAt
		// A date the server would not accept is dropped, not fatal — the read
		// itself is still worth keeping.
		if normalizePartialDate("started_at", &started) != "" {
			started = ""
		}
		if normalizePartialDate("finished_at", &finished) != "" {
			finished = ""
		}
		if _, err := tx.Exec(
			`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?)`, uid, kind, workID, started, finished, outcome); err != nil {
			return err
		}
	}
	return nil
}

// handleSetBookStatus / handleSetMovieStatus — PUT /books|movies/:id/status.
// The only way a work's status, progress and read log change. Answers the full
// work detail so a client can re-render from one response.
func (s *Server) handleSetBookStatus(w http.ResponseWriter, r *http.Request) {
	s.setWorkStatus(w, r, "book")
}

func (s *Server) handleSetMovieStatus(w http.ResponseWriter, r *http.Request) {
	s.setWorkStatus(w, r, "movie")
}

func (s *Server) setWorkStatus(w http.ResponseWriter, r *http.Request, kind string) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid "+kind+" id")
		return
	}
	var req statusChange
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	olog.Tracef("[shelf] setWorkStatus kind=%s uid=%v id=%v status=%q", kind, uid, id, req.Status)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "set status: begin tx", err)
		return
	}
	defer tx.Rollback()

	// Load the current status and, for a film row, its media type: whether a
	// position may be counted in episodes depends on being a show, so validation
	// has to know before it can judge the request.
	var from, mediaType string
	var loadErr error
	if kind == "book" {
		loadErr = tx.QueryRow(`SELECT status FROM books WHERE id = ? AND user_id = ?`, id, uid).Scan(&from)
	} else {
		loadErr = tx.QueryRow(`SELECT status, media_type FROM movies WHERE id = ? AND user_id = ?`, id, uid).
			Scan(&from, &mediaType)
	}
	switch {
	case errors.Is(loadErr, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, kind+" not found")
		return
	case loadErr != nil:
		internalError(w, r, "set status: load", loadErr)
		return
	}
	if msg := req.validate(kind, mediaType); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	if !statusTransitionAllowed(kind, mediaType, from, req.Status) {
		writeErr(w, http.StatusConflict, fmt.Sprintf(
			"a completed %s can only be started again (%s) or cleared", kind, activeStatus(kind, mediaType)))
		return
	}
	if err := applyStatusChange(tx, kind, mediaType, uid, id, from, req); err != nil {
		internalError(w, r, "set status: apply", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "set status: commit", err)
		return
	}

	if kind == "book" {
		b, err := s.fetchBook(uid, id)
		if err != nil {
			internalError(w, r, "set status: fetch book", err)
			return
		}
		writeJSON(w, http.StatusOK, b)
		return
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		internalError(w, r, "set status: fetch movie", err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// readCounts maps work id -> finished-read count for one side in a single query,
// so a list endpoint can print "×2" without an N+1. Only 'finished' rows count:
// an abandoned attempt is history, not a read.
// lastReadAt is the most recent date each work was read or watched, for the
// list pages' "Last read" / "Last watched" sort. Works with no dated read at
// all are simply absent from the map.
//
// FINISHED IF THERE IS ONE, ELSE STARTED. A read you are still in the middle of
// has no finish date, and it is the one you touched most recently — sorting by
// finished_at alone would file the book currently open under "never".
//
// Every outcome counts, not just 'finished'. The question is "when did I last
// have this in my hands", and abandoning a book halfway through November is an
// answer to it. That is also why this cannot reuse readCounts, which asks a
// different question — how many times did I get to the end — and is right to
// filter on the outcome.
//
// Partial dates ('YYYY' | 'YYYY-MM' | 'YYYY-MM-DD') compare lexically, which is
// the same property noted_at has relied on since 0008, so MAX() over the mixed
// shapes is meaningful without parsing anything.
func (s *Server) lastReadAt(uid int64, kind string) (map[int64]string, error) {
	rows, err := s.Store.DB.Query(
		`SELECT work_id, MAX(CASE WHEN finished_at <> '' THEN finished_at ELSE started_at END)
		   FROM work_reads WHERE user_id = ? AND kind = ? GROUP BY work_id`,
		uid, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]string{}
	for rows.Next() {
		var id int64
		var at sql.NullString
		if err := rows.Scan(&id, &at); err != nil {
			return nil, err
		}
		// A work whose only reads carry no dates at all — undated is not a date,
		// and an empty string here would sort as one.
		if at.Valid && at.String != "" {
			out[id] = at.String
		}
	}
	return out, rows.Err()
}

func (s *Server) readCounts(uid int64, kind string) (map[int64]int, error) {
	rows, err := s.Store.DB.Query(
		`SELECT work_id, count(*) FROM work_reads
		  WHERE user_id = ? AND kind = ? AND outcome = ? GROUP BY work_id`,
		uid, kind, ReadFinished)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]int{}
	for rows.Next() {
		var id int64
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out[id] = n
	}
	return out, rows.Err()
}
