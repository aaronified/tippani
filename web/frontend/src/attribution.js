// THE KIND IS THE VERB OF THE ATTRIBUTION, NOT A CHIP BESIDE IT.
//
// The report that started this: "Quote cards need better formatting (e.g. letter
// to carl seelig)." An Einstein letter, filled in the way the app asks for it,
// drew this:
//
//   Albert Einstein · Letter to Carl Seelig · 11 March 1952 · Zurich · Letter · English
//
// "Letter" twice, against this repo's own directive that a row says a thing once.
// But the duplicate was the symptom of two worse faults:
//
//   1. THE STRIP WAS A CONCATENATION, NOT A SENTENCE. `utteranceMeta` joined
//      whatever happened to be non-empty with " · ", so nothing in it knew that
//      "Letter" and "to Carl Seelig" are ONE fact. Readers compensated by typing
//      the whole phrase into Occasion, and the kind chip then said it again — the
//      interface taught them to duplicate and then punished them for it.
//   2. FOUR FIELDS WERE CAPTURED AND NEVER SHOWN. 0047 gave a quote `region`,
//      `recipient`, `work_title` and `locator`; the form asked for all four and
//      the card drew none. So the correct place to put "Carl Seelig" was a box
//      whose contents appeared nowhere, which is WHY the occasion box got used.
//
// So the kind stops being an item in a list and becomes the SHAPE OF THE PHRASE.
// The shapes are the owner's own, corrected by them after the first proposal, and
// the governing rule is theirs too: "show as little is needed to convey the
// important stuff about the quote."
//
// A PURE FUNCTION IN ITS OWN MODULE, because the shape has to be identical on the
// Quotes board, the Library list, a work page, a search hit, the recall popup and
// the share image — six surfaces, and a rule spread across six of them is six
// places for one to disagree. It imports i18n and nothing else, so it cannot be
// the far end of a cycle. Same reasoning `quoteKind.js` states for itself.

import { t } from './i18n.js'
import { quoteKindMeta } from './quoteKind.js'
import { chapterLabel } from './text.js'

const s = (v) => String(v ?? '').trim()

// attribution answers band 3 of the card — the kind's own line, under the person
// chip and above the note.
//
// `piece` IS THE ONE INPUT THAT IS NOT A COLUMN, and it needs saying. A poem
// quoted out of a book keeps the poem's NAME in the chapter-name field — the
// owner's decision, and the one that makes the three verse shapes reachable
// without a new column: `annotations` already splits a chapter into a number and a
// name (0044), and a numbered poem in a numbered collection is exactly that pair.
// The alternative was a `piece_title` column duplicating `chapter` for one kind of
// book. So a book highlight passes its `chapter` as `piece` and its book's title
// as `work_title`; a standalone poem has one title box and passes only that.
//
// Returns '' when the kind has nothing to say, which is load-bearing rather than
// tidy: a card renders this as `{line && <MonoLabel>}`, and an empty label brings
// the spacing that comes with it.
export function attribution(u, opts) {
  return attributionParts(u, opts).line
}

