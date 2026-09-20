// Typing a word in Settings finds the card that answers to it.
//
// THIS FILE KNOWS A MODULE PATH, which is what test/pure is for: `settingsMatches`
// IS the observable unit — a card id and a typed word in, a yes or no out — and its
// own comment says so ("exported and pure, because it is the one part of this that
// is a function rather than a screen").
//
// WHY IT EXISTS AS WELL AS THE SCANNER. `test/rules/settings-search-prefix.test.js`
// reads source text and asserts that every registered card declares a prefix. That
// is a claim about the TABLE. It cannot tell whether the prefix declared actually
// resolves to any words, and when Server became one tile holding three subjects the
// table grew a shape — a list of roots rather than one — whose failure modes the
// scanner cannot see. A card can be perfectly prefixed and still unfindable.
//
// THE DISAPPEARANCE THIS GUARDS IS SILENT. A card whose prefix matches nothing does
// not grey out and does not say "no results": it is simply gone the moment a reader
// types one character, while the rest of the page stays. The reader's conclusion is
// that the app lost their backup card.

import { describe, expect, it } from 'vitest'

import { settingsMatches, SETTINGS_CARDS } from '../../src/Settings.jsx'

describe('searching Settings finds the card', () => {
  // An empty box hides nothing — the page is whole until a word narrows it.
  it('keeps every card when nothing has been typed', () => {
    for (const card of SETTINGS_CARDS) {
      expect(settingsMatches(card, ''), `${card} vanished on an empty query`).toBe(true)
      expect(settingsMatches(card, '   '), `${card} vanished on a blank query`).toBe(true)
    }
  })

  // SERVER IS ONE TILE OVER THREE SUBJECTS, and each of its roots has to answer.
  // Dropping any one of the three from its prefix list leaves the other two
  // working, so a single word would not have caught it.
  it('finds the Server tile by each of the three things on it', () => {
    expect(settingsMatches('server', 'update'), 'Updates is on Server and did not answer').toBe(true)
    expect(settingsMatches('server', 'backup'), 'Backup is on Server and did not answer').toBe(true)
    expect(settingsMatches('server', 'changed'), 'What changed is on Server and did not answer').toBe(true)
  })

  it('finds the other cards by a word of their own', () => {
    expect(settingsMatches('sr', 'deck')).toBe(true)
    expect(settingsMatches('features', 'covers')).toBe(true)
  })

  // AND IT STILL SAYS NO. A matcher that answered true to everything would pass
  // every case above and narrow nothing on the screen.
  it('does not find a card by a word that is not on it', () => {
    expect(settingsMatches('server', 'zzzznotaword')).toBe(false)
    expect(settingsMatches('features', 'zzzznotaword')).toBe(false)
  })

  // A card id with no entry in the table matches nothing, which is the behaviour
  // the scanner exists to keep nobody from relying on.
  it('answers no for a card it has never heard of', () => {
    expect(settingsMatches('nosuchcard', 'backup')).toBe(false)
  })
})
