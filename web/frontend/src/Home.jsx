// Home — the landing screen (mobile handoff §7 redesign, ROADMAP №2): a date +
// greeting, the Daily Quiz card, the Practice card, two stat tiles, and the
// most recent favourites. Reached by tapping the logo (every bar) or landing
// on "/". One narrow column on every screen size — the ritual reads the same
// on a phone and a desktop. Quote capture is NOT here any more — it's the
// "Capture quote" tab of the single ＋ Add surface (top bar + drawer).
import { useEffect, useMemo, useRef, useState } from 'react'
import { coverImgURL, errText, json } from './api.js'
import { chapterLabel, chapterMeta, episodeLabel } from './text.js'
import { dateLine, greetingFor } from './greetings.js'
import { AnnotationForm, annotationState, annDate, fmtDate } from './Library.jsx'
import { DialogueForm, dialogueState } from './Movies.jsx'
import { UtteranceForm, utteranceState } from './Quotes.jsx'
import { t, tNodes } from './i18n.js'
import { quoteKindMeta } from './quoteKind.js'
import { PendingImportCard } from './StagingPage.jsx'
import { QuizRunner, tzOffsetMinutes } from './review.jsx'
import {
  CharacterFaces,
  CreditFaces,
  PersonCredit,
  PersonModal,
  parseCreditSeps,
  splitCredits,
  usePeople,
} from './people.jsx'
import { ShareDialog, bookShare, copyQuote, movieShare, quoteShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { actionsFor, atOverflow, atRow } from './actions.jsx'
import { useStickers } from './stickers.jsx'
import {
  ANNOTATION_HEX,
  ClampMore,
  ColorSwatches,
  clampSequence,
  FieldIconButton,
  formatPartialDate,
  formatYear,
  FormModal,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconDelete,
  IconShuffle,
  InfoDot,
  IconButton,
  Masonry,
  MonoLabel,
  mulberry32,
  NavIcon,
  Placeholder,
  QuoteActions,
  QuoteTools,
  shuffleSeeded,
  STATUS_META,
  toast,
  Tooltip,
  useCardMenu,
  useColumnsAt,
  usePersistedState,
} from './ui.jsx'


// StatesRow — the "where you stand" breakdown: a count per repetition status
// with its coloured dot, plus a toggle for the explainer.
//
// `adaptive` mirrors the srAdaptive preference, and the explainer describes
// whichever rule is actually in force. Describing the ladder to somebody who has
// switched it off would make the one piece of copy that explains the schedule
// the one piece of copy that lies about it.
function StatesRow({ states, help, onToggleHelp, adaptive }) {
  if (!states || states.total === 0) return null
  const pips = [
    ['remembered', states.remembered],
    ['forgetting', states.forgetting],
    ['probably-forgotten', states.probably_forgotten],
    ['unseen', states.unseen],
  ]
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }} className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="mono-label" style={{ color: 'var(--faint)' }}>{t('home.states.title')}</span>
        {pips.map(([key, n]) => (
          <span key={key} className="mono-label inline-flex items-center gap-1.5" style={{ fontSize: 'var(--type-ui-11)', opacity: n ? 1 : 0.45 }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: `1.5px solid ${STATUS_META[key].color}`,
                background: STATUS_META[key].filled ? STATUS_META[key].color : 'transparent',
              }}
            />
            <span style={{ fontWeight: 600 }}>{n}</span> {t(STATUS_META[key].label).toLowerCase()}
          </span>
        ))}
        <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-11)', marginLeft: 'auto' }} onClick={onToggleHelp}>
          {t('home.states.help.label')}
        </button>
      </div>
      {help && (
        <p className="microcopy mt-2" style={{ lineHeight: 1.6 }}>
          {/* ONE KEY PER RULE, holding the whole paragraph. It was five JSX
              fragments around two links and three bold runs, which is a sentence
              a translator cannot reorder — and this paragraph is the only place
              the schedule is explained. */}
          {tNodes(adaptive ? 'home.states.help.adaptive.prose' : 'home.states.help.ladder.prose', {
            curve: (
              <a key="curve" href="https://en.wikipedia.org/wiki/Forgetting_curve" target="_blank" rel="noopener noreferrer" className="tp-link">
                {t('home.states.help.curve.label')}
              </a>
            ),
            spaced: (
              <a key="spaced" href="https://en.wikipedia.org/wiki/Spaced_repetition" target="_blank" rel="noopener noreferrer" className="tp-link">
                {t('home.states.help.spaced.label')}
              </a>
            ),
            remembered: <strong key="remembered">{t('home.states.help.remembered.label')}</strong>,
            forgetting: <strong key="forgetting">{t('home.states.help.forgetting.label')}</strong>,
            forgotten: <strong key="forgotten">{t('home.states.help.forgotten.label')}</strong>,
          })}
        </p>
      )}
    </div>
  )
}

