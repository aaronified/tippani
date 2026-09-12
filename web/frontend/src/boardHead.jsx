// THE BAR ABOVE EVERY BOARD OF QUOTES, AND THERE IS ONE OF IT.
//
// WHY THIS FILE EXISTS. A book's highlights and a film's, a show's or a game's
// lines are the same thing arranged four ways, and the app already said so: the
// PAGE around them has been one component since WorkDetail was written, and both
// screens that render it carry the same note — "the BOARD is still this file's,
// Annotations/Dialogues is folded next, so it comes in as a render prop". Folded
// next never came. The bar above the board stayed in two copies, and they drifted
// exactly as two copies do:
//
//   the book's  .board-head, a grouping field, a named category filter, a
//               scroller of FilterChips, one accented capture button
//   the film's  a bare flex row, NO grouping at all, six bare colour dots, a
//               hand-rolled <button> carrying its heart as a text character, a
//               ghost capture button, and six strings never passed through t()
//
// The owner reported it as two different screens, which is what it was.
//
// THE REPO'S OWN RULE IS THE ARGUMENT: "similar things should act similarly… a
// control drawn by one component on two screens has ONE behaviour, and it lives
// in one function that both screens call — not in a line each, which is how one
// of them goes on being right while the other quietly stops." A board that needs
// something the other does not passes that fact IN; it does not keep its own copy
// of the verb.
//
// WHAT IS PASSED IN, AND WHY IT IS NOT MORE. The DIMENSIONS, because workKinds.js
// already knows them per kind and has since before either board could use them —
// a book groups by chapter, a show by episode, a game by act and quest. The
// NOUNS, because a film's board captures a line and a book's captures a quote and
// the app has always said so. Everything else is the same control in the same
// place, which is the whole point.

import { useRef, useState } from 'react'

import { t } from './i18n.js'
import { categoryDotClass, categoryHidden, categoryName } from './theme.js'
import {
  ANNOTATION_COLORS,
  ActionMenu,
  ColorSwatches,
  FilterChip,
  IconSliders,
  IconSortAsc,
  IconSortDesc,
  MobileSheet,
  MonoLabel,
  Scroller,
  Select,
  SheetFooter,
  StickerButton,
  ViewToggle,
} from './ui.jsx'

// CategoryFilter — which category the board is filtered to, named rather than
// guessed at from a coloured dot.
//
// The swatch alone cannot say what it is for: a reader names their own categories
// (theme.js), so the blue one might be "Fact" or "Disagree" or nothing at all,
// and a row of six dots asks them to remember which. The dot rides WITH the name
// here, which is what the colour is good at — recognising the one you already
// know — rather than being asked to carry the meaning on its own.
//
// HIDDEN SLOTS STAY HIDDEN, except the one currently chosen: a filter set to a
// category the reader has since retired must still be able to say so, or the
// board is narrowed by something with no entry in its own control.
export function CategoryFilter({ value, onChange }) {
  const opt = (tok, label) => [
    tok,
    <span className="cat-opt" key={tok}>
      <span className={`cat-opt-dot ${tok ? categoryDotClass(tok) : 'cat-opt-none'}`} aria-hidden="true" />
      <span>{label}</span>
    </span>,
    label,
  ]
  const options = [
    opt('', t('board.category.any.label')),
    ...ANNOTATION_COLORS.filter((c) => !categoryHidden(c) || c === value).map((c) => opt(c, categoryName(c))),
  ]
  return (
    <Select
      ariaLabel={t('common.colour.category.aria')}
      value={value}
      onChange={onChange}
      options={options}
    />
  )
}

