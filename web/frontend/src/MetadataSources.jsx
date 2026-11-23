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
import { Card, ErrorText, FieldIconButton, FormModal, GhostButton, IconCheck, IconClose, IconEdit, IconFetch, IconNavUsers, IconNavWorks, InfoDot, MonoLabel, SourceIcon, Tally, toast, Toggle, Tooltip } from './ui.jsx'
import { useMasonry } from './masonry.js'
import { CardHead } from './prefRow.jsx'

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
function SourceRows({ admin, sources, scrapeOn = false, info = null, editors = null, saveError = null, onTested }) {
  // WHICH ROW IS BEING ASKED, by slug, and '' for none. A single busy flag would
  // grey out twelve rows because one of them is being tested.
  const [asking, setAsking] = useState('')
  const [err, setErr] = useState('')
  // WHICH ROWS' SETUPS ARE OPEN, by slug. Opening one leaves the others as they
  // were: a reader pasting IGDB's pair beside TheTVDB's key is doing one job.
  const [open, setOpen] = useState(() => new Set())
  const toggle = (slug) => setOpen((o) => {
    const next = new Set(o)
    if (!next.delete(slug)) next.add(slug)
    return next
  })

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
      {/* THE HEAD HOLDS ITS TITLE AND ONE VERB, ON ONE ROW. The owner: "The button
          on top of the 'who the app can ask' should be 'test all', and in the same
          row as the card header. 'Records supplied' text callout has no need to be
          there." The caption and the issues line beside it pushed the button onto a
          row of its own on a phone; the caption went, and each row's count keeps its
          own tooltip saying what it counts. */}
      <CardHead title={t('settings.sources.group.title')} info={info}>
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
      </CardHead>
      {/* THE PACK'S ISSUES LINE (metadata.dc.html:845), under the head rather than
          in it: the one number on this list worth leading with, and silent when
          there is nothing to say, which is this console's rule. */}
      {needKey > 0 && (
        <p className="microcopy" style={{ color: 'var(--error)' }}>
          {t('settings.sources.need-key.prose', { count: needKey })}
        </p>
      )}
      {sources.map((row) => {
        const name = sourceName(row.source)
        // WHAT IT SUPPLIES, COMPOSED FROM THE AREAS rather than written per
        // supplier. The app already names the four areas for the fault chips, so a
        // supplier that gains one says so without a new string — and there is no
        // per-supplier prose here to translate twelve times.
        const supplies = (row.areas || []).map((a) => t(`settings.metadata.area.${a}.label`)).join(' · ')
        const last = row.last
        const off = row.source === 'google-images' && !scrapeOn
        const editor = admin ? editors?.[row.source] : null
        // NO ANSWER ON RECORD IS A FACT, NOT A WARNING, and it is worth drawing:
        // every ask a supplier answers records one (lookups, picture searches,
        // Test, fills, Rescans, Fetch missing, a person's portrait and links), so a
        // quiet row is one nothing has asked since the server started, and would
        // otherwise be indistinguishable from one whose answer failed to render.
        //
        // IT SAYS WHOSE FACT IT IS. The record is the server's memory of each
        // source's last answer, since it started (metadata_faults.go keeps it in
        // memory on purpose), and the old words, "nothing has asked it yet", read
        // as a claim about the source. The owner, seeing them on every row until
        // a Test: "What is it meant to convey?"
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
            {/* FIELDS | WORKS, and people where it filled any. The owner: "not just
                the count of works and peoples, but of fields. \"Fields | works\"".
                The works and people wear the console's own section glyphs, the
                doors beside this card; the word stays on fields, the count the row
                leads with. Zero fields reads "0 fields", and " · " and the people
                after it where a supplier filled people and no field. Only a
                supplier that cannot be asked and has written nothing at all is
                red: one that needs a key and has supplied fields, works or people
                is not a warning, and its tooltip does not say nothing came from it. */}
            <Tooltip
              label={row.fields
                ? t('settings.sources.records.tip', { count: row.fields, source: name })
                : row.people
                  ? t('settings.sources.records.people.tip', { count: row.people, source: name })
                  : t('settings.sources.records.none.tip', { source: name })}
            >
              <span className={'src-row-count' + (row.state === 'needed' && !row.fields && !row.works && !row.people ? ' is-needed' : '')}>
                {t('settings.sources.fields', { count: row.fields || 0, n: row.fields || 0 })}
                {row.works > 0 && <> | <Tally n={row.works} icon={<IconNavWorks />} word={t('unit.work', { count: row.works })} /></>}
                {row.people > 0 && <> · <Tally n={row.people} icon={<IconNavUsers />} word={t('unit.person', { count: row.people })} /></>}
              </span>
            </Tooltip>
            {admin && (
              <span className="src-row-verbs">
              {/* THE ROW'S OWN KEYS, BEHIND ITS OWN DOOR. The owner: "who the app
                  can ask, and keys and credentials can be merged into one card …
                  Just add the edit buttons in the 'who the app can ask' card." A
                  supplier's credentials were on a second card, a scroll away from
                  the row whose mark they turn green. A supplier that takes nothing
                  draws no door. */}
              {editor && (
                <FieldIconButton
                  icon={<IconEdit />}
                  ariaLabel={t('settings.sources.setup.aria', { source: name })}
                  active={open.has(row.source)}
                  aria-expanded={open.has(row.source)}
                  onClick={() => toggle(row.source)}
                />
              )}
              <FieldIconButton
                icon={<IconFetch />}
                ariaLabel={t('settings.sources.test.aria', { source: name })}
                tooltip={off
                  ? t('settings.sources.test.off.tip', { source: name })
                  : t('settings.sources.test.tip', { source: name })}
                // AND NOT FOR A SOURCE THAT CANNOT BE ASKED AT ALL. A press
                // that could only report "no key" is a press that tells the
                // reader what the mark beside it already says — and it used to
                // report nothing whatsoever, which a rating caught. Google's
                // image results are asked only once the instance has said yes to
                // them, and the tip says where that switch is.
                disabled={!!asking || row.state === 'needed' || off}
                onClick={() => test(row.source)}
              />
              </span>
            )}
            {/* WHAT IT SAID, UNDER THE ROW IT IS ABOUT. A press with no visible
                answer is a press a reader repeats. */}
            {said && (
              <p className={'src-row-last is-' + said[0]}>
                {asking === row.source ? t('settings.sources.testing.label') : said[1]}
                {last?.error ? ` — ${last.error}` : ''}
              </p>
            )}
            {editor && open.has(row.source) && (
              <div className="src-row-keys">
                {editor}
                {/* A FAILED SAVE SAYS SO UNDER THE SETUP IT FAILED IN, after all of
                    that row's fields (TheTVDB's key and pin, IGDB's id and secret).
                    It printed at the card's foot, below the legend and the fault
                    chips, a phone's screen away from the row a reader had just
                    pressed Save in. */}
                {saveError?.source === row.source && <ErrorText>{saveError.text}</ErrorText>}
              </div>
            )}
          </div>
        )
      })}
      <ErrorText>{err}</ErrorText>
    </div>
  )
}

