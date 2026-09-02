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

// PasteLink — the + panel. One box, the reading under it, and the panel's own ✓.
export function PasteLink({ value, busy, onSave, onDone }) {
  const [draft, setDraft] = useState('')
  const reading = readLink(draft)
  const rows = linkRows(value)
  const host = useFormHost(reading ? '' : t('links.reading.none'))

  async function submit(e) {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    if (!reading) return
    // The same address twice is not two links. Compared whole rather than by
    // provider: two different Wikipedia pages on one record is a legitimate thing
    // — an author and their book — and refusing the second would be this panel
    // deciding what a record may say.
    if (!rows.some((r) => r.url === reading.url)) {
      if (await onSave([...rows.map((r) => r.url), reading.url].join('\n')) === false) return
    }
    onDone()
  }

  return (
    <form id={host?.formId} onSubmit={submit} style={{ display: 'grid', gap: 'var(--row)' }}>
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
