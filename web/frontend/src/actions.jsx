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

// BULK_FORMS name the input a bulk action needs. `null` means it needs nothing —
// a favourite or a delete acts on the selection as it stands, while add-tags and
// set-fields need something typed first. The bar renders the form; the registry
// only says which one.
export const BULK_TAGS = 'tags'
export const BULK_FIELDS = 'fields'

// bulkActionsFor lists what can be done to a selection of one kind.
//
// It is deliberately the same shape as actionsFor, and deliberately NOT the same
// list: what a selection can do is a subset plus the field edits, and the
// difference is stated by `single` on the item side rather than by two unrelated
// lists that happen to overlap.
export function bulkActionsFor(kind, items, ctx = {}) {
  const isWork = kind === 'book' || kind === 'movie'
  const all = [
    {
      id: 'add-tags',
      label: 'Add tags',
      form: BULK_TAGS,
      available: !!ctx.addTags,
      run: (values) => ctx.addTags(items, values),
    },
    {
      id: 'set-fields',
      label: isWork ? 'Set fields' : null,
      form: BULK_FIELDS,
      // Only a work has an author/director and a series to set. A quote's
      // equivalent is its colour, which arrives in its own commit.
      available: isWork && !!ctx.setFields,
      run: (values) => ctx.setFields(items, values),
    },
  ]
  return all.filter((a) => a.available)
}

// bulkable answers whether an item action has a selection equivalent, which is
// what the test pairs the two lists on. Kept next to the flag it reads so the
// rule and its exception are in one place.
export const bulkable = (action) => !action.single
