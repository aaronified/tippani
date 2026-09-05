// THE PACK'S LOCAL SHEETS — one character, seen from inside one work.
//
// `Character_Popup.dc.html` draws four of these beside `char-global`: char-book,
// char-film, char-game, and a person's own global sheet. They are not four
// designs. Every difference between them is an answer identityScope.js already
// gives — the locator noun under the second count, whether there is a performer
// to pair with the part, whether a dub can be credited — so this file is one
// component that reads those answers, and a new medium stays a row in that table
// rather than a screen in this directory.
//
// WHY A LOCAL SHEET IS THIN, and this is the part the older presentation had
// backwards. It held three stacked scopes: this work, the library, the record —
// so a reader standing on one book was offered the alias list, the merge control
// and the whole appearance strip, none of which is a fact about the book they are
// in. The pack puts all of that on the GLOBAL sheet and leaves one door here:
// "Open the global record". Nothing is lost by the move, because the door goes
// to the screen that owns them.
//
// WHAT BELONGS HERE IS WHAT IS TRUE OF THIS WORK ONLY: what the work calls them,
// the part they play in it, where they first appear, how old they are in it, the
// reader's private note on this casting, the counts, and the two ways out —
// through the global record, or out of this work altogether.
import { coverImgURL } from './api.js'
import {
  CreditRow,
  FactsRow,
  PairRow,
  PortraitBlock,
  ScreenBody,
  ScreenHead,
  ScreenRow,
  SectionHead,
  SegHead,
} from './characterRows.jsx'
import { t } from './i18n.js'
import { NavIcon } from './ui.jsx'
import { leadingRole } from './identityScope.js'

// THE APP'S OWN ART, NOT AN EMOJI. The first version of this line invented four
// — 📖 ▶ 📺 🎮 — which is the mistake `characterRows.jsx` already argues against
// for the strip: a hand-picked lookalike beside the app's real glyph is two
// pictures of one thing, and the glossary documents only one of them. NavIcon is
// the app's, so the sheet's head and the tab strip cannot disagree.
//
// ONE NAME PER MEDIUM, and a show and a game have their own. Collapsing both
// onto the Catalogue's glyph was the first attempt and it was wrong for the
// reason that shelf exists: the Catalogue holds films, shows and games together,
// so its picture is the SHELF's, and a sheet opened on a show has to say which of
// the three it is standing in.
//
// THEY ARE THE APP'S EXISTING GLYPHS, and this comment used to claim two new ones
// were drawn for them. IconNavShow and IconNavGame do not exist: the first attempt
// added them from the icon source, the suite failed them as exact duplicates of
// IconWatching and IconPlaying, and reusing those two is also the better reading —
// a show is what you watch and a game is what you play. NavIcon maps 'show' and
// 'game' onto them.
const GLYPH_NAME = { book: 'library', film: 'movies', show: 'show', game: 'game' }

// The three facts under the name, and the reason FactsRow takes a list rather
// than three props: a game has TWO of them. Nobody has an age in a game whose
// character is the reader — "age here" is a fact about a performance, and a
// playable character has no single one — so the pack draws that row with two
// cells and no gap where a third would be. An empty cell would read as a field
// waiting to be filled.
function factCells(scope, here, onPart, onFirst, onAge) {
  const cells = [
    { label: t('identity.facts.part'), value: here.part || t('identity.facts.none'), onClick: onPart },
    { label: t('identity.facts.first'), value: here.first_appears || t('identity.facts.none'), onClick: onFirst },
  ]
  if (scope.medium !== 'game') {
    cells.push({ label: t('identity.facts.age'), value: here.age_here || t('identity.facts.none'), onClick: onAge })
  }
  return cells
}

// THE PERFORMERS AND THE DUBS ARE THE SAME LIST, split by one field.
//
// A character billed twice in one work is TWO CAST ROWS — 0063 re-cut
// idx_work_cast_pair to allow it, and the pack draws exactly that: Daniel
// Radcliffe at 17, and a second row for the Godric's Hollow flashback with
// nobody named yet. So the rows for a work are the credits for it, and no new
// shape is needed to list them.
//
// credit_lang IS THE SPLIT. A credit carrying a language is a dub and belongs
// under the pack's "Dubbed by"; one with none is the original cast. That is why
// there is no `is_dub` column and no second table: the language was always the
// fact, and a dub with no language recorded is not a dub anybody can name.
function creditsFor(works, here) {
  const rows = (works || []).filter((a) => a.kind === here.kind && a.work_id === here.work_id)
  return {
    cast: rows.filter((a) => !String(a.credit_lang || '').trim()),
    dubs: rows.filter((a) => String(a.credit_lang || '').trim()),
  }
}

