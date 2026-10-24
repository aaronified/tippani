# ADR-0276: A person card masks its own answer in the words it shows

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `speaker` and `author` cards blank the answer wherever it appears in the quote or the note they print: the whole credit, each split credit, and each credit's surname. A surname is matched **case-sensitively**; the full credit folds case. A card left with nothing to read is refused and `buildQuestion` falls through to another direction. The boundary is "not a letter or a number" rather than `\b`, so the masking reaches any script that separates words with spaces — `\b` is an ASCII-word rule and would never have fired on a Bengali line. A script that does NOT space its words (Han, the kana, Thai, Lao, Khmer, Myanmar) has no boundary to ask for, so a name written in one is matched bare: 鲁迅 inside 这是鲁迅先生说过的话 never sits between two non-letters, and the boundary rule that makes a Latin surname safe would have left every such name standing.

**Why.** review.jsx's prompt side sends every direction but "quote" down `QuoteBlock`, so these cards show the words and ask who is behind them — and a line whose own text names that person answers itself. The reader picks the option they can already read, the card records a success, and the half-life climbs on evidence of nothing.

**Instead of.** Masking every character and actor name in the line, which is what the plan asked for and is wrong for the commonest case: a film line's answer is the ACTOR, so a line naming its CHARACTER gives it away only to a reader who knows the film — precisely what the card is testing. That version would blank a large share of the dialogue in a library to remove the knowledge being examined. Also rejected: masking surnames case-insensitively, which would have an author called "Stephen King" blanking *"the king was dead"* in every line; prose naming a person capitalises them, and that is the discriminator that actually works.

**And the other half of this leak was already closed**, which is why only the text remained: `SourceLines` used to be reached by every direction that was not "source", printing the actor as a face chip and the character in its meta line, directly above the card's own four options.

**Approved.** Mine, with the character-name correction as the part I changed my mind about.

<sub>3.1.0 — `internal/httpapi/speaker.go` · `internal/httpapi/speaker_test.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
