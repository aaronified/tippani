// A WORK'S LINKS OUT — handoff §1.3.
//
// Committed before this: nothing. A reader who wanted the Goodreads page, the
// Letterboxd entry or the fandom wiki for a work had one place to put it — the
// note on one of its quotes.
//
// THE LIST IS WHAT IS ADDED, NOT WHAT EXISTS. There is no fixed roster with "not
// linked" beside half of it: a panel made mostly of absences decides for the
// reader which providers their record may have, and it is wrong about it. A
// novel with a film adaptation legitimately wants a TMDB page; a game
// novelisation wants IGDB. So the panel lists what is there, and adding is a
// paste box rather than a slot.
//
// THE GLOBE IS NOT A FAILURE STATE. "A web page" is a legitimate kind of link —
// a review, an author's own site, a scan somebody hosted — so a URL matching
// nothing known is kept whole and wears the globe. A dashed box or an error
// colour would tell the reader they had done something wrong by linking to the
// open web, and it is also why there is no WorldCat slot: an obscure catalogue is
// not a special case, it is just a URL.
//
// AND THE LIST YOU PICK FROM IS THE PAGES THIS RECORD CAN ALREADY ADDRESS, which
// is the shape that survives the paragraph above. The pack asks for "appending a
// provider by picking it from a list"; a list of the twelve marks with "not
// linked" beside eight of them is the roster of absences this panel exists to
// avoid. A record pinned to TheTVDB, though, HAS a TheTVDB page — the id is
// sitting in the row — and making the reader copy that address out of a browser
// is the app declining to do arithmetic it can do. So the list is derived from
// the record's own pinned ids, one press appends, and a site the record cannot
// address is simply not in it. The paste box is unchanged and is still the way in
// for everything else, which is most things.
//
// WHAT IS NOT BUILT, said plainly: the pack's per-link provenance (`auto` · `you`)
// is not here. Nothing fetches a WORK's links yet — a person's are assembled from
// a lookup, a work's are all pasted — so a tag on every row would say the same
// word every time, which is not a tag. When something does fetch them, the column
// is the same free text a person's is and the tag can be told apart then.
import { useState } from 'react'
import { t } from './i18n.js'
import { PROVIDERS, parseLinks } from './people.jsx'
import { FieldIconButton, GhostButton, IconClose, IconGlobe, IconPlus, MonoLabel, ProviderMark, useFormHost } from './ui.jsx'

// hostOf is `new URL().hostname`, and the try is the whole of it: a reader pastes
// half an address as often as a whole one.
function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// readLink says what a pasted string WILL BE before it is committed, which is the
// rule this box exists to keep: a field that silently transforms what you typed is
// a field you stop trusting.
//
// A bare `www.` or a scheme-less address is completed rather than refused —
// copying an address out of a browser's bar drops the scheme about half the time,
// and refusing that is refusing the commonest paste there is.
export function readLink(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  const host = hostOf(url)
  if (!host || host.indexOf('.') < 0) return null
  const hit = PROVIDERS.find(([, , re]) => re.test(host))
  return { url, host, slug: hit ? hit[0] : '', name: hit ? t(hit[1]) : t('links.web.label') }
}

// PROVIDER_URLS — the canonical page each site addresses a record BY, and the one
// place the app writes such an address.
//
// ONE TABLE BECAUSE THERE WERE ABOUT TO BE TWO. The Details rows for a TMDB,
// TheTVDB or IMDb id already drew their number as a link, with the template
// inline in each spec; the pickable list below needs the same three plus the
// book side's. Two copies of "where does TheTVDB keep a series" is the drift the
// picker tables in reverify_handlers.go are a table for, so the specs call this
// now and nothing else builds a provider address.
//
// SOME SITES ARE ABSENT AND EACH FOR ITS OWN REASON, none of them "not got round
// to it":
//
//   letterboxd, igdb   addressed by SLUG, not by the numeric id the row stores.
//                      IGDB's api gives an id; its website wants `/games/dune`.
//                      A guessed slug is a 404 that looks like a link.
//   wikipedia,         a WORK stores no id for any of them. A person's arrive
//   wikidata,          from a lookup and live in their own links column; a work's
//   wikimedia          would have to be searched for, and a search result is not
//                      an address.
//   amazon             the marketplace is an admin setting this panel cannot see,
//                      and `amazon.com` for a reader who buys on `.co.uk` is a
//                      different edition at a real URL — wrong in the way that
//                      looks right. The paste box takes it in one gesture.
//
// A GAME'S MEDIA TYPE MAPS TO `movie` ON TMDB and that is not a bug to fix here:
// TMDB has no games, so a game cannot carry a tmdb_id, and the branch is never
// reached. The mapping is the one the Details rows already used, moved rather
// than rewritten.
const screenPath = (it) => ((it.media_type || 'movie') === 'show' ? 'tv' : 'movie')
const tvdbPath = (it) => ((it.media_type || 'movie') === 'show' ? 'series' : 'movie')

