# ADR-0558: Six type ROLES, three faces each, and every one bundled

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Settings → Type lists the six jobs type does here — quotes, interface, labels, notes, Bengali, Devanagari — each with the built-in and two alternates, and each row **shown doing its own job** rather than setting a specimen sentence.

**Why roles rather than fonts.** A role is what the font is FOR, so swapping one is a line in `fonts.js` and not a search for every place a family name was written down. It is also the only way the picker can say anything useful: a list that sets "the quick brown fox" in every face answers no question anybody has, and it cannot show the Bengali row at all, whose whole point is a script no specimen sentence contains.

**Bundled, not fetched, and the cost is stated.** This app's browser talks to nobody but its own server, and a type picker that loaded Google Fonts would be the first thing in it that did — on a screen about how your own words look. `web/dist` goes from 3.4 MB to 7.2 MB. What grows is the image on disk, not what a browser downloads: `@fontsource` splits every face by `unicode-range`, so a subset is fetched only when a codepoint in its range is drawn. All eighteen families are OFL-1.1.

**An unrecognised token falls back to the built-in, never to nothing.** A preference that fails to resolve must not leave the app with no font: that is indistinguishable from a broken stylesheet, and it is silent.

**Approved.** The reader's, in the form "build a settings where users can customise every font used in the app".

<sub>1.15.0 — `web/frontend/src/fonts.js` · `web/frontend/src/Settings.jsx` · `web/frontend/src/main.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
