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
import { t } from './i18n.js'
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
  toast,
  Toggle,
  Tooltip,
  SourceIcon,
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

// StatusChip and IconSaved came with the block: after the move Settings had no
// other caller for either, and a component left behind in the file that stopped
// using it is the shape of thing nobody deletes.
// StatusChip — small mono pill; tone drives the palette (§2 chips).
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

// IconSaved — a floppy disk with a tick: this key is stored.
//
// A BADGE, NOT A BUTTON. It reports; there is nothing to press. So it is a span
// with role="img" and a real label rather than a disabled button, which would be
// a tab stop that does nothing and would announce itself as an action.
//
// The disk's outline stops short of its bottom-right corner and the tick sits in
// the gap. Two closed shapes overlapping at 18px read as one smudge, and the
// whole point of the glyph is to be legible at a glance in a row of controls.
function IconSaved() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.2 19.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5h8.3L19.5 9.7v2.9" />
      <path d="M9 4.5v3.7h5.4V4.5" />
      <path d="M13.9 17.9l2.1 2.1 4-4.6" />
    </svg>
  )
}

// NEED_TONE maps a row's consequence to the chip palette. `bundled` is 'active'
// and not 'ok' on purpose: it is a live fact about what is answering right now,
// the same tone the built-in chips beside the heading already use.
const NEED_TONE = { bundled: 'active', required: 'error', optional: 'muted', closed: 'muted' }

