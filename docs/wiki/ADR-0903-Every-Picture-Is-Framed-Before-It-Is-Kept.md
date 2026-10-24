# ADR-0903: Every picture is framed before it is kept

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A person or a character is drawn in a circle, a cover or a poster at 2:3, a board's picture at
3:2, and a picture of another shape was centre-cropped by `object-fit: cover` with nothing on
screen to say so. `useFraming` (`FrameEditor.jsx`) is the one flow for every place a picture is
kept — covers, posters, people, characters, the profile photo, a board — and `frames.js` is the
arithmetic and the three frames. The circle is stored as its square and clipped by the screen
that draws it, so the editor dims what the circle will cut rather than cutting it.

**In the browser, not on the server.** The page's `img-src` does not name the host of a
picture picked from a search, and a remote image taints a canvas, so a server-side crop could
not be previewed and would have to ride on each of six store routes. A picture that is only an
address is fetched by `POST /images/preview` (through `fetchUserImage`, the path a pasted
address always took) and returned as a `data:` URL, which draws and does not taint; nothing is
stored, so looking at pictures that are then not used leaves no files. What the reader keeps goes
up by the screen's own upload route, which also removes the file it replaces.

**Framed before the screen hears of it.** The first build announced a chosen cover to its screen
and then opened the frame. On a work's own panel that announcement is an immediate save, so the
unframed original was stored first, backing out kept it, and the save raced the framed upload. A
choice is now framed, or found to fit, before `onSetUrl` is called; a picture that cannot be
fetched for the frame goes by its address as before, on a cover and on a face alike.

**Costs accepted.** A framed picture is written at the pixels its source has, never above the frame's own width (a thumbnail is not scaled up to look like a cover, so the size warnings stay honest), as a re-encoded JPEG (quality 0.92), and is the reader's own,
so its supplier credit becomes "yours"; Reframe starts from the stored crop because the original
is gone, so "show it all" cannot recover what an earlier crop removed. Reframing a picture and
leaving it unmoved keeps nothing, so neither cost is paid for no change.

**Where it does not reach, and why.** Pictures the app fetches by itself and the reader chooses nothing about: the person lookup that fills a portrait, catalogue adoption of a cover; both have Reframe afterwards. Stickers and signatures have no fixed frame. A cast-list row gets the flow on a picture chosen from its strip or pasted (it has no Upload verb of its own, and keeps a framed one by the route the identity sheet already used for that row).

**One difference that is the screen's and not the flow's.** On the Library and Movies edit forms a picture that fits is staged for the form's Save, while one that needed framing is uploaded as soon as it is kept, because the upload route is immediate (a file chosen from disk has always behaved so). Cancelling the form does not undo the second.

**Rejected.** Cropping on the server (above). Storing a fetched picture first and framing the
stored copy: backing out then left the unframed picture in place on faces while covers kept
nothing, which is two behaviours for one gesture. A dialog the sheet could drag: a press on the
picture is a move, so the stage opts out of the sheet's drag (`data-no-sheet-drag`).

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
