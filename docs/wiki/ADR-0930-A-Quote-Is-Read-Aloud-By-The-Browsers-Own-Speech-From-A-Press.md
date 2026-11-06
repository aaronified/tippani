# ADR-0930: A quote is read aloud by the browser's own speech, from a press

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0013](ADR-0013-Server-Side-Text-To-Speech-Refused-The-Browser-S-Own.md), and the read-aloud plan, whose page is retired by this entry (git holds it)

**What was decided.** A quote is read aloud with `speechSynthesis`, which is the device's. There is no service, no download and no stored
audio. Nothing speaks on its own: speech starts from a press, and there is no speed control, because the device's own speech settings
apply. Where the device has no voices the controls are not drawn at all. Voices can arrive after load, so the controls appear on
`voiceschanged` rather than being decided once.

**One player.** `speech.js` holds the one queue of segments for the whole app. Starting any passage cancels whatever else was playing, so
two cards never talk over each other, and the control that is playing shows stop. A press on the playing passage stops it. A segment is
text with a language tag, or a pause; a cloze blank is a pause, never a word.

**A card speaks only its text,** in its own language. A quote's language is free text, so `iso639.js`'s `languageFor` resolves it to a tag,
and one it does not know falls back to the interface language. The control is in `ActionRow` (the book and screen cards), Home's
favourites and serendipity cards, an anthology's entry, and the practise and review screens' quote block. The table views of highlights
and dialogues are lists for editing and get none. Two glyphs, a ring with a triangle and a ring with a square, are not the watching glyph
(a screen with a triangle, which means a show).

**A run speaks more.** An anthology's header and a board's header have *Read aloud*. An anthology's run opens with its intro, then each
slot in the order the page draws it: a section's heading and text, and for an entry the reader's note first, then the passage, then its
credit and source. What the anthology's switches hide is not spoken. A board's run is each passage and then who and where, in the order
the board shows its quotes, group by group when grouped. While a run plays, the quote it is on wears next and stop; that is a `mark` on
each segment, so the page needs no second index of its own.

**Voices.** The reader's choice is one preference, `voicesByLanguage`, built as `fontsByLanguage` is: a JSON string in the stored
preferences, cleaned when read back, capped at 64 rows, and a field of the update. It maps a language code to the device's voice name.
**The name is not checked against anything**, because the same account is a phone and a laptop with different voices; a name this device
lacks falls back to the best voice for the language, and the row stays for the device that has it. It is chosen in the Language editor in
Metadata, beside the quote face, and it joins the Language section's reset list.

**What the plan got wrong or did not know.** The plan put the control on each card component. Both card components share `ActionRow`, so
one placement covers them, and `ActionRow` gained a `kind` prop because a book highlight and a screen line can have the same id. The plan
also left "the playing entry wears next and stop" to each page; the `mark` on a segment does it in one place.

**Tests.** A journey cannot hear, so `read-aloud.test.jsx` stands in for `speechSynthesis` and asserts what was asked to be spoken, in which
language, in what order, that one passage plays at a time, that Stop stops a run for good, and that nothing speaks before a press. That
file is the declared exception to "the network is the only fake". Mutation-checked: no cancel before a new passage starts, ignoring
`hide_commentary`, and a blank spoken as a word each fail a named case.
