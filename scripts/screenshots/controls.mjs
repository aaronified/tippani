#!/usr/bin/env node
// EVERY CONTROL IN THE APP EITHER ACTS OR SAYS IT CANNOT.
//
// A SPECIFICATION, NOT A REGRESSION TEST. Nothing here knows about any
// particular defect: it walks the app, finds everything a reader can press, and
// asks two questions of each one —
//
//   Does pressing it change anything at all?
//   If not, does it SAY so, with aria-disabled or a disabled attribute?
//
// A control that answers no to both is a lie to the reader, whatever the reason,
// and the reason is never visible from the outside. That is the whole rule.
//
// WHY THIS SHAPE. The repo's own standing rule is that every chip is a button
// because "a chip names a character and a character has a screen; the row is a
// row of doors" — and a door that does not open is worse than no door, because
// the reader has already decided to go through it. Written per-defect, a test
// asserts the one handler that was fixed; written as a property, it asks the
// question of every control that exists, including the ones nobody has looked at.
//
// AND THE TOUCH FLOOR WITH IT, because it is the same kind of claim. 44px is the
// design pack's number — `docs/design/handoff/design-system.md` line 180, "44px
// touch targets", with `.tp-btn`'s `min-height:44px` beside it at line 134 — and
// `index.css` says why it is one of the handful of sizes that stays in px: "20px
// is a gutter and 44px is a fingertip; neither changes when the reader changes
// their type size". A control below it on a phone is one a thumb cannot reliably
// hit.
//
// WHAT COUNTS AS "SOMETHING HAPPENED": a new dialog or panel, one closing, the
// route changing, focus moving, the surface scrolling, or the surface's own text
// changing. Deliberately broad — the point is to find controls that do NOTHING,
// not to judge what they did.
import { readFileSync, writeFileSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

const opts = {
  baseUrl: 'http://127.0.0.1:8080', timeoutMs: 30000, width: 1280, height: 1000, only: '',
  updateBaseline: false,
  username: process.env.TIPPANI_USER || HARNESS_ACCOUNT.username,
  password: process.env.TIPPANI_PASS || HARNESS_ACCOUNT.password,
}
for (let i = 2; i < process.argv.length; i++) {
  const next = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = next()
  else if (process.argv[i] === '--only') opts.only = next()
  else if (process.argv[i] === '--width') opts.width = Number(next())
  // WHOSE LIBRARY THIS IS. The seeded fixture's account is the harness's own, and
  // that is the default; a run against a RESTORED backup is somebody's real
  // library and signs in as them. Without this the probe typed the harness's
  // username into a login that has never heard of it and every surface reported
  // "did not render" — a run that measures the login screen twenty times.
  else if (process.argv[i] === '--username') opts.username = next()
  else if (process.argv[i] === '--password') opts.password = next()
  // Records the ratcheted counts for this width instead of judging them. Run it
  // deliberately, after reading the lists — a baseline written to make a run
  // green is a ceiling nobody chose.
  else if (process.argv[i] === '--update-baseline') opts.updateBaseline = true
  else if (process.argv[i] === '--help' || process.argv[i] === '-h') {
    console.log('usage: node controls.mjs [--base-url URL] [--only substring] [--width N]\n\n' +
      'Presses every control on every screen and panel it can reach, and fails on\n' +
      'any that does nothing without saying it is disabled, or that is under 44px.')
    process.exit(0)
  }
}

// THE TOUCH FLOOR IS CHECKED AT PHONE WIDTH ONLY, because that is what it is for
// — and a desk pointer does not need it. 1px of slack for fractional layout.
const TOUCH_FLOOR = 44
const SLACK = 1
// The floor for "this screen rendered at all" — see the check at the loop head.
const MIN_CONTROLS = 4

// Controls a press must not fire, because doing so ends the run rather than
// testing it. Named by their accessible name, not by class, so the list reads as
// what a person would avoid rather than as implementation.
const DESTRUCTIVE = /\b(delete|remove|discard|log ?out|sign ?out|reset|clear|empty the bin|take this credit off)\b/i
// And ones that leave the app, which a probe cannot come back from.
const LEAVES = /^(https?:)?\/\//

const SURFACES = [
  { route: '/', name: 'Home' },
  { route: '/library', name: 'Library' },
  { route: '/catalogue', name: 'Catalogue' },
  { route: '/quotes', name: 'Quotes' },
  { route: '/search', name: 'Search' },
  // NOT `/people`: it is not a route — `routes.js`'s ROUTE_TABS does not list it
  // and the parser falls through to `{ tab: 'home' }`, so this line probed Home a
  // second time under another name for as long as it stood here. The screen that
  // actually lists the library's people is the metadata console.
  { route: '/metadata', name: 'Metadata' },
  { route: '/anthologies', name: 'Anthologies' },
  { route: '/bin', name: 'Bin' },
  { route: '/tags', name: 'Tags' },
  { route: '/stats', name: 'Stats' },
  { route: '/checks', name: 'Checks' },
  { route: '/settings', name: 'Settings' },
  // THE IDS ARE THE LIBRARY'S, NOT THE FIXTURE'S. These were `/books/1` and
  // `/catalogue/2` — the ids `seed.mjs` happens to produce — so a run against a
  // RESTORED backup, which is what this probe is now supposed to use, asked for
  // works that library does not have: `GET /api/movies/2` came back 404, the film
  // page reported "not a route", and the character panel behind it was never
  // reached at all. A probe whose surfaces only exist in one fixture is a probe
  // that measures that fixture. `resolveSurfaces` below fills them in from the
  // API before the run, and a library with no film simply has no film surface.
  { route: '/books/{book}', name: 'Book detail', needs: 'book' },
  { route: '/catalogue/{movie}', name: 'Film detail', needs: 'movie' },
  // THE PANELS, REACHED THE WAY A READER REACHES THEM. A panel has no route of
  // its own — it is a door on a screen — so a surface may name the door, and this
  // probe presses it before enumerating. `list()` already scopes to `.tp-panel`
  // when one is open, so everything downstream works unchanged.
  //
  // THEY WERE COVERED BY A SECOND SCRIPT, `audit-panel.mjs`, which pressed the
  // character panel's controls and which this replaces. It carried both faults
  // this file was hardened against — it re-resolved controls BY INDEX after
  // re-opening, and it exited 0 whatever it found, so `make` could not fail on
  // it. A weaker copy of a probe is worse than none: it is the one somebody
  // reads.
  //
  // AND THE DOOR IS WHICHEVER CHARACTER THAT WORK HAS. It named "Rick Blaine",
  // which is the fixture's; on any other library the chip was never found and the
  // one panel surface in this file went untested while the run still reported a
  // failure it could not act on.
  // AND THE DOOR IS THE CAST ROW'S CHARACTER, NOT THE FIRST `.person-chip` ON THE
  // PAGE. A film's credits row draws person chips too — the director's is
  // usually the first — so this surface opened a PERSON panel and reported it
  // under the name "Character panel" for as long as it said `.person-chip`. The
  // same mistake put the director's page in `shots.mjs` as character-panel.png.
  // `.cast-character`'s button is the character's own door (cast.jsx:812-818),
  // and `aria-expanded` is exactly what distinguishes it: the row sets it only on
  // the fallback that toggles a URL, i.e. on a cast row with no character record
  // behind it.
  {
    // THE FILM THIS ONE NEEDS IS ONE WITH A CAST, which is not the same film as
    // `Film detail`'s: the first film in a library often has an empty cast, and
    // then there is no character to open and the surface reports itself broken
    // when nothing is.
    route: '/catalogue/{cast}',
    name: 'Character panel',
    needs: 'cast',
    // THREE PRESSES, WHICH IS HOW MANY IT TAKES A READER. A film page draws no
    // cast at all — measured, `.cast-character` is present zero times on
    // `/catalogue/{id}` — because the cast lives in the Details panel, and there
    // it is folded behind its own opener. A door written as one selector reported
    // this surface unreachable while every press worked by hand.
    door: [
      { selector: '.tp-btn', text: 'Details' },
      { selector: 'button[aria-label*="people" i]' },
      { selector: '.cast-character button:not([aria-expanded])' },
    ],
  },
]

// resolveSurfaces — turn `{book}` / `{movie}` into ids this library actually has.
//
// Asked of the API rather than scraped off a card: a card's class is the app's
// business and a probe that guesses one fails silently, which is exactly how the
// film capture in `shots.mjs` skipped itself and reported success.
async function resolveSurfaces(page, baseUrl) {
  const ids = await page.evaluate(async () => {
    const one = async (path, key) => {
      try {
        const r = await fetch(path, { credentials: 'same-origin' })
        const d = await r.json()
        const list = d[key] || []
        return list.length ? list[0].id : 0
      } catch { return 0 }
    }
    // A FILM WITH A CAST, for the surface that is reached through one. The first
    // film in the library is whichever one sorts first, and a library's first
    // film very often has no cast at all — the one this run met had none, so the
    // character panel reported itself unreachable while the app was fine. Asked
    // of the record rather than guessed from the list, because `cast` is not on
    // the list payload; bounded, because this is a probe's setup and not a
    // search.
    const withCast = async () => {
      try {
        const r = await fetch('/api/movies?limit=30', { credentials: 'same-origin' })
        const list = (await r.json()).movies || []
        // THE FULLEST CAST, not the first non-empty one. A film with a single
        // cast row can have that row be an actor nobody has linked to a
        // character, and then the door is missing for a reason that is about
        // that film rather than about the app.
        let best = 0
        let most = 0
        for (const m of list.slice(0, 12)) {
          const d = await (await fetch(`/api/movies/${m.id}`, { credentials: 'same-origin' })).json()
          const n = (d.cast || d.movie?.cast || []).length
          if (n > most) { most = n; best = m.id }
        }
        if (best) return best
      } catch { /* fall through to the first film */ }
      return 0
    }
    const movie = await one('/api/movies?limit=1', 'movies')
    return { book: await one('/api/books?limit=1', 'books'), movie, cast: (await withCast()) || movie }
  })
  return SURFACES.filter((s) => !s.needs || ids[s.needs]).map((s) => ({
    ...s,
    route: s.route.replace(/\{(book|movie|cast)\}/g, (_, k) => String(ids[k])),
  }))
}

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: opts.width, height: opts.height } }))
const findings = { dead: [], small: [], empty: [], blank: [], unreachable: [], sideways: [], notaroute: [], labelled: [], head: [] }
let pressed = 0

