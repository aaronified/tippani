# ADR-0564: A proverb wears its language where every other quote wears a face

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** A standalone quote with a language and no speaker leads its meta line with a **language mark** — the reader's own if they set one, else a letter from that language's script, else nothing at all.

**Flags are offered and not assumed.** The ask was "use flags for languages", and the tray offers twenty-four of them first. What the app does not ship is a *mapping*. A flag is a country and a language is not: Bengali is spoken either side of a border, Hindi has no flag of its own, and Spanish, Portuguese, Arabic and English have a dozen each with nothing to choose between them. A default here would be this app telling somebody which country owns their mother tongue. A test asserts no starter language arrives wearing a flag, because a table like that is exactly what somebody fills in later out of tidiness.

**Instead of** leaving the slot empty, which is what it was. Every other quote card begins with somebody's portrait; a proverb — which is close to *the* kind with nobody to credit — began with nothing.

**Stored as JSON in a string**, for the reason `creditSeparators` is a token string: prefs is a flat comparable struct compared with `!=` in `ui_test.go`, so a map field would not compile. Names fold on the way in, keys sort so the blob is stable, and an empty mark is dropped rather than stored — the absence IS the default.

**Approved.** The reader's, in the form "use flags for languages (replacement for people chips for proverbs). let the user change them if needed as well." The second half is the mechanism rather than an escape hatch.

<sub>1.15.0 — `web/frontend/src/languages.jsx` · `internal/httpapi/language_marks.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
