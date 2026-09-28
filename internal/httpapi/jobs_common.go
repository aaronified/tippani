package httpapi

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
)

// THE COMMON JOBS: GET /jobs/common, the rows of Settings › Jobs' Common jobs
// card. The owner's ask, 28 September: "add a list of common jobs, that can be
// restarted from there itself, and as such will have a persistent place"; and,
// asked which, "Back up now, Fetch covers and details, Fill gaps in every work,
// Fetch missing people".
//
// A ROW IS A KIND AND THE PARAMS ITS RUN SENDS, and nothing new runs behind it:
// Run is POST /jobs with them, queued, stopped and kept like every other job. Two
// of the four send params no other screen sends — a fill of {all: true} and a
// people fetch of {missing: true} — and those are resolved when the job runs
// (validateEvery says why). What this answers is the row's PLACE: the last time
// that job finished, however it ended, and the one running or waiting now, so the
// row can say how it went and offer Stop in place of Run.
//
// WHOSE JOBS A ROW SHOWS. The viewer's own, since a fill, a people fetch and a
// covers pass each walk the reader's own library and nobody else's (the covers
// pass's queries are scoped to the caller; coversRefetchChunk). The backup is the
// exception: the server keeps one archive, whichever admin sealed it, so an
// admin's backup row shows the last backup anybody made, and the one running.
//
// A READER GETS ONLY THE ROWS THEY MAY RUN: the covers pass and the backup are an
// admin's, as their routes always were, and a row that could only answer 403
// would be a press that does nothing (absent, not disabled).

// commonJob is one row of the card.
type commonJob struct {
	id     string // the row's own name: route-stable, the screen keys its words on it
	kind   string
	params map[string]any
	// serverWide rows show every account's jobs of their kind (only an admin
	// sees one); the others show the viewer's own.
	serverWide bool
	// match narrows the kind's jobs to the row's own, as SQL over params: a fill
	// of a selection is not "Fill gaps in every work". "" is every job of the kind.
	match string
}

// commonJobs is the card's rows, in the order it lists them: what a reader runs
// most first.
//
// THE COVERS ROW IS EVERY COVERS PASS, whichever way it was run: the row offers
// both (Run, and Missing only), and so does the Metadata screen's own Fetch, so a
// pass started there is this row's last run too. Its params are the full pass's.
var commonJobs = []commonJob{
	{id: "fill-all", kind: "fill", params: map[string]any{"all": true}, match: paramIsTrue("all")},
	{id: "people-missing", kind: "people", params: map[string]any{"missing": true}, match: paramIsTrue("missing")},
	{id: "covers", kind: "covers", params: map[string]any{"missing_only": false}},
	{id: "backup", kind: "backup", params: map[string]any{}, serverWide: true},
}

// paramIsTrue is SQL that holds when a job's params say name: true. A row whose
// params are not JSON (a hand-made archive's) is no row's, rather than an error
// that takes the whole card with it.
func paramIsTrue(name string) string {
	return `CASE WHEN json_valid(params) THEN json_extract(params, '$.` + name + `') END = 1`
}

// commonJobView is a row as GET /jobs/common answers it.
type commonJobView struct {
	ID        string         `json:"id"`
	Kind      string         `json:"kind"`
	Params    map[string]any `json:"params"`
	AdminOnly bool           `json:"admin_only"`
	Last      *jobView       `json:"last"`
	Current   *jobView       `json:"current"`
}

