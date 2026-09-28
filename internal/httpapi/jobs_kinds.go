package httpapi

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"tippani/internal/jobs"
	"tippani/internal/store"
)

// THE KINDS OF JOB A PERSON CAN START, AND WHAT EACH MAY BE ASKED.
//
// POST /jobs takes {kind, params} from a browser, so the params are a stranger's
// JSON until the kind's validate says otherwise. validate turns them into what
// the job will read back — ids made positive, deduplicated and sorted, so the
// same selection pressed twice is stored as the same text and the runner's
// duplicate check sees one job — and says what the row carries beside them: the
// subject (data, not prose) and the item count the screen shows before the first
// item. A kind that needs a secret (the backup's password) gets it from validate
// too, and the runner keeps that in memory only; it is never in params.
//
// THE CAPS ARE HOW LONG ONE PRESS MAY HOLD THE QUEUE. The client loops these jobs
// replace sent fifteen items a call, because each call was a request with a
// deadline and a reader waiting on it. A job has no deadline and nobody waits on
// it, but it runs one at a time for the whole server, so its size is what every
// other reader's job queues behind: two thousand works for a fill or people, five
// hundred items for a re-verify and for its apply, whose items each go to the
// suppliers and come back with every field.
//
// A kind is registered on the queue only once it has a run (RegisterJobKinds).
// One listed here without one is refused by POST /jobs as a kind nobody knows,
// the same answer an old client gets for a kind a newer server dropped.
const (
	maxWorksPerJob    = 2000 // fill: book_ids and movie_ids together
	maxPeoplePerJob   = 2000 // people: person ids
	maxReverifyPerJob = 500  // reverify: books, films and people together; reverify-apply: items
	// maxJobBody is what POST /jobs reads. The largest honest body is a
	// re-verify's apply: five hundred items, each carrying the fields it sets and
	// the values the reader saw.
	maxJobBody = 4 << 20
)

// queuedKind is one kind a person can start through POST /jobs.
type queuedKind struct {
	name       string
	adminOnly  bool
	rerunnable bool
	// againAfterSuccess is whether a job of this kind that succeeded is offered
	// a rerun as well as one that failed, stopped or was interrupted. A fill run
	// again after keys were added finds more; an apply run again after it
	// succeeded would only find every field changed since the check.
	againAfterSuccess bool
	// validate reads what POST /jobs was sent, for viewer, into what to queue.
	// Its error is a *refusal (a 400, or the backup's 401) or, for a read that
	// failed, anything else (a 500).
	validate func(s *Server, params json.RawMessage, viewer jobs.Owner) (jobInput, error)
	// secret reads the credential a rerun has to be given again, from the
	// rerun's body, for a kind whose secret nothing kept. nil: none.
	secret func(s *Server, body json.RawMessage, viewer jobs.Owner) (any, error)
	// review is GET /jobs/{id}/result's answer for the job's owner, from the
	// result the job stored; nil hands the stored result back as it is. It is
	// where a re-verify's review re-reads each field's value NOW, so a diff whose
	// stored value changed since the check comes back marked changed and the
	// screen never pre-ticks it.
	review func(s *Server, uid int64, result json.RawMessage) (any, error)
	// counts is what the job JSON's counts say of a result the job stored
	// (jobs.Kind.Counts): the numbers the screens read — Past jobs' summary line,
	// the toast the starting screen shows — named as the wire contract names
	// them. nil: none, and counts is {}.
	counts func(result json.RawMessage) map[string]any
	// run is the job itself (jobs.Kind.Run, with the server).
	run func(s *Server, ctx context.Context, j *jobs.Job) error
	// runnableAgain, when set, is whether a finished job of this kind can be run
	// again at all, from its stored params, beyond the rules above: an import only
	// while the file it uploaded is still kept (importRunnableAgain). nil: the
	// rules above decide. Whatever a kind says, a job a restore carried over is
	// not run again (store.CarriedJob). A fill, a people fetch and a re-verify
	// name works and records by id, an apply the rows it writes, an approval
	// staged rows and a batch bound, all of them the replaced library's. A covers
	// pass, a backup, an import and the library-wide variants name none, and are
	// held to the same rule so that one rule answers for every kind, the next one
	// included.
	runnableAgain func(s *Server, params string) bool
}

// jobInput is what a validate hands the queue.
type jobInput struct {
	params  any    // what the job reads back with j.Params; never a secret
	subject string // what it is about, as data: a searched name, a file name
	total   int    // the item count, when it is known before the job runs
	secret  any    // for the job alone, in memory (j.Secret); nil for none
}

