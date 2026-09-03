// THE FIVE SCREENS ARE FIVE SCOPES, and this is the table that says which.
//
// WHAT THIS GUARDS. `identityScope` is the spine of the character and people
// panels: the header's art, the noun over the second count, whether a performer
// can be paired with the part and whether a dub can be credited are all read off
// it. A wrong answer here is not a wrong pixel — it is "Played by" printed over
// the voice cast of every animation in the library, or a book asked which of its
// scenes a line is in.
//
// AND WHY THE LOCATOR IS DERIVED FROM THE GO SOURCE rather than asserted as three
// strings. `locatorNoun` in internal/httpapi/whos_in_it.go answers the same
// question for the count the server computes. If the two disagree the screen puts
// the server's number under the client's word, which is a lie no test of either
// side alone can see — so this reads the Go and compares.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { identityScope, leadingRole, mediumOf } from '../../src/identityScope.js'

const GO = readFileSync(
  join(process.env.TIPPANI_SRC, '../../../internal/httpapi/whos_in_it.go'),
  'utf8',
)

describe('the six scopes', () => {
  it('are the pack’s five, plus the one it does not draw', () => {
    expect(identityScope({ table: 'character' }).id).toBe('char-global')
    expect(identityScope({ table: 'person' }).id).toBe('people-global')
    expect(identityScope({ table: 'character', work: { kind: 'book' } }).id).toBe('char-book')
    expect(identityScope({ table: 'character', work: { kind: 'movie' } }).id).toBe('char-film')
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } }).id)
      .toBe('char-game')
    // THE DEPARTURE, NAMED. The pack has no person-on-a-work screen; the panel has
    // offered one since it landed, because that is where a credit's own spelling
    // is edited. It is a scope rather than an exception so the renderer has one
    // switch and not a switch plus a special case.
    expect(identityScope({ table: 'person', work: { kind: 'book' } }).id).toBe('people-work')
  })

  it('reads a show as film-like rather than as a fourth medium', () => {
    // An episode is WHERE a line is; a scene is the unit the count is over. The
    // server draws the same line, which the next case proves.
    expect(mediumOf({ kind: 'movie', media_type: 'show' })).toBe('show')
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'show' } }).id)
      .toBe('char-film')
  })

  it('takes media_type in either spelling, because both reach it', () => {
    // The API sends snake_case and a couple of client call sites pass a work they
    // built themselves in camelCase. Accepting one and silently reading the other
    // as a film is the kind of miss that only shows up on games.
    expect(mediumOf({ kind: 'movie', mediaType: 'game' })).toBe('game')
    expect(mediumOf({ kind: 'movie', media_type: 'GAME' })).toBe('game')
  })
})

describe('the locator noun', () => {
  it('is the same word the server counts under', () => {
    // Parsed rather than copied: the three branches of locatorNoun, in order.
    const fn = GO.slice(GO.indexOf('func locatorNoun'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    const nouns = [...body.matchAll(/return "([a-z]+)",/g)].map((m) => m[1])
    expect(nouns, 'locatorNoun no longer returns three nouns').toEqual(['chapter', 'quest', 'scene'])
    const [book, game, rest] = nouns
    expect(identityScope({ table: 'character', work: { kind: 'book' } }).locator).toBe(book)
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } }).locator)
      .toBe(game)
    expect(identityScope({ table: 'character', work: { kind: 'movie' } }).locator).toBe(rest)
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'show' } }).locator)
      .toBe(rest)
  })

  it('is empty on a global scope, which counts nothing', () => {
    // "37 quotes in 3 works" is a number nobody asked for: the works are listed
    // right there, each with its own count.
    expect(identityScope({ table: 'character' }).locator).toBe('')
    expect(identityScope({ table: 'person' }).locator).toBe('')
  })
})

describe('the performer pairing', () => {
  // NOBODY PLAYS A NOVEL'S CHARACTER — work_cast.actor_id is null on every book by
  // design — so the block is absent rather than present and empty. An empty
  // "Played by" tells the reader they have not filled something in.
  it('is absent on a book, on both counts', () => {
    const s = identityScope({ table: 'character', work: { kind: 'book' } })
    expect(s.performer).toBe('none')
    expect(s.dubs).toBe(false)
  })

  it('is offered on a film and a game alike', () => {
    expect(identityScope({ table: 'character', work: { kind: 'movie' } }).performer).toBe('both')
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } }).performer)
      .toBe('both')
  })

  // A GAME'S LOCALISATION IS ITS VOICE CAST, so its languages ride the voice
  // credits and there is no second section under them — which is exactly how the
  // pack draws it, and the one difference between char-film and char-game beyond
  // the locator noun.
  it('gives a dub section to a film and not to a game', () => {
    expect(identityScope({ table: 'character', work: { kind: 'movie' } }).dubs).toBe(true)
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'show' } }).dubs).toBe(true)
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } }).dubs).toBe(false)
  })
})

describe('which of Played by / Voiced by leads', () => {
  const film = identityScope({ table: 'character', work: { kind: 'movie' } })
  const game = identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } })

  it('follows the medium when the work has not said', () => {
    expect(leadingRole(film, {})).toBe('actor')
    expect(leadingRole(game, {})).toBe('voice')
  })

  // THE OVERRIDE IS THE WHOLE REASON 0063 ADDED movies.cast_role. An animated
  // feature is a film whose cast is voiced, and no medium can know that — a client
  // deriving this from the medium alone prints "Played by" over every animation.
  it('obeys the work when it has', () => {
    expect(leadingRole(film, { cast_role: 'voice' })).toBe('voice')
    expect(leadingRole(game, { cast_role: 'actor' })).toBe('actor')
    expect(leadingRole(film, { castRole: 'voice' })).toBe('voice')
  })

  it('ignores a value that is neither, rather than trusting it', () => {
    // The API validates this column ("a cast is performed or voiced — nothing
    // else"), but a stale row or a hand-edited database is not the API.
    expect(leadingRole(game, { cast_role: 'narrated' })).toBe('voice')
  })
})