// Which row each key field belongs to, so a failed save is told under that row.
const KEY_SOURCE = {
  google_books_key: 'google', tmdb_key: 'tmdb', tvdb_key: 'tvdb', tvdb_pin: 'tvdb',
  igdb_client_id: 'igdb', igdb_secret: 'igdb', amazon_cookie: 'amazon', amazon_domain: 'amazon',
}

export function MetadataSources({ user, onPreferences }) {
  const admin = user.is_admin
  const [status, setStatus] = useState(null)
  const [keys, setKeys] = useState(null) // {tmdb_key_set, google_books_key_set, amazon_cookie_set, amazon_domain}
  // { source, text }: which row's setup failed to save, so its words print under
  // that row's fields rather than at the foot of a twelve-row card.
  const [error, setError] = useState(null)
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
    setError(null)
    const r = await json('PUT', '/admin/metadata-keys', { [field]: value.trim() })
    setSaving(false)
    if (!r.ok) {
      setError({ source: KEY_SOURCE[field], text: errText(r, t('error.save.generic')) })
      return false
    }
    await Promise.all([loadStatus(), loadKeys()])
    toast(value.trim() ? t('common.toast.saved') : t('settings.keys.toast.cleared'))
    return true
  }

  // EACH SUPPLIER'S SETUP, OPENED FROM ITS OWN ROW. The keys were a card of their
  // own, "Keys and credentials", under the list of suppliers: the row saying TMDB
  // needed a key was a scroll away from the field that fixes it. The owner: "who the
  // app can ask, and keys and credentials can be merged into one card (full width in
  // desktop). Just add the edit buttons in the 'who the app can ask' card. The
  // combined card can be renamed to 'all sources'." So a row that takes a key, a pin,
  // a cookie or a switch carries a door to exactly those, and nothing else changed:
  // the same fields, the same per-field save, the same admin gate (a reader who is not
  // one sees the rows and no doors, as the second card was simply absent for them).
  const editors = admin ? {
    google: (
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
    ),
    tmdb: (
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
    ),
    // THE KEY FIRST AND THE PIN UNDER IT, which is both the order they are needed
    // in and the order the copy claims: a project key, the kind bundled with the
    // app, authenticates on its own and never sends a pin (login() in tvdb.go
    // omits it when empty); only the free user-supported key needs one.
    tvdb: (
      <>
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
      </>
    ),
    // IGDB IS A PAIR, AND BOTH HALVES GET A ROW, with no built-in fallback: IGDB
    // credentials are per-application and rate-limited, so a shared key would be a
    // shared quota. Half a pair fails at Twitch's token exchange with "invalid
    // client", which reads as games being broken when one field is blank, so that
    // one state is named under the pair.
    igdb: (
      <>
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
        {keys && (!!keys.igdb_client_id_set !== !!keys.igdb_secret_set) && (
          <p className="microcopy mt-1" style={{ color: 'var(--error)' }}>
            {t('settings.metadata.igdb.half.prose', {
              half: t(keys.igdb_client_id_set ? 'settings.keys.noun.secret' : 'settings.keys.noun.client-id'),
            })}
          </p>
        )}
      </>
    ),
    // THE COOKIE IS A .caveat, NOT A .hint: a security warning with a procedure in
    // it (fragile, against Amazon's terms, grants account access) that runs past the
    // dot's 240-character budget and cannot lose a clause to fit. The marketplace is
    // the two letters that differ; see amazonSuffix.
    amazon: (
      <>
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
        <KeyField
          label={keyLabel('amazon', 'domain')}
          source="amazon"
          hint={t('settings.keys.amazon-domain.hint')}
          need="optional"
          secret={false}
          value={amazonSuffix(keys?.amazon_domain)}
          set={!!keys?.amazon_domain}
          placeholder={t('settings.keys.amazon-domain.placeholder')}
          busy={saving}
          onSave={(v) => saveKey('amazon_domain', amazonHost(v))}
        />
      </>
    ),
    // GOOGLE'S IMAGE RESULTS TAKE A SWITCH, NOT A KEY, and the switch is the
    // consent: reading the results page needs no credential, so the yes has nowhere
    // else to live. It is the picture ladder's last rung, so it is that rung's row
    // it opens from. Short on the page, whole in the accessible name (WCAG 2.5.3).
    'google-images': (
      <div className="inline-field">
        <div className="mb-2 flex items-center gap-1.5">
          <MonoLabel>{t('settings.keys.google-scrape.title')}</MonoLabel>
          <InfoDot text={t('settings.keys.google-scrape.info.body')} />
        </div>
        <Toggle
          ariaLabel={t('settings.keys.google-scrape.aria')}
          value={keys?.google_scrape ? 'on' : 'off'}
          onChange={async (v) => {
            setSaving(true)
            setError(null)
            const r = await json('PUT', '/admin/metadata-keys', { google_scrape: v === 'on' })
            setSaving(false)
            if (!r.ok) { setError({ source: 'google-images', text: errText(r, t('error.save.generic')) }); return }
            await Promise.all([loadStatus(), loadKeys()])
            toast(t('common.toast.saved'))
          }}
          options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
        />
      </div>
    ),
  } : null

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
    <Card pad="" className="pref-group is-wide" data-tour="metadata-keys">
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
      <SourceRows
        admin={admin}
        sources={status?.sources}
        scrapeOn={!!keys?.google_scrape}
        info={t('settings.keys.card.info')}
        editors={editors}
        saveError={error}
        onTested={loadStatus}
      />

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

    {/* THE CREDENTIALS HAD A CARD OF THEIR OWN HERE, on the owner's earlier ruling
        ("split the API keys into their own subsection with cards"), because the
        fields sat under the supplier list with no heading between them and a
        reader who was not an admin watched the card stop with nothing saying why.
        The owner has since merged them back, and the reason for the split is
        answered another way: each supplier's fields open from that supplier's own
        row (`editors` above), so the row is their heading, and a reader who is not
        an admin sees the rows with no doors on them. */}

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
      <Card pad="" className="pref-group">
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
    <div>
      <CardHead title={t('settings.credits.title')} info={t('settings.credits.info.body')} />
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
