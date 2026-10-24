# ADR-0643: A locator box offers what the work already knows, and the work is asked rather than the library

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.17.0

**Decided.** `GET /books/{id}/chapters` returns the (number, name, count) triples this book's own highlights already carry, commonest first. `useWorkSuggestions` (suggest.jsx) is the one place that fetches it and a work's cast, and both the capture surface and the highlight editor read it. The chapter-name box fills an EMPTY chapter-number box from the pair; nothing else is ever auto-filled.

**Why per work rather than in /search/vocabulary.** The vocabulary endpoint is deliberately the reader's whole library, because that is what the search box narrows over. A chapter name is not that kind of word — "The Whale" belongs to one book — and offering every chapter title in the library while typing a locator for THIS one would be a dropdown that is wrong more often than right. The cast is the same argument: a character belongs to a work.

**Why an endpoint rather than reading /annotations?book_id=N.** That was the first draft and it works: the chapter columns are already in the payload. It also fetches every quote in the book — text, tags, sticker coordinates, review state — to offer a dozen strings on a form whose whole point is being quick.

**Why the number is filled from the name and never the reverse.** Filling a name from "42" is guessing what somebody meant; filling 42 from a name they themselves typed against those exact words is repeating them. And it fills only an EMPTY box — a suggestion that overwrites what you have just typed is the form arguing with you, which is the one thing an autofill must never do.

**Native datalists, not a fourth dropdown.** This app already has three list controls and none of them fits: these fields are free text, the list is a memory aid rather than a vocabulary, and the browser's own control filters as you type, does not steal a phone's keyboard, and never prevents typing something absent from the list.

**What this was: a sweep-check failure.** The cast has offered a film line's character since it was a blob of provider JSON, and the same field on the same work offered nothing two screens away. One rule, some of the places that need it — which is the recurring defect class this repo already has a skill for.

<sub>1.17.0 — `internal/httpapi/chapters_handler.go` · `web/frontend/src/suggest.jsx` · `web/frontend/src/AddSurface.jsx` · `web/frontend/src/Library.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
