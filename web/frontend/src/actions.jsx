import {
  IconAnthology,
  IconCopy,
  IconDelete,
  IconDetails,
  IconEdit,
  IconHeart,
  IconMetadata,
  IconMoveTo,
  IconPalette,
  IconQuiz, IconPractise,
  IconQuizSkip,
  IconSeal,
  IconShare,
  IconTag,
} from './ui.jsx'
import { t } from './i18n.js'

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

// ONE THING A CARD MENU CALLS ITS SUBJECT. A quote is "this quote"; a book is
// "this book" and a film or show is "this title", which is the same word the
// bulk bar's delete phrase uses (KIND_ROUTES in bulkOps.jsx) — a menu that says
// "film" over a control whose confirmation says "title" is two names for one
// thing on two surfaces that open from each other.
const subjectOf = (kind) =>
  t(kind === 'book' ? 'common.subject.book.label' : kind === 'movie' ? 'common.subject.movie.label' : 'common.subject.quote.label')

// THE NOUN FOR THE THING BEING COPIED, because English has one word for it and
// other languages have three. "A copy of the quote" covers a highlight, a film
// line and a proverb alike; Bengali names each of them separately, so the noun is
// a slot the locale fills rather than a word baked into the sentence. The kinds
// come from `unit.*`, which already carries them for the counts.
const duplicateNoun = (kind, item) =>
  (kind === 'movie'
    ? t('unit.dialogue.one')
    : item?.kind === 'proverb'
      ? t('vocab.quote-kind.proverb.label')
      : t('unit.quote.one')
  ).toLowerCase()

