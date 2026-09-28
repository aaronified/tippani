# Read quotes aloud (issue #12, "Audio review, in the browser only")

Not built. Verified against `75e55ae` (main, 28 September 2026; its code is `ee4be1f`'s). Each
citation is `path:line` and the text at that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- web/frontend/src internal/httpapi/auth_handlers.go internal/httpapi/font_scopes.go docs/data/features.json`,
      then `git grep -n` each quoted anchor below. Nothing here waits on 3.1.0, so there is
      no in-flight item to re-check.
- [ ] Read a quote aloud with the browser's own speech (Web Speech API, `speechSynthesis`),
      with no service and no download. Nothing under `web/frontend/src` uses it yet.
- [ ] A play/stop control on every quote card and on a quote's detail, drawn with the app's
      own glyph. The cards are two components: `Library.jsx:1097`
      `export function AnnotationCard({` (books, and standalone quotes on `Quotes.jsx:1092` `<AnnotationCard`)
      and `Movies.jsx:1785` `export function Frame({` (screen lines), each with its
      `ActionRow` (`actions.jsx:337` `export function ActionRow({`); plus Home's
      `Home.jsx:1602` `export function SerendipityCard({`, Home's favourites board
      (`Home.jsx:1027` `export function FavouriteTile({`, whose actions are
      `Home.jsx:1328` `<QuoteTools actions={atRow(acts)} />`, not an `ActionRow`), and an
      anthology's passage, `anthologies.jsx:1247` `function AnthologyEntry({`, which is not a
      card component. The table views of dialogues and highlights are lists for editing, not
      cards, and get no control.
- [ ] Speak in the quote's own language, from its language tag, falling back to the interface
      language (`i18n.js:651` `export const localeActive = () => active`).
- [ ] Let the reader choose a voice per language from the voices the device has, stored with
      their preferences.
- [ ] Read a whole anthology or board in order, with next and stop: an anthology in its
      entries' order, a board in the order it shows its quotes (`Quotes.jsx:834`
      `function BoardQuotes({`).
- [ ] Hide the control where the browser has no speech voices, instead of showing a button
      that does nothing.

The owner's answers, 27 September, each a task:

- [ ] "A quote's detail" is the practise and review screens, where a quote is shown on its
      own (`review.jsx:150` `export function QuoteBlock({ card }) {`, inside `review.jsx:648`
      `export function QuizRunner({`). The control goes there and on every quote card.
- [ ] No speed control: the device's own speech settings apply.
- [ ] A run speaks each passage and then its attribution; an anthology's run also speaks the
      reader's note on each entry. A single card speaks only its text.

Decided while planning, so the build needs nothing further:

- [ ] A quote's language is free text, "deliberately not an ISO code yet"
      (`0071_language_everywhere_and_dlc.sql:19`
      `` -- FREE TEXT, exactly as `utterances.language` is, and deliberately not an ISO ``).
      Speech needs a language tag, and `iso639.js` already resolves a name, a code or an
      autonym to one (`iso639.js:223` `export function languageFor(value) {`); a language
      it does not know falls back to the interface's.
- [ ] An anthology's run opens with its intro, the reader's own words before the first
      passage, then speaks each entry in the order the page draws it: the note first, as the
      page puts it above the passage (`anthologies.jsx:1258`
      `{!fields.hide_commentary && entry.note && <p className="anthology-prose">{entry.note}</p>}`),
      then the passage, then its attribution. What the anthology's switches hide is not
      spoken: no note under `hide_commentary`, no credit or source under their switches
      (`anthologies.jsx:1276` `{(!fields.hide_credit || !fields.hide_source) && (`).
- [ ] A run's controls: **Read aloud** in the anthology's and the board's header starts it;
      while it plays, the playing entry wears next and stop. All three are `.no-print`.
- [ ] On the practise and review screens the control reads what the card shows as its
      question. A cloze blank (`review.jsx:120` `const CLOZE_BLANK = '￼'`) is a short pause,
      never a word. The card's note is not read: a single card speaks only its text.
- [ ] One player for the whole app: starting one quote stops any other, and the playing
      control shows stop.
- [ ] Two new glyphs, play and stop, drawn like the other `Icon*`. None exists: the one
      picture with a play triangle in it is the watching glyph, a screen with a triangle on it
      (`ui.jsx:10104` `export function IconWatching({`), which means a show. The new play
      may not resemble it, the game glyph (`ui.jsx:10595` `export function IconPlaying({`)
      or the speaker role (`ui.jsx:10314` `export function IconRoleSpeaker({`).
- [ ] Voices can arrive after load (`voiceschanged`), so the control appears when the first
      voice does instead of being decided once.
- [ ] The voice choice is one preference, `voicesByLanguage`, built the way
      `fontsByLanguage` is: a JSON string in the stored preferences (`auth_handlers.go:485`
      `` FontsByLanguage string `json:"fontsByLanguage"` ``), cleaned when read back
      (`auth_handlers.go:961` `if norm, ok := normalizeFontsByLanguage(p.FontsByLanguage); ok {`),
      capped in size (`font_scopes.go:41` `fontsByLanguageMax = 64`), and a field of the
      update (`auth_handlers.go:1031` `var in struct {`). It maps the language code
      `languageFor` answers to the device's voice name, and joins the Language section's
      reset list.
- [ ] `iso639.js`'s header says it has one importer (`iso639.js:40`
      `` // It is a leaf: no imports at all, and ONE importer — `languages.jsx`, which reads ``);
      the player makes that two, and the header says so in the same change.
- [ ] Nothing speaks on its own: speech starts from a press.
- [ ] Keys in `en.txt` and `bn.txt` together.
- [ ] Tests: a journey cannot hear, so it stands in for `speechSynthesis` in the page and
      asserts what was asked to be spoken, in which language, in what order, and that stop
      stops it; the file's header declares that exception. Each journey mutation-checked,
      the mutation named in the commit.
- [ ] The roadmap card for issue 12 still says "a quote's detail" (`features.json:443`
      `"  the plan (<code>docs/plans/read-aloud.md</code>) from the review card to every quote card and a",`);
      at build it names the practise and review screens instead.
