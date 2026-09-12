// Where the facts about a work come from: the keys, and the two settings that
// decide what a lookup's answer means.
//
// IT WAS A CARD ON THE SETTINGS PAGE, and the owner moved it: "the metadata
// sources section will land here from settings as well." The argument is the one
// the card's own comments were already making without following. Everything on it
// — eight keys, a Google fallback, the separators that split "Gaiman & Pratchett",
// the mark a proverb wears where a credit would go — configures the screen it was
// two clicks away from. A reader looking at a book with no cover and a filter
// called "no source" had to leave the console, find a settings card, and come back
// to press Fetch.
//
// It is also the tallest thing Settings had — 780px of a page whose layout is
// balanced by measurement — so moving it is not only a regrouping. See
// SETTINGS_LAYOUT, which is rebalanced in the same commit and says so.
//
// NOTHING IN HERE CHANGED IN THE MOVE. The keys, the chips, the need labels, the
// IGDB half-pair warning, the separators and the language-marks door are the same
// components with the same copy; what changed is the screen they are on. A move
// that also rewrites is a move nobody can review.

import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { placeholderFor, t } from './i18n.js'
import {
  Card,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  GhostButton,
  IconCheck,
  IconChevron,
  IconClose,
  IconEdit,
  IconLanguages,
  IconPlus,
  IconRevert,
  InfoDot,
  MonoLabel,
  SectionTitle,
  Slider,
  SourceIcon,
  toast,
  Toggle,
  Tooltip,
} from './ui.jsx'
import {
  applyLanguageMarks,
  currentLanguageEntries,
  LANGUAGE_NAME_MAX_RUNES,
  languageMarksBlob,
  languageMarksState,
  LanguageMark,
  MARK_MAX_RUNES,
  MAX_CUSTOM_MARKS,
} from './languages.jsx'
import { TEXT_ORDERS, TEXT_ORDER_DEFAULT, TEXT_ORDER_WORD, masterIsCustom } from './textOrder.js'
import { textOrderFrom } from './textOrderHost.jsx'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'