// refusal is an answer the screen shows as it is, with the status it goes with: a
// validate's to params it will not queue, and a lookup's to a question it could
// not answer (lookupLinks), which a handler and a job each pass on as they are.
type refusal struct {
	status int
	msg    string
}

func (e *refusal) Error() string { return e.msg }

func badParams(format string, args ...any) *refusal {
	return &refusal{http.StatusBadRequest, fmt.Sprintf(format, args...)}
}

// builtinJobKinds is every kind the server knows how to start. The screens build
// their params to these shapes (the SPA's startJob), so a field renamed here is a
// field renamed there.
var builtinJobKinds = []queuedKind{
	// {book_ids, movie_ids}: fill in what the selected works are missing; or
	// {all: true}, every work the reader has when it runs (validateEvery).
	// Result {fields, failed, unpinned}, and those are its counts.
	{name: "fill", rerunnable: true, againAfterSuccess: true, validate: validateFill,
		counts: countsNamed("fields", "failed", "unpinned"), run: runFill},
	// {missing_only}: fetch every cover and poster the reader's library lacks
	// (or, without missing_only, better ones). Admin, as the chunked route is.
	// Result {fetched, enriched, failed, skipped}, and those are its counts.
	{name: "covers", adminOnly: true, rerunnable: true, againAfterSuccess: true, validate: validateCovers,
		counts: countsNamed("fetched", "enriched", "failed", "skipped"), run: runCovers},
	// {ids}: a portrait and links for each person record; or {missing: true},
	// every record the reader has that lacks one or the other when it runs
	// (personLacks). Result {ok, failed, first_error}, and those are its counts,
	// the error's text included: the People screen's flash says why the first
	// one failed.
	{name: "people", rerunnable: true, againAfterSuccess: true, validate: validatePeople,
		counts: countsNamed("ok", "failed", "first_error"), run: runPeople},
	// {book_ids, movie_ids, people: [{kind, name}], fills_only}: ask the
	// suppliers again and keep what they say, for the reader to review. Result:
	// the preview's items; counts {items, changes}. Its review reads each field
	// again when the result is opened (reviewReverify).
	{name: "reverify", rerunnable: true, againAfterSuccess: true, validate: validateReverify,
		counts: countReverify, review: reviewReverify, run: runReverify},
	// {items, from_job}: write the fields the reader ticked in that review.
	// Result: one line per item; counts {applied, skipped, failed}.
	{name: "reverify-apply", rerunnable: true, validate: validateReverifyApply,
		counts: countReverifyApply, run: runReverifyApply},
	// {password | passphrase}: seal a backup with it. The password is checked
	// here, for an answer before anything queues, and again by the job. Result:
	// the archive, as GET /admin/backup describes it; nothing to count.
	{name: "backup", adminOnly: true, rerunnable: true, againAfterSuccess: true,
		validate: validateBackup, secret: backupSecret, run: runBackup},
	// THE THREE BELOW ARE QUEUED BY THEIR OWN ROUTES AND NEVER THROUGH POST /jobs,
	// which is what having no validate means (handleStartJob): the imports' params
	// name rows and files their route checked, and from a stranger they would name
	// somebody else's; the safety copy is a step of the restore and reset prompts,
	// whose route hands its copy over once (safety_copy.go).
	//
	// {} and the credential as its secret, as a backup's: seal a copy of the
	// server as it is, beside the backups and never among them, for one download.
	// Result {name, size, url, expires_at}; nothing to count. Not run again: a
	// copy is taken for the prompt that asked, and a stopped one is taken again
	// from there.
	{name: "backup.safety", adminOnly: true, run: runSafetyBackup},
	//
	// {source, as, filename, spool}: stage an upload, from the spool, as its route
	// used to (import_queue.go). Result {status, body}: what the route answered
	// before it queued; counts {staged}. Run again only while the upload is kept,
	// which is only after a Stop or an interruption landed before its staging
	// committed.
	{name: "import", rerunnable: true, counts: countImport, run: runImport, runnableAgain: importRunnableAgain},
	// {ids | work_ids | batch_id | all, through}: write staged quotes into the
	// library, a work at a time, each work one transaction (import_staging.go).
	// Result {status, body}, as an import's; counts {added, skipped}. Run again
	// when it did not finish: a rerun approves whatever of the selection is still
	// staged, and never a batch staged after its press (through).
	{name: "import.approve", rerunnable: true, counts: countApprove, run: runApproveStaged},
}

