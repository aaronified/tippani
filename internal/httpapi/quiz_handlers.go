package httpapi

// Recall quiz (ROADMAP №2, companion to the daily review). Multiple-choice
// rounds built on the fly from the user's own library:
//
//   which-source — a quote, pick the book it's from (annotations). Distractors
//                  prefer books that share a genre with the answer.
//   who-said     — a line of dialogue, pick the actor who said it (dialogues
//                  that have an actor tagged). Distractors are other actors.
//
// Questions are drawn mastery-weighted: unseen / low-stability annotations are
// likeliest, well-revised ones progressively rarer. A CORRECT answer counts as a
// revision, folded into the schedule the moment it's given (handleQuizAnswer) —
// it nudges the annotation's half-life up; a wrong answer is a no-op that never
// shrinks the schedule — so the quiz and the daily review share one memory
// model, and an abandoned round still credits what the user got right. Scores
// are recorded
// per completed round (quiz_results, migration 0014) and the user can flush them.

import (
	"database/sql"
	"errors"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	quizMaxQuestions     = 12
	quizDefaultQuestions = 6
	quizOptions          = 4 // choices per question (fewer when the pool is small)
)

type quizQuestion struct {
	ID      int64    `json:"id"`
	Kind    string   `json:"kind"` // "ann" | "dlg"
	Type    string   `json:"type"` // "which-source" | "who-said"
	Prompt  string   `json:"prompt"`
	Ask     string   `json:"ask"`     // the question line ("Which book is this from?")
	Options []string `json:"options"` // display labels
	Answer  int      `json:"answer"`  // index of the correct option
}

// bookInfo / dialogue rows used to build questions + distractor pools.
type quizBook struct {
	id     int64
	title  string
	genres map[string]bool
}

// handleQuiz builds a fresh MCQ round. GET /annotations/quiz?count=N.
func (s *Server) handleQuiz(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	count := quizDefaultQuestions
	if v := r.URL.Query().Get("count"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			count = min(n, quizMaxQuestions)
		}
	}

	// Distractor pool: every book's title + genre set (for same-genre picks).
	books, bookByID, err := s.quizBooks(uid)
	if err != nil {
		internalError(w, r, "quiz books", err)
		return
	}
	// Distinct actor pool for who-said distractors.
	actors, err := s.quizActors(uid)
	if err != nil {
		internalError(w, r, "quiz actors", err)
		return
	}

	questions := []quizQuestion{}

	// which-source needs at least two distinct book titles to offer a choice.
	if len(bookByID) >= 2 {
		rows, err := s.Store.DB.Query(`
			SELECT a.id, COALESCE(a.quote, ''), COALESCE(a.note, ''), a.book_id
			FROM annotations a
			JOIN books b ON b.id = a.book_id
			LEFT JOIN annotation_reviews r ON r.annotation_id = a.id
			WHERE b.user_id = ? AND (a.quote IS NOT NULL OR a.note IS NOT NULL)
			ORDER BY (ABS(RANDOM()) / 9223372036854775807.0) * (1 + COALESCE(r.stability, 0.0))
			LIMIT ?`, uid, count)
		if err != nil {
			internalError(w, r, "quiz annotations", err)
			return
		}
		for rows.Next() {
			var id, bookID int64
			var quote, note string
			if rows.Scan(&id, &quote, &note, &bookID) != nil {
				continue
			}
			prompt := quote
			if prompt == "" {
				prompt = note
			}
			ans := bookByID[bookID]
			if ans == nil || prompt == "" {
				continue
			}
			opts, answer := quizChoices(ans.title, distractorTitles(ans, books), quizOptions)
			if len(opts) < 2 {
				continue
			}
			questions = append(questions, quizQuestion{
				ID: id, Kind: "ann", Type: "which-source",
				Prompt: prompt, Ask: "Which book is this from?", Options: opts, Answer: answer,
			})
		}
		rows.Close()
	}

	// who-said fills the rest from dialogues that have an actor, when there are
	// enough distinct actors to choose between.
	if len(actors) >= 2 && len(questions) < count {
		rows, err := s.Store.DB.Query(`
			SELECT d.id, COALESCE(d.quote, ''), d.actor
			FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND d.actor IS NOT NULL AND d.actor <> '' AND d.quote IS NOT NULL
			ORDER BY RANDOM() LIMIT ?`, uid, count)
		if err != nil {
			internalError(w, r, "quiz dialogues", err)
			return
		}
		for rows.Next() {
			if len(questions) >= count {
				break
			}
			var id int64
			var quote, actor string
			if rows.Scan(&id, &quote, &actor) != nil || quote == "" || actor == "" {
				continue
			}
			opts, answer := quizChoices(actor, otherActors(actor, actors), quizOptions)
			if len(opts) < 2 {
				continue
			}
			questions = append(questions, quizQuestion{
				ID: id, Kind: "dlg", Type: "who-said",
				Prompt: quote, Ask: "Who said this?", Options: opts, Answer: answer,
			})
		}
		rows.Close()
	}

	// Interleave so a round isn't all-books-then-all-dialogues, and cap.
	rand.Shuffle(len(questions), func(i, j int) { questions[i], questions[j] = questions[j], questions[i] })
	if len(questions) > count {
		questions = questions[:count]
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": questions})
}

