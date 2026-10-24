# ADR-0819: quote-card-types.md retires, and the five places it turned out to be wrong

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted, then changed or withdrawn: the entry says how

The plan is folded in here and its file deleted, which is what `docs/plans/README.md`
requires of a plan that has shipped and what the owner ruled for this one in particular:
it "retires into Design-decisions.md once the card work lands." It has landed. What follows is the
verification pass — the part worth keeping, because a plan that was simply right teaches
nothing.

### What shipped

Part A, the attribution composed per kind rather than concatenated, is `attributionParts`
and `phrase` in `attribution.js`, with the owner's five corrected shapes. The card's
settled six-band structure — body, person chip, attribution, note, tags, actions — is
drawn by `AnnotationCard` and, since this pass, by `Frame`. The precedence rule is
`resolveTextOrder`. A proverb's language is a first-screen field. The search results row,
the Home favourite tile and the share all compose the same credit as the card.

### 1. Part B was withdrawn by the owner before a line of it was written

The plan proposed three card BODIES — Attributed, Verse, Saying — chosen per kind, and
warned that three shapes across five surfaces meant three things to keep in step. The
owner replaced it with one structure whose kind varies only band 3. The plan's own
warning is what makes this worth recording: it identified the right risk and proposed the
thing that carried it.

### 2. AND THE RISK IT NAMED HAPPENED ANYWAY, IN THE STRUCTURE THAT REMOVED IT

"There is nothing to drift, because there is one component and one order" — except there
are two components, `AnnotationCard` and `Frame`, and they drifted. `Frame` drew the
translation four bands low, after the chips, the credit row and the tag row, and had the
note and tag row swapped besides. Both under a comment citing `AnnotationCard` by name.
**One ORDER is not one COMPONENT**, and the plan's sentence quietly treated them as the
same thing. `one-card-shape.test.js` is what closes it, and it works by comparing the two
cards to each other rather than either to prose — prose is what both were already citing.

### 3. "Both halves expandable, separately" was already built when the plan proposed it

`TranslationLine` has carried its own `open` state and its own `ClampToggle`, independent
of the body's, since 2026-08-24. The plan arrived on 2026-09-09 and called it new, with a
paragraph arguing for it. This is the failure the directory's own rule exists to prevent —
"a plan is written against the tree rather than against memory" — caught one plan later.

### 4. The recommended answer for the proverb's language was not the one taken

The plan recommended defaulting the language from the board's own `languages` list (0037),
"falling back to" promoting it out of the disclosure on the proverb door. The owner took
the fallback directly: *"proverb language should be a first screen field."* The plan's
reasoning for preferring the default — that a board already knows its languages — is
sound and lost to a simpler fact: the field is filled on every proverb in a real library,
so promoting it costs nothing and needs no rule about boards that name two.

### 5. Two of the five surfaces cannot take the structure, and the plan named one

It flagged the share image — "no room for six bands" — and did not flag the recall popup.
A quiz card masks the speaker, blanks a cloze and reveals by tier: a fixed band order is
contrary to what it is for. Both draw the card's COMPOSED CREDIT, which is the part that
must not differ, and neither draws its bands. That is the honest reading of "all
annotation cards": the rule binds cards that PRESENT a quote, not surfaces that question
it or photograph it.

### Two questions the plan left open, carried here rather than lost

- **On a saying, does the note draw above or below the translation?** The note is where a
  romanisation now lives, since the transliteration column went in 0072.
- **Does an expanded state persist per quote, or reset when the card leaves the screen?**
  The current fold does not persist, so resetting is the smaller change; persisting is
  friendlier and is another thing to store per reader.

Neither blocks anything and both are the owner's to answer.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
