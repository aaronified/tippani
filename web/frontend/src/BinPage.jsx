import { useEffect, useMemo, useState } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  FieldIconButton,
  FilterChip,
  GhostButton,
  IconBack,
  IconBooks,
  IconChevron,
  IconDelete,
  IconDialogue,
  IconHighlight,
  IconPerson,
  IconQuote,
  IconReel,
  IconRevert,
  InfoDot,
  MonoLabel,
  PageHeader,
  Select,
  Tooltip,
  toast,
  useIsMobileScreen,
} from './ui.jsx'

// The bin — a page of its own since 1.11.2, and reachable from exactly one place.
//
// WHY IT LEFT SETTINGS. It was a card in a three-column grid of cards, which is
// the wrong shape for the one screen in the app you open because you have already
// lost something. A card is a control panel: a label, a control, done. This is a
// LIST, of unbounded length, whose rows each expand — and in a grid column beside
// Devices and Updates it got about 300px of width to say what an entry was, when
// it went, what travelled with it, and when it will be gone for good. Four facts
// and two buttons in 300px is why it said three of them and truncated the fourth.
//
// It is not in the nav, and that is deliberate rather than an oversight. Nothing
// about the bin is a place you go; it is a place you are sent, by the tile in
// Settings or by the Undo in a toast expiring before you noticed it. A ninth tab
// for "things you have deleted" would put a permanent invitation to browse your
// deletions in the same strip as Library and Stats. So `/bin` routes, bookmarks
// and survives a refresh — it is a real page, not a modal — and it appears in no
// tab list. routes.test.js asserts that shape both ways round: every NAV tab must
// have a URL, but a URL is free not to be a tab.
//
// WHAT IT SHOWS, and the one thing it deliberately does not. Everything the API
// has per entry: what kind of thing it was, its label, when it went, how many
// quotes went with it, whether its picture is still held, when it is due to go for
// good — and, expanded, the lines it is holding. It is still READ-ONLY, and still
// not a browser: the two things you can do to an entry are put it back and get rid
// of it. `snapshotContents` on the server flattens a payload to the quotes a
// reader would recognise rather than shipping every column of every row, and that
// stays true here. A bin row is not a debugging surface, and a page instead of a
// card is not a reason to hand over a database dump because somebody clicked a
// chevron.

// TRASH_LABELS: what a bin row calls each kind. The stored kind is the API's word
// ('quote' is a standalone quote, 'screen' never appears here); these are the
// reader's. The glyph is the same one the rest of the app uses for that thing, so
// a row is recognisable before the words are read — and the filter chips above the
// list are the same pairs, which is why one table carries both.
// HOLDS KEYS, RESOLVED WHERE IT IS DRAWN. A table of words built at module scope
// freezes the language at import time, which is the whole bug three other tables
// in this app shipped — see keys.js's groupedShortcuts.
export const TRASH_LABELS = {
  book: 'bin.kind.book.label',
  movie: 'bin.kind.movie.label',
  annotation: 'bin.kind.annotation.label',
  dialogue: 'bin.kind.dialogue.label',
  quote: 'bin.kind.quote.label',
  account: 'bin.kind.account.label',
}

const TRASH_ICONS = {
  book: <IconBooks />,
  movie: <IconReel />,
  annotation: <IconHighlight />,
  dialogue: <IconDialogue />,
  quote: <IconQuote />,
  account: <IconPerson />,
}

// The plural each kind counts in, for the filter chips. "Film or shows" is not a
// phrase, which is why this is a table rather than a suffix.
const TRASH_PLURALS = {
  book: 'bin.kind.book.plural',
  movie: 'bin.kind.movie.plural',
  annotation: 'bin.kind.annotation.plural',
  dialogue: 'bin.kind.dialogue.plural',
  quote: 'bin.kind.quote.plural',
  account: 'bin.kind.account.plural',
}

// RETENTION: the offered windows. Never is -1 rather than 0 for the reason the
// server gives (an unset preference reads as 0, and "nobody has set this" must not
// mean "turn the purge off").
// The number is the window in days, and -1 is never; the WORDS are built at
// render from the shared day format, so three of the four rows need no key of
// their own.
const RETENTION = [7, 30, 90, -1]

const retentionOptions = () =>
  RETENTION.map((n) => [
    String(n),
    n < 0 ? t('bin.retention.never.label') : t('common.slider.days.format', { count: n, n }),
  ])

