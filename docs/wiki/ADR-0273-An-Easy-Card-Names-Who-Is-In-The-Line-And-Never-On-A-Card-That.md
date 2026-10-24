# ADR-0273: An easy card names who is in the line, and never on a card that asks it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** At the Easy tier the server sends the line's own people with the card — `easy_chips` for the characters a book or screen line names, each with the picture stored for them, and `easy_people` for a standalone quote's speaker — and the quiz card draws them beside the words. **A chip may not name anything this card removed from its own words** (`easyChipLeaks`), and the two directions whose answer IS a person — `speaker` and `quote` — get no chips at all.

**And the direction list alone was not the rule, which shipped as a leak with a schedule behind it.** This entry said "never on a card that asks it" and named two directions, and that is false for the commonest card in the deck: a fill-in-the-blank card's answer is a person whenever the phrase it hid is a name. A line whose one content word was "Chani" came back as `…when ▢ was with them` with Chani on a chip beside it — the reader reads the answer off the card, types it, is graded right, and the half-life climbs on a card they never recalled. `dirAuthor` on a memoir whose character is its author is the same shape, where `hideTheAnswer` masks the name and the chip restores it. So the test is the mask itself — present in the words as they were, absent from the words as shown — which answers for cloze, for the multiple-choice blank, for the author card and for any direction a later release masks, without anyone having to remember to extend a list. It is conservative on purpose: a partial overlap withholds the whole chip, because naming "Paul Atreides" hands over "Paul".

**Why the server gates it and not the client.** This is the answer-leak judgement `hideTheAnswer` already makes about the same people, and putting the two on opposite sides of the wire is how one of them goes on being right. The client also cannot recompute the tier: Random resolves per card from `tierDaySeed`, so "is this card easy" is only answerable where the deck was built. So the payload arrives already decided, and `review.jsx` draws what came.

**And it is the quiz card's OWN chip, not the app's rich one.** `people.jsx`'s `SpeakerChips` is the better row on every other surface — a press that opens the character, the performer under the name — and it is the wrong one here twice over. `people.jsx` imports `usePractice` from `review.jsx`, which is exactly the cycle `credits.jsx` exists to keep open; and on a quiz card the answer buttons own the tap, so a chip that became a door would take the reader out of a round from the one place every press is already spoken for. `person-router.test.jsx` had already written that down — *"review.jsx defines its OWN PersonChip — display-only, because there the answer buttons own the tap"* — before this change went looking for it.

**Instead of.** Moving `PersonChip`, `SpeakerChips`, `PeopleChips` and `chipRows` down into `credits.jsx` and re-exporting them, which is what this file's layering argument seems to invite. It was built and reverted: two guards rejected it — `locale-shadow.test.js`, because `credits.jsx` holds two local `const t` that a new `t` import would silently shadow, and `person-router.test.jsx`, whose rule is that a file importing the shared chip must route it through `usePersonOpener`, i.e. that the shared chip is a door. Both were saying the same thing from different directions: the shared chip is not what a quiz card wants.

**A character's face comes off the card; a person's out of the People map.** A character's picture belongs to ONE work — the same name in two films is two pictures — so the server resolves the pair (`loadCharacterImages` + `characterImagesFor`, the two-step every list surface makes, one batched query per round after the cards are built) and the client turns the rows into the name→row shape `CreditFaces` already reads. A speech's speaker is a person with a headshot and goes through `usePeople('speaker')`, which is the same split `SourceLines` makes one function away.

**Approved.** Mine, from the plan's own §2, with "never on a card that asks it" as the property that decides the shape.

<sub>3.1.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_lures_test.go` · `web/frontend/src/review.jsx` · `web/frontend/test/dom/quiz-easy-chips.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
