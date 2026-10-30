// The Episodes dialog: a show's episodes, each with a name of its own, in the order the show is
// shown in. Opened from a show's card menu and its details panel (the registry's `episodes`).
//
// THREE ORDERS, AND ONE OF THEM IS THE LINES'. tv is the numbering every quote of the show is stored
// in (its season and episode), so changing it renumbers quotes and asks first, saying how many move.
// custom is the reader's own and touches no quote. dvd is as the provider published it and is read
// only, with Copy to custom to correct it there. Which one is SHOWN is the show's, and it is what
// every card of the show prints and sorts by.
//
// A SAVE IS A SERIES OF PUTS, ONE ORDER EACH, because the server saves one order at a time: tv (with
// the names), then custom, then the shown order. Nothing here computes a hash or knows a column.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { useRowReorder } from './reorder.js'
import { FilterChip, FormModal, GhostButton, IconGrip, IconQuote, MonoLabel, Tally, toast, useConfirm, useFormHost } from './ui.jsx'

const ORDERS = ['tv', 'dvd', 'custom']

// useEpisodesDoor — the verb's card side: `open(item)` and the dialog to render beside it.
export function useEpisodesDoor(onDone) {
  const [item, setItem] = useState(null)
  return {
    open: setItem,
    node: item ? <EpisodesDialog item={item} onClose={() => setItem(null)} onDone={onDone} /> : null,
  }
}

export function EpisodesDialog({ item, onClose, onDone }) {
  // The ✓ lights, with a badge counting what the press will change, only once something differs from
  // what is stored: the form counts, the dialog draws it.
  const [dirty, setDirty] = useState(0)
  return (
    <FormModal onClose={onClose} title={t('episodes.title', { title: item.title })} maxWidth={680} dirty={dirty} closeDanger>
      <EpisodesForm item={item} onClose={onClose} onDone={onDone} onDirty={setDirty} />
    </FormModal>
  )
}

const num = (v) => (v === '' || v == null ? Number.NaN : Number(v))
const place = (e, order) => e.orders?.[order] || null

