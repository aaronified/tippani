# ADR-0902: A person's signature

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**The ask.** *"the signature feature needs a robust background removal and a fetch frm
wikidata."* Then, on the card: the bottom right corner, in the footer row the Tippani mark is
in, no taller than the row under the hairline. Both ways of fetching, the slot's own button
and the person's Fetch.

**The cleaner is the standard library and nothing else** (`internal/signature`). Lay the image
over white, so a transparent PNG's paper is not read as ink; greyscale; divide by a wide blur,
so a shadow across the page becomes even; threshold; keep the ink as soft-edged alpha, cropped.
A WebP cannot be decoded without an image module, and `go.mod` takes none, so a WebP is refused
with a sentence rather than stored uncleaned. An uploaded SVG is kept as it is, past the same
script check a sticker passes. **Otsu's own answer was wrong for this input.** The threshold
that maximises between-class variance ties at every level from the ink up when the paper is
one flat grey, and the first of them sits on the ink and keeps none of it. The cut is the
midpoint of the two class means at the best split. The slider moves it by 40 grey levels
either way, which is for the capture Otsu reads wrong and not a second guess.

**A preview and a save that share no state.** The reader sees the signature cleaned before
anything is kept, so there is a route that cleans and writes nothing. The save sends the same
file and strength again. The cleaner is deterministic, so what the preview showed is what is
stored. Rejected: parking the upload on the server between the two presses, which needs a
lifetime, a sweep and a limit, for the price of one re-upload from the reader's own machine.

**A file two readers share is named by its bytes, and that is what made the bin hard.** The
first sixteen hex digits of the SHA-256 of the cleaned PNG (sixteen, because the cover route
and the bin both match that name). Two readers holding the same signature, which is every
reader who fetches a famous one, hold one file. The rule that follows is that nothing deletes a
signature while a person row or a bin row names it, and that rule has three halves, not one.
Removal asks first. Binning a person parks the file only if no other person names it, and
lists it in the bin row either way, because that list is what makes the claim visible to
everybody else. Emptying a bin row **releases** it: without that, a file that stayed in the
cover store because someone else named it is named by nothing the moment they stop, and sits
there for good. Release only touches names the row's own payload says are signatures, because a
name in `files` in general may be a cover or portrait that other rows share. One lock covers
store-and-commit against check-and-delete, since a removal could otherwise look between another
reader's store and their commit and delete the file they are about to point at.

**Fetched, filled, and removed.** The author resolve reads Wikidata P109 in the same pass that
finds the portrait, because the Wikidata id is not stored and that is the only place it is
known. Commons serves the file resized, so a signature drawn as an SVG arrives as a PNG with
transparency. Only authors resolve through Wikidata, so an actor, director or studio has no
signature to fetch and the slot's button says so. The person's Fetch fills an empty slot and
nothing else, and a signature the reader removed stays removed: that is a flag on the row,
because without it the owner's "both routes" would put back every removal at the next Fetch.
The slot's own Fetch answers the raw raster and saves nothing, so the reader sees it cleaned at
a strength they chose and not at a default they never saw.

**On the card, a person and never a character.** The option is off by default, remembered per
device and hidden where nobody credited has a signature, and where the card is showing the
character, who signed nothing. It rides its credit's toggle as the faces do. It is filled in
the card's own ink with `source-in`, which keeps the signature's alpha and is Porter-Duff, so
one signature reads on every theme without a second drawing. It is scaled down to fit the room
the wordmark leaves and never up. The anthology gets a `signature` switch beside `portrait`, in
every list that names the portrait, carried as bytes by the EPUB.

**Where the plan fell short.** Each of these was checked against the plan's own text.
It expected the migration number to move, and said so ("taken at build"): 0081 landed in
between, so it is 0082, and 0081's ruling that every path records its source is why the
migration also carries `signature_source`, which the plan could not have listed. It said the
slot's own Fetch clears the removal flag; the save that follows does, because a lookup that
wrote nothing and was cancelled in the preview should not change what the person's Fetch does
next. It told the build to re-check whether the screens had moved onto the by-id fetch: the
People row's Fetch had and the details popup's had not, so both routes fill the slot and both
are tested. It said when a shared file may be deleted (when no person row and no bin row names
it) and not who deletes it once the last claim is a bin row being emptied: without that release
the file is named by nothing and stays for good. It did not say that the share card reads people
off `GET /people`, so `signature_path` had to be on every person row and not only the detail.
And it could not have seen that a second control named "Upload" on a person's page would make
an older journey refuse to press either one: the signature's verbs are "Upload signature" and
"Remove signature".

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
