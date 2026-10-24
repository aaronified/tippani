# ADR-0159: Name fields capitalise in the input, promote-only, and yield on a case edit

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 1.7.8

**Decided.** Every field holding a name or a title — Title, Author, Director/Creator, Series/Collection, Character, Actor, Speaker, the person rename box, the account display name — capitalises the first letter of each word **as you type**, via `capitalizeNames` + `useNameCasing` in `ui.jsx`. Three rules make it safe:

1. **The transform is on the input, never on the save path.** What the field shows is the string that gets saved. A capitaliser that ran at save time would pass its own tests while the form said "agatha" and the database held "Agatha".
2. **Promote only; never lower-case anything typed.** A word that already carries a capital anywhere is left alone entirely.
3. **It yields.** The first change that alters nothing but letter case flips the field to `free`, and it is never transformed again for the rest of that edit.

Word boundaries are whitespace and nothing else. Opt-in per field: `nameCase` on `Field` / `InlineField` / `TokenInput`, or the `NameInput` twin for forms that lay out their own inputs. Description, quote, ISBN, ASIN and the supplier ids do not get it.

**Why.** Rule 2 is the whole design. `titleCaseGenre` already existed and title-cases each word by lower-casing everything after the first letter, which is right for a genre — a word from a small closed vocabulary — and destructive for a name. Reusing it would return "McDonald" as "Mcdonald", "O'Brien" as "O'brien" and "Ian McEwan" as "Ian Mcewan". Combined with rule 1 that is not a display quirk, it is data loss on save. The "already has a capital → leave it" clause falls out of the same reasoning and pays for itself twice, keeping "eBay" and "iRobot" and giving a discoverable escape hatch: put a capital anywhere and the word is yours.

Rule 3 exists because an as-you-type capitaliser is otherwise an unappealable one. "bell hooks", "danah boyd" and "k.d. lang" are names, and a field that re-capitalises on every keystroke makes them unenterable. A change whose letters are identical and whose case is not can only be a deliberate re-casing, so that is the signal to stand down.

**Instead of** capitalising on blur, or on save. Blur was rejected because the change then happens away from the cursor, and re-editing re-applies it — the same unappealable behaviour with worse feedback. On-save was rejected outright: it breaks rule 1, and the divergence between the form and the database is invisible until an export or a group-by heading disagrees.

**Instead of** hyphen and apostrophe word boundaries. Promoting after a hyphen fixes "jean-luc" and breaks "e-mail"; after an apostrophe it fixes "o'brien" and produces "Schindler'S List". With titles in scope both trades lose, so the narrow rule promotes what it is sure of and leaves the rest to be typed.

**Approved.** Mine. I chose the scope — names *and* titles, not names alone — knowing titles are the riskier half, which is why the promote-only rule and the yield had to come with it rather than after it.

<sub>1.7.8 — `web/frontend/src/ui.jsx` · `web/frontend/test/rules/name-casing.test.js` · `web/frontend/test/dom/name-casing-field.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
