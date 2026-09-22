import { coverImgURL } from './api.js'
import { t } from './i18n.js'
import { clipChipName as clip } from './text.js'
import { Face } from './characterRows.jsx'
import { personImgURL, PersonPortrait, splitCredits, usePeople } from './credits.jsx'
import { formatYear, parsePartialDate, ProviderMark, Scroller, Tooltip } from './ui.jsx'

// The person primitives — portrait, credit splitting, the saved-people map —
// live in credits.jsx so the quiz card can draw a face without importing this
// panel. Re-exported here because this is still where a reader looks for them.
export { CharacterFaces, CreditFaces, DEFAULT_CREDIT_SEPS, parseCreditSeps, personImgURL, PersonPortrait, splitCredits, useCharacterFaces, usePeople, usePortraitFill } from './credits.jsx'


// The external references a person can link out to, in display order. A saved
// link is recognised by hostname; everything else renders as a plain URL row.
// The middle column is the KEY that names the provider, not the name itself:
// vocab.source.* already carries these five for the metadata screens, and a
// provider has one name in this app wherever it is drawn.
// THE LIST IS WHAT CAN BE RECOGNISED, NOT WHAT MAY BE ADDED. Every one of these
// has a mark in providerMarks.js and a name in vocab.source.*, so a link to one
// is drawn with its own glyph; a URL matching none of them is kept whole and
// wears the globe, which is a legitimate kind of link rather than a failure — a
// review, an author's own site, a scan somebody hosted. Adding a row here buys a
// glyph and a name, and nothing about it decides what a reader may paste.
export const PROVIDERS = [
  ['imdb', 'vocab.source.imdb.label', /(^|\.)imdb\.com$/i],
  ['tmdb', 'vocab.source.tmdb.label', /(^|\.)themoviedb\.org$/i],
  ['tvdb', 'vocab.source.tvdb.label', /(^|\.)thetvdb\.com$/i],
  ['letterboxd', 'vocab.source.letterboxd.label', /(^|\.)letterboxd\.com$/i],
  ['igdb', 'vocab.source.igdb.label', /(^|\.)igdb\.com$/i],
  ['wikipedia', 'vocab.source.wikipedia.label', /(^|\.)wikipedia\.org$/i],
  // FANDOM SITS ALONGSIDE WIKIPEDIA, NOT INSTEAD OF IT. Wikipedia covers the
  // book; a fandom wiki covers what is inside it — characters, places,
  // timelines — and a reader chasing a name and a reader checking a publication
  // date want different pages. `wikia.com` is the old domain and still redirects.
  ['fandom', 'vocab.source.fandom.label', /(^|\.)(fandom|wikia)\.com$/i],
  ['wikidata', 'vocab.source.wikidata.label', /(^|\.)wikidata\.org$/i],
  ['wikimedia', 'vocab.source.wikimedia.label', /(^|\.)wikimedia\.org$/i],
  ['openlibrary', 'vocab.source.openlibrary.label', /(^|\.)openlibrary\.org$/i],
  // Google BOOKS specifically. A plain google.com result is a search, not a
  // record, and filing one under the name of a catalogue would be a lie about
  // what the link is.
  ['google', 'vocab.source.google.label', /(^|\.)books\.google\.[a-z.]+$/i],
  ['amazon', 'vocab.source.amazon.label', /(^|\.)amazon\.[a-z.]+$/i],
]

// ---- an id, and the page it names ----------------------------------------
//
// PROVIDERS ABOVE RECOGNISES A URL; THIS ONE BUILDS ONE. A reader holding a
// person's IMDb id has to know that the page is /name/<id>/ and not /person/ or
// /people/ before they can paste anything, which is a thing the app already
// knows and was making them look up. So the popup takes the id and the provider
// and writes the address itself.
//
// EVERY PATTERN HERE IS THE SERVER'S, copied rather than derived:
// internal/metadata/people.go builds exactly these three when it resolves a
// portrait, so a link typed in by hand and a link fetched from TMDB are the same
// string. A second spelling of the same page would give one person two pills.
//
// AMAZON IS THE AUTHOR PAGE, on the owner's ruling, and it is the one Amazon URL
// that is about a PERSON. An ASIN names a product, so /dp/<asin> would file a
// book under the person whose sheet the link is on — which is a lie about what
// the link is, the same argument PROVIDERS makes for filing a Google result
// under `books.google` and not `google`.
//
// IGDB IS DELIBERATELY ABSENT, also the owner's call. The repo knows
// igdb.com/companies/<slug> and nothing about a person page there; a guessed
// pattern is worse than no entry, because a pasted IGDB URL is still recognised
// by PROVIDERS and still draws its own pill.
export const PROVIDER_ID_LINKS = [
  // ---- ANYWHERE ON THE WEB, AND IT IS THE ONE THE SHEET OPENS ON ----
  //
  // "the add links doesn't let me enter any link i want. there should be a custom
  // option" — and there was not one: four curated id spaces and no way to add a
  // Wikipedia page, a fandom wiki or somebody's own site from the sheet whose
  // title is "Add a link". THE DEFAULT, on the owner's instruction, because it is
  // the choice that cannot be wrong: a curated address pasted here is RECOGNISED
  // and filed under its own provider (see `detectProviderLink`), so the reader
  // never has to know which pill their link belongs to before they can paste it.
  ['any', 'custom', 'identity.link.id.provider.custom', 'identity.link.id.hint.custom',
    (url) => url,
    { accept: acceptWebAddress, example: 'identity.link.id.example.custom', inputMode: 'url' }],
  // ---- a PERSON's own pages ----
  //
  // EVERY RULE BELOW WAS CHECKED BEFORE IT WAS ENFORCED, which the owner asked
  // for in those words — a validator that rejects a valid id is worse than none,
  // because the reader has a correct answer and no way to give it.
  ['person', 'imdb', 'vocab.source.imdb.label', 'identity.link.id.hint.imdb',
    (id) => `https://www.imdb.com/name/${encodeURIComponent(id)}/`,
    { accept: acceptIMDbName, example: 'identity.link.id.example.imdb' }],
  ['person', 'tmdb', 'vocab.source.tmdb.label', 'identity.link.id.hint.tmdb',
    (id) => `https://www.themoviedb.org/person/${encodeURIComponent(id)}`,
    { accept: acceptDigits, example: 'identity.link.id.example.tmdb', inputMode: 'numeric' }],
  // NOT NUMERIC, and this is the one the "check before you enforce" caught.
  // TheTVDB's modern person pages are `/people/<slug>` — `/people/rajesh-khanna`
  // — and the numeric form is the older one; the app's own hint has said "the
  // number OR slug" since the popup was written. A numeric-only rule here would
  // reject the address the site actually gives you today.
  ['person', 'tvdb', 'vocab.source.tvdb.label', 'identity.link.id.hint.tvdb',
    (id) => `https://thetvdb.com/people/${encodeURIComponent(id)}`,
    { accept: acceptSlug, example: 'identity.link.id.example.tvdb' }],
  ['person', 'amazon', 'vocab.source.amazon.label', 'identity.link.id.hint.amazon',
    (id) => `https://www.amazon.com/stores/author/${encodeURIComponent(id)}`,
    { accept: acceptASIN, example: 'identity.link.id.example.amazon' }],
  // ---- an ORGANISATION's ----
  //
  // A STUDIO AND A PUBLISHER ARE CREDITED THE WAY A PERSON IS — `unit.role.studio`
  // has been in the role vocabulary since it existed, and person_kinds lets one
  // record hold it — so they get the same sheet and the same popup. What differs
  // is the id space: nobody has an IMDb /name/ page for Electronic Arts.
  //
  // IGDB IS THE ONE PATTERN THE REPO VERIFIES for an organisation
  // (internal/metadata/igdb_company_test.go), which is why it is the only entry
  // here and why it is absent from the person list above. TMDB and IMDb both
  // have company pages and the repo knows neither shape; a guessed one is worse
  // than no entry, because a pasted URL is still recognised by PROVIDERS and
  // still draws its own pill.
  ['company', 'igdb', 'vocab.source.igdb.label', 'identity.link.id.hint.igdb',
    (slug) => `https://www.igdb.com/companies/${encodeURIComponent(slug)}`,
    { accept: acceptSlug, example: 'identity.link.id.example.igdb' }],
]

