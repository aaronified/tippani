import {
  ColorSwatches,
  Hearts,
  IconAnthology,
  IconCopy,
  IconDelete,
  IconEdit,
  IconHeart,
  IconOpen,
  IconMoveTo,
  IconPractise,
  IconShare,
  IconUpload,
  QuoteActions,
  QuoteTools,
  ReviewDot,
  useIsMobileScreen,
} from './ui.jsx'
import { t } from './i18n.js'
import { canTakeSource } from './sources.jsx'
import { QuoteSpeakButton } from './speak.jsx'

// One list of the things you can do to one quote or one work.
//
// So: one registry, and every surface renders from it, so a card menu and a
// detail view cannot disagree about what an item can do.
//
//   actionsFor(kind, item, ctx)      what you can do to THIS one
//
// `ctx` carries the callbacks a screen owns — open the share dialog, start an
// inline edit, reload the list — so the registry stays declarative and screens
// keep their behaviour. An action whose callback is absent is absent: a surface
// that cannot edit (a read-only demo, a table cell) simply does not pass `edit`.

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
// delete confirmation uses (deletePhrase in works.jsx) — a menu that says
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
// actions its screen supports. A work gets a list too, and a quote gets none of
// the work-only actions, so `isWork` decides which half of the list applies.
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
      id: 'sourceAdd',
      label: t('common.action.source.add.label'),
      where: ROW,
      icon: <IconUpload />,
      tooltip: t('common.action.source.add.tip', { subject }),
      // THE FILE THESE QUOTES CAME FROM: a subtitle for a title, an ebook for a
      // book. Absent, not disabled, where it would do nothing — a game has no
      // equivalent, and a surface that cannot take a file passes no callback.
      // One file belongs to one work.
      available: isWork && !!ctx.addSource && canTakeSource(kind, item),
      run: () => ctx.addSource(item),
    },
    {
      id: 'inContext',
      label: t('common.action.context.label'),
      where: ROW,
      icon: <IconOpen />,
      tooltip: t('common.action.context.tip', { subject }),
      // THE QUOTE IN ITS FILE: what came before and after, from rows stored when the
      // file was added. Absent unless this quote has context (the card passes the
      // callback only then), never disabled.
      available: !isWork && !!ctx.inContext,
      run: () => ctx.inContext(item),
    },
    {
      id: 'practise',
      label: t('common.action.practise.label'),
      where: OVERFLOW,
      icon: <IconPractise />,
      tooltip: t('common.action.practise.tip', { subject }),
      // A THEMED ROUND OVER ONE WORK. The endpoint takes a single book or movie
      // id (review_theme.go), and "practise these forty books" is not this action
      // forty times, it is a round the server has no way to describe.
      //
      // Works only. "Practise this quote" would be a round of exactly one card,
      // which is a flashcard with extra steps — and the thing a reader means by
      // pointing at one quote is Favourite or Skip, both of which are here.
      available: isWork && !!ctx.practise,
      run: () => ctx.practise(item),
    },
    {
      id: 'edit',
      label: t('common.action.edit.label'),
      where: OVERFLOW,
      icon: <IconEdit />,
      tooltip: t('common.action.edit.tip', { subject }),
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
      // anyone does to a quote.
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
      // PUT, for a move.
      //
      // Gated on the CALLBACK, not on the kind: the Quotes screen renders the same
      // AnnotationCard the Library does, and that call site names the kind
      // 'annotation'. A kind test here would be a control that is right about
      // boards and silently absent on the one screen that has them.
      available: !!ctx.setBoard,
      run: () => ctx.setBoard(item),
    },
    {
      id: 'anthology',
      label: t('common.action.anthology.label'),
      where: OVERFLOW,
      icon: <IconAnthology />,
      tooltip: t('common.action.anthology.tip', { subject }),
      // `AddToAnthologyDialog` finds an anthology or makes one from the name you
      // type, so the card menu has somewhere to send you.
      //
      // ON A WORK IT MEANS ITS PASSAGES, which is not a liberty taken with the
      // word. A book cannot BE an entry — `quoteOwned` accepts book, screen and
      // utterance and returns false for anything else — so "add this book to an
      // anthology" can only sensibly mean the highlights in it, and the surface
      // that offers it says so. The owner chose that reading over the two
      // alternatives.
      //
      // Gated on the CALLBACK and not on the kind, for the reason `board` gives
      // three items up: the same card is rendered by screens that name the kind
      // differently, and a kind test here is a control that is right on one screen
      // and silently missing on another.
      available: !!ctx.addToAnthology,
      run: () => ctx.addToAnthology(item),
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

// useRowSplit — what stands in a card's action row and what sits behind the ⋯.
//
// ON A PHONE THE ROW IS ONE LINE (#60). Copy, share and in-context stood beside the
// heart, the colour pick and the ⋯, and at 390px that is more than one line holds, so
// the ⋯ dropped to a second row. Nothing is lost by it: the whole list is in the menu,
// in the registry's order, so a thumb reaches the same actions one press later. On a
// wider screen the row keeps its glyphs and the menu keeps the occasional ones.
// Every quote row calls this one function, so two cards cannot split the list two ways.
export function useRowSplit(acts) {
  const phone = useIsMobileScreen()
  return phone
    ? { phone, tools: [], menu: acts }
    : { phone, tools: atRow(acts), menu: atOverflow(acts) }
}

// ---------------------------------------------------------------------------
// the row that draws the list
// ---------------------------------------------------------------------------

// ONE ROW, TWO CARDS, AND IT WAS WRITTEN TWICE.
//
// The book card (Library's AnnotationCard) and the film card (Movies' Frame)
// each kept their own copy, and the film one's comment made a promise about the
// other: "Order and contents match Library's ActionRow exactly — a dialogue is an
// annotation with different credits, and the two cards should not put the same
// control in two different places."
//
// THE PROMISE WAS TRUE AND THAT IS NOT THE SAME AS SAFE. Diffed line for line
// before this move, the order and the contents did match — and the two class
// lists did not, Library's row carrying a `pt-1.5` the frame's had never had. A
// promise kept by two people reading carefully is the repo's "two things that
// look the same behave the same" waiting to be broken by the next edit to one of
// them, which is why that directive says the verb lives in ONE function both
// screens call rather than in a line each.
//
// IT LIVES HERE AND NOT IN ui.jsx, which is where every control it draws lives:
// the row needs `atRow`/`atOverflow`, this file imports ui.jsx for its icons, and
// ui.jsx importing back would close a cycle. Beside the registry is the better
// home anyway — one file answers "what can you do to a quote" and "where do those
// go".
//
// `className` IS THE DIFFERENCE PASSED IN, which is the same directive's other
// half: where a screen genuinely needs something the other does not, it hands the
// fact over rather than keeping its own copy of the verb. Library's `pt-1.5` is a
// step typed into a row and therefore debt by this repo's spacing rule, but
// deleting it here would be a silent visual change riding along with a
// deduplication — so each screen keeps the spacing it had and the step stays
// visible as the one thing left to settle.
//
// `acts` IS STILL BUILT BY THE CARD, from the registry above — one list per card,
// rendered in three places: this row, the ⋯, and the context menu. Built in here
// instead, the gesture and the buttons would be two lists that agree by
// coincidence.
//
// §7 DECLUTTER, which is what the order is for: the favourite ♥ is the card's
// resting mark, and beside it sit the two things you do WITH a quote — copy it,
// send it — then the colour quick-pick. Those three hide until the card is
// hovered on desktop and stand on a phone, where there is no hover to wait for.
// Only edit and delete are behind the ⋯, at every width (see QuoteActions), so
// what a resting card shows is its ♥ and one quiet overflow glyph.
export function ActionRow({ acts, item, kind = 'quote', color, onColor, onFavourite, actionsAlwaysVisible = false, className = '' }) {
  const { phone, tools, menu } = useRowSplit(acts)
  return (
    <div className={('mt-1 flex items-center gap-x-3 gap-y-1 ' + (phone ? 'flex-nowrap' : 'flex-wrap') + ' ' + className).trim()}>
      {/* FIRST, BECAUSE IT IS THE CARD'S STATE — the same position the shelf chip
          takes on a work, and because a state read after four verbs reads as a
          fifth verb.

          IT WAS "THE ONE CONTROL HERE THAT IS NOT ONE" until the owner asked the
          mark to open the quote's recall history, and it is a control now: what
          it does is READ rather than change, which is why it still leads instead
          of joining the verbs. The sentence stayed true for exactly as long as
          the mark stayed inert, and a comment that describes the version before
          the change is worse than none — the next reader trusts it. */}
      <ReviewDot item={item} />
      <Hearts value={!!item.favorite} onChange={onFavourite} />
      {/* READ ALOUD: this card's own text, in its own language. Not drawn where the device has no voices. */}
      <QuoteSpeakButton kind={kind} item={item} />
      <QuoteTools actions={tools} alwaysVisible={actionsAlwaysVisible} />
      {/* shrink-0: the colour dots are one atomic control — the row wraps the ⋯
          cluster to a second line before it splits or squeezes them. (Six of
          them since 1.7.1, collapsing to a single trigger below a 330px card.) */}
      <span className={'card-colors shrink-0' + (actionsAlwaysVisible ? ' is-visible' : '')}>
        <ColorSwatches value={color} onChange={onColor} ariaLabel={t('common.colour.category.aria')} collapsible />
      </span>
      <span className="ml-auto flex items-center">
        <QuoteActions actions={menu} />
      </span>
    </div>
  )
}

// isWorkKind — a book, a film or a show, as against the three kinds of quote.
// A book has no colour and no tag of its own, and a quote has no shelf and
// nothing to look up.
export const isWorkKind = (kind) => kind === 'book' || kind === 'movie'
