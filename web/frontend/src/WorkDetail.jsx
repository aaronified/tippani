// WorkDetail — ONE work page, for a book, a film, a show and a game.
//
// NOT TO BE CONFUSED WITH WorkDetails.jsx beside it, which is the *Details
// PANEL* this screen opens (the editable field sheet). This file is the screen.
//
// WHY IT EXISTS. A book's detail lived in Library.jsx and a film's in Movies.jsx,
// and the two had stopped being one screen with type differences: two columns on
// one and a single stack on the other, a hero whose facts were doors on one and
// dead text on the other, a credit row of person chips against a sentence with a
// middle dot in it, a back link that named a board the app had renamed. None of
// that was decided; it is what two copies do. So the copies are gone and what
// differs is a row in workKinds.js — which is the owner's requirement stated
// exactly: change one place, and every work page changes with it.
//
// THE SHAPE. `side` says which endpoint family to load from — the only thing
// known before the fetch. The KIND is `media_type` on the row that arrives, so
// everything the screen says about itself comes from `specFor(side, item)` and a
// film's spec stands in until the row lands.
//
// THE BOARD IS A RENDER PROP, on purpose and for one release. Annotations and
// Dialogues are still two components; folding them is the next step, and passing
// the board in means this commit changes the shell without touching the boards —
// so if either board regresses, it is not this change.
//
// WHAT IS DELIBERATELY NOT A VALUE. Two things, and both are hooks:
//
//   1. usePeople is called THREE TIMES, always, padded with '' where the kind
//      has fewer credit roles. Looping spec.credits would change the hook count
//      between a film (one role) and a game (two) — and works are switched
//      WITHOUT unmounting this screen, so React would throw "rendered fewer
//      hooks than expected" on navigation rather than on mount. usePeople('')
//      is a documented no-op; cast.jsx already relies on it.
//   2. A credit whose personKind is null is plain text rather than a chip. That
//      is a game's publisher: it has no people row, no portrait and no panel, so
//      a clickable name would promise a page that does not exist.

