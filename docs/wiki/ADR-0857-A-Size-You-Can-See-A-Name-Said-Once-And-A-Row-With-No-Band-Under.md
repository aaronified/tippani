# ADR-0857: A size you can see, a name said once, and a row with no band under it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Three misses the owner found by looking at one screenshot, after a session of my own
captures had passed over them.

**THE SLIDERS SHOWED A NUMBER AND NOTHING ELSE.** The pack's two cover sliders carry
`spec: 'book'` and `spec: 'poster'` and draw three works beside the handle at the size the
handle is set to, the type scaling with the cover (`settings-restructured.dc.html:2886-2913`).
This drew a range input and "165px". *"Where are the sample cover pictures? If i need to
tell you everything, why have i made the prototype???"* It was in this branch's own
divergence audit as a major finding, and I neither built it nor raised it — which is the
failure worth recording, not the missing control.

**AND THERE WAS NO ARTWORK TO FIND.** A reader sent to look for sample covers finds none:
the pack's cells are the material tile tinted, plus one hatched cell for a work with no
cover, and this app already has both — `Placeholder` and its `.ph` class are the same
hatch the pack defines inline. So the specimen draws the reader's OWN first three works,
which answers the question better than an invented shelf: a cover you recognise at 96px
tells you something a stranger's cannot.

**THE TITLE IS CLAMPED, AND THE RATCHET MADE ME SAY WHY.** One real book ran eleven lines
and pushed the poster slider off the screen. `clamp-has-a-way-out` does not forbid a clamp;
it refuses one that does not say how a reader gets the text back. The answer here is that
the title is not the subject — the specimen exists to show a size — and the Library prints
the whole title at the size this slider just set.

**"ADMIN" WAS A PAGE HEADER WITH ITS HEADING HIDDEN.** The rule that removed this header
from phones rested on "the desktop shell has no top bar of its own to double". That stopped
being true: the desktop bar carries a breadcrumb whose leaf is the screen's name
(`App.jsx:855`). So on a desk the header was naming Settings twice, and since its `<h1>` is
hidden, all that showed was the role label. Settings alone loses it, because the pack
settles Settings and nothing else; the same argument plainly applies to Metadata, Stats and
Bin and is not this change's to make.

**THE TAB BAND CAME FROM STICKINESS.** The row was sticky at 900px and up, which forces a
fill — content has to pass behind it — and the fill was `var(--bg)`: a flat token over a
page whose ground is a texture, so the row read as a pale foreign panel. The pack's row is
neither sticky nor filled. Painting the texture behind a sticky row would mean a second
copy of the ground's tile, size and blend mode, and a second copy of the ground is what
goes wrong the day the ground changes. Not sticking costs one scroll back to the tabs.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/index.css`,
`web/frontend/test/rules/clamp-has-a-way-out.test.js`,
`web/frontend/test/dom/no-second-topbar.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