// GroupSortField — the board's arrangement, in one field.
//
// GROUPING AND SORTING ARE ONE DECISION MADE TWICE. "By chapter, in reading
// order" is a single thought, and it was two controls plus a direction key
// sitting side by side in the header — three things to press for one intent,
// and the widest group in a row the design pack keeps to a single line.
//
// So the grouping is the field, and the ordering is the row at the end of its
// menu. The pack's words: "the grouping is a field on the page, so the sort is
// the row at the end of its menu rather than a second control competing for the
// header". The field states the current grouping without being opened, which is
// the job a control earns its width with; the ordering states itself as that
// row's value, so one press away is still one glance away.
//
// ONE POPOVER, TWO CONTENTS, rather than a menu that opens a second menu beside
// itself. `pop` says which is showing and the trigger is the anchor for both, so
// going from Group to Sort is the same rectangle changing what it lists — a
// desk's version of the phone pushing a sheet.
//
// A FIELD, NOT A CHIP. It carries the app's Select shape — the inset field with a
// caption and a chevron — because a chip is a filter and this is a setting, and
// the pack spends a paragraph on that exact confusion: grouping "was an
// underlined word sitting in the chip scroller: same size, same row, same species
// as 'favourites'".
export function GroupSortField({ dims, sortDims, groupBy, onGroup, sort, onSort, compact = false }) {
  const [pop, setPop] = useState(null)
  const ref = useRef(null)
  const groupLabel = t(`board.group.${dims.includes(groupBy) ? groupBy : 'none'}.label`)
  const sortLabel = t(`board.sort.${sortDims.includes(sort.col) ? sort.col : 'default'}.label`)
  const dirLabel = t(sort.dir === 'desc' ? 'board.sort.dir.desc.label' : 'board.sort.dir.asc.label')
  const items =
    pop === 'sort'
      ? [
          { id: 'h-by', heading: t('common.mono.sort.label') },
          ...sortDims.map((d) => ({
            id: `s-${d}`,
            label: t(`board.sort.${d}.label`),
            checked: sort.col === d,
            keepOpen: true,
            onClick: () => onSort((cur) => ({ col: d, dir: cur.dir })),
          })),
          // NO DIRECTION SECTION ON A PHONE. The strip beside this trigger carries
          // it as a key, on the pack's own rule — "direction is one bit, so it is
          // one tap and never a sheet" — and a bit that is one tap on the strip
          // must not also be three taps inside a menu.
          ...(compact ? [] : [{ id: 'h-dir', heading: t('board.sort.dir.label') }]),
          ...(compact ? [] : ['asc', 'desc']).map((d) => ({
            id: `d-${d}`,
            // THE BARS ARE THE GIVEAWAY, not the arrow: they grow for ascending
            // and shrink for descending, so the glyph IS the order rather than a
            // direction a reader has to translate.
            icon: d === 'asc' ? <IconSortAsc /> : <IconSortDesc />,
            label: t(`board.sort.dir.${d}.label`),
            checked: sort.dir === d,
            keepOpen: true,
            onClick: () => onSort((cur) => ({ col: cur.col, dir: d })),
          })),
        ]
      : [
          ...dims.map((d) => ({
            id: `g-${d}`,
            label: t(`board.group.${d}.label`),
            checked: groupBy === d,
            onClick: () => onGroup(d),
          })),
          {
            id: 'sort',
            icon: <IconSliders />,
            label: t('board.sort.menu.label'),
            meta: `${sortLabel} · ${dirLabel}`,
            // The one row that does NOT close the popover — it swaps what the
            // popover is showing. Set after the menu's own close runs, which is
            // why it is a state change and not a second ActionMenu.
            onClick: () => setPop('sort'),
          },
        ]
  // TWO TRIGGERS, ONE MENU. The desk's is the app's inset field with its GROUP
  // caption; the phone's is the pack's underlined word — "a strip that states the
  // count should not be as tall as a toolbar, so both controls lose their boxes
  // and keep only their words". Same rows behind both, so the two viewports
  // cannot end up offering different arrangements.
  //
  // AND THE PHONE'S TRIGGER STATES BOTH HALVES, because it is the only thing on
  // that strip that can: "chapter · location" is the whole arrangement in the
  // width of two words, where the desk has room for a caption and a field.
  return (
    <div className={compact ? 'relative board-strip-sort' : 'tp-select board-head-group'} ref={ref}>
      {compact ? (
        <button
          type="button"
          className="board-strip-trigger"
          aria-haspopup="menu"
          aria-expanded={pop != null}
          aria-label={t('board.group.aria')}
          onClick={() => setPop((p) => (p ? null : 'group'))}
        >
          {groupLabel} · {sortLabel}
        </button>
      ) : (
      <button
        type="button"
        className="tp-select-trigger tactile"
        aria-haspopup="menu"
        aria-expanded={pop != null}
        aria-label={t('board.group.aria')}
        onClick={() => setPop((p) => (p ? null : 'group'))}
      >
        <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
        <span>{groupLabel}</span>
        <svg
          className="tp-select-chev"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      )}
      <ActionMenu
        open={pop != null}
        items={items}
        anchorRef={ref}
        onClose={() => setPop(null)}
        returnFocusTo={ref}
      />
    </div>
  )
}