// quizBooks returns the user's books (title + genre set) both as a slice and by
// id, for distractor selection.
func (s *Server) quizBooks(uid int64) ([]quizBook, map[int64]*quizBook, error) {
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(g.name, '')
		FROM books b
		LEFT JOIN book_genres bg ON bg.book_id = b.id
		LEFT JOIN genres g ON g.id = bg.genre_id
		WHERE b.user_id = ?`, uid)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	byID := map[int64]*quizBook{}
	var list []quizBook
	for rows.Next() {
		var id int64
		var title, genre string
		if rows.Scan(&id, &title, &genre) != nil {
			continue
		}
		b := byID[id]
		if b == nil {
			byID[id] = &quizBook{id: id, title: title, genres: map[string]bool{}}
			b = byID[id]
		}
		if genre != "" {
			b.genres[strings.ToLower(genre)] = true
		}
	}
	for _, b := range byID {
		list = append(list, *b)
	}
	return list, byID, rows.Err()
}

func (s *Server) quizActors(uid int64) ([]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT DISTINCT d.actor FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ? AND d.actor IS NOT NULL AND d.actor <> ''`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var a string
		if rows.Scan(&a) == nil && a != "" {
			out = append(out, a)
		}
	}
	return out, rows.Err()
}

// distractorTitles returns other book titles, same-genre first, then the rest,
// de-duplicated against the answer title.
func distractorTitles(answer *quizBook, books []quizBook) []string {
	var same, rest []string
	for i := range books {
		b := &books[i]
		if b.id == answer.id || b.title == answer.title {
			continue
		}
		shared := false
		for g := range b.genres {
			if answer.genres[g] {
				shared = true
				break
			}
		}
		if shared {
			same = append(same, b.title)
		} else {
			rest = append(rest, b.title)
		}
	}
	rand.Shuffle(len(same), func(i, j int) { same[i], same[j] = same[j], same[i] })
	rand.Shuffle(len(rest), func(i, j int) { rest[i], rest[j] = rest[j], rest[i] })
	return append(same, rest...)
}

