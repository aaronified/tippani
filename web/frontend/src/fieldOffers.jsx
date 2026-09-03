// ONE FIELD, AND WHAT EVERY SUPPLIER SAYS ABOUT IT — handoff §1.2's last clause,
// and the last of the three gaps the prototype sweep named.
//
// WHAT WAS ALREADY THERE. Every field on a record has carried its supplier's
// mark since 0054, and the re-verify reviewer has drawn each supplier's answer
// side by side since the mix-and-match release. What did not exist was the DOOR:
// a reader looking at a description tagged TMDB had no way to ask what TheTVDB
// says about it without running a re-verify over the whole record and reading a
// diff table. So the record was provider-specific to LOOK at and all-or-nothing
// to CHANGE, which is the opposite of the point.
//
// AND WHY THE REVIEWER IS NOT THE ANSWER. Re-verify asks "what has changed", and
// a field whose tag names a supplier has by definition not changed FROM that
// supplier — so the reviewer's own table is empty for exactly the field whose
// tag you pressed. The `offers` flag is the other question; see
// internal/httpapi/field_offers.go for why the two cannot share one answer.
//
// A PANEL AND NOT A POPOVER. Two descriptions read side by side is prose, not a
// menu: it needs the width of the sheet and a scroll of its own, and it must
// behave the same on a phone as on a desktop. The stack already gives all three,
// and it gives the reader the back gesture they use for every other door on this
// screen. A popover would have been a second navigation to learn, anchored to an
// 18px mark.
//
// ONE FETCH PER OPENING, deliberately not cached. The alternative is a cache
// keyed on the work, invalidated by every apply, every edit and every refetch —
// machinery for a gesture that is one field at a time by design. The cost is two
// provider requests, which is what pressing Re-verify has always cost.
import { useEffect, useState } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import { ValueCell } from './ReverifyReview.jsx'
import { EmptyState, ErrorText, MonoLabel, ProviderMark, sourceName, toast } from './ui.jsx'

// THE FIELDS WITH A DOOR, which is not every field with a tag.
//
// A supplier id names its own supplier, so "TheTVDB says the TMDB id is 603" is
// not an alternative anybody can weigh; a medium and the two languages have no
// supplier answer at all. A tag on one of those is a label and stays one — the
// empty room is the thing the door was not supposed to open onto.
//
// IT MIRRORS THE SERVER'S PICKER TABLES and `offers-fields.test.js` reads those
// tables out of the Go source and fails if the two lists disagree. A set here
// that had grown a field the server cannot offer would draw a door onto nothing;
// one that had lost a field the server offers would hide a choice that exists.
export const OFFERED_FIELDS = new Set([
  'title', 'author', 'director', 'description', 'published_year', 'release_year',
  'series', 'series_index', 'genres', 'subtitle', 'publisher', 'pages',
])

// fieldOffersPanel — the descriptor the stack pushes.
export function fieldOffersPanel(stack, { kind, item, field, label, storedSource, onChanged }) {
  return {
    title: label,
    render: () => (
      <FieldOffers
        kind={kind}
        item={item}
        field={field}
        label={label}
        storedSource={storedSource}
        onChanged={onChanged}
        onDone={() => stack.back()}
      />
    ),
  }
}

// A supplier's offer, or the value already on the record.
//
// THE STORED ROW IS DRAWN FIRST AND IS NOT PRESSABLE. A choice between values
// cannot be made without seeing what you have; and "keep it" is what closing the
// panel already means, so a button for it would be a second way to do nothing.
function OfferRow({ field, source, value, kept, busy, onTake }) {
  const inner = (
    <>
      {/* THE KEPT ROW STILL WEARS ITS MARK — it is the tag the reader pressed, and
          the panel would otherwise open having dropped the one fact that got them
          here. The word beside it says "kept" rather than the supplier's name,
          because what this row is FOR is the value on the record. */}
      <span className="offer-row-src">
        <ProviderMark source={source} />
        {kept ? t('offers.column.stored') : sourceName(source)}
      </span>
      <span className="offer-row-value">
        <ValueCell field={field} value={value} fresh={!kept} />
      </span>
    </>
  )
  if (kept) {
    return <div className="offer-row" data-kept="1">{inner}</div>
  }
  return (
    <button
      type="button"
      className="offer-row tactile"
      disabled={busy}
      title={t('offers.take.tip', { source: sourceName(source) })}
      onClick={onTake}
    >
      {inner}
    </button>
  )
}

function FieldOffers({ kind, item, field, label, storedSource, onChanged, onDone }) {
  const [state, setState] = useState({ phase: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const body = kind === 'book' ? { book_ids: [item.id] } : { movie_ids: [item.id] }
      const r = await json('POST', '/metadata/reverify', { ...body, offers: true })
      if (!live) return
      if (!r.ok) return setState({ phase: 'error', error: errText(r, t('error.reverify.preview')) })
      const it = r.data?.items?.[0]
      if (!it) return setState({ phase: 'error', error: t('error.reverify.preview') })
      // A WORK WITH NOTHING PINNED IS NOT AN ERROR, and its own sentence says
      // what to do about it — the same one the reviewer shows, because it is the
      // same fact and a second wording would be a second thing to learn.
      if (it.status !== 'ok') return setState({ phase: 'unpinned', error: it.error || '' })
      const row = (it.offers || []).find((o) => o.field === field)
      setState({ phase: 'ready', row, source: it.source })
    })()
    return () => { live = false }
  }, [kind, item.id, field])

  async function take(alt) {
    setBusy(true)
    const type = kind === 'book' ? 'book' : 'movie'
    const r = await json('POST', '/metadata/reverify/apply', {
      items: [{
        type,
        id: item.id,
        set: { [field]: alt.value },
        // PER FIELD, which is the whole of mix-and-match on the wire: the tag
        // this panel was opened from is the one being rewritten, so the supplier
        // recorded against it has to be the one whose value was taken.
        sources: { [field]: alt.source },
        source: state.source || alt.source,
      }],
    })
    setBusy(false)
    const res = r.ok ? r.data?.results?.[0] : null
    if (!res?.ok) {
      setState((s) => ({ ...s, error: res?.error || errText(r, t('error.reverify.apply')) }))
      return
    }
    toast(t('offers.taken.toast', { field: label, source: sourceName(alt.source) }))
    onChanged?.()
    onDone?.()
  }

  if (state.phase === 'loading') return <p className="microcopy">{t('common.state.loading')}</p>
  if (state.phase === 'error') return <ErrorText>{state.error}</ErrorText>
  if (state.phase === 'unpinned') {
    return <EmptyState>{state.error || t('offers.unpinned.prose')}</EmptyState>
  }
  const alts = state.row?.alts || []
  if (alts.length === 0) {
    return <EmptyState>{t('offers.none.prose')}</EmptyState>
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--row)' }}>
      <ErrorText>{state.error}</ErrorText>
      <MonoLabel>{t('offers.prose', { field: label })}</MonoLabel>
      <div style={{ display: 'grid', gap: 'var(--row)' }}>
        <OfferRow field={field} source={storedSource || ''} value={state.row.stored} kept />
        {alts.map((a) => (
          <OfferRow
            key={a.source}
            field={field}
            source={a.source}
            value={a.value}
            busy={busy}
            onTake={() => take(a)}
          />
        ))}
      </div>
    </div>
  )
}
