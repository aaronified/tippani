import { IconCopy, IconDelete, IconEdit, IconShare } from './ui.jsx'

// One list of the things you can do to a quote.
//
// Until now an action's definition was spread across whatever happened to render
// it: `QuoteActions` knew copy/share/edit/delete, a work's delete lived in its
// detail view, the shelf move lived in Library, and the search screen's bulk form
// offered tags-and-fields rather than "the things you can do to a quote". Nothing
// knew the SET, so nothing could offer the set anywhere else — which is exactly
// why there is no context menu, and why a bulk bar and a card menu would drift
// apart the moment both existed.
//
// So: one registry, and every surface renders from it.
//
//   actionsFor(kind, item, ctx)      what you can do to THIS one
//   bulkActionsFor(kind, items, ctx) what you can do to THESE
//
// `ctx` carries the callbacks a screen owns — open the share dialog, start an
// inline edit, reload the list — so the registry stays declarative and screens
// keep their behaviour. An action whose callback is absent is absent: a surface
// that cannot edit (a read-only demo, a table cell) simply does not pass `edit`.
//
// EVERY ACTION APPEARS IN BOTH LISTS OR IS EXPLICITLY MARKED, and a test says so.
// An action you can do to one thing and not to forty is a real category — Edit is
// exactly that — so it is marked `single: true` rather than quietly omitted.
// Absence is what drift looks like; a flag is what a decision looks like.

// WHERE an action goes on a card. The row is the left-hand cluster beside the ♥,
// the overflow is the ⋯ at the right end — the layout 1.7.9 settled on, now
// stated once here instead of by which component a call site happened to use.
export const ROW = 'row'
export const OVERFLOW = 'overflow'

// The five kinds anything in this registry can be about. A work (book/movie) and
// a quote (annotation/dialogue/utterance) share most of their actions, which is
// the reason one registry serves both rather than two nearly-identical ones.
export const KINDS = ['book', 'movie', 'annotation', 'dialogue', 'quote']

// actionsFor lists what can be done to one item, in the order a surface should
// show them. Filtering by `ctx` happens here so no caller has to remember which
// actions its screen supports.
export function actionsFor(kind, item, ctx = {}) {
  const all = [
    {
      id: 'copy',
      label: 'Copy',
      where: ROW,
      icon: <IconCopy />,
      tooltip: 'Copy this quote',
      available: !!ctx.copy,
      run: () => ctx.copy(item),
    },
    {
      id: 'share',
      label: 'Share',
      where: ROW,
      icon: <IconShare />,
      tooltip: 'Share this quote',
      available: !!ctx.share,
      run: () => ctx.share(item),
    },
    {
      id: 'edit',
      label: 'Edit',
      where: OVERFLOW,
      icon: <IconEdit />,
      tooltip: 'Edit this quote',
      // The one action that genuinely does not generalise to a selection: editing
      // forty quotes at once is a bulk FIELD change, which is a different act with
      // a different form, not this action applied N times.
      single: true,
      available: !!ctx.edit,
      run: () => ctx.edit(item),
    },
    {
      id: 'delete',
      label: 'Delete',
      where: OVERFLOW,
      icon: <IconDelete />,
      tooltip: 'Delete this quote',
      danger: true,
      available: !!ctx.remove,
      run: () => ctx.remove(item),
    },
  ]
  return all.filter((a) => a.available)
}

// atRow / atOverflow split a list by placement, so a card does not have to know
// the rule — and so changing where an action lives is a change in this file.
export const atRow = (actions) => actions.filter((a) => a.where === ROW)
export const atOverflow = (actions) => actions.filter((a) => a.where === OVERFLOW)

// ---------------------------------------------------------------------------
// bulk
// ---------------------------------------------------------------------------

// BULK_* name the input a bulk action needs, so the bar renders the right control
// and the registry never has to know what a control looks like. BULK_NONE is the
// empty string rather than null: every action answers "which form?" with a string,
// and a null would make "needs nothing" indistinguishable from "nobody said".
export const BULK_NONE = ''
export const BULK_TAGS = 'tags'
export const BULK_FIELDS = 'fields'
export const BULK_COLOUR = 'colour'
export const BULK_STICKER = 'sticker'
export const BULK_SHELF = 'shelf'
export const BULK_CONFIRM = 'confirm'