// parseStamp reads the server's `datetime('now')` stamp. It is a UTC wall-clock
// string with no zone marker, so the T and the Z are added rather than letting the
// browser guess — Safari refuses the space form outright, and the guess that does
// parse is a day out for half the world.
function parseStamp(raw) {
  if (!raw) return null
  const d = new Date(String(raw).replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

const asDay = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// fmtDeleted — when it went. Kept short in the row; the year appears only when it
// is not this one, because "deleted 1 Aug 2026" on every row of a bin you emptied
// last week is a column of noise.
export function fmtDeleted(raw) {
  const d = parseStamp(raw)
  if (!d) return raw ? t('bin.row.deleted.label', { when: raw }) : ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const when = sameYear
    ? asDay(d)
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return t('bin.row.deleted.label', { when })
}

// expiryLabel — when this is due to go for good.
//
// A DATE, NOT A COUNTDOWN, and that is the honest form. The purge clock runs on
// server time and only while the server is up, so an instance that spends a week
// switched off has not spent a week of anybody's thirty days: "gone in 3 days"
// would be a promise nothing here can keep. A date reads as the earliest it can
// go, which is exactly what it is, and the info dot says so.
export function expiryLabel(raw, days) {
  if (!(days > 0)) return t('bin.row.expiry.never')
  const d = parseStamp(raw)
  if (!d) return ''
  const due = new Date(d.getTime() + days * 86400000)
  // Already past its window and still here: the purge sweeps on the server's own
  // schedule, so "due to go" is true and "gone" would be a lie about a row that
  // is visibly still in the list.
  return t('bin.row.expiry.due', { date: asDay(due) })
}

export default function BinPage({ onClose }) {
  const mobile = useIsMobileScreen()
  const [items, setItems] = useState(null) // null = still loading
  const [days, setDays] = useState(30)
  const [open, setOpen] = useState(null) // the expanded entry id
  const [contents, setContents] = useState({}) // id -> [{text, color}]
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false) // "empty it" confirmation
  const [kind, setKind] = useState('all')

  async function load() {
    const r = await json('GET', '/trash')
    if (!r.ok) return setItems([])
    setItems(r.data.trash || [])
    setDays(r.data.days ?? 30)
  }
  useEffect(() => {
    load()
  }, [])

  async function expand(id) {
    if (open === id) return setOpen(null)
    setOpen(id)
    if (contents[id]) return
    const r = await json('GET', `/trash/${id}`)
    if (r.ok) setContents((c) => ({ ...c, [id]: r.data.contents || [] }))
  }

  async function putBack(entry) {
    setBusy(true)
    const r = await json('POST', `/trash/${entry.id}/restore`)
    setBusy(false)
    if (!r.ok) return toast(errText(r, t('error.restore.generic')))
    toast(t('common.toast.restored.label'))
    setOpen(null)
    load()
  }

  async function forget(entry) {
    setBusy(true)
    const r = await json('DELETE', `/trash/${entry.id}`)
    setBusy(false)
    if (!r.ok) return toast(errText(r, t('error.remove.generic')))
    toast(t('bin.toast.gone.label'))
    load()
  }

  async function emptyAll() {
    setAsking(false)
    setBusy(true)
    const r = await json('DELETE', '/trash')
    setBusy(false)
    if (!r.ok) return toast(errText(r, t('error.empty.bin')))
    toast(t('bin.toast.emptied.label'))
    load()
  }

  async function setWindow(v) {
    const n = Number(v)
    setDays(n)
    const r = await json('PUT', '/auth/me/preferences', { trashDays: n })
    if (!r.ok) {
      toast(errText(r, t('error.save.generic')))
      load() // put the control back to what the server actually holds
    }
  }

  const all = items || []
  // Which kinds are actually in the bin, in the table's own order. Only those get
  // a chip: a filter for a kind you have never deleted is a control that can only
  // ever empty the list.
  const kinds = useMemo(() => {
    const present = new Set(all.map((e) => e.kind))
    return Object.keys(TRASH_LABELS).filter((k) => present.has(k))
  }, [all])
  const shown = kind === 'all' ? all : all.filter((e) => e.kind === kind)
  const held = all.reduce((n, e) => n + (e.child_count || 0), 0)
  // A filter that has outlived what it was filtering — the last book restored, say
  // — would otherwise leave the page reading "no entries" over a bin with things
  // in it. The chip for that kind is already gone by then; the state has to go too.
  useEffect(() => {
    if (kind !== 'all' && items && !kinds.includes(kind)) setKind('all')
  }, [kind, kinds, items])

  const counts =
    items === null
      ? ''
      : [
          t('common.count.phrase', { n: all.length, noun: t('unit.entry', { count: all.length }) }),
          held > 0 && t('bin.counts.held', { n: held, noun: t('unit.quote', { count: held }) }),
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <section className="space-y-6" data-screen-label="bin">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        {/* The way back is to SETTINGS, which is the only way in. A page with one
            door needs that door named — a bare back arrow on a screen nothing in
            the nav points at leaves you guessing where it goes. */}
        <Tooltip label={t('bin.back.tip')} side="bottom">
          <button type="button" className="bin-back" onClick={onClose}>
            <IconBack />
            {/* The tab's own name, not a second copy of the word. */}
            <MonoLabel>{t('nav.tab.settings.label')}</MonoLabel>
          </button>
        </Tooltip>
        <PageHeader title={t('bin.title')} counts={counts} />
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <MonoLabel>{t('bin.keep-for.label')}</MonoLabel>
            <Select
              ariaLabel={t('bin.retention.aria')}
              value={String(days)}
              onChange={setWindow}
              options={retentionOptions()}
            />
            <InfoDot title={t('bin.info.title')} text={t('bin.info.body')} />
            {all.length > 0 && (
              <GhostButton
                className="tp-btn-danger ml-auto"
                icon={<IconDelete />}
                keepLabel
                onClick={() => setAsking(true)}
                disabled={busy}
              >
                {t('bin.empty-now.label')}
              </GhostButton>
            )}
          </div>

          {/* The kind filter, only once there is more than one kind to tell apart.
              Same chips as the search scopes, so they lose their words to the same
              Button labels preference — a bin holding six kinds is seven chips. */}
          {kinds.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={kind === 'all'}
                keepLabel
                label={t('bin.filter.all.label')}
                onClick={() => setKind('all')}
              />
              {kinds.map((k) => (
                <FilterChip
                  key={k}
                  active={kind === k}
                  icon={TRASH_ICONS[k]}
                  label={t(TRASH_PLURALS[k] || TRASH_LABELS[k])}
                  tooltip={t('bin.filter.only.tip', {
                    kind: (TRASH_PLURALS[k] ? t(TRASH_PLURALS[k]) : k).toLowerCase(),
                  })}
                  onClick={() => setKind(k)}
                />
              ))}
            </div>
          )}

          {items === null && <p className="microcopy">{t('bin.state.loading')}</p>}
          {items !== null && all.length === 0 && (
            <EmptyState>{t('bin.state.empty')}</EmptyState>
          )}
          {items !== null && all.length > 0 && shown.length === 0 && (
            <EmptyState>{t('bin.state.empty-kind')}</EmptyState>
          )}

          {shown.length > 0 && (
            <ul className="trash-list">
              {shown.map((e) => (
                <li key={e.id} className="trash-row">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {/* The chevron is the whole row's affordance on the left, so the
                        two buttons on the right are never mistaken for it. Only rows
                        that HOLD something get one: a single highlight has nothing
                        to expand, and a control that opens an empty list is worse
                        than no control. */}
                    {e.child_count > 0 ? (
                      <button
                        type="button"
                        className="tp-btn tp-btn-ghost tactile trash-expand"
                        aria-expanded={open === e.id}
                        aria-label={t('bin.row.expand.aria', {
                          label: e.label || t('bin.row.expand.fallback'),
                        })}
                        onClick={() => expand(e.id)}
                      >
                        <IconChevron open={open === e.id} size={16} />
                        <span className="trash-kind">{TRASH_ICONS[e.kind]}</span>
                        <MonoLabel>{TRASH_LABELS[e.kind] ? t(TRASH_LABELS[e.kind]) : e.kind}</MonoLabel>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="trash-kind">{TRASH_ICONS[e.kind]}</span>
                        <MonoLabel>{TRASH_LABELS[e.kind] ? t(TRASH_LABELS[e.kind]) : e.kind}</MonoLabel>
                      </span>
                    )}
                    <span className="trash-label">{e.label || t('bin.row.untitled.label')}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <FieldIconButton
                        icon={<IconRevert />}
                        ariaLabel={t('bin.row.restore.aria', { label: e.label || t('bin.row.this.label') })}
                        disabled={busy}
                        onClick={() => putBack(e)}
                        tooltip={t('bin.row.restore.tip')}
                      />
                      <FieldIconButton
                        icon={<IconDelete />}
                        ariaLabel={t('bin.row.purge.aria', { label: e.label || t('bin.row.this.label') })}
                        disabled={busy}
                        onClick={() => forget(e)}
                        tooltip={t('bin.row.purge.tip')}
                        danger
                      />
                    </span>
                  </div>
                  {/* Every fact the entry has, which is what the card could not fit
                      in a 300px grid column. */}
                  <p className="microcopy">
                    {[
                      fmtDeleted(e.deleted_at),
                      e.child_count > 0 &&
                        t('common.count.phrase', {
                          n: e.child_count,
                          noun: t('unit.quote', { count: e.child_count }),
                        }),
                      e.files > 0 && t('bin.row.pictures', { count: e.files }),
                      expiryLabel(e.deleted_at, days),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {open === e.id && (
                    <ul className="trash-contents">
                      {(contents[e.id] || []).map((q, i) => (
                        <li key={i} style={{ borderLeftColor: `var(--hl-${colorSlot(q.color)})` }}>
                          {q.text}
                        </li>
                      ))}
                      {contents[e.id] && contents[e.id].length === 0 && (
                        <li className="microcopy">{t('bin.row.contents.empty')}</li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={asking}
        title={t('bin.confirm.title')}
        body={t('bin.confirm.body', {
          count: t('common.count.phrase', {
            n: all.length,
            noun: t('unit.entry', { count: all.length }),
          }),
        })}
        confirmLabel={t('bin.confirm.label')}
        onConfirm={emptyAll}
        onCancel={() => setAsking(false)}
      />
    </section>
  )
}

// colorSlot maps a stored colour word to its category slot, so a binned quote's
// stripe is the colour the reader named rather than the storage token. The order
// is the schema's CHECK order, which is what CATEGORY_PALETTE follows too.
const COLOR_SLOTS = { yellow: 1, blue: 2, pink: 3, orange: 4, green: 5, purple: 6 }
export function colorSlot(word) {
  return COLOR_SLOTS[word] || 1
}
