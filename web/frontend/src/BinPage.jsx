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
  IconBooks,
  IconChevron,
  IconDelete,
  IconDialogue,
  IconHighlight,
  IconMerge,
  IconUsers,
  NameScroll,
  IconPerson,
  IconQuote,
  IconReel,
  IconRevert,
  InfoDot,
  MonoLabel,
  PageHeader,
  Select,
  ErrorText,
  toast,
  useIsMobileScreen,
  useScreenBar,
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
  // SINCE 0032 AND UNLABELLED UNTIL NOW — a bulk delete has been drawing the raw
  // wire word 'selection' in this list for its whole life, found by the check in
  // bin-kinds.test.js. It is ONE entry holding every row from every item, so the
  // bin shows one decision rather than forty, and the word says the act.
  selection: 'bin.kind.selection.label',
  // NOT A DELETION, and the label says so. Every other kind here is "rows that
  // went"; this one is two records that became one, and what the bin holds is the
  // way back rather than the record itself — which is why its entry names both
  // sides ("M. Bulgakov → Mikhail Bulgakov") instead of one title.
  'person-merge': 'bin.kind.merge.label',
  'character-merge': 'bin.kind.charmerge.label',
  // A DELETED RECORD IS "ROWS THAT WENT" AGAIN, so these two read like the kinds
  // above rather than like the two merges: what the bin holds IS the record, and
  // the entry names it. A work_cast row has no entry here at all — that is
  // attribution, and correcting how one work bills somebody stays permanent.
  'person-delete': 'bin.kind.person.label',
  'character-delete': 'bin.kind.character.label',
}

const TRASH_ICONS = {
  book: <IconBooks />,
  movie: <IconReel />,
  annotation: <IconHighlight />,
  dialogue: <IconDialogue />,
  quote: <IconQuote />,
  account: <IconPerson />,
  // Many kinds went at once, so there is no WHAT to draw: like the merges below,
  // it wears the verb that made it.
  selection: <IconDelete />,
  // The one row here that is not a deletion wears the verb that made it, not a
  // person: every other glyph in this table names WHAT went, and nothing went.
  'person-merge': <IconMerge />,
  'character-merge': <IconMerge />,
  // These two DID delete something, so they wear what went. The app has no mask or
  // drama glyph, so a character takes IconUsers — a role is a person a work has
  // more than one of — rather than IconPerson, which would make the two rows
  // indistinguishable at a glance in a list whose whole job is telling them apart.
  'person-delete': <IconPerson />,
  'character-delete': <IconUsers />,
}

// TRASH_CHILD_NOUN: what an entry's child_count is COUNTING, per kind.
//
// EVERY ROW USED TO SAY "quote", and for the content kinds that is right — a binned
// book holds its highlights. It was never right for a merge, whose count is the
// works that changed hands, and a render of the new kinds is what made that
// visible: a merged author read "1 quote" for a book.
//
// A kind absent from this table counts NOTHING and its row shows no number. That is
// the two record deletes, deliberately: what came off a deleted person is its
// aliases, its cast pairings and its linked lines together, and there is no honest
// single noun for that mixture. The row says whose record it is, which is the fact
// a reader is deciding on.
export const TRASH_CHILD_NOUN = {
  book: 'unit.quote',
  movie: 'unit.quote',
  annotation: 'unit.quote',
  dialogue: 'unit.quote',
  quote: 'unit.quote',
  account: 'unit.quote',
  selection: 'unit.quote',
  'person-merge': 'unit.work',
  'character-merge': 'unit.work',
}

// TRASH_EXPANDABLE: whose payload the expanded row can actually list.
//
// snapshotContents reads a SNAPSHOT — the annotations, dialogues and utterances an
// entry is holding. The four identity kinds carry a REVERSAL instead, which decodes
// into that shape as an empty one, so their chevron opened a list with nothing in
// it. Found on a render; the chevron is now drawn only where there is something
// behind it, which is the rule the code beside it already states for a single
// highlight.
const TRASH_EXPANDABLE = (kind) => TRASH_CHILD_NOUN[kind] === 'unit.quote'

