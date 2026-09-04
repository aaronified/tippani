// THE TWO GLOBAL SCREENS — `char-global` and `people-global`, in the pack's own
// order.
//
// WHY THIS IS A FILE AND NOT A BLOCK INSIDE identity.jsx. The pack draws five
// screens from one set of helpers; the panel bodies that preceded it hold the
// data and every mutation, and those are worth keeping exactly as they are. So
// the split is along the seam the pack already cuts: `CharacterBody` and
// `PersonBody` stay the record's brain — load, save, merge, promote, add and
// remove a work — and hand the finished handlers to a screen that only draws.
// A screen with no fetch in it can be rendered from a fixture, which is the whole
// reason its tests are cheap.
//
// WHAT MOVED, AND IT IS THE ORDER. The panel used to lead with a grid of
// appearances and end with the record's own fields; the pack leads with the
// identity — the name, how it files, when it was born — then its links, then the
// works, then the two acts that end it. That is the reading order of the thing
// itself: who this is, where else they are written up, where they turn up, and
// what you may do to the record. The grid became a strip for the same reason the
// pack made it one: eight films of one wizard are a shelf, and a shelf is read
// sideways.
//
// THE DEPARTURES, all of them, named here rather than found later:
//
//   THE LINES LIST HAS NO SECTION IN THE PACK and is kept. "Which quotes are
//   this character's" is the question `speaker_cast_id` exists to answer, and the
//   pack was drawn before that column was read by anything. It sits after the
//   works, because it is a fact about the identity across all of them.
//
//   THE DESCRIPTION FIELD is likewise absent from the pack and kept: it is the
//   fallback every work_cast row with no description of its own uses, so dropping
//   the only place it can be typed would strand the column.
//
//   ALIASES ARE THE NAME ROW'S SECOND LINE, which is the pack's shape and NOT
//   what the panel did — it had a section of its own with an add box and a split
//   control per spelling. The split verb has nowhere to live in a row of names,
//   so it stays in that section, now under the name row rather than beside merge.
import { useMemo } from 'react'

import { coverImgURL } from './api.js'
import {
  AppearanceStrip,
  NamesRow,
  PillRow,
  PortraitBlock,
  ScreenBody,
  ScreenHead,
  ScreenRow,
  SectionHead,
} from './characterRows.jsx'
import { t } from './i18n.js'
import { PROVIDERS, parseLinks } from './people.jsx'

// THE GLOBE IS THE ART A GLOBAL SCOPE HAS, and its absence is the information:
// every local scope wears the work's own cover in that slot, so a screen with no
// cover is a screen that belongs to no one work.
const GLOBE = '🌐'

// mediumCrumb — "1 book · 1 film · 1 game", which is the pack's own crumb and a
// better answer than "3 works": a character in three books and a character in a
// book, a film and a game are different facts about the same number.
function mediumCrumb(works) {
  const n = { book: 0, film: 0, show: 0, game: 0 }
  for (const w of works || []) {
    if (w.kind === 'book') n.book++
    else {
      const mt = String(w.media_type || '').toLowerCase()
      n[mt === 'game' ? 'game' : mt === 'show' ? 'show' : 'film']++
    }
  }
  return ['book', 'film', 'show', 'game']
    .filter((k) => n[k] > 0)
    .map((k) => t(`identity.crumb.${k}`, { n: n[k], count: n[k] }))
    .join(' · ')
}

// linkPills — the record's stored links as the pack's pills, each wearing its
// site's own mark. A link to a site the app knows keeps that mark; anything else
// keeps its hostname, which is the only honest name for it.
function linkPills(text) {
  const { known, extra } = parseLinks(text)
  const out = []
  for (const [slug, name] of PROVIDERS) {
    if (known[slug]) out.push({ url: known[slug], slug, name })
  }
  for (const url of extra) {
    let host = url
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      /* not a URL at all — show it as typed rather than dropping it */
    }
    out.push({ url, slug: '', name: host, fallbackIcon: GLOBE })
  }
  return out
}

const mediaBadge = (a) => {
  const mt = String(a.media_type || '').toLowerCase()
  return mt === 'game' ? 'game' : mt === 'show' ? 'show' : 'film'
}

// workTiles — one tile per appearance, in the order the API sent them, which is
// the release order. The badge is the medium; the face is this work's picture of
// the character, falling back to the record's.
function workTiles(works, recordImage, onOpen) {
  return (works || []).map((a) => ({
    key: String(a.cast_id),
    kind: a.kind,
    cover: a.cover || '',
    badge: t(`identity.crumb.badge.${a.kind === 'book' ? 'book' : mediaBadge(a)}`),
    title: a.work_title,
    // THIS WORK'S BILLING, which is the fact the tile adds to the title: a novel's
    // "the professor" and a film's "Woland" are one record and two tiles.
    meta: a.character || '',
    face: a.image || recordImage || '',
    faceName: a.character || '',
    // WHO PLAYED THEM, ON THE FACE'S OWN TITLE. The pack's strip tile does not
    // name the performer — that is the local screen's CreditRow, with its own
    // door — but the panel this replaces DID reach the performer from every
    // appearance, and a fact that used to be on screen should not vanish while
    // the screen that will carry it is unbuilt. The door moved (tile → that
    // work's screen → the credit); the fact stayed.
    faceTitle: a.actor ? t('identity.tile.face.played', { name: a.character || '', actor: a.actor }) : a.character || '',
    artTitle: a.work_title,
    onOpen: () => onOpen(a),
  }))
}