// DailyQuizCard — the scheduled spaced-repetition session (ROADMAP №2): every
// card due today, no skips, each grade folded into the schedule. Got it / Forgot
// move the card's half-life; the deck drains as you go and the pending dot
// follows. Records a permanent daily score + streak.
function DailyQuizCard({ onPending, states, onStates, adaptive, submitStep }) {
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | active | done | error
  const [tally, setTally] = useState({ got: 0, forgot: 0 })
  const [help, setHelp] = useState(false)

  useEffect(() => {
    json('GET', `/review/daily?offset=${tzOffsetMinutes()}`).then((r) => {
      // A failed fetch must NOT masquerade as "all caught up" — show an error and
      // leave the pending dot as the shell seeded it.
      if (!r.ok) return setPhase('error')
      setData(r.data)
      setTally({ got: r.data.got_today || 0, forgot: r.data.forgot_today || 0 })
      onStates?.(r.data.states)
      const n = (r.data.items || []).length
      onPending(n)
      setPhase(n ? 'active' : 'done')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onAnswered(result, res) {
    setTally((prev) => ({
      got: prev.got + (result === 'got' ? 1 : 0),
      forgot: prev.forgot + (result === 'forgot' ? 1 : 0),
    }))
    if (res && typeof res.remaining === 'number') onPending(res.remaining)
    // Every answer carries fresh library-wide status counts, so "where you
    // stand" ticks live instead of waiting for the next Home visit.
    if (res?.states) onStates?.(res.states)
  }

  const streak = data?.streak || 0
  return (
    <HandCard variant={0} style={{ padding: '16px 18px 14px' }}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('home.daily.title')}</MonoLabel>
        {streak > 0 && (
          <span className="mono-label" style={{ letterSpacing: '.06em' }}>
            {t('home.daily.streak.label', { n: streak, count: streak })}
          </span>
        )}
      </div>

      {phase === 'error' ? (
        <p className="microcopy py-6 text-center" style={{ color: 'var(--error)' }}>
          {t('home.daily.error')}
        </p>
      ) : phase === 'loading' ? (
        <p className="microcopy py-6 text-center">{t('home.daily.loading')}</p>
      ) : phase === 'active' ? (
        <QuizRunner
          mode="daily"
          cards={data.items}
          allowSkip={false}
          submitStep={submitStep}
          onAnswered={onAnswered}
          onDone={() => setPhase('done')}
        />
      ) : (
        <div className="review-card-body py-4 text-center" style={{ padding: '18px 6px 12px' }}>
          <p
            aria-hidden="true"
            style={{ fontFamily: 'var(--font-hand)', fontWeight: 'var(--font-hand-weight)', fontStyle: 'var(--font-hand-style)', fontVariantCaps: 'var(--font-hand-caps)', textTransform: 'var(--font-hand-case)', fontVariantNumeric: 'var(--font-hand-figures)', fontSize: 'var(--type-hand-26)', color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}
          >
            {t(tally.got || tally.forgot ? 'home.daily.done.label' : 'home.daily.empty.label')}
          </p>
          <p className="mono-label mt-1" style={{ letterSpacing: '.06em' }}>
            {tally.got || tally.forgot
              ? t('home.daily.done.summary', { got: tally.got, missed: tally.forgot })
              : t('home.daily.empty.summary')}
          </p>
        </div>
      )}

      {states && (
        <StatesRow states={states} help={help} onToggleHelp={() => setHelp((v) => !v)} adaptive={adaptive} />
      )}
    </HandCard>
  )
}

// PracticeCard — unlimited retrieval practice (ROADMAP №2): the same reveal/grade
// flow as the Daily Quiz, but skippable and, by default, schedule-neutral (a
// setting opts it into moving half-lives). Its score is separate and can be
// reset without touching learning history.
function PracticeCard({ onStates, userId, submitStep }) {
  // The active deck + position + tally persist across reloads (localStorage),
  // so a refresh resumes the round instead of dropping it — { cards, i, got,
  // forgot }, cleared when the round finishes or is ended. The key is
  // user-scoped so a shared browser never shows one account's private deck to
  // the next (localStorage isn't cleared on logout). `phase` seeds from a live
  // session so a reload comes back straight into 'active'.
  const [session, setSession] = usePersistedState(`tippani:practice:session:${userId ?? 'me'}`, null)
  const [phase, setPhase] = useState(session?.cards?.length ? 'active' : 'idle')
  const [score, setScore] = useState(null) // lifetime practice score
  const [lastRound, setLastRound] = useState({ got: 0, forgot: 0 }) // the finished round's tally, for the done screen
  const [busy, setBusy] = useState(false)
  const cards = session?.cards || []

  function loadScore() {
    json('GET', `/review/scores?offset=${tzOffsetMinutes()}`).then((r) => {
      if (r.ok) setScore(r.data.practice)
    })
  }
  useEffect(() => { loadScore() }, [])

  async function start() {
    setBusy(true)
    const r = await json('GET', '/review/practice')
    setBusy(false)
    const items = r.ok ? r.data.items || [] : []
    if (!items.length) return toast(t('error.load.practice'))
    setSession({ cards: items, i: 0, got: 0, forgot: 0 })
    setPhase('active')
  }

  // finishRound ends the current round (naturally or via End practice): stash
  // its tally for the done screen, drop the persisted deck, refresh the score.
  function finishRound() {
    setLastRound({ got: session?.got || 0, forgot: session?.forgot || 0 })
    loadScore()
    setSession(null)
    setPhase('done')
  }

  function onAnswered(result, res) {
    // Tally lives in the persisted session so a reload doesn't lose the count.
    setSession((s) => (s ? {
      ...s,
      got: s.got + (result === 'got' ? 1 : 0),
      forgot: s.forgot + (result === 'forgot' ? 1 : 0),
    } : s))
    // Practice answers refresh the Daily card's "where you stand" row too — the
    // server returns the counts on every answer (they move when practice is set
    // to touch the schedule, and stay honest either way).
    if (res?.states) onStates?.(res.states)
  }

  async function reset() {
    await json('DELETE', '/review/practice')
    loadScore()
    toast(t('home.practice.toast.reset'))
  }

  return (
    <HandCard variant={3} style={{ padding: '16px 18px 14px' }}>
      {/* The paragraph that used to explain Practice now hangs off this dot.
          The card is two taps of a ritual you do daily — after the first week
          the explanation is furniture, and on a phone it was four lines of
          furniture above the only button that matters. */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('home.practice.title')}</MonoLabel>
          <InfoDot title={t('home.practice.info.title')} text={t('home.practice.info.body')} />
        </span>
        {phase === 'active' && (
          <span className="mono-label" style={{ letterSpacing: '.06em' }}>{t('home.practice.unlimited.label')}</span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="review-card-body">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
              {t(busy ? 'home.practice.start.busy' : 'home.practice.start.label')}
            </button>
            {score && score.answered > 0 && (
              <>
                <MonoLabel style={{ fontSize: 'var(--type-ui-11)' }}>
                  {t('home.practice.score.label', {
                    n: score.answered,
                    count: score.answered,
                    percent: Math.round(score.accuracy * 100),
                  })}
                </MonoLabel>
                <FieldIconButton
                  icon={<IconDelete />}
                  ariaLabel={t('home.practice.reset.aria')}
                  onClick={reset}
                  tooltip={t('home.practice.reset.tip')}
                />
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'active' && cards.length > 0 && (
        <>
          <QuizRunner
            mode="practice"
            cards={cards}
            allowSkip
            submitStep={submitStep}
            startIndex={Math.min(session?.i || 0, cards.length - 1)}
            onIndex={(i) => setSession((s) => (s ? { ...s, i } : s))}
            onAnswered={onAnswered}
            onDone={finishRound}
          />
          <div className="mt-2 text-right">
            <button type="button" className="tp-link" onClick={finishRound}>{t('home.practice.end.label')}</button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="review-card-body py-2 text-center">
          <p aria-hidden="true" style={{ fontFamily: 'var(--font-hand)', fontWeight: 'var(--font-hand-weight)', fontStyle: 'var(--font-hand-style)', fontVariantCaps: 'var(--font-hand-caps)', textTransform: 'var(--font-hand-case)', fontVariantNumeric: 'var(--font-hand-figures)', fontSize: 'var(--type-hand-26)', color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}>
            {t('quiz.round.score.label', { done: lastRound.got, total: lastRound.got + lastRound.forgot })}
          </p>
          <p className="mono-label mt-1 mb-3" style={{ letterSpacing: '.06em' }}>
            {t('home.practice.round.summary', { got: lastRound.got, missed: lastRound.forgot })}
          </p>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
            {t('quiz.round.again.label')}
          </button>
        </div>
      )}
    </HandCard>
  )
}

const FAVS_INITIAL = 4 // tiles shown before "view more"

// bookFav / screenFav flatten a book annotation and a screen dialogue into one
// favourite-tile shape so the Home grid can mix both media. `text` is the line
// shown (the quote, or the note for note-only captures); `note` is the margin
// note, surfaced on expand only when there's a separate quote (so it never
// duplicates the text).
// `meta` is the EXPANDED line and carries no credit. The expanded tile renders
// the credited people as PersonCredit chips — portrait, name, and a way into
// their panel — so naming them here too put the same person on the card twice,
// once as plain text and once as the thing you can actually click.
// `source`, the collapsed line, keeps the credit: there are no chips down there.
function bookFav(a) {
  const meta = [
    a.book_title,
    // 0047's character, on the tile as well as on the library card: the same box,
    // and it was invisible on both.
    a.character,
    chapterMeta(a),
    a.location && t('common.locator.page.label', { n: a.location }),
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    key: `book:${a.id}`,
    kind: 'book',
    color: a.color,
    text: a.quote || a.note,
    note: a.quote ? a.note : '',
    tags: a.tags || [],
    source: [a.book_title, a.book_author].filter(Boolean).join(' · '),
    meta,
    createdAt: a.created_at,
    openLabel: t('home.favourites.open.book.aria'),
    workId: a.book_id,
    raw: a, // the untouched row — share/edit/delete need the full state
  }
}

function screenFav(d, movieMap) {
  const m = movieMap[d.movie_id] || {}
  const isShow = (m.media_type || 'movie') === 'show'
  return {
    key: `screen:${d.id}`,
    kind: 'screen',
    media: t(isShow ? 'common.badge.show' : 'common.badge.film'),
    // A dialogue has carried a colour for as long as the other two kinds have,
    // and this was the one builder that did not pass it on — so every film line
    // on Home wore the default yellow bar whatever colour it actually is, and
    // the quick-pick added to the expanded tile would have painted nothing.
    color: d.color,
    text: d.quote || d.note,
    note: d.quote ? d.note : '',
    tags: d.tags || [],
    source: [m.title, d.character].filter(Boolean).join(' · '),
    meta: [m.title, episodeLabel(d), d.character, d.timestamp].filter(Boolean).join(' · '),
    createdAt: d.created_at,
    openLabel: t(isShow ? 'home.favourites.open.show.aria' : 'home.favourites.open.film.aria'),
    workId: d.movie_id,
    raw: d, // the untouched row — share/edit/delete need the full state
    movie: m, // parent title/year for the share payload
  }
}

// quoteFav — a standalone quote as a favourite tile. The third kind, and the
// one with no work behind it: where a book contributes a title and a film a
// poster, this contributes the OCCASION — who said it, on what occasion, when,
// where, through what medium — which is the same role and a different shape.
//
// No `workId`, because there is no work: a standalone quote IS the whole record.
// It does still have somewhere to GO, though — the Quotes screen it lives on —
// which is what the open glyph does here, wearing that screen's own nav glyph. It
// used to have no open button at all, on the reasoning that a quote has nothing
// behind it. True of a parent record, false of a destination.
function quoteFav(u) {
  // 0053. The kind's word, falling back to the old free-text medium — the same
  // rule utteranceMeta follows, spelled through the same helper.
  const rest = [u.occasion, formatPartialDate(u.occasion_date), u.place, quoteKindMeta(u)].filter(Boolean)
  return {
    key: `quote:${u.id}`,
    kind: 'quote',
    color: u.color,
    text: u.quote || u.note,
    note: u.quote ? u.note : '',
    tags: u.tags || [],
    source: [u.speaker, u.occasion].filter(Boolean).join(' · '),
    // No speaker in `meta` \u2014 the expanded tile chips them. See bookFav.
    meta: rest.join(' · '),
    createdAt: u.created_at,
    openLabel: t('home.favourites.open.quotes.aria'),
    raw: u,
  }
}

// FAV_KINDS — everything that differs between the three, in one table.
//
// It was a pair of `isBook` ternaries scattered through the tile, which is a
// shape that works for exactly two kinds and quietly rots at three: adding
// standalone quotes meant either a third leg on every one of them or this. Every
// entry is something the tile genuinely has to know, and a kind missing from
// here fails loudly at the lookup rather than silently rendering as a book.
// FAV_KINDS — the three kinds of favourite, and everything that differs between
// them, in one table.
//
// `actionKind` IS THE NAME THE ACTION REGISTRY KNOWS, and it is here because it
// is NOT the key. A favourite of kind `book` is a highlight OUT OF a book — an
// annotation — and passing `book` to actionsFor said the opposite: isWorkKind()
// reads `book` as the work itself, so `available: !isWork && !!ctx.copy` took
// copy and share off the list. Every book favourite in the app therefore had an
// empty tools row, and the row 1.15.3 added to the collapsed tile rendered
// nothing at all, because QuoteTools returns null on an empty list.
//
// The symptom was the whole feature silently missing on the one board that
// exists to hold the lines you liked most, with no error anywhere: the tile drew
// correctly, the handlers were wired, and the registry had quietly decided they
// did not apply. Library and Catalogue never hit it because they pass
// 'annotation' and 'dialogue' literally.
const FAV_KINDS = {
  book: {
    actionKind: 'annotation',
    label: () => t('common.badge.book'),
    labelColor: 'var(--accent-ui)',
    path: '/annotations',
    state: annotationState,
    form: AnnotationForm,
    get editTitle() { return t('home.favourites.edit.annotation.title') },
    get confirm() { return t('home.favourites.delete.annotation.confirm') },
    personKind: 'author',
    credit: (f) => f.raw.book_author,
    shareKind: 'book',
    quoted: true,
    // The nav glyph of the screen this kind belongs to, drawn by NavIcon so the
    // tile and the tab strip cannot end up with two different pictures of the
    // Library.
    openIcon: 'library',
  },
  screen: {
    actionKind: 'dialogue',
    label: (f) => f.media,
    labelColor: 'var(--amber)',
    path: '/dialogues',
    state: dialogueState,
    form: DialogueForm,
    get editTitle() { return t('home.favourites.edit.dialogue.title') },
    get confirm() { return t('home.favourites.delete.dialogue.confirm') },
    personKind: 'actor',
    credit: (f) => f.raw.actor,
    shareKind: 'screen',
    quoted: false,
    openIcon: 'movies',
  },
  quote: {
    actionKind: 'quote',
    label: () => t('common.badge.quote'),
    labelColor: 'var(--accent-ui)',
    path: '/quotes',
    state: utteranceState,
    form: UtteranceForm,
    get editTitle() { return t('home.favourites.edit.quote.title') },
    get confirm() { return t('home.favourites.delete.quote.confirm') },
    personKind: 'speaker',
    credit: (f) => f.raw.speaker,
    openIcon: 'quotes',
    shareKind: 'utterance',
    quoted: true,
  },
}

export default function Home({ user, stats, onOpenBook, onOpenMovie, onGoLibrary, onGoMovies, onGoQuotes, onPending, pendingImport, onReviewImport }) {
  const [favs, setFavs] = useState([])
  // Favourites sit in Home's reading column, not the full container, so this
  // ladder tracks --home-max rather than --container-max.
  const favCols = useColumnsAt([[1400, 3], [640, 2]])
  const [favsShown, setFavsShown] = useState(FAVS_INITIAL)
  const [openFav, setOpenFav] = useState(null) // favourite key expanded in place
  const [editingFav, setEditingFav] = useState(null) // favourite key being edited in place
  const [shareFav, setShareFav] = useState(null) // favourite being shared, or null
  const [tagNames, setTagNames] = useState([]) // suggestions for the edit forms
  const { map: authorMap } = usePeople('author') // author faces: favourite chips + share payloads
  const { map: actorMap } = usePeople('actor') // actor faces: favourite chips + share payloads
  const { map: speakerMap } = usePeople('speaker') // speaker faces on standalone-quote favourites
  const [person, setPerson] = useState(null) // {kind, name} open in the metadata panel
  const seps = parseCreditSeps(user?.preferences?.creditSeparators)
  // "Where you stand" lives in the Daily Quiz card but is fed by BOTH cards —
  // every /review/answer response carries fresh counts, so the row ticks live.
  const [states, setStates] = useState(null)
  const { stickers, reload: reloadStickers } = useStickers()
  // Drawn once per mount, not per render: a greeting that reshuffled every time
  // a quiz card re-rendered would be a flicker, not a flourish. A reload picks
  // again, which is exactly the intent.
  const hello = useMemo(() => greetingFor(user?.username), [user?.username])
  const today = useMemo(() => dateLine(), [])
  // THE ORDER OF THE FAVOURITES WALL, drawn once per visit to Home and not again.
  //
  // The section is a re-surfacing wall rather than a feed, so it reorders — but it
  // used to reorder on every LOAD, and every in-place edit reloads it. Recolour a
  // quote and the four tiles on screen became four different tiles; the card you
  // had just acted on was gone, which reads as the app losing your change. Sharing
  // one had the same shape.
  //
  // One seed per mount, spent through shuffleSeeded, fixes both ends: arriving on
  // Home deals a new wall, and nothing you do while standing on it deals another.
  const favSeed = useMemo(() => (Math.random() * 0xffffffff) >>> 0, [])

  // Favourites across all THREE kinds — book highlights, film dialogue and
  // standalone quotes — merged and shuffled. A few show as tiles; the rest wait
  // behind "view more". Movies are fetched once to attribute each dialogue to
  // its title (the dialogues list carries only movie_id). Reloaded after any
  // tile mutation (edit · delete · un-heart).
  //
  // Standalone quotes were simply never asked for. This function fetched two
  // lists and merged two lists, and had done since before the third kind
  // existed; the comment above it still said "both media". Nothing failed —
  // hearting a standalone quote worked, the heart stayed on, the Quotes screen
  // filtered by it — and the quote never appeared here, which is a bug you can
  // only find by owning one and looking for it.
  function loadFavs() {
    Promise.all([
      json('GET', '/annotations?favorite=1&limit=200'),
      json('GET', '/dialogues?favorite=1'),
      json('GET', '/quotes?favorite=1'),
      json('GET', '/movies'),
    ]).then(([ra, rd, rq, rm]) => {
      // Guard .data, not just .ok: a 2xx response with a non-JSON/empty body
      // (an SPA/HTML fallback from a reverse proxy, or a session-expiry redirect
      // resolved to a 200 page) leaves .data null. Dereferencing .data.movies
      // then throws and — with no catch — silently blanked the ENTIRE favourites
      // section while the rest of Home rendered. Guard each, and catch below.
      const movieMap = {}
      if (rm.ok && rm.data) for (const m of rm.data.movies || []) movieMap[m.id] = m
      const list = []
      if (ra.ok && ra.data) for (const a of ra.data.annotations || []) list.push(bookFav(a))
      if (rd.ok && rd.data) for (const d of rd.data.dialogues || []) list.push(screenFav(d, movieMap))
      // The response key is `utterances` — the table, not the route.
      if (rq.ok && rq.data) for (const u of rq.data.utterances || []) list.push(quoteFav(u))
      // Shuffled by favSeed, which was drawn once when Home mounted: each VISIT
      // reorders the wall, and the reloads an edit triggers leave it exactly as it
      // was. Ranking each favourite off its own key rather than walking the list is
      // what makes that true even when a tile has just been un-hearted away.
      setFavs(shuffleSeeded(list, favSeed))
    }).catch((e) => {
      console.error('favourites load failed', e)
    })
  }
  useEffect(() => {
    loadFavs()
    json('GET', '/tags').then((r) => {
      if (r.ok && r.data) setTagNames((r.data.tags || []).map((row) => row.name))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clamp sizes (3–5 lines, no three-in-a-row), laid out in the wall's own order
  // so the no-three-in-a-row rule reads that way on the board. Seeded off favSeed
  // for the same reason the order is: drawn from Math.random these re-rolled on
  // every reload, so a colour change made every tile on screen change height even
  // when the order held.
  const favClamps = useMemo(() => clampSequence(favs.length, mulberry32(favSeed)), [favs.length, favSeed])

  // Share/edit/delete mirror the handlers in Library/Movies/SearchPage: PUTs
  // are full-state (annotationState/dialogueState carry every field), deletes
  // confirm first, and every success reloads the favourites list.
  const itemPath = (f) => FAV_KINDS[f.kind].path
  async function saveFav(f, fields) {
    const r = await json('PUT', `${itemPath(f)}/${f.raw.id}`, fields)
    if (!r.ok) return errText(r, t('error.save.generic'))
    setEditingFav(null)
    loadFavs()
    return null
  }
  // Returns false on failure, which is what the tile's optimistic colour pick
  // rolls back on — the same contract Library's annotation patch has. `toast()`
  // does not return false, so signalling it has to be explicit.
  async function patchFav(f, fields) {
    const stateFn = FAV_KINDS[f.kind].state
    const r = await json('PUT', `${itemPath(f)}/${f.raw.id}`, { ...stateFn(f.raw), ...fields })
    if (!r.ok) {
      toast(errText(r, t('error.save.generic')))
      return false
    }
    loadFavs()
  }
  async function removeFav(f) {
    if (!confirm(FAV_KINDS[f.kind].confirm)) return
    const r = await deleteWithUndo(`${itemPath(f)}/${f.raw.id}`, { reload: loadFavs })
    if (!r.ok) return toast(errText(r, t('error.delete.generic')))
    if (openFav === f.key) setOpenFav(null)
    if (editingFav === f.key) setEditingFav(null)
    loadFavs()
  }
  // A serendipity card draws itself from a SUMMARY row — one request for up to
  // sixty On this day cards, rather than sixty — but acting on one needs the
  // record: patchFav sends the full state back, and the share picture wants the
  // chapter, the page, the timestamp and the occasion date that a summary has no
  // business carrying. So the record is fetched when the reader actually presses
  // something, and then routed through the SAME helpers the favourites board
  // uses. That is what makes a quote copied from a shuffle and the same quote
  // copied from its own screen produce identical text, rather than two share
  // payloads that agree until one of them is edited.
  const resolveQuote = async (q) => {
    const r = await json('GET', `${FAV_KINDS[q.kind].path}?id=${q.id}`)
    if (!r.ok || !r.data) return null
    const row = (r.data.annotations || r.data.dialogues || r.data.utterances || [])[0]
    if (!row) return null
    if (q.kind === 'book') return bookFav(row)
    if (q.kind === 'quote') return quoteFav(row)
    // screenFav wants the parent film, and a dialogue row carries none — which is
    // exactly why the summary row reports the title, the media type and the year.
    // No second fetch: the three fields it needs already arrived with the card.
    return screenFav(row, { [row.movie_id]: { title: q.title, media_type: q.media_type, release_year: q.year || null } })
  }
  const serendipityActions = {
    copy: async (q) => {
      const f = await resolveQuote(q)
      if (!f) return toast(t('error.generic'))
      copyQuote(sharePayloadFor(f))
    },
    share: async (q) => {
      const f = await resolveQuote(q)
      if (!f) return toast(t('error.generic'))
      setShareFav(f)
    },
    // Returns false so the card can roll its optimistic heart back — the same
    // contract patchFav already has with the favourite tiles.
    favourite: async (q, next) => {
      const f = await resolveQuote(q)
      if (!f) {
        toast(t('error.generic'))
        return false
      }
      return patchFav(f, { favorite: next })
    },
  }

  const sharePayloadFor = (f) => {
    if (f.kind === 'book') {
      return bookShare({
        quote: f.raw.quote, note: f.raw.note, translation: f.raw.translation,
        author: f.raw.book_author, title: f.raw.book_title,
        chapter: chapterLabel(f.raw), location: f.raw.location, character: f.raw.character,
        date: fmtDate(annDate(f.raw)),
        tags: f.raw.tags, color: f.raw.color, people: authorMap,
      })
    }
    if (f.kind === 'quote') {
      // The same payload the Quotes screen builds, so a quote shared from Home
      // and the same quote shared from its own screen produce the same picture.
      return quoteShare({
        quote: f.raw.quote, translation: f.raw.translation, note: f.raw.note,
        category: f.raw.category, language: f.raw.language,
        speaker: f.raw.speaker, occasion: f.raw.occasion,
        when: formatPartialDate(f.raw.occasion_date), place: f.raw.place, medium: quoteKindMeta(f.raw),
        date: fmtDate(f.raw.noted_at || f.raw.created_at),
        tags: f.raw.tags, color: f.raw.color, people: speakerMap, seps,
      })
    }
    return movieShare({
      quote: f.raw.quote, note: f.raw.note, translation: f.raw.translation,
      title: f.movie?.title, year: f.movie?.release_year,
      character: f.raw.character, actor: f.raw.actor, timestamp: f.raw.timestamp,
      episode: episodeLabel(f.raw), tags: f.raw.tags,
      color: f.raw.color, people: actorMap,
    })
  }

  return (
    <div className="home-col flex flex-col gap-4 pt-4" data-screen-label="home-body">
      {/* No "?" beside the greeting since 1.4.1 — it is a shell control now — so
          the date and greeting own the row outright. */}
      <div className="px-0.5">
        <div className="min-w-0">
          <MonoLabel>{today}</MonoLabel>
          <h1
            className="mt-0.5"
            style={{
              fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)',
              fontWeight: 600,
              fontSize: 'var(--type-display-26)',
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
            }}
          >
            {hello}
          </h1>
        </div>
      </div>

      {/* A staged import sits above the deck until it is dealt with: nothing has
          entered the library yet, and that is easy to forget. */}
      <PendingImportCard pending={pendingImport} onOpen={onReviewImport} />

      <DailyQuizCard onPending={onPending} states={states} onStates={setStates} adaptive={!!user?.preferences?.srAdaptive} submitStep={!!user?.preferences?.srSubmit} />

      <PracticeCard onStates={setStates} userId={user?.id} submitStep={!!user?.preferences?.srSubmit} />

      {/* THE TWO COUNT TILES ARE DOORS, and a reader who has switched a section
          off (Settings → Features) should not be looking at one. Gated on the
          callback rather than on a flag of their own, so Home needs to know
          nothing about preferences: the shell passes the prop while the section
          has a door. One tile left standing takes the full width rather than half
          of a two-column grid with a hole in it. */}
      {(onGoLibrary || onGoMovies) && (
      <div className={onGoLibrary && onGoMovies ? 'grid grid-cols-2 gap-2.5' : ''}>
        {onGoLibrary && (
        <Tooltip label={t('home.tile.library.tip')} className="flex items-stretch">
          <HandCard variant={1} className="cursor-pointer w-full" style={{ padding: '13px 15px' }} onClick={onGoLibrary} role="button" tabIndex={0}>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-26)' }}>
              {stats ? stats.books : '–'}
            </p>
            <MonoLabel style={{ fontSize: 'var(--type-display-11)' }}>
              {t('home.tile.library.counts', { n: stats ? stats.annotations : '–' })}
            </MonoLabel>
          </HandCard>
        </Tooltip>
        )}
        {onGoMovies && (
        <Tooltip label={t('home.tile.movies.tip')} className="flex items-stretch">
          <HandCard variant={2} className="cursor-pointer w-full" style={{ padding: '13px 15px' }} onClick={onGoMovies} role="button" tabIndex={0}>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-26)' }}>
              {stats ? stats.movies : '–'}
            </p>
            <MonoLabel style={{ fontSize: 'var(--type-display-11)', color: 'var(--amber)' }}>
              {t('home.tile.movies.counts', { n: stats ? stats.dialogues : '–' })}
            </MonoLabel>
          </HandCard>
        </Tooltip>
        )}
      </div>
      )}

      {/* SERENDIPITY (roadmap §1). Two ways back into your own library that are
          not the review loop and not a search: one line at random, and what you
          saved on this date in other years.

          Neither moves a schedule — the endpoints touch item_reviews at all, and
          there is a test saying so, because these draw the same quote card the
          deck does and a "seen" bump from idle shuffling would inflate the
          half-life of whatever the random number generator liked. */}
      <SerendipityRow
        onOpenBook={onOpenBook}
        onOpenMovie={onOpenMovie}
        onGoQuotes={onGoQuotes}
        people={{ author: authorMap, actor: actorMap, speaker: speakerMap }}
        seps={seps}
        onOpenPerson={setPerson}
        actions={serendipityActions}
      />

      {favs.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center gap-3">
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-19)' }}>
              {t('home.favourites.title')}
            </h2>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--line)' }} />
            <MonoLabel>{t('home.favourites.count.label', { n: favs.length })}</MonoLabel>
          </div>
          <Masonry columns={favCols} gap={10} order="source">
            {favs.slice(0, favsShown).map((f, i) => (
              <FavouriteTile
                key={f.key}
                f={f}
                variant={i + 1}
                clampLines={favClamps[i] || 3}
                open={openFav === f.key}
                editing={editingFav === f.key}
                onToggle={() => {
                  // Collapsing (or expanding another tile) always cancels an
                  // in-place edit — a half-hidden form is worse than a reset one.
                  setEditingFav(null)
                  setOpenFav((k) => (k === f.key ? null : f.key))
                }}
                // Two of the three are CONTENT LINKS — a favourite opening the
                // book it came from stays live however the reader has configured
                // their nav. The third is a DOOR: a standalone quote has no
                // parent, so its glyph opens the Quotes screen, and with that
                // screen switched off there is nowhere for it to go. Passing null
                // takes the glyph off the tile instead of leaving a button that
                // absorbs a tap and does nothing.
                onOpen={
                  f.kind === 'book' ? () => onOpenBook(f.workId)
                    : f.kind === 'screen' ? () => onOpenMovie(f.workId)
                      : onGoQuotes ? () => onGoQuotes()
                        : null}
                speakerMap={speakerMap}
                onEditStart={() => setEditingFav(f.key)}
                onEditCancel={() => setEditingFav(null)}
                onSave={(fields) => saveFav(f, fields)}
                onPatch={(fields) => patchFav(f, fields)}
                onDelete={() => removeFav(f)}
                onCopy={() => copyQuote(sharePayloadFor(f))}
                onShare={() => setShareFav(f)}
                tagSuggestions={tagNames}
                stickers={stickers}
                reloadStickers={reloadStickers}
                authorMap={authorMap}
                actorMap={actorMap}
                seps={seps}
                onOpenPerson={setPerson}
              />
            ))}
          </Masonry>
          {favsShown < favs.length && (
            <div className="mt-3 text-center">
              <GhostButton onClick={() => setFavsShown((n) => n + 8)}>
                {t('home.favourites.more.label', { n: favs.length - favsShown })}
              </GhostButton>
            </div>
          )}
        </section>
      )}

      {shareFav && (
        <ShareDialog
          share={sharePayloadFor(shareFav)}
          seen={{ kind: FAV_KINDS[shareFav.kind].shareKind, id: shareFav.raw.id }}
          onClose={() => setShareFav(null)}
        />
      )}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
    </div>
  )
}

// FavouriteTile — one favourite in the Home masonry, book or screen. Collapsed
// it shows a media tag, the quote (clamped) and its source; tapping expands it
// in place (full quote, note, tags) within its column — the board re-packs
// around the taller tile — with a button to open the parent book / film / show
// plus the same ♥ · copy · share · colour · ⋯ affordances the detail-screen
// cards carry, in the same order (QuoteTools for the pair, QuoteActions for the
// overflow that holds edit and delete). Edit swaps the tile body for
// the same inline form the detail screens use. The colour bar is the highlight
// colour for books, amber for screen quotes (the film voice). Tapping again
// collapses.
function FavouriteTile({
  f, variant, clampLines = 3, open, editing, onToggle, onOpen,
  onEditStart, onEditCancel, onSave, onPatch, onDelete, onCopy, onShare,
  tagSuggestions, stickers, reloadStickers,
  authorMap = {}, actorMap = {}, speakerMap = {}, seps, onOpenPerson,
}) {
  const meta = FAV_KINDS[f.kind]
  // From the registry (actions.jsx): a favourite is one of the three kinds of
  // quote seen from a different screen, so it gets the same set in the same order.
  const acts = actionsFor(meta.actionKind, f, {
    copy: onCopy && (() => onCopy()),
    share: onShare && (() => onShare()),
    edit: onEditStart && (() => onEditStart()),
    // Home's favourites board is the one screen where unfavouriting takes the
    // card off the board it is on, which is exactly what somebody pressing it
    // there means. `f.raw` is the stored row — `f` is the card's own shape.
    favourite: onPatch && (() => onPatch({ favorite: !f.raw?.favorite })),
    favourited: !!f.raw?.favorite,
    remove: onDelete && (() => onDelete()),
  })
  const { cardProps, menuClass, menu } = useCardMenu(acts.map((x) => ({ ...x, onClick: x.run })))
  const isBook = f.kind === 'book'
  // The credited people: a book's author(s), a dialogue's actor(s), or a
  // standalone quote's speaker(s) — ALL split per the user's separator prefs
  // (ROADMAP §11), so a multi-speaker line ("Sinéad Cusack, Hugo Weaving")
  // becomes individual, clickable people with portraits, not one joined chip.
  // Faces ride the collapsed source line (display-only); the expanded tile makes
  // them clickable PersonCredit chips.
  const peopleNames = splitCredits(meta.credit(f), seps)
  const peopleMap = { author: authorMap, actor: actorMap, speaker: speakerMap }[meta.personKind] || {}
  // The source/meta lines are rebuilt here from the SPLIT credit names (ROADMAP
  // §11) — bookFav/screenFav stored the joined author verbatim, so a book with
  // co-authors read as "Gaiman & Pratchett" instead of individual people.
  const authorText = peopleNames.join(' · ')
  let collapsedSource = f.source
  let expandedMeta = f.meta
  if (isBook) {
    const chLabel = chapterMeta(f.raw)
    const locLabel = f.raw.location ? t('common.locator.page.label', { n: f.raw.location }) : ''
    collapsedSource = [f.raw.book_title, authorText].filter(Boolean).join(' · ')
    // No author in the EXPANDED line: the PersonCredit chips below carry the
    // same names with their portraits and their way in, so repeating them here
    // was the same person on the card twice, one line apart.
    expandedMeta = [f.raw.book_title, chLabel, locLabel].filter(Boolean).join(' · ')
  }
  // Optimistic colour, the same trick AnnotationCard uses: onPatch refetches the
  // whole favourites list before the row comes back changed, so the quick-pick
  // paints the bar (and its own picked dot) the instant it is tapped, and rolls
  // back if the PUT failed.
  const [pendingColor, setPendingColor] = useState(null)
  useEffect(() => { setPendingColor(null) }, [f.color])
  const color = pendingColor || f.color || 'yellow'
  const pickColor = async (c) => {
    if (c === color) return // no clear: the server has no "no colour" (validColor)
    setPendingColor(c)
    if ((await onPatch({ color: c })) === false) setPendingColor(null)
  }
  return (
    <HandCard
      variant={variant}
      colorBar={color}
      className={menuClass}
      style={{ padding: '12px 15px' }}
      {...cardProps}
    >
      <FormModal open={editing} onClose={onEditCancel} title={meta.editTitle} maxWidth={520}>
        {/* One form per kind, picked from the table rather than by a ternary
            that only had room for two of them. `show` is meaningless to the
            other two forms and harmlessly ignored. */}
        <meta.form
          initial={f.raw}
          onSubmit={onSave}
          onCancel={onEditCancel}
          submitLabel={t('common.action.save.label')}
          show={f.movie?.media_type === 'show'}
          tagSuggestions={tagSuggestions}
          stickers={stickers}
          reloadStickers={reloadStickers}
        />
      </FormModal>
        <>
          {/* Click anywhere on the tile head to expand — a chevron is the only
              affordance (no "show more"); the quote clamps to a per-card 3–5. */}
          <Tooltip label={t(open ? 'home.favourites.collapse.tip' : 'quiz.option.expand.tip')} className="flex w-full">
            <button type="button" className="clampable is-clickable block w-full text-left" style={{ background: 'none', border: 'none', padding: 0 }} onClick={onToggle} aria-expanded={open}>
              <MonoLabel className="mb-1.5 block" style={{ fontSize: 'var(--type-ui-9)', color: meta.labelColor }}>
                {meta.label(f)}
              </MonoLabel>
              <p
                style={{
                  fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)',
                  fontStyle: 'italic',
                  fontSize: 'var(--type-display-15)',
                  lineHeight: 1.5,
                  margin: 0,
                  whiteSpace: 'pre-wrap', // keep the quote's line breaks (collapsed clamp still limits height)
                  ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
                }}
              >
                {meta.quoted ? `“${f.text}”` : f.text}
              </p>
              {/* Faces ride the COLLAPSED line only. Expanded, the same people
                  are PersonCredit chips a few lines down — portrait, name and a
                  way into their panel — and drawing the face here as well put
                  one person on the tile twice. */}
              <span className="mt-1.5 flex items-center gap-1.5">
                {/* A SCREEN TILE WEARS THE CHARACTER, everything else the person
                    (2.2.0). A film line is spoken by a character, so the face on
                    it is the one in costume; a book quote's author and a standalone
                    quote's speaker are people and keep their portraits.

                    Falls back to the person when the role has no stored picture,
                    which is most roles — so a library with no character art looks
                    exactly as it did. */}
                {!open &&
                  (f.raw?.character_images?.length ? (
                    <CharacterFaces images={f.raw.character_images} size={18} ring="var(--card)" />
                  ) : (
                    <CreditFaces names={peopleNames} map={peopleMap} size={18} ring="var(--card)" />
                  ))}
                <MonoLabel style={{ fontSize: 'var(--type-ui-11)' }}>{open ? expandedMeta : collapsedSource}</MonoLabel>
              </span>
              <ClampMore open={open} />
            </button>
          </Tooltip>
          {/* COPY AND SHARE ON THE COLLAPSED TILE (1.15.3). They were inside the
              expanded branch below, so the two things you most often do WITH a
              favourite — send it to somebody, paste it somewhere — cost a tap to
              open the tile first, on the one board in the app that exists to
              hold the lines you liked most. Every other quote surface puts them
              on the resting card; this now does too.

              Not `alwaysVisible`: the row follows the same rule the Library's
              does — hidden until hover on a desktop, standing on a phone, where
              there is no hover to wait for. The ♥ and the colour dots stay
              behind the expander, because un-hearting takes the tile off this
              board and a mis-tap there is destructive in a way copy is not. */}
          {!open && (
            <div className="mt-1 flex items-center gap-x-3">
              <QuoteTools actions={atRow(acts)} />
              <span className="ml-auto flex items-center">
                <QuoteActions actions={atOverflow(acts)} />
              </span>
            </div>
          )}
          {open && (
            <div className="mt-2.5 space-y-2">
              {f.note && <HandNote>{f.note}</HandNote>}
              {peopleNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {peopleNames.map((n) => (
                    <PersonCredit
                      key={n}
                      kind={meta.personKind}
                      name={n}
                      person={peopleMap[n]}
                      size={24}
                      onOpen={onOpenPerson}
                    />
                  ))}
                </div>
              )}
              {f.tags && f.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {f.tags.map((tag) => <span key={tag} className="tp-chip">{tag}</span>)}
                </div>
              )}
              {/* THE SAME ROW, IN THE SAME ORDER, AS EVERY OTHER QUOTE CARD:
                  ♥ · copy · share · colour, then the ⋯ alone on the right (see
                  Library's ActionRow and Movies' Frame). A favourite is one of the
                  three kinds of quote seen from a different screen, so a reader who
                  has learned the row on a book's page should not have to re-learn it
                  here — which is exactly what shipped for one release, with copy and
                  share sitting after the colour dots instead of before them.
                  Standing rather than hover-gated: this row only exists while the
                  tile is open, which is already the deliberate act the hover gate
                  waits for. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                {/* Where this quote lives, wearing that screen's own nav glyph — the
                    Library for a book, the Catalogue for a film or show, Quotes for
                    a standalone one. It was the words "Open book →" in a primary
                    button, which is the loudest control on the tile spent on the
                    least surprising thing you can do with it. NavIcon draws it, so
                    the tile and the tab strip cannot end up with two different
                    pictures of the Library. */}
                {f.openLabel && onOpen && (
                  <IconButton
                    icon={<NavIcon name={FAV_KINDS[f.kind].openIcon} />}
                    ariaLabel={f.openLabel}
                    onClick={onOpen}
                    className="shrink-0"
                  />
                )}
                {/* Un-hearting removes the tile — this IS the favourites list. */}
                <Hearts value={!!f.raw.favorite} onChange={(v) => onPatch({ favorite: v })} />
                <QuoteTools actions={atRow(acts)} alwaysVisible />
                {/* `collapsible` because a Home tile is a masonry cell and often
                    narrower than 330px, where six dots become the named list. */}
                <span className="card-colors is-visible shrink-0">
                  <ColorSwatches collapsible value={color} onChange={pickColor} ariaLabel={t('common.colour.category.aria')} />
                </span>
                <span className="ml-auto flex items-center">
                  <QuoteActions actions={atOverflow(acts)} />
                </span>
              </div>
            </div>
          )}
        </>
      {menu}
    </HandCard>
  )
}

// ---- Shuffle & On this day (roadmap §1) ------------------------------------
//
// One component for both, because they are the same card twice: a quote, where
// it came from, and a way through to it. The difference is only which endpoint
// filled it.
//
// SHUFFLE IS FETCHED ON DEMAND, NOT ON LOAD. A random quote that arrives with
// the page is a random quote nobody asked for, and it would change under you
// every time you came Home — which turns a small pleasure into noise. Pressing
// the button is the whole gesture.
//
// ON THIS DAY DRAWS NOTHING WHEN THE DAY IS EMPTY. A card that says "nothing on
// this day" every day for most of a first year is a card that teaches you to
// skip the part of the screen it sits in.
function SerendipityRow({ onOpenBook, onOpenMovie, onGoQuotes, people, seps, onOpenPerson, actions }) {
  const [shuffled, setShuffled] = useState(null)
  const [busy, setBusy] = useState(false)
  const [today, setToday] = useState([])

  useEffect(() => {
    let stale = false
    json('GET', '/on-this-day').then((r) => {
      if (!stale && r.ok) setToday(r.data?.quotes || [])
    })
    return () => { stale = true }
  }, [])

  const shuffle = async () => {
    setBusy(true)
    const r = await json('GET', '/shuffle')
    setBusy(false)
    if (r.ok) setShuffled(r.data?.quote || null)
  }

  // Where a card goes when you press it: its parent, or the Quotes screen for a
  // standalone quote, which has no parent to open.
  //
  // Returns null when there is nowhere to go — a standalone quote with the Quotes
  // section switched off. `onGoQuotes?.()` used to swallow that case, which left a
  // card wearing cursor:pointer and role="button" that answered a tap with
  // nothing. An absent control is honest; a dead one is not.
  const opener = (q) => {
    if (q.kind === 'book' && q.work_id) return () => onOpenBook?.(q.work_id)
    if (q.kind === 'screen' && q.work_id) return () => onOpenMovie?.(q.work_id)
    return onGoQuotes ? () => onGoQuotes() : null
  }

  // THE BUTTON DOES NOT MOVE WHEN YOU PRESS IT, which it used to.
  //
  // The two layouts below were chosen by `!today.length && !shuffled`, so pressing
  // Shuffle — which sets `shuffled` — flipped the centred form to the left-aligned
  // one and the button jumped sideways under the reader's own thumb. On a phone
  // that is the whole width of the screen away from where they tapped.
  //
  // The layout now depends only on what was on the page when it loaded. `shuffled`
  // still decides whether a CARD appears; it no longer decides where the control
  // that produced it lives. A control that moves as a result of being used is
  // telling the reader they missed.
  const shuffleButton = (
    <Tooltip label={t('home.shuffle.tip')}>
      <GhostButton icon={<IconShuffle />} keepLabel onClick={shuffle} disabled={busy}>
        {t('home.shuffle.label')}
      </GhostButton>
    </Tooltip>
  )

  // Nothing from this date in another year: the button is the only thing here, so
  // it sits in the middle and reads as an invitation rather than as a heading.
  if (!today.length) {
    return (
      <section className="space-y-3">
        <div className="flex justify-center">{shuffleButton}</div>
        {shuffled && <SerendipityCard q={shuffled} onOpen={opener(shuffled)} people={people} seps={seps} onOpenPerson={onOpenPerson} actions={actions} />}
      </section>
    )
  }
  // With cards above it, the same button earns its rule: it separates what the date
  // gave you from what chance did.
  return (
    <section className="space-y-3">
      {today.length > 0 && (
        <>
          <MonoLabel className="block">{t('home.onthisday.title', { n: today.length })}</MonoLabel>
          <div className="space-y-2">
            {today.slice(0, 3).map((q) => (
              <SerendipityCard key={`${q.kind}${q.id}`} q={q} onOpen={opener(q)} people={people} seps={seps} onOpenPerson={onOpenPerson} actions={actions} />
            ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        {shuffleButton}
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>
      {shuffled && <SerendipityCard q={shuffled} onOpen={opener(shuffled)} people={people} seps={seps} onOpenPerson={onOpenPerson} actions={actions} />}
    </section>
  )
}

// MEDIA_BADGE — what the strip along the top of a serendipity card says. The
// three screen kinds name themselves; a book and a standalone quote wear the same
// badge their favourite tile does, so one quote reads the same on both boards.
const MEDIA_BADGE = {
  movie: 'common.badge.film',
  show: 'common.badge.show',
  game: 'common.badge.game',
  book: 'common.badge.book',
  quote: 'common.badge.quote',
}

// SerendipityCard — one shuffled or on-this-day quote, drawn the way this app
// draws a quote everywhere else.
//
// IT USED TO BE THE PLAINEST CARD IN THE APP: the words, a colour bar, and a
// title-and-credit line in small caps. No cover, no faces, no tags, nothing to do
// with the line but read it — on the one surface whose entire job is to make you
// glad you kept something. The owner's report was exact: "devoid of even chips and
// character names".
//
// So it now carries what a favourite tile carries, from the same components: the
// cover or poster of where the line came from, the credited people as faces you
// can click through to, its tags, and the standard quote row — copy · share, then
// the overflow — built by the same registry, in the same order, as every other
// quote surface. Two things it does NOT copy from FavouriteTile: there is no
// expand/collapse (there is one card, so nothing to save room for) and no edit
// form (this is a reading surface, and the card knows where the quote lives).
//
// THE CHARACTER, NOT JUST THE ACTOR. The old line printed `credit`, which for a
// film is who ACTED. A reader looking at a line from Casablanca wants Rick Blaine
// first and Humphrey Bogart second, and the row had no field for the former.
function SerendipityCard({ q, onOpen, people = {}, seps, onOpenPerson, actions }) {
  const kind = FAV_KINDS[q.kind]
  const [hearted, setHearted] = useState(!!q.favorite)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setHearted(!!q.favorite) }, [q])

  // Split on the reader's own credit separators (§11), so "Gaiman & Pratchett" is
  // two people with two portraits rather than one chip nobody is.
  const names = splitCredits(q.credit, seps)
  const map = people[kind.personKind] || {}
  const year = formatYear(q.year)
  // The work, its year, and — on a film line — who says it. A standalone quote's
  // `title` IS its occasion, which is the same role in a different shape.
  const source = [q.title, year, q.character].filter(Boolean).join(' · ')

  // Copy · share · ♥, from the registry rather than spelled out here, so this card
  // cannot end up with the row in a different order from the Library's. Each is
  // available only if the handler is, which is how this card gets the same row
  // minus the two (edit, delete) it deliberately does not offer.
  const acts = actions
    ? actionsFor(kind.actionKind, q, {
      copy: () => actions.copy(q),
      share: () => actions.share(q),
      favourite: async () => {
        if (busy) return
        setBusy(true)
        // Optimistic, the same trick the favourite tiles use: the heart paints
        // the instant it is pressed and rolls back if the write failed.
        setHearted((v) => !v)
        if ((await actions.favourite(q, !hearted)) === false) setHearted((v) => !v)
        setBusy(false)
      },
      favourited: hearted,
    })
    : []

  const openLabel = t(`home.favourites.open.${q.kind === 'book' ? 'book' : q.kind === 'quote' ? 'quotes' : q.media_type === 'show' ? 'show' : 'film'}.aria`)
  // The cover is a doorway when there is somewhere to go and a picture when there
  // is not — a standalone quote has no work behind it, and a button that answers
  // a tap with nothing is worse than no button.
  const art = q.cover_path
    ? <img src={coverImgURL(q.cover_path)} alt="" className="block w-14 object-cover" style={{ aspectRatio: '2 / 3', borderRadius: 6, border: '1px solid var(--ink-border)' }} />
    : <Placeholder kind={t(MEDIA_BADGE[q.media_type] || 'common.badge.cover')} className="w-14" style={{ aspectRatio: '2 / 3', borderRadius: 6 }} />

  return (
    <HandCard colorBar={q.color || 'yellow'} style={{ padding: '12px 15px' }}>
      <div className="flex gap-3.5">
        <div className="shrink-0">
          {onOpen ? (
            <Tooltip label={openLabel}>
              <button type="button" onClick={onOpen} aria-label={openLabel} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                {art}
              </button>
            </Tooltip>
          ) : art}
        </div>
        <div className="min-w-0 flex-1">
          <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: kind.labelColor }}>
            {t(MEDIA_BADGE[q.media_type] || MEDIA_BADGE[q.kind])}
          </MonoLabel>
          {/* The words. Only the quote opens the parent — the faces and the tags
              below are their own targets, so they sit outside this button. */}
          <button
            type="button"
            onClick={onOpen || undefined}
            className={`block w-full text-left${onOpen ? '' : ' cursor-default'}`}
            style={{ background: 'none', border: 'none', padding: 0 }}
            tabIndex={onOpen ? 0 : -1}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>
              {kind.quoted ? `“${q.quote}”` : q.quote}
            </p>
          </button>
          {/* THE SOURCE LINE CARRIES NO FACES, and it used to carry all of them.
              An overlapping portrait cluster sat here as well as the
              PersonCredit row below, and PersonCredit is a portrait AND the
              name — so every credited person was drawn twice, once anonymously
              in a stack and again underneath with their name on. On a two-hander
              like Roman Holiday that is four faces for two actors.

              The cluster is the right thing on a COLLAPSED surface, where there
              is no room for names: that is what the favourite tile a few hundred
              lines up uses it for, and why the import is still needed. Here
              there is room, the names are the point, and one face each is the
              answer. (Named obliquely on purpose — the test that pins this
              scans this function's source for the component's name.) */}
          <MonoLabel className="mt-1.5 block" style={{ fontSize: 'var(--type-ui-11)' }}>{source}</MonoLabel>
          {names.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {names.map((n) => (
                <PersonCredit key={n} kind={kind.personKind} name={n} person={map[n]} size={22} onOpen={onOpenPerson} />
              ))}
            </div>
          )}
          {q.tags && q.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.tags.map((tag) => <span key={tag} className="tp-chip">{tag}</span>)}
            </div>
          )}
          {acts.length > 0 && (
            <div className="mt-2 flex items-center gap-x-3">
              <QuoteTools actions={atRow(acts)} />
              <span className="ml-auto flex items-center">
                <QuoteActions actions={atOverflow(acts)} />
              </span>
            </div>
          )}
        </div>
      </div>
    </HandCard>
  )
}
