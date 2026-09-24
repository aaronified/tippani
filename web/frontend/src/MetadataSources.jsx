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

import { useEffect, useId, useMemo, useState } from 'react'
import { json, errText } from './api.js'
import { localeActive, placeholderFor, t } from './i18n.js'
import {
  Card,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  GhostButton,
  IconCheck,
  IconClose,
  IconDelete,
  IconEdit,
  IconPlus,
  IconFetch,
  IconReset,
  IconSearch,
  IconTextOrder,
  InfoDot,
  MonoLabel,
  SectionTitle,
  SourceIcon,
  toast,
  Toggle,
  Tooltip,
  useConfirm,
  useFormHost,
  useIsMobileScreen,
} from './ui.jsx'
import {
  applyLanguageMarks,
  currentLanguageEntries,
  LANGUAGE_NAME_MAX_RUNES,
  languageMarksBlob,
  languageMarksState,
  MARK_MAX_RUNES,
  MAX_CUSTOM_MARKS,
} from './languages.jsx'
import { TEXT_ORDER_DEFAULT, masterIsCustom } from './textOrder.js'
import { TextOrderPicker } from './textOrderField.jsx'
import { textOrderFrom } from './textOrderHost.jsx'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'
import { anyFace as faceById } from './fonts.js'
import { useMasonry } from './masonry.js'
import { FontSections, QuoteFaceSample, QuoteFaceSelect, useQuoteFaces } from './Settings.jsx'
import { iso6393Name, loadISO6393, searchISO6393 } from './iso6393.js'

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

