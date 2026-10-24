# ADR-0858: A character row that counts faces

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE ROW STATED THREE FACTS AND NOT THE ONE THE TABLE IS FOR.** It carried the name, the
spelling the list sorts under, and how many works the character turned up in. The pack's row
carries something else: how many of those appearances have a FACE
(`docs/design/prototypes/metadata.dc.html:715-723`). A character wears a different face in
every work — the picture is stored against the cast row, not against the character, which is
the whole reason `work_cast.character_image_path` exists — so "three works, one of them with
a face" is the finding, and the console could not draw it because `GET /characters` sent the
works and said nothing about their pictures.

**THE FLAG IS ON THE APPEARANCE, NOT A COUNT ON THE ROW.** The count is derivable from the
refs and the refs are not derivable from the count, and a reader who wants to know WHICH work
is missing one is asking the more useful question. `has_face` therefore sits on every entry of
`works_in`.

**AND THE QUERY GROUPS RATHER THAN TAKING DISTINCT.** A character can be cast twice on one
work — a role and its voice — and those two rows can differ in whether a face was chosen.
`SELECT DISTINCT` over columns that now include the flag would return the work twice, once
each way, and the console would read two appearances where there is one. `MAX(CASE WHEN …)`
over the group answers what the row actually asks.

**THE NUMBER IS THE GAP, NOT THE TOTAL.** A library of sixty-nine characters is sixty-nine
rows saying "1"; the same sixty-nine saying nothing until a face is missing is a list you can
work down. The total moved into the sub-line, which is where the pack puts it, and a row says
a thing once. A character in NO work keeps its red zero: that is a different finding and the
only one this list can show at all.

**THE SORT NAME LEFT THE ROW.** It is on the record's own screen, one press under the name,
and it was holding the line the faces needed. A spelling used for ordering is not what anyone
scans a list of people for. `metadata.characters.sort.sub` is deleted rather than orphaned.

**THE SILHOUETTE IS THE PACK'S AND WAS ALREADY BUILT.** The row passed `fallback={null}`, so a
character with no picture drew an empty gap in a column of faces. `Face`'s default already is
the six hashed silhouettes; the row simply had to stop opting out.

**TWO VERBS, NOT THE PACK'S THREE.** It draws choose-faces, merge and delete. The name and the
portrait already open the record, and choosing a face per work IS that record's appearance
grid, so a third door to the same screen is the redundancy the repo's own directive names.
Merge and delete are the two acts the LIST could not reach — and the list is where the work
is, because the backfill makes a character record per work and de-duplicating eight Harrys
meant opening each of the eight. Both open the surfaces the record's screen opens:
`MergeSheet` is now exported rather than copied, because a merge started here has to mean what
a merge started there means.

**A LOOSE REGEX PASSED WITH THE COUNT DELETED.** The journey's last assertion allowed 400
characters between a row's sentence and its number, and the NEXT character's sentence supplied
a matching digit — so the mutation that removes the count outright came back green. Nothing
stands between a row's sub-line and its own count, so nothing may stand there in the assertion
either.

*Unreleased — `internal/httpapi/identity_handlers.go`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/src/identity.jsx`, `internal/httpapi/character_faces_test.go`,
`web/frontend/test/journeys/counting-the-faces-a-character-has.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
