# ADR-0102: A card's full-state save must carry every column the row has, and the comment saying so was not enough

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.3.0

**Decided.** `annotationState`, `dialogueState` and `utteranceState` each carry every field their kind stores, and `test/pure/full-state-put.test.js` holds the list and fails when the API grows a column that does not reach it.

**Why.** Every PUT in this app is full-state, so a field missing from the object a card saves is a field that request *clears*. `utteranceState` has carried a comment reading "AND THIS IS A SILENT-LOSS SITE" since 0035 and has been correct ever since. `annotationState` did not carry `character` from the release that added the column until this one, so hearting a highlight, recolouring it, dragging its sticker or touching it from the selection bar silently threw away who said the line; `dialogueState` lost an episode's title and a game line's act and quest the same way. Every one of those saves answered 200, and the field each dropped was one the card had no box for — so there was nothing to see.

**The difference between the kind that was right and the two that were wrong is that somebody wrote the sentence down on one of them.** A comment is enforced by whoever reads it. So the sentence is now a test, and it is a hand-kept list rather than introspection on purpose: the server's shape is the authority and a browser test cannot ask it, which means adding a column and not arriving here IS the failure, and the next person to add one has to come and argue with the file.

**Instead of** deriving the body from the row the client already holds (`{...row}` minus the read-only keys), which is the tempting fix and is worse: it would ship whatever the server last sent, including fields the API does not accept on a write, and it would hide the moment a client and a server disagree about what a quote is.

**Approved.** Mine. Found while adding `translation` to the same two functions — the new field would have gone the same way as `character` had the list not been written first.

<sub>2.3.0 — `web/frontend/test/pure/full-state-put.test.js` · `web/frontend/src/Library.jsx` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