try {
  const page = await browser.newPage()
  // WHAT A PRESS CAN DO THAT THE DOCUMENT NEVER SHOWS. Four effects leave no
  // trace in the DOM at all, and counting a control that has one as dead is how
  // this probe would have reported "Upload sticker" — a button whose whole job is
  // `fileRef.current.click()` on a hidden <input type=file>, opening the
  // operating system's own picker. Same for Copy (the clipboard), Share
  // (navigator.share, or the clipboard again), and any verb whose result is a
  // request whose reply has not landed inside the settle window.
  //
  // Installed before any script runs, and only ever INCREMENTED — the probe reads
  // the counters, it does not need the values, and a counter cannot be mistaken
  // for a rendering change.
  await page.evaluateOnNewDocument(() => {
    window.__tpFx = { file: 0, clip: 0, share: 0, net: 0 }
    const click = HTMLElement.prototype.click
    HTMLElement.prototype.click = function () {
      if (this instanceof HTMLInputElement && this.type === 'file') window.__tpFx.file++
      return click.apply(this, arguments)
    }
    if (navigator.clipboard?.writeText) {
      const w = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = (...a) => { window.__tpFx.clip++; return w(...a) }
    }
    const exec = document.execCommand?.bind(document)
    if (exec) document.execCommand = (cmd, ...a) => { if (cmd === 'copy' || cmd === 'cut') window.__tpFx.clip++; return exec(cmd, ...a) }
    if (navigator.share) {
      const sh = navigator.share.bind(navigator)
      navigator.share = (...a) => { window.__tpFx.share++; return sh(...a) }
    }
    const f = window.fetch
    window.fetch = (...a) => { window.__tpFx.net++; return f(...a) }
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function () { window.__tpFx.net++; return open.apply(this, arguments) }
  })
  await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 })
  await emulateEngineMedia(page, engine.browser, 'light')
  await ensureSession(page, {
    baseUrl: opts.baseUrl,
    username: opts.username,
    password: opts.password,
    timeoutMs: opts.timeoutMs,
  })

  // The fingerprint a press is judged against.
  const shot = () => page.evaluate(() => {
    const top = document.querySelector('.tp-panel') || document.body
    const a = document.activeElement
    return {
      url: location.pathname + location.search,
      panels: document.querySelectorAll('.tp-panel').length,
      dialogs: document.querySelectorAll('[role=dialog]').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      focus: a && a !== document.body ? `${a.tagName}#${a.id}.${(a.className || '').toString().slice(0, 24)}` : '',
      scroll: Math.round((document.querySelector('.tp-panel-body') || document.scrollingElement).scrollTop),
      text: top.textContent.replace(/\s+/g, ' ').trim().slice(0, 600),
      // AND THE WHOLE PAGE'S LENGTH, because `text` above is the first 600
      // characters of the top surface and a great deal happens outside it. The
      // phone drawer is the case that proved it: pressing Menu on a film page
      // opened the drawer — measured, 1216 characters of body text became 1449 —
      // and NOTHING in this fingerprint moved, because the drawer is not a
      // `.tp-panel`, carries no `role=dialog`, and appends its content past the
      // 600th character. The probe reported a working control as one that does
      // nothing and does not say so, which is the failure this file's own comment
      // warns is fatal to a gate: "a gate that reports a defect that is not there
      // gets switched off exactly as fast as one that misses a defect that is".
      body: document.body.textContent.replace(/\s+/g, ' ').trim().length,
      toasts: document.querySelectorAll('[class*=toast]').length,
      // The four effects that never reach the document — see the hooks above.
      fx: JSON.stringify(window.__tpFx || {}),
      // A DISCLOSURE'S EFFECT IS ON ITSELF. A ⋯ that opens a menu changes
      // `aria-expanded` and may render the menu outside the scope being watched,
      // so without this the honest control reads as dead.
      // `aria-checked` IS IN HERE FOR THE SAME REASON THE OTHER TWO ARE, and
      // leaving it out reported eleven working controls on one screen. A tag
      // style, an annotation kind and a colour are all `role=radio` with
      // `aria-checked`: pressing one moves a 2px border and a chip preview, and
      // nothing else on the page changes at all — no dialog, no route, no text.
      // Without the attribute in the fingerprint the whole radiogroup reads as
      // dead, and with it a press is visible exactly when it moved the choice.
      expanded: [...document.querySelectorAll('[aria-expanded],[aria-pressed],[aria-checked],[aria-selected],details')]
        .map((e) => `${e.getAttribute('aria-expanded') ?? ''}${e.getAttribute('aria-pressed') ?? ''}${e.getAttribute('aria-checked') ?? ''}${e.getAttribute('aria-selected') ?? ''}${e.open ?? ''}`).join('|'),
      // AND A MENU THAT OPENS EMPTY IS ITS OWN DEFECT, not a pass: the reader
      // pressed a door and got a blank. Counted so it can be reported.
      menuItems: [...document.querySelectorAll('[role=menu]')]
        .reduce((n, m) => n + m.querySelectorAll('[role=menuitem],button,a').length, 0),
      menus: document.querySelectorAll('[role=menu]').length,
    }
  })

  // A SURFACE MUST NOT SCROLL SIDEWAYS; ITS SCROLLERS DO. Content wider than the
  // screen belongs inside something with `overflow-x`, and the app has one —
  // `Scroller`, which writes `data-scroll-x` so a fade says it moves. When the
  // container instead STRETCHES, three things go wrong at once and none of them
  // looks like the same bug: the row does not scroll (it is never narrower than
  // its contents), it wears no fade (`useEdgeScroll` measures no overflow, quite
  // correctly), and every sibling is dragged out with it so their labels run past
  // the edge and are cut mid-word.
  //
  // That is one missing `min-width: 0` on a flex item, whose default is `auto` —
  // "do not shrink below your content". Measured on the author sheet at 390px
  // before the fix: body scrollWidth 1266 against clientWidth 364, and a works
  // strip 1248px wide reporting `scrollWidth === clientWidth`.
  //
  // The check is here rather than in vitest because jsdom has no layout: every
  // width it reports is zero, so this class of defect is invisible to the entire
  // unit suite by construction.
  const sideways = () => page.evaluate(() => {
    const out = []
    const scope = document.querySelector('.tp-panel-body') || document.scrollingElement
    if (scope && scope.scrollWidth > scope.clientWidth + 1) {
      out.push(`${scope.className || 'the page'} scrolls sideways: ${scope.scrollWidth}px of content in ${scope.clientWidth}px`)
    }
    return out
  })

  // THE PACK'S PANEL HEADER IS ONE LEFT-ALIGNED BLOCK BESIDE THE COVER, and the
  // app drew a centred three-slot bar. `character-popup.dc.html:33`: the work's
  // cover with the medium glyph laid OVER it in the slot a back key would
  // otherwise hold, the name with its crumb beneath, the ✕. Two things that are
  // geometry and nothing else, so neither can be checked anywhere but here —
  // jsdom reports every width as zero.
  //
  //   THE NAME STARTS WHERE THE COVER ENDS. With `flex: 1 1 0` on both slots the
  //   two 44px controls took a third of the bar each and the name floated in the
  //   middle, wrapping inside the third that was left while the head had room to
  //   spare. The owner: "the problem here lies in the fact that it is not left
  //   aligned right beside the cover image, rather middle aligned, AGAINST THE
  //   PROTOTYPE DESIGN."
  //
  //   AND THE GLYPH SITS ON THE COVER. Written `position: relative` inside a flex
  //   box it is a flex ITEM, so the badge and the poster shared one 32px box side
  //   by side. Reported three times before it was measured.
  const headShape = () => page.evaluate(() => {
    const out = []
    const head = document.querySelector('.tp-panel-head.has-scope')
    if (!head) return out
    const names = head.querySelector('.tp-panel-names')
    const slot = head.querySelector('.tp-panel-slot')
    if (names && slot) {
      const gap = Math.round(names.getBoundingClientRect().left - slot.getBoundingClientRect().right)
      // One gap of the head's own, not a third of the bar.
      if (gap > 24) out.push(`the name starts ${gap}px after the cover — it is centred, not beside it`)
    }
    // AND THE NAME AND ITS CRUMB ARE ONE BLOCK, which is the other half of the
    // same report — "the header vertical gaps look weird", twice. The pack sets
    // them as a column at `gap:2px` (`character-popup.dc.html:37-39`); the app's
    // title carried a 44px floor meant for a title sitting ALONE beside the 44px
    // keys, so stacked over a crumb it wedged ~22px of nothing between the two
    // lines. Measured rather than eyeballed, because that is the only way anybody
    // was going to notice it a third time.
    const crumb = head.querySelector('.tp-panel-crumb')
    const title = head.querySelector('.tp-panel-title')
    if (crumb && title) {
      const v = Math.round(crumb.getBoundingClientRect().top - title.getBoundingClientRect().bottom)
      if (v > 8) out.push(`the crumb sits ${v}px under the name — they are not one block`)
    }
    const art = head.querySelector('.cs-scope-art')
    const badge = head.querySelector('.cs-scope-overlay')
    if (art && badge) {
      const a = art.getBoundingClientRect()
      const b = badge.getBoundingClientRect()
      const over = b.left < a.right - 1 && b.right > a.left + 1 && b.top < a.bottom - 1 && b.bottom > a.top + 1
      if (!over) out.push('the medium glyph sits beside the cover, not over it')
    }
    return out
  })

  const differs = (a, b) => a.url !== b.url || a.panels !== b.panels || a.dialogs !== b.dialogs
    || a.inputs !== b.inputs || a.focus !== b.focus || a.scroll !== b.scroll
    || a.text !== b.text || a.body !== b.body || a.toasts !== b.toasts || a.expanded !== b.expanded
    || a.fx !== b.fx
    // COLLECTED AND NEVER COMPARED, which is its own small lesson: both of these
    // were read on every press so an EMPTY menu could be reported, and neither was
    // in this list — so a control whose only effect was opening a menu depended on
    // `expanded` catching it, and a trigger that carries no `aria-expanded` (the
    // phone drawer is one) read as dead. A field gathered for one purpose is not
    // automatically serving the other.
    || a.menus !== b.menus || a.menuItems !== b.menuItems

  // Enumerate the controls on whatever is currently on screen. A panel, when one
  // is open, otherwise the page — so a modal's own controls are judged against
  // the modal and not against the screen behind it.
  const list = () => page.evaluate(() => {
    const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
    const seen = new Map()
    // ON SCREEN, AND `offsetParent` CANNOT ANSWER THAT. It is null for anything
    // `position: fixed` — which is the to-top button, the phone dock, and every
    // floating bar in this app — so the filter that was meant to skip hidden
    // controls was silently skipping the ENTIRE class of controls that float. A
    // probe whose coverage gap is invisible is worse than no probe.
    //
    // What "on screen" actually means: it has a box, and nothing in its own style
    // has taken it out of the flow or faded it away. `.to-top` without `is-on` is
    // `opacity: 0; pointer-events: none` and must still be skipped — but by what
    // its style says, not by an accident of where its offset parent is.
    const onScreen = (b) => {
      if (b.tagName === 'SUMMARY') return true
      const r = b.getBoundingClientRect()
      if (!r.width || !r.height) return false
      const cs = getComputedStyle(b)
      return cs.display !== 'none' && cs.visibility !== 'hidden'
        && parseFloat(cs.opacity) > 0.01 && cs.pointerEvents !== 'none'
    }
    return [...scope.querySelectorAll('button, [role=button], a[href], summary')]
      .filter(onScreen)
      .map((b, i) => {
        const r = b.getBoundingClientRect()
        const name = (b.getAttribute('aria-label') || b.textContent.replace(/\s+/g, ' ').trim() || b.title || '(unnamed)').slice(0, 40)
        // THE KEY IS THE NAME WITH ITS NUMBERS MASKED. A library tile's accessible
        // name is its title, author, year AND quote count run together — "COVER
        // Middlemarch George Eliot · 1871 0 quotes" — and a press earlier in the
        // run that adds a quote changes the last of those. The row is the same
        // row; only the tally moved. Matching on the digits made thirteen tiles
        // unfindable on the second look and reported them as vanished.
        const key = name.replace(/\d+/g, '#')
        const nth = seen.get(key) || 0
        seen.set(key, nth + 1)
        return {
          i,
          nth,
          key,
          name,
          says: b.disabled === true || b.getAttribute('aria-disabled') === 'true',
          // WHERE YOU ALREADY ARE, and `active` is on this list because CLAUDE.md
          // puts it there: "A chip's on-state class is `active`. `.tp-filter-chip
          // .active` is what the stylesheet styles; `is-on` belongs to other
          // things". Pressing the filter you are already on, or the tab you are
          // already looking at, changes nothing and is not a broken control —
          // the destination is simply the current one. Without this the probe
          // reports every "All" chip in the app, which is how a checker earns a
          // reputation for crying wolf and then gets switched off.
          //
          // `is-on` IS NOT A GENERIC ON-STATE, and this list used to treat it as
          // one while quoting the line that says it is not. CLAUDE.md names the
          // three things that wear it — `.cat-swatch`, `.meta-rail-item`,
          // `.to-top` — and only the first two mean "chosen". On `.to-top` it
          // means VISIBLE (`opacity: 1; pointer-events: auto`), so exempting it
          // excused the app's one scroll-to-top button from ever being pressed:
          // the state that makes it pressable was being read as the state that
          // makes it pointless to press.
          current: b.getAttribute('aria-current') === 'page'
            || b.getAttribute('aria-pressed') === 'true'
            || b.getAttribute('aria-selected') === 'true'
            || b.getAttribute('aria-checked') === 'true'
            || b.classList.contains('is-current')
            || b.classList.contains('active')
            || (b.classList.contains('is-on')
              && (b.classList.contains('cat-swatch') || b.classList.contains('meta-rail-item'))),
          href: b.getAttribute('href') || '',
          // A GLYPH AND WORDS TOGETHER. Read off the rendered box rather than off
          // a class name: `keepLabel` is one way to get here and a hand-built
          // button with an <svg> beside a <span> is another, and the reader
          // cannot tell them apart.
          // THE APP'S OWN LABEL SPAN, and the first cut of this was wrong twice
          // over: it read `textContent`, which `[data-labels="off"]` CLIPS rather
          // than removes — so a correctly collapsed 44px square still counted —
          // and it treated any `<svg>` inside any pressable thing as an icon, so
          // every cover tile and every person chip was reported. A cover is
          // content, not a glyph beside a word. `.btn-label` / `.btn-label-fixed`
          // is precisely the span the preference clips, and a rendered width is
          // the only honest test of whether the reader can see it.
          iconWords: (() => {
            if (!b.querySelector('svg')) return false
            const label = b.querySelector('.btn-label, .btn-label-fixed')
            if (!label) return false
            const lr = label.getBoundingClientRect()
            return lr.width > 1 && lr.height > 1
          })(),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      })
  })

  // ---- waiting for the app rather than for the clock ------------------------
  //
  // Every fixed sleep in this file was a guess at how long a screen takes to
  // render, made on an idle machine and then run on one saturated by this very
  // probe. Both of the run that prompted this were wrong in the same direction:
  // a control enumerated on a fast load was "vanished" on a slow one, and a panel
  // that opens in 400ms idle was declared not to have opened. So: poll for the
  // condition, with a ceiling — the ceiling is what keeps a genuinely dead
  // control from costing the whole budget.
  const waitFor = async (fn, ms = 6000, every = 100) => {
    const until = Date.now() + ms
    for (;;) {
      if (await fn()) return true
      if (Date.now() > until) return false
      await new Promise((r) => setTimeout(r, every))
    }
  }

  // SETTLED = the control count has stopped changing. A screen that fetches its
  // rows adds controls as they land, and enumerating mid-flight silently tests a
  // fraction of the surface — a coverage gap that leaves no trace, which is the
  // failure D4 is on the register for. Two identical samples 300ms apart, and a
  // ceiling for a screen that genuinely never stops (a ticking clock; there is
  // none here, but the probe must not hang if one appears).
  const countControls = () => page.evaluate(() => {
    const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
    return scope.querySelectorAll('button, [role=button], a[href], summary').length
  })
  const settled = async (ms = 8000) => {
    const until = Date.now() + ms
    let last = -1
    for (;;) {
      await new Promise((r) => setTimeout(r, 300))
      const now = await countControls().catch(() => -1)
      if (now >= 0 && now === last) return true
      last = now
      if (Date.now() > until) return false
    }
  }

  const surfaces = await resolveSurfaces(page, opts.baseUrl)
  for (const surface of surfaces) {
    if (opts.only && !surface.name.toLowerCase().includes(opts.only.toLowerCase())) continue
    const reopen = async () => {
      await page.goto(opts.baseUrl + surface.route, { waitUntil: 'networkidle2' }).catch(() => {})
      await settled()
      if (!surface.door) return true
      // A DETACHED FRAME IS A RETRY, NOT A CRASH. Pressing a door navigates, and
      // an in-page navigation that lands while an `evaluate` is in flight throws
      // "Attempted to use detached Frame" out of puppeteer — which took down the
      // whole run on its LAST surface and took every finding of both passes with
      // it, because the summary prints after the loop. Fifty minutes of measuring
      // discarded by a race in the measuring.
      // A DOOR MAY TAKE MORE THAN ONE PRESS, and the character panel's does: a
      // film page draws no cast at all — its cast lives in the Details panel — so
      // reaching a character means opening Details first and pressing the
      // character's name inside it. Measured: `.cast-character` is present zero
      // times on `/catalogue/{id}` and the surface reported itself unreachable
      // for as long as the door was one selector.
      //
      // `text` IS OPTIONAL, and its absence used to be a silent miss: this read
      // `x.textContent.includes(d.text)` with `d.text` undefined, and
      // `includes(undefined)` searches for the literal string "undefined" — so a
      // door with no text matched nothing at all and the surface was reported as
      // never opening. A defaulted argument that changes what a predicate MEANS
      // is worse than a missing one.
      const steps = Array.isArray(surface.door) ? surface.door : [surface.door]
      let opened = true
      for (const step of steps) {
        opened = await page.evaluate((d) => {
          const all = [...document.querySelectorAll(d.selector)]
          const b = d.text ? all.find((x) => x.textContent.includes(d.text)) : all[0]
          if (!b) return false
          b.click()
          return true
        }, step).catch(() => 'detached')
        if (opened !== true) break
        await settled()
      }
      if (opened === 'detached') {
        await new Promise((r) => setTimeout(r, 800))
        return await waitFor(() => page.evaluate(() => !!document.querySelector('.tp-panel')).catch(() => false))
      }
      // THE DOOR HAS TO HAVE OPENED. Without this the surface degrades silently
      // to the screen the door is on, and the probe reports the film page's
      // controls under the character panel's name — the same "tested something
      // other than what it said" failure the route check below exists for.
      //
      // WAITED FOR, NOT SLEPT THROUGH. This was a flat 1600ms, and the panel it
      // waits for arrives behind a dynamic import (`identity.jsx`, which pulls in
      // Movies.jsx and cast.jsx) plus the record's own fetch — so under the load
      // this run itself creates, the chip opened the panel a beat after the probe
      // had already decided it had not. It reported the app's one character door
      // as broken on a run where pressing it by hand opens it every time. A gate
      // that reports a defect that is not there gets switched off exactly as fast
      // as one that misses a defect that is.
      if (!opened) return false
      if (!await waitFor(() => page.evaluate(() => !!document.querySelector('.tp-panel')).catch(() => false))) return false
      // AND THEN THE PANEL'S OWN CONTENT. A panel appears the instant it is
      // opened and fetches its record afterwards, so enumerating on the frame it
      // mounted found ONE control — its ✕ — and the surface was reported as
      // "did not render". `settled` scopes to `.tp-panel` when one is open, which
      // is exactly the count that has to stop moving here.
      await settled()
      return true
    }
    if (!await reopen()) {
      // A NAMED SURFACE THAT NEVER OPENED IS A FAILED RUN, not a note. It was
      // filed under `unreachable`, which is report-only — so the one surface in
      // this file that is reached by pressing something could go untested on
      // every run and the exit code would never say so. It belongs with the
      // screens that did not render, for the same reason: nothing on it was
      // tested, and "0 findings" reads as a pass.
      findings.blank.push(`${surface.name}: the door it is reached through (${(Array.isArray(surface.door) ? surface.door : [surface.door]).map((d) => d.selector).join(' → ')}) did not open a panel — nothing on this surface was tested`)
      console.log(`FAIL  ${surface.name.padEnd(14)} door did not open`)
      continue
    }
    // AND THE ROUTE HAS TO BE THE ROUTE. `/people` is not one — `routes.js` falls
    // through to `{ tab: 'home' }` — so this list quietly probed Home twice under
    // two names and reported "People" as a screen with its own findings. A probe
    // that tests something other than what it says it tested is worse than one
    // that skips: its output is wrong rather than short.
    // A DOOR SURFACE HAS ALREADY PROVED ITSELF: `reopen()` refused to continue
    // unless a panel opened. Its route is checked by whichever surface names that
    // route on its own, and opening a panel writes to history, so asking about
    // the path here would ask the wrong question.
    const landed = surface.door ? surface.route : await page.evaluate(() => location.pathname)
    if (landed !== surface.route && !landed.startsWith(surface.route)) {
      findings.notaroute.push(`${surface.name}: /${surface.route.replace(/^\//, '')} resolves to ${landed} — it is not a screen of its own`)
      console.log(`FAIL  ${surface.name.padEnd(14)} ${surface.route} is not a route (landed on ${landed})`)
      continue
    }
    const controls = await list()
    // A SURFACE THAT DREW NOTHING IS A FAILED RUN, NOT A CLEAN ONE. A route that
    // 404s, a fixture without the row the route names, a login that did not take:
    // each leaves an empty page, and "0 controls, 0 that do nothing" reads as a
    // pass on the one line of output anybody looks at. Every screen in this app
    // has a rail, a topbar and a ⋯ before it has any content at all, so a handful
    // of controls is the floor for "this screen rendered".
    if (controls.length < MIN_CONTROLS) {
      findings.blank.push(`${surface.name} (${surface.route}) drew ${controls.length} controls — it did not render, so nothing on it was tested`)
      console.log(`FAIL  ${surface.name.padEnd(14)} did not render (${controls.length} controls)`)
      continue
    }
    for (const w of await sideways()) findings.sideways.push(`${surface.name}: ${w}`)
    for (const h of await headShape()) findings.head.push(`${surface.name}: ${h}`)
    let dead = 0
    for (const c of controls) {
      // The touch floor is a property of the control, not of pressing it.
      if (opts.width <= 480 && (c.w < TOUCH_FLOOR - SLACK || c.h < TOUCH_FLOOR - SLACK) && !c.says) {
        findings.small.push(`${surface.name}: ${JSON.stringify(c.name)} is ${c.w}x${c.h}`)
      }
      // A GLYPH AND ITS WORD DO NOT BOTH FIT ON A PHONE, which is the whole of
      // what the labels preference is for: `auto` resolves to "off" under 768px
      // and clips `.btn-label`. A button that carries an icon AND still prints
      // its words there has opted out of the reader's own setting with
      // `keepLabel` — and every opt-out is a claim that THIS button's word is
      // worth more room than the app's own rule allows.
      //
      // Reported rather than allow-listed, because the report is the review. The
      // owner's case was four picture verbs in the column beside a 96px face:
      // "there is not enough space beside the hero image for icons and texts. i
      // am on phone, and the settings for labels is set at auto. under that,
      // these should have been icon only."
      if (opts.width <= 480 && c.iconWords) {
        findings.labelled.push(`${surface.name}: ${JSON.stringify(c.name)} draws a glyph AND its words at ${c.w}px`)
      }
      if (c.says) continue                          // it said so; that is honest
      if (DESTRUCTIVE.test(c.name) || LEAVES.test(c.href)) continue
      // WHERE YOU ALREADY ARE. Pressing "Home" on Home, or the brand that goes
      // Home from Home, changes nothing and is not a broken control — the
      // destination is simply the current one. Judged by the href, and by the
      // rail row whose own aria-current says it is the one you are on.
      if (c.href && c.href === surface.route) continue
      if (c.current) continue
      await reopen()
      const before = await shot()
      // BY NAME AND OCCURRENCE, NOT BY INDEX. `reopen()` rebuilds the DOM before
      // every press, and an index into the previous build is only valid while
      // exactly the same controls come back in exactly the same order — which a
      // lazily-loaded cover grid and a list whose length depends on a fetch do
      // not promise. Twenty-three controls were reported unreachable on one run
      // for that reason alone, none of them actually gone. The accessible name
      // plus which one of that name it is survives a re-render, which is also how
      // a person would say which control they meant.
      const ok = await page.evaluate(async ({ key, nth }) => {
        const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
        // AND THE PAGE IS WALKED TO THE BOTTOM FIRST. A list that renders as you
        // reach it has not rendered anything below the fold on a fresh load, so a
        // control enumerated after an earlier press had scrolled the surface is
        // simply not in the document yet — which reads as "vanished" and is
        // "not built yet".
        const box = document.querySelector('.tp-panel-body') || document.scrollingElement
        if (box) box.scrollTop = box.scrollHeight
        const find = () => [...scope.querySelectorAll('button, [role=button], a[href], summary')]
          .filter((x) => x.offsetParent !== null || x.tagName === 'SUMMARY')
          .filter((x) => ((x.getAttribute('aria-label') || x.textContent.replace(/\s+/g, ' ').trim() || x.title || '(unnamed)').slice(0, 40)).replace(/\d+/g, '#') === key)
        // A FRAME FOR WHAT THE SCROLL ASKED FOR. Setting scrollTop is synchronous
        // and rendering the rows it brought into view is not, so looking in the
        // same tick finds the same twelve missing tiles it did before the scroll.
        //
        // AND THEN AS LONG AS IT TAKES, up to a ceiling. The single 250ms retry
        // was another guess at a render: on a film page under this probe's own
        // load, a cast chip that is on screen when you look by hand was reported
        // "moved or vanished" because the second look was still too early. Every
        // such report is a false finding in a run whose whole value is that its
        // findings are real.
        let b = find()[nth]
        const until = Date.now() + 4000
        while (!b && Date.now() < until) {
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120)))
          b = find()[nth]
        }
        if (!b) return false
        b.scrollIntoView({ block: 'center' })
        // IT MAY SAY SO NOW EVEN IF IT DID NOT WHEN IT WAS ENUMERATED, and this
        // is not hypothetical: `reopen()` is a fresh navigation, so the dock's
        // Back key — enabled while the probe was walking from surface to surface
        // — is correctly `disabled` on a page opened directly, which is where
        // every press is actually made. Both detail screens reported their Back
        // key as a control that does nothing and does not say so, and it says so.
        // The honest answer is the rule's own escape, read at the moment of the
        // press rather than a screen earlier.
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return 'says'
        // AND SOMETHING MAY BE OVER IT. A click on a covered control lands on the
        // cover, so nothing happens and the control is blamed for it — which is a
        // fact about the layer, not about the button. Reported as unreachable,
        // with what was in the way.
        const r = b.getBoundingClientRect()
        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
        if (hit && hit !== b && !b.contains(hit) && !hit.contains(b)) {
          return `covered:${(hit.className && String(hit.className).slice(0, 40)) || hit.tagName}`
        }
        b.click()
        return true
      }, { key: c.key, nth: c.nth })
      // It says it cannot act, which is honest, and the run moves on.
      if (ok === 'says') continue
      if (typeof ok === 'string' && ok.startsWith('covered:')) {
        findings.unreachable.push(`${surface.name}: ${JSON.stringify(c.name)} is covered by ${ok.slice(8)} — the press would land on that`)
        continue
      }
      // NOT PRESSED IS NOT PASSED. The index is re-resolved after `reopen`, so a
      // control that has moved or gone leaves the press unmade — and a `continue`
      // there quietly drops it from a run whose whole claim is "every control".
      // Reported rather than skipped, for the reason panel-depth.mjs and
      // hero-control.mjs both had to learn: a probe that can silently test
      // nothing is a probe that gets cited as a guard it never was.
      if (!ok) {
        findings.unreachable.push(`${surface.name}: ${JSON.stringify(c.name)} could not be pressed — the control moved or vanished between enumerating and pressing`)
        continue
      }
      pressed++
      // WAITED OUT, NOT SLEPT THROUGH — the same lesson the door already learned
      // one screen up. 900ms alone is a guess at how long an effect takes, and
      // the effects on these screens are not fast: `stack.open` from inside a
      // nested panel asks the browser to traverse history and pushes on the pop,
      // and the panel it then draws arrives behind a dynamic import and a fetch.
      // Under this probe's own load that ran past the sleep, and "Open the global
      // record" — a control that works every time by hand — was reported as one
      // that does nothing and does not say so. The flat wait stays as a floor for
      // effects too small to move the control count; the settle is the ceiling.
      await new Promise((r) => setTimeout(r, 900))
      await settled(4000)
      const after = await shot()
      // AND WHATEVER THE PRESS OPENED, which is where this class of defect
      // actually lives: a panel is the surface whose body has to hold a strip of
      // covers, and the sheet that stretched was one a press opens.
      if (after.panels > before.panels || after.dialogs > before.dialogs) {
        for (const w of await sideways()) {
          const line = `${surface.name} → ${JSON.stringify(c.name)}: ${w}`
          if (!findings.sideways.includes(line)) findings.sideways.push(line)
        }
      }
      if (!differs(before, after)) {
        dead++
        findings.dead.push(`${surface.name}: ${JSON.stringify(c.name)}`)
      } else if (after.menus > before.menus && after.menuItems === before.menuItems) {
        findings.empty.push(`${surface.name}: ${JSON.stringify(c.name)} opened a menu with nothing in it`)
      }
    }
    console.log(`${dead ? 'FAIL' : 'ok  '}  ${surface.name.padEnd(14)} ${String(controls.length).padStart(3)} controls, ${dead} that do nothing and do not say so`)
  }
} catch (err) {
  // WHATEVER KILLED THE LOOP, THE FINDINGS SURVIVE IT. They are the run's whole
  // product and they are printed after the loop, so an exception anywhere in it
  // used to discard every one of them — including a crash on the last surface of
  // the second pass, which is the most expensive place to lose them.
  findings.blank.push(`the run stopped early: ${String(err && err.message ? err.message : err).split('\n')[0]}`)
  console.log(`\nFAIL  the run stopped early — ${String(err && err.message ? err.message : err).split('\n')[0]}`)
} finally {
  await browser.close()
}

