# ADR-0733: The speaker reaches the card, and the half of the backfill that is missing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*handoff §1.5, and the first of the three gaps the sweep above named: "quote.speakerId →
a character of that work, rendered as a person chip that opens that character."*

- **The storage was right for three migrations and no handler serialised it.** 0056 gave
  `annotations` and `dialogues` a `speaker_cast_id`; `SyncQuoteCast` writes it on every
  quote save and `LinkWorkQuotesToCast` fills a whole work in when its cast is read. A
  grep for the column across `web/frontend/src` returned nothing at all. So the app could
  answer "which lines are this character's" from the character's own page and could not
  put a name on the line.
- **WHO SAID IT IS NOT WHO IS NAMED ON IT**, and the two had to stay apart rather than be
  unified. `character` is text, split on the reader's separators, and answers "who is in
  this line"; `speaker_cast_id` is one stored link and answers "who spoke it". A line can
  name a room and be spoken by one of them. The parity test's allowlist now carries both
  with that argument written into it.
- **REJECTED: deriving the chip from `character_images`**, which already resolves a
  line's character text to cast rows and would have needed no backfill at all. It answers
  the wrong question, and it re-resolves by folded NAME on every read — so after a
  character merge it silently points somewhere else, where the stored link follows the
  surviving row.
- **The chip is `PersonChip`, unchanged**, with two optional props: `onPress`, because a
  character is opened by id and a person by name, and `faceName`, because the pack says
  hash the canonical name and print the billing. A second chip would have duplicated the
  CSS and moved the glossary's component count for no new drawing.
- **Three states draw no chip, and each is real**: no link (an old line, or one the
  linker refused to guess at), no `character_id` (a cast row nothing has linked to a
  record — no page to open, so a chip would be a dead control), and no opener (Home,
  Search and the standalone board render the same card and own no panel stack). In all
  three the card prints the character text exactly as it did before.
- **THE BACKFILL IS HALF A SOLUTION AND THE FILE SAYS SO.** `3.1.0-quote-cast` links
  quotes to cast rows; it does not create them, because adoption — "every character this
  work's quotes name is one of its people" — is an httpapi method on the cast list
  endpoint and a store-level pass cannot reach it. A provider-fetched film has rows from
  the fetch and gets its chips; a book, or a film typed in by hand, has none until its
  People panel is opened once. Reimplementing adoption inside the pass is what
  3.1.0-quote-person's header forbids in as many words, so the gap is PINNED by a test
  that says what to delete when adoption moves into `internal/store`. That move is the
  next piece of this work.

<sub>Unreleased — `internal/httpapi/quote_speaker.go` · `annotation_handlers.go` ·
`dialogue_handlers.go` · `quote_parity_test.go` · `internal/store/quote_cast.go` ·
`onetime_3_1_0_quote_cast.go` · `web/frontend/src/people.jsx` · `WorkDetail.jsx` ·
`Library.jsx` · `Movies.jsx` · `internal/i18n/{en,bn}.txt` ·
`test/dom/quote-speaker-chip.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