// StatusChip came with the block: after the move Settings had no other caller for
// it, and a component left behind in the file that stopped using it is the shape
// of thing nobody deletes. IconSaved came the same way and HAS now been deleted,
// on that reasoning: the green mark says "stored" and a floppy disc beside it
// said it twice.
// StatusChip — small mono pill; tone drives the palette (§2 chips). Four callers
// left, all of them the status row under the heading; the per-key rows draw their
// state on the supplier's mark instead.
function StatusChip({ tone = 'muted', children }) {
  const tones = {
    active: { color: 'var(--accent-ui)', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', bd: 'color-mix(in srgb, var(--accent) 45%, transparent)' },
    ok: { color: 'var(--accent-ui)', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', bd: 'color-mix(in srgb, var(--accent) 45%, transparent)' },
    error: { color: 'var(--error)', bg: 'color-mix(in srgb, var(--error) 14%, transparent)', bd: 'color-mix(in srgb, var(--error) 50%, transparent)' },
    muted: { color: 'var(--faint)', bg: 'var(--raised)', bd: 'var(--line)' },
  }
  const skin = tones[tone] || tones.muted
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', fontVariantNumeric: 'var(--font-mono-figures)',
        fontSize: 'var(--type-mono-11)',
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: skin.color,
        background: skin.bg,
        border: `1px solid ${skin.bd}`,
        borderRadius: 5,
        padding: '3px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}


// NEED_TONE AND NEED_LABEL WERE HERE and went with the chip they painted. The
// four consequence words survive — SRC_STATE_WORD in ui.jsx and KEY_STATES below
// both name them, by literal key for the reason the deleted note gave: a key
// assembled at runtime defeats locale-complete.test.js in both directions.
//
// `settings.keys.need.closed.label` went too, and it is the one real deletion.
// NEED_LABEL was its only reader, no row has ever passed `need="closed"`, and it
// is not one of the four colours — so keeping the string would have left an
// orphan the locale test counts and nothing that could ever render it.

// keyState — the owner's scheme: "green is saved, yellow is not saved but
// optional, red is needed and not saved. purple is using the pre-built."
//
// SAVED WINS OVER BUILT-IN, and that ordering is the whole subtlety. A reader who
// has given TMDB their own key is not "using the pre-built" any more, even though
// the app still ships one — so the purple state is specifically "nothing of yours
// here, and something of ours is answering", which is a fact about right now
// rather than about the field.
//
// `closed` returns null deliberately. It is a fifth `need` (a supplier that has
// stopped issuing keys), no row passes it today, and it is not one of the four
// colours — a mark with no state draws in the row's own ink, which is the honest
// answer for a field whose key state is not the interesting thing about it.
const keyState = (saved, need) =>
  saved ? 'saved'
    : need === 'bundled' ? 'builtin'
      : need === 'required' ? 'needed'
        : need === 'optional' ? 'optional'
          : null

// The legend's four rows, in the order a reader meets them: the two that need
// nothing from you, then the two that do. LITERAL KEYS, as above.
const KEY_STATES = [
  ['saved', 'settings.keys.saved.tip'],
  ['builtin', 'settings.keys.need.bundled.label'],
  ['optional', 'settings.keys.need.optional.label'],
  ['needed', 'settings.keys.need.required.label'],
]

// THE AMAZON MARKETPLACE, AS THE TWO LETTERS THAT DIFFER.
//
// THE OWNER: "for amazon domain, just use the in, com, au, etc., not the full url.
// that takes space." They are right about the space and right about the content:
// every marketplace host is `www.amazon.` plus a suffix, so the prefix is eleven
// characters of the same eleven characters on every install. This row already had
// the worst width on the card — its own note records the label breaking mid-word
// into "AMA / ZON / DOM / AIN" with `www.amazon.in` coming down the screen two
// characters at a time.
//
// THE COLUMN STILL HOLDS A HOST, and that is deliberate rather than lazy.
// `FetchAmazonBook` builds `https://<domain>/dp/<asin>` and defaults to
// `www.amazon.com`; a stored suffix would mean the server composing a hostname
// from a fragment, and every existing install's value would need migrating. So
// the SCREEN speaks suffixes and the wire keeps speaking hosts, which is one
// transform in one place rather than a data change reaching two layers.
//
// AND IT TAKES WHATEVER IS PASTED. `in`, `amazon.in`, `www.amazon.in` and
// `https://www.amazon.in/` all mean the same marketplace, and a reader who has
// just copied their address bar should not be told off. Same forgiveness the IMDb
// id field already extends for the same reason.
export function amazonSuffix(host) {
  const h = String(host || '').trim().toLowerCase()
  if (!h) return ''
  const m = h.match(/amazon\.([a-z.]+)/)
  return m ? m[1].replace(/\/$/, '') : h.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

export function amazonHost(typed) {
  const suffix = amazonSuffix(typed)
  return suffix ? 'www.amazon.' + suffix : ''
}

function KeyField({ label, hint, set, placeholder, secret = true, value = '', onSave, busy, need, source }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(secret ? '' : value)
  useEffect(() => { if (!editing) setDraft(secret ? '' : value) }, [value, editing, secret])

  async function commit() {
    const ok = await onSave(draft)
    if (ok) setEditing(false)
  }

  const saved = secret ? !!set : !!value

  return (
    <div className="inline-field">
      <div className={'inline-field-head' + (editing ? '' : ' is-flush')}>
        {/* THE SUPPLIER'S OWN MARK, beside the key it unlocks.
            
            The app draws one per supplier and has since they were added — a match
            row wears it, and so does the tag saying which supplier wrote a field.
            THIS screen, which is where a reader meets a supplier for the first
            time and decides whether to give it a key, wore none: so the mark on
            that later match row was a picture nobody had been introduced to, and
            the owner's report was that the marks were missing from "the metadata
            fetch sections". They were missing from the place that names the
            fetchers. */}
        {source ? <SourceIcon source={source} side="right" state={keyState(saved, need)} stateOf={label} /> : null}
        <MonoLabel>{label}</MonoLabel>
        {/* WHAT FILLING THIS IN ACTUALLY BUYS, said before the reader goes and
            registers for anything.

            The card listed nine credential fields in one flat run and told you
            nothing about which of them you NEED. Two of them ship with the app and
            a key there only replaces what is already working; one pair is the
            difference between games working and not; the rest are optional
            improvements to something that already answers. A reader looking at
            that list reasonably concludes the app needs nine API registrations
            before it is useful, and most of them are not obtainable in five
            minutes.

            So each row says which it is, before the label's own tooltip has to be
            opened. The wording is about CONSEQUENCE and not about status — "built
            in" rather than "configured" — because the question being answered is
            "must I do something about this".

            AND IT IS NO LONGER A WORD IN THE ROW; IT IS THE COLOUR OF THE MARK.
            The owner's: "the optional tag is probably better indicated via an icon
            or a border on the provider icon", then the scheme itself — green
            saved, yellow optional and unsaved, red needed and unsaved, purple
            using the pre-built. What forced it is width. This row is a flex line
            holding a mark, a mono label, this chip, an info dot, the value, a
            spacer and two buttons; at 390px there was no room left and the LABEL
            gave way, breaking mid-word — "AMA / ZON / DOM / AIN", with
            www.amazon.in coming down the screen two characters at a time. A fact
            about the row moved onto the thing the row already draws, and the
            words moved to the legend above, which says all four at once instead
            of one per row seven times.

            The saved badge went the same way and for the same reason: a floppy
            disc with a tick, one more control saying one more word, when green
            already says it. */}
        {hint && <InfoDot text={hint} title={label} />}
        {!secret && !editing && (
          <span className={'inline-field-inline' + (value ? '' : ' is-empty')}>{value || t('settings.keys.unset.label')}</span>
        )}
        <span className="flex-1" />
        {!editing ? (
          <FieldIconButton
            icon={<IconEdit />}
            ariaLabel={t(set ? 'settings.keys.replace.aria' : 'settings.keys.add.aria', { name: label })}
            onClick={() => setEditing(true)}
          />
        ) : (
          <>
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={t('common.action.save.field.aria', { field: label })}
              disabled={busy}
              onClick={commit}
              tooltip={draft.trim() ? t('common.action.save.label') : t('settings.keys.save.blank.tip')}
              ok
            />
            <FieldIconButton
              icon={<IconClose />}
              ariaLabel={t('common.action.cancel.label')}
              disabled={busy}
              onClick={() => { setEditing(false); setDraft(secret ? '' : value) }}
            />
          </>
        )}
      </div>
      {editing && (
        <input
          className="tp-input"
          placeholder={placeholder}
          value={draft}
          autoFocus
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setDraft(secret ? '' : value) }
          }}
        />
      )}
    </div>
  )
}

// keyLabel composes a field's name out of the supplier and the noun beside it:
// "Google Books key", "IGDB client id", "Amazon domain". The supplier names are
// PROPER NOUNS and already live in vocab.source.*, so seven hardcoded labels
// would be seven more copies of a word the app spells in a dozen other places.
// Called during render, never at module scope.
// THE SUPPLIER'S OWN NAME, or the raw slug when the app has never named it.
//
// A FALLBACK RATHER THAN A MISSING KEY, because the fault list is open-ended by
// design: a rung added to the picture ladder tomorrow records itself here the moment
// it runs, and a card that drew "settings.metadata.source.wikiquote.label" would be
// worse than one that drew "wikiquote". The list is a report about the server, and a
// report that refuses to name a supplier it has never heard of is not a report.
const sourceName = (slug) => {
  const key = `vocab.source.${slug}.label`
  const named = t(key)
  // `t` DOES NOT RETURN THE KEY FOR A MISSING STRING — it returns
  // placeholderFor(key), which is the last segment title-cased, so every unnamed
  // supplier would draw the word "Label". Comparing against that function is how a
  // caller recognises the placeholder, which is what it is exported for; comparing
  // against the key is the mistake this line was written with first, and it fails
  // silently because the comparison is simply never true.
  return named === placeholderFor(key) ? slug : named
}

// The fault cause's own line. Same face and colour as the `last-error` prose under
// it — they are the same kind of sentence and were drawn identically before this
// list existed, so the shared constant is the rule rather than a tidy-up.
const FAULT_PROSE = {
  fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)',
  fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)',
  fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', color: 'var(--error)',
}

const keyLabel = (source, noun) =>
  t('settings.keys.field.label', {
    source: t(`vocab.source.${source}.label`),
    noun: t(`settings.keys.noun.${noun}`),
  })