// WHAT THE PHRASE DID NOT CONSUME, so the strip beside it can carry the rest
// without saying anything twice. This is the half that fixes the original report:
// "Letter" appeared twice because nothing knew the kind's word and the recipient
// were one fact, and the cure is not deleting a field but knowing which fields the
// phrase already spoke for.
//
// ONE TABLE, READ ONCE. `line` and `rest` are computed together and the switch
// below is the only thing that decides either — a second table saying "a letter
// consumes its recipient" would be the same fact written twice, and the half that
// drifts is the half nobody looks at.
//
// `date` arrives already formatted, because a partial date is a string and only
// `formatPartialDate` knows how to print one — and this module deliberately
// imports i18n and nothing else, the rule quoteKind.js states for itself.
//
// REGION IS THE ONE CAPTURED FIELD DELIBERATELY LEFT OFF, on the owner's ruling
// that replaced it with the language: "a Sylheti proverb is a Bengali proverb from
// somewhere in particular, and the card has room for the general fact only". Every
// other locator a form collects appears either in the phrase or in `rest`, because
// a box whose contents show up nowhere is what taught readers to type the whole
// attribution into Occasion in the first place.
export function attributionParts(u, { piece = '', date = '' } = {}) {
  if (!u) return { line: '', rest: [] }
  const kind = s(u.kind)
  const line = phrase(u, kind, piece)
  // The four the phrase may or may not have spoken for, in reading order — coarse
  // to fine, the order a person says them: what the occasion was, when, where, and
  // where in the source.
  const spoke = CONSUMES[kind] || []
  const rest = [
    spoke.includes('occasion') ? '' : s(u.occasion),
    spoke.includes('date') ? '' : s(date),
    spoke.includes('place') ? '' : s(u.place),
    spoke.includes('locator') ? '' : s(u.locator),
  ].filter(Boolean)
  // NO THIRD KEY. This returned `spoke` for one release-in-progress, so the card
  // could ask whether the phrase had already named the language and drop the script
  // mark if it had. The owner overruled that — "the script mark should be in the
  // same row" — and an unused return key is the same dead surface as the
  // `omitSpeaker` flag deleted one commit earlier, so it goes with the reason for
  // it. `CONSUMES` stays internal, which is where a table with one reader belongs.
  return { line, rest }
}

// Which fields each kind's phrase speaks for. `date` is never consumed by any of
// them — no shape the owner settled includes it — and it is listed here rather
// than assumed so that adding a shape that DOES use it is one edit.
const CONSUMES = {
  letter: ['recipient'],
  speech: ['occasion', 'place'],
  essay: ['work_title', 'locator'],
  poem: ['work_title'],
  song: ['work_title'],
  proverb: ['language'],
}

function phrase(u, kind, piece) {
  const word = () => t(`vocab.quote-kind.${kind}.label`)
  switch (kind) {
    // "Letter to Carl Seelig" — the phrase the reader was typing into Occasion by
    // hand. With no recipient the kind's own word is all there is, which is the
    // rule that removes the duplicate without removing the information: the word
    // is printed only when nothing else in the phrase implies it.
    case 'letter': {
      const to = s(u.recipient)
      return to ? t('quote.attribution.letter-to', { name: to }) : word()
    }
    // "Nobel banquet, Stockholm". The shape implies the kind, so the word is not
    // printed beside it — and where neither half is filled, the word is the only
    // thing left to say.
    case 'speech': {
      const parts = [s(u.occasion), s(u.place)].filter(Boolean)
      return parts.length ? parts.join(', ') : word()
    }
    // The owner's correction, quotes and comma exactly as they wrote it:
    // <"{work_title}", {locator}>. A title in quotation marks is how a citation
    // names a piece inside a larger work, and the page completes it.
    case 'essay': {
      const title = s(u.work_title)
      const at = s(u.locator)
      if (title && at) return t('quote.attribution.essay-at', { title, locator: at })
      if (title) return t('quote.attribution.titled', { title })
      return at ? at : word()
    }
    // VERSE, AND THE THREE SHAPES ARE THE OWNER'S: "1 when both work and poem name
    // is available … then: {poem_name} from {work_title}; otherwise: from
    // {work_title} or {poem_name} (if only one is available)." A song takes the
    // same three — "song: same as poem" — which is why they share a branch rather
    // than keeping a copy each.
    case 'poem':
    case 'song': {
      const name = s(piece)
      const work = s(u.work_title)
      if (name && work) return t('quote.attribution.piece-from', { name, work })
      if (work) return t('quote.attribution.from', { work })
      if (name) return t('quote.attribution.titled', { title: name })
      return word()
    }
    // "Bengali proverb" — the owner's: <{language} proverb>. NOT the region, which
    // the first proposal used and they corrected: a Sylheti proverb IS a Bengali
    // proverb from somewhere in particular, and the card has room for the general
    // fact only. Region survives as a field and stops being the attribution.
    case 'proverb': {
      const lang = s(u.language)
      return lang ? t('quote.attribution.language-proverb', { language: lang }) : word()
    }
    // 'other', and the unset answer. Nothing about them can be predicted, so the
    // kind's own word is the whole of it — falling back to the legacy free-text
    // `medium` the way quoteKindMeta does, so a value 0053's one-time pass could
    // not read stays visible as work to do rather than vanishing.
    default:
      return quoteKindMeta(u)
  }
}

