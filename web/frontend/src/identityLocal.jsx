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
  FactsRow,
  PairRow,
  PortraitBlock,
  ScreenBody,
  ScreenHead,
  ScreenRow,
  SectionHead,
} from './characterRows.jsx'
import { t } from './i18n.js'

// The glyph laid over the work's own cover, per medium. A local sheet always has
// a cover to sit on — that is what makes it local — so there is no globe here.
const GLYPH = { book: '📖', film: '▶', show: '📺', game: '🎮' }

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

// CharacterLocal — the sheet itself.
//
// EVERY HANDLER IS THE CALLER'S, as on the global sheets: this screen fetches
// nothing and saves nothing, which is what lets it be rendered from a fixture in
// a test. `here` is the work_cast row (store.CastOf), and it is the row rather
// than the record on purpose — the part, the locator, the age and the note are
// all facts about THIS casting, and 0063 gave each of them a column there.
export function CharacterLocal({
  record, work, here, scope, portraitActions,
  onCalled, onPart, onFirst, onAge, onNote,
  onQuotes, onLocator, onOpenGlobal, onRemove,
  // THE COUNTS COME FROM /whos-in-it, which has served them per cast row since
  // it was written and which nothing had ever called. Its `locators` is a
  // DISTINCT over this character's own quotes rather than a stored total of the
  // work's chapters — nothing records that and no provider reports it — and its
  // locator_noun is the server's answer to what those places are called. The
  // noun printed here is the locale's, keyed on the same medium, so the two
  // agree by construction rather than by one trusting the other's English.
  counts = null,
  works = [],
  children,
}) {
  // The sub-line under the name: what else this work calls them. Stored as the
  // reader typed it, so it is split on the same separator the pack prints.
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
        glyph={GLYPH[scope.medium] || GLYPH.film}
        art={here.cover || work.cover_path || work.poster_path || ''}
        artKind={scope.medium === 'book' ? 'book' : ''}
        scopeTitle={t('identity.scope.work.title')}
      />
      <PortraitBlock
        src={here.image ? coverImgURL(here.image) : ''}
        name={record.name}
        px={t('identity.portrait.local')}
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
        meta={t('identity.row.global.works', { n: works.length, count: works.length })}
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
      {children}
    </ScreenBody>
  )
}