import { Fragment, useEffect, useRef, useState } from 'react'
import { DEMO, errText, json } from './api.js'
import { deleteWithUndo } from './undo.jsx'
import { publishSearchSeed, workSeedChip } from './facets.js'
import { t } from './i18n.js'
import { nameFor } from './languages.jsx'
import { PersonChip, PersonModal, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { usePractice } from './review.jsx'
import {
  Cover,
  DetailFrame,
  ErrorText,
  IconDelete,
  IconDetails,
  IconExport,
  IconFilter,
  IconPractise,
  IconReadAgain,
  IconWatching,
  IconButton,
  MonoLabel,
  PanelHost,
  formatYear,
  seriesLabel,
  shelfLabel,
  todayPartial,
  useColumnScroll,
  useCrumb,
  useIsMobileScreen,
  usePanelStack,
  useReveal,
  useScreenBar,
  useScreenOwnsScroll,
  useTwoColumn,
} from './ui.jsx'
import { workDetailsPanel } from './WorkDetails.jsx'
import { characterPanel } from './identity.jsx'
import {
  ACTIVE_STATUS,
  HeroCounts,
  HeroKindRow,
  InProgressCapDialog,
  SHELF_CAPS,
  ShelfControl,
  ShelfDateDialog,
  WorkDeleteConfirm,
  WorkHero,
  capKeyFor,
  isActive,
  moveLabel,
} from './works.jsx'
import { specFor } from './workKinds.js'

// The shelf's one-press move wears the medium's own glyph. A table rather than a
// ternary for the same reason every other kind fact is one.
const SHELF_ICONS = { 'read-again': IconReadAgain, watching: IconWatching }

// The one text field among the status body's numbers. Named, because a `|| 0`
// applied to a string field would send the server a zero where it wants a word,
// and the next field added to statusFields should not have to remember that.
const STATUS_TEXT = new Set(['pos_unit'])

// setWorkStatus moves one work to a shelf state. Its own endpoint, because the
// transition and the read log have to move together. Returns an error string.
async function setWorkStatus(spec, id, body) {
  const r = await json('PUT', `/${spec.workPath}/${id}/status`, body)
  return r.ok ? '' : errText(r, t('error.save.generic'))
}

// workState is the full PUT body for one work with one field changed — the
// hero's ♥. THE PER-KIND BUILDER, NEVER A UNION OF THE TWO: a field missing from
// a full-state body is a field the PUT clears, and this app has been caught by
// that on a different column six times. So the builder comes in from the screen
// that owns the row rather than being reconstructed here.

export default function WorkDetail({
  side,
  id,
  onClose,
  creditSeparators,
  onAdd,
  onSearch,
  dataNonce,
  // (item, fields) => full-state PUT body. bookState / movieState.
  stateBuilder,
  // ({ item, spec, mobileFilter, setMobileFilter, onStats, seps, creditMaps }) => node
  renderBoard,
}) {
  // A THEMED ROUND OVER THIS WORK. The engine has taken `?book=` and `?movie=`
  // since themed practice shipped, and the action registry has carried a Practise
  // entry for a work all along — it was only ever offered from a person's panel
  // and from a colour on Stats, so the one screen where "quiz me on this" is the
  // obvious thing to want had no way to ask.
  const { practise, practiceDialog } = usePractice()
  const [item, setItem] = useState(null)
  // Everything this screen says about its own kind. Resolved from the loaded row,
  // because only media_type tells a game from a film — before it lands the side's
  // own row stands in, which is what lets the frame draw while the fetch is out.
  const spec = specFor(side, item)
  // THE DETAILS SURFACE IS A PANEL, so what used to be a boolean is the stack
  // itself. Its own effect closes it when the id changes.
  const detailsStack = usePanelStack()
  // Every door into Details — the ⋯ menu, the header key, the phone dock — opens
  // the same descriptor. `open` rather than `push`: this is "show me this", so it
  // replaces whatever a previous control left open instead of burying it.
  const openDetails = () => {
    if (!item) return
    detailsStack.open(workDetailsPanel(detailsStack, {
      kind: spec.side,
      item,
      onChanged: setItem,
      onDelete: remove,
    }))
  }
  const [error, setError] = useState('')
  const [person, setPerson] = useState(null) // a credit's metadata panel
  const [mobileFilter, setMobileFilter] = useState(false)
  // Live unfiltered quote counts, reported up by the board — total, plus how many
  // are favourited / noted / tagged. The total drives the Wishlist tag, so this
  // work's first quote retracts the tag on the spot rather than at the next
  // visit; all four print in the hero. null until the quotes land, and a hero
  // with no counts prints none rather than printing zeroes.
  const [quoteStats, setQuoteStats] = useState(null)
  const quoteCount = quoteStats?.total ?? null
  // Shelf machinery. `pending` is a transition waiting on its date prompt;
  // `capPool` the works already in progress, held while the cap dialog is open.
  const [pending, setPending] = useState(null) // { status, date }
  const [capPool, setCapPool] = useState(null)
  const [capBusyId, setCapBusyId] = useState(null)
  const [capError, setCapError] = useState('')
  const [shelfBusy, setShelfBusy] = useState(false)
  const [asking, setAsking] = useState(false)

  // THREE FIXED SLOTS — see the header. A book has author · translator · editor;
  // a film a director; a game a studio and a publisher. Loaded on the WORK PAGE
  // only: no board draws the secondary credits, so no board pays for them.
  const roles = spec.credits || []
  const { map: creditMap0 } = usePeople(roles[0]?.personKind || '')
  const { map: creditMap1 } = usePeople(roles[1]?.personKind || '')
  const { map: creditMap2 } = usePeople(roles[2]?.personKind || '')
  const creditMaps = [creditMap0, creditMap1, creditMap2]

  const reveal = useReveal()
  const mobile = useIsMobileScreen()
  const seps = parseCreditSeps(creditSeparators)
  // One ref per column, so each remembers its own place — the shell's restoration
  // knows only window.scrollY, and on this screen the window does not scroll.
  const heroCol = useRef(null)
  const streamCol = useRef(null)

  async function load() {
    const r = await json('GET', `/${spec.workPath}/${id}`)
    if (r.ok) setItem(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    setItem(null)
    detailsStack.close()
    setQuoteStats(null)
    load()
  }, [id, side])

  // From inside a work, Search means search this work. The chip shows the title
  // and sends the id — waiting for the title is why this seeds off `item` rather
  // than off `id`, and why pressing Search before the page has loaded simply
  // searches everything rather than seeding a chip reading "#42".
  useEffect(() => {
    publishSearchSeed(item ? [workSeedChip(spec.seedField, item.id, item.title)] : [])
    return () => publishSearchSeed([])
  }, [item])

  // ---- shelf transitions -----------------------------------------------------
  // WHICH CAP POOL, and which in-progress word. The catalogue's three kinds are
  // one table with three separate caps — a binge-watched series must not crowd
  // out the one film on the go — and a game is PLAYING, not watching, so a
  // single word per side would offer a game the wrong verb and then fail the
  // server's own validation with a 400 the reader cannot act on.
  const capKey = item ? capKeyFor(spec.side, item) : spec.kind
  const activeWord = ACTIVE_STATUS[capKey]

  // save is the one path to the status endpoint; every route below funnels here.
  async function save(status, date) {
    setShelfBusy(true)
    // Carry the current position through: a transition is about the status, and
    // the server derives progress from the position when one is set. The FIELD
    // LIST IS THE KIND'S — a show's season is what its percentage comes from,
    // and a body that omits one, or sends a book a season of 0, silently resets
    // progress on the next move.
    const body = { status }
    for (const f of spec.statusFields) body[f] = item?.[f] || (STATUS_TEXT.has(f) ? '' : 0)
    if (status === activeWord) body.started_at = date || ''
    else if (status === 'completed' || status === 'abandoned') body.finished_at = date || ''
    const r = await json('PUT', `/${spec.workPath}/${id}/status`, body)
    setShelfBusy(false)
    if (r.ok) setItem(r.data)
    else setError(errText(r, t('error.save.generic')))
  }

  // pick routes the state the reader chose. Starting checks the soft cap first,
  // so the choice to run long is made in front of what is already on the shelf;
  // starting, completing and abandoning then ask for their date. Pausing and
  // clearing need neither — nothing about the log changes.
  async function pick(next) {
    if (!item) return
    if (next === activeWord && item.status !== 'paused') {
      const r = await json('GET', `/${spec.workPath}`)
      if (!r.ok) return setError(errText(r))
      // FILTERED BY CAP POOL, which matters only on the catalogue side and is
      // harmless on the books side: capKeyFor answers 'book' for every book.
      // Dropping it would count a game against the film cap of two.
      const pool = (r.data[spec.workListKey] || []).filter(
        (w) => isActive(spec.side, w) && w.id !== item.id && capKeyFor(spec.side, w) === capKey,
      )
      if (pool.length >= SHELF_CAPS[capKey]) {
        setCapError('')
        setCapPool(pool)
        return
      }
    }
    if (next === '' || next === 'paused') return save(next, '')
    setPending({ status: next, date: todayPartial() })
  }

  // Settling another work from inside the cap dialog: mark it finished as of
  // today (the dialog says so, and its own page can correct the date), then carry
  // on into the transition that was blocked once the shelf has room.
  async function release(other) {
    setCapBusyId(other.id)
    const err = await setWorkStatus(spec, other.id, { status: 'completed', finished_at: todayPartial() })
    setCapBusyId(null)
    if (err) return setCapError(err)
    const left = capPool.filter((w) => w.id !== other.id)
    if (left.length < SHELF_CAPS[capKey]) {
      setCapPool(null)
      setPending({ status: activeWord, date: todayPartial() })
      return
    }
    setCapPool(left)
  }

  // Progress rides the status endpoint with the status unchanged rather than
  // needing a route of its own. `patch` is either { progress } or a position —
  // the server derives the percentage from the latter (a physical book's page
  // count, a show's whole earlier seasons counting in full), so the position is
  // the authoritative number.
  async function saveProgress(patch) {
    setShelfBusy(true)
    const r = await json('PUT', `/${spec.workPath}/${id}/status`, { status: item.status, ...patch })
    setShelfBusy(false)
    if (r.ok) setItem(r.data)
    else setError(errText(r, t('error.save.generic')))
  }

  // THE BROWSER'S OWN confirm() USED TO ASK THIS, and it was the last one on
  // either screen: an English-only string in an app that ships Bengali,
  // unstyleable, drawn by the OS rather than by the app. The board's tile has
  // asked properly since it got a context menu — same ConfirmDialog, same copy —
  // so this is the detail screen using the door that exists. One act, one door.
  async function remove() {
    setAsking(false)
    // No reload on the Undo: this view closes on a successful delete, so the work
    // coming back has to be found again from the board. The toast still offers
    // it, and the Bin is the other way in.
    const r = await deleteWithUndo(`/${spec.workPath}/${id}`, { label: t(spec.detail.deletedToast) })
    if (r.ok) onClose()
    else setError(errText(r))
  }

  // patch PUTs the work's full current state with one field changed (the hero's
  // ♥), mirroring the quote-card pattern.
  async function patch(fields) {
    const r = await json('PUT', `/${spec.workPath}/${id}`, stateBuilder(item, fields))
    if (r.ok) setItem(r.data)
    else setError(errText(r, t('error.save.generic')))
  }

  // ---- the credits row -------------------------------------------------------
  //
  // IT HOLDS PEOPLE AND NOTHING ELSE. It used to read "Herman Melville ·
  // translator Anna · 1851 · Whales #2" on one side and "DIR. Curtiz · PUB. X"
  // on the other — a person, a role word, a year and a series in one sentence,
  // all the same size, separated by a middle dot, so the only thing telling
  // somebody's name from a number was where it happened to fall. The year and
  // the series are facts ABOUT the work and belong in the kind row above the
  // title; what is left here is a row of people.
  //
  // A CHIP, NOT A NAME IN A SENTENCE. Each credited person is a pill carrying
  // their face and their whole name — their own hit target and their own door.
  // The film's credit row was the sentence form until this merge, with underlined
  // names and a comma between; a person is an object with a border, and no
  // ellipsis on a person, ever. The row scrolls under its measured fade instead.
  //
  // NO SEPARATORS BETWEEN CHIPS. The dots were telling one name from the next; a
  // pill with a border does that by being a pill, and a dot between two of them
  // is punctuation inside a list of objects.
  //
  // ROLE-LABELLED EXCEPT THE FIRST. On a work's own page an unlabelled name is
  // read as the author or the director, so a bare second face would say the book
  // has two authors. The label takes the medium's mono voice (`creditTone`).
  const labelStyle = { color: spec.creditTone === 'amber' ? 'var(--amber)' : 'var(--faint)' }
  const metaParts = item
    ? roles
        .map((role, i) => {
          const value = item[role.field]
          if (!value) return null
          // A credit that is not a person: a game's publisher. Plain text,
          // because a chip is a door and there is nothing behind this one.
          if (!role.personKind) {
            return (
              <span key={role.field} style={labelStyle}>
                {t(role.labelKey, { name: value })}
              </span>
            )
          }
          const people = splitCredits(String(value), seps).map((n) => (
            <PersonChip key={`${role.field}-${n}`} kind={role.personKind} name={n} person={creditMaps[i]?.[n] } onOpen={setPerson} />
          ))
          if (people.length === 0) return null
          if (!role.labelKey) return <Fragment key={role.field}>{people}</Fragment>
          return (
            <span key={role.field} className="inline-flex items-center gap-1.5" style={{ flex: 'none' }}>
              <MonoLabel style={labelStyle}>{t(role.labelKey)}</MonoLabel>
              {people}
            </span>
          )
        })
        .filter(Boolean)
    : []

  // ── THE FACTS BESIDE THE KIND ARE DOORS, and on the catalogue side not one of
  // them was.
  //
  // The pack's rule: "year and language are stored, shared and searchable, so
  // each is a way into a filtered search rather than a caption." The plumbing has
  // been here the whole time — HeroFact renders a button when it is handed an
  // onClick and a flat span when it is not — and the film screen handed it none,
  // so a film's year and series looked exactly like a book's pressable ones and
  // were not.
  //
  // THE LANGUAGE IS THE ONE THAT STAYS FLAT, and the reason is the server: there
  // is no `language` facet, so a language door would be a control that can only
  // fail. Year, series and genre all have one. Adding the facet is the missing
  // half of that door and is not this change.
  //
  // A DOOR REPLACES THE WORK CHIP RATHER THAN NARROWING IT. "Books from 1967"
  // means across the library — a year door that also carried `book:this` would
  // search one book for the year it was published in, which is a question with
  // one answer and no reason to ask.
  const searchBy = onSearch
    ? (field, value, label) => {
        publishSearchSeed([{ field, value: String(value), label: label || String(value) }])
        onSearch()
      }
    : null
  // One builder per fact name. A fact whose value comes back empty draws nothing,
  // which is why "a film has no language" needs no conditional anywhere — the
  // row is simply shorter.
  const factOf = (name) => {
    if (!item) return null
    const door = spec.factDoors?.[name]
    switch (name) {
      case 'year': {
        const year = item[spec.yearField]
        return {
          key: 'year',
          label: formatYear(year, item[spec.circaField]),
          // The circa flag is a fact about the DATE, not a value the facet can
          // take, so the door sends the year and the label keeps the "c.".
          onClick: searchBy && door && year ? () => searchBy(door, year) : undefined,
          title: year ? t(spec.detail.yearTip, { year }) : undefined,
        }
      }
      case 'language':
        return { key: 'lang', label: nameFor([item.language]) }
      case 'origLanguage':
        return {
          key: 'orig',
          label:
            spec.detail.origLanguage && item.orig_language && nameFor([item.orig_language])
              ? t(spec.detail.origLanguage, { name: nameFor([item.orig_language]) })
              : '',
        }
      case 'series':
        return {
          key: 'series',
          label: seriesLabel(item),
          onClick: searchBy && door && item.series ? () => searchBy(door, item.series) : undefined,
          title: item.series ? t(spec.detail.seriesTip, { name: item.series }) : undefined,
        }
      default:
        return null
    }
  }
  const kindRow = item && (
    <HeroKindRow word={t(spec.unit.one)} links={(spec.facts || []).map(factOf).filter(Boolean)} />
  )

  const detailTitle = item ? item.title || t(spec.titleFallback) : ''
  // The shell's breadcrumb names what you have open; this is how it learns.
  useCrumb(detailTitle)
  // The sub-line under the title, in the shell's header and again as the hero's
  // mini-sub on a phone: the primary credit — a book's author, a film's
  // director, a game's studio — falling back to the year. The catalogue side
  // already fell back and the books side did not, which is a difference with no
  // argument behind it: a work whose credit has not been fetched yet now has a
  // sub-line on either side rather than on one.
  const detailSub = item ? spec.creditOf(item) || formatYear(item[spec.yearField], item[spec.circaField]) || '' : ''

  // ── WHAT THE PHONE'S TWO BARS CARRY WHILE THIS SCREEN IS OPEN.
  //
  // This replaced MobileDetailBar, which was a whole second top bar drawn INSIDE
  // the page — a back key, a title, a meta line and three controls, duplicating
  // the shell's bar rather than extending it, on the one device with no room for
  // two. The title and the sub-line go up to the header; the verbs go down to the
  // dock, where a thumb is. Back is the dock's own leftmost key and Search is
  // beside it on every screen, so neither is declared here.
  const ShelfIcon = SHELF_ICONS[spec.shelfIcon] || IconReadAgain
  useScreenBar({
    sub: detailSub || null,
    // THE WHOLE SET, for the top bar's ⋯ . These were the dock's second seat and
    // existed on a phone only; they are on both viewports now, and the desktop
    // screen — which had no menu at all and reached Details through a pencil,
    // help through the ? and delete through nothing — finally has one place that
    // says what a work's page can do.
    actions: () => [
      // The board publishes its own section AHEAD of this one, because a child's
      // effect runs first, so this heading separates what can be done to the WORK
      // from how its quotes are drawn. Two sections, two subjects, one menu.
      { id: 'h-do', heading: t('common.mono.actions.label') },
      {
        // The ROW goes in, not just the side: a game's catalogue row and a film's
        // are the same table, and only media_type tells the label which verb it
        // is naming.
        id: 'shelf',
        icon: <ShelfIcon size={24} />,
        label: moveLabel(spec.side, item?.status || '', activeWord, item || {}),
        onClick: () => pick(activeWord),
      },
      { id: 'details', icon: <IconDetails />, label: t('common.work.details.title'), onClick: () => openDetails() },
      {
        id: 'practise',
        icon: <IconPractise />,
        label: t(spec.detail.practiseMenu),
        onClick: () => item && practise({ [spec.practiseParam]: item.id, label: item.title }),
      },
      ...(DEMO ? [] : [{
        id: 'export',
        icon: <IconExport />,
        label: t(spec.detail.export),
        onClick: () => { if (item) window.location.href = `/api/${spec.workPath}/${item.id}/export` },
      }]),
      { id: 'delete', icon: <IconDelete />, label: t('common.action.delete.label'), onClick: () => setAsking(true), danger: true },
    ],
    // THE DOCK KEEPS FILTER AND GAINS A REAL SECOND VERB. Its ⋯ seat went to the
    // top bar, and the seat it vacated is worth more as Details — the thing you
    // press on a work's page after finishing it — than as a second door to a menu.
    keys: mobile ? [
      { id: 'filter', label: t(spec.detail.filterAria), icon: <IconFilter />, onClick: () => setMobileFilter(true) },
      { id: 'details', label: t('common.work.details.title'), icon: <IconDetails />, onClick: () => openDetails() },
    ] : null,
  })

  // THE FRAME, AND WHAT IT COSTS THE BACK LINK. At two columns the screen owns
  // its scrolling and the hero becomes a column of its own; below that it is the
  // page it has always been. The back button is drawn only in the second case: on
  // a wide detail the crumb already says `tippani / <title>` and the rail already
  // says which board this is, so a third way to leave was a control earning
  // nothing but a row.
  //
  // THE CATALOGUE SIDE HAD NONE OF THIS. It rendered a single stacked section, so
  // at 1180px and up a film was a page you scrolled past the poster to reach the
  // lines while a book put the two side by side. The stylesheet's rules are
  // already kind-agnostic — including one keyed on a table inside the stream,
  // which the film's own table view satisfies — so this is a screen finally
  // asking for what the CSS had been offering all along.
  const wide = useTwoColumn()
  useScreenOwnsScroll(wide)
  useColumnScroll(heroCol, item ? `${spec.scrollKey}:${item.id}:hero` : null)
  useColumnScroll(streamCol, item ? `${spec.scrollKey}:${item.id}:stream` : null)

  const heroBlock = item && (
    <div>
      <WorkHero
        cover={<Cover path={item[spec.coverField]} title={item.title} badge={spec.coverBadge} hero zoomable />}
        shadow={spec.coverShadow || undefined}
        title={item.title}
        // Both sides now, and it was the books side's alone: a title is a title,
        // and two work pages disagreeing about its leading is not a type
        // difference, it is one of them having been tuned and the other not.
        titleStyle={{ lineHeight: 1.15 }}
        kindRow={kindRow}
        miniSub={detailSub || null}
        // The progress strip, welded to the foot of the artwork rather than drawn
        // as its own row — and it is the SHELF's colour, drawn whenever the work
        // is on a shelf at all. What stood here was "only while there is progress
        // to show", which is true of a work with no status and wrong for the three
        // settled states: a finished work has no percentage and is exactly the
        // case the strip reports best.
        progress={item.progress > 0 ? item.progress / 100 : null}
        // The WORDING side, not the medium: shelfLabel picks the film phrasing
        // for every catalogue row, and which of "watching" or "playing" a game
        // gets is already decided by its stored status.
        shelf={item.status || ''}
        shelfKind={spec.shelfKind}
        meta={metaParts.length > 0 && metaParts}
        // What this work is HOLDING, above the fold. The board's own toolbar count
        // is past the description on a desktop and inside the filter sheet on a
        // phone, which is a scroll away on the page whose entire subject is how
        // much you have kept out of this work.
        counts={<HeroCounts counts={quoteStats} noun={[t(spec.quoteUnit.one), t(spec.quoteUnit.other)]} tone={spec.countsTone} />}
        favorite={item.favorite}
        onFavorite={(v) => patch({ favorite: v })}
        // Shelf state, beside the hearts: the state chip (its popover holds the
        // transitions and, while in progress, the position field) and the ×N
        // counter. A set status wins over the derived Wishlist tag.
        tags={
          <ShelfControl
            // One row on a phone — the pack's stateRow — rather than a chip, a
            // second chip and a full-width track on three lines of a five-row
            // header. See ShelfControl.
            compact={mobile}
            kind={spec.side}
            item={item}
            status={item.status}
            progress={item.progress}
            pos={item}
            reads={item.reads}
            onReadsChanged={load}
            wishlist={quoteCount === 0}
            busy={shelfBusy}
            onSelect={pick}
            onProgress={saveProgress}
          />
        }
        genres={spec.genres(item)}
        // A GENRE IS THE SAME SPECIES OF FACT AS THE YEAR beside it, so it is the
        // same kind of door. HeroGenres has taken this callback since it was
        // written and neither work page passed one, which left a row of facts
        // that look pressable and are not.
        onGenre={searchBy && spec.factDoors?.genre ? (g) => searchBy(spec.factDoors.genre, g) : undefined}
        description={item.description}
        // TWO STANDING VERBS, and each of the three that left had somewhere better
        // to be. The shelf move is the state chip's own popover, two inches above
        // this row and holding the whole lifecycle rather than one step of it.
        // Export and Delete are in the ⋯ menu every screen now has: export is a
        // thing you do once a year, and a destructive verb standing beside four
        // constructive ones is where a mis-click costs a work and all its quotes.
        //
        // Five buttons was also what pushed this row below the fold in the hero
        // COLUMN, so the actions a reader came for were the one thing they had to
        // scroll to find.
        //
        // ON A PHONE TOO, and that was the phone pack's own arrangement all
        // along: `heroActions` is two full-width ghost buttons at the foot of the
        // header, and the phone comp has no ⋯ in its bar at all — the rest lives
        // in the drawer. Withholding them here left a 390px screen whose two
        // verbs were both behind a menu, on the device where a menu costs the
        // most; the ⋯ keeps its copies for the same reason the desktop does.
        actions={
          (
            <>
              {/* TWO VERBS, TWO WEIGHTS. A row of two identical buttons asks the
                  same question twice; the pack raises one of them, and the raised
                  one is Practise — it is what a reader opened this page to do,
                  while Details is where you go to correct a year. Both stretch to
                  half the column (`flex: 1 1 0` in the row's own rule) so the pair
                  reads as a choice rather than as a list that ran out of room. */}
              {/* keepLabel, because the pack draws the WORDS on both. These two are
                  the page's only standing verbs and the phone comp gives each an
                  icon and its name in a 44px well; auto-hiding the label at 390px
                  left a reader two unlabelled glyphs where the design has two
                  sentences-worth of button. */}
              <IconButton
                icon={<IconDetails />}
                label={t('common.work.details.title')}
                keepLabel
                ariaLabel={t('common.work.details.title')}
                onClick={() => openDetails()}
                tooltip={t(spec.detail.detailsTip)}
              />
              <IconButton
                icon={<IconPractise />}
                label={t('common.action.practise.label')}
                keepLabel
                className="tp-btn-primary"
                ariaLabel={t(spec.detail.practiseAria)}
                onClick={() => practise({ [spec.practiseParam]: item.id, label: item.title })}
                tooltip={t(spec.detail.practiseTip)}
              />
            </>
          )
        }
      />
    </div>
  )

  // A QUOTE'S SPEAKER CHIP OPENS THE CHARACTER, and this is the only place on the
  // board's side of the tree that can reach a panel stack — `detailsStack` above,
  // whose PanelHost is already mounted as a body-level sibling below.
  //
  // `open` rather than `push`, matching openDetails: the chip means "show me
  // this", so it replaces whatever a previous control left open instead of burying
  // it under a stack the reader has to walk back out of.
  //
  // `castId` is not optional. A work may bill one character twice — two performers
  // for one part — and both rows point at one record, so a panel told only the
  // work lifts whichever appearance comes first. That was a real bug; see
  // characterPanel, which now takes the row.
  const openCharacter = (sp) => detailsStack.open(characterPanel(detailsStack, {
    id: sp.character_id,
    name: sp.name,
    work: { kind: spec.side, id: item.id, title: item.title, castId: sp.cast_id },
  }))

  const streamBlock = item && renderBoard({
    item,
    spec,
    seps,
    creditMaps,
    mobileFilter,
    setMobileFilter,
    onStats: setQuoteStats,
    onAdd,
    dataNonce,
    openCharacter,
  })

  return (
    <section ref={reveal} className={wide ? 'reveal' : 'reveal space-y-6 md:pt-4'} data-screen-label={spec.screenLabel}>
      {!mobile && !wide && (
        <button
          className="mono-label"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
          onClick={onClose}
        >
          {/* NAMED BY THE NAV TAB'S OWN KEY. The catalogue's back link read
              "← Movies" for a release after the board was renamed, because the
              word was typed here in English rather than read from the one place
              that already holds it. */}
          ← {t(spec.backTab)}
        </button>
      )}
      <ErrorText>{error}</ErrorText>
      {wide ? (
        <DetailFrame heroRef={heroCol} streamRef={streamCol} hero={heroBlock} stream={streamBlock} />
      ) : (
        heroBlock
      )}
      {/* THE PANEL HOST IS A SIBLING OF THE PAGE, never inside the detail card:
          it portals to <body>, and a .hand-card is `isolation: isolate`, so a
          host mounted inside one would be trapped in its stacking context. */}
      <PanelHost stack={detailsStack} />
      <InProgressCapDialog
        open={!!capPool}
        items={(capPool || []).map((w) => ({
          id: w.id,
          title: w.title,
          meta: [spec.creditOf(w), formatYear(w[spec.yearField], w[spec.circaField]) || null].filter(Boolean).join(' · '),
        }))}
        cap={SHELF_CAPS[capKey]}
        noun={t(spec.capWords.one)}
        nounPlural={t(spec.capWords.other)}
        // The state chip and this dialog have to agree about the verb, so both
        // read it off `activeWord` — the pool's own in-progress word — rather
        // than naming a key twice.
        verb={shelfLabel(activeWord, spec.shelfKind)}
        pastLabel={t(spec.capWords.past)}
        busyId={capBusyId}
        error={capError}
        onRelease={release}
        onCancel={() => setCapPool(null)}
        onProceed={() => { setCapPool(null); setPending({ status: activeWord, date: todayPartial() }) }}
      />
      <ShelfDateDialog
        open={!!pending}
        title={pending ? moveLabel(spec.side, item?.status || '', pending.status, item || {}) : ''}
        label={t(
          pending?.status === activeWord
            ? spec.shelfDate.active
            : pending?.status === 'abandoned'
              ? spec.shelfDate.abandoned
              : spec.shelfDate.completed,
        )}
        value={pending?.date || ''}
        onChange={(v) => setPending((p) => (p ? { ...p, date: v } : p))}
        onCancel={() => setPending(null)}
        onConfirm={() => { const p = pending; setPending(null); save(p.status, p.date) }}
      />
      {/* At two columns the stream is inside the frame above; here it is the page
          continuing below the hero, which is what it has always been. */}
      {!wide && streamBlock}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
      {/* Phone-only route into this screen's help: the sticky bar has no room for
          a "?", so the ⋯ menu opens the same panel the desktop button does. */}
      {practiceDialog}
      {/* The board tile's dialog, not a second one that looks like it — deleting a
          work from its own screen and deleting it from its cover are one act and
          one door, phrase and all. */}
      <WorkDeleteConfirm
        open={asking}
        kind={spec.side}
        title={item?.title || ''}
        count={quoteStats?.total || 0}
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />
    </section>
  )
}