// SourceRows — one row per supplier the app can ask, which is the question this
// console's heading has always asked and the key fields could never answer.
//
// A KEY FIELD KNOWS ONE THING: whether it is filled. It cannot say what the
// supplier is FOR, whether it answers without a credential at all, how much of
// this library came from it, or what it said last time — and a supplier that needs
// no key (Open Library, Wikimedia) has no field, so it appeared on this screen
// nowhere. The pack draws the list and titles it "Who the app can ask"
// (metadata.dc.html:805-821).
//
// THE PACK'S PER-ROW KEY ACTION IS NOT DRAWN, and this comment claimed it was
// until a rating read the line. The pack gives each row two verbs — "Add TMDB's
// key" and "Test TMDB" — and the key fields are already on this card, six inches
// below: a second door to the field beside it would be the repeat this whole pass
// has been removing. So the rows carry the Test and the fields carry the keys, and
// the deviation is recorded in Design-decisions.md rather than left to be
// rediscovered as an omission.
//
// THE NUMBERS ARE THE LIBRARY'S OWN. `records` counts the fields `work_field_source`
// says each supplier wrote, scoped to this reader — see metadata_sources.go.
function SourceRows({ admin, sources, onTested }) {
  // WHICH ROW IS BEING ASKED, by slug, and '' for none. A single busy flag would
  // grey out twelve rows because one of them is being tested.
  const [asking, setAsking] = useState('')
  const [err, setErr] = useState('')

  async function test(slug) {
    setAsking(slug || 'all')
    setErr('')
    const r = await json('POST', '/admin/metadata/test', slug ? { source: slug } : {})
    setAsking('')
    if (!r.ok) return setErr(errText(r, t('error.check.updates')))
    // THE WHOLE STATUS, NOT THE ROWS THAT CAME BACK. A test changes the fault
    // chips above as well — the registry it writes to is the one they read — and a
    // screen that updated half of itself would show a row saying "did not answer"
    // over a fault list that had not heard.
    onTested?.()
  }

  if (!sources?.length) return null
  const needKey = sources.filter((x) => x.state === 'needed').length
  return (
    <div className="src-rows">
      <div className="src-rows-head">
        <MonoLabel>{t('settings.sources.group.title')}</MonoLabel>
        {/* THE COLUMN'S CAPTION, ALWAYS — it is what the number on the right of
            every row IS, and a caption that disappears when there is news is a
            column of unexplained integers exactly when the reader is reading
            hardest. The pack carries it as the group's `aside`. */}
        <span className="microcopy">{t('settings.sources.records.aside')}</span>
        {/* AND THE PACK'S ISSUES LINE BESIDE IT (metadata.dc.html:845), which is
            the one number on this list worth leading with: everything else on the
            Metadata screen depends on at least one supplier being answerable, and
            a reader counting red marks by eye is a reader who miscounts. It says
            nothing when there is nothing to say, which is this console's rule. */}
        {needKey > 0 && (
          <span className="microcopy" style={{ color: 'var(--error)' }}>
            {t('settings.sources.need-key.prose', { count: needKey })}
          </span>
        )}
        <span className="flex-1" />
        {admin && (
          <GhostButton
            icon={<IconFetch />}
            keepLabel
            disabled={!!asking}
            onClick={() => test('')}
            tooltip={t('settings.sources.test-all.tip')}
          >
            {asking === 'all' ? t('settings.sources.testing.label') : t('settings.sources.test-all.label')}
          </GhostButton>
        )}
      </div>
      {sources.map((row) => {
        const name = sourceName(row.source)
        // WHAT IT SUPPLIES, COMPOSED FROM THE AREAS rather than written per
        // supplier. The app already names the four areas for the fault chips, so a
        // supplier that gains one says so without a new string — and there is no
        // per-supplier prose here to translate twelve times.
        const supplies = (row.areas || []).map((a) => t(`settings.metadata.area.${a}.label`)).join(' · ')
        const last = row.last
        // NOTHING HAS ASKED IT YET IS A FACT, NOT A WARNING, and it is worth
        // drawing: Open Library and the picture rungs are recorded only when the
        // app actually uses them, so a quiet row would otherwise be
        // indistinguishable from one whose answer failed to render.
        const said = !last
          ? ['untried', t('settings.sources.untried.label')]
          : !last.ok
            ? ['failed', t('settings.sources.failed.label')]
            : last.found > 0
              ? ['ok', t('settings.sources.answered.label', { n: last.found })]
              : ['empty', t('settings.sources.empty.label')]
        return (
          <div className="src-row" key={row.source}>
            <SourceIcon source={row.source} side="right" state={row.state} stateOf={name} />
            <div className="src-row-said">
              <span className="src-row-name">{name}</span>
              <span className="microcopy">{supplies}</span>
            </div>
            {/* THE COUNT IS THE ROW'S ARGUMENT FOR ITSELF, so it is drawn even at
                zero: a supplier that has never supplied anything is exactly the one
                a reader is deciding whether to configure. */}
            <Tooltip
              label={row.records
                ? t('settings.sources.records.tip', { count: row.records, source: name })
                : t('settings.sources.records.none.tip', { source: name })}
            >
              <span className={'src-row-count' + (row.state === 'needed' ? ' is-needed' : '')}>{row.records}</span>
            </Tooltip>
            {admin && (
              <FieldIconButton
                icon={<IconFetch />}
                ariaLabel={t('settings.sources.test.aria', { source: name })}
                tooltip={t('settings.sources.test.tip', { source: name })}
                // AND NOT FOR A SOURCE THAT CANNOT BE ASKED AT ALL. A press
                // that could only report "no key" is a press that tells the
                // reader what the mark beside it already says — and it used to
                // report nothing whatsoever, which a rating caught.
                disabled={!!asking || !TESTABLE.includes(row.source) || row.state === 'needed'}
                onClick={() => test(row.source)}
              />
            )}
            {/* WHAT IT SAID, UNDER THE ROW IT IS ABOUT. A press with no visible
                answer is a press a reader repeats. */}
            {said && (
              <p className={'src-row-last is-' + said[0]}>
                {asking === row.source ? t('settings.sources.testing.label') : said[1]}
                {last?.error ? ` — ${last.error}` : ''}
              </p>
            )}
          </div>
        )
      })}
      <ErrorText>{err}</ErrorText>
    </div>
  )
}

// WHICH ROWS THE TEST BUTTON IS LIVE ON, and it mirrors `testableSources` in
// metadata_sources.go on purpose rather than being sent down: the server refuses
// the others by name, and a button that a reader can press only to be told no is
// worse than one that is visibly not for them. The scrapers report themselves
// whenever they are actually used; asking them a synthetic question on a press is
// how an install earns a rate limit.
const TESTABLE = ['google', 'tmdb', 'tvdb', 'igdb']