console.log(`\n${pressed} presses`)
if (findings.dead.length) {
  console.log(`\n${findings.dead.length} CONTROL(S) DO NOTHING AND DO NOT SAY SO:`)
  for (const d of findings.dead) console.log('  ' + d)
}
if (findings.small.length) {
  console.log(`\n${findings.small.length} UNDER THE ${TOUCH_FLOOR}px TOUCH FLOOR:`)
  for (const d of findings.small) console.log('  ' + d)
}
if (findings.empty.length) {
  console.log(`\n${findings.empty.length} MENU(S) THAT OPEN EMPTY:`)
  for (const d of findings.empty) console.log('  ' + d)
}
if (findings.head.length) {
  console.log(`\n${findings.head.length} PANEL HEADER(S) THAT ARE NOT THE PACK'S:`)
  for (const d of findings.head) console.log('  ' + d)
}
if (findings.labelled.length) {
  console.log(`\n${findings.labelled.length} CONTROL(S) DRAWING A GLYPH AND ITS WORDS ON A PHONE:`)
  for (const d of findings.labelled) console.log('  ' + d)
}
if (findings.sideways.length) {
  console.log(`\n${findings.sideways.length} SURFACE(S) THAT SCROLL SIDEWAYS:`)
  for (const d of findings.sideways) console.log('  ' + d)
}
if (findings.notaroute.length) {
  console.log(`\n${findings.notaroute.length} ROUTE(S) THAT ARE NOT SCREENS:`)
  for (const d of findings.notaroute) console.log('  ' + d)
}
if (findings.blank.length) {
  console.log(`\n${findings.blank.length} SURFACE(S) THAT DID NOT RENDER:`)
  for (const d of findings.blank) console.log('  ' + d)
}
if (findings.unreachable.length) {
  console.log(`\n${findings.unreachable.length} CONTROL(S) THAT COULD NOT BE PRESSED:`)
  for (const d of findings.unreachable) console.log('  ' + d)
}
// ---- WHAT FAILS A RUN, AND WHAT IS ONLY REPORTED ---------------------------
//
// THIS USED TO BE `Object.values(findings).some(l => l.length)`, and that made
// the gate unreachable BY DESIGN. `labelled` is a report bucket — its own comment
// says it is "reported rather than allow-listed, because the report is the
// review" — so a run could never exit 0 while any control anywhere drew a glyph
// beside its words, which is a design question and not a defect. A gate that
// cannot go green is a gate nobody can act on: every run reads FAIL, so the FAILs
// that matter stop being read.
//
// A BUCKET FAILS WHEN THE APP IS LYING TO THE READER: a control that does nothing
// and does not say so, a menu that opens empty, a header that is not the pack's,
// a screen that scrolls sideways, a route that is not a screen, a surface that
// did not render. Each of those is wrong on its face and has one right answer.
const FAILS = ['dead', 'empty', 'head', 'sideways', 'notaroute', 'blank']