// ---- WHAT EACH ID SPACE ACTUALLY LOOKS LIKE ---------------------------------
//
// Each `accept` takes whatever the reader typed or pasted and returns THE ID, or
// '' if that is not one. Two jobs in one function, deliberately: the reader who
// pastes `https://www.imdb.com/name/nm0000007/` and the reader who types
// `nm0000007` mean the same thing, and a validator that takes the second and
// rejects the first is a rule the reader has to work around by hand.

// An IMDb person is `nm` and then digits — seven historically, eight on anything
// catalogued this decade. The repo's own title rule is `^tt[0-9]{7,9}$`
// (internal/metadata/imdb.go:71) and names grow the same way, so the ceiling is
// set one wider than that rather than at today's longest.
function acceptIMDbName(raw) {
  const m = String(raw).match(/nm(\d{7,10})\b/i)
  return m ? `nm${m[1]}` : ''
}

// TMDB people are numbered, and their addresses carry an optional slug tail
// (`/person/10859-ryan-reynolds`). The number alone resolves, so the tail is read
// and dropped rather than stored — one id for one person however it was pasted.
function acceptDigits(raw) {
  const m = String(raw).trim().match(/^(?:.*\/person\/)?(\d+)/)
  return m ? m[1] : ''
}

// A slug id: letters, digits and the separators a URL path segment may hold. Used
// for TheTVDB (see the note at its row) and for IGDB companies, both of which
// name their pages rather than numbering them.
function acceptSlug(raw) {
  const m = String(raw).trim().match(/^(?:.*\/(?:people|companies)\/)?([A-Za-z0-9][A-Za-z0-9._-]*)\/?$/)
  return m ? m[1] : ''
}