export function MetadataSources({ user, onPreferences }) {
  const admin = user.is_admin
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

  const packed = useMasonry()
  return (
    // TWO COLUMNS ON A DESK, ONE ON A PHONE, AND THE CARDS DECIDE WHERE THEY BREAK.
    //
    // The owner's: "desktop view: two column masonry". A console whose cards are a
    // six-row key list, a four-chip footnote and (after the language work) a door is
    // three boxes of wildly different heights — a grid would pad the short ones out
    // to the tall one's height, which is a column of whitespace where the reader is
    // looking for the next thing. Masonry packs them — the same `useMasonry` as
    // Settings' cards, which replaced the multicol this was: multicol reads down
    // each column, and "masonry, not grid" on both screens should mean one packing.
    //
    // See index.css for why the breakpoint is 900px — it is the width at which THIS
    // screen's rail already stops being a phone's.
    <div className="meta-columns" ref={packed}>
    <Card data-tour="metadata-keys">
      {/* THE SECTION IS THE HEADING — see Settings.jsx's AppearanceCard. Metadata's
          Sources tab says "Sources" and carries the dot; this card said "Metadata
          sources" underneath it with a second one. */}

      {/* WHAT THE COLOUR OF EACH SUPPLIER'S MARK MEANS.
          The owner's, correcting where this was going to live: "not infodot, use a
          row to explain the colours." A legend behind a tap is a legend nobody
          opens, and the whole point of moving four words out of seven rows was to
          say them once — hiding them would have said them zero times.
          It reads as one line on a desk and wraps to two on a phone. */}
      {/* THE SUPPLIERS FIRST, THEN THE LEGEND THAT EXPLAINS THEIR MARKS, then the
          fields that fill them in. The legend used to lead because the marks it
          described were on the key rows; they are on the source rows now, and a
          legend above the thing it is about is a key to a map you have not seen. */}
      <SourceRows admin={admin} sources={status?.sources} onTested={loadStatus} />

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

    </Card>

    {/* ── THE CREDENTIALS, ON THEIR OWN CARD ───────────────────────────────────
        The owner: "Sources: split the API keys into their own subsection with
        cards." They were the bottom half of the card above, under the supplier
        rows and the legend explaining those rows' marks — so one card carried two
        questions: WHICH SUPPLIERS ANSWER, which everybody can read, and WHAT
        SECRETS THIS SERVER HOLDS, which only an admin can see at all.

        That second question is why the split is right rather than merely tidy.
        Every field below is `admin`-gated, so a reader who is not one watched the
        card above simply stop, with nothing saying why; one who is got six secret
        fields with no heading between them and a legend about coloured dots.
        A card is how this app says "different subject", and these are two.

        IT KEEPS THE FLAT LIST INSIDE ITSELF. The note that used to sit here —
        "every field says which service it is for, so grouping them added a
        heading and two rows of air per group and no meaning" — was about grouping
        the keys BY SUPPLIER, and it still holds: one heading now, not six.

        THE GOOGLE OPT-IN COMES WITH THEM, and its own note below says why it
        belongs at the foot of this card rather than inside Amazon's block. It was
        already `admin`-gated separately; that guard is this card's now. ── */}
    {admin && (
      <Card data-tour="metadata-keys">
        <SectionTitle info={t('settings.keys.card.info')}>{t('settings.keys.card.title')}</SectionTitle>
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

        {/* Amazon (advanced): cover-by-ASIN needs nothing; the optional cookie
            adds description/genres by scraping the product page. Its own
            `admin` guard is gone because the whole card carries one now. */}
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

        {/* THE SAVE ERROR BELONGS TO THE CARD THAT SAVES. Every write on this
            screen is a key field or the toggle above, so the one line that says a
            write failed goes with them rather than under the supplier list, which
            writes nothing. */}
        <ErrorText>{error}</ErrorText>
      </Card>
    )}

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

      {/* AND LANGUAGE MARKS IS A CARD NOW TOO, on the owner's ruling and for the
          reason the credit separators moved: it was a footnote because the page
          was one column. It hung off the bottom of the keys card behind a rule,
          which is where a thing goes when there is nowhere else to put it — and
          the moment the cards pack into two columns there is somewhere.

          THE ARGUMENT FOR BURYING IT WAS ALWAYS ABOUT VERTICAL SPACE. The old
          note here said a mark "belongs on this card" because a mark is the same
          kind of fact as a title or an author. That reasoning was right and is
          why the door is on this PAGE rather than under Appearance; it never
          settled how much of the page the door should take, which is the question
          a card answers.

          STILL A DOOR RATHER THAN A SECTION, which is the part of the old note
          that holds unchanged: it is a row per language with a tray behind each,
          and standing ninety-one of those open on a page read at a glance is a
          column spent on a choice made once.

          A CARD, THOUGH, IS WHAT STOPS IT READING AS PART OF SOMETHING ELSE. At
          the foot of the keys card a rule was doing the whole job of saying "this
          is not about API keys", and a rule is a weaker signal than the thing
          every other subject on this page gets. */}
      {/* THE LANGUAGE-MARKS DOOR IS GONE FROM HERE, and the table it opened is a
          SECTION of this console now. It was a button on this card opening a
          FormModal, which was the right shape while it was a corner of the sources
          screen — and the wrong one the moment Settings started pointing at it for
          what a quote's language is. A pop-up inside another section is not an
          address another screen can send a reader to. The panel is unchanged; only
          where it hangs. */}
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
// EXPORTED, because it is a SECTION of the Metadata console now rather than a
// pop-up behind a button on this one. The Settings screen points here for what a
// quote's language is — "read from the metadata language table, which is the only
// place a quote's language is defined" — and a door to a modal inside another
// section is not a place that sentence can point at.
export function LanguageMarksSettings({ prefs, onSaved }) {
  // What the library holds, so the table opens populated rather than empty. Seeded
  // from the cache synchronously so a second opening draws the rows on the first
  // paint, then refreshed.
  const [inLibrary, setInLibrary] = useState(() => cachedVocabulary()?.languages || [])
  useEffect(() => {
    primeSearchVocabulary().then((v) => setInLibrary(v?.languages || [])).catch(() => {})
  }, [])
  const [rows, setRows] = useState(() => languageMarksState(inLibrary))
  // HOW MUCH OF THE ORIGINAL, per language and for all of them — the owner's "a
  // table, where i add languages as rows, and I can slide across the 4 options
  // beside it", now with the four drawn as icons so a row stays one row.
  const [order, setOrder] = useState(() => textOrderFrom(prefs))
  useEffect(() => { setOrder(textOrderFrom(prefs)) }, [prefs])
  const [editing, setEditing] = useState(null) // the key of the language in the editor
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const { ask, confirmDialog } = useConfirm()
  // THE QUOTE FACES, CHOSEN HERE NOW. The owner: "the quote font selection can be
  // added to the metadata language screen. on phone, this will be part of the
  // popup, on desktop, we can add new columns to the existing list." A face is a
  // fact about a language, so it sits with the language's other facts; Settings
  // keeps only a door here. The writer is Settings' own (`useQuoteFaces`), so a
  // face is still written in one place.
  const faces = useQuoteFaces(prefs, onSaved)
  const mobile = useIsMobileScreen()

  // Re-seed when the session prefs change under us — another tab, or the account
  // switching. Reads the APPLIED marks, so this stays in step with what is on
  // screen rather than with a stale prop.
  useEffect(() => { setRows(languageMarksState(inLibrary)) }, [prefs, inLibrary])

  // THE BLOB IS READ BACK FROM THE SERVER BEFORE IT IS REWRITTEN. The preference
  // is one string holding every language, so a save writes all of them — and a
  // second tab (or a second journey on the same account) that saved in between
  // would be overwritten by this page's copy from when it loaded. Measured: two
  // journeys on one account, one adding Ancient Greek and one marking Hindi, and
  // whichever saved last erased the other's row. Reading first narrows that to
  // the width of one request.
  async function latest() {
    const r = await json('GET', '/auth/me')
    if (r.ok && r.data?.preferences) applyLanguageMarks(r.data.preferences)
  }

  // save takes a PATCH of one entry, because the editor changes several fields of
  // one row at once and a save per field would be several requests for one ✓.
  async function save(key, patch) {
    await latest()
    const all = currentLanguageEntries()
    const cur = all[key] || { mark: '', customs: [], name: '', iso: '' }
    all[key] = { ...cur, ...patch }
    return commit(languageMarksBlob(all))
  }

  // remove DROPS THE WHOLE ENTRY — its mark, its name and its code. What it does
  // not touch is the quotes: a language lives in a free-text column on every
  // annotation, dialogue and utterance, so a row the library still holds comes
  // straight back, which is why removing one is refused there.
  async function remove(key) {
    await latest()
    const all = currentLanguageEntries()
    delete all[key]
    return commit(languageMarksBlob(all))
  }

  // THE ROWS COME BACK OFF THE APPLIED BLOB, not off the map just written — an
  // entry emptied of everything normalises away, and naming it here would leave a
  // row on screen that a reload does not draw.
  async function commit(blob) {
    applyLanguageMarks({ languageMarks: blob })
    setRows(languageMarksState(inLibrary))
    const r = await json('PUT', '/auth/me/preferences', { languageMarks: blob })
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      // Back to what the server still believes, so the table can never show a
      // mark that was refused.
      applyLanguageMarks(prefs || {})
      setRows(languageMarksState(inLibrary))
      return false
    }
    setErr('')
    onSaved?.({ languageMarks: blob })
    return true
  }

  // saveOrder writes the whole blob, because the master and the rows are one
  // setting: moving the master rewrites every row (the owner's "it will push all
  // knobs to align with it"). The server drops a row that agrees with the master.
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

  // THE MASTER IS A DEFAULT, A BULK SETTER AND AN INDICATOR. Moving it stores it
  // AND puts every row on it; a row moved on its own leaves it stored but drawn dim.
  const master = order.master || TEXT_ORDER_DEFAULT
  const custom = masterIsCustom(master, order.byLanguage)
  const moveMaster = (k) => saveOrder({ master: k, byLanguage: {} })
  // A ROW'S CHOICE IS MERGED INTO WHAT THE SERVER HOLDS, for the reason `latest`
  // gives above: drawn at once, then written on top of the stored setting rather
  // than on top of this page's copy of it.
  async function moveRow(key, k) {
    setOrder((o) => ({ ...o, byLanguage: { ...o.byLanguage, [key]: k } }))
    const r = await json('GET', '/auth/me')
    const base = r.ok && r.data?.preferences ? textOrderFrom(r.data.preferences) : order
    saveOrder({ master: base.master, byLanguage: { ...base.byLanguage, [key]: k } })
  }

  // ADDING IS A SEARCH OF THE REGISTRY, with free text as the last resort. A
  // language picked from ISO 639-3 arrives with its code; one the registry does
  // not have (a dialect, a period spelling) is still a language and is added as
  // typed. A language already on the list opens instead of doubling.
  async function addLanguage({ name, iso = '' }) {
    setAdding(false)
    const clean = String(name || '').trim()
    if (!clean) return
    const key = clean.toLowerCase()
    const already = rows.find((r) => r.key === key || (iso && r.iso === iso))
    if (already) {
      if (iso && !already.isoLinked) await save(already.key, { iso })
      setEditing(already.key)
      return
    }
    await save(key, { name: clean, iso })
  }

  async function removeRow(row) {
    const yes = await ask(t('settings.languages.remove.confirm.title', { name: row.name }), {
      body: t('settings.languages.remove.confirm.body'),
      confirmLabel: t('settings.languages.remove.label'),
      danger: true,
    })
    if (!yes) return
    setEditing(null)
    await remove(row.key)
  }

  const open = rows.find((r) => r.key === editing) || null
  const allName = t('settings.languages.order.all.label')

  return (
    <>
      {/* THE DEFAULT, AND THE ONLY PLACE THE FOUR ARE WORDED. The rows below draw
          the same four as icons, so this is where the drawing is learned — the
          key beside it names what a solid and an outlined bar stand for. */}
      <div className="lang-master" title={custom ? t('settings.languages.order.custom.tip') : undefined}>
        <div className="lang-master-head">
          <MonoLabel>{t('settings.languages.order.title')}</MonoLabel>
          <span className="lang-master-name">{allName}</span>
          <span className="lang-key">
            <span className="lang-key-item"><IconTextOrder order="quote-only" size={18} />{t('settings.languages.key.quote')}</span>
            <span className="lang-key-item"><IconTextOrder order="trans-only" size={18} />{t('settings.languages.key.trans')}</span>
          </span>
        </div>
        <TextOrderPicker value={master} onChange={moveMaster} name={allName} showWord dim={custom} />
      </div>
      {/* AND THE DEFAULT FACE, IN THE SAME TOP AREA — the owner's "default font
          selection will be in the top area where we now have the global toggles".
          Settings' own face row (size dial, style chips, revert) through
          Settings' own save, not a copy of it. */}
      <div className="lang-master lang-master-face">
        <FontSections prefs={prefs} onSaved={onSaved} quoteDefault />
      </div>

      <ul className="lang-rows">
        {rows.map((row) => {
          const value = order.byLanguage?.[row.key] || master
          const own = value !== master
          return (
            <li key={row.key} className="lang-row">
              {/* THE MARK AND THE NAME ARE ONE DOOR, to the one editor every
                  language shares. Reset and remove went in there with the mark
                  picker, so a row carries only what it is and how it reads. */}
              <button
                type="button"
                className="lang-row-open"
                aria-label={t('settings.languages.edit.aria', { name: row.name })}
                onClick={() => setEditing(row.key)}
              >
                <span className={'lang-mark-tile' + (row.resolved ? '' : ' is-blank')} aria-hidden="true">
                  {row.resolved || [...row.name][0]}
                </span>
                <span className="lang-row-text">
                  <span className="lang-row-name">
                    {row.name}
                    {/* A ROW WITH A SETTING OF ITS OWN WEARS THE DOT, not the words.
                        The owner: "own settings need not be spelled out. you can use
                        the dot" — the same mark a Settings row wears when it has been
                        moved off its default. The words are still said: to a pointer
                        in the tooltip, to a screen reader in the row chooser's name. */}
                    {own && <span className="pref-row-dot" title={t('settings.languages.order.own.label')} aria-hidden="true" />}
                  </span>
                  <span className="lang-row-meta">
                    {/* THE REGISTRY CODE, and the association this section was
                        missing: which language, exactly, the row is. */}
                    <span className={'lang-iso' + (row.iso ? '' : ' is-none')}>{row.iso || t('settings.languages.iso.none')}</span>
                    {row.renamed && <span>{row.canonical}</span>}
                  </span>
                </span>
              </button>
              {/* TWO COLUMNS ON A DESK: the language writing its own name in its
                  face, and the face. On a phone the row has no room for either,
                  so the face is chosen in the editor instead. */}
              {!mobile && (
                <span className="lang-row-face">
                  <QuoteFaceSample languageKey={row.key} name={row.name} face={faces.faceFor(row.key)} />
                  <QuoteFaceSelect languageKey={row.key} name={row.name} value={faces.faceFor(row.key)?.id} onChange={(id) => faces.saveFace(row.key, id)} />
                </span>
              )}
              <TextOrderPicker value={value} onChange={(k) => moveRow(row.key, k)} name={row.name} own={own} groupLabel={own ? `${row.name}, ${t('settings.languages.order.own.label')}` : undefined} />
            </li>
          )
        })}
      </ul>

      <div className="lang-add">
        {adding ? (
          <ISO6393Search
            label={t('settings.languages.add.search.label')}
            autoFocus
            allowFree
            onPick={(pick) => addLanguage(pick)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <GhostButton icon={<IconPlus />} keepLabel onClick={() => setAdding(true)}>{t('settings.languages.add.label')}</GhostButton>
        )}
      </div>
      <ErrorText>{err || faces.err}</ErrorText>

      {open && (
        <LanguageEditorModal
          key={open.key}
          row={open}
          face={mobile ? (faces.faceFor(open.key)?.id || '') : null}
          onClose={() => setEditing(null)}
          onSave={async ({ face, ...d }) => {
            // The face is a font preference, not part of the language's entry, so
            // it goes to its own writer — and only when it moved.
            if (face != null && face !== (faces.faceFor(open.key)?.id || '')) await faces.saveFace(open.key, face)
            if (await save(open.key, d)) setEditing(null)
          }}
          onReset={async () => { if (await save(open.key, { mark: '', name: '' })) setEditing(null) }}
          onRemove={() => removeRow(open)}
        />
      )}
      {/* AFTER THE EDITOR, because the remove confirm is asked FROM it: two
          dialogs on one layer stack in document order, and drawn first it sat
          behind the editor that opened it. */}
      {confirmDialog}
    </>
  )
}

// A registry name carries its period in brackets — "Ancient Greek (to 1453)" — and
// a reader's list names the language, so the bracket is the registry's and not the
// row's. The code keeps the precision.
const plainName = (name) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

// What a registry row is, when it is not simply a living language — said beside
// the name so "Old English" and "English" are not two lines that look alike.
const ISO_TYPE_KEYS = {
  E: 'settings.languages.iso.type.extinct',
  A: 'settings.languages.iso.type.ancient',
  H: 'settings.languages.iso.type.historical',
  C: 'settings.languages.iso.type.constructed',
}

// ISO6393Search — find a language in ISO 639-3 by name or code.
//
// THE REGISTRY LOADS WHEN THIS MOUNTS, which is when somebody asked to search it:
// 150KB nobody downloads unless they add or link a language.
//
// `allowFree` ENDS THE LIST WITH THE TYPED TEXT ITSELF, because a language is still
// free text in this app — Kentish, a period spelling, a family's own name for how
// they speak — and a registry that could refuse one would lose it.
function ISO6393Search({ label, onPick, onCancel, allowFree = false, autoFocus = false }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState(null)
  const [active, setActive] = useState(0)
  const id = useId()
  useEffect(() => { loadISO6393().then(setList).catch(() => setList([])) }, [])
  const hits = useMemo(() => searchISO6393(list, q, 8), [list, q])
  const typed = q.trim()
  const options = [
    ...hits.map((r) => ({ key: r.code, code: r.code, name: plainName(r.name), full: r.name, type: r.type, macro: r.macro })),
    ...(allowFree && typed && !hits.some((h) => plainName(h.name).toLowerCase() === typed.toLowerCase())
      ? [{ key: '\u0000free', free: true, name: typed }]
      : []),
  ]
  useEffect(() => { setActive(0) }, [q])
  const pick = (o) => { if (o) onPick(o.free ? { name: o.name, iso: '' } : { name: o.name, iso: o.code }) }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(options[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
  }
  const typeWord = (o) => [ISO_TYPE_KEYS[o.type] ? t(ISO_TYPE_KEYS[o.type]) : '', o.macro ? t('settings.languages.iso.type.macro') : '']
    .filter(Boolean).join(' · ')
  return (
    <div className="iso-search">
      <label className="tp-field">
        <MonoLabel>{label}</MonoLabel>
        <input
          className="tp-input"
          role="combobox"
          aria-expanded={!!typed}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={typed && options[active] ? `${id}-${active}` : undefined}
          autoFocus={autoFocus}
          value={q}
          placeholder={t('settings.languages.iso.search.placeholder')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      {typed && (
        list === null ? (
          <p className="microcopy">{t('common.state.loading')}</p>
        ) : options.length === 0 ? (
          <p className="microcopy">{t('settings.languages.iso.nomatch')}</p>
        ) : (
          <div id={id} role="listbox" aria-label={label} className="iso-results">
            {options.map((o, i) => (
              <button
                key={o.key}
                id={`${id}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                // NAMED AS A PERSON WOULD SAY IT — "Sylheti (syl)" — rather than
                // as the spans run together in the markup.
                aria-label={o.free ? undefined : `${o.full} (${o.code})`}
                className={'iso-option' + (i === active ? ' is-active' : '')}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                {o.free ? (
                  <span className="iso-option-name">{t('settings.languages.add.free', { name: o.name })}</span>
                ) : (
                  <>
                    <span className="iso-code">{o.code}</span>
                    <span className="iso-option-name">{o.full}</span>
                    {typeWord(o) && <span className="iso-option-type">{typeWord(o)}</span>}
                  </>
                )}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// LanguageEditorModal — ONE EDITOR FOR EVERY LANGUAGE. The tray it replaces opened
// inline under a row in whatever shape that language's glyphs made it; this is the
// same panel for all of them — name, registry code, one grid of marks — on the
// app's own form chrome, with the tick armed only when something changed.
function LanguageEditorModal({ row, face = null, onClose, onSave, onReset, onRemove }) {
  // `face` is null where the editor does not carry the face (a desk, where it is a
  // column of the row) and the stored face id — "" for none — where it does.
  const [d, setD] = useState({ name: row.name, mark: row.mark, customs: row.customs, iso: row.isoLinked, face })
  const dirty =
    (face != null && d.face !== face ? 1 : 0) +
    (d.name.trim() !== row.name ? 1 : 0) +
    (d.mark !== row.mark ? 1 : 0) +
    (d.customs.join('\u0000') !== row.customs.join('\u0000') ? 1 : 0) +
    (d.iso !== row.isoLinked ? 1 : 0)
  return (
    <FormModal open title={row.name} dirty={dirty} onClose={onClose} closeDanger maxWidth={540}>
      <LanguageEditorForm row={row} d={d} setD={setD} onSubmit={() => onSave({ ...d, name: d.name.trim() })} onReset={onReset} onRemove={onRemove} />
    </FormModal>
  )
}

// The form half, a CHILD of the modal so useFormHost finds the modal's host — see
// the Gotchas in CLAUDE.md: called from the component that renders the modal, it
// registers with whatever surface is further out and the modal draws no ✓.
function LanguageEditorForm({ row, d, setD, onSubmit, onReset, onRemove }) {
  const host = useFormHost('')
  const [draft, setDraft] = useState(null) // null = the ＋ cell is closed
  const [linking, setLinking] = useState(false)
  const [isoName, setIsoName] = useState('')
  const iso = d.iso || row.iso
  useEffect(() => {
    if (!iso) { setIsoName(''); return }
    loadISO6393().then(() => setIsoName(iso6393Name(iso))).catch(() => {})
  }, [iso])
  const full = d.customs.length >= MAX_CUSTOM_MARKS
  // The first script letter is the default, so an unset mark selects it.
  const chosen = (g, i, fromScript) => d.mark === g || (fromScript && !d.mark && i === 0)
  function addCustom(raw) {
    const g = String(raw || '').trim()
    setDraft(null)
    if (!g) return
    if (d.customs.includes(g)) return setD({ ...d, mark: g })
    if (full) return
    setD({ ...d, customs: [...d.customs, g], mark: g })
  }
  const dropCustom = (g) => setD({ ...d, customs: d.customs.filter((c) => c !== g), mark: d.mark === g ? '' : d.mark })
  // EVERY BUTTON IN HERE SAYS type="button" EXCEPT THE HEADER'S TICK. A button
  // inside a form submits it unless told otherwise, and "Remove language" saved
  // the row instead of asking to remove it until the test for it said so.
  return (
    <form id={host?.formId} onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="lang-editor">
      <Field
        label={t('settings.languages.name.label')}
        value={d.name}
        placeholder={row.canonical}
        maxLength={LANGUAGE_NAME_MAX_RUNES}
        onChange={(e) => setD({ ...d, name: e.target.value })}
      />

      {/* WHICH LANGUAGE, EXACTLY. A row's name is what the reader calls it; the
          ISO 639-3 code is which language that is — Ancient Greek is `grc`, not
          `el`, and Sylheti has no two-letter code at all. */}
      <div className="lang-editor-block">
        <MonoLabel>{t('settings.languages.iso.label')}</MonoLabel>
        {linking ? (
          <ISO6393Search
            label={t('settings.languages.iso.label')}
            autoFocus
            onPick={(p) => { setD({ ...d, iso: p.iso }); setLinking(false) }}
            onCancel={() => setLinking(false)}
          />
        ) : (
          <div className="lang-iso-line">
            {iso ? (
              <>
                <span className="iso-code">{iso}</span>
                <span className="lang-iso-name">{isoName}</span>
              </>
            ) : (
              <span className="microcopy">{t('settings.languages.iso.none')}</span>
            )}
            <GhostButton type="button" icon={<IconSearch />} onClick={() => setLinking(true)}>
              {t(iso ? 'settings.languages.iso.change.label' : 'settings.languages.iso.link.label')}
            </GhostButton>
            {d.iso && (
              <FieldIconButton
                type="button"
                icon={<IconClose />}
                ariaLabel={t('settings.languages.iso.clear.aria')}
                tooltip={t('settings.languages.iso.clear.aria')}
                onClick={() => setD({ ...d, iso: '' })}
              />
            )}
          </div>
        )}
      </div>

      {d.face != null && (
        <div className="lang-editor-block">
          <MonoLabel>{t('settings.quote-faces.title')}</MonoLabel>
          <div className="lang-face-line">
            <QuoteFaceSample languageKey={row.key} name={row.name} face={faceById(d.face)} />
            <QuoteFaceSelect languageKey={row.key} name={row.name} value={d.face} onChange={(id) => setD({ ...d, face: id || '' })} />
          </div>
        </div>
      )}

      <div className="lang-editor-block">
        <MonoLabel>{t('settings.languages.mark.title')}</MonoLabel>
        {row.glyphs.length === 0 && (
          <p className="microcopy">{t('settings.languages.no-script.prose', { name: row.canonical })}</p>
        )}
        {/* ONE GRID, EQUAL CELLS: the script's letters, then the reader's own, then
            the cell that adds one. Every language's picker is this shape. */}
        {/* A RADIO GROUP, not a listbox: one mark is chosen out of a set that is
            always open. A listbox is a popup's role, and the app's own journey
            harness reads an open one as the menu a reader is answering. */}
        <div className="mark-grid" role="radiogroup" aria-label={t('settings.languages.glyphs.aria', { name: row.canonical })}>
          {row.glyphs.map((g, i) => (
            <button
              key={`s-${g}`}
              type="button"
              role="radio"
              aria-checked={chosen(g, i, true)}
              aria-label={g}
              className={'mark-cell' + (chosen(g, i, true) ? ' is-on' : '')}
              onClick={() => setD({ ...d, mark: i === 0 ? '' : g })}
            >
              {g}
            </button>
          ))}
          {d.customs.map((g) => (
            <span key={`c-${g}`} className="mark-cell-wrap">
              <button
                type="button"
                role="radio"
                aria-checked={d.mark === g}
                aria-label={g}
                className={'mark-cell is-custom' + (d.mark === g ? ' is-on' : '')}
                onClick={() => setD({ ...d, mark: g })}
              >
                {g}
              </button>
              <button
                type="button"
                className="mark-cell-remove"
                aria-label={t('settings.languages.mark.remove.aria', { name: g, field: row.canonical })}
                onClick={() => dropCustom(g)}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
          {!full && (draft === null ? (
            <button
              type="button"
              className="mark-cell is-add"
              aria-label={t('settings.languages.add-mark.aria')}
              onClick={() => setDraft('')}
            >
              <IconPlus size={18} />
            </button>
          ) : (
            <input
              className="mark-cell is-typing"
              autoFocus
              aria-label={t('settings.languages.add-mark.aria')}
              value={draft}
              maxLength={MARK_MAX_RUNES}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => addCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom(e.currentTarget.value) }
                if (e.key === 'Escape') { e.preventDefault(); setDraft(null) }
              }}
            />
          ))}
        </div>
        {full && <p className="microcopy">{t('settings.languages.full.prose', { name: row.canonical, n: MAX_CUSTOM_MARKS })}</p>}
      </div>

      <div className="lang-editor-foot">
        {(row.mark || row.renamed) && (
          <GhostButton type="button" icon={<IconReset />} onClick={onReset}>{t('settings.languages.reset.label')}</GhostButton>
        )}
        <span className="flex-1" />
        {/* DRAWN EVEN WHERE IT IS REFUSED, and saying why: a language the library
            holds comes straight back, so removing it would be a control that
            undoes itself. */}
        <Tooltip label={row.inLibrary ? t('settings.languages.remove.in-use.tip', { name: row.canonical }) : null} side="top">
          <GhostButton type="button" icon={<IconDelete />} keepLabel disabled={row.inLibrary} style={row.inLibrary ? undefined : { color: 'var(--error)' }} onClick={onRemove}>
            {t('settings.languages.remove.label')}
          </GhostButton>
        </Tooltip>
      </div>
    </form>
  )
}
