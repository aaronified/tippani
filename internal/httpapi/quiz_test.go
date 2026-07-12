package httpapi

import (
	"fmt"
	"net/http"
	"testing"
)

type quizDeck struct {
	Questions []struct {
		ID      int64    `json:"id"`
		Kind    string   `json:"kind"`
		Type    string   `json:"type"`
		Prompt  string   `json:"prompt"`
		Options []string `json:"options"`
		Answer  int      `json:"answer"`
	} `json:"questions"`
}

type quizSubmitResp struct {
	OK      bool `json:"ok"`
	Total   int  `json:"total"`
	Correct int  `json:"correct"`
	Stats   struct {
		Taken    int     `json:"taken"`
		Total    int     `json:"total"`
		Correct  int     `json:"correct"`
		Accuracy float64 `json:"accuracy"`
	} `json:"stats"`
}

func TestQuiz(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Two books (distinct genres, so which-source has same-genre-preferring
	// distractors and a real choice) with a handful of annotations each.
	b1 := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "genres": []string{"sci-fi"}}, http.StatusCreated))
	b2 := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Emma", "genres": []string{"romance"}}, http.StatusCreated))
	annIDs := map[int64]bool{}
	for i := 0; i < 4; i++ {
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": b1.ID, "quote": fmt.Sprintf("Dune line %d", i)}, http.StatusCreated))
		annIDs[a.ID] = true
	}
	for i := 0; i < 2; i++ {
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": b2.ID, "quote": fmt.Sprintf("Emma line %d", i)}, http.StatusCreated))
		annIDs[a.ID] = true
	}
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Northline"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "line one", "character": "Mira", "actor": "E. Sen"}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "line two", "character": "Joel", "actor": "D. Kapoor"}, http.StatusCreated)

	deck := decode[quizDeck](t, c.mustDo("GET", "/annotations/quiz?count=6", nil, 200))
	if len(deck.Questions) == 0 {
		t.Fatal("quiz produced no questions")
	}
	sawWhich, sawWho := false, false
	for _, q := range deck.Questions {
		if q.Answer < 0 || q.Answer >= len(q.Options) {
			t.Fatalf("answer index out of range: %+v", q)
		}
		if len(q.Options) < 2 {
			t.Fatalf("question with <2 options: %+v", q)
		}
		// Options must be unique (no duplicate choices).
		seen := map[string]bool{}
		for _, o := range q.Options {
			if seen[o] {
				t.Fatalf("duplicate option in %+v", q)
			}
			seen[o] = true
		}
		switch q.Type {
		case "which-source":
			sawWhich = true
			if q.Kind != "ann" {
				t.Fatalf("which-source not ann: %+v", q)
			}
		case "who-said":
			sawWho = true
			if q.Kind != "dlg" {
				t.Fatalf("who-said not dlg: %+v", q)
			}
		default:
			t.Fatalf("unknown question type: %+v", q)
		}
	}
	if !sawWhich {
		t.Fatal("expected at least one which-source question")
	}
	_ = sawWho // who-said depends on the random draw filling remaining slots

	// Answer every question correctly. Each annotation answer is folded into its
	// review schedule the instant it's given (per-answer, not at submit), so a
	// review row must already exist and have gained stability before we submit.
	var answers []map[string]any
	var oneAnn int64
	for _, q := range deck.Questions {
		answers = append(answers, map[string]any{"id": q.ID, "kind": q.Kind, "correct": true})
		if q.Kind == "ann" {
			c.mustDo("POST", "/annotations/quiz/answer", map[string]any{"id": q.ID, "correct": true}, 200)
			if oneAnn == 0 {
				oneAnn = q.ID
			}
		}
	}
	if oneAnn != 0 {
		var stability float64
		if err := srv.Store.DB.QueryRow(`SELECT stability FROM annotation_reviews WHERE annotation_id = ?`, oneAnn).Scan(&stability); err != nil {
			t.Fatalf("per-answer quiz did not create a review row: %v", err)
		}
		if stability <= reviewMinStability {
			t.Fatalf("correct quiz answer did not grow stability: %v", stability)
		}
	}

	// Submit records only the round's score now (never touches the schedule).
	res := decode[quizSubmitResp](t, c.mustDo("POST", "/annotations/quiz/submit",
		map[string]any{"answers": answers}, 200))
	if !res.OK || res.Total != len(answers) || res.Correct != len(answers) {
		t.Fatalf("submit: %+v", res)
	}
	if res.Stats.Taken != 1 || res.Stats.Total != len(answers) || res.Stats.Correct != len(answers) || res.Stats.Accuracy != 1 {
		t.Fatalf("stats after submit: %+v", res.Stats)
	}

	// The dedicated stats endpoint agrees with the submit response.
	type quizStatsResp struct {
		Taken   int `json:"taken"`
		Correct int `json:"correct"`
	}
	gs := decode[quizStatsResp](t, c.mustDo("GET", "/annotations/quiz/stats", nil, 200))
	if gs.Taken != 1 {
		t.Fatalf("stats endpoint taken: %+v", gs)
	}

	// Validation: empty / oversized answer sets are 400.
	c.mustDo("POST", "/annotations/quiz/submit", map[string]any{"answers": []any{}}, http.StatusBadRequest)

	// Flush clears the score history.
	c.mustDo("DELETE", "/annotations/quiz/results", nil, 200)
	flushed := decode[quizSubmitResp](t, c.mustDo("POST", "/annotations/quiz/submit",
		map[string]any{"answers": []map[string]any{{"id": oneAnn, "kind": "ann", "correct": true}}}, 200))
	if flushed.Stats.Taken != 1 {
		t.Fatalf("flush did not clear history: %+v", flushed.Stats)
	}

	// Ownership: bob answering with admin's annotation id must not touch admin's
	// review row — capture it, then prove it's unchanged after bob's forged answer.
	var before float64
	if err := srv.Store.DB.QueryRow(`SELECT stability FROM annotation_reviews WHERE annotation_id = ?`, oneAnn).Scan(&before); err != nil {
		t.Fatal(err)
	}
	bob := addUser(t, h, c, "bob")
	// correct:true so the ownership guard is what stops the write (a wrong answer
	// would no-op regardless), proving bob can't touch admin's review row.
	bob.mustDo("POST", "/annotations/quiz/answer",
		map[string]any{"id": oneAnn, "correct": true}, 200)
	var after float64
	if err := srv.Store.DB.QueryRow(`SELECT stability FROM annotation_reviews WHERE annotation_id = ?`, oneAnn).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("bob's forged answer changed admin's review state: %v -> %v", before, after)
	}
}
