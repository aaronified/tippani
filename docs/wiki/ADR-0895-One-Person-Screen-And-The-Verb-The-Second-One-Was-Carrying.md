# ADR-0895: One person screen, and the verb the second one was carrying

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Version:** v3.0.0

`PersonModal` is deleted — 639 lines, the app's second person screen, reached by kind and
name where the design pack's `personPanel` is reached by id. The route into it went a
release earlier: `usePersonOpener` sends every credit in the app to the pack's panel, and
`POST /people/ensure` files the row a hand-entered credit never had, so there was nothing
left for the modal to be first at.

**It survived that release as a fallback for two cases, and neither was a case.** The first
was a screen with no panel stack; all eight callers mount a `PanelHost`, so the branch was
unreachable. The second was an `ensure` that failed — and the answer to a server the app
could not reach was to open a 640-line surface whose own first act, on mount, was to ask
that server for the same person. A fallback that needs the thing that just failed is a
second way to render the same error, in a shape nobody has looked at since it was replaced.
The press now says what went wrong, in the server's own words where it gave any, and opens
nothing.

**AND ONE VERB WENT WITH IT, WHICH IS WHY THIS IS NOT ONLY A DELETION.** `DELETE
/people/{id}` had exactly one caller in the app and it was inside that modal. So the
earlier commit, which read as a routing change, had already taken the only way to delete
one person by hand — a person could be pruned in bulk and only once nothing credited them,
and that was all. The editing did NOT go the same way, and the difference is worth stating
because a first reading of the same evidence said it had: the panel writes every field the
modal wrote, through `PUT /people/id/{id}`, which a grep for `'PUT', '/people'` does not
find.

The verb is on the People console's row now, beside the character console's, which is the
repo's own directive deciding where rather than what — two lists of records, one shape, and
a delete on one and not the other is the pair disagreeing about what a record row is. It
bins the record, so its confirm promises a way back; its second sentence says what a
person's deletion does NOT take, because "delete" over a credit reads as unwriting them
from twelve works and it does not.

**A TEST THAT WAS REWRITTEN RATHER THAN PORTED FOUND A LIVE BUG.**
`image-search-strip.test.jsx` drove `POST /images/search` through the modal's edit form.
Rewritten against the panel, it failed — and not for the rewrite's own reasons. The strip
that draws the candidates lives inside `pictureEditor`, which is gated on the Paste-URL box
being open. That was right while the only way to reach `findPicture` was the inline link
drawn inside that same block. The pack's named verb row put a second way in: `Fetch` sits
beside the portrait, outside the block, so it sent the request, set `pics`, and rendered
into a container nothing was drawing. Three surfaces — the person panel and both character
sheets — and it matches a report already quoted in that file: *"character pages silently
fail the fetch images."* The find opens what shows the finding. Mutation-verified: comment
out the one line and two cases go red.

**What was deleted rather than rewritten, and why that loses nothing.**
`person-modal-icons.test.jsx` asserted a glyph on every control of the deleted screen;
every control it named is gone. Its two link-naming cases are the only part with a subject
that outlived it, and that subject is held twice over already — `test/pure/link-names.test.js`
on the parser and `identity-panel.test.jsx` on the surface that draws them.

<sub>v3.0.0 — `web/frontend/src/people.jsx` · `web/frontend/src/personOpen.jsx` ·
`web/frontend/src/cast.jsx` · `web/frontend/src/MetadataPage.jsx` ·
`web/frontend/test/dom/person-router.test.jsx` · `web/frontend/test/dom/image-search-strip.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