// WORK_KINDS — a book, a film or a show, as against the three kinds of quote.
// The split matters more here than anywhere else in the registry, because the two
// selections have almost nothing in common: a book has no colour and no tag of
// its own, and a quote has no shelf and nothing to look up.
export const isWorkKind = (kind) => kind === 'book' || kind === 'movie'

// bulkActionsFor lists what can be done to a selection of one kind, in the order
// a bar should show it: the harmless and frequent first, the destructive last and
// never adjacent to anything that merely sets a field.
//
// It is deliberately the same shape as actionsFor and deliberately NOT the same
// list. What a selection can do is a subset of what one item can do, plus the
// things that only make sense over several — and the difference is stated by
// `single` on the item side rather than by two unrelated lists that overlap.
//
// An action whose callback is absent is absent, which is how one bar serves five
// kinds and two screens without a prop that says which.
export function bulkActionsFor(kind, items, ctx = {}) {
  const isWork = isWorkKind(kind)
  const all = [
    // ---- a selection of quotes ---------------------------------------------
    {
      id: 'colour',
      label: 'Colour',
      form: BULK_COLOUR,
      // First, and with no menu item in front of it: colour is the single most
      // plausible reason to select forty quotes, and it needs no typing. A "Set
      // colour" that then asks which one is one tap too many for exactly that.
      available: !isWork && !!ctx.setColour,
      run: (values) => ctx.setColour(items, values),
    },
    {
      id: 'add-tags',
      label: 'Add tags',
      form: BULK_TAGS,
      available: !!ctx.addTags,
      run: (values) => ctx.addTags(items, values),
    },
    {
      id: 'sticker',
      label: 'Seal',
      form: BULK_STICKER,
      // The one bulk action with an image in it, so it asks in a dialog rather
      // than in the bar — a strip of stickers is wider than a sticky row.
      available: !isWork && !!ctx.setSticker,
      run: (values) => ctx.setSticker(items, values),
    },
    {
      id: 'favourite',
      label: 'Favourite',
      form: BULK_NONE,
      available: !isWork && !!ctx.favourite,
      run: () => ctx.favourite(items),
    },
    // ---- a selection of works ----------------------------------------------
    {
      id: 'fill',
      label: 'Fill gaps',
      form: BULK_NONE,
      // Fetch what is MISSING and touch nothing else, which is what makes it safe
      // to be a button rather than a console with a diff table. See metadata_fill.go.
      available: isWork && !!ctx.fillGaps,
      run: () => ctx.fillGaps(items),
    },
    {
      id: 'shelf',
      label: 'Shelf',
      form: BULK_SHELF,
      available: isWork && !!ctx.setShelf,
      run: (values) => ctx.setShelf(items, values),
    },
    {
      id: 'set-fields',
      label: isWork ? 'Set fields' : null,
      form: BULK_FIELDS,
      // Only a work has an author/director and a series to set.
      available: isWork && !!ctx.setFields,
      run: (values) => ctx.setFields(items, values),
    },
    // ---- both ---------------------------------------------------------------
    {
      id: 'review',
      // The label is the ACTION, not the state, and it flips — a bar that always
      // said "Exclude" over a selection that already is excluded is a control
      // nobody can read the state of. `ctx.excluded` is what the rows say.
      label: ctx.excluded ? 'Add to quiz' : 'Skip in quiz',
      form: BULK_NONE,
      available: !!ctx.setReview,
      run: () => ctx.setReview(items, !!ctx.excluded),
    },
    {
      id: 'delete',
      label: 'Delete',
      form: BULK_CONFIRM,
      danger: true,
      // Last, always, and the only one that asks. Never adjacent to the controls
      // that merely change a field.
      available: !!ctx.remove,
      run: (values) => ctx.remove(items, values),
    },
  ]
  return all.filter((a) => a.available)
}

// bulkable answers whether an item action has a selection equivalent, which is
// what the test pairs the two lists on. Kept next to the flag it reads so the
// rule and its exception are in one place.
export const bulkable = (action) => !action.single
