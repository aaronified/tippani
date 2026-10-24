# ADR-0758: The second count could only ever read one, and the hero picture stopped opening

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

Two of the three things the owner asked for before the week's rest. The third — teaching the
fandom and TVDB lookups to reach a character through a wiki page and through the performer —
is not built and is not started; nothing here should be read as covering it.

**THE SECOND COUNT WAS A COUNT OF ONE THING, AND THAT THING WAS THE EMPTY STRING.** The
owner: *"the 3 quotes, 1 scene is not working. rather do 3 quotes, 1 favourited. for all.
people, character, details, all pages those two boxes are."* The figure was
`COUNT(DISTINCT COALESCE(<locator>, ''))` — distinct scenes for a film, chapters for a book,
quests for a game — and the `COALESCE` is the defect. On a library where nobody fills
timestamps every one of a character's lines folds to the same blank value, so the box read
"1 scene" for a character with three lines and for one with thirty. It was not
approximately right; it was a constant wearing a number's clothes.

**AND A ZERO HAD TO BE WRITTEN BACK BY HAND, which was the tell.** `whosCharacters` carried
`if c.Quotes == 0 { c.Locators = 0 }`, because the LEFT JOIN yields one null row for a cast
member with no lines and `COALESCE(null, '')` counted it as one place they do not speak
from. A `SUM(COALESCE(favorite, 0))` over that same null row is zero on its own, so the
fixup is gone rather than ported.

**WHY A FAVOURITE AND NOT A BETTER LOCATOR COUNT.** Dropping the `COALESCE` would have made
the number honest — distinct scenes among the lines that name one — and left the box blank
on exactly the libraries that have the most quotes in them, which is the wrong half of the
problem to solve. A favourite is a fact the reader put there themselves: it moves when they
do something, it means the same word on every medium, and the pair is then two different
questions ("how much of this character have you kept" and "how much of it did you love")
rather than one asked twice.

**ONE BOX, THREE SCREENS, AND THAT IS WHY THE SWAP IS ONE LINE.** The owner scoped it
"everywhere it exists", and `PairRow` is drawn from exactly one place — the local sheet,
which is what the character screen, the people screen and a work's detail page all open. The
repo's own directive is why that was already true.

**THE CLIENT WENT ON READING THE OLD NAME AND NOTHING FAILED.** `identity.jsx` mapped
`row.locators` into the sheet's counts after the server had stopped sending it; both halves
compiled, 3,756 tests stayed green, and every sheet would have printed a favourite count of
zero. Renaming a field on one side of a JSON boundary is not a change a type system or a
suite of unit tests can see, so `identity-scope.test.js` now reads the Go struct's json tags
and the panel's own `row.<field>` reads and compares the two sets. That guard replaces the
locator-noun derivation it sat beside, and it fails on precisely this mistake.

**THE HERO PICTURE OPENED FULL SCREEN AND THEN DID NOT.** The owner: *"the people/detail
screen hero picture (the one at the top) should be clickable and show the picture in full
screen (this behaviour was there in the old picture screen)."* `people.jsx` has carried its
own viewer since before `PortraitBlock` existed; three sheets lost the behaviour when they
moved onto the shared block. It is in the block now, which is the only place that stops a
fourth losing it.

**THE VIEWER TAKES THE ADDRESS, NOT THE PATH.** `Lightbox` built its own URL from a stored
path (`coverImgURL(path)`), and this block is handed an address that is already resolved —
so it gained a `src` alongside `path` rather than the caller un-resolving what it has.

**THE PRESS IS A SIBLING OF THE PICTURE AND NOT ITS PARENT, and this is the departure worth
recording.** The obvious shape is a wrapper: `<button>{face}</button>` where there is a
picture, a bare `{face}` where there is not. That makes the two cases two positions in the
React tree, so the moment a picture FAILS and the button is retired the face lands somewhere
else, remounts, forgets that it failed, and asks the server for the same missing file again.
As an absolutely-positioned hit area over the face's circle the face never moves and its own
judgement survives. The cost is one span and six lines of CSS; the alternative was a
component that bounces on the one input it is most likely to get.

**AND A STORED PATH IS NOT A PICTURE.** The button is gated on the file having ARRIVED, not
on a path being stored — a silhouette means "a person, unphotographed", and a press on one
opens a viewer onto a torn-page mark.

**WHICH IS THE SAME REPAIR AS `ebea143d`, ON THE SCREEN THAT INHERITED THE DEFECT INSTEAD OF
THE FIX.** An earlier version of this paragraph said `Face` "had no way to say so" and that
this diff gave it one. It had one: `onBroken` has been a `Face` prop since that commit —
whose subject is *"a picture that never arrived leaves nothing to zoom"* — and `people.jsx`
has passed it ever since, which is why the OLD picture page retires its own control on a
failure (`person.image_path && !gone`). What was missing is that `PortraitBlock` never
called it, so the three sheets that moved onto the shared block inherited the defect the old
page had already had fixed. That is the second time in this entry that "the shared block did
not carry what the screen it replaced had" is the whole story, and it is the argument for
putting the viewer here rather than on three screens.

A failure while the viewer is up takes the viewer down with it, which is new.

<sub>Unreleased — `internal/httpapi/whos_in_it.go` · `whos_in_it_test.go` ·
`web/frontend/src/identity.jsx` · `identityLocal.jsx` · `identityScope.js` ·
`characterRows.jsx` · `ui.jsx` · `index.css` · `internal/i18n/en.txt` · `bn.txt` ·
`test/dom/portrait-zoom.test.jsx` · `test/rules/identity-scope.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