function EpisodesForm({ item, onClose, onDone, onDirty }) {
  const { ask, confirmDialog } = useConfirm()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState('tv')
  // What the reader has typed, as strings so a half-typed number is not rewritten under them.
  const [places, setPlaces] = useState({ tv: {}, custom: {} })
  // WHERE EACH ROW IS DRAWN, kept apart from what is typed: a row that moved to another season's group
  // the moment its season box changed would be remounted under the cursor and lose the keystroke. The
  // layout is what was stored, or what a drag or a copy set; typing changes `places` only.
  const [layout, setLayout] = useState({ tv: {}, custom: {} })
  const [names, setNames] = useState({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await json('GET', `/movies/${item.id}/episodes`)
    if (!r.ok) {
      setError(t('episodes.error.load', { why: r.data?.error || String(r.status) }))
      return
    }
    setError('')
    const d = r.data
    setData(d)
    setShown(d.order)
    const p = { tv: {}, custom: {} }
    const n = {}
    for (const e of d.episodes) {
      n[e.id] = e.name
      for (const k of ['tv', 'custom']) {
        const pl = place(e, k)
        if (pl) p[k][e.id] = { season: String(pl.season), episode: String(pl.episode) }
      }
    }
    setPlaces(p)
    setLayout(JSON.parse(JSON.stringify(p)))
    setNames(n)
  }, [item.id])
  useEffect(() => {
    load()
  }, [load])

  const episodes = data?.episodes || []
  const placeShown = useCallback(
    (e) => {
      if (shown === 'dvd') {
        const pl = place(e, 'dvd')
        return pl ? { season: String(pl.season), episode: String(pl.episode) } : null
      }
      return layout[shown]?.[e.id] || null
    },
    [shown, layout],
  )
  // What is typed in a row's boxes, which can differ from where the row is drawn until the next load.
  const typed = (e) => places[shown]?.[e.id] || null

  // What is different from what is stored: names, places in each editable order, and the shown order.
  const changed = useMemo(() => {
    const out = { names: [], tv: [], custom: [], show: !!data && shown !== data.order }
    for (const e of episodes) {
      if ((names[e.id] ?? '') !== e.name) out.names.push(e.id)
      for (const k of ['tv', 'custom']) {
        const was = place(e, k)
        const now = places[k]?.[e.id]
        if (now && (!was || String(was.season) !== now.season || String(was.episode) !== now.episode)) out[k].push(e.id)
      }
    }
    return out
  }, [data, episodes, names, places, shown])
  const count = changed.names.length + changed.tv.length + changed.custom.length + (changed.show ? 1 : 0)
  // Choosing custom the first time starts it as a copy of the order that was showing.
  const choose = (order) => {
    if (order === 'custom' && !episodes.some((e) => place(e, 'custom')) && Object.keys(places.custom).length === 0) {
      const from = {}
      for (const e of episodes) {
        const pl = placeShown(e)
        if (pl) from[e.id] = pl
      }
      setPlaces((p) => ({ ...p, custom: from }))
      setLayout((l) => ({ ...l, custom: JSON.parse(JSON.stringify(from)) }))
    }
    setShown(order)
  }
  const copyDvd = () => {
    const from = {}
    for (const e of episodes) {
      const pl = place(e, 'dvd')
      if (pl) from[e.id] = { season: String(pl.season), episode: String(pl.episode) }
    }
    setPlaces((p) => ({ ...p, custom: from }))
    setLayout((l) => ({ ...l, custom: JSON.parse(JSON.stringify(from)) }))
    setShown('custom')
  }
  const editable = shown !== 'dvd'
  const setPlace = (id, field, value) =>
    setPlaces((p) => ({ ...p, [shown]: { ...p[shown], [id]: { ...p[shown][id], [field]: value } } }))

  // Reordering inside a season hands the season's own episode numbers to the rows in their new order,
  // so a gap in the numbering stays a gap and nothing outside the season moves.
  const moveWithin = (ids, a, b) => {
    const order = [...ids]
    const [x] = order.splice(a, 1)
    order.splice(b, 0, x)
    const slots = ids.map((id) => num(places[shown][id].episode)).sort((p, q) => p - q)
    const apply = (all) => {
      const next = { ...all[shown] }
      order.forEach((id, i) => {
        next[id] = { ...next[id], episode: String(slots[i]) }
      })
      return { ...all, [shown]: next }
    }
    setPlaces(apply)
    setLayout(apply)
  }

  const groups = useMemo(() => {
    const by = new Map()
    for (const e of episodes) {
      const pl = placeShown(e)
      const season = pl ? num(pl.season) : -1
      if (!by.has(season)) by.set(season, [])
      by.get(season).push({ e, pl })
    }
    for (const list of by.values()) list.sort((a, b) => num(a.pl?.episode) - num(b.pl?.episode))
    return [...by.entries()].sort((a, b) => a[0] - b[0])
  }, [episodes, placeShown])

  const valid = episodes.every((e) => {
    for (const k of ['tv', 'custom']) {
      const pl = places[k]?.[e.id]
      if (pl && (!(num(pl.season) >= 0) || !(num(pl.episode) >= 0))) return false
    }
    return true
  })
  const dup = useMemo(() => {
    for (const k of ['tv', 'custom']) {
      const seen = new Set()
      for (const e of episodes) {
        const pl = places[k]?.[e.id]
        if (!pl) continue
        const key = `${pl.season}/${pl.episode}`
        if (seen.has(key)) return true
        seen.add(key)
      }
    }
    return false
  }, [episodes, places])
  const blocked = !valid ? t('episodes.error.number') : dup ? t('episodes.error.same-place') : ''
  const host = useFormHost(busy ? t('common.action.save.busy') : blocked)
  useEffect(() => {
    onDirty?.(count)
    return () => onDirty?.(0)
  }, [onDirty, count])

  const put = (order, list, extra = {}) =>
    json('PUT', `/movies/${item.id}/episodes`, {
      order,
      episodes: list.map((id) => ({
        id,
        name: (names[id] ?? '').trim(),
        season: num(places[order]?.[id]?.season ?? 0) || 0,
        episode: num(places[order]?.[id]?.episode ?? 0) || 0,
      })),
      ...extra,
    })

  async function submit(ev) {
    ev.preventDefault()
    if (blocked || busy || count === 0) return
    setBusy(true)
    try {
      // tv first, with the names: it can ask, and it is the only one that moves quotes.
      if (changed.tv.length || changed.names.length) {
        const ids = [...new Set([...changed.tv, ...changed.names])]
        let r = await put('tv', ids.filter((id) => places.tv[id]))
        if (r.status === 409 && r.data?.moves > 0 && !r.data?.collisions) {
          const yes = await ask(t('episodes.confirm.title'), {
            body: t('episodes.confirm.body', { n: r.data.moves }),
            confirmLabel: t('episodes.confirm.go'),
          })
          if (!yes) return
          r = await put('tv', ids.filter((id) => places.tv[id]), { confirm: true })
        }
        if (!r.ok) {
          toast(r.status === 409 && r.data?.collisions ? t('episodes.collision') : r.data?.error || String(r.status))
          return
        }
      }
      if (changed.custom.length) {
        const r = await put('custom', changed.custom)
        if (!r.ok) {
          toast(r.data?.error || String(r.status))
          return
        }
      }
      if (changed.show || count > 0) {
        const r = await put(editable ? shown : 'custom', [], { show: shown })
        if (!r.ok) {
          toast(r.data?.error || String(r.status))
          return
        }
      }
      toast(t('episodes.saved'))
      await load()
      onDone?.()
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="microcopy" role="alert">{error}</p>
  if (!data) return <p className="microcopy">{t('common.state.loading')}</p>
  return (
    <form id={host?.formId} onSubmit={submit} className="episodes-form">
      <div className="episodes-group">
        <MonoLabel className="block">{t('episodes.order.label')}</MonoLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('episodes.order.label')}>
          {ORDERS.map((o) => (
            <FilterChip key={o} active={shown === o} label={t(`episodes.order.${o}`)} onClick={() => choose(o)} />
          ))}
        </div>
        {shown === 'dvd' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="microcopy">{data.has_dvd ? t('episodes.dvd.readonly') : t('episodes.dvd.none')}</p>
            {data.has_dvd && (
              <GhostButton type="button" onClick={copyDvd}>
                {t('episodes.dvd.copy')}
              </GhostButton>
            )}
          </div>
        )}
      </div>

      {episodes.length === 0 ? (
        <p className="microcopy">{t('episodes.empty')}</p>
      ) : (
        groups.map(([season, list]) => (
          <SeasonGroup
            key={season}
            season={season}
            list={list}
            typed={typed}
            editable={editable}
            names={names}
            setName={(id, v) => setNames((n) => ({ ...n, [id]: v }))}
            setPlace={setPlace}
            moveWithin={moveWithin}
          />
        ))
      )}
      {confirmDialog}
    </form>
  )
}