// A BUCKET RATCHETS WHEN IT IS DEBT: real, worth paying down, and not something
// one commit can zero. The number is recorded per width and may fall and never
// rise — the same idiom as `typescale-baseline.json` and `spacing-debt.test.js`,
// for the same reason: a count that is allowed to grow is a count nobody reads,
// and a count that must be zero tomorrow is a count somebody suppresses.
const RATCHETS = ['small', 'labelled']

// AND ONE BUCKET IS A REPORT ONLY. `unreachable` is as often a fact about the
// PROBE as about the app — a control behind a scroller the harness did not reach,
// one covered by a layer this run happened to leave open — so failing on it would
// make the gate a measure of the harness's luck. It is printed in full, every
// run, which is what it is for.
const baselineFile = new URL('./controls-baseline.json', import.meta.url)
let baseline = {}
try {
  baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
} catch { /* no baseline yet: the first run writes one with --update-baseline */ }
const key = String(opts.width)
const bar = baseline[key] || {}

// THE BASELINE IS WRITTEN AND THE RUN IS STILL JUDGED. `--update-baseline` used
// to write and exit 0, which made recording a ceiling and checking the app two
// separate half-hour runs against a real library — so in practice the recording
// run was the only one anybody had the patience for, and it reported nothing.
// The flag now only decides where the ratchet's ceiling comes from; every FAIL
// bucket is judged either way.
if (opts.updateBaseline) {
  baseline[key] = Object.fromEntries(RATCHETS.map((k) => [k, findings[k].length]))
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`\nbaseline for ${key}px written: ${RATCHETS.map((k) => `${k} ${findings[k].length}`).join(', ')}`)
  Object.assign(bar, baseline[key])
}

const failed = FAILS.filter((k) => findings[k].length)
// A MISSING CEILING IS NOT A REGRESSION. There is nothing to have risen from, and
// failing there would mean a width nobody has recorded yet can never be run —
// which is how the ratchet would get deleted rather than filled in. It is said
// loudly instead, every run, until somebody records it.
const risen = RATCHETS
  .map((k) => ({ k, n: findings[k].length, was: bar[k] }))
  .filter((r) => r.was !== undefined && r.n > r.was)

console.log('')
for (const k of RATCHETS) {
  const was = bar[k]
  const n = findings[k].length
  if (was === undefined) console.log(`RATCHET  ${k.padEnd(9)} ${n} — no baseline at ${key}px; run with --update-baseline`)
  else console.log(`${n > was ? 'FAIL   ' : 'ok     '} ${k.padEnd(9)} ${n} against a ceiling of ${was} at ${key}px`)
}
for (const r of risen) {
  console.log(`\n${r.k} ROSE${r.was === undefined ? '' : ` from ${r.was} to ${r.n}`} — the number may fall and never rise.`)
}
if (failed.length) console.log(`\nFAIL  ${failed.join(', ')}`)
process.exit(failed.length || risen.length ? 1 : 0)
