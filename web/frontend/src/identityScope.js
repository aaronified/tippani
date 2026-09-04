// THE FIVE SCREENS ARE FIVE SCOPES OF ONE OBJECT, and this is the resolver that
// says which one you are looking at.
//
// THE PACK'S OWN SHAPE. `Character_Popup.dc.html` draws `char-global`,
// `char-book`, `char-film`, `char-game` and `people-global` — five screens in one
// file, built by nine shared helpers. They are not five designs: they are one
// record seen from five distances, and every difference between them falls out of
// two questions. Which table is this (a character or a person), and which work am
// I standing in (none, a book, a film, a game). Everything else — the header's
// art, the noun on the second count, whether there is a performer to pair with
// the part, whether a dub can be credited — is decided by the answer.
//
// WHY A TABLE AND NOT FIVE COMPONENTS. Five components drift: the pack already
// shows what that costs, since `char-film` and `char-game` differ by exactly two
// facts (the locator noun, and which of Played by / Voiced by leads) and a reader
// comparing them would not guess that from two separate files. One table makes a
// new medium a row rather than a screen.
//
// A PERSON IS ALWAYS GLOBAL — the owner's ruling, and it settles a scope this
// file used to invent. There were five ids here and a sixth called `people-work`,
// argued for as a departure on the grounds that a credit's own spelling is a fact
// about one work. The spelling is, and the SHEET is not: a person is one record
// however many works credit them, and the place to change what one work prints is
// that work's own cast list, which is the only screen holding the row. The
// person's sheet shows every credit as a tile that already says "as Harry".
//
// So there are FIVE scopes, and a work handed in with a person is ignored rather
// than honoured.

// THE LOCATOR NOUN IS THE SERVER'S, restated. `locatorNoun` in
// internal/httpapi/whos_in_it.go maps the same three ways — a book counts
// chapters, a game counts quests, everything with a running time counts scenes —
// and the two disagreeing would put a number under the wrong word. A show is
// film-like here on purpose: an episode is where a line IS, and a scene is the
// unit inside it that the count is over.
const LOCATOR = { book: 'chapter', game: 'quest', film: 'scene', show: 'scene' }

// mediumOf — a work's medium as this file names it, from the two fields the API
// actually sends. `kind` separates the shelves and `media_type` separates the
// movie shelf's three, which is the same split store.CastOf documents: a book
// leaves media_type empty because its kind already says everything about it.
export function mediumOf(work) {
  if (!work) return ''
  if (work.kind === 'book') return 'book'
  const t = String(work.media_type || work.mediaType || '').toLowerCase()
  if (t === 'game') return 'game'
  if (t === 'show' || t === 'tv' || t === 'series') return 'show'
  return 'film'
}

// identityScope — which of the six screens this is, and the vocabulary that
// screen uses. Pure: hand it what the panel was opened with and nothing else.
export function identityScope({ table, work = null } = {}) {
  const person = table === 'person'
  if (!work) {
    return {
      id: person ? 'people-global' : 'char-global',
      table: person ? 'person' : 'character',
      local: false,
      medium: '',
      // A GLOBAL SCOPE COUNTS NOTHING, because a count is a fact about one work.
      // "37 quotes in 3 works" is a number nobody asked for: the works are listed
      // right there, each with its own.
      locator: '',
      performer: 'none',
      dubs: false,
    }
  }
  const medium = mediumOf(work)
  if (person) {
    // A PERSON HANDED A WORK IS STILL THE PERSON. Returning a local scope here is
    // what produced a sheet the pack never drew; the work is dropped on purpose.
    return {
      id: 'people-global', table: 'person', local: false, medium: '',
      locator: '', performer: 'none', dubs: false,
    }
  }
  return {
    id: medium === 'book' ? 'char-book' : medium === 'game' ? 'char-game' : 'char-film',
    table: 'character',
    local: true,
    medium,
    locator: LOCATOR[medium] || 'scene',
    // NOBODY PLAYS A NOVEL'S CHARACTER. work_cast.actor_id is null on every book
    // by design (0048), so the whole performer block is absent there rather than
    // present and empty — an empty "Played by" claims the reader has not filled
    // something in, where the truth is that there is nothing to fill.
    performer: medium === 'book' ? 'none' : 'both',
    // A DUB IS A SECOND CAST IN ANOTHER LANGUAGE, which the pack gives its own
    // heading on `char-film` and not on `char-game`: a game's localisation IS its
    // voice cast, so its languages belong on the voice credits themselves rather
    // than in a section under them.
    dubs: medium === 'film' || medium === 'show',
  }
}

// leadingRole — which of Played by / Voiced by is the scope's default.
//
// THE OVERRIDE IS THE WHOLE POINT. `actorRoleOr` on the server derives the same
// answer from the medium and then lets `movies.cast_role` overrule it, because an
// animated feature is a film whose cast is voiced and a medium cannot know that.
// A client that derived this from the medium alone would print "Played by" over
// the voice cast of every animation in the library.
export function leadingRole(scope, work = null) {
  const override = String(work?.cast_role || work?.castRole || '').toLowerCase()
  if (override === 'actor' || override === 'voice') return override
  return scope.medium === 'game' ? 'voice' : 'actor'
}