// countsNamed counts a result that is an object by keeping the members named,
// each a number or a string; anything else in it, and any member missing, is left
// out. The screens read an absent count as none.
func countsNamed(names ...string) func(json.RawMessage) map[string]any {
	return func(result json.RawMessage) map[string]any {
		var obj map[string]json.RawMessage
		if json.Unmarshal(result, &obj) != nil {
			return nil
		}
		out := map[string]any{}
		for _, name := range names {
			var v any
			if json.Unmarshal(obj[name], &v) != nil {
				continue
			}
			switch v.(type) {
			case float64, string:
				out[name] = v
			}
		}
		return out
	}
}

// countReverify counts a check's items and, of them, the ones with something to
// review: checked and differing, as POST /metadata/reverify counts changed. A
// check whose changes are 0 has nothing to review, and Past jobs offers no
// Review for it.
func countReverify(result json.RawMessage) map[string]any {
	var items []struct {
		Status string            `json:"status"`
		Diffs  []json.RawMessage `json:"diffs"`
	}
	if json.Unmarshal(result, &items) != nil {
		return nil
	}
	changes := 0
	for _, it := range items {
		if it.Status == "ok" && len(it.Diffs) > 0 {
			changes++
		}
	}
	return map[string]any{"items": len(items), "changes": changes}
}

// countReverifyApply counts an apply's lines as the review's own flash reads
// them: written (ok), failed (not ok), and skipped — a line carrying a note,
// which is what the apply says about a picture it could not fetch or a field it
// left because it changed since the check. A written line with a note is
// counted in both, as the flash counts it.
func countReverifyApply(result json.RawMessage) map[string]any {
	var lines []struct {
		OK   bool   `json:"ok"`
		Note string `json:"note"`
	}
	if json.Unmarshal(result, &lines) != nil {
		return nil
	}
	applied, skipped, failed := 0, 0, 0
	for _, l := range lines {
		if l.OK {
			applied++
		} else {
			failed++
		}
		if l.Note != "" {
			skipped++
		}
	}
	return map[string]any{"applied": applied, "skipped": skipped, "failed": failed}
}

// RegisterJobKinds puts every built-in kind that has a run on s.Jobs. serve()
// calls it once, after setting Jobs and before the first request.
func (s *Server) RegisterJobKinds() {
	for _, k := range builtinJobKinds {
		if k.run != nil {
			s.addJobKind(k)
		}
	}
}

// addJobKind registers k on the queue and keeps what POST /jobs checks for it.
func (s *Server) addJobKind(k queuedKind) {
	run := k.run
	s.Jobs.Register(jobs.Kind{
		Name: k.name, AdminOnly: k.adminOnly, Rerunnable: k.rerunnable,
		Run:    func(ctx context.Context, j *jobs.Job) error { return run(s, ctx, j) },
		Counts: k.counts,
	})
	s.startableMu.Lock()
	defer s.startableMu.Unlock()
	if s.startable == nil {
		s.startable = map[string]queuedKind{}
	}
	s.startable[k.name] = k
}

// startableKind is the kind POST /jobs may queue under name, if there is one.
func (s *Server) startableKind(name string) (queuedKind, bool) {
	s.startableMu.RLock()
	defer s.startableMu.RUnlock()
	k, ok := s.startable[name]
	return k, ok
}

// decodeParams reads a kind's params, which may be absent: a kind whose every
// param is optional can be started with none.
func decodeParams(raw json.RawMessage, v any) error {
	if len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, v); err != nil {
		return badParams("the job's params could not be read: they must be an object with the kind's fields")
	}
	return nil
}

// rowIDs is a list of row ids as a job reads it: each positive, each once, in
// order. ok is false when one is not positive.
func rowIDs(in []int64) (out []int64, ok bool) {
	out = []int64{} // [] rather than null, so an empty list is stored the same way every time
	for _, id := range in {
		if id <= 0 {
			return nil, false
		}
		out = append(out, id)
	}
	slices.Sort(out)
	return slices.Compact(out), true
}

var errBadID = badParams("every id must be a positive whole number")