// LITERAL KEYS IN A MAP, never t('prefix.' + x + '.label'). locale-complete.test.js
// verifies statically that every key the code asks for exists and that every key
// in en.txt is asked for, and a key assembled at runtime defeats both halves: the
// scan reads the prefix as a missing key and the four real ones as orphans. Same
// shape as SOURCE_KEYS in CoverPicker.jsx, for the same reason.
const NEED_LABEL = {
  bundled: 'settings.keys.need.bundled.label',
  required: 'settings.keys.need.required.label',
  optional: 'settings.keys.need.optional.label',
  closed: 'settings.keys.need.closed.label',
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
        {source ? <SourceIcon source={source} side="right" /> : null}
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

            So each row says which it is, in one word, before the label's own
            tooltip has to be opened. The wording is about CONSEQUENCE and not
            about status — "built in" rather than "configured" — because the
            question being answered is "must I do something about this". */}
        {need && (
          <StatusChip tone={NEED_TONE[need]}>{t(NEED_LABEL[need])}</StatusChip>
        )}
        {hint && <InfoDot text={hint} title={label} />}
        {!secret && !editing && (
          <span className={'inline-field-inline' + (value ? '' : ' is-empty')}>{value || t('settings.keys.unset.label')}</span>
        )}
        <span className="flex-1" />
        {saved && !editing && (
          <Tooltip label={t('settings.keys.saved.tip')}>
            <span className="field-badge" role="img" aria-label={t('settings.keys.saved.aria', { name: label })}>
              <IconSaved />
            </span>
          </Tooltip>
        )}
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
  // What survives is the pair a key field genuinely cannot report: that lookups
  // are running on the shared built-in key even though you have set nothing, and
  // that they are running on nothing at all and will 503.
  const tmdbChip =
    source === 'builtin' ? ['active', 'settings.metadata.tmdb.builtin.label']
      : source === 'none' ? ['error', 'settings.metadata.tmdb.none.label']
        : null
  // THE SAME FACT ABOUT THE DEFAULT SOURCE. TheTVDB has a built-in slot too now,
  // and "you have set nothing and lookups are running anyway" is precisely the
  // thing a key field cannot report. There is no `none` chip beside it: an unset
  // optional key is the ordinary state of a self-built binary, not a fault — the
  // TMDB chip already says when there is nothing at all to look in.
  const tvdbChip =
    status?.tvdb?.source === 'builtin' ? ['active', 'settings.metadata.tvdb.builtin.label'] : null

  // THE ONE-TIME NOTICE THAT THE DEFAULT FILM SOURCE MOVED (2.2.0), and it earns
  // a chip under this section's own rule — "a chip here means something to act
  // on" — because there is a specific action: re-verify those titles and their
  // cast gains a picture per character, which is the whole reason the default
  // moved to TheTVDB.
  //
  // The server decides whether it applies, not this component. It is shown only
  // to an instance that EXISTED before the change (a one-time pass wrote the
  // marker) and only while that reader still has titles pinned to TMDB alone — so
  // it clears itself as they work through them and needs no dismiss button, and no
  // stored dismissal to go stale. A fresh install never sees it at all, because a
  // notice about a change you never lived through is a sentence the app made up.
  const moved = status?.film_source_notice
  const filmSourceChip = moved
    ? ['active', 'settings.metadata.filmsource.moved.label', { n: moved.tmdb_pinned }]
    : null

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
    <Card data-tour="metadata-keys">
      <SectionTitle info={t('settings.metadata.info.body')}>
        {t('settings.metadata.title')}
      </SectionTitle>

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
      {(booksChip || tmdbChip || tvdbChip || filmSourceChip) && (
        <div className="flex flex-wrap items-center gap-2">
          {booksChip && <StatusChip tone={booksChip[0]}>{t(booksChip[1])}</StatusChip>}
          {tvdbChip && <StatusChip tone={tvdbChip[0]}>{t(tvdbChip[1])}</StatusChip>}
          {tmdbChip && <StatusChip tone={tmdbChip[0]}>{t(tmdbChip[1])}</StatusChip>}
          {filmSourceChip && <StatusChip tone={filmSourceChip[0]}>{t(filmSourceChip[1], filmSourceChip[2])}</StatusChip>}
        </div>
      )}
      {/* The chip says how many; this says what to do about them. Same shape as
          the lookup error below it, and for the same reason: a count with no
          instruction is a number somebody has to come and ask about. */}
      {filmSourceChip && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)' }}>
          {t('settings.metadata.filmsource.moved.prose')}
        </p>
      )}
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
                and would then lose. What is left of Google is the toggle below,
                which needs no credential at all — which is why it is a setting
                rather than a key, and why it sits under Amazon's cookie beside
                the other thing the reader has to agree to rather than obtain. */}
            {/* THE SCRAPE'S OPT-IN, and the only control on this card that is
                not a credential.

                Every other switch here is implicit in a secret: you cannot use
                the Amazon scrape without storing the cookie that says you meant
                to, so the key field IS the consent. Scraping Google's image
                results needs nothing at all, which leaves the consent with
                nowhere to live — hence a setting, and hence a control, because a
                setting with no control is a feature nobody can reach.

                It sits under the Programmable Search pair because it is the same
                index read a worse way, and anybody who fills in the two fields
                above never reaches it. */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5">
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
            <KeyField
              label={keyLabel('amazon', 'domain')}
              source="amazon"
              hint={t('settings.keys.amazon-domain.hint')}
              need="optional"
              secret={false}
              value={keys?.amazon_domain || ''}
              set={!!keys?.amazon_domain}
              placeholder={t('settings.keys.amazon-domain.placeholder')}
              busy={saving}
              onSave={(v) => saveKey('amazon_domain', v)}
            />
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {/* Last, and a section rather than a card: a lookup hands back one credit
          string and this decides whether it names one person or two. */}
      <CreditSeparators user={user} onPreferences={onPreferences} />

      {/* And the door to Language marks, which hung off Appearance from 1.15.2
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
      <FormModal open={marksOpen} onClose={() => setMarksOpen(false)} title={t('settings.languages.title')} maxWidth={560}>
        <LanguageMarksSettings prefs={user.preferences} onSaved={onPreferences} />
      </FormModal>
    </Card>
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
function LanguageMarksSettings({ prefs, onSaved }) {
  const [rows, setRows] = useState(() => languageMarksState())
  const [picking, setPicking] = useState(null) // the language whose tray is open
  const [draft, setDraft] = useState('') // the "add your own" box, per open tray
  const [adding, setAdding] = useState('') // the new-language box, '' = closed
  const [err, setErr] = useState('')

  // Re-seed when the session prefs change under us — another tab, or the account
  // switching. Reads the APPLIED marks, so this stays in step with what is on
  // screen rather than with a stale prop, exactly as the colour card does.
  useEffect(() => { setRows(languageMarksState()) }, [prefs])

  // save takes the WHOLE next entry rather than a mark, because every control in
  // the tray changes a different field of one row and a mark-shaped save would
  // have to be three of them.
  async function save(key, patch) {
    const all = currentLanguageEntries()
    const cur = all[key] || { mark: '', customs: [], name: '' }
    all[key] = { ...cur, ...patch }
    const blob = languageMarksBlob(all)
    applyLanguageMarks({ languageMarks: blob })
    setRows(languageMarksState(Object.keys(all)))
    const r = await json('PUT', '/auth/me/preferences', { languageMarks: blob })
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      // Back to what the server still believes, so the panel can never show a
      // mark that was refused.
      applyLanguageMarks(prefs || {})
      setRows(languageMarksState())
      return
    }
    setErr('')
    onSaved?.({ languageMarks: blob })
  }

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