// BoardHead — the desk's bar: how the board is arranged on the left, the one verb
// that adds to it on the right.
//
// THE ORDER IS THE DESIGN PACK'S and it is an argument rather than a layout: how
// it is ARRANGED comes before what it is FILTERED to, because the grouping is the
// part that changes what the whole page looks like. The grouping and the category
// sit outside the scroller — "a setting that can scroll out of sight is a page
// arranged by something nothing on screen still says" — and the chips, which are
// a filter rather than a setting, scroll under the fade with the ones that are
// switched ON sorted to the front for the same reason.
//
// THE ACCENT BELONGS TO THE ONE CONTROL THAT ADDS SOMETHING, which is why capture
// is a StickerButton and nothing else in the row is. The film's was a GhostButton
// beside a ViewToggle wearing the accent gradient, so the loudest thing in that
// row was a lens.
//
// NO VIEW TOGGLE HERE, on either board, and that is also the pack's: "on the
// surface it was the widest group in the header — a 210px three-option strip —
// and it broke the row onto three lines at 720px. It is also the control changed
// least often: you pick a view and read for an hour." It lives in the screen's ⋯.
export function BoardHead({
  dims, sortDims, groupBy, onGroup, sort, onSort,
  color, onColor,
  tags = [], tag, onTag, tagAllLabel,
  chips = [],
  captureLabel, onCapture,
}) {
  return (
    <div className="board-head">
      <div className="board-head-left">
        <GroupSortField dims={dims} sortDims={sortDims} groupBy={groupBy} onGroup={onGroup} sort={sort} onSort={onSort} />
        <span className="board-head-rule" aria-hidden="true" />
        <CategoryFilter value={color} onChange={onColor} />
        {tags.length > 0 && (
          <>
            <span className="board-head-rule" aria-hidden="true" />
            <Select
              ariaLabel={t('common.filters.tag.aria')}
              value={tag}
              onChange={onTag}
              options={[['', tagAllLabel], ...tags.map((row) => [row.name, row.name])]}
            />
          </>
        )}
        {chips.length > 0 && (
          <Scroller axis="x" className="board-head-chips">
            {chips
              .slice()
              .sort((a, b) => Number(b.on) - Number(a.on))
              .map((c) => (
                <FilterChip key={c.label} active={c.on} label={c.label} tooltip={c.tip} onClick={() => c.set(!c.on)} />
              ))}
          </Scroller>
        )}
      </div>
      <div className="board-head-verbs">
        <StickerButton onClick={onCapture}>{captureLabel}</StickerButton>
      </div>
    </div>
  )
}

// BoardStrip — the phone's. A strip that states the count should not be as tall as
// a toolbar, so both controls lose their boxes and keep only their words: the
// count, the arrangement as one trigger, and the direction as a single key.
//
// THE DIRECTION IS A KEY AND NEVER A SHEET — the pack's rule, in its words:
// "direction is one bit, so it is one tap and never a sheet". GroupSortField's
// compact form drops its own direction section for exactly that reason, so the
// two halves of one decision must not both live here.
export function BoardStrip({ dims, sortDims, groupBy, onGroup, sort, onSort, children }) {
  return (
    <div className="board-strip">
      {children}
      <GroupSortField dims={dims} sortDims={sortDims} groupBy={groupBy} onGroup={onGroup} sort={sort} onSort={onSort} compact />
      <button
        type="button"
        className="board-strip-dir"
        aria-label={t(sort.dir === 'asc' ? 'board.sort.dir.asc.label' : 'board.sort.dir.desc.label')}
        onClick={() => onSort((cur) => ({ col: cur.col, dir: cur.dir === 'asc' ? 'desc' : 'asc' }))}
      >
        {sort.dir === 'asc' ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
      </button>
    </div>
  )
}

// BoardSheet — the phone's filters, which are the desk's filters and no others.
//
// A PHONE THAT OFFERS ONE FILTER AND A DESK THAT OFFERS THREE is the divergence
// these two screens kept finding in themselves, and the book board's own sheet
// says so in as many words: "the list is written once and read twice". It was
// written once per screen, so the film's sheet offered a favourites toggle and
// the book's offered three chips.
//
// THE COLOUR IS SWATCHES HERE AND A NAMED LIST ON THE DESK, and that is not a
// drift: a sheet has a caption above each control saying what it is for, so the
// dots are not being asked to carry the meaning on their own — which is the one
// thing the desk row cannot give them, and the whole argument for CategoryFilter.
//
// `extra` IS THE SLOT FOR WHAT ONE BOARD HAS AND THE OTHER DOES NOT — a film's
// cast-completing filter box, say. Passed IN rather than kept as a second copy
// of the sheet, which is the rule this file exists to keep.
export function BoardSheet({
  open, onClose, title,
  countLabel, onReset,
  color, onColor,
  tags = [], tag, onTag, tagAllLabel,
  chips = [],
  view, onView,
  extra = null,
}) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={<SheetFooter count={countLabel} onReset={onReset} onDone={onClose} />}
    >
      <div className="space-y-5">
        {extra}
        <div>
          <MonoLabel className="mb-2 block">color</MonoLabel>
          {/* Re-picking the active colour clears it — the list filter has an
              "all" state the server has no equivalent for (see validColor). */}
          <ColorSwatches value={color} onChange={(c) => onColor(c === color ? '' : c)} />
        </div>
        {tags.length > 0 && (
          <div>
            <MonoLabel className="mb-2 block">tag</MonoLabel>
            <Select
              ariaLabel={t('common.filters.tag.aria')}
              value={tag}
              onChange={onTag}
              options={[['', tagAllLabel], ...tags.map((row) => [row.name, row.name])]}
            />
          </div>
        )}
        {chips.length > 0 && (
          <div>
            <MonoLabel className="mb-2 block">show only</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <FilterChip key={c.label} active={c.on} label={c.label} tooltip={c.tip} onClick={() => c.set(!c.on)} />
              ))}
            </div>
          </div>
        )}
        <div>
          <MonoLabel className="mb-2 block">view</MonoLabel>
          <ViewToggle value={view} onChange={onView} />
        </div>
      </div>
    </MobileSheet>
  )
}
