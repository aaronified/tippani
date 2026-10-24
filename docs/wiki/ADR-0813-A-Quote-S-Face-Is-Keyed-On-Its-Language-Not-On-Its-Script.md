# ADR-0813: A quote's face is keyed on its language, not on its script

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's spec, in full because both halves of it are one sentence: *"tippani is
meant to be highly translatable. You understand? So that means any language can become
the ui language. We ship with english and bengali… Any language that the user adds in
via translation files should have a full ui font picker (revamp the font picker in
settings for that). And then every language that the user adds via adding them in
metadata or via adding them in quotes (via the language field) should also get a font
picker for their quotes. Even when they use same script. I may want my german to have
serifs, but not english."*

**THE LAST SENTENCE IS WHY THIS COULD NOT BE DONE BY ADDING ROLES.** Every type key a
card has ever carried is a SCRIPT — `.bengali` and `.devanagari`, the two roles with a
`script` field — and German and English are one script. No arrangement of per-script
roles distinguishes them, so the model needed a rung it did not have rather than two
more rows.

**AND NEITHER SET IS CLOSED**, which is what makes both of them blobs rather than flat
fields. The UI languages are whatever is in `data/Locales` (design §4); the quote
languages are whatever a reader has typed into a free-text column. `prefs` is compared
with `!=` in `ui_test.go`, so a map field will not compile — the same constraint that
made `textOrder` a JSON string, and the same answer.

### Two tables, and where each one lives

`fontsByLanguage` is folded language name → face token, and its picker is a row in the
**language table**, not a new section of the Type card. That is `LanguageMarksSettings`'
own stated rule, which was written against exactly this temptation: *"A second table of
the same languages would be two lists to keep in step, and the first time somebody added
a language to one of them they would diverge."* A language's mark, its display name and
how much of the original it shows are already there; its face is the fourth thing about
it.

`fontsByLocale` is locale code → the roles that locale answers differently, and its
picker is a SCOPE above the six existing rows rather than six more rows per language. A
card that repeated itself per translation file would be unreadable by the third one. The
overlay is a PARTIAL by design: a role a locale says nothing about goes on following the
flat field, so an upgrade that changes a built-in face still reaches every locale with no
opinion about it.

### A generated stylesheet, and why not an inline style

Seven render sites across three components take a CLASS from `quoteTexts` and pass it
on. A family that arrived as a style would mean a new prop on all three and a merge at
all seven — and one of those seven quietly not doing it is the drift the repo's "one
function both call" directive exists to stop. So `applyFonts` writes one rule per
configured language into a single stylesheet, and the contract at every call site stays
one word.

THAT SHEET IS ADOPTED, NOT A `<style>` ELEMENT, and for a while it was an element and
did nothing (#43). The app's Content-Security-Policy names no `style-src`, so it falls
back to `default-src 'self'`, and the browser refuses the text of any `<style>` element
a script writes: the rules never applied, every quote kept the default face, and the
console logged the refusal on every load. Filling an empty `<style>` through
`insertRule` is refused the same way (measured in Chromium). A constructed sheet —
`new CSSStyleSheet()`, `replaceSync`, `document.adoptedStyleSheets` — is CSSOM rather
than markup, and `style-src` does not govern it (measured: it applies under the app's
own policy). `fonts.js` keeps the element as the fallback for a browser with no
constructable sheets, where the policy refuses it just as before.

Rejected: `style-src 'unsafe-inline'`, which reopens every injected `<style>` and
`style=""` to an attacker for the sake of one sheet the app writes itself; and a nonce,
which the server would have to mint per response and thread into a static SPA that has
no template to put it in. The screenshot harness's no-motion sheet had the same defect
and takes the same repair.

The class is a hash of the folded name and not the name itself: a language is free text
("বাংলা", "Français", "Ancient Greek (Attic)") and none of those is a CSS identifier.

### The picture, which has no stylesheet to read

The share image draws on a canvas, so the class was never going to reach it — and a
reader whose German is set in Literata on every card in the app, and in the display face
in the one picture that leaves the app, would have met the same quote in two typefaces.
`languageFamily` is the same answer as a CSS family name; `share.language` carries it,
and is the only field on the payload with no toggle and no label, because nothing is
drawn FROM it.

ONLY THE QUOTE, as on the card. The translation beside it is in whatever the reader
translated INTO and nothing stores that, so it keeps the display face — the same rule
`quoteTexts` follows when it tags the slot holding `a.quote` and leaves the other alone.
The ladder does not apply here either: the image's quote stack already carries the Indic
faces after the Latin one, so a Bengali quote with no chosen face draws exactly as it
did.

### Where this turned out to be wrong, once, and a test caught it

`applyQuoteFonts` resolved its token through `faceFor('display', token)`. A role always
has an answer — an unrecognised preference falls back to its built-in — which is correct
for "what is the display face" and silently wrong here: `tiro-bangla` is not in the
display role's list, so a reader who chose it for Bengali would have got **Newsreader**
on every Bengali quote, with the picker still showing the choice they made. `anyFace`
resolves against every face the app ships and returns null for one it cannot place,
which leaves the script rung to answer. The case that found it is
`language-fonts.test.jsx`'s "the reader can overrule that script face for one language".

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