// An Open Library key arrives as a PATH — `/works/OL123W` — because that is what
// the API calls it. A bare `OL123W` is accepted too: a reader who typed the id
// into the field wrote the half they can see.
function openLibraryURL(it) {
  const key = String(it.openlibrary_id || '').trim()
  if (key) {
    return key.startsWith('/') ? `https://openlibrary.org${key}` : `https://openlibrary.org/works/${key}`
  }
  // AND THE ISBN IS AN ADDRESS THERE, which is the point of offering it: Open
  // Library redirects `/isbn/<n>` to the edition, so a book with nothing but the
  // number off its own back cover still has a page to link.
  const isbn = String(it.isbn || '').replace(/[^0-9Xx]/g, '')
  return isbn ? `https://openlibrary.org/isbn/${isbn}` : ''
}

const PROVIDER_URLS = {
  imdb: (it) => (it.imdb_id ? `https://www.imdb.com/title/${it.imdb_id}/` : ''),
  tmdb: (it) => (it.tmdb_id ? `https://www.themoviedb.org/${screenPath(it)}/${it.tmdb_id}` : ''),
  tvdb: (it) => (it.tvdb_id ? `https://thetvdb.com/dereferrer/${tvdbPath(it)}/${it.tvdb_id}` : ''),
  // THE WIKI AND NOT A PAGE ON IT. `movies.fandom_wiki` names which wiki a work
  // lives on (0055) and nothing stores its article title, so this is the wiki's
  // front page — which is a legitimate link and the honest one: "the fandom wiki
  // for this" is what the reader wanted, and its search box is one press away.
  fandom: (it) => (it.fandom_wiki ? `https://${String(it.fandom_wiki).trim()}.fandom.com` : ''),
  openlibrary: openLibraryURL,
  google: (it) => (it.google_id ? `https://books.google.com/books?id=${encodeURIComponent(it.google_id)}` : ''),
}

// providerURL is the single reader of that table. An unknown slug answers '' the
// same way a missing id does, because both mean "no address for this here".
export function providerURL(slug, item) {
  const f = PROVIDER_URLS[slug]
  return f ? f(item || {}) : ''
}

// derivedLinks lists the pages this record can address and has not linked yet, in
// the app's own provider order.
//
// ALREADY-LINKED SITES DROP OUT rather than drawing as ticked or greyed. A row
// you cannot press is the roster of absences again, one item at a time, and the
// list this one is FOR is "what can I add". When there is nothing left to add the
// list is gone and the paste box is the whole panel, which is what it was before.
//
// Compared by URL and not by provider, for the reason PasteLink states: two
// different Wikipedia pages on one record is a legitimate thing, so "has a link
// to this site" is not the same question as "has THIS address".
export function derivedLinks(item, value) {
  const have = new Set(linkRows(value).map((r) => r.url))
  return PROVIDERS.map(([slug, labelKey]) => ({ slug, name: t(labelKey), url: providerURL(slug, item) }))
    .filter((r) => r.url && !have.has(r.url))
}

// SuggestedLink — one derivable page, as a button that adds it.
function SuggestedLink({ slug, name, url, busy, onAdd }) {
  return (
    <li>
      <button
        type="button"
        className="work-link-offer tactile"
        disabled={!!busy}
        title={t('links.suggest.tip', { name })}
        onClick={onAdd}
      >
        <span className="work-link-mark" aria-hidden="true">
          {slug ? <ProviderMark source={slug} /> : <IconGlobe size={17} />}
        </span>
        <span className="work-link-names">
          <MonoLabel>{name}</MonoLabel>
          {/* The address in full, for the same reason the stored rows show theirs:
              this is a link about to be added and the reader is entitled to read
              it first. Never truncated. */}
          <span className="work-link-url">{url}</span>
        </span>
        <span className="work-link-take" aria-hidden="true"><IconPlus /></span>
      </button>
    </li>
  )
}

// LinkRow — one stored link. The mark, the provider's name over the address, the
// address itself as the link, and a ✕ that takes it off.
function LinkRow({ url, slug, name, onRemove }) {
  return (
    <li className="work-link-row">
      <span className="work-link-mark" aria-hidden="true">
        {slug ? <ProviderMark source={slug} /> : <IconGlobe size={17} />}
      </span>
      <span className="work-link-names">
        <MonoLabel>{name}</MonoLabel>
        {/* NEVER TRUNCATED, because an address is a name of a sort: a shortened
            one and a short one look alike, and the reader cannot tell which they
            are looking at. It wraps; the row grows. */}
        <a className="tp-link work-link-url" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
      </span>
      <FieldIconButton
        icon={<IconClose />}
        ariaLabel={t('links.remove.aria', { name })}
        onClick={onRemove}
        danger
      />
    </li>
  )
}