func otherActors(answer string, actors []string) []string {
	var out []string
	for _, a := range actors {
		if a != answer {
			out = append(out, a)
		}
	}
	rand.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

// quizChoices assembles up to `n` options (the answer + distinct distractors),
// shuffles them, and reports the answer's landing index. Distractors already
// arrive de-duplicated against the answer and best-first ordered.
func quizChoices(answer string, distractors []string, n int) ([]string, int) {
	opts := []string{answer}
	seen := map[string]bool{answer: true}
	for _, d := range distractors {
		if len(opts) >= n {
			break
		}
		if !seen[d] {
			seen[d] = true
			opts = append(opts, d)
		}
	}
	rand.Shuffle(len(opts), func(i, j int) { opts[i], opts[j] = opts[j], opts[i] })
	idx := 0
	for i, o := range opts {
		if o == answer {
			idx = i
			break
		}
	}
	return opts, idx
}

// handleQuizSubmit records a completed round's score. POST
// /annotations/quiz/submit with {"answers":[{"id","kind","correct"}]}. The
// review-schedule folding happens live, per answer, via handleQuizAnswer as the
// round is played, so submit only tallies — it never touches annotation_reviews.
func (s *Server) handleQuizSubmit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Answers []struct {
			ID      int64  `json:"id"`
			Kind    string `json:"kind"`
			Correct bool   `json:"correct"`
		} `json:"answers"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Answers) == 0 || len(req.Answers) > quizMaxQuestions {
		writeErr(w, http.StatusBadRequest, "answers must be 1..12 items")
		return
	}
	uid := userID(r)
	total, correct := len(req.Answers), 0
	for _, a := range req.Answers {
		if a.Correct {
			correct++
		}
	}
	if _, err := s.Store.DB.Exec(`INSERT INTO quiz_results (user_id, total, correct) VALUES (?, ?, ?)`,
		uid, total, correct); err != nil {
		internalError(w, r, "quiz record", err)
		return
	}

	stats, err := s.quizStats(uid)
	if err != nil {
		internalError(w, r, "quiz stats", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "total": total, "correct": correct, "stats": stats})
}

// handleQuizAnswer folds a single CORRECT quiz recall into its review schedule
// the moment it's given, so the quiz and the daily review share one memory model
// even for a round the user never finishes. POST /annotations/quiz/answer with
// {"id","correct"}. Only a correct answer counts as a revision — a wrong one is
// a no-op that must not nudge (or penalise) the schedule. Only annotation
// questions reach here — dialogues aren't in the schedule, so the client doesn't
// call it for them. An id the caller doesn't own is a silent no-op: like a
// missing one, it can't be probed.
func (s *Server) handleQuizAnswer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID      int64 `json:"id"`
		Correct bool  `json:"correct"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if !req.Correct { // a wrong recall is not a revision
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "quiz answer begin", err)
		return
	}
	defer tx.Rollback()
	// Ownership-check (annotation_reviews has no user_id of its own) so a crafted
	// body can't touch another user's rows.
	var owned bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM annotations an JOIN books b ON b.id = an.book_id
	                       WHERE an.id = ? AND b.user_id = ?)`, req.ID, uid).Scan(&owned); err != nil {
		internalError(w, r, "quiz answer ownership", err)
		return
	}
	if owned {
		if err := applyCorrectRecall(tx, req.ID); err != nil {
			internalError(w, r, "quiz answer review", err)
			return
		}
		if err := tx.Commit(); err != nil {
			internalError(w, r, "quiz answer commit", err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// applyCorrectRecall credits a correct quiz recall against the annotation's
// memory half-life the SM-2 way — grows it (crediting elapsed time, capped),
// creating the review row on first sight. Only correct recalls reach here: a
// wrong quiz answer is not a revision and never shrinks the schedule. Unlike the
// daily-review endpoint there is no same-day guard — a quiz is a deliberate
// fresh attempt.
func applyCorrectRecall(tx *sql.Tx, id int64) error {
	stability := reviewMinStability
	var lastReviewed sql.NullString
	found := true
	err := tx.QueryRow(`SELECT stability, last_reviewed_at FROM annotation_reviews WHERE annotation_id = ?`, id).
		Scan(&stability, &lastReviewed)
	if errors.Is(err, sql.ErrNoRows) {
		found = false
	} else if err != nil {
		return err
	}
	elapsed := 0.0
	if lastReviewed.Valid {
		if t, e := time.Parse("2006-01-02 15:04:05", lastReviewed.String); e == nil {
			elapsed = time.Since(t).Hours() / 24
		}
	}
	stability *= reviewGrowth
	if late := elapsed * reviewLateBonus; late > stability {
		stability = late
	}
	stability = min(stability, reviewMaxStability)
	if found {
		_, err = tx.Exec(`UPDATE annotation_reviews SET stability = ?, review_count = review_count + 1,
		                  last_result = 'got', last_reviewed_at = datetime('now'), last_touched_at = datetime('now')
		                  WHERE annotation_id = ?`, stability, id)
	} else {
		_, err = tx.Exec(`INSERT INTO annotation_reviews (annotation_id, stability, review_count, lapse_count,
		                  last_result, last_reviewed_at, last_touched_at)
		                  VALUES (?, ?, 1, 0, 'got', datetime('now'), datetime('now'))`,
			id, stability)
	}
	return err
}

type quizStatsOut struct {
	Taken    int     `json:"taken"`    // quizzes completed
	Total    int     `json:"total"`    // questions answered across all
	Correct  int     `json:"correct"`  // of those, right
	Accuracy float64 `json:"accuracy"` // 0..1, 0 when none taken
}

func (s *Server) quizStats(uid int64) (quizStatsOut, error) {
	var q quizStatsOut
	err := s.Store.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(SUM(total), 0), COALESCE(SUM(correct), 0)
		FROM quiz_results WHERE user_id = ?`, uid).Scan(&q.Taken, &q.Total, &q.Correct)
	if err != nil {
		return q, err
	}
	if q.Total > 0 {
		q.Accuracy = float64(q.Correct) / float64(q.Total)
	}
	return q, nil
}

// handleQuizStats: GET /annotations/quiz/stats.
func (s *Server) handleQuizStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.quizStats(userID(r))
	if err != nil {
		internalError(w, r, "quiz stats", err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// handleQuizFlush: DELETE /annotations/quiz/results — clear the score history.
func (s *Server) handleQuizFlush(w http.ResponseWriter, r *http.Request) {
	if _, err := s.Store.DB.Exec(`DELETE FROM quiz_results WHERE user_id = ?`, userID(r)); err != nil {
		internalError(w, r, "quiz flush", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