// A CREDIT WITH NOBODY IN IT IS A REAL STATE, drawn faint rather than hidden —
// the pack's "Not named yet". A film credits a de-aged shot, a stunt double or a
// second voice that the reader has not put a name to, and hiding the row would
// lose the note beside it, which is the only record that the casting exists.
function creditRows(rows, { onPick, onOpen, onNote, onRemove, noteTip, removeTip, pickTip, openTip, unnamedTip }) {
  return rows.map((a) => (
    <CreditRow
      key={a.cast_id}
      name={a.actor || t('identity.credit.unnamed')}
      empty={!a.actor}
      // BOTH, JOINED — the pack's own line is `[o.lang, o.note].filter(Boolean)
      // .join(' · ')`, and it shows the language FIRST because "Hindi" is the
      // thing that tells two dubs apart and the note is the gloss on it. Written
      // as `note || lang` this printed whichever it found first, so a dub with a
      // note on it silently stopped saying which language it was in — on the one
      // row where the language is the whole point.
      note={[a.credit_lang, a.credit_note].filter(Boolean).join(' · ')}
      face={a.actor_image || ''}
      // THE FACE REASSIGNS AND THE NAME OPENS, which is the pack's split
      // (`mode:'person'` at line 522 against `onOpen` at 529) and was collapsed
      // here into one handler. `en.txt` promises "Change who this is" on the
      // face; it went to the performer's record instead, so the app shipped a
      // tooltip that lied about what its control does. `CreditRow`'s own header
      // documents the split its only caller was flattening.
      onPick={() => onPick(a)}
      // A CREDIT WITH NOBODY IN IT HAS NOWHERE TO OPEN, and says so rather than
      // going quiet: without a record there is no page, and a press that does
      // nothing without explaining is the defect class `make controls` exists to
      // find. The pack's own words for the state are "Nobody named on this
      // credit yet". Reassigning is still live — that is how it stops being
      // nobody.
      onOpen={a.actor_id ? () => onOpen(a) : null}
      openTitle={a.actor_id ? openTip : unnamedTip}
      pickTitle={pickTip}
      noteTitle={noteTip}
      removeTitle={removeTip}
      onNote={() => onNote(a)}
      onRemove={() => onRemove(a)}
    />
  ))
}

