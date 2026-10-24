# ADR-0274: A fill-in-the-blank card's wrong options are ranked by how much they look like the answer, and none of them is a second right answer

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `attachClozeMCQ` gathers up to `clozeLurePool` (24) candidate phrases out of the work-similarity-ranked quote pool, drops any the GRADER would accept as the answer, ranks the rest by `clozeSurfaceScore` — shared stem 1000, matching initial per position 50, rune-length difference as the tie-break — and takes the best three. The arrival order breaks ties, so parent-work similarity is still in the answer.

**Why a second scale.** The options were ranked only by the similarity of the WORK they came from. That is the right first cut and says nothing about the phrases: a three-word answer could be offered against three phrases with the same word count and no other resemblance, and the reader picks the right one by the shape of the sentence rather than by remembering the line. The plan's §2 asks for this in as many words and recommends deriving it from the corpus rather than from a thesaurus — no dependency, and every lure is real language somebody in this library wrote.

**And a wrong option must not be one the typed card would accept — which is a bug this found rather than a nicety.** The duplicate test was `clozeSameSpan`, normalised equality, so a phrase within the typo budget of the answer or a synonym of it could be offered as a WRONG option: the reader picks the words the typed version of the same span would have marked right and is told they forgot the line. Two cards over one blank disagreeing about what the answer is. The grader is the test now — `clozeJudge(answer, phrase) != clozeMiss` — so there is one authority on it rather than two. The mutation that proved the guard names the defect exactly: *offers "awakens" as a wrong answer beside "awaken"*.

**One word is the common width, and at one word the strongest signal is unreachable.** A single word sharing the answer's stem IS the answer, and the refusal above drops it — so what makes a one-word option close is its initial letter and its length, and the wider span is where the stem term does the work. Both are guarded, at their own widths: the multi-word case parks a card past `clozeMultiWordFrom` rather than pretending a fresh card can hide a phrase.

**Instead of.** A synonym or antonym dictionary — the plan's second option, and rejected there for the reason `go.mod`'s three direct requirements are defended by name: a real one is a dependency, and a hand-curated list stays thin, so the feature would work on some cards and not others with nothing on screen to say why. The seven pairs in `clozeSynonyms` exist for GRADING and are deliberately not generators.

**Approved.** Mine, with "no option is a second right answer" as the property that decides it — the half the plan did not ask for and the only one that was a defect.

<sub>3.1.0 — `internal/httpapi/cloze.go` · `internal/httpapi/review_handlers.go` · `internal/httpapi/cloze_lures_test.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