// attributionFor a BOOK HIGHLIGHT or a SCREEN LINE, which have no `kind` column
// and never did.
//
// THEY ARE NOT UNTYPED, THEY ARE TYPED BY THEIR WORK, and that is the whole reason
// `utterances.kind` exists only on the standalone table (0053): a row under a book
// is a highlight and a row under a film is a line, and asking a reader to say so
// again would be the third place one fact is stored. So the phrase comes from the
// locator rather than from a kind — which is what a book card's "CH. 4 · P.112"
// has always been, one band earlier than this function is about.
//
// Returns '' for both today. It exists so the card can call ONE function for band
// 3 whatever it is drawing, rather than branching on which table a row came from —
// the shape the owner asked for is "adhered for all annotation cards across the
// app", and a card that asked a different question per kind would be the drift
// that promise is against.
export function attributionOf(row, kindOfRow, opts) {
  return kindOfRow === 'quote' ? attribution(row, opts) : ''
}

// ---- band 2: where in the work ---------------------------------------------
//
// WHERE IN THE BOOK, AND ONE ANSWER RATHER THAN TWO.
//
// THE OWNER: "the book annotations in the book details view do not need to show
// page number if chapter details are available. think through all cases like
// that." The chapter wins, and the reason is better than tidiness: a chapter is
// the locator that SURVIVES AN EDITION and a page is the one that does not, so
// "CH. 4 · P.112" tells a reader holding a different printing one durable fact
// and one that is wrong for them.
//
// AND THE RULE IS NOT SCOPED TO THAT SCREEN, though it is where they saw it. The
// redundancy is between two fields on ONE CARD, not between a card and the
// surface under it — a page dropped on the book page and kept on Home would be
// the identical row reading two ways, which is exactly what this repo's "two
// things that look the same behave the same" forbids. THE CASES THAT ARE NOT
// THIS ONE, since the ask was to think them through: an episode and a timestamp
// are not two answers to one question (which episode, then where inside it), and
// neither are an essay's title and its page — both pairs stay whole. The four
// screens that DID say the work twice were saying it against their surface, and
// none of them do: no card prints its board's name, its work's title on that
// work's own page, or a year that belongs to the work.
//
// FOUR CALL SITES WROTE THIS LINE FOUR TIMES AND NO TWO AGREED. Library drew
// `CH. {chapterLabel}` — the prefix on a NAME as well as a number, which is the
// exact thing `chapterMeta` was written to stop and its comment already claimed
// to have stopped ("Library's own meta line… stops disagreeing with Home and the
// quiz"); it never did. Library then printed `P.{n}` while Home and the recall
// card printed `P. {n}`, from two locale keys differing by one space. And
// `chapterMeta` spelled "CH." as a LITERAL in a module that imports nothing, so
// a Bengali reader got "CH. ৪" on Home and "অধ্যা. ৪" on the book page for one
// row. One function, and all three go with the duplication.
//
// IT LIVES HERE AND NOT IN text.js, which takes strings and returns values and
// has no imports at all, deliberately. A caption is vocabulary, so it belongs
// beside the other vocabulary this module already owns — i18n and nothing else,
// the same reason `attribution` gives for itself.
export function locatorMeta(a) {
  const name = chapterLabel(a)
  // THE PREFIX GOES ON A NUMBER ONLY, which is `chapterMeta`'s rule kept: "CH. 7"
  // reads as a chapter, "CH. Envoi" reads as somebody who did not know what was
  // in the field.
  if (name) {
    return Number(a?.chapter_no)
      ? t('common.locator.chapter.label', { name })
      : name
  }
  const at = s(a?.location)
  return at ? t('common.locator.page.label', { n: at }) : ''
}