export function MetadataSources({ user, onPreferences }) {
  const admin = user.is_admin
  const [marksOpen, setMarksOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [keys, setKeys] = useState(null) // {tmdb_key_set, google_books_key_set, amazon_cookie_set, amazon_domain}
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadStatus() {
    const r = await json('GET', '/metadata/status')
    if (r.ok) setStatus(r.data)
  }
  async function loadKeys() {
    const r = await json('GET', '/admin/metadata-keys')
    if (r.ok) setKeys(r.data)
  }
  useEffect(() => {
    loadStatus()
    if (admin) loadKeys()
  }, [admin])

  const source = status?.tmdb?.source
  const lookup = status?.books_lookup
  // NO CHIP FOR "WORKING", AND NONE FOR "NOT YET TRIED" EITHER. A green OK under
  // the heading is a pill that appears when there is nothing to tell you and
  // vanishes the moment there is — the reader learns to read it, and then it is
  // gone exactly when they need it. "Untested" (1.15.2) was the same pill in a
  // duller colour: `books_lookup.ok` is null until the first lookup of the
  // server's life, so a freshly started instance greeted every admin with a word
  // that sounds like a warning, describes no fault, and clears itself the moment
  // anybody uses the app. Nothing was ever wrong and there was nothing to do.
  // Silence is the healthy state; a chip here means something to act on.
  // Tone, then the KEY that names it — resolved where the chip is drawn.
  const booksChip = lookup?.ok === false ? ['error', 'settings.metadata.books.failing.label'] : null
  // A CHIP ONLY WHERE THE KEY FIELDS CANNOT ANSWER. "Custom key" beside TMDB
  // said exactly what the saved badge on the TMDB field says one line below it,
  // and "No key (optional)" beside TheTVDB said nothing at all — an optional key
  // you have not set is the ordinary state of the app, not a status worth a pill.
  // What survived that cut was a PAIR — lookups running on the shared built-in
  // key even though you have set nothing, and lookups running on nothing at all
  // — and it is a single chip now.
  //
  // THE BUILT-IN BRANCH IS GONE, on the owner's ruling: "remove the built in key
  // callouts… infact, remove all callouts." What survives is the FAULT — no key at
  // all, so a lookup will 503 — because this section's own rule is that silence is
  // the healthy state and a chip means something to act on. "You are running on the
  // shared key" is not something to act on; "nothing will answer" is.
  const tmdbChip = source === 'none' ? ['error', 'settings.metadata.tmdb.none.label'] : null
  // EVERY OTHER SOURCE THAT IS ACTUALLY BROKEN, composed by the server because the
  // thing that turns a zero into a fault is a RUN and a run is only visible to
  // whatever saw every attempt. A client sees one page load.
  const faults = status?.faults || []
  // TheTVDB HAD A BUILT-IN CHIP AND NOW HAS NONE. It only ever reported the
  // built-in case — it had no fault branch, because an unset optional key is the
  // ordinary state of a self-built binary — so removing the callout removes the
  // chip entirely rather than narrowing it.

  // THE FILM-SOURCE NOTICE IS GONE, AND SO IS THE DEFAULT IT ANNOUNCED.
  //
  // THE OWNER: "remove the still on tmdb callout. infact, remove all callouts. we
  // are simultaneously checking all metadata sources on a fetch (if not, we
  // should) so the TVDB default prose is useless too."
  //
  // CHECKED BEFORE CUTTING, because the sentence rests on it: reverifyMovie
  // fetches EVERY source a title has an id for — TheTVDB, then TMDB, then the
  // keyless rungs — and appends each answer. `preferredSourceFor` decides only
  // which one LEADS and which namespace a person id belongs to. So a reader
  // "still on TMDB" is not missing anything a re-verify would not already offer
  // them, and the notice was asking them to act on a distinction the fetch does
  // not make.
  //
  // `status.film_source_notice` STILL ARRIVES and is simply not read. Removing
  // the server's marker is a separate decision about a one-time pass's leftovers,
  // and doing it in the same breath as a screen change would be two changes
  // wearing one reason.

  // saveKey writes exactly one field. The endpoint decodes every key as a
  // pointer, so an omitted field is left alone and a present-but-empty one is
  // cleared — which is what makes a per-field save correct here rather than a
  // convenience that quietly wipes its neighbours. Secrets are write-only: GET
  // reports only whether each is set, never the value.
  async function saveKey(field, value) {
    setSaving(true)
    setError('')
    const r = await json('PUT', '/admin/metadata-keys', { [field]: value.trim() })
    setSaving(false)
    if (!r.ok) {
      setError(errText(r, t('error.save.generic')))
      return false
    }
    await Promise.all([loadStatus(), loadKeys()])
    toast(value.trim() ? t('common.toast.saved') : t('settings.keys.toast.cleared'))
    return true
  }

  return (
    // TWO COLUMNS ON A DESK, ONE ON A PHONE, AND THE CARDS DECIDE WHERE THEY BREAK.
    //
    // The owner's: "desktop view: two column masonry". A console whose cards are a
    // six-row key list, a four-chip footnote and (after the language work) a door is
    // three boxes of wildly different heights — a grid would pad the short ones out
    // to the tall one's height, which is a column of whitespace where the reader is
    // looking for the next thing. Multicol packs them.
    //
    // `.meta-columns` is CSS and not a component on purpose: what is actually being
    // said is "these siblings flow", and a wrapper component would be a new name for
    // `display`. See index.css for why the breakpoint is 900px — it is the width at
    // which THIS screen's rail already stops being a phone's.
    <div className="meta-columns">
    <Card data-tour="metadata-keys">
      <SectionTitle info={t('settings.metadata.info.body')}>
        {t('settings.metadata.title')}
      </SectionTitle>

      {/* WHAT THE COLOUR OF EACH SUPPLIER'S MARK MEANS.
          The owner's, correcting where this was going to live: "not infodot, use a
          row to explain the colours." A legend behind a tap is a legend nobody
          opens, and the whole point of moving four words out of seven rows was to
          say them once — hiding them would have said them zero times.
          It reads as one line on a desk and wraps to two on a phone. */}
      <div className="src-legend">
        <MonoLabel>{t('settings.keys.legend.label')}</MonoLabel>
        {KEY_STATES.map(([state, word]) => (
          <span className="src-legend-item" key={state}>
            <span className={`src-legend-dot is-src-${state}`} aria-hidden="true" />
            <span>{t(word)}</span>
          </span>
        ))}
      </div>

      {/* No per-source headings. 1.7.2 took away the feature descriptions that
          sat under them ("Books: Google Books + Open Library"), which left three
          MonoLabels each introducing a single field that already names itself —
          "Books" above "Google Books key" is the same word twice.

          What the headings were genuinely carrying is the STATUS: whether
          lookups work at all right now, which no key field can report, because
          a key field only knows whether it is filled. So the chips move up into
          one row and the headings go.

          The chips travel ALONE. Each used to carry its own InfoDot, and two
          dots side by side are not two explanations, they are a puzzle about
          which one answers you; both blurbs are in the heading's dot now, which
          is where a reader looks for what a section is.

          The row itself goes when both chips do: an empty flex box under the
          heading is a gap that reads as a missing element rather than as
          nothing to report. */}
      {/* TWO CHIPS LEFT OF THE OLD ONES, AND BOTH ARE FAULTS. The three that went
          were notices — two built-in-key ones and the moved-default one. These two
          report that something will not answer: lookups are failing, or there is no
          key at all and a lookup will 503. That is this section's own rule kept
          rather than an exception to the owner's: "silence is the healthy state; a
          chip here means something to act on."

          AND THE SERVER'S OWN FAULT LIST JOINS THEM, which is the owner's next ask
          on the same screen: "those two cannot be the only metadata faults. add all
          kinds of faults there." Every supplier the app asks — the film and game
          lookups, and each rung of the picture ladder — now records what it last
          did, and the ones that are broken arrive here. See metadata_faults.go for
          why a RUN of empty answers is a fault and a single one never is.

          ONE ROW, NOT TWO. A second strip under the first would be two places to
          look for the same kind of news, and the older chips are faults by the same
          definition — they are simply the two the server always knew. */}
      {(booksChip || tmdbChip || faults.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {booksChip && <StatusChip tone={booksChip[0]}>{t(booksChip[1])}</StatusChip>}
          {tmdbChip && <StatusChip tone={tmdbChip[0]}>{t(tmdbChip[1])}</StatusChip>}
          {faults.map((f) => (
            <StatusChip key={f.area + '/' + f.source} tone="error">
              {t(`settings.metadata.fault.${f.kind === 'error' ? 'failing' : 'empty'}.label`, {
                source: sourceName(f.source),
                area: t(`settings.metadata.area.${f.area}.label`),
              })}
            </StatusChip>
          ))}
        </div>
      )}
      {/* WHAT EACH FAULT ACTUALLY SAID, under the chips rather than inside them. A
          chip is a name and a verdict; the cause is a sentence, and a sentence in a
          pill is a pill that wraps to four lines on a phone.

          THE CAUSE IS THE SOURCE'S OWN WORDS AND IS NOT TRANSLATED, which the
          `last-error` line below has always done for the same reason: a provider's
          error text arrives in whatever language the provider chose, and the frame
          around it is what this app is responsible for. The scrape's reasons are
          written to read as English sentences because they are the ones a reader is
          most likely to act on — a consent page and a rate limit are both things to
          do something about. */}
      {faults.filter((f) => f.error || f.note).map((f) => (
        <p key={f.area + '/' + f.source} className="mt-1" style={FAULT_PROSE}>
          {t('settings.metadata.fault.why.prose', {
            source: sourceName(f.source),
            why: f.error || f.note,
          })}
        </p>
      ))}
      {lookup?.ok === false && lookup.error && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', color: 'var(--error)' }}>
          {t('settings.metadata.last-error.prose', { error: lookup.error })}
        </p>
      )}

      {/* One flat list. Every field says which service it is for, so grouping
          them added a heading and two rows of air per group and no meaning. */}
      {admin && (
        <div className="mt-3">
          <KeyField
            label={keyLabel('google', 'key')}
            source="google"
            hint={t('settings.keys.google.hint')}
              need="optional"
            set={keys?.google_books_key_set}
            placeholder={t('settings.keys.google.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('google_books_key', v)}
          />
          <KeyField
            label={keyLabel('tmdb', 'key')}
            source="tmdb"
            hint={t('settings.keys.tmdb.hint')}
              need={keys?.tmdb_builtin ? 'bundled' : 'required'}
            set={keys?.tmdb_key_set}
            placeholder={t('settings.keys.tmdb.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tmdb_key', v)}
          />
          {/* THE KEY FIRST AND THE PIN UNDER IT, which is both the order they
              are needed in and the order the copy has always claimed.

              THE PIN WAS ON TOP, so the first TheTVDB thing on the card was a
              SUBSCRIBER PIN — and the reader's reasonable conclusion is that
              TheTVDB wants a subscription. It does not: a project key, which is
              the kind bundled with the app and the kind Jellyfin ships,
              authenticates on its own and never sends a pin at all (see login()
              in tvdb.go, which omits the field when it is empty). Only the free
              user-supported key needs one.

              The hint on the key row said "the PIN below" while the PIN sat
              above it, so the copy was already describing this arrangement and
              the fields were the thing that was wrong. */}
          <KeyField
            label={keyLabel('tvdb', 'key')}
            source="tvdb"
            hint={t('settings.keys.tvdb.hint')}
              need={keys?.tvdb_builtin ? 'bundled' : 'required'}
            set={keys?.tvdb_key_set}
            placeholder={t('settings.keys.tvdb.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tvdb_key', v)}
          />
          <KeyField
            label={keyLabel('tvdb', 'pin')}
            source="tvdb"
            hint={t('settings.keys.tvdb-pin.hint')}
              need="optional"
            set={keys?.tvdb_pin_set}
            placeholder={t('settings.keys.tvdb-pin.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tvdb_pin', v)}
          />
          {/* IGDB IS A PAIR, AND BOTH HALVES GET A ROW. The endpoint has
              accepted these since 1.15.1 and reports the two halves separately —
              its comment says "so the Settings card can point at the half that is
              missing" — but the rows themselves never landed, so the Add sheet
              told you to configure a key on a screen with no field for it, and a
              game lookup 503'd with nowhere to go. There is no built-in fallback
              here as there is for TMDB: IGDB credentials are per-application and
              rate-limited, so a shared key would be a shared quota.

              Write-only like the other secrets. A client id is not secret on its
              own, but it is stored beside its partner and never echoed, so there
              is no value to pre-fill and the saved badge is the whole answer. */}
          <KeyField
            label={keyLabel('igdb', 'client-id')}
            source="igdb"
            hint={t('settings.keys.igdb-id.hint')}
              need="required"
            set={keys?.igdb_client_id_set}
            placeholder={t('settings.keys.igdb-id.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('igdb_client_id', v)}
          />
          <KeyField
            label={keyLabel('igdb', 'secret')}
            source="igdb"
            hint={t('settings.keys.igdb-secret.hint')}
              need="required"
            set={keys?.igdb_secret_set}
            placeholder={t('settings.keys.igdb-secret.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('igdb_secret', v)}
          />
          {/* THE ONE IGDB STATE WORTH INTERRUPTING FOR, and the reason the server
              reports the halves separately rather than as one igdb_key_set.
              Neither set is the ordinary state of an instance with no games in
              it, and a chip for that would be the "Untested" mistake again. Half
              a pair is different: it fails at the Twitch token exchange with
              "invalid client", which surfaces as a lookup failure, so the reader
              is told games are broken when the truth is that one field is blank. */}
          {keys && (!!keys.igdb_client_id_set !== !!keys.igdb_secret_set) && (
            <p className="microcopy mt-1" style={{ color: 'var(--error)' }}>
              {t('settings.metadata.igdb.half.prose', {
                half: t(keys.igdb_client_id_set ? 'settings.keys.noun.secret' : 'settings.keys.noun.client-id'),
              })}
            </p>
          )}
        </div>
      )}

      {/* Amazon (advanced): cover-by-ASIN needs nothing; the optional cookie
          adds description/genres by scraping the product page. */}
      {admin && (
        <div>
          <div>
            {/* .caveat, NOT .hint, and deliberately: this one runs to 440
                characters and the 240-character dot budget measures .hint in both
                languages. It is a security warning with a procedure in it —
                fragile, against Amazon's terms, grants account access, and here
                is where the header is — and none of those clauses can be dropped
                to fit a cap. So it is named for what it is. */}
            <KeyField
              label={keyLabel('amazon', 'cookie')}
              source="amazon"
              hint={t('settings.keys.amazon-cookie.caveat')}
              need="optional"
              set={keys?.amazon_cookie_set}
              placeholder={t('settings.keys.amazon-cookie.placeholder')}
              busy={saving}
              onSave={(v) => saveKey('amazon_cookie', v)}
            />
            {/* GOOGLE'S PROGRAMMABLE SEARCH PAIR STOOD HERE. Google closed that
                API to new customers and retires it on 1 January 2027, so the two
                fields asked readers to register for something they could not get
                and would then lose. What is left of Google is the scrape toggle,
                which needs no credential at all — which is why it is a setting
                rather than a key, and why it is no longer in this block: it now
                sits under every key on the card. See it below. */}
            <KeyField
              label={keyLabel('amazon', 'domain')}
              source="amazon"
              hint={t('settings.keys.amazon-domain.hint')}
              need="optional"
              secret={false}
              // THE SUFFIX IN AND THE HOST OUT — see amazonSuffix above for why the
              // screen and the wire speak different halves of the same name.
              value={amazonSuffix(keys?.amazon_domain)}
              set={!!keys?.amazon_domain}
              placeholder={t('settings.keys.amazon-domain.placeholder')}
              busy={saving}
              onSave={(v) => saveKey('amazon_domain', amazonHost(v))}
            />
          </div>
        </div>
      )}

      {/* THE SCRAPE'S OPT-IN, LAST, AND THE ONLY CONTROL ON THIS CARD THAT IS NOT
          A CREDENTIAL.

          Every other switch here is implicit in a secret: you cannot use the Amazon
          scrape without storing the cookie that says you meant to, so the key field
          IS the consent. Scraping Google's image results needs nothing at all, which
          leaves the consent with nowhere to live — hence a setting, and hence a
          control, because a setting with no control is a feature nobody can reach.

          WHY IT MOVED TO THE BOTTOM. The owner's: "the read google results directly:
          shorten the header and put it at the bottom." It was buried between Amazon's
          cookie and Amazon's marketplace, inside a block headed by a security warning
          about a different supplier — which read as a third Amazon field. It is not
          Amazon's and it is not a key: it is the last rung of the ladder every kind of
          lookup falls to, so it belongs under all of them rather than inside one.

          STILL BEHIND `admin`, and it has to be: the write is PUT /admin/metadata-keys
          and the requests it authorises come from THIS SERVER, so it is an instance
          decision rather than a reader's. Lifting it out of the Amazon block meant
          lifting it out of that block's own guard, which is the half a move like this
          loses silently — the control would have drawn for everybody and 403'd on
          press. */}
      {admin && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5">
            {/* SHORT ON THE PAGE, WHOLE IN THE ACCESSIBLE NAME. "Google image
                results" is what the row is about; "Read Google image results
                directly" is what pressing it means, and a toggle answering yes/no
                needs the verb in its name where a heading beside it does not. The
                visible words are a prefix of the accessible ones, which is what
                WCAG 2.5.3 asks and what lets somebody say the label out loud. */}
            <MonoLabel>{t('settings.keys.google-scrape.title')}</MonoLabel>
            <InfoDot text={t('settings.keys.google-scrape.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.keys.google-scrape.aria')}
            value={keys?.google_scrape ? 'on' : 'off'}
            onChange={async (v) => {
              setSaving(true)
              setError('')
              const r = await json('PUT', '/admin/metadata-keys', { google_scrape: v === 'on' })
              setSaving(false)
              if (!r.ok) { setError(errText(r, t('error.save.generic'))); return }
              await Promise.all([loadStatus(), loadKeys()])
              toast(t('common.toast.saved'))
            }}
            options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
          />
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {/* The door to Language marks, which hung off Appearance from 1.15.2
          until the reader moved it here.

          WHY IT BELONGS ON THIS CARD. Everything above is about where the facts
          about a work come from and what they are called. A language mark is the
          same kind of fact: a proverb has nobody to credit, so its card leads
          with its LANGUAGE, and the mark is that language's stand-in. Appearance
          decides how the app looks; this decides what a quote says about itself.
          The old argument — that what a proverb wears is a matter of appearance —
          was about the drawing rather than the datum.

          Still a door rather than a section, for the reason 1.15.2 gave: it is a
          row per language with a tray behind each, and standing that open on a
          page read at a glance is a column spent on a choice made once. Two
          sections deep on one card would also read as part of the credit
          separators above it, which it is not. */}
      <div className="mt-7 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <Tooltip label={t('settings.languages.open.tip')}>
          <GhostButton icon={<IconLanguages />} keepLabel onClick={() => setMarksOpen(true)}>{t('settings.languages.title')}</GhostButton>
        </Tooltip>
      </div>
    </Card>

      {/* A CARD OF ITS OWN NOW, on the owner's ruling: "multi author credits:
          separate card."

          IT WAS A FOOTNOTE BECAUSE THE PAGE WAS ONE COLUMN. The argument for
          keeping it inside — four chips and a label is not a subject, and a card
          with four chips claims the same share of a page as the keys every lookup
          runs on — was an argument about VERTICAL SPACE, and it stops applying the
          moment the cards pack into two columns: a short card beside a tall one
          costs nothing, and the thing it was buried under was six key fields and a
          security warning.

          AND IT IS A DIFFERENT QUESTION. Everything on the card above is "where do
          the facts come from"; this is "what does one of those facts MEAN" — a
          lookup hands back "Gaiman & Pratchett" as one string and this decides
          whether that is one person or two. */}
      <Card>
        <CreditSeparators user={user} onPreferences={onPreferences} />
      </Card>

      {/* IT IS NOT A COLUMN ITEM, whatever it looks like sitting here: FormModal
          returns null while closed and a portal while open, so it never takes part
          in this flow either way. Left inside the card above it would have read as
          part of the keys; here it sits beside the door that opens it. */}
      <FormModal open={marksOpen} onClose={() => setMarksOpen(false)} title={t('settings.languages.title')} maxWidth={560}>
        <LanguageMarksSettings prefs={user.preferences} onSaved={onPreferences} />
      </FormModal>
    </div>
  )
}

// CreditSeparators — which separators split a joined multi-author credit
// ("Gaiman & Pratchett") into distinct people, across group-by headings and
// the People console. Stored as the creditSeparators pref
// ("none" = splitting off). The author string stored on each book is never
// rewritten — only the people views split — so this is safe to flip freely.
// Chips show the bare symbol; the key doubles as the screen-reader name.
//
// A SECTION OF THE METADATA CARD, not a card of its own. Four chips and a label
// is not a subject; it is a footnote to one, and the subject is the card it now
// sits at the bottom of. A lookup returns "Gaiman & Pratchett" as one string and
// this decides whether that is one person or two, so the question only arises
// because of the sources above it — and a card with four chips in it was
// claiming the same share of a settings page as the keys every lookup runs on.
// Three columns now: the stored token, the SYMBOL the chip draws, and the key
// that names it aloud. The symbol is not copy — it is the character the splitter
// matches, and “and” is the English word an author line actually contains, so
// translating either would name a separator nothing splits on. The screen-reader
// name IS copy, and it used to be the stored token read out raw.
// Three columns, and the middle one is now a KEY like the third. The symbol is
// still not copy — its value is the same in every language — but it goes through
// the resolver so the pseudo-locale gate can see it, rather than standing on the
// screen as the one untokenised string on the card.
const CREDIT_SEP_OPTIONS = [
  ['comma', 'settings.credits.sep.comma.symbol', 'settings.credits.sep.comma.aria'],
  ['semicolon', 'settings.credits.sep.semicolon.symbol', 'settings.credits.sep.semicolon.aria'],
  ['amp', 'settings.credits.sep.amp.symbol', 'settings.credits.sep.amp.aria'],
  ['and', 'settings.credits.sep.and.symbol', 'settings.credits.sep.and.aria'],
]
function CreditSeparators({ user, onPreferences }) {
  const parse = (v) => {
    const raw = String(v || '').trim()
    if (!raw) return new Set(CREDIT_SEP_OPTIONS.map(([k]) => k)) // unset = all on
    if (raw.toLowerCase() === 'none') return new Set()
    return new Set(raw.split(',').map((s) => s.trim()).filter((s) => CREDIT_SEP_OPTIONS.some(([k]) => k === s)))
  }
  const [active, setActive] = useState(() => parse(user.preferences?.creditSeparators))
  function toggle(key) {
    const next = new Set(active)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setActive(next)
    // Canonical order, "none" as the explicit off switch (an empty string
    // would read as "unset" and fall back to the default on the server).
    const value = next.size === 0 ? 'none' : CREDIT_SEP_OPTIONS.map(([k]) => k).filter((k) => next.has(k)).join(',')
    onPreferences?.({ creditSeparators: value })
    json('PUT', '/auth/me/preferences', { creditSeparators: value })
  }
  return (
    <div className="settings-subsection">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonoLabel>{t('settings.credits.title')}</MonoLabel>
        <InfoDot title={t('settings.credits.info.title')} text={t('settings.credits.info.body')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CREDIT_SEP_OPTIONS.map(([key, symbol, aria]) => (
          <Tooltip key={key} label={t('settings.credits.chip.tip')} side="top">
            <button
              type="button"
              className={'tp-filter-chip' + (active.has(key) ? ' active' : '')}
              aria-pressed={active.has(key)}
              aria-label={t(aria)}
              onClick={() => toggle(key)}
            >
              {t(symbol)}
            </button>
          </Tooltip>
        ))}
      </div>
      {active.size === 0 && (
        <p className="microcopy mt-2">{t('settings.credits.off.prose')}</p>
      )}
    </div>
  )
}

// LanguageMarksSettings — what a proverb wears where every other quote wears a
// face. A POP-UP off the Appearance card since 1.15.2, for the same reason Type
// is: a row per language, each opening a tray, is a long list standing open
// beside cards you can read at a glance, and a mark is a matter of appearance.
// It renders its own body only — the dialog carries the heading.
//
// NO FLAGS (1.16.0). The tray used to offer twenty-four of them, first and in a
// grid, on the reasoning that offering is not mapping — nothing in the code ever
// said which flag belonged to which language. The reasoning held and the screen
// still did the thing it was defending against: a grid of flags at the top of a
// language's tray is a recommendation whoever wrote it, and it made the picker a
// geography quiz whose right answer did not exist. A flag is still one keystroke
// away, by typing it, which is the difference between a tool and a suggestion.
//
// WHAT A LANGUAGE OFFERS NOW IS ITS OWN SCRIPT: four letters, from the script it
// is written in. Below them sit the reader's OWN marks — up to four, per
// language — which is where a typed flag, symbol or emoji lands and stays, so
// picking it again next month is a tap rather than a hunt for the character map.
//
// THE WHOLE ROW OPENS THE TRAY. It was a 22px disc, which is a target you have
// to aim at next to a name you cannot press — the name being the thing that
// looks like the subject. The row is the button now and the disc is what it
// draws; only the reset glyph stays a separate control, because "put this back"
// is not "let me look at this".
//
// THE LIST IS THE READER'S OWN NOW, not ten the app chose. It opens with every
// language their quotes are actually in — the vocabulary's `languages`, which is
// one folded list over all three quote tables (see vocabulary_handler.go) — plus
// every language they have marked or renamed.
//
// `inLibrary` IS THE FLAG, AND IT IS TRUE FOR A LANGUAGE THE LIBRARY HOLDS. This
// paragraph named `added` and named it the wrong way round for a commit, which is
// worse than naming nothing: `added` was deleted when the starters went (see
// languages.jsx), and a reader checking "can this row be removed?" against a flag
// that no longer exists, whose surviving replacement carries the OPPOSITE value,
// gets the answer backwards twice and agrees with itself. A row the library holds
// up cannot be removed; one that is only marked can be dropped, because dropping
// it drops a mark and not a quote.
function LanguageMarksSettings({ prefs, onSaved }) {
  // What the library holds, so the table opens populated rather than empty. Seeded
  // from the cache synchronously so a second opening draws the rows on the first
  // paint, then refreshed — this panel opens from a dialog, and a table that
  // arrives one frame late reads as a screen that has nothing on it.
  const [inLibrary, setInLibrary] = useState(() => cachedVocabulary()?.languages || [])
  useEffect(() => {
    primeSearchVocabulary().then((v) => setInLibrary(v?.languages || [])).catch(() => {})
  }, [])
  const [rows, setRows] = useState(() => languageMarksState(inLibrary))
  // HOW MUCH OF THE ORIGINAL, per language and for all of them.
  //
  // THE SAME ROWS, ONE MORE COLUMN. The owner asked for "a table, where i add
  // languages as rows, and I can slide across the 4 options beside it" — and this
  // panel already IS that table: a row per language with an add box under it. A
  // second table of the same languages would be two lists to keep in step, and
  // the first time somebody added a language to one of them they would diverge.
  const [order, setOrder] = useState(() => textOrderFrom(prefs))
  useEffect(() => { setOrder(textOrderFrom(prefs)) }, [prefs])
  const [picking, setPicking] = useState(null) // the language whose tray is open
  const [draft, setDraft] = useState('') // the "add your own" box, per open tray
  const [adding, setAdding] = useState('') // the new-language box, '' = closed
  const [err, setErr] = useState('')

  // Re-seed when the session prefs change under us — another tab, or the account
  // switching. Reads the APPLIED marks, so this stays in step with what is on
  // screen rather than with a stale prop, exactly as the colour card does.
  useEffect(() => { setRows(languageMarksState(inLibrary)) }, [prefs, inLibrary])

  // save takes the WHOLE next entry rather than a mark, because every control in
  // the tray changes a different field of one row and a mark-shaped save would
  // have to be three of them.
  async function save(key, patch) {
    const all = currentLanguageEntries()
    const cur = all[key] || { mark: '', customs: [], name: '' }
    all[key] = { ...cur, ...patch }
    const blob = languageMarksBlob(all)
    applyLanguageMarks({ languageMarks: blob })
    // THE ROWS COME BACK OFF THE APPLIED BLOB, not off `all`. This used to pass
    // `Object.keys(all)` as well, to keep a just-added language on screen — which
    // it no longer needs to do, since the stored name keeps the row (see
    // languageMarksBlob), and which would have been wrong the other way: an entry
    // emptied of its mark, its customs AND its name normalises away, and naming it
    // here would leave a row on screen that a reload does not draw.
    setRows(languageMarksState(inLibrary))
    const r = await json('PUT', '/auth/me/preferences', { languageMarks: blob })
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      // Back to what the server still believes, so the panel can never show a
      // mark that was refused.
      applyLanguageMarks(prefs || {})
      setRows(languageMarksState(inLibrary))
      return
    }
    setErr('')
    onSaved?.({ languageMarks: blob })
  }

  // remove DROPS THE WHOLE ENTRY, which `save` cannot express: it merges a patch,
  // and there is no patch that means "this row is not a setting any more". Clearing
  // every field would come to the same thing through normalizeLanguageMarks — an
  // entry with no mark, no customs and no name is dropped whole — but saying it by
  // deletion is saying what is meant, and it does not depend on that rule holding.
  //
  // WHAT IT DOES NOT TOUCH IS THE QUOTES. A language lives in a free-text column on
  // every annotation, dialogue and utterance; this panel holds marks and renames.
  // So removing a row un-marks a language, and the row comes back the moment the
  // library still holds one — which is exactly why the control is refused there
  // rather than allowed to appear to work.
  async function remove(key) {
    const all = currentLanguageEntries()
    delete all[key]
    const blob = languageMarksBlob(all)
    applyLanguageMarks({ languageMarks: blob })
    setRows(languageMarksState(inLibrary))
    const r = await json('PUT', '/auth/me/preferences', { languageMarks: blob })
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      applyLanguageMarks(prefs || {})
      setRows(languageMarksState(inLibrary))
      return
    }
    setErr('')
    onSaved?.({ languageMarks: blob })
  }

  // saveOrder writes the whole blob, because the master and the rows are one
  // setting: moving the master rewrites every row (the owner's "it will push all
  // knobs to align with it"), and a per-field save would have to be one request
  // per language.
  //
  // THE SERVER DROPS WHAT AGREES, so this does not have to. Pushing every row to
  // the master sends a row per language and gets back a blob with none of them —
  // see normalizeTextOrder, which is where "a row that agrees with the master is
  // not a setting" is enforced. Doing it in both places would be one rule in two
  // spellings.
  async function saveOrder(next) {
    const blob = JSON.stringify(next)
    setOrder(next)
    const r = await json('PUT', '/auth/me/preferences', { textOrder: blob })
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      setOrder(textOrderFrom(prefs))
      return
    }
    setErr('')
    onSaved?.({ textOrder: blob })
  }

  // THE MASTER IS A DEFAULT, A BULK SETTER AND AN INDICATOR, which is three jobs
  // and all three are in the owner's two sentences. Moving it stores it AND puts
  // every row on it; a row moved on its own leaves it stored but drawn dim.
  const master = order.master || TEXT_ORDER_DEFAULT
  const custom = masterIsCustom(master, order.byLanguage)
  const moveMaster = (at) => saveOrder({ master: TEXT_ORDERS[at], byLanguage: {} })
  const moveRow = (key, at) => saveOrder({
    master: order.master,
    byLanguage: { ...order.byLanguage, [key]: TEXT_ORDERS[at] },
  })

  // addCustom appends to this language's own marks and selects it. Selecting is
  // not a convenience: somebody who has just typed a mark has said which one they
  // want, and leaving it unselected would make adding a two-step act with an
  // invisible second step.
  function addCustom(row, raw) {
    const g = String(raw || '').trim()
    setDraft('')
    if (!g) return
    if (row.customs.includes(g)) return save(row.key, { mark: g })
    if (row.customs.length >= MAX_CUSTOM_MARKS) {
      setErr(t('error.validate.marks-full', { name: row.name, n: MAX_CUSTOM_MARKS }))
      return
    }
    return save(row.key, { customs: [...row.customs, g], mark: g })
  }

  // Removing the mark currently in use falls back to the script letter rather
  // than leaving the row drawing something it no longer offers.
  function removeCustom(row, g) {
    const customs = row.customs.filter((c) => c !== g)
    return save(row.key, { customs, mark: row.mark === g ? '' : row.mark })
  }

  function addLanguage(raw) {
    const name = String(raw || '').trim()
    setAdding('')
    if (!name) return
    const key = name.toLowerCase()
    if (rows.some((r) => r.key === key)) {
      setPicking(key)
      return
    }
    // A language is added by being GIVEN something to store — a display name is
    // the only field an unmarked language has, and without one the entry would
    // serialise to nothing and the row would vanish on the next reload.
    setPicking(key)
    return save(key, { name })
  }

  return (
    <>
      <p className="microcopy mb-3">
        {t('settings.languages.intro.prose')}
      </p>
      {/* THE SLIDER ABOVE THE COLUMN — the owner's: "a slider will be there above
          the column as well, as a master trigger. when it is controlled, it will
          push all knobs to align with it. when other knobs are adjusted (custom),
          it will lose contrast, which will indicate custom state."
          The contrast loss is the indicator and the tooltip says what it means,
          because a dimmed control with no explanation reads as disabled — which is
          the opposite of true here: it is the one control that still does
          something to every row. */}
      <div
        className="mb-4"
        style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12, opacity: custom ? 0.55 : 1 }}
        title={custom ? t('settings.languages.order.custom.tip') : undefined}
      >
        <p className="microcopy mb-2" style={{ lineHeight: 1.6 }}>
          {t('settings.languages.order.intro.prose')}
        </p>
        {/* NO `ariaLabel` PROP — Slider has none, and passing one was silently
            ignored: it names itself from `label`, which is the visible text here
            and reads correctly as an accessible name. A row's slider hides that
            text with `hideLabel` and still announces it, which is what the prop is
            for. */}
        <Slider
          label={t('settings.languages.order.title')}
          min={0}
          max={TEXT_ORDERS.length - 1}
          step={1}
          value={TEXT_ORDERS.indexOf(master)}
          readout={t(TEXT_ORDER_WORD[master])}
          onCommit={moveMaster}
        />
      </div>
      <div>
        {rows.map((row) => {
          const open = picking === row.key
          const full = row.customs.length >= MAX_CUSTOM_MARKS
          return (
            <div key={row.key} className="inline-field">
              {/* THE ROW IS THE TRIGGER. The mark and the name are inside one
                  button that fills the row; the reset stays outside it, because
                  a control nested in a control is invalid markup and, worse,
                  ambiguous to press. */}
              <div className={'inline-field-head' + (open ? '' : ' is-flush')} style={{ gap: 6 }}>
                <button
                  type="button"
                  className="lang-row-btn"
                  aria-expanded={open}
                  // Named explicitly, because the mark inside it carries its own
                  // "in Bengali" label for the quote cards and a row announcing
                  // "in Bengali Bengali" is the glyph's label leaking into a
                  // context it was not written for.
                  aria-label={row.name}
                  onClick={() => { setPicking(open ? null : row.key); setDraft('') }}
                >
                  <LanguageMark languages={[row.canonical]} size={22} ring="var(--card)" />
                  <span className="min-w-0 flex-1 text-left" style={{ fontWeight: 600 }}>{row.name}</span>
                  {/* The canonical name stays visible on a renamed row. Quotes
                      are still stored and matched under it, so hiding it would
                      make "why does my Bangla board say Bengali" unanswerable. */}
                  {row.renamed && <MonoLabel style={{ color: 'var(--faint)' }}>{row.canonical}</MonoLabel>}
                  <IconChevron open={open} size={18} />
                </button>
                {(row.mark || row.renamed) && (
                  <FieldIconButton
                    icon={<IconRevert />}
                    ariaLabel={t('settings.languages.reset.aria', { name: row.canonical })}
                    onClick={() => save(row.key, { mark: '', name: '' })}
                    tooltip={t('settings.languages.reset.tip')}
                  />
                )}
                {/* REMOVE, AND IT IS DRAWN EVEN WHERE IT IS REFUSED. The other way —
                    show the ✕ only on removable rows — leaves a reader comparing two
                    rows that look different for a reason nothing on screen gives. A
                    disabled control with a tooltip that says WHY is this repo's own
                    idiom (characterRows.jsx: "`disabled`, so the row stays readable
                    and its title still explains").

                    IT SAYS "IN USE" AND NOT A COUNT, because there is no count here
                    to say. The vocabulary endpoint returns the language NAMES a
                    library holds, not how many quotes are in each; inventing "12
                    quotes" from a list of names is the confidently-wrong answer this
                    whole module was built to refuse. */}
                <FieldIconButton
                  icon={<IconClose />}
                  disabled={row.inLibrary}
                  ariaLabel={t('settings.languages.remove.aria', { name: row.canonical })}
                  onClick={() => remove(row.key)}
                  tooltip={row.inLibrary
                    ? t('settings.languages.remove.in-use.tip', { name: row.canonical })
                    : t('settings.languages.remove.tip')}
                  danger={!row.inLibrary}
                />
                {/* BESIDE THE TRIGGER AND NOT INSIDE IT. The row is one button
                    that fills its width, and this file's own note says why the
                    reset sits outside it: "a control nested in a control is
                    invalid markup and, worse, ambiguous to press." A slider is
                    the same case and more so — a drag inside a button would open
                    the tray on release.
                    It has room because `.inline-field-head` wraps, so at a phone's
                    width this drops to a line of its own rather than squeezing
                    the language's name, which is a name and may not be shortened. */}
                <div style={{ flex: '1 1 11em', minWidth: '9em' }}>
                  <Slider
                    hideLabel
                    label={t('settings.languages.order.row.aria', { name: row.name })}
                    min={0}
                    max={TEXT_ORDERS.length - 1}
                    step={1}
                    value={TEXT_ORDERS.indexOf(order.byLanguage?.[row.key] || master)}
                    readout={t(TEXT_ORDER_WORD[order.byLanguage?.[row.key] || master])}
                    onCommit={(at) => moveRow(row.key, at)}
                  />
                </div>
              </div>
              {open && (
                <div className="space-y-3 pb-2">
                  {row.glyphs.length > 0 ? (
                    <div>
                      <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>{t('settings.languages.script.title')}</MonoLabel>
                      <div className="cat-palette" role="listbox" aria-label={t('settings.languages.glyphs.aria', { name: row.canonical })}>
                        {row.glyphs.map((g, i) => (
                          <button
                            key={g}
                            type="button"
                            role="option"
                            // The first is the default, so an unset mark selects
                            // it: the row is already drawing it.
                            aria-selected={row.mark === g || (!row.mark && i === 0)}
                            aria-label={g}
                            className={'cat-swatch' + (row.mark === g || (!row.mark && i === 0) ? ' is-on' : '')}
                            style={{ background: 'var(--raised)', fontSize: 'var(--type-ui-15)', lineHeight: 1 }}
                            onClick={() => save(row.key, { mark: i === 0 ? '' : g })}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // A language the app has never heard of has no script to
                    // offer, and guessing one would put a Latin A on a board of
                    // Yoruba proverbs. It gets the custom bar and nothing else.
                    <p className="microcopy">
                      {t('settings.languages.no-script.prose', { name: row.canonical })}
                    </p>
                  )}

                  <div>
                    <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>
                      {t('settings.languages.customs.title', { done: row.customs.length, total: MAX_CUSTOM_MARKS })}
                    </MonoLabel>
                    {row.customs.length > 0 && (
                      <div className="cat-palette" role="listbox" aria-label={t('settings.languages.customs.aria', { name: row.canonical })}>
                        {row.customs.map((g) => (
                          <span key={g} className="lang-custom">
                            <button
                              type="button"
                              role="option"
                              aria-selected={row.mark === g}
                              aria-label={g}
                              className={'cat-swatch' + (row.mark === g ? ' is-on' : '')}
                              style={{ background: 'var(--raised)', fontSize: 'var(--type-ui-15)', lineHeight: 1 }}
                              onClick={() => save(row.key, { mark: g })}
                            >
                              {g}
                            </button>
                            <FieldIconButton
                              icon={<IconClose />}
                              ariaLabel={t('settings.languages.mark.remove.aria', { name: g, field: row.canonical })}
                              onClick={() => removeCustom(row, g)}
                              tooltip={t('settings.languages.mark.remove.tip')}
                              danger
                            />
                          </span>
                        ))}
                      </div>
                    )}
                    {/* The box goes away when the bar is full rather than
                        refusing on submit: a field you can type into and cannot
                        save from is worse than no field. */}
                    {full ? (
                      <p className="microcopy">
                        {t('settings.languages.full.prose', { name: row.canonical, n: MAX_CUSTOM_MARKS })}
                      </p>
                    ) : (
                      <Field
                        label={t('settings.languages.add-mark.label')}
                        value={draft}
                        placeholder={t('settings.languages.add-mark.placeholder')}
                        maxLength={MARK_MAX_RUNES}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => addCustom(row, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      />
                    )}
                  </div>

                  {/* RENAMING IS A DISPLAY NAME AND NOTHING ELSE. The quote keeps
                      the language it was stored with, so calling Bengali "বাংলা"
                      cannot orphan a quote, cannot break the board form's
                      matching, and round-trips through an export untouched —
                      the same rule the colour categories have always followed. */}
                  <Field
                    label={t('settings.languages.rename.label', { name: row.canonical })}
                    defaultValue={row.name}
                    key={`name-${row.key}-${row.name}`}
                    placeholder={row.canonical}
                    maxLength={LANGUAGE_NAME_MAX_RUNES}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== row.name) save(row.key, { name: v })
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Adding a language, because the ten built in are the ten most spoken and
          not the ten anybody's library is in. A board form already accepts any
          language as free text; this is the same list reached from the side that
          edits it, so a language typed there can be marked here without having
          to go and find a quote in it first. */}
      <div className="mt-3">
        {adding === null ? null : adding === '' ? (
          <GhostButton icon={<IconPlus />} onClick={() => setAdding(' ')}>{t('settings.languages.add.label')}</GhostButton>
        ) : (
          <Field
            label={t('settings.languages.name.label')}
            autoFocus
            value={adding.trimStart()}
            placeholder={t('settings.languages.name.placeholder')}
            maxLength={LANGUAGE_NAME_MAX_RUNES}
            onChange={(e) => setAdding(e.target.value || ' ')}
            onBlur={(e) => addLanguage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setAdding('') }}
          />
        )}
      </div>
      <ErrorText>{err}</ErrorText>
    </>
  )
}
