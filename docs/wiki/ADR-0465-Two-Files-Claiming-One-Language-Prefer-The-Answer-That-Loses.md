# ADR-0465: Two files claiming one language: prefer the answer that loses nothing

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 2.1.3

**Decided.** There is no list of accepted languages and there will not be one — the code is the file name, and any lower-case `[a-z0-9-]` string is a code (§4). Collisions are therefore possible in two different places, and both resolve without refusing anybody's file.

**Same CODE.** `FR.txt` and `fr.txt` both normalise to `fr`. Windows and macOS refuse the second file themselves; on Linux both exist, both parse, and one used to vanish into a map assignment with nothing said — so the reader edits the file that lost and watches the app ignore every change they make. The app is not broken; their work simply has no effect, which is close to the worst shape a bug can take. `dedupeByCode` now prefers the exact lower-case spelling, falls back to the directory's sorted order, and logs `TIP-LOCALE-001` naming the winner and every loser. The losing file is read past, never touched.

**Same `_name`.** Two codes may legitimately claim one display name: a dialect that has not renamed itself (`fr` and `fr-ca` both "Français"), a fork of a translation, or the same file copied under a second code while it is being worked on. The picker appends the code — "Français (fr)" — comparing case- and space-insensitively, because "Français" and "français " are the same claim and the person who typed the second cannot see the difference either.

**Instead of** refusing the second file, which was the other reading of "the name must be unique". It would delete somebody's translation from the app over a naming collision they could only diagnose from a log they have no reason to read. And instead of validating codes against BCP-47: a closed list is exactly what §4 exists to avoid, since the languages this feature is *for* are the ones nobody thought to list.

**A file that forgot `_name` is deliberately not dressed up** as "fr (fr)". `localeName` already reports that omission by showing the bare code; saying it twice reads as a different fault from the one there is.

**Approved.** The reader's, from the question — *"is there any list which specifies what will constitute which language? i would suggest having a language name param in the template. which must always be unique. if duplicated results are found, we will have to handle them as well."*

<sub>2.1.3 — `internal/i18n/i18n.go` · `web/frontend/src/i18n.js` · `internal/olog/codes.go` · `docs/wiki/Troubleshooting.md`</sub>

<sub>2.1.0 → 2.1.1 (reversal) — `internal/i18n/i18n.go` · `internal/i18n/en.txt` · `internal/i18n/bn.txt` · `internal/i18n/README.md` · `web/frontend/src/i18n.js` · `web/frontend/src/locale.jsx` · `internal/httpapi/locale_handlers.go` · `scripts/locale-template.mjs` · `web/frontend/test/pure/locale-resolve.test.js` · `web/frontend/test/rules/help-budget.test.js` · `web/frontend/test/rules/translated-not-sliced.test.js` · `docs/plans/multilingual.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