// actionsFor lists what can be done to one item, in the order a surface should
// show them. Filtering by `ctx` happens here so no caller has to remember which
// actions its screen supports.
//
// A WORK GETS A LIST HERE TOO (1.14.2), and until now it did not. The two halves
// of the registry had drifted in the one direction nothing checks: `bulkActionsFor`
// grew a work branch in 1.11.1 and this function stayed quote-only, so a book
// tile's context menu had nothing to render and the comment in WorkCard said as
// much — "a menu that opened on a gesture and offered nothing would teach the
// gesture and then refuse it". The bar could skip a book in the quiz, fill its
// gaps, edit it and delete it with exactly one thing selected. The tile it was
// selected from could do none of them, which is the very asymmetry this file
// exists to make impossible.
export function actionsFor(kind, item, ctx = {}) {
  const isWork = isWorkKind(kind)
  const subject = subjectOf(kind)
  const all = [
    {
      id: 'copy',
      label: t('common.action.copy.label'),
      where: ROW,
      icon: <IconCopy />,
      tooltip: t('common.action.copy.tip', { subject }),
      // A work has no words to put on the clipboard — its quotes do, one level
      // down — and no share card of its own. Both were "available" on a book
      // for as long as this list was quote-only, and both would have thrown the
      // moment a work surface passed the callbacks.
      available: !isWork && !!ctx.copy,
      run: () => ctx.copy(item),
    },
    {
      id: 'share',
      label: t('common.action.share.label'),
      where: ROW,
      icon: <IconShare />,
      tooltip: t('common.action.share.tip', { subject }),
      available: !isWork && !!ctx.share,
      run: () => ctx.share(item),
    },
    {
      id: 'fill',
      label: t('common.action.fill.label'),
      where: OVERFLOW,
      icon: <IconMetadata />,
      tooltip: t('common.action.fill.tip'),
      // Fetch what is MISSING and touch nothing else — the same guarantee the
      // bulk version gives, which is what makes it safe to be one menu item
      // rather than a console with a diff table.
      available: isWork && !!ctx.fillGaps,
      run: () => ctx.fillGaps(item),
    },
    {
      id: 'practise',
      label: t('common.action.practise.label'),
      where: OVERFLOW,
      icon: <IconPractise />,
      tooltip: t('common.action.practise.tip', { subject }),
      // A THEMED ROUND OVER ONE WORK. The endpoint takes a single book or movie
      // id (review_theme.go), which is why this is `single` rather than absent
      // from the bulk list: "practise these forty books" is not this action
      // forty times, it is a round the server has no way to describe.
      //
      // Works only. "Practise this quote" would be a round of exactly one card,
      // which is a flashcard with extra steps — and the thing a reader means by
      // pointing at one quote is Favourite or Skip, both of which are here.
      single: true,
      available: isWork && !!ctx.practise,
      run: () => ctx.practise(item),
    },
    {
      id: 'review',
      // Names the ACTION and flips, exactly as the bar's does. The card wears
      // the matching mark since 1.14.2, so the menu that changes it and the
      // glyph that reports it are the same drawing.
      label: t(ctx.excluded ? 'common.action.review.add.label' : 'common.action.review.skip.label'),
      where: OVERFLOW,
      icon: ctx.excluded ? <IconQuiz /> : <IconQuizSkip />,
      tooltip: t(ctx.excluded ? 'common.action.review.add.tip' : 'common.action.review.skip.tip'),
      available: !!ctx.setReview,
      run: () => ctx.setReview(item, !!ctx.excluded),
    },
    {
      id: 'edit',
      label: t('common.action.edit.label'),
      where: OVERFLOW,
      icon: <IconEdit />,
      tooltip: t('common.action.edit.tip', { subject }),
      // The one action that genuinely does not generalise to a selection: editing
      // forty quotes at once is a bulk FIELD change, which is a different act with
      // a different form, not this action applied N times.
      single: true,
      available: !!ctx.edit,
      run: () => ctx.edit(item),
    },
    {
      id: 'favourite',
      // Named for what pressing it DOES, like every other item in a menu, so it
      // reads as an action rather than as a report of where the quote stands.
      // The card's own ♥ is the other half — that one is a toggle and shows the
      // state — and the two are the same pair as a board's Hide/Show beside
      // Settings' eye: different widget, different rule.
      label: t(ctx.favourited ? 'common.action.favourite.menu.off.label' : 'common.action.favourite.menu.on.label'),
      where: OVERFLOW,
      icon: <IconHeart />,
      tooltip: t('common.action.favourite.tip', { subject }),
      // HERE BECAUSE OF THE PHONE, not for symmetry. The ♥ is drawn on the card
      // on a pointer device, where hovering reveals the action row; a thumb
      // reaches this list first, and favouriting is the single most common thing
      // anyone does to a quote. It was the one action the bulk bar offered and
      // one card could not.
      //
      // NOT OFFERED ON A WORK, and this one is a genuine constraint rather than
      // a decision. A book's ♥ has no endpoint of its own: it is a field of the
      // full-state PUT, and the row a board holds is the LIST shape, which
      // carries neither the description nor the ISBN nor the two other credits.
      // Favouriting from a tile would send that shorter row back as the whole
      // book and silently blank every field the board never fetched. The
      // work's own page has the full row and keeps the ♥.
      available: !isWork && !!ctx.favourite,
      run: () => ctx.favourite(item),
    },
    {
      id: 'duplicate',
      label: t('common.action.duplicate.label'),
      // THE ONE ROW IN THIS MENU THAT EXPLAINS ITSELF, and it has to: "Duplicate"
      // is unambiguous about the verb and silent about the scope, and the scope is
      // the whole question. What comes across is everything except the fact that
      // Save writes a NEW record — so the sub-line lists what carries rather than
      // leaving a reader to press it and find out.
      sub: t('common.action.duplicate.sub', { kind: duplicateNoun(kind, item) }),
      where: OVERFLOW,
      icon: <IconCopy />,
      tooltip: t('common.action.duplicate.tip'),
      // IT OPENS THE FORM ON A COPY AND CREATES NOTHING UNTIL SAVE — a duplicate
      // you abandon is a duplicate that never existed. That is why this is not a
      // POST with an undo behind it: a reader duplicates a quote in order to
      // CHANGE it, so the form is the point rather than a step after it.
      //
      // Duplicating forty quotes is not this action forty times; it is a thing
      // nobody wants, and the form has one set of boxes.
      single: true,
      // Not a work. "Another copy of this book" is a second edition or a re-read,
      // and neither is a record this form can write.
      available: !isWork && !!ctx.duplicate,
      run: () => ctx.duplicate(item),
    },
    {
      id: 'board',
      label: t('common.action.board.label'),
      where: OVERFLOW,
      icon: <IconMoveTo />,
      tooltip: t('common.action.board.tip'),
      // Moving a quote between boards was reachable only by opening the edit form
      // and changing one select in it — which is the whole form, and a full-state
      // PUT, for a move. The bulk bar has the same action, and the registry's
      // standing rule is that a thing you can do to forty you can do to one.
      //
      // Gated on the CALLBACK, not on the kind: the Quotes screen renders the same
      // AnnotationCard the Library does, and that call site names the kind
      // 'annotation'. A kind test here would be a control that is right about
      // boards and silently absent on the one screen that has them.
      available: !!ctx.setBoard,
      run: () => ctx.setBoard(item),
    },
    {
      id: 'delete',
      label: t('common.action.delete.label'),
      where: OVERFLOW,
      icon: <IconDelete />,
      tooltip: t('common.action.delete.tip', { subject }),
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
// Where a standalone quote is filed. Named for the thing rather than for the
// column (`board_id`), like every other constant here.
export const BULK_BOARD = 'board'
// Which anthology a selection is gathered into. Bulk-only by nature and not an
// omission from the item list: gathering ONE quote is a real thing to want, but the
// selection is how you say which quotes, and the card menu has no picker in it.
export const BULK_ANTHOLOGY = 'anthology'
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
//
// EVERY BULK ACTION NOW CARRIES A PLACEMENT AND A PICTURE (1.12.0), the same two
// fields the item list has carried since the card grew a ⋯. The bar was a row of
// words that grew one word per release and had run out of room on a phone; it is
// three glyphs and an overflow now, and WHICH three is a decision that belongs
// here beside the actions rather than in the component that draws them. ROW and
// OVERFLOW are the same two constants the card uses, on purpose: "where does this
// action sit" is one question, and answering it twice in two vocabularies is how
// a bar and a menu start disagreeing about what is important.
export function bulkActionsFor(kind, items, ctx = {}) {
  const isWork = isWorkKind(kind)
  // A selection of exactly one is the only selection some actions mean anything
  // over. Edit is the obvious case — editing forty quotes at once is a bulk FIELD
  // change with its own form, not this action forty times — and Set fields is its
  // mirror: over a single work it is strictly worse than the full form beside it.
  // So the two are never offered together, and neither is ever a dead control.
  const one = items.length === 1
  const all = [
    // ---- a selection of quotes ---------------------------------------------
    {
      id: 'colour',
      label: t('common.action.colour.label'),
      where: ROW,
      icon: <IconPalette />,
      form: BULK_COLOUR,
      // First, and in the row rather than the menu: colour is the single most
      // plausible reason to select forty quotes, and it needs no typing. A "Set
      // colour" that then asks which one is one tap too many for exactly that.
      available: !isWork && !!ctx.setColour,
      run: (values) => ctx.setColour(items, values),
    },
    {
      id: 'add-tags',
      label: t('common.action.add-tags.label'),
      // Behind the ⋯ because it is the one quote action that needs a KEYBOARD.
      // Standing open in the row, its text field was the widest thing in a strip
      // that has to fit on a phone, and it was open on every selection whether or
      // not anybody meant to type.
      where: OVERFLOW,
      icon: <IconTag />,
      form: BULK_TAGS,
      // `!isWork` like its three neighbours, and it was the one of the four
      // missing it. A tag belongs to a QUOTE — there is no book_tags table and
      // no `add_tags` on /books/bulk, only `add_genres` — so this could never
      // have worked over a selection of books. Nothing showed, because the only
      // thing keeping it off the bar was SelectionBar passing no callback for
      // the work half; the guard belongs here, beside the identical ones on
      // colour, seal and favourite, where the rule is stated once.
      available: !isWork && !!ctx.addTags,
      run: (values) => ctx.addTags(items, values),
    },
    {
      id: 'sticker',
      label: t('common.action.seal.label'),
      where: OVERFLOW,
      icon: <IconSeal />,
      form: BULK_STICKER,
      // The one bulk action with an image in it, so it asks in a dialog rather
      // than in the bar — a strip of stickers is wider than a sticky row.
      available: !isWork && !!ctx.setSticker,
      run: (values) => ctx.setSticker(items, values),
    },
    {
      id: 'favourite',
      label: t('common.action.favourite.menu.on.label'),
      where: ROW,
      icon: <IconHeart />,
      form: BULK_NONE,
      available: !isWork && !!ctx.favourite,
      run: () => ctx.favourite(items),
    },
    // ---- a selection of works ----------------------------------------------
    {
      id: 'fill',
      label: t('common.action.fill.label'),
      where: ROW,
      icon: <IconMetadata />,
      form: BULK_NONE,
      // Fetch what is MISSING and touch nothing else, which is what makes it safe
      // to be a button rather than a console with a diff table. See metadata_fill.go.
      available: isWork && !!ctx.fillGaps,
      run: () => ctx.fillGaps(items),
    },
    {
      id: 'shelf',
      label: t('common.action.shelf.label'),
      where: ROW,
      icon: <IconMoveTo />,
      form: BULK_SHELF,
      available: isWork && !!ctx.setShelf,
      run: (values) => ctx.setShelf(items, values),
    },
    {
      id: 'board',
      label: t('common.action.board.label'),
      where: OVERFLOW,
      icon: <IconMoveTo />,
      form: BULK_BOARD,
      // The mirror of `shelf` on the other side of the split: a work is filed on
      // a shelf, a standalone quote on a board, and neither has the other's.
      // Offered ONLY where boards exist — a selection of annotations or dialogues
      // has no board to move to, because those belong to their book or their film —
      // and the bar says so by passing the callback on that screen alone.
      available: !!ctx.setBoard,
      run: (values) => ctx.setBoard(items, values),
    },
    {
      id: 'anthology',
      label: t('common.action.anthology.label'),
      where: OVERFLOW,
      icon: <IconAnthology />,
      form: BULK_ANTHOLOGY,
      // THE ONLY DOOR INTO AN ANTHOLOGY, which is why it is here rather than on the
      // anthologies screen: the add route takes (kind, item_id) pairs, and only a
      // screen holding quotes can name them. Quotes only — a book is not a passage,
      // and an anthology of covers is not a thing.
      //
      // Behind the ⋯ because it asks a question (which anthology) and because
      // gathering is a considered act rather than the reflex colour-and-tag pair the
      // row is reserved for.
      available: !isWork && !!ctx.addToAnthology,
      run: (values) => ctx.addToAnthology(items, values),
    },
    {
      id: 'set-fields',
      label: t('common.action.set-fields.label'),
      where: OVERFLOW,
      icon: <IconDetails />,
      form: BULK_FIELDS,
      // EVERY KIND, since 2.2.6, and it was works-only for five releases with a
      // note here saying the quote side was "a later commit". What made it that
      // commit is 0053: a reader upgrading from the free-text `medium` has a pile
      // of quotes whose old text the pass could not read, the card shows that text
      // so it is visible as work to do, and filing it was one dialog per quote.
      //
      // `bulkFieldsFor` already answers per kind (bulkOps.jsx) and the endpoints
      // already take every field it offers (quoteFieldKinds, bulk_handlers.go), so
      // this is the argument they were waiting for rather than a new feature.
      //
      // Still only over a selection of SEVERAL: over one row the record's own form
      // is strictly better, and Edit is the action offered there instead.
      available: !!ctx.setFields && !one,
      run: (values) => ctx.setFields(items, values),
    },
    // ---- both ---------------------------------------------------------------
    {
      id: 'review',
      // The label is the ACTION, not the state, and it flips — a bar that always
      // said "Exclude" over a selection that already is excluded is a control
      // nobody can read the state of. `ctx.excluded` is what the rows say.
      //
      // THE PICTURE FLIPS WITH IT, which stopped being optional the moment the
      // bar became glyphs: a label carries state and a fixed glyph does not.
      label: t(ctx.excluded ? 'common.action.review.add.label' : 'common.action.review.skip.label'),
      where: ROW,
      icon: ctx.excluded ? <IconQuiz /> : <IconQuizSkip />,
      form: BULK_NONE,
      available: !!ctx.setReview,
      run: () => ctx.setReview(items, !!ctx.excluded),
    },
    {
      id: 'edit',
      label: t('common.action.edit.label'),
      where: OVERFLOW,
      icon: <IconEdit />,
      form: BULK_NONE,
      // The item list marks this `single`, and it still is: this is not editing a
      // selection, it is editing the one thing in it. Offered only at exactly one
      // so it can never be a control that means something different from the count
      // beside it — pick a second card and it is gone rather than greyed, because a
      // disabled item in a menu is a thing to wonder about.
      available: !!ctx.edit && one,
      run: () => ctx.edit(items[0]),
    },
    {
      id: 'delete',
      label: t('common.action.delete.label'),
      where: OVERFLOW,
      icon: <IconDelete />,
      form: BULK_CONFIRM,
      danger: true,
      // Last, always, and the only one that asks. Behind the ⋯ rather than in the
      // row: an unreachable-by-accident Delete is worth two taps, and a red glyph
      // sitting one thumb-width from Favourite is not a row anybody should have to
      // aim at.
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