// CharacterLocal — the sheet itself.
//
// EVERY HANDLER IS THE CALLER'S, as on the global sheets: this screen fetches
// nothing and saves nothing, which is what lets it be rendered from a fixture in
// a test. `here` is the work_cast row (store.CastOf), and it is the row rather
// than the record on purpose — the part, the locator, the age and the note are
// all facts about THIS casting, and 0063 gave each of them a column there.
export function CharacterLocal({
  record, work, here, scope, portraitActions,
  // WHOSE PICTURE IS ON SCREEN, and it is the caller's answer rather than
  // `here.image` because `here.image` is only the first of three rungs. This sheet
  // used to read that column directly, so a character whose IDENTITY carries a
  // portrait — the commonest case after a merge, since only one appearance keeps
  // the still — drew a silhouette here and the picture one door away on the global
  // card. store.CastOf refuses to substitute the fallback server-side precisely so
  // that a screen can tell the two apart and SAY which it drew; this sheet took
  // the un-substituted value and then said nothing.
  portrait = '', portraitFrom = '',
  onCalled, onPart, onFirst, onAge, onNote,
  onQuotes, onLocator, onOpenGlobal, onRemove,
  // The performer block's verbs. Absent on a book, where the whole block is —
  // nobody plays a novel's character, so an empty "Played by" would claim the
  // reader had not filled something in where the truth is that there is nothing
  // to fill.
  onRole, onCreditPick, onOpenCredit, onCreditNote, onCreditRemove, onAddCredit, onAddDub,
  // THE COUNTS COME FROM /whos-in-it, which has served them per cast row since
  // it was written and which nothing had ever called. Its `locators` is a
  // DISTINCT over this character's own quotes rather than a stored total of the
  // work's chapters — nothing records that and no provider reports it — and its
  // locator_noun is the server's answer to what those places are called. The
  // noun printed here is the locale's, keyed on the same medium, so the two
  // agree by construction rather than by one trusting the other's English.
  counts = null,
  works = [],
}) {
  // The sub-line under the name: what else this work calls them. Stored as the
  // reader typed it, so it is split on the same separator the pack prints.
  // THE ROLE COMES FROM THE SERVED ROW, not from the caller's object.
  //
  // `work` here is built by hand at each call site — Home's favourite tile, the
  // film frame, the work page — and not one of them puts a `cast_role` in it. So
  // `leadingRole(scope, work)` could only ever fall through to the medium, and
  // the Played by / Voiced by control was unmovable: pressing "Voiced by" wrote
  // the column, the sheet reloaded, and the segment sprang back to "Played by".
  // A write that works and a screen that denies it.
  //
  // `works` is the server's own list of this character's appearances (CastOf),
  // which now carries cast_role. Falling back to `work` keeps every caller that
  // renders this sheet from a fixture — the tests do — working unchanged.
  const servedWork = works.find((w) => w.work_id === work?.id && w.kind === work?.kind)
  const role = leadingRole(scope, servedWork || work)
  const { cast, dubs } = creditsFor(works, here)
  // NO GLYPHS IN THIS OBJECT ANY MORE. It carried `'✎'`, `'✕'` and `'▾'` — three
  // literal characters where the standing rule is "A screen's glyphs are the
  // app's own, never an emoji… it changes with the reader's font, sits off the
  // baseline every other glyph shares, and is the one picture
  // docs/ui-glossary.html cannot document". `CreditRow` draws IconEdit,
  // IconClose and IconChevron itself now, so there is no prop to pass the wrong
  // thing through.
  const creditVerbs = {
    onPick: (a) => onCreditPick?.(a),
    onOpen: (a) => onOpenCredit?.(a),
    onNote: (a) => onCreditNote?.(a),
    onRemove: (a) => onCreditRemove?.(a),
    pickTip: t('identity.credit.pick.tip'),
    openTip: t('identity.credit.open.tip'),
    unnamedTip: t('identity.credit.unnamed.tip'),
    noteTip: t('identity.credit.note.tip'),
    removeTip: t('identity.credit.remove.tip'),
  }
  // DISTINCT WORKS, NOT ROWS, and the render is what caught it. `works` is the
  // appearance list — one entry per CAST ROW — so a character with two
  // performers and two dubs on one film counted as "4 works" on a door whose
  // whole job is to say how far the identity reaches. The pack says "3 works"
  // for one book, one film and one game, which is the fact a reader wants.
  const workCount = new Set((works || []).map((a) => `${a.kind}:${a.work_id}`)).size
  const quotes = counts ? counts.quotes : 0
  const locators = counts ? counts.locators : 0
  const alsoHere = String(here.aliases || '')
    .split(/[·,;]/)
    .map((a) => a.trim())
    .filter(Boolean)
  return (
    <ScreenBody>
      <ScreenHead
        title={record.name}
        crumb={t('identity.crumb.in', { title: work.title || here.work_title || '' })}
        glyph={<NavIcon name={GLYPH_NAME[scope.medium] || 'movies'} />}
        art={here.cover || work.cover_path || work.poster_path || ''}
        artKind={scope.medium === 'book' ? 'book' : ''}
        scopeTitle={t('identity.scope.work.title')}
      />
      <PortraitBlock
        src={portrait || (here.image ? coverImgURL(here.image) : '')}
        name={record.name}
        px={t('identity.portrait.local')}
        // A FALLBACK THAT DOES NOT SAY SO IS THE SCREEN CLAIMING THIS WORK HOLDS
        // A PICTURE IT DOES NOT — and the reader who then presses "Set for the
        // identity" is promoting a picture that is already the identity's.
        from={portraitFrom === 'identity'
          ? t('identity.portrait.from.identity')
          : portraitFrom === 'actor'
            ? t('identity.portrait.from.actor', { name: here.actor || '' })
            : ''}
        actions={portraitActions}
      />

      {/* WHAT THE WORK CALLS THEM. "Called here" on a book and a game, "Credited
          as" on a film or a show, and the difference is not decoration: a novel
          NAMES a character in its text, a film CREDITS a performance, and the
          reader editing this is editing two different kinds of fact. */}
      <ScreenRow
        label={t(scope.medium === 'book' || scope.medium === 'game'
          ? 'identity.row.called.label'
          : 'identity.row.credited.label')}
        sub={alsoHere.length ? alsoHere.join(' · ') : t('identity.row.called.sub')}
        meta={here.character || record.name}
        onClick={onCalled}
      />

      {/* THE PERFORMER BLOCK, and the heading is a CONTROL because there are
          exactly two answers. A film's cast is played and a game's is voiced —
          usually — but an animated feature is a film whose cast is voiced and a
          medium cannot know that, which is why movies.cast_role exists and why
          this segmented pair sets it. leadingRole reads the override first and
          falls back to the medium, exactly as the server's actorRoleOr does. */}
      {scope.performer !== 'none' && (
        <>
          <SegHead
            label={t(`identity.section.${role}by`)}
            options={[
              ['actor', t('identity.seg.played')],
              ['voice', t('identity.seg.voiced')],
            ]}
            value={role}
            onPick={onRole}
          />
          {creditRows(cast, creditVerbs)}
          <ScreenRow
            label={t(role === 'voice' ? 'identity.credit.add.voice' : 'identity.credit.add.performer')}
            icon="+"
            onClick={onAddCredit}
          />
        </>
      )}

      {/* AND THE DUBS, ON A FILM OR A SHOW ONLY. A game's localisation IS its
          voice cast rather than a layer over it, so its languages stay on the
          voice credits themselves — identityScope says so with `dubs`, and this
          reads that answer rather than asking the medium again. */}
      {scope.dubs && (
        <>
          <SectionHead label={t('identity.section.dubbedby')} />
          {creditRows(dubs, creditVerbs)}
          <ScreenRow label={t('identity.credit.add.dub')} icon="+" onClick={onAddDub} />
        </>
      )}

      <FactsRow cells={factCells(scope, here, onPart, onFirst, onAge)} />

      {/* THE NOTE IS PRIVATE AND PER-WORK, and its sub-line says so because the
          reader cannot otherwise tell it from the record's own description —
          which every work shares. */}
      <ScreenRow
        label={t('identity.row.note.label')}
        sub={t('identity.row.note.sub')}
        meta={here.credit_note || t('identity.row.note.none')}
        icon="✎"
        onClick={onNote}
      />

      {/* THE COUNTS ARE DOORS INTO SEARCH, on the owner's instruction: pressing
          one lands on the search screen with this character and this work already
          up as chips, which is the question the number is a summary of. The
          second noun is the scope's — a book counts chapters, a game quests,
          anything with a running time scenes — and the server's locatorNoun
          agrees, so a number never appears under the wrong word. */}
      <PairRow
        cells={[
          {
            // The caption pluralises, so it takes the figure it sits under —
            // "1 quotes" is the kind of thing a count says when the number and
            // the noun were resolved apart.
            label: t('identity.count.quotes', { n: quotes, count: quotes }),
            figure: quotes,
            icon: '❞',
            onClick: onQuotes,
            title: t('identity.count.quotes.tip'),
          },
          {
            label: t(`identity.count.${scope.locator}`, { n: locators, count: locators }),
            figure: locators,
            icon: '❑',
            onClick: onLocator,
            title: t('identity.count.locator.tip'),
          },
        ]}
      />

      {/* THE WAY UP. One row, and it carries the record's own face so the reader
          can see it is the same character before pressing. The count beside it is
          the works the identity spans, which is the fact that makes the door
          worth opening. */}
      <SectionHead label={t('identity.section.identity.label')} note={t('identity.section.identity.note')} />
      <ScreenRow
        label={t('identity.row.global.label')}
        sub={t('identity.row.global.sub')}
        face={record.image_path ? coverImgURL(record.image_path) : ''}
        faceName={record.name}
        badge={t('identity.badge.global')}
        meta={t('identity.row.global.works', { n: workCount, count: workCount })}
        onClick={onOpenGlobal}
      />

      {/* AND THE WAY OUT, which is not a delete. Unlinking one work leaves the
          identity and every other work alone, and the sub-line says which,
          because "Remove" beside a character's face reads as losing the
          character. A film's wording carries one clause more than a book's: a
          book has nobody playing anybody, so there are no people whose records
          could be affected and no reassurance to give about them. */}
      <SectionHead label={t('identity.section.remove.label')} />
      <ScreenRow
        label={t(`identity.row.unlink.label.${scope.medium}`)}
        sub={t(scope.medium === 'book'
          ? 'identity.row.unlink.sub.book'
          : 'identity.row.unlink.sub.cast')}
        danger
        onClick={onRemove}
      />
    </ScreenBody>
  )
}