// The plural each kind counts in, for the filter chips. "Film or shows" is not a
// phrase, which is why this is a table rather than a suffix.
const TRASH_PLURALS = {
  book: 'bin.kind.book.plural',
  movie: 'bin.kind.movie.plural',
  annotation: 'bin.kind.annotation.plural',
  dialogue: 'bin.kind.dialogue.plural',
  quote: 'bin.kind.quote.plural',
  account: 'bin.kind.account.plural',
  selection: 'bin.kind.selection.plural',
  'person-merge': 'bin.kind.merge.plural',
  'character-merge': 'bin.kind.charmerge.plural',
  'person-delete': 'bin.kind.person.plural',
  'character-delete': 'bin.kind.character.plural',
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

export default function BinPage() {
  const mobile = useIsMobileScreen()
  const [items, setItems] = useState(null) // null = still loading
  const [days, setDays] = useState(30)
  const [open, setOpen] = useState(null) // the expanded entry id
  const [contents, setContents] = useState({}) // id -> [{text, color}]
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false) // "empty it" confirmation
  const [kind, setKind] = useState('all')
  const [err, setErr] = useState('')

  async function load() {
    const r = await json('GET', '/trash')
    // A FAILURE IS NOT AN EMPTY BIN, and on this screen the difference is the
    // whole point of the screen. `setItems([])` drew the empty state, which reads
    // "nothing deleted — anything you delete waits here first": a reader whose
    // request failed was told their deleted work is gone. `items` stays null so
    // no branch below claims anything, and the error says what happened.
    //
    // `days` IS LEFT ALONE for the same reason. GET /trash is its only source, so
    // defaulting it here would have the header and the ⋯ both asserting a
    // retention nothing reported.
    if (!r.ok) return setErr(errText(r, t('error.load.bin')))
    setErr('')
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
    // The row's own list, and the same rule at the smaller grain: an entry whose
    // contents failed to load must not draw as an entry holding nothing.
    if (!r.ok) return toast(errText(r, t('error.load.bin')))
    setContents((c) => ({ ...c, [id]: r.data.contents || [] }))
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
  // "N quotes held" counts only the entries whose children ARE quotes — a merge's
  // works and a deleted record's aliases are not quotes, and adding them in made
  // the page's own summary line the largest wrong number on the screen.
  const held = all.reduce(
    (n, e) => n + (TRASH_CHILD_NOUN[e.kind] === 'unit.quote' ? e.child_count || 0 : 0),
    0,
  )
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

  // KEEP FOR is a choice among four known windows, so it is four rows with the
  // current one ticked — the case a menu bar handles better than a select, because
  // the answer is visible without opening a second control. "Empty now" is absent
  // rather than greyed when the bin is empty: a menu row cannot be disabled, and
  // the verb has nothing to act on.
  useScreenBar({
    actions: () => [
      { id: 'h-keep', heading: t('bin.keep-for.label') },
      ...retentionOptions().map(([value, label]) => ({
        id: `keep-${value}`,
        label,
        checked: String(days) === String(value),
        onClick: () => setWindow(value),
      })),
      ...(all.length > 0
        ? [
            { id: 'h-do', heading: t('common.mono.actions.label') },
            { id: 'empty', icon: <IconDelete />, label: t('bin.empty-now.label'), onClick: () => setAsking(true), danger: true },
          ]
        : []),
    ],
  })
  return (
    <section className="space-y-6" data-screen-label="bin">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        {/* NO BACK LINK, AND NO DOOR NAMED. This screen used to be reachable only
            from Settings, so it named that door — "a bare back arrow on a screen
            nothing in the nav points at leaves you guessing where it goes". The
            rail and the phone drawer both point at Bin now, and Checks reaches it
            too, so the arrow pointed at one of several ways in and was wrong for
            every reader who had not come that way. The crumb and the phone header
            say where you are; the rail says how to leave. */}
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

          <ErrorText>{err}</ErrorText>
          {items === null && !err && <p className="microcopy">{t('bin.state.loading')}</p>}
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
                    {e.child_count > 0 && TRASH_EXPANDABLE(e.kind) ? (
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
                    <NameScroll className="trash-label">{e.label || t('bin.row.untitled.label')}</NameScroll>
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
                        TRASH_CHILD_NOUN[e.kind] &&
                        t('common.count.phrase', {
                          n: e.child_count,
                          noun: t(TRASH_CHILD_NOUN[e.kind], { count: e.child_count }),
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
