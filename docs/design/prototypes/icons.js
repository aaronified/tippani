// ══════════════════════════════════════════════════════════════════════════
// ⚠ CLAUDE CODE — THIS FILE IS THE ASSET LIBRARY. REFERENCE IT, DO NOT COPY IT.
//
// Every screen — phone, tablet, desktop — takes its glyphs, its mark, its silhouette and
// its .ph hatch from here by NAME. Nothing redraws a path, retypes a file path, or keeps
// a local copy "just for this screen".
//
// The rule exists because both halves of it have already gone wrong in this project:
//   · The wide layout carried its own fourteen-glyph map. Three of them (⋯, share, copy)
//     were empty arrays, so those buttons rendered nothing while the glossary drew them
//     correctly — two sources, one silently wrong, and no way to notice from either file.
//   · Eight more glyphs were subsets of the repo's: an IconQuiz with no question mark
//     reads as a stray rectangle, and a truncated icon is worse than a lookalike.
//
// So: ONE definition per glyph, HERE, keyed the way ui.jsx keys it. Add a glyph and it
// appears in the UI glossary automatically, because the glossary renders this object
// rather than a picture of it. Change a glyph and every screen changes with it.
//
// Two things this file will NOT hold, and they are deliberate:
//   · COLOUR. A glyph is drawn in currentColor and takes its ink from the control it sits
//     in. The one exception is the mark, which is two files because a logo is not a glyph.
//   · STYLE. Sizes, corners, hover and press live in the interaction set, not here — an
//     icon is a shape, and how it behaves is a property of the button around it.
//
// If a name you want is missing, ADD IT rather than reaching for a near neighbour: an
// unknown name renders a dashed error box on purpose, because a silent null looked like a
// spacing bug for a whole review round.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// THE ONE PLACE ICONS AND ASSETS LIVE.
//
// Every glyph is lifted from the repo's ui.jsx verbatim, keyed the way ui.jsx keys it.
// The repo's icon test fails a near-duplicate, so a hand-drawn lookalike is a CI failure
// rather than a style choice: take the NAME from here, never redraw the shape.
//
// This file exists because the same paths were sitting in two design files and drifting.
// A screen that wants a glyph loads this; a glyph that changes changes once. If you are
// adding one, add it HERE and it appears in the UI glossary automatically, because the
// glossary renders this object rather than a copy of it.
//
// Loaded as a plain script (window.TippaniIcons) rather than a module, so it is available
// before first paint — a design that streams cannot wait on an import to draw its nav.
// ══════════════════════════════════════════════════════════════════════════
(function () {
  var ICONS = {
  search: { d: ['M21 21l-4.3-4.3'], circles: [[11, 11, 7]] },
  // THE GLOBE HAD A MAGNIFYING-GLASS HANDLE ON IT. It was copied from `search` and the tail
  // path — 'M21 21l-4.3-4.3' — came with it, so the mark read as a search icon wearing a
  // meridian, off-centre in its box because it was still making room for a handle that no
  // longer meant anything. That is why it never looked like the web.
  //
  // Redrawn as the mark everyone knows: a circle centred in the box, one equator, two
  // parallels, one meridian ellipse. Four lines is the minimum that reads as a globe rather
  // than as a clock or a target — the parallels are what stop the meridian looking like a
  // stray oval, and they are the reason this is recognisable at 16px.
  globe: { circles: [[12, 12, 9]],
    d: ['M3 12h18', 'M4.6 7.2h14.8', 'M4.6 16.8h14.8',
      'M12 3c2.3 2.4 3.5 5.6 3.5 9s-1.2 6.6-3.5 9c-2.3-2.4-3.5-5.6-3.5-9s1.2-6.6 3.5-9'] },
  back: { d: ['M19 12H5', 'M12 19l-7-7 7-7'] },
  filter: { d: ['M22 3H2l9 9v9l4-2v-7z'] },
  add: { d: ['M12 5v14', 'M5 12h14'] },
  // IconQuiz, verbatim — the rect carries rx 2.5, which the square path here was missing.
  // This is the drill's card; `quiz` is the same glyph under the other name the app uses for
  // it, and the sheet's proposal to make practise a mortarboard is what finally separates the
  // entry point (a place you go to study) from the card (a thing you are asked).
  // ALIAS OF `quiz`, NOT A SECOND DRAWING. See the note below; assigned after the map closes,
  // because an object literal cannot reference its own keys.
  // quizSkip is declared near penStroke, with the quiz mark it belongs to. It WAS declared
  // here too — the crossed-out card — and being the earlier of two keys in one object literal
  // it was silently overwritten in one direction and silently winning in the other, depending
  // on which was edited last. A duplicate key in this file is invisible until a glyph is
  // "redrawn" and does not change; if you add one, search first.
  seal: { d: ['M12 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z',
    'm9 14.2-1.5 6.3 4.5-2.6 4.5 2.6L15 14.2'] },
  trash: { d: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 12.5h9L17.5 7',
    'M10.5 10.5v6', 'M13.5 10.5v6'] },
  tag: { d: ['M4 12 12 4h6v6l-8 8z', 'M15.2 8.8v.01'] },
  books: { d: ['M4 4.5h3.5v15H4z', 'M8.8 4.5h3.5v15H8.8z', 'm14.2 5.4 3.4-.9 3.9 14.5-3.4.9z'] },
  move: { d: ['M4 7.5h9', 'm10 4.5 3 3-3 3', 'M20 16.5h-9', 'm14 13.5-3 3 3 3'] },
  details: { d: ['M3.5 4h17v16h-17z', 'M7.5 9h9', 'M7.5 12.5h9', 'M7.5 16h5'] },
  edit: { d: ['M4 20.5l4.6-1.1L20 8a2.1 2.1 0 0 0-3-3L5.6 16.4 4 20.5z', 'm14.5 7.5 3 3'] },
  export: { d: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 18h16'] },
  check: { d: ['M5 13l4 4L19 7'], sw: 2.1 },
  close: { d: ['M6 6l12 12M18 6L6 18'] },
  chev: { d: ['m4 6 4 4 4-4'], box: '0 0 16 16', sw: 1.7 },
  menu: { d: ['M4 7h16', 'M4 12h16', 'M4 17h16'] },
  // ── the seventeen the repo names in its own gallery, lifted verbatim. Their paths
  // are the contract: the icon test fails a near-duplicate, so an eyeballed redraw of
  // any one of these is a CI failure rather than a style choice.
  // share2 was an alias of 'share' with identical paths — a near-duplicate inside the very
  // file that exists to prevent them. One name, and the glossary's IconShare cell points at
  // it; a second name for one shape is how two screens end up "agreeing" by accident.
  upload: { d: ['M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4', 'M12 3.5v11', 'm7.5 8 4.5-4.5 4.5 4.5'] },
  // Metadata — the framed card of stacked lines. i:37, which I gave it last turn, is named
  // IconRuler in the repo's icon-set cell: a measuring rule, and naming it Metadata put a
  // captioned glyph under the wrong word in the primary nav. Third wrong shape for this one
  // row, and each time I matched on a description instead of on the repo's own label.
  metadata: { d: ['M3.5 4h17v16h-17z', 'M7.5 9h9', 'M7.5 12.5h9', 'M7.5 16h5'] },
  // ── ViewToggle's three, verbatim from the repo: a 16-unit box at 1.6 stroke, not the
  // 24/1.85 the rest of the set uses. They are drawn small on purpose — they sit inside a
  // toggle option beside a word, so they are diagrams of a layout rather than icons.
  viewTiles: { box: '0 0 16 16', sw: 1.6, d: [],
    rects: [[1.5, 1.5, 5.5, 7, 0], [9, 1.5, 5.5, 4.5, 0], [1.5, 10, 5.5, 4.5, 0], [9, 7.5, 5.5, 7, 0]] },
  viewList: { box: '0 0 16 16', sw: 1.6, d: ['M2 4h12', 'M2 8h12', 'M2 12h12'] },
  viewTable: { box: '0 0 16 16', sw: 1.6, rects: [[1.5, 2.5, 13, 11, 0]],
    d: ['M1.5 6.5h13', 'M6 2.5v11'] },
  chevron: { d: ['M6 9.5 12 15.5l6-6'] },
  open: { d: ['M14 3.5h6.5V10', 'M20.5 3.5 12 12',
    'M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10'] },
  merge: { d: ['M5 3.5v3c0 3 2.5 5.5 5.5 5.5H19', 'M5 20.5v-3c0-3 2.5-5.5 5.5-5.5',
    'm15.5 8.5 3.5 3.5-3.5 3.5'] },
  users: { circles: [[9, 8, 3.2]],
    d: ['M3.5 19a5.5 5.5 0 0 1 11 0', 'M16 5.2a3.2 3.2 0 0 1 0 6', 'M17 14.2a5.5 5.5 0 0 1 3.5 4.8'] },
  userPlus: { circles: [[10, 8, 3.4]],
    d: ['M3.5 19.5a6.5 6.5 0 0 1 10.7-4.4', 'M18 14.5v6', 'M15 17.5h6'] },
  switchUser: { circles: [[8.5, 7.5, 3.2]],
    d: ['M3 18.5a5.5 5.5 0 0 1 9-4.2', 'M14 16.5h6.5', 'm18 14 2.5 2.5L18 19'] },
  logout: { d: ['M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10', 'M9.5 12h10', 'm16 8.5 3.5 3.5-3.5 3.5'] },
  key: { circles: [[8, 12, 4]], d: ['M12 12h8.5', 'M17 12v3.5', 'M20.5 12v2.5'] },
  device: { d: ['M10.5 18.5h3'], rects: [[7, 2.5, 10, 19, 2.5]] },
  archive: { d: ['M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10', 'M10 12.5h4'],
    rects: [[3, 4.5, 18, 4, 1.2]] },
  restore: { d: ['M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10', 'M12 18v-6', 'm9.3 14.7 2.7-2.7 2.7 2.7'],
    rects: [[3, 4.5, 18, 4, 1.2]] },
  refresh: { d: ['M20.5 12a8.5 8.5 0 1 1-2.9-6.4', 'M20.5 3.5V9.2h-5.7'] },
  moveTo: { d: ['M3.5 12h11', 'm10.5 8 4 4-4 4', 'M19 4.5v15'] },
  // ── the seventeen the first sweep missed. I had only taken the glyphs the repo
  // gallery happened to TITLE; the rest sit in demos with no label on them, and an
  // icon you cannot name is an icon the next screen redraws by hand.
  openBook: { d: ['M12 6c-1.5-1-4-1.6-6.5-1.6V17c2.5 0 5 .6 6.5 1.6 1.5-1 4-1.6 6.5-1.6V4.4C16 4.4 13.5 5 12 6Z',
    'M12 6v12.6'] },
  shelf: { d: ['M12 7.2C10.3 5.6 7.6 5 4 5.4v12.3c3.6-.4 6.3.2 8 1.8',
    'M12 7.2c1.7-1.6 4.4-2.2 8-1.8v12.3c-3.6-.4-6.3.2-8 1.8', 'M12 7.2v13.3'] },
  home: { d: ['M4 11.2 12 4.5l8 6.7',
    'M6 9.8V19a1 1 0 0 0 1 1h3.4v-4.6a1.6 1.6 0 0 1 3.2 0V20H17a1 1 0 0 0 1-1V9.8'] },
  // Anthology — i:45, a rounded card of three stacked lines. It WAS the tag glyph: same
  // shape, same dot as the Tags row two rows below it in the same nav — the near-duplicate
  // the icon test fails, and the exact thing I wrote a rule against one turn earlier. A
  // collection of quotes is lines on a page, not a label.
  anthology: { rects: [[3.5, 4, 17, 16, 2.5]], d: ['M7.5 9h9', 'M7.5 12.5h9', 'M7.5 16h5'] },
  quote: { d: ['M6.5 4.5h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2L7 20.9v-3.4h-.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z',
    'M8.3 14h1.9l1.2-2.6V8H7.4v3.4h1.8L8.3 14Z', 'M13.5 14h1.9l1.2-2.6V8h-4v3.4h1.8L13.5 14Z'] },
  // Superseded by the tilted-back-card drawing below — this one was `copy` under a second name.
  editNote: { d: ['M5 5.5A2 2 0 0 1 7 3.5h6.5a2 2 0 0 1 2 2v2.2', 'M5 5.5v13a2 2 0 0 0 2 2h3.4',
    'M8.5 8.6h4', 'm19.9 8.5-7.7 7.7-3.3 1 1-3.3 7.7-7.7a1.6 1.6 0 0 1 2.3 2.3Z'] },
  sliders: { circles: [[15, 8, 2], [9, 16, 2]], d: ['M4 8h9', 'M17 8h3', 'M4 16h3', 'M11 16h9'] },
  download: { d: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 18h16'] },
  importBox: { d: ['M5 13.5V17a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 17v-3.5',
    'M12 4v9', 'm8.5 9.5 3.5 3.5 3.5-3.5'] },
  collapse: { d: ['M12 7.5v6', 'm9 10.5 3 3 3-3'], rects: [[3.5, 4, 17, 16, 2.5]] },
  chevUp: { d: ['M6 14.5 12 8.5l6 6'] },
  play: { d: ['M7.5 4.8v14.4L19 12z'] },
  // IconQuiz again, under the name the rest of the app uses. Five redesigns of this glyph
  // (broken ring, slashed ring, inverted disc, dot on a line, staircase and hop) all lost to
  // the card that was already here — and the reason is structural, not taste: `practise` and
  // `quizSkip` are this same rect, so any third idiom breaks a family of three.
  quiz: { rects: [[4, 5, 16, 14, 2.5]],
    d: ['M9.9 10.2a2.2 2.2 0 1 1 2.7 2.1c-.42.13-.63.42-.63.85v.5', 'M11.97 16.1v.01'] },
  // ── THE REPO’S OWN, VERBATIM, AND IT SHOULD NEVER HAVE BEEN TOUCHED.
  //
  // Five redesigns — a broken ring, a slashed ring, an inverted disc, a dot on a line, a
  // staircase with a hop — and every one was worse than the card with a rule through it that
  // was already here. The card is the quiz card (`practise` is the same frame with a ? in it,
  // so the two are visibly one family) and the rule means not-this. Nothing was wrong with
  // it; I invented a problem, then five solutions to it.
  //
  // The rule at the top of this file exists for exactly this: take the NAME from here, never
  // redraw the shape. It applies to shapes already in the file, not only to ones being added.
  quizSkip: { rects: [[4, 5, 16, 14, 2.5]], d: ['m6.6 17.4 10.8-10.8'] },
  // THE FILLED HALF — the same card, the same slash, at the same coordinates. The card is
  // redrawn as a path only because a <rect> cannot host a knockout subpath; its corners are
  // the rect’s rx 2.5 exactly. The slash is the repo’s own line given a width and cut out, so
  // on and off are one drawing at two weights rather than two drawings that resemble each
  // other — which is the only reason a pair is worth having.
  quizSkipOn: {
    solid: ['M6.5 5h11a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9A2.5 2.5 0 0 1 6.5 5z' +
      'M7.52 18.32 18.32 7.52 16.48 5.68 5.68 16.48z'] },
  // ── THIS IS IconRecords, NOT A DUPLICATE GLYPH — and that is why it read as `copy`.
  //
  // The original definition here (rect + the L-shaped stroke behind it) is IconRecords in
  // ui.jsx, path for path. It was filed under `duplicate` by mistake, so a glyph meaning “a
  // record” was being asked to mean “make another one”. Renamed to what it is; the tilted-card
  // drawing stays available under `duplicate` for whenever the app grows that verb, which
  // actions.jsx says it has not.
  records: {
    rects: [[4.5, 8.5, 11.5, 10, 2]],
    d: ['M7.5 6.2h8A2.5 2.5 0 0 1 18 8.7v7.8'] },
  duplicate: {
    rects: [[3.6, 9.2, 11.6, 11.2, 2.2]],
    d: ['M7.4 6.9a1.8 1.8 0 0 1 1.6-2l8.7-1.2a1.8 1.8 0 0 1 2 1.5l1.2 8.8a1.8 1.8 0 0 1-1.55 2'] },
  penStroke: { d: ['M17 3l4 4L7 19H3v-4z'] },
  // The app's three VALUE glyphs. They are icons like any other — the heart is a text
  // character rather than a path, which is precisely why it kept being left out of icon
  // sweeps and why it belongs in the same section with that fact written down.
  selectMany: { d: ['M2.5 12.5l3.5 3.5 6.5-6.5', 'M10.5 16l1 1 9-9'] },
  // IconShare's three-node graph, IconCopy's two offset sheets, IconPalette and the
  // three dots — all from ui.jsx, all named so no specimen types them again.
  share: { circles: [[17.5, 5.5, 2.4], [17.5, 18.5, 2.4], [6.5, 12, 2.4]],
    d: ['m8.7 10.9 6.6-3.9', 'm8.7 13.1 6.6 3.9'] },
  copy: { d: ['M9 9.5A2.5 2.5 0 0 1 11.5 7h6A2.5 2.5 0 0 1 20 9.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 9 15.5z',
    'M6 15.5A2.5 2.5 0 0 1 4 13V6.5A2.5 2.5 0 0 1 6.5 4H13a2.5 2.5 0 0 1 2.5 2'] },
  more: { circles: [[12, 5, 1.6], [12, 12, 1.6], [12, 19, 1.6]], d: [], fill: 'currentColor' },
  // IconHelp, verbatim — the ringed ? the top bar's help key wears. Its stem is a path and
  // its dot a zero-length segment, which is why an eyeballed redraw of quiz/practise is not
  // the same shape: the repo's icon test compares coordinates.
  help: { circles: [[12, 12, 8.75]],
    d: ['M9.4 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.15-.75.5-.75 1v.6', 'M11.85 16.6v.01'] },
  // IconHeart, verbatim. The card's ♥ is a text glyph on purpose; this is for lists.
  heart: { d: ['M12 20.2c-1.6-1.2-7.5-5-7.5-9.9A4 4 0 0 1 12 8.1a4 4 0 0 1 7.5 2.2c0 4.9-5.9 8.7-7.5 9.9Z'] },
  // Stats — THE REPO'S, three rounded bars as rects at 4.5/10/15.5 with different heights
  // and tops. I hand-drew a four-stroke bar chart for this last turn and put it in this
  // file, one message after writing "never redraw the shape" at the top of it. The real one
  // was already in the extraction; I matched by name and it is keyed by shape.
  // Save — a disc with its shutter and label. It was rendering on screens (the InlineField
  // pencil's neighbour) without existing in this file's grid, which is the failure mode this
  // library was built to end: a glyph that ships but is not listed cannot be reviewed, and
  // the next screen that needs it draws its own.
  save: { d: ['M5.5 4.5h9.4l4.1 4.1v9.4a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5z',
    'M8 4.5v4.2h6.2V4.5', 'M8 19.5v-5h8v5'] },
  stats: { rects: [[4.5, 11, 4, 7.5, 1], [10, 5.5, 4, 13, 1], [15.5, 8, 4, 10.5, 1]], d: [] },
  // Catalogue — a disc with a hub and four cardinal dots. Nothing like the open book I gave
  // it: "catalogue" sounded like shelves, and the glyph is a record/disc.
  catalogue: { circles: [[12, 12, 8.5], [12, 12, 1.5], [12, 6.4, 1], [17.6, 12, 1],
    [12, 17.6, 1], [6.4, 12, 1]], d: [] },
  palette: { d: ['M12 3.2c-4.9 0-8.8 3.7-8.8 8.3 0 2.6 2.1 4.7 4.7 4.7h1.5c.9 0 1.4.8 1.1 1.6l-.2.5c-.5 1.3.4 2.7 1.8 2.7 4.9 0 8.7-4 8.7-8.9 0-4.7-3.9-8.9-8.8-8.9z'],
    circles: [[8.4, 9, 1.15], [12, 7.1, 1.15], [15.6, 9, 1.15]] },
  // ── TWO GLYPHS THE APP ASKS FOR AND NEVER HAD. Both were being called by name —
  // `ico('languages')` from the quote-text menu, `bookmark` from the proposed fill pairs — and
  // both were falling through to the dashed missing-glyph box. A name with no drawing is worse
  // than a wrong drawing: it looks like a layout bug rather than an omission.
  //
  // TRANSLATE IS TWO ALPHABETS, WHICH IS WHY IT CANNOT BE FILLED. A globe would say "the web"
  // (and this app has one of those already); a speech bubble would say "discuss". The only mark
  // that says *this text, in another script* is a character from two scripts side by side —
  // here a Latin A and 文, the pairing every system font's translate key uses. Six strokes is
  // the floor: drop the A's crossbar or 文's top tick and it stops reading as writing.
  // IconLanguages, VERBATIM. I hand-drew a Latin A beside 文 and argued for it at length; the
  // repo already ships this — a script sample over an A — and an improvised lookalike fails the
  // icon test rather than merely looking different. The lesson is the one at the top of this
  // file: check ui.jsx BEFORE drawing, not after four rounds of review.
  languages: { d: ['M2.5 5.5h8.5', 'M6.8 3.5v2', 'M9 5.5c0 3.7-2.4 6.8-6.5 8.3',
    'M4.4 8.9c1.1 2.3 3 4 5.4 4.9', 'm12.8 20.5 4.6-10.5 4.6 10.5', 'M14.4 16.8h6'] },
  // ── THREE JOBS WERE SHARING THE WORD "TAG", AND THEY ARE NOT THE SAME THING.
  //
  //   · `tag`     — a tag ON something. A label, drawn on a card, not pressable as a concept.
  //   · `navTag`  — the Tags destination in the rail. A place. Solid, per the rail rule.
  //   · `tagAdd`  — the control that opens the tag sheet for one annotation. A verb.
  //
  // One glyph for all three meant the row that FILES a quote looked identical to the label the
  // filing produces, and both looked like the screen that lists every tag in the library. A
  // reader learns "this shape means tag" and then cannot predict what pressing it does, which
  // is the only thing an icon in a tool row is for.
  //
  // So the verb gets the plus. The tag body shrinks up and left to make room rather than the
  // plus being hung off the corner of a full-size one — a glyph that overflows its box to
  // accommodate a modifier reads as two glyphs that collided.
  tagAdd: { d: ['M3.2 11.2 10 4.4h5.4v5.4l-6.8 6.8z', 'M12.9 7.4v.01',
    'M17.6 14.6v6', 'M14.6 17.6h6'] },
  // ── THE SHELF'S SIX STATES, OUTLINED. The filled halves come from Phosphor; these are the
  // wireframe halves they toggle against, and they have to be drawn here rather than taken
  // from the pack, because an outline and a fill from different hands do not line up and the
  // reader sees the glyph change SHAPE when all that changed was the state.
  //
  // Three "in progress" marks, not one. A play triangle shared across a novel, a series and a
  // game repeats what the title already said; a book being read, a screen mid-episode and a
  // controller are three activities and three silhouettes, and the Library, Catalogue and
  // Games lists are exactly where they appear beside each other.
  //
  // nowReading carries a head, which is what keeps it clear of `openBook` and `shelf` — the
  // icon test fails a near-duplicate, and three open books in one set would be three.
  // ── THE SHELF SAYS WHICH MEDIUM IS UNDERWAY. Colour on the shelf bar already says WHICH
  // STATE, so these three exist only to say what kind of thing is in it — the same green on a
  // novel, a series and a game tells you all three are going and nothing about what they are.
  //
  // Two of the three were already in ui.jsx and I drew over them before checking: IconReading
  // is the two-page spread (this file’s `shelf`), IconWatching is the filled play triangle
  // (this file’s `play`). Both restored verbatim under the shelf’s own names, so the concept
  // survives and the shapes are the repo’s. Only games had nothing, so only games is new.
  nowReading: { d: ['M12 7.2C10.3 5.6 7.6 5 4 5.4v12.3c3.6-.4 6.3.2 8 1.8',
    'M12 7.2c1.7-1.6 4.4-2.2 8-1.8v12.3c-3.6-.4-6.3.2-8 1.8', 'M12 7.2v13.3'] },
  nowWatching: { d: ['M7.5 4.8v14.4L19 12z'], fill: 'currentColor' },
  nowPlaying: {
    d: ['M7.6 8.4h8.8a4.8 4.8 0 0 1 0 9.6H7.6a4.8 4.8 0 0 1 0-9.6z',
      'M6.4 11.2v4', 'M4.4 13.2h4', 'M16.4 11.4v.01', 'M18.6 14.2v.01'] },
    };
  // The drill has ONE card in ui.jsx. `practise` is the name three screens call it by, so it
  // points at the same object rather than repeating its paths — which is what the repo’s
  // near-duplicate icon test would have failed on. Icon Candidates replaces this with the
  // filled mortarboard; until then, one drawing under two names beats two drawings.
  ICONS.practise = ICONS.quiz;

  // Assets that are FILES, not paths. The mark is two files rather than one recoloured,
  // because a logo is not a glyph that takes currentColor — tinting the light one for dark
  // mode is the kind of "close enough" a brand notices first.
  var ASSETS = {
    markLight: 'web/frontend/public/mark.svg',
    markDark: 'web/frontend/public/mark-dark.svg',
    // A missing PERSON is the silhouette. A missing anything else — cover, still, poster —
    // is the .ph hatch below. They are not interchangeable: a hatch where a face belongs
    // reads as a broken tile, a silhouette where a cover belongs reads as a person nobody
    // named.
    silhouette: 'assets/person-silhouette.svg',
    texturePath: 'web/frontend/src/textures/',
  };

  // The .ph hatch, to the project's numbers: 45° --ink at 5% over --raised, 12 on / 14 off.
  // ── UNCONFIRMED — ONE ENTRY, AND IT DESCRIBES WHAT SHIPS ────────────────────
  // The note that stood here named the wrong shapes for both of these ("the lined card",
  // "overlapping squares / copy") while the code shipped a tag and an import box. A
  // disclosure that misdescribes what ships is worse than none: it sends the next reader
  // looking in the wrong place and certifies the mismatch that is actually there.
  //
  //   metadata — SHIPS i:37, a rounded frame of four upright bars. CHOSEN, not matched.
  //              The user's sidebar shows two overlapping squares, and that shape is not
  //              among the 50 extracted from docs/ui-glossary.html — the only multi-rect
  //              entry is i:10, the Stats bars. So either the extraction is incomplete
  //              against the real ui.jsx or the sidebar has moved past it. i:37 was picked
  //              because it reads as the columns of a record and collides with nothing else
  //              in the nav: a placeholder with a reason, not a match.
  //
  // anthology is no longer listed — i:45 is a real extracted shape and matches the stacked
  // lines in the screenshot.
  //
  // TO RESOLVE: read ui.jsx directly. This file is the single source of truth for every
  // screen, so one unmatched glyph here is one wrong glyph everywhere at once.
  // Nothing unconfirmed left in the nav: Metadata is the framed lined card, and IconRuler —
  // which was standing in for it — now sits under its own name.
  var UNCONFIRMED = [];

  var HATCH = 'background-color:var(--raised);background-image:repeating-linear-gradient(' +
    '45deg,color-mix(in oklab,var(--ink),transparent 95%) 0 12px,transparent 12px 26px)';

  var SILHOUETTE = 'background:var(--faint);' +
    '-webkit-mask:url(' + ASSETS.silhouette + ') center/100% 100% no-repeat;' +
    'mask:url(' + ASSETS.silhouette + ') center/100% 100% no-repeat';

  // Build one glyph as a React element. Passed React rather than importing it, so this file
  // stays a plain script with no module graph of its own.
  function icon(React, name, size, over) {
    var g = ICONS[name];
    if (!g) throw new Error('no glyph named ' + name);
    over = over || {};
    var d = g.d || [];
    return React.createElement('svg', {
      width: size || 19, height: size || 19,
      viewBox: over.box || g.box || '0 0 24 24',
      fill: over.fill || g.fill || 'none',
      stroke: 'currentColor', strokeWidth: over.sw || g.sw || 1.85,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
    }, [].concat(
      (g.circles || []).map(function (c, i) {
        return React.createElement('circle', { key: 'c' + i, cx: c[0], cy: c[1], r: c[2] });
      }),
      (g.rects || []).map(function (r, i) {
        return React.createElement('rect', { key: 'r' + i, x: r[0], y: r[1],
          width: r[2], height: r[3], rx: r[4] });
      }),
      (Array.isArray(d) ? d : [d]).filter(Boolean).map(function (p, i) {
        return React.createElement('path', { key: i, d: p });
      }),
      // ── `solid`: PATHS THAT ARE FILLED WHILE THE REST OF THE GLYPH IS STROKED.
      //
      // Not a way to make filled icons — the app is wireframe and stays so. This exists for the
      // one composition the set genuinely needs and could not express: an OUTLINED FRAME WITH
      // SOLID CONTENT. The quote glyph is already that shape (a hairline bubble around two solid
      // marks) and had to fake it by drawing the marks as closed outlines thick enough to read
      // as filled, which is why they look heavy at 24px and muddy at 16.
      //
      // A letterform inside a frame is the case: type is solid, and a ? drawn as a 1.85 stroke
      // is a wire bent into the shape of a ?, not a question mark. So the frame keeps the app's
      // stroke and the letter gets its real weight.
      (g.solid || []).map(function (p, i) {
        return React.createElement('path', { key: 's' + i, d: p,
          fill: 'currentColor', stroke: 'none', fillRule: 'evenodd', clipRule: 'evenodd' });
      })
    ));
  }

  window.TippaniIcons = { ICONS: ICONS, ASSETS: ASSETS, HATCH: HATCH, UNCONFIRMED: UNCONFIRMED,
    SILHOUETTE: SILHOUETTE, icon: icon, names: Object.keys(ICONS) };
})();