func validateFill(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	var p struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
		All      bool    `json:"all"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	if p.All {
		return validateEvery("all", len(p.BookIDs)+len(p.MovieIDs), "fill every work or the works named, not both",
			func() (int, error) { return s.countWorks(viewer.UserID) })
	}
	books, okB := rowIDs(p.BookIDs)
	movies, okM := rowIDs(p.MovieIDs)
	if !okB || !okM {
		return jobInput{}, errBadID
	}
	n := len(books) + len(movies)
	switch {
	case n == 0:
		return jobInput{}, badParams("nothing to fill — pass book_ids or movie_ids")
	case n > maxWorksPerJob:
		return jobInput{}, badParams("too many works for one job (at most %d)", maxWorksPerJob)
	}
	return jobInput{params: map[string]any{"book_ids": books, "movie_ids": movies}, total: n,
		subject: s.soleSubject(viewer.UserID, books, movies, nil, nil)}, nil
}

func validateCovers(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	var p struct {
		MissingOnly bool `json:"missing_only"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	total, err := s.coversWorkload(viewer.UserID)
	if err != nil {
		return jobInput{}, fmt.Errorf("count the covers pass: %w", err)
	}
	return jobInput{params: map[string]any{"missing_only": p.MissingOnly}, total: total}, nil
}