// creditTiles — a PERSON'S works, which arrive in a different shape from a
// character's and have to. A character is in a work through `work_cast`, so its
// row already names the character and carries this work's picture of them; a
// person is on one through `work_person`, which names a ROLE (author, director,
// performer) and has no picture of its own — the portrait on the tile is the
// person's, because there is only ever one of them.
function creditTiles(credits, portrait, onOpen) {
  return (credits || []).map((c) => ({
    key: `${c.kind}-${c.work_id}`,
    kind: c.kind,
    cover: c.cover || '',
    badge: t(`identity.crumb.badge.${c.kind === 'book' ? 'book' : mediaBadge(c)}`),
    title: c.title,
    // WHAT THEY DID ON IT, AND THE SPELLING IT PRINTS — both, because the tile's
    // title is the work and neither of these is in it. The pack's own tiles read
    // "as Harry (performer)" and "author of Jungle", so the billing keeps its
    // "as" rather than sitting bare under a title, where a name alone reads as
    // an author credit.
    meta: [
      t(`unit.role.${c.role}`, { count: 1 }),
      c.credit_as && t('identity.credit.as.on', { as: c.credit_as }),
    ].filter(Boolean).join(' · '),
    face: portrait,
    faceName: c.credit_as || '',
    faceTitle: c.credit_as || '',
    artTitle: c.title,
    onOpen: () => onOpen(c),
  }))
}

// ---- the character, out of any one work -------------------------------------

export function CharacterGlobal({
  record, works, portraitActions, onNames, onSort, onBorn, onLinkAdd,
  onOpenWork, onAddWork, onMerge, onRemoveAll, children,
}) {
  const tiles = useMemo(
    () => workTiles(works, record.image_path, onOpenWork),
    [works, record.image_path, onOpenWork],
  )
  const pills = useMemo(() => linkPills(record.links), [record.links])
  return (
    <ScreenBody>
      <ScreenHead
        title={record.name}
        crumb={mediumCrumb(works)}
        glyph={GLOBE}
        scopeTitle={t('identity.scope.library.character')}
      />
      <PortraitBlock
        src={record.image_path ? coverImgURL(record.image_path) : ''}
        name={record.name}
        // `soft` is NOT passed any more: PortraitBlock measures the file and
        // decides. Hardcoding it here made every portrait in the app claim to
        // be too small for a share card, whatever its size. `px` stays as the
        // line shown before a measurement exists.
        px={t('identity.portrait.global')}
        actions={portraitActions}
      />

      <SectionHead label={t('identity.section.identity.label')} note={t('identity.section.identity.note')} />
      <NamesRow
        label={t('identity.row.canonical.label')}
        lines={[record.name, ...(record.aliases || [])]}
        empty={t('identity.row.canonical.empty')}
        onOpen={onNames}
      />
      <ScreenRow
        label={t('identity.row.sort.label')}
        meta={record.sort_name || t('identity.row.sort.none')}
        sub={t('identity.row.sort.sub.character')}
        onClick={onSort}
      />
      <ScreenRow
        label={t('identity.field.born')}
        meta={record.born || t('identity.row.born.none')}
        // IN-WORLD, and the distinction matters on this table alone: a person's
        // birth is a fact about the world and a character's is a fact a work
        // states. Sherlock Holmes has a birth year because a story says so.
        sub={t('identity.row.born.sub.character')}
        onClick={onBorn}
      />

      <SectionHead label={t('identity.section.links.label')} note={t('identity.section.links.note.character')} />
      <PillRow
        pills={pills}
        onAdd={onLinkAdd}
        addLabel={t('identity.row.link.add.label')}
        addIcon="+"
        addTitle={t('identity.row.link.add.tip')}
      />

      <SectionHead label={t('identity.character.appearances.title', { n: works.length, count: works.length })} />
      <AppearanceStrip
        tiles={tiles}
        hint={tiles.length > 1 ? t('identity.strip.order.hint') : ''}
        onAdd={onAddWork}
        addTitle={t('identity.works.add.character.tip')}
      />

      {/* The two sections the pack does not draw — see this file's header for why
          each is kept. They sit between the works and the acts that end the
          screen, because both are facts about the identity across every work. */}
      {children}

      <SectionHead label={t('identity.section.itself.label.character')} />
      <ScreenRow
        label={t('identity.row.merge.label.character')}
        sub={t('identity.row.merge.sub.character')}
        icon="⇢"
        onClick={onMerge}
      />
      {/* DRAWN ONLY WHERE IT ACTS. The pack's "Remove from all works" opens a
          multi-step picker that unlinks one work at a time, and that picker is not
          built — so the row is absent rather than present and inert, which is the
          same rule the works strip's add tile follows. */}
      {onRemoveAll ? (
        <ScreenRow
          label={t('identity.row.remove-all.label')}
          sub={t('identity.row.remove-all.sub')}
          icon="🗑"
          danger
          onClick={onRemoveAll}
        />
      ) : null}
    </ScreenBody>
  )
}

