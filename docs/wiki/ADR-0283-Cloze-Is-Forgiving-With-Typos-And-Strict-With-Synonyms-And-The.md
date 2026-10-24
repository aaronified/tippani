# ADR-0283: Cloze is forgiving with typos and strict with synonyms, and the threshold follows word length

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** The blank is graded after normalisation, by Levenshtein distance banded on the length of the answer word: **0 edits up to 4 characters, 1 for 5–7, 2 for 8 and over.** Multi-word blanks are graded token by token, in order, all must pass. No thesaurus, no stemmer, no inflection matching.

**The trap, which sets the numbers.** Edit distance does not know the difference between a typo and a different word. "cat" → "cot" is one edit; "bad" → "sad" is one edit. A tolerance generous enough to feel kind on a long word will, on a short one, silently accept **a word the reader actually chose** — the synonym failure arriving through the back door wearing typo's coat. So the threshold is not a generosity setting: it is derived from how far you can travel before landing on another real word, and that distance is a function of length.

**Normalisation is not forgiveness.** Case, surrounding punctuation, curly against straight apostrophes, en dash against hyphen, collapsed whitespace. None of those is the reader being wrong.

**Refused explicitly:** synonyms (the blank is a span of a *quote*; a word that means the same thing is not the word that was written, and accepting it lets the reader pass without recalling the line), stems and inflections ("walked" for "walking" changes what the line says), and word order or count.

**Token by token rather than whole-string,** because a whole-string budget earned by long neighbours will hide a wholly missing short word.

**Nearly free to build:** `internal/search/levenshtein.go` already exists for the typo-tolerant search pass, and the rest of this rule is the *absence* of features. **The banding lives with the caller, not inside the shared function.** `editDistance` was just consolidated into `web/frontend/src/text.js` precisely because two copies of Levenshtein stay correct only until somebody tunes one of them — and a length-banded threshold *is* tuning. Search wants to be generous because a near miss there costs a wasted glance; cloze wants to be strict because a near miss there is a false pass. Same distance function, two callers, two thresholds, neither written into the shared code. The one addition worth making is showing the difference marked on the reveal, so a reader who typed "recieve" can see that is what happened — and so can one whose synonym was refused, or the rule reads as arbitrary rather than strict.

**Approved.** The reader's, in the form "fill in the blanks questions must be forgiving with typos. but not with synonyms."

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