func validatePeople(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	var p struct {
		IDs     []int64 `json:"ids"`
		Missing bool    `json:"missing"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	if p.Missing {
		return validateEvery("missing", len(p.IDs), "fetch every record missing something or the ones named, not both",
			func() (int, error) {
				ids, err := s.peopleMissing(viewer.UserID)
				return len(ids), err
			})
	}
	ids, ok := rowIDs(p.IDs)
	switch {
	case !ok:
		return jobInput{}, errBadID
	case len(ids) == 0:
		return jobInput{}, badParams("nobody to fetch — pass ids")
	case len(ids) > maxPeoplePerJob:
		return jobInput{}, badParams("too many people for one job (at most %d)", maxPeoplePerJob)
	}
	return jobInput{params: map[string]any{"ids": ids}, total: len(ids),
		subject: s.soleSubject(viewer.UserID, nil, nil, nil, ids)}, nil
}

// validateEvery queues the library-wide half of a fill or a people fetch: params
// {flag: true} and nothing else, which Settings › Jobs' common jobs send ("Fill
// gaps in every work", "Fetch missing people", jobs_common.go).
//
// WHICH WORKS OR RECORDS IS DECIDED WHEN THE JOB RUNS, NOT HERE (runFill,
// runPeople). A job waits its turn behind whatever else is queued, an hour's
// cover fetch among them, and a list taken at the press would leave out a work
// added meanwhile and ask again about a record the row's own Fetch completed
// meanwhile. So the params hold no list, the same press twice is the same job to
// the duplicate check, and a Run again runs over the library as it is then.
// count is only the total the row shows while it waits.
//
// NO CAP. The two thousand is how much one press may hand the queue in a list
// (the screens split a bigger selection into several jobs); "every work" is one
// job by name, and splitting it would make it several jobs that each say "every
// work".
func validateEvery(flag string, named int, both string, count func() (int, error)) (jobInput, error) {
	if named > 0 {
		return jobInput{}, badParams("%s", both)
	}
	n, err := count()
	if err != nil {
		return jobInput{}, fmt.Errorf("count what the job will walk: %w", err)
	}
	return jobInput{params: map[string]any{flag: true}, total: n}, nil
}

// reverifyAsk is a person a re-verify asks about, by kind and name, as
// POST /metadata/reverify takes them.
type reverifyAsk struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

func validateReverify(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	var p struct {
		BookIDs   []int64       `json:"book_ids"`
		MovieIDs  []int64       `json:"movie_ids"`
		People    []reverifyAsk `json:"people"`
		FillsOnly bool          `json:"fills_only"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	books, okB := rowIDs(p.BookIDs)
	movies, okM := rowIDs(p.MovieIDs)
	if !okB || !okM {
		return jobInput{}, errBadID
	}
	people := []reverifyAsk{}
	for _, pp := range p.People {
		pp.Kind, pp.Name = strings.TrimSpace(pp.Kind), strings.TrimSpace(pp.Name)
		if pp.Kind == "" || pp.Name == "" {
			return jobInput{}, badParams("every person needs a kind and a name")
		}
		people = append(people, pp)
	}
	slices.SortFunc(people, func(a, b reverifyAsk) int {
		return cmp.Or(cmp.Compare(a.Kind, b.Kind), cmp.Compare(a.Name, b.Name))
	})
	people = slices.Compact(people)
	n := len(books) + len(movies) + len(people)
	switch {
	case n == 0:
		return jobInput{}, badParams("nothing to re-verify — pass book_ids, movie_ids or people")
	case n > maxReverifyPerJob:
		return jobInput{}, badParams("too many items for one re-verify (at most %d)", maxReverifyPerJob)
	}
	return jobInput{params: map[string]any{
		"book_ids": books, "movie_ids": movies, "people": people, "fills_only": p.FillsOnly,
	}, total: n, subject: s.soleSubject(viewer.UserID, books, movies, people, nil)}, nil
}

// validateReverifyApply takes the items as the review sends them — each one the
// fields to write on one work or person — and checks only what the queue needs:
// how many, that each says what it is, and that the check it came from is the
// reader's own. What each item may set is the apply's own rule, the same one the
// synchronous POST /metadata/reverify/apply enforces, and it is enforced where the
// item is applied.
//
// THE CHECK IT CAME FROM MUST BE THE READER'S. from_job is what marks a re-verify
// applied (the job JSON's applied), so a from_job naming somebody else's check
// would change what that reader's screen offers; it is refused as a check this
// reader does not have, which says nothing about whether it exists.
func validateReverifyApply(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	var p struct {
		Items   []json.RawMessage `json:"items"`
		FromJob int64             `json:"from_job"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	switch n := len(p.Items); {
	case n == 0:
		return jobInput{}, badParams("nothing to apply — pass items")
	case n > maxReverifyPerJob:
		return jobInput{}, badParams("too many items for one apply (at most %d)", maxReverifyPerJob)
	}
	for i, it := range p.Items {
		var head struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(it, &head) != nil || strings.TrimSpace(head.Type) == "" {
			return jobInput{}, badParams("every item must be an object that names its type")
		}
		// Read as the job will read it, so an item it could not read is refused
		// now rather than failing the whole apply, every item unwritten, when it
		// runs.
		var item reverifyApplyItem
		if json.Unmarshal(it, &item) != nil {
			return jobInput{}, badParams("item %d could not be read: its id is a number, and set, sources and expect are objects of fields", i+1)
		}
	}
	params := map[string]any{"items": p.Items}
	if p.FromJob != 0 {
		var kind string
		var carried bool
		err := s.Store.DB.QueryRow(`SELECT kind, `+store.CarriedJob+` FROM jobs WHERE id = ? AND user_id = ?`, p.FromJob, viewer.UserID).
			Scan(&kind, &carried)
		if err != nil || kind != "reverify" {
			return jobInput{}, badParams("from_job is not one of your re-verify checks")
		}
		// Its review is refused (handleJobResult), so an apply naming it was not
		// built from one, and would mark decided a check nobody could open.
		if carried {
			return jobInput{}, badParams("from_job ran before the library was restored; run the check again")
		}
		params["from_job"] = p.FromJob
	}
	return jobInput{params: params, total: len(p.Items)}, nil
}

// backupKey is what a backup job seals its archive with. The runner keeps it in
// memory for the job alone and drops it however the job ends; it is never in
// the row. The job checks a password against the account's hash again when it
// runs, since the account may have changed its password while the job waited.
type backupKey struct {
	mode    byte
	account string
	secret  string
}

// validateBackup queues a backup with no params at all: the credential is the
// secret, and an owner's two presses are the same job, which the duplicate
// check then refuses — one backup at a time is what the kept-archive rule
// (the newest is the only one kept) wants anyway.
func validateBackup(s *Server, raw json.RawMessage, viewer jobs.Owner) (jobInput, error) {
	key, err := backupSecret(s, raw, viewer)
	if err != nil {
		return jobInput{}, err
	}
	return jobInput{params: map[string]any{}, secret: key}, nil
}

// backupSecret reads a backup's credential, from POST /jobs's params or from a
// rerun's body, and checks a password against the account now: a typo would
// seal an archive nothing can open, and the answer should come before anything
// queues rather than when the job fails.
func backupSecret(s *Server, raw json.RawMessage, viewer jobs.Owner) (any, error) {
	var p struct {
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return nil, err
	}
	mode, account, secret, msg := sealWith(p.Password, p.Passphrase, viewer.Username)
	if msg != "" {
		return nil, badParams("%s", msg)
	}
	if mode == backupModePassword && !s.passwordIs(viewer.UserID, secret) {
		return nil, &refusal{http.StatusUnauthorized, "that is not your password — the archive would be sealed with a key you could not reproduce"}
	}
	return backupKey{mode: mode, account: account, secret: secret}, nil
}

// asRefusal is err as a validate's refusal, if it is one.
func asRefusal(err error) (*refusal, bool) {
	var r *refusal
	ok := errors.As(err, &r)
	return r, ok
}
