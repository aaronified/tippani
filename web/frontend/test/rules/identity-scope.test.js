// THE FIVE SCREENS ARE FIVE SCOPES, and this is the table that says which.
//
// WHAT THIS GUARDS. `identityScope` is the spine of the character and people
// panels: the header's art, whether a performer can be paired with the part and
// whether a dub can be credited are all read off it. A wrong answer here is not a
// wrong pixel — it is "Played by" printed over the voice cast of every animation
// in the library.
//
// AND THE COUNT CONTRACT IS READ OUT OF BOTH SOURCES rather than asserted as two
// strings. The sheet's pair of numbers comes off /whos-in-it, and the client picks
// them out of the row by name — so a field renamed on one side and not the other
// leaves both sides compiling, both suites green, and every sheet printing zero.
// That is exactly what happened when the second count stopped being a locator
// tally, so the case below reads the Go struct's tags and the client's own reads
// and compares them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { identityScope, leadingRole, mediumOf } from '../../src/identityScope.js'

const GO = readFileSync(
  join(process.env.TIPPANI_SRC, '../../../internal/httpapi/whos_in_it.go'),
  'utf8',
)
const PANEL = readFileSync(join(process.env.TIPPANI_SRC, 'identity.jsx'), 'utf8')

describe('the five scopes', () => {
  it('are the pack’s own five, and no sixth', () => {
    expect(identityScope({ table: 'character' }).id).toBe('char-global')
    expect(identityScope({ table: 'person' }).id).toBe('people-global')
    expect(identityScope({ table: 'character', work: { kind: 'book' } }).id).toBe('char-book')
    expect(identityScope({ table: 'character', work: { kind: 'movie' } }).id).toBe('char-film')
    expect(identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } }).id)
      .toBe('char-game')
    // A PERSON IS ALWAYS GLOBAL — the owner's ruling, and the reason there is no
    // sixth. A `work` handed in with a person is IGNORED rather than honoured:
    // a person is one record however many works credit them, and the place to
    // change what one work prints is that work's own cast list. This file used to
    // return `people-work` here and argue for it as a departure; the sheet it
    // produced was a screen the pack never drew.
    for (const work of [{ kind: 'book' }, { kind: 'movie' }, { kind: 'movie', media_type: 'game' }]) {
      const sc = identityScope({ table: 'person', work })
      expect(sc.id, 'a person on a work is still the person').toBe('people-global')
      expect(sc.local, 'a person scope claimed to be local to a work').toBe(false)
      expect(sc.medium, 'a person scope kept the work’s medium').toBe('')
    }
  })

  it('separate char-film from char-game by exactly the facts the table says', () => {
    // THE HEADER OF identityScope.js MAKES A COUNT, and it was wrong from the day
    // it was written: it said "exactly two facts (the second count's noun, and
    // which of Played by / Voiced by leads)" and left the DUB out, so it named two
    // of three. The noun has since gone, which would have made the stale sentence
    // accidentally right about the number and still wrong about the members.
    //
    // So the count is measured. `id` and `medium` are the scope's own identity
    // rather than facts about the screen, so they are not differences a reader of
    // two files would have to guess at.
    const film = identityScope({ table: 'character', work: { kind: 'movie' } })
    const game = identityScope({ table: 'character', work: { kind: 'movie', media_type: 'game' } })
    const differs = Object.keys(film)
      .filter((k) => k !== 'id' && k !== 'medium')
      .filter((k) => film[k] !== game[k])
    expect(differs, `the two scopes differ on ${differs} — the header names dubs alone`)
      .toEqual(['dubs'])
    // AND THE SECOND FACT IS NOT IN THE TABLE AT ALL, which is why counting the
    // object's own keys is not the whole answer: the leading role is a function of
    // the scope and the work, because an animated feature is a film whose cast is
    // voiced and no medium can know that.
    expect(leadingRole(film)).not.toBe(leadingRole(game))
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

describe('the two counts on the wire', () => {
  it('are read by the name the server actually sends', () => {
    // BOTH SIDES, PARSED. The Go struct's json tags are the wire; the reads inside
    // the panel's /whos-in-it effect are what the client asks for. A name in the
    // second list that is missing from the first is a count that renders as zero
    // on every sheet and fails nothing else.
    const struct = GO.slice(GO.indexOf('type whosCharacter struct'))
    const tags = new Set(
      [...struct.slice(0, struct.indexOf('\n}')).matchAll(/json:"([a-z_]+)/g)].map((m) => m[1]),
    )
    expect(tags.has('quotes'), 'the server stopped sending a quote count').toBe(true)

    // The LAST mention and not the first: three comments above the effect name the
    // endpoint before the fetch does, and anchoring on the first of them slices a
    // window with no reads in it — which is a guard that passes on a panel reading
    // nothing at all.
    const effect = PANEL.slice(PANEL.lastIndexOf('whos-in-it'))
    const reads = [...effect.slice(0, effect.indexOf('}, [')).matchAll(/\brow\.([a-z_]+)/g)]
      .map((m) => m[1])
    expect(reads.length, 'the panel no longer reads the row it fetched').toBeGreaterThan(1)
    for (const name of new Set(reads)) {
      expect(tags.has(name), `the panel reads row.${name}, which /whos-in-it does not send`)
        .toBe(true)
    }
  })

  it('and neither of them is a per-medium noun any more', () => {
    // The second figure used to be a locator tally whose LABEL changed with the
    // medium — chapters for a book, quests for a game — so the scope table carried
    // the word. It counts favourites now, which is the same word everywhere, and a
    // scope that still handed one out would be a label nothing prints.
    for (const work of [null, { kind: 'book' }, { kind: 'movie' }, { kind: 'movie', media_type: 'game' }]) {
      const sc = identityScope({ table: 'character', work })
      expect(sc.locator, `${sc.id} still carries a locator noun`).toBeUndefined()
    }
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