// ---- one person, shared by every work ---------------------------------------

export function PersonGlobal({
  record, credits, roles, kinds, portrait, portraitActions, onNames, onSort, onBorn,
  onLinkAdd, onOpenWork, onOpenRole, onAddWork, onMerge, onDelete, children,
}) {
  // TWO SOURCES, ONE STRIP, and the pack's own tiles say so: "as Harry
  // (performer) · as Miles (performer) · author of Jungle" is a union of what
  // this person PLAYED and what they MADE. They come off two tables — work_cast
  // through actor_id, work_person through role — and a strip drawn from either
  // alone is a person's filmography with their books missing, or the reverse.
  //
  // WHAT THEY PLAYED LEADS, because a performed role is the more specific fact:
  // it names a character, and pressing it opens that character — which is the
  // owner's ruling ("an actor's page lists every character they have played")
  // read in the direction a reader travels.
  const tiles = useMemo(
    () => [
      ...workTiles(roles, portrait, onOpenRole),
      ...creditTiles(credits, portrait, onOpenWork),
    ],
    [roles, credits, portrait, onOpenRole, onOpenWork],
  )
  const pills = useMemo(() => linkPills(record.links), [record.links])
  // "performer · author · 3 works", which is the pack's crumb: what this person
  // DOES comes before how much of it there is.
  const n = tiles.length
  const crumb = [...(kinds || []), t('identity.crumb.works', { n, count: n })]
    .filter(Boolean).join(' · ')
  return (
    <ScreenBody>
      <ScreenHead title={record.name} crumb={crumb} glyph={GLOBE} scopeTitle={t('identity.scope.library.body')} />
      <PortraitBlock
        src={portrait}
        name={record.name}
        // `soft` is NOT passed any more: PortraitBlock measures the file and
        // decides. Hardcoding it here made every portrait in the app claim to
        // be too small for a share card, whatever its size. `px` stays as the
        // line shown before a measurement exists.
        px={t('identity.portrait.global')}
        actions={portraitActions}
      />

      {/* THE NOTE IS A DEPARTURE, and the pack is the thing being departed from:
          `char-global` carries "Edits here reach every work." over exactly these
          rows and `people-global` carries nothing over the same three. The two
          screens write to the same kind of record with the same blast radius, so
          the omission is an inconsistency in the pack rather than a decision —
          and this sentence is the only thing standing between a reader and
          renaming an author across thirty-one books. Same string, because it is
          the same fact. */}
      <SectionHead label={t('identity.section.person.label')} note={t('identity.section.identity.note')} />
      <NamesRow
        label={t('identity.row.name.label')}
        lines={[record.name, ...(record.aliases || [])]}
        empty={t('identity.row.canonical.empty')}
        onOpen={onNames}
      />
      <ScreenRow
        label={t('identity.row.sort.label')}
        meta={record.sort_name || t('identity.row.sort.none')}
        sub={t('identity.row.sort.sub.person')}
        onClick={onSort}
      />
      {/* NO IN-WORLD CAVEAT HERE, which is the one row differing from the
          character's by more than a word: a person's birth is a fact about the
          world, so it needs no sentence saying whose claim it is. */}
      <ScreenRow
        label={t('identity.field.born')}
        meta={record.born || t('identity.row.born.none')}
        onClick={onBorn}
      />

      <SectionHead label={t('identity.section.links.label')} note={t('identity.section.links.note.person')} />
      <PillRow
        pills={pills}
        onAdd={onLinkAdd}
        addLabel={t('identity.row.link.add.label')}
        addIcon="+"
        addTitle={t('identity.row.link.add.tip')}
      />

      <SectionHead label={t('identity.section.works.label', { n, count: n })} />
      <AppearanceStrip
        tiles={tiles}
        hint={tiles.length > 1 ? t('identity.strip.order.hint') : ''}
        onAdd={onAddWork}
        addTitle={t('identity.works.add.person.tip')}
      />

      {children}

      <SectionHead label={t('identity.section.itself.label.person')} />
      <ScreenRow
        label={t('identity.row.merge.label.person')}
        sub={t('identity.row.merge.sub.person')}
        icon="⇢"
        onClick={onMerge}
      />
      {/* Same rule as the character screen's removal row. */}
      {onDelete ? (
        <ScreenRow
          label={t('identity.row.delete.label.person')}
          sub={t('identity.row.delete.sub.person')}
          icon="🗑"
          danger
          onClick={onDelete}
        />
      ) : null}
    </ScreenBody>
  )
}
