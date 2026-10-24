# ADR-0284: Cloze now forgives a close synonym, reversing the entry above

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** Before the edit-distance banding runs, two words are compared as *words*: the same word spelled another way (`-ise`/`-ize`, `-our`/`-or`, `-re`/`-er`, a doubled consonant before a suffix, a leading ligature vowel), the same word in another form (a plural, a possessive, a past tense, a participle), or a pair from a short hand-written list of near-synonyms. Everything else is unchanged — same banding, same token-by-token rule, same word-count refusal.

**Why the earlier refusal was half right.** It was right that edit distance cannot separate a typo from a different word, and the banding it set stands. It was wrong that a synonym is therefore a failure of recall. "silent" for "quiet" is **nine edits** away and is somebody who has the sentence; "fast" for "vast" is **one edit** away and is somebody who has not. Grading on letters means the reader who half-remembers the phrase is told only that they were wrong, on the hardest card in the deck, which is the card people give up on first.

**What keeps it from being a thesaurus, and the test a pair has to pass.** Substituting one for the other changes the WORD and nothing else — not the strength, not the register, not the era. The list opened at twenty-four pairs and was cut to **seven**, because most of them failed that test: "large" for "big" and "silent" for "quiet" are the word a reader reaches for rather than the word a writer chose, and a quotation is the one kind of text where that difference *is* the text. Every spelling fold is **anchored**: an unanchored `oe`→`e` folds "poet" onto "pet", and a fold that can invent an equivalence is worse than no fold. It applies per word inside a phrase and never to the whole string, so three words recalled as three synonyms is still a paraphrase and still wrong.

**A SYNONYM IS A THIRD OUTCOME, NOT A SECOND, and it is worth half.** `clozeJudge` returns miss / the word / a word that means the same, because a boolean cannot carry what the schedule needs: collapsing the middle case into "correct" tells a reader who wrote "nearly" that they reproduced the line, and collapsing it into "wrong" tells somebody who has the sentence that they have forgotten it. A synonym counts (no lapse) and keeps `clozeSynonym` of the stretch an exact recall earns — 0.5 by default, a slider in the in-depth panel, bounded 0–1 because a synonym cannot be worth MORE than the word it stood in for. The weight scales the MOVE and not the value landed on, the same shape as `clozeGrow`/`clozeShrink`, and composes with them: the cloze card's extra credit is earned first and half of it is what a synonym keeps. A lapse is never discounted — the weight is a thing to say about a right answer.

**The same word written differently is not a synonym.** A British spelling and a plural keep full credit: nobody recalling a line has failed at it by writing "colour". That split is why `clozeSameWord` and `clozeSynonymOf` are two functions rather than one.

**Told to the reader.** The reveal names which of the two right answers theirs was. A discount nobody is told about is a schedule moving for reasons they cannot see, and the words they did not quite write are the only place that means anything.

**Reversal.** Of "Refused explicitly: synonyms" in the entry above, which was the reader's own decision.

**Approved.** The reader's, in two passes: "cloze should handle some close synonyms", then — after seeing how wide the first list was — "cloze synonyms should be narrow. without synonyms, the user will feel betrayed at times. and we need to introduce a difficulty based scoring (correct answer gets 2x the halflife than synonyms, based on a separate slider in the in-depth settings)."

<sub>v3.0.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go` · `internal/httpapi/review_tuning.go` · `internal/httpapi/review_handlers.go` · `web/frontend/src/quiz.js` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