// An Amazon author store is keyed by an ASIN: ten characters of digits and
// capitals. Lower case is accepted and raised, because a hand-typed id arrives
// however the reader's keyboard left it.
function acceptASIN(raw) {
  const m = String(raw).trim().match(/(?:^|\/)([A-Za-z0-9]{10})(?:$|[/?#])/)
  return m ? m[1].toUpperCase() : ''
}

// The custom row: an absolute web address and nothing else. A bare host is the
// common paste, so `example.com/x` is read as https rather than refused — but a
// `javascript:` or `data:` URL is not a link to somewhere and is rejected here
// rather than stored and drawn as a pill.
function acceptWebAddress(raw) {
  const s = String(raw).trim()
  if (!s || /\s/.test(s)) return ''
  for (const cand of [s, `https://${s}`]) {
    try {
      const u = new URL(cand)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
    } catch { /* not a URL in this shape; try the next */ }
  }
  return ''
}

// providerRule — the options object for one slug, or an empty one. Callers read
// `accept`, `example` and `inputMode` off it.
export function providerRule(slug) {
  const row = PROVIDER_ID_LINKS.find(([, sl]) => sl === slug)
  return (row && row[5]) || {}
}

// acceptProviderID — the id one provider will take from what the reader typed, or
// '' if it will take none of it.
export function acceptProviderID(slug, raw) {
  const rule = providerRule(slug)
  const clean = String(raw || '').trim()
  if (!clean) return ''
  return rule.accept ? rule.accept(clean) : clean
}

// detectProviderLink — "if i paste a curated link in the custom input, the app
// should recognise it and file accordingly."
//
// THE HOST DECIDES, not the id's shape. `10859` is a TMDB person and a TVDB
// person and an IGDB company, so a bare id can only be what the chosen pill says
// it is — but a PASTED ADDRESS names its own site, and filing it under `custom`
// when the app has a row for that site would store a second spelling of a link it
// already knows how to draw a mark for.
//
// It answers `null` for anything that is not one of the curated addresses, which
// is the ordinary case: the custom row keeps it verbatim.
const PROVIDER_LINK_HOSTS = [
  [/(^|\.)imdb\.com$/i, /\/name\//, 'imdb'],
  [/(^|\.)themoviedb\.org$/i, /\/person\//, 'tmdb'],
  [/(^|\.)thetvdb\.com$/i, /\/people\//, 'tvdb'],
  [/(^|\.)amazon\.[a-z.]+$/i, /\/author\//, 'amazon'],
  [/(^|\.)igdb\.com$/i, /\/companies\//, 'igdb'],
]

export function detectProviderLink(raw) {
  const s = String(raw || '').trim()
  if (!s || !/^https?:\/\//i.test(s)) return null
  let u
  try { u = new URL(s) } catch { return null }
  for (const [host, path, slug] of PROVIDER_LINK_HOSTS) {
    if (!host.test(u.hostname) || !path.test(u.pathname)) continue
    const id = acceptProviderID(slug, u.pathname)
    if (id) return { slug, id }
  }
  return null
}

// ORGANISATION_ROLES are the credits that name a company rather than a human.
// The role vocabulary is the app's own (work_person.role), so this is a filter
// over it and not a second list of nouns to keep in step.
const ORGANISATION_ROLES = new Set(['studio', 'publisher'])

// isOrganisationKind — is this PERSON KIND a company? The kind vocabulary is the
// server's (`personKinds` in people_handlers.go), where a studio and a publisher
// are kinds of their own.
export function isOrganisationKind(kind) {
  return ORGANISATION_ROLES.has(String(kind || '').trim().toLowerCase())
}

// creditKind — which person kind ONE CREDIT ROW names.
//
// THE MEDIA TYPE IS LOAD-BEARING HERE, and leaving it out is the whole reason
// this function exists rather than a `.role` read. `work_person.role` is
// `director` for BOTH a film's director and a game's studio, because
// movies.director holds both facts and media_type is the only thing telling them
// apart — the split every query in people_handlers.go carries, and there is no
// `RoleStudio` for it to carry instead.
//
// So a predicate reading the role alone answers "person" for Electronic Arts,
// which is precisely the sentence this app keeps recording as its own bug: a
// screen asking a studio when it was born. A publisher is the easy half — its
// column is its own, so its role really is `publisher`.
export function creditKind(credit) {
  const role = String(credit?.role || '').trim().toLowerCase()
  if (role === 'director' && String(credit?.media_type || '').trim().toLowerCase() === 'game') {
    return 'studio'
  }
  return role
}

// isOrganisation — does this record name a company rather than a person?
//
// ONE ANSWER, THREE READERS: which id spaces the link popup offers, whether a
// record is founded or born, and which noun its page is headed by. Those were
// three separate `kind === 'studio'` tests before the publisher arrived, which is
// three places to forget the second company role.
//
// IT TAKES THE CREDIT ROWS, not their roles, and that is not a convenience: the
// rows are what carry the media type, and without it a studio is indistinguishable
// from a director. `person_kinds` is NOT the source either, tempting as the
// `kinds` field on the record looks — a record created by a credit sync has
// nothing in that table, so it arrives empty for exactly the companies this
// question is about.
//
// A record with no credits yet reads as a person, and that is the safer default
// rather than an oversight: it is the overwhelming majority, and a company
// nobody has credited yet is a page with one wrong word on it, where an author
// offered a company's id space is a list that cannot work.
export function isOrganisation(credits = []) {
  return (credits || []).some((c) => isOrganisationKind(creditKind(c)))
}

// providerLinksFor — which of the entries above this record can use, from the
// credits it actually holds. A record with no credits yet is treated as a person,
// which is the overwhelming majority and the safer default: offering a company
// id space to an author is a wrong list, where offering a person's to a studio
// that has not been credited yet is a list they will not use.
export function providerLinksFor(credits = []) {
  const org = isOrganisation(credits)
  // `any` is on every list: the custom row is a link to the open web and has no
  // id space to be wrong about.
  return PROVIDER_ID_LINKS.filter(
    ([forKind]) => forKind === 'any' || forKind === (org ? 'company' : 'person'),
  )
}

// buildProviderLink — the address for one (provider, id), or '' when there is no
// such provider, nothing has been typed, or what was typed is NOT AN ID OF THAT
// SPACE.
//
// The last clause is the enforcement the owner asked for, and it lives here
// rather than in the form so that every caller gets it: an address is built out
// of the id the provider will accept, so `nm0000007` typed under TMDB now
// produces no address at all rather than `/person/nm0000007`, which is a page
// that does not exist and a pill the reader only finds is dead by pressing it.
export function buildProviderLink(slug, id) {
  const ok = acceptProviderID(slug, id)
  if (!ok) return ''
  const row = PROVIDER_ID_LINKS.find(([, sl]) => sl === slug)
  return row ? row[4](ok) : ''
}

// A LINK MAY CARRY A NAME, AND THE PIPE IS WHERE IT STARTS.
//
// The owner chose "'Add a link' takes a URL with an optional label". A record's
// links are ONE free-text field of newline-separated URLs — the same field on a
// work, a person and a character — so a label per link needs somewhere to live
// that does not make a second thing to store, a second column to migrate, and a
// third meaning for a field two other screens already read.
//
// A PIPE CANNOT APPEAR IN A URL. Neither can a space, but a space already means
// something here: this field has always whitespace-split, so `a.com b.com` on one
// line is TWO links and always was. Reading the second half as a label would
// quietly rename somebody's link. `|` has never been legal in an address and has
// never been written into this field, so a line that has one is unambiguously
// new and a line that has none reads exactly as it always did — which is the
// whole of the migration.
export const LINK_LABEL_SEP = '|'

// linkLine writes one back. The one writer, so a label cannot be stored two ways.
export function linkLine(url, label) {
  const name = String(label || '').trim()
  return name ? `${url} ${LINK_LABEL_SEP} ${name}` : String(url)
}

// parseLinks splits the stored free-text links field into recognised provider
// pages (slug → url, first hit per provider wins), the unrecognised rest, and the
// names the reader gave any of them (url → label, absent where they gave none).
export function parseLinks(text) {
  const known = {}
  const extra = []
  const labels = {}
  const take = (tok, label) => {
    let host = ''
    try {
      host = new URL(tok).hostname
    } catch {
      // Not an address at all. Kept rather than dropped — see linkPills — but it
      // gets no label, because a label names a link and this is not one.
      extra.push(tok)
      return
    }
    const p = PROVIDERS.find(([, , re]) => re.test(host))
    if (p && !known[p[0]]) known[p[0]] = tok
    else extra.push(tok)
    if (label) labels[tok] = label
  }
  for (const line of String(text || '').split('\n')) {
    const cut = line.indexOf(LINK_LABEL_SEP)
    const head = cut < 0 ? line : line.slice(0, cut)
    const label = cut < 0 ? '' : line.slice(cut + 1).trim()
    // A LINE IS EVERY ADDRESS ON IT, WHETHER OR NOT A NAME FOLLOWS. `linkLine`
    // writes one address per line, but this field is free text somebody types
    // into and `a.com b.com` on one line has ALWAYS been two links — the reason
    // the separator is a pipe and not a space, argued in the note above. Reading
    // the whole head as one address turned both of them into a single token that
    // is not a URL: two working links became one dead chip, and the name went
    // with them. Split first, always; the name is what comes after.
    const tokens = head.split(/\s+/).filter(Boolean)
    // AND A NAME BELONGS TO THE ADDRESS IT SITS BESIDE. Spreading it over every
    // token on the line would put one name on two different links, which is the
    // renaming this design exists to prevent; dropping it would lose what the
    // reader typed. The last token is the one the ` | Name` was written against.
    tokens.forEach((tok, i) => take(tok, i === tokens.length - 1 ? label : ''))
  }
  return { known, extra, labels }
}

// hostOf — the only honest name for an address nobody has named. Falls back to
// the token as typed, because a line that is not an address is still something
// the reader put there.
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return String(url)
  }
}

// namedLinks — WHAT A LINK IS CALLED, answered once for every screen that draws
// one.
//
// THE REPO DIRECTIVE THIS EXISTS UNDER: "similar things should act similarly …
// A control drawn by one component on two screens has ONE behaviour, and it
// lives in one function that both screens call — not in a line each, which is
// how one of them goes on being right while the other quietly stops." That is
// exactly what happened here. Three screens drew a record's links and each
// worked out the name itself: the work's Links rows and the global record's
// pills both learned to prefer the reader's name, and a person's Details chips
// never did — so a name typed on the person screen was stored, kept through a
// fetch, and then not shown on the screen it was typed on.
//
// WHAT IS THE SAME EVERYWHERE, and is therefore in here: the reader's name
// outranks whatever the app would have called it. They typed it about this link;
// a provider's name is only what the app knows when nobody has said.
//
// WHAT GENUINELY DIFFERS IS PASSED IN. A screen drawing rows in a list calls an
// unnamed foreign link "Web"; a screen drawing pills calls it by its host. That
// is a real difference between the two surfaces, so it arrives as `web` rather
// than as a second copy of the rule.
//
// `label` AND `name` ARE NOT THE SAME FIELD, and collapsing them is how a
// rewrite of this field turns a provider's own name into a stored label. `name`
// is what to DRAW. `label` is only ever what is STORED, so a caller that rejoins
// the field writes back what was there.
export function namedLinks(text, { web = hostOf } = {}) {
  const { known, extra, labels } = parseLinks(text)
  return [
    ...PROVIDERS.filter(([slug]) => known[slug]).map(([slug, labelKey]) => ({
      url: known[slug],
      slug,
      label: labels[known[slug]] || '',
      name: labels[known[slug]] || t(labelKey),
    })),
    ...extra.map((url) => ({
      url, slug: '', label: labels[url] || '', name: labels[url] || web(url),
    })),
  ]
}

// mergeLinks folds freshly-fetched provider links into the stored free-text
// field without disturbing anything the user added by hand: providers land in
// canonical order, existing URLs win, extras keep their place at the end.
export function mergeLinks(text, fetched) {
  const { known, extra, labels } = parseLinks(text)
  const merged = { ...known }
  for (const [slug, url] of Object.entries(fetched || {})) {
    if (url && !merged[slug]) merged[slug] = url
  }
  // THE NAMES SURVIVE THE FOLD. This function rewrites the whole field, so a
  // fetch that did not touch a link would still erase the name the reader gave
  // it — the same class of loss the "existing URLs win" rule above exists to
  // stop, one column over.
  return [...PROVIDERS.map(([slug]) => merged[slug]).filter(Boolean), ...extra]
    .map((url) => linkLine(url, labels[url]))
    .join('\n')
}

// ProviderChips — the compact inline form of the link set (Metadata console
// cells): one small anchor chip per recognised provider.
//
// IT SCROLLS RATHER THAN WRAPS, AND THAT IS WHAT LET IT ONTO A PHONE. The people
// console drew this behind `{!mobile && …}`, so a phone reader could not see which
// providers a person was linked to at all — on the one screen whose whole subject
// is which providers a person is linked to. The pack draws them at every width.
//
// THE GATE WAS TREATING A SYMPTOM. Five chips in a wrapping flex take three lines
// at 390px, which turns every row of a ninety-row list into a paragraph — so the
// row was fixed by deleting the content. The repo's own rule is the other repair:
// a row that can overflow scrolls under a measured edge fade, never bare
// `overflow` and never a wrap. `Scroller` measures, so a person with one link
// wears no fade and a desk at full width is unchanged.
export function ProviderChips({ links, marks = false }) {
  const { known } = parseLinks(links)
  const items = PROVIDERS.filter(([slug]) => known[slug])
  if (items.length === 0) return <span className="microcopy">—</span>
  // MARKS, NOT WORDS, WHERE THE ROW IS TIGHT. The owner, on the people console:
  // "Instead of name chips for providers, can't you use icons?" Eight suppliers
  // spelled out — IMDb, TMDB, TheTVDB, Letterboxd, Wikipedia, Wikidata, Open
  // Library, Google Books — is most of a row's width spent on a vocabulary the
  // reader already knows by its marks, and the marks are already vendored and
  // already drawn beside every source on the Sources console.
  //
  // THE NAME IS STILL SAID. `ProviderMark` is a CSS mask and therefore a picture
  // with nothing in it, so the supplier's word moves to the link's accessible
  // name and its tooltip rather than being dropped — the same shape the count
  // rule takes everywhere else in this app: the drawing replaces the WORD on
  // screen, never the word in the name.
  //
  // `marks` IS OPT-IN because this component also draws on a record's own screen,
  // where there is room for the words and a reader is reading rather than
  // scanning. Two things that look the same behave the same; these deliberately
  // do not look the same, because the two sites are not the same question.
  if (marks) {
    return (
      <Scroller as="span" axis="x" className="provider-chips provider-chips-marks">
        {items.map(([slug, labelKey]) => (
          <Tooltip key={slug} label={t(labelKey)}>
            <a
              className="provider-mark-link tactile"
              href={known[slug]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(labelKey)}
            >
              <ProviderMark source={slug} size={16} />
            </a>
          </Tooltip>
        ))}
      </Scroller>
    )
  }
  return (
    <Scroller as="span" axis="x" className="provider-chips">
      {items.map(([slug, labelKey]) => (
        <a key={slug} className="tp-chip tp-chip-btn" href={known[slug]} target="_blank" rel="noopener noreferrer">
          {t(labelKey)}
        </a>
      ))}
    </Scroller>
  )
}


// PersonName renders a name as a link that opens the person's screen.
//
// onOpen IS GIVEN THE RECORD AS WELL AS THE NAME — { kind, name, person } — and
// that third key saves the opener a round trip. `usePersonOpener` needs an id to
// push the pack's panel; where the chip already carries the record it has one, and
// where it does not, `POST /people/ensure` files the row and hands one back. It is
// an optimisation now rather than a fork: both paths land on the same screen.
//
// IT HANDED BACK ONLY { kind, name } FOR A RELEASE AFTER PersonChip stopped, and
// the two disagreeing is the whole of a report: every credit drawn as a
// PersonCredit — a favourite's expanded tile, a book's author line, a film's
// director — opened the surface that has since been deleted, while a chip on the
// same person opened the pack's. The person screens looked absent rather than
// unreachable, because nothing on the way there says which of two you will get.
//
// `person` is optional and a caller that does not have one is unchanged: an
// undefined third key routes exactly as the two-key call did.
export function PersonName({ kind, name, person, onOpen, className = 'tp-link', style, children }) {
  if (!name) return null
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        onOpen({ kind, name, person })
      }}
      title={`${name} — details`}
    >
      {children || name}
    </button>
  )
}


// CreditFaces / CharacterFaces / FaceStack MOVED TO credits.jsx (see there), and
// are re-exported below so the four screens that draw a face cluster are
// untouched. The reason is the one credits.jsx was split out for in the first
// place: the quiz card wants portraits, and back when this file was a SCREEN —
// the metadata panel, its form, its merge flow — importing it from review.jsx
// would have closed a cycle (review → people → review, through usePractice).
// The screen is gone and the cycle with it, but the split is still right: a file
// of credit primitives is a smaller thing to import than one of surfaces.

// PersonCredit — the canonical person-in-a-credit-line: a round portrait (when
// one is saved) beside the name as a button that opens the metadata panel. ONE
// class for every credited person, so author / actor / director / creator
// displays place and style identically wherever a credit line names someone;
// `kind` is the subclass handed to onOpen. `person` is the resolved metadata row
// (a usePeople map lookup); pass nameClassName / nameStyle to match the host
// line's type (e.g. the amber-mono voice on the film pages).
export function PersonCredit({ kind, name, person, size = 28, onOpen, nameClassName, nameStyle, className = '' }) {
  if (!name) return null
  return (
    <span className={('inline-flex items-center gap-1.5 ' + className).trim()} style={{ verticalAlign: 'middle' }}>
      <PersonPortrait person={person} size={size} />
      {/* THE RECORD RIDES THROUGH. PersonCredit already resolves it for the
          portrait, so withholding it from the name was the door and the face
          disagreeing about the same person. */}
      <PersonName kind={kind} name={name} person={person} onOpen={onOpen} className={nameClassName} style={nameStyle} />
    </span>
  )
}

// PersonChip — one credit, as the design pack draws it: a pill carrying a small
// round face and the whole name, in a row that scrolls sideways under its fade.
//
// A CHIP RATHER THAN A LINK IN A SENTENCE. The hero used to read
// "Herman Melville · translator Anna · 1851 · Whales #2" — one line where a
// person, a role word, a year and a series all looked alike, and the only thing
// separating a name from a number was a middle dot. Each person is an object
// now: their own hit target, their own face, their own door.
//
// NO ELLIPSIS ON A PERSON, which is the standing rule and the reason `flex: none`
// and `white-space: nowrap` are both here. The chip is allowed to be wider than
// the column; the row it sits in scrolls and wears a measured fade. A name cut to
// "Bulgak…" is the row deciding which part of somebody's name did not matter.
//
// THE FACE IS ALWAYS DRAWN, silhouette when there is no photograph — the pack's
// rule, and it is what keeps the chips a column of equal shapes rather than a
// ragged mix of two designs.
// TWO OPTIONAL PROPS, BOTH FOR THE CHARACTER CASE, and neither changes a pixel of
// what a person's chip already draws.
//
// `onPress` — because a character is opened BY ID and a person by name. `onOpen`
// hands back `{kind, name}`, which is what PersonModal takes and what every
// existing caller wants; a `characters` record is reached with its own id, and
// resolving a name to get there is how a reader lands on somebody else's Woland.
//
// `faceName` — WHICH NAME THE FACE IS HASHED FROM, which is not always the name
// printed on the chip. The pack is explicit (handoff 1.8): hash the canonical
// name, never the billing, "otherwise a person changes face between two books". A
// novel billing "the professor" and a film billing "Woland" are one record, and
// the two must wear one face. So the label takes the billing and the silhouette
// takes the record's name, defaulting to the label where there is only one name —
// which is every existing caller, unchanged.
//
// `faceSrc` — AN ALREADY-RESOLVED PICTURE, because a character's is not a person's.
// `person.image_path` goes through personImgURL and a character's still goes
// through the cover builder instead — cast.jsx has always drawn it that way, since
// the two live under different roots. Resolving it at the call site is honest:
// the alternative is this component importing a second URL builder and choosing
// between them on a `kind` string, which is a branch that would be wrong the first
// time a third kind of picture appeared.
// `sub` — A SECOND LINE, and the reason the chip has one. A film line's speaker is
// two facts, the character and whoever played them, and one line held both as
// "Woland — Oleg Basilashvili": long, and on a card beside three other chips it
// read as a single unfamiliar name with punctuation in it. Stacked, the eye takes
// the character first and the actor as the caption it is, which is the order a
// reader wants them in.
//
// `clip` — AND THIS ONE DEPARTS FROM A STANDING RULE, on the owner's instruction.
// "Never truncate a name" is the pack's, and it is right nearly everywhere: a
// shortened name and a short name look alike. Here the chips must not wrap — a row
// that reflows moves every other chip when one name is long — and a scroller per
// chip inside a row of chips is a gesture nobody would find. So a long name ends
// in an ellipsis with the whole of it on the `title`, and this is recorded as a
// departure in Design-decisions.md rather than left to look like an oversight.
// The clip itself is in text.js — see the note there on why one number serves two
// chip rows, and Design-decisions.md for the departure it is.

export function PersonChip({ kind, name, person, onOpen, onPress, title, faceName, faceSrc, sub }) {
  if (!name) return null
  const full = sub ? `${name} — ${sub}` : name
  // EVERY CHIP IS A BUTTON — the owner's ruling, in their words: "all chips will
  // be buttons as well! that's their function." A chip names a character and a
  // character has a screen; the row is a row of doors.
  //
  // A SPAN WAS TRIED AND OVERRULED. The argument for it was that a chip with
  // nothing behind it takes a tab stop and is announced as a press that never
  // happens — true, and the answer is to give it something behind it rather than
  // to demote it. What is left of that reasoning is the one case below where a
  // press genuinely has no destination: the handler is still attached, so the
  // press never falls through to whatever the chip is drawn inside.
  const opens = onPress || onOpen
  return (
    <button
      type="button"
      className={'person-chip tactile' + (sub ? ' is-stacked' : '')}
      title={title || `${full} — details`}
      // STOPPED WHETHER OR NOT IT OPENS. A chip is drawn inside things that are
      // themselves pressable, and a chip press that also toggled the card under
      // it would be two answers to one click.
      onClick={(e) => {
        e.stopPropagation()
        if (onPress) onPress()
        // `person` RIDES ALONG, because a name is not enough to open the record:
        // the pack's person screen is reached by id (`/people/id/{id}`). Where the
        // chip has the row it saves the opener a call; where it does not,
        // `POST /people/ensure` files one. Only the chip knows which.
        else onOpen?.({ kind, name, person })
      }}
      // A chip with no destination is still a chip, and says so rather than
      // looking identical to one that opens.
      aria-disabled={opens ? undefined : true}
    >
      <Face
        src={faceSrc || (person?.image_path ? personImgURL(person.image_path) : '')}
        name={faceName || name}
        url={(x) => x}
        className="person-chip-face"
      />
      {/* THE CLIP STAYS. It is the app's one deliberate truncation and the owner
          ruled on it — the reason is in `.person-chip-name`'s own comment: chips
          here must not wrap, because a reflow moves every other chip when one
          name is long, and the whole name is on the button's `title`. */}
      {sub ? (
        <span className="person-chip-lines">
          <span className="person-chip-name">{clip(name)}</span>
          <span className="person-chip-sub">{clip(sub)}</span>
        </span>
      ) : (
        <span className="person-chip-name">{clip(name)}</span>
      )}
    </button>
  )
}

// SpeakerChips — EVERY CHARACTER NAMED ON A LINE GETS A CHIP OF ITS OWN.
//
// WHAT THIS REPLACES, and the code it replaces said so itself: a line with one
// resolvable speaker drew one chip, and an ensemble line — several characters,
// which the linker deliberately refuses to guess between — drew a row of small
// FACELESS DISCS instead. "An ensemble line names several characters, the linker
// refuses to guess between them, and then this row is the only thing saying who
// is in it." A stack of discs says how MANY people are in a line and not one of
// their names, which is the one thing a reader wants from it.
//
// So the row is chips now, one per name, in the order the reader typed them.
//
// NO NEW DATA. `character_images` has ridden the quote payload since the cast
// pass and is already one entry per named character, each with the picture stored
// for them — the server splits on the reader's own separators and folds each name
// against the work's cast, because the fold cannot be done in SQL and must not be
// done twice (cast_images.go). This draws what was already arriving.
//
// THE DOOR STAYS WHERE THERE IS ONE. `speaker_cast` is the stored link — who
// SPOKE the line, exactly one or none — and it is the only entry that carries a
// character record, whoever played them, and therefore a page to open. That chip
// keeps its two lines and its press; the rest are a face and a name, which is
// what the discs were trying to be. A chip that opened nothing would be the dead
// control cast.jsx and the single chip already refuse to draw.
//
// IT SCROLLS UNDER A FADE rather than wrapping. A card's chip row is beside the
// quote, and a row that wraps to three lines pushes the words a reader came for
// down the card — so it is a Scroller, measured, which is the app's standing rule
// for anything that might not fit.
// `withActor` — WHETHER THE CHIP CARRIES THE PERFORMER UNDER THE CHARACTER, and
// it is the caller's answer because only the caller knows what else its card
// prints. The rule it serves is "a fact appears once per card".
//
// NO CALLER SAYS `false` TODAY, AND THAT IS THE ANSWER RATHER THAN AN OVERSIGHT.
// This paragraph used to argue the opposite — that the film frame names the
// performer on a credit line below, so the subtitle was the same name twice —
// and the owner reversed it twice over: "the actor is named below, not in the
// pill", then "still 2 lines everywhere instead of the actor in the pill". The
// duplication was real and the half that goes is the LINE. Every card that draws
// these chips now drops what they already say (`creditsNotOnChips`), so the chip
// is where the pairing lives and the flag's `false` leg is kept for a caller that
// genuinely prints the performer somewhere the chips cannot cover.
// `one-fact-per-card.test.jsx` holds both legs, and asserts the film frame has
// not gone back to asking for a chip with no performer on it.
export function SpeakerChips({ images = [], speaker = null, onOpenCharacter = null, className = '', withActor = true }) {
  const rows = chipRows(images, speaker, onOpenCharacter, { withActor })
  if (rows.length === 0) return null
  return (
    // A SPAN, because this row draws inside the favourite tile's button on Home
    // and a div is not allowed there. `.speaker-chips` sets `display: flex`, so
    // the element makes no difference to the layout.
    // `className` is the CALLER'S spacing, not the row's: the film frame puts a
    // step above the row and the book card does not, because on the book card the
    // block above it already carries one. The row owns everything inside it and
    // nothing outside it.
    <Scroller as="span" axis="x" className={('speaker-chips ' + className).trim()}>
      {rows.map((r) => (
        <PersonChip
          key={r.key}
          kind="character"
          name={r.name}
          // The billing prints and the RECORD's name is hashed for the
          // silhouette — handoff 1.8, so one character does not change face
          // between a novel and its adaptation.
          faceName={r.faceName}
          faceSrc={r.faceSrc}
          sub={r.sub}
          title={r.title}
          onPress={r.onPress}
        />
      ))}
    </Scroller>
  )
}

// chipRows folds the stored speaker into the list of named characters.
//
// THE SPEAKER LEADS, because who said it is the first thing about a line and the
// rest are who else is in it. It is matched by FOLDED NAME rather than by
// position: the speaker link is stored and the names are typed, so the two agree
// on spelling only after the same fold the server used.
//
// A SPEAKER NAMED NOWHERE ON THE LINE IS STILL DRAWN. It is a stored fact and the
// line's text is free — somebody may have edited the words and left the link — so
// dropping it would hide the one thing about the line the app is sure of.
// PeopleChips — the same row, for PEOPLE rather than characters.
//
// THE OWNER'S RULING: "the author/speaker etc should also be pilled like this on
// home favourites section (not needed in work details because we are already
// reading the works of a specific author there)." A film line's favourite tile
// names its characters; a book's names its author and a standalone quote names
// whoever said it, and those were a row of faceless discs — which says how MANY
// people are behind a line and not one of their names, the same complaint that
// retired the discs beside the quote cards.
//
// A SEPARATE COMPONENT AND NOT A FLAG ON SpeakerChips, because the two rows are
// about two different tables. A character chip opens the work-level character
// popup, keyed on a cast row; a person chip opens that person's record, keyed on
// nothing but their name — the panel resolves it. Folding them together would
// mean one component with two destinations and two id shapes.
export function PeopleChips({ names = [], map = {}, kind = 'author', onOpen = null, className = '' }) {
  if (!names.length) return null
  return (
    <Scroller as="span" axis="x" className={('speaker-chips ' + className).trim()}>
      {names.map((n) => (
        <PersonChip
          key={n}
          kind={kind}
          name={n}
          person={map[n]}
          faceName={n}
          title={t('common.quote.named.tip', { name: n })}
          onOpen={onOpen || undefined}
        />
      ))}
    </Scroller>
  )
}

export function chipRows(images, speaker, onOpen, { withActor = true } = {}) {
  const sp = speaker && speaker.name ? speaker : null
  const spKey = sp ? creditKey(sp.name) : ''
  const out = []
  if (sp) {
    out.push({
      key: 'speaker',
      name: sp.name,
      faceName: sp.record_name || sp.name,
      // THE FACE FALLS BACK TO THE ACTOR'S: a character with no picture of their
      // own wears the face of whoever played them rather than no face at all.
      faceSrc: sp.image ? coverImgURL(sp.image) : sp.actor_image ? coverImgURL(sp.actor_image) : '',
      sub: withActor ? (sp.actor || '') : '',
      title: t('common.quote.speaker.tip', { name: sp.name }),
      // THE HANDLER IS THE ONE THIS FUNCTION WAS HANDED, and reading it off the
      // speaker object instead is the whole of a report: "the character pills
      // still don't open anything".
      //
      // `speaker.onOpen` was a key HOME did not set, and Home alone — an earlier
      // note here claimed no caller set it and that was wrong in scope, which is
      // worth correcting rather than quietly dropping. The Library's book card
      // and the film frame both spread it onto their speaker object
      // (`Library.jsx`, `Movies.jsx`); Home passed `speaker_cast` straight off
      // the wire. So the stacked chip — the character with its performer under
      // it, the one a reader presses first — was dead on the favourites wall and
      // live on the other two, which is why it read as "some pills work and some
      // don't" rather than as one broken component.
      //
      // Reading the parameter is still the right shape: it is what the named rows
      // below already use, so one handler now serves the whole row and the two
      // callers that were compensating no longer have to.
      //
      // `sp` already carries what the caller needs: quoteSpeakerCast serves
      // cast_id, character_id, name and record_name. The named rows below build
      // that shape by hand from their own columns; this row IS that shape.
      onPress: sp.character_id && onOpen ? () => onOpen(sp) : undefined,
    })
  }
  // DUPLICATE NAMES FOLD. A reader who typed "Woland, Woland" made a mistake, and
  // two identical chips beside each other look like a rendering fault rather than
  // like their typing. The speaker's key seeds the set, which is also what keeps
  // it from being drawn twice.
  const seen = new Set(spKey ? [spKey] : [])
  for (const c of images || []) {
    const name = (c?.name || '').trim()
    const key = creditKey(name)
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push({
      key: 'named:' + name,
      name,
      faceName: name,
      // THE SAME LADDER THE SPEAKER CLIMBS: the still of the role, then the
      // performer's headshot, then the hashed silhouette. It read differently on
      // the two chips of one card — the speaker wore Audrey Hepburn's face and
      // the character beside her a silhouette — for no reason except that the
      // performer had not been carried this far.
      faceSrc: c.path ? coverImgURL(c.path) : c.actor_image ? coverImgURL(c.actor_image) : '',
      castId: c.cast_id || 0,
      characterId: c.character_id || 0,
      // WHO PLAYS THEM, under the name, exactly as on the speaker's chip.
      //
      // This line used to be blank on purpose, and the reasoning was that the app
      // held the pairing for the stored speaker alone. That stopped being true
      // when `work_cast.actor` started riding along with the picture — and while
      // it was true, the cost was a card that drew two character chips and then
      // named both performers AGAIN on a line beneath, which is the duplication
      // the chip exists to end. A name the work's cast does not know still comes
      // back empty and still draws one line.
      sub: withActor ? (c.actor || '') : '',
      title: t('common.quote.named.tip', { name }),
      // THE WORK-LEVEL CHARACTER POPUP, which is what a character chip opens.
      // `cast_id` names the screen rather than `character_id` alone: a work can
      // bill one character twice and the record id does not tell the two apart.
      // A name the work's cast does not know has no row and so no door — the
      // chip is still drawn, since the line names them.
      // AND THE PERFORMER RIDES WITH IT. The chooser this opens asks the owner's
      // three questions — this work's character, the record behind it, "or the
      // people" — and it reads them off the object it is handed. Handing it four
      // fields meant the third question could only ever be answered no, which was
      // survivable while the card printed a PLAYED BY line with a door on it, and
      // is not now that the line goes wherever these chips already name them.
      // AND THE ROLE'S OWN STILL RIDES WITH IT TOO. `faceSrc` above climbs the
      // ladder still-then-headshot; the door was handed only the headshot, so a
      // character photographed IN THE ROLE and with no separate portrait of their
      // performer had a face on the card and a silhouette on the sheet the card
      // opened. That is the second half of "the picker doesn't show any images" —
      // the first half was a resolver applied twice. RAW, not resolved: `Face`
      // calls `coverImgURL` itself, which is what produced `/api/covers//api/…`.
      onPress: c.character_id && onOpen ? () => onOpen({
        cast_id: c.cast_id, character_id: c.character_id, name, record_name: name,
        image: c.path || '',
        actor: c.actor || '', actor_image: c.actor_image || '', actor_id: c.actor_id || 0,
      }) : undefined,
    })
  }
  return out
}

// creditsNotOnChips — of a card's credited people, the ones its chips do NOT
// already print, in the order they were typed.
//
// ONE RULE, ONE IMPLEMENTATION. "What the chip already says does not get a line
// of its own" is the owner's, and it was written twice: the film frame folded it
// into a boolean of its own and the favourites tile never learned it at all, so
// an expanded tile drew "V / William Rookwood · Hugo Weaving" as a chip and then
// Hugo Weaving again underneath with his portrait on. Two readings of one rule is
// how one screen goes on obeying it while the other stops.
//
// IT RETURNS THE LEFTOVERS RATHER THAN A YES/NO, because the honest answer is
// per name. A line can credit two performers while the chips resolve one — the
// names are typed like genres and only the cast rows fold — and dropping the
// whole line there would lose the other name. What the chips cover goes; what
// they do not stays.
export function creditsNotOnChips(names, images, speaker, seps, { withActor = true } = {}) {
  const list = names || []
  if (list.length === 0) return []
  const covered = new Set(
    chipRows(images, speaker, undefined, { withActor })
      .flatMap((c) => (c.sub ? splitCredits(c.sub, seps) : []))
      .map(creditKey),
  )
  if (covered.size === 0) return list
  return list.filter((n) => !covered.has(creditKey(n)))
}

// creditKey folds a typed name the way the server's store.CastKey does for the
// one comparison this file makes — the speaker against the names on the line.
//
// IT IS NOT store.CastKey AND MUST NOT PRETEND TO BE. That fold is Go's, over
// typographic punctuation and Unicode case, and cast_images.go says in capitals
// why it cannot be reimplemented here. What this needs is narrower: whether two
// strings on ONE line are the same name, where both came from the same reader
// typing. Lowercase and collapsed whitespace answers that, and a miss costs one
// duplicate chip rather than a wrong lookup.
// EXPORTED, so the film card can ask the same question about the same names.
// A second fold written next to a caller is how two answers to "are these the
// same name" come to disagree — which the paragraph above already says about the
// Go one, and applies just as well inside this file's own language.
export function creditKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// lifespanLabel renders a person's years: "1920 – 2001" when both are known,
// the bare birth year when only born is set, "d. 2001" when only died is.
//
// Born/died are partial dates (§3f), so a record may hold a full day. The
// lifespan line still shows only the YEAR of each: a person's years are what this
// line is for, and "4 Mar 1920 – 12 Nov 2001" reads as a gravestone next to a
// title. The full precision is kept, and shows in the edit form.
function lifespanLabel(p) {
  // THROUGH THE PARSER, not slice(0, 4). A BCE birth is stored '-0004' and the
  // first four characters of that are '-000'; a 5th-century one is stored '0497'
  // and reads as a typo with the padding still on. formatYear is what turns a
  // signed number back into the era word the reader wrote.
  const year = (v) => {
    const p = parsePartialDate(v || '', { historical: true })
    // AND THE RAW VALUE WHEN IT CANNOT BE READ, because the identity screen's
    // picker stored free text for a release and slice(0, 4) turned "sometime in
    // the 90s" into "some". Showing the words is worse than showing a year and
    // better than showing four characters of one.
    return p ? formatYear(p.year) : String(v || '').trim()
  }
  const b = year(p?.born)
  const d = year(p?.died)
  if (b && d) return t('people.lifespan.range', { born: b, died: d })
  if (b) return b
  if (d) return t('people.lifespan.died', { died: d })
  return ''
}

// PersonView, PersonLinksDetail, PersonForm and PersonModal STOOD HERE and are
// gone — 639 lines, the app's second person screen. `personOpen.jsx` has the whole
// account of why; the short of it is that every credit in the app opens the design
// pack's panel now, that panel writes every field this one did through
// `PUT /people/id/{id}`, and the one verb it did NOT carry — deleting a person by
// hand — is on the People console's row beside the character console's.
//
// THE HELPERS ABOVE ARE NOT DEAD WITH IT and that is why this file is still long:
// `PersonPortrait`, `mergeLinks`, `parseLinks`, the credit splitters and the chip
// rows are read by Search, Stats, the work screens and the metadata console. Only
// the surface went.