function SeasonGroup({ season, list, typed, editable, names, setName, setPlace, moveWithin }) {
  const ids = list.map(({ e }) => e.id)
  const drag = useRowReorder((a, b) => moveWithin(ids, a, b))
  return (
    <section className="episodes-group" aria-label={season === 0 ? t('episodes.season.special') : t('episodes.season', { n: season })}>
      <MonoLabel className="block">{season === 0 ? t('episodes.season.special') : season < 0 ? t('episodes.season.none') : t('episodes.season', { n: season })}</MonoLabel>
      <ul ref={drag.listRef} className="episodes-group">
        {list.map(({ e, pl }, i) => (
          <li key={e.id} className="episode-row" {...drag.rowProps(i)}>
            {editable && (
              <button type="button" className="field-icon-btn" aria-label={t('episodes.grip.aria', { name: names[e.id] || e.id })} {...drag.gripProps(i)}>
                <IconGrip />
              </button>
            )}
            {editable ? (
              <>
                <input
                  className="tp-input episode-num"
                  inputMode="numeric"
                  aria-label={t('episodes.season.aria')}
                  value={typed(e)?.season ?? ''}
                  onChange={(ev) => setPlace(e.id, 'season', ev.target.value.replace(/[^0-9]/g, ''))}
                />
                <input
                  className="tp-input episode-num"
                  inputMode="numeric"
                  aria-label={t('episodes.number.aria')}
                  value={typed(e)?.episode ?? ''}
                  onChange={(ev) => setPlace(e.id, 'episode', ev.target.value.replace(/[^0-9]/g, ''))}
                />
              </>
            ) : (
              <span className="episode-code">{pl ? `S${pl.season}E${pl.episode}` : ''}</span>
            )}
            <input
              className="tp-input episode-name"
              placeholder={t('episodes.name.placeholder')}
              aria-label={t('episodes.name.aria')}
              value={names[e.id] ?? ''}
              onChange={(ev) => setName(e.id, ev.target.value)}
            />
            {e.new && <span className="tp-chip">{t('episodes.new')}</span>}
            <Tally n={e.quotes} word={t('unit.quote', { count: e.quotes })} icon={<IconQuote />} />
            {!(names[e.id] ?? '') && e.candidates?.length > 0 && (
              <span className="episode-candidates">
                {e.candidates.map((c) => (
                  <FilterChip key={c} label={c} onClick={() => setName(e.id, c)} />
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
