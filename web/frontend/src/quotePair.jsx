// THE PAIR OF NUMBERS EVERY SHEET PRINTS: how much of this you have kept, and how
// much of it you loved.
//
// THE OWNER'S SCOPE, verbatim: "the 3 quotes, 1 scene is not working. rather do 3
// quotes, 1 favourited. for all. people, character, details, all pages those two
// boxes are." Four surfaces — a work's details, a person, a character seen across
// the library, and a character inside one work — and the point of the instruction
// is that they are THE SAME PAIR, not four screens that each happen to show two
// numbers.
//
// SO IT IS ONE FUNCTION AND NOT FOUR LISTS OF CELLS. This lived inline on the
// local character sheet and only there; three screens had no pair at all, and
// "everywhere it exists" was read as a description of the code rather than as the
// four screens the instruction named. The repo's own directive is the argument
// against ever writing it out a second time: "a control drawn by one component on
// two screens has ONE behaviour, and it lives in one function that both screens
// call — not in a line each, which is how one of them goes on being right while
// the other quietly stops."
//
// WHAT DIFFERS PER SCREEN IS THE SCOPE, AND IT IS PASSED IN. The tooltip has to
// say what the number is over — this work, this character everywhere, everything
// this person has said — because a figure whose scope is ambiguous is a figure the
// reader cannot check. The CAPTION does not change: "quotes" and "favourited"
// mean the same thing on all four, which is what makes them comparable.
//
// AND THE SECOND DOOR IS NOT THE FIRST DOOR. The second count opens the same
// search NARROWED to favourites; while it was a locator tally both cells landed on
// one screen, which is a number you can press and learn nothing from.

import { t } from './i18n.js'
import { IconHeart, IconQuote } from './ui.jsx'

// quotePairCells — the two cells, ready for `PairRow`.
//
// `tips` is the pair of scope sentences, both keys. A screen with none falls back
// to the plain captions, which is honest rather than silent: a tooltip that names
// the wrong scope is worse than no tooltip.
export function quotePairCells({
  quotes = 0,
  favourites = 0,
  onQuotes = undefined,
  onFavourites = undefined,
  quotesTip = '',
  favouritesTip = '',
} = {}) {
  return [
    {
      // The caption pluralises, so it takes the figure it sits under — "1 quotes"
      // is the kind of thing a count says when the number and the noun were
      // resolved apart.
      label: t('identity.count.quotes', { n: quotes, count: quotes }),
      figure: quotes,
      icon: <IconQuote size={15} />,
      onClick: onQuotes,
      title: quotesTip ? t(quotesTip) : undefined,
    },
    {
      label: t('identity.count.favourites', { n: favourites, count: favourites }),
      figure: favourites,
      icon: <IconHeart size={15} />,
      onClick: onFavourites,
      title: favouritesTip ? t(favouritesTip) : undefined,
    },
  ]
}

// quotePairDoors — the two handlers the cells hang off, built from one chip set.
//
// ONE BUILDER AND A FLAG, which is the same shape the local sheet already used
// and the reason it used it: written as two functions they drift the first time
// the chip list gains a field, and then one door is right and the other is
// quietly not.
//
// AND IT TAKES THE PANEL OFF THE SCREEN ON THE WAY. The shell moves its tab
// UNDERNEATH a panel that is a fixed overlay, so a press that navigates and
// leaves the panel up is indistinguishable from a press that did nothing — a
// class of defect reported three times before it was understood.
//
// NO CHIPS MEANS NO DOOR, deliberately: a screen whose scope cannot be expressed
// as a facet gets `undefined` and `PairRow` draws the figures with `aria-disabled`.
// That is the honest degradation, and it is better than a door that lands on a
// search covering some of what the number counted. A person's lines are the worked
// example — they are linked through `dialogues.actor_id` OR `utterances.speaker_id`,
// two different facets, and chips across two fields AND together, so one press
// could only ever reach half of them.
export function quotePairDoors({ onSearch, stack, scope = 'all', chips = null } = {}) {
  const door = (extra = []) => (!onSearch || !chips || !chips.length ? undefined : () => {
    const go = () => onSearch(scope, [...chips, ...extra])
    if (stack?.leaveTo) stack.leaveTo(go)
    else go()
  })
  return {
    onQuotes: door(),
    // `yes` IS ONE OF THE FLAG'S OWN WORDS — parseFacetFlag takes 1/true/yes/y/on
    // — and the LABEL is the field's own yes/no vocabulary, so a seeded chip and
    // one a reader types by hand are the same chip. A label of "favourites" read
    // "favourite:favourites", because a chip renders as `field:label`.
    onFavourites: door([
      { field: 'favourite', value: 'yes', label: t('vocab.yesno.yes.label') },
    ]),
  }
}