// WorkLinks — the panel body: the list, and nothing else.
//
// A PANEL MAY CARRY ONE VERB IN ITS HEADER, AND ONLY ITS OWN (§1.12). The list is
// what is already there; adding to it is not another member of it, so `+` sits in
// the header and opens the paste box on its own surface rather than as a last row
// pretending to be a link.
export function WorkLinks({ value, busy, onSave, onEmptyAdd }) {
  const rows = linkRows(value)
  const remove = (url) => onSave(rows.filter((r) => r.url !== url).map((r) => r.url).join('\n'))

  if (rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 'var(--row)' }}>
        <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('links.empty')}</p>
        {/* The empty state carries the verb as well as the header does. A panel
            whose only affordance is a 34px key in the corner is a panel a reader
            leaves again. */}
        <div>
          <GhostButton type="button" disabled={!!busy} onClick={onEmptyAdd}>
            <IconPlus />
            <span>{t('links.paste.label')}</span>
          </GhostButton>
        </div>
      </div>
    )
  }
  return (
    <ul className="work-link-list">
      {rows.map((r) => (
        <LinkRow key={r.url} {...r} onRemove={() => remove(r.url)} />
      ))}
    </ul>
  )
}

// linkRows is the stored column as a list: the recognised providers in the app's
// own display order, then whatever else is there, kept whole.
export function linkRows(value) {
  const { known, extra } = parseLinks(value)
  return [
    ...PROVIDERS.filter(([slug]) => known[slug]).map(([slug, labelKey]) => ({
      url: known[slug], slug, name: t(labelKey),
    })),
    ...extra.map((url) => ({ url, slug: '', name: t('links.web.label') })),
  ]
}

// PasteLink — the + panel: the pages this record can already address, and a box
// for everything else.
//
// THE DERIVED LIST IS IN HERE RATHER THAN IN A HEADER VERB OF ITS OWN, and §1.12
// is why: a panel carries one verb and only its own, and Links already spends it
// on `+`. Two ways to add a link are not two verbs — they are the same verb done
// two ways, so they belong behind the one press that means "add". The cheap way
// goes first because it is one press against a paste, and the box below is
// unchanged for the site the record cannot address, which is most sites.
export function PasteLink({ item, value, busy, onSave, onDone }) {
  const [draft, setDraft] = useState('')
  const reading = readLink(draft)
  const rows = linkRows(value)
  const suggested = derivedLinks(item || {}, value)
  const host = useFormHost(reading ? '' : t('links.reading.none'))

  // append is the one writer, so the button and the box cannot disagree about
  // what adding means — the de-dupe, the join and the failure are all here.
  async function append(url) {
    if (!rows.some((r) => r.url === url)) {
      if (await onSave([...rows.map((r) => r.url), url].join('\n')) === false) return false
    }
    return true
  }

  async function submit(e) {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    if (!reading) return
    // The same address twice is not two links. Compared whole rather than by
    // provider: two different Wikipedia pages on one record is a legitimate thing
    // — an author and their book — and refusing the second would be this panel
    // deciding what a record may say.
    if (!(await append(reading.url))) return
    onDone()
  }

  // A PICK CLOSES ITS PANEL (§1.11). Pressing a derived page is a whole decision
  // — there is nothing left to type and nothing to confirm — so leaving the panel
  // open would ask the reader to find the ✕ for a job that is done.
  async function take(url) {
    if (await append(url)) onDone()
  }

  return (
    <form id={host?.formId} onSubmit={submit} style={{ display: 'grid', gap: 'var(--row)' }}>
      {suggested.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--row)' }}>
          <MonoLabel>{t('links.suggest.heading')}</MonoLabel>
          <ul className="work-link-list">
            {suggested.map((r) => (
              <SuggestedLink key={r.url} {...r} busy={busy} onAdd={() => take(r.url)} />
            ))}
          </ul>
          {/* The box below is not a fallback and does not read as one: it is the
              way in for every site with no id in the row, which is most of the
              web. The label says which half you are in. */}
          <MonoLabel>{t('links.suggest.or')}</MonoLabel>
        </div>
      )}
      <input
        className="tp-input"
        value={draft}
        aria-label={t('links.paste.label')}
        placeholder={t('links.paste.placeholder')}
        autoComplete="off"
        spellCheck="false"
        autoFocus
        disabled={!!busy}
        onChange={(e) => setDraft(e.target.value)}
      />
      {/* THE READING, BEFORE IT IS COMMITTED. A key and a URL are one fact written
          twice, and a box that decides silently which one you meant is a box you
          check afterwards every time. */}
      <p className="microcopy" style={{ color: reading ? 'var(--soft)' : 'var(--faint)' }}>
        {draft.trim()
          ? reading
            ? t('links.reading', { name: reading.name, host: reading.host })
            : t('links.reading.none')
          : t('links.paste.hint')}
      </p>
      {reading && (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {rows.some((r) => r.url === reading.url) ? t('links.already') : reading.url}
        </p>
      )}
    </form>
  )
}

// linksSummary — what the Links row reads at rest: how many, and which. Names
// rather than a bare number, for peopleSummary's reason.
export function linksSummary(value) {
  const { known, extra } = parseLinks(value)
  const names = PROVIDERS.filter(([slug]) => known[slug]).map(([, k]) => t(k))
  if (extra.length) names.push(t('links.web.count', { count: extra.length, n: extra.length }))
  return names.join(' · ')
}