// handleCommonJobs: GET /jobs/common → {jobs: [{id, kind, params, admin_only,
// last, current}]}, the rows this viewer may run, in commonJobs' order. last is the
// row's newest job that has ended within the thirty days Past jobs holds; current
// is its running one, else its first waiting. A server with no queue has no row
// anybody could run, and answers none.
func (s *Server) handleCommonJobs(w http.ResponseWriter, r *http.Request) {
	v := viewer(r)
	type found struct {
		row           commonJob
		admin         bool
		last, current *jobRow
	}
	var rows []found
	var read []jobRow
	for _, c := range commonJobs {
		k, ok := s.startableKind(c.kind)
		if !ok || (k.adminOnly && !v.IsAdmin) {
			continue
		}
		f := found{row: c, admin: k.adminOnly}
		var err error
		if f.last, err = s.commonJobRow(c, v, false); err == nil {
			f.current, err = s.commonJobRow(c, v, true)
		}
		if err != nil {
			codedError(w, r, olog.CodeJobRead, "read the common jobs", err)
			return
		}
		for _, j := range []*jobRow{f.last, f.current} {
			if j != nil {
				read = append(read, *j)
			}
		}
		rows = append(rows, f)
	}
	// Made into what the API answers all at once, so the queue's order (for
	// ahead) and the applied checks are read once for the card.
	views, err := s.jobViews(read, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the queue", err)
		return
	}
	byID := map[int64]*jobView{}
	for i := range views {
		byID[views[i].ID] = &views[i]
	}
	out := make([]commonJobView, 0, len(rows))
	for _, f := range rows {
		cv := commonJobView{ID: f.row.id, Kind: f.row.kind, Params: f.row.params, AdminOnly: f.admin}
		if f.last != nil {
			cv.Last = byID[f.last.id]
		}
		if f.current != nil {
			cv.Current = byID[f.current.id]
		}
		out = append(out, cv)
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": out})
}

// commonJobRow is a row's current job (live) or its last one, as v may see it;
// nil when it has none.
//
// THE LAST RUN IS ANY JOB OF THE ROW'S THAT ENDED, queued or in its request: the
// admin API's synchronous backup makes the same archive as the queued one, and
// the row is asking when the archive was last made. A current one is always
// queued (an in-request job's row is written when its request ends).
func (s *Server) commonJobRow(c commonJob, v jobs.Owner, live bool) (*jobRow, error) {
	held := s.heldStops()
	where, args := `kind = ?`, []any{jobs.HeldJSON(held), c.kind}
	if !c.serverWide {
		where += ` AND user_id = ?`
		args = append(args, v.UserID)
	}
	if c.match != "" {
		where += ` AND ` + c.match
	}
	order := `id DESC`
	if live {
		where += ` AND queued = 1 AND ` + shownState + ` IN ('queued', 'running')`
		order = `state = 'running' DESC, id`
	} else {
		where += ` AND ` + shownState + ` NOT IN ('queued', 'running') AND created_at >= ?`
		args = append(args, time.Now().Add(-jobsRetention).UnixMilli())
	}
	j, err := scanJob(s.Store.DB.QueryRow(heldCTE+`SELECT `+jobColumns+` FROM jobs WHERE `+where+` ORDER BY `+order+` LIMIT 1`, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	j.settle(held)
	return &j, nil
}

// ---- what the two library-wide variants walk ----------------------------------

// countWorks is how many works uid has: the total a "Fill gaps in every work"
// shows while it waits.
func (s *Server) countWorks(uid int64) (int, error) {
	var n int
	err := s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books WHERE user_id = ?) +
		(SELECT COUNT(*) FROM movies WHERE user_id = ?)`, uid, uid).Scan(&n)
	return n, err
}

// everyWork is what a fill of {all: true} walks, read as it starts: every book
// of uid's and then every film, show and game, each in id order, as a selection's
// fill walks them. It logs how many and says so on the job's row, so the job reads
// the number it will actually walk, not the one it was queued with.
//
// A READ AND NOTHING ELSE. It asks no supplier and writes nothing of the library,
// so a Stop that lands during it finds the fill's first check between items with
// nothing asked and nothing written; the runner's own progress write is the job's
// row, not the library.
func (s *Server) everyWork(j *jobs.Job, uid int64) (books, films []int64, err error) {
	if books, err = s.idsOf(`SELECT id FROM books WHERE user_id = ? ORDER BY id`, uid); err != nil {
		return nil, nil, fmt.Errorf("list the library's books: %w", err)
	}
	if films, err = s.idsOf(`SELECT id FROM movies WHERE user_id = ? ORDER BY id`, uid); err != nil {
		return nil, nil, fmt.Errorf("list the library's films: %w", err)
	}
	j.Log(jobs.LevelInfo, "every work in the library as the fill starts: %s and %s",
		countOf(len(books), "book", "books"), countOf(len(films), "film, show or game", "films, shows and games"))
	j.Progress(0, len(books)+len(films))
	return books, films, nil
}

// everyMissingPerson is what a people fetch of {missing: true} walks, read as it
// starts (peopleMissing), logged and put on the job's row as everyWork does, and a
// read and nothing else for the same reason.
func (s *Server) everyMissingPerson(j *jobs.Job) ([]int64, error) {
	ids, err := s.peopleMissing(j.Owner().UserID)
	if err != nil {
		return nil, fmt.Errorf("list the records missing links or a portrait: %w", err)
	}
	j.Log(jobs.LevelInfo, "records missing links or a portrait as the fetch starts: %d", len(ids))
	j.Progress(0, len(ids))
	return ids, nil
}

// idsOf is the ids q selects.
func (s *Server) idsOf(q string, args ...any) ([]int64, error) {
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// peopleMissing is every record of uid's that a fetch could complete, in id
// order: the ones personLacks says lack links or a portrait.
func (s *Server) peopleMissing(uid int64) ([]int64, error) {
	rows, err := s.Store.DB.Query(`SELECT id, links, image_path FROM people WHERE user_id = ? ORDER BY id`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []int64{}
	for rows.Next() {
		var id int64
		var links, image string
		if err := rows.Scan(&id, &links, &image); err != nil {
			return nil, err
		}
		if noLinks, noPhoto := personLacks(links, image); noLinks || noPhoto {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

// personLacks is what a person record is missing that a fetch can bring: a link
// to any provider's page (a link the reader typed to somewhere else does not
// count — a fetch cannot tell whether it is them), and a stored portrait.
//
// THE ONE STATEMENT OF THE RULE. The People console's no-links and no-photo pills,
// its Fetch missing (the records with either), the Metadata screen's count of
// people still missing something, and "Fetch missing people" all mean this, and
// the console reads it off GET /people/records (no_links, no_photo) rather than
// working it out again: a rule stated twice is two rules the day one of them
// changes, and the first sign would be a job that fetched a different set from
// the one the console said it would.
func personLacks(links, imagePath string) (noLinks, noPhoto bool) {
	return len(parseLinks(links).known) == 0, imagePath == ""
}
