// The person panel and the character page: a record, and the three scopes a
// change to it can have.
//
// THE SPLIT IS THE SCHEMA, which is the design pack's own sentence and the reason
// this file is shaped the way it is:
//
//   * ON THIS WORK — the credit link, and nothing else. Changing how one book
//     prints a name touches `work_person.credit_as` for that row.
//   * ACROSS THE LIBRARY — what the record is in, and every other spelling that
//     finds it. Read, plus the deliberate act of filing an alias.
//   * THIS PERSON — the record itself. A change here reaches every work.
//
// A READER WHO CANNOT TELL THOSE APART WILL RENAME AN AUTHOR ON THIRTY-ONE BOOKS
// BY ACCIDENT, so each section says its scope in its own words above its fields,
// and the two writes go to two different endpoints. That is not defensive coding;
// it is the difference between "this cover says M. Bulgakov" and "this person is
// called M. Bulgakov", and the app has no way to ask which one you meant.
//
// THESE ARE THE PANEL STACK'S FIRST USERS. usePanelStack landed with the shell and
// nothing had consumed it — the work detail is where it was going. So the idiom
// gets set here: a panel is a plain descriptor, `{ title, render }`, and a factory
// takes the stack so a panel can push its sibling. The person panel pushes a
// character; the character panel pushes the performer. Neither knows how deep it
// is, and Back is the browser's.
import { useCallback, useEffect, useState } from 'react'
import { coverImgURL, errText, json, uploadWithProgress } from './api.js'
import { t } from './i18n.js'
import { useCharacterPicture, usePicturePicker } from './cast.jsx'
// movieState shapes the full-state PUT body — see setRole. Movies.jsx does not
// import this file, so the pair is not a cycle.
import { movieState } from './Movies.jsx'
import { CharacterGlobal, PersonGlobal } from './identityGlobal.jsx'
import { identityScope, mediumOf } from './identityScope.js'
import { CharacterLocal, GLYPH_NAME } from './identityLocal.jsx'
import { ChoosePicker, FieldPicker } from './identityPicker.jsx'
import { buildProviderLink, isOrganisation, personImgURL, providerLinksFor, ProviderChips, SpeakerChips } from './people.jsx'
import { Silhouette } from './silhouette.jsx'
import {
  ConfirmDialog,
  FormModal,
  useFormHost,
  EmptyState,
  ErrorText,
  ExpandableText,
  FieldIconButton,
  GhostButton,
  IconDelete,
  IconGlobe,
  IconPlus,
  NavIcon,
  InfoDot,
  MonoLabel,
  Scroller,
  toast,
  Tooltip,
} from './ui.jsx'

// A section's stack, from the app's own spacing constant rather than a typed step
// — see the standing rule, and spacing-debt.test.js, which counts the typed ones.
const STACK = { display: 'grid', gap: 'var(--row)' }
// THE PACK'S FIVE, FROM THE LOCALE, and the first draft of this had them as a
// literal here with a paragraph arguing that language names should not be
// translated — a Bengali dub reads "বাংলা" whoever is looking. The reasoning is
// fine and the placement was not: `no-hardcoded-bengali.test.js` failed it, and
// that rule is not about translation but about where copy lives. So the list is
// one key, carrying the same five names in both locales — the argument survives
// as identical values rather than as a literal in a component.
const FIELDS = { display: 'grid', gap: 'calc(var(--row) * 0.9)' }

// ---- the panels, as descriptors --------------------------------------------

// personPanel — open a person by id. `work` puts the first scope on screen; open
// it from a list and there is no work to be on, so that section is simply absent
// rather than present and inert.
export function personPanel(stack, { id, name, work = null, onOpenWork = null }) {
  return {
    title: name || t('identity.person.title'),
    wide: true,
    render: () => <PersonBody stack={stack} id={id} work={work} onOpenWork={onOpenWork} />,
  }
}

// characterPanel — the same, for the other table, and `work` does the same job it
// does above: opened from a work's cast list there IS a work to be on, and that
// appearance leads rather than sitting somewhere in a grid of eight.
//
// `work.castId` NAMES THE ROW, and a caller that has it must pass it. A work can
// bill one character TWICE — `idx_work_cast_pair` is unique on
// (kind, work_id, character_key, actor_key), so the young Vito and the old Vito
// are two rows on one film, both pointing at one `characters` record — and a
// lookup by work alone cannot tell them apart. It returns the first, so pressing
// the second row lifted the first and then counted its sibling among "the others".
// `onSearch` IS THE COUNTS' DOOR, and it is threaded rather than reached for.
// The pack's local sheet makes both counts pressable — "37 quotes" lands on the
// search screen with this character and this work already up as chips, which is
// the question the number summarises. Only the shell can navigate, so the screen
// that opens this panel hands the verb down. A caller without one gets the counts
// as figures, which is the honest degradation: a number nobody can open is still
// the number.
export function characterPanel(stack, { id, name, work = null, onSearch = null, onOpenWork = null }) {
  return {
    title: name || t('identity.character.title'),
    wide: true,
    render: () => <CharacterBody stack={stack} id={id} work={work} onSearch={onSearch} onOpenWork={onOpenWork} />,
  }
}

// ---- shared pieces ---------------------------------------------------------

// `inputId` EXISTS FOR THE ROWS ABOVE IT. The pack's screens print a saved value
// as a row and let you press it; the editor is one field further down. Rather
// than a second copy of the value inside the row, the row is a shortcut — press
// it and the caret lands in the field that owns it — so there is one place the
// value is typed and one place it is read.
function Field({ label, value, onChange, rows = 0, inputId }) {
  return (
    <label className="block">
      <MonoLabel className="mb-1.5 block">{label}</MonoLabel>
      {rows > 0 ? (
        <textarea id={inputId} className="tp-input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={inputId} className="tp-input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

// focusField — the shortcut a pack row performs. Scrolled into view first,
// because a caret that lands off-screen reads as a press that did nothing.
//
// THE LOCAL SHEET NO LONGER USES THIS, and the reason is worth keeping because it
// is why the mechanism is the wrong one wherever it can be avoided. Its six
// per-work fields sat in a `<details className="cs-local-fields">` with no `open`
// attribute and no stylesheet rule to force one, so `getElementById` found the
// element and neither `scrollIntoView` nor `focus()` could act: a closed
// disclosure does not render its children, and an unrendered element is not a
// focusable area. Six rows on a panel whose whole shape is "the row states the
// value, press it to change it" therefore did nothing. Teaching this function to
// open the fold made them work; giving those rows the pack's picker instead
// (`identityPicker.jsx`) means there is no fold, no caret and no id to get wrong.
//
// The two GLOBAL scopes still call it, and until their blocks get the same
// treatment the fold-opening walk stays: every closed ancestor rather than just
// the nearest, because a half-opened chain is the same dead press with a harder
// cause.
function focusField(id) {
  const el = typeof document === 'undefined' ? null : document.getElementById(id)
  if (!el) return
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.tagName === 'DETAILS' && !n.open) n.open = true
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus()
}

// GlobalFields — the identity's own fields, wearing the panel's own tick and cross.
//
// WHAT IT REPLACES. The two global sheets each carried this block with a
// `GhostButton` reading "Save" under it, and that button is neither half of the
// standing pair: it cannot go red, it carries no count, and the panel's ✓ — which
// `PanelHost` draws from whatever its body registers — stayed absent, because
// nothing registered. So a panel that is entirely a form had a commit verb in its
// body and an empty slot in its head, and its ✕ threw away typing without asking.
//
// WHY IT IS A COMPONENT AND NOT A BLOCK, which is the whole reason this is fifteen
// lines rather than three. `useFormHost` must be called by a CHILD of the surface
// it joins — CLAUDE.md lists that under Gotchas — and it has no way to say "there
// is no form here": `setBlocked(reason || "")` registers a ✓ whatever it is
// passed. A hook called at the top of a body that renders three scopes would
// therefore draw a ✓ on all three, and on the two holding no form that ✓ would
// submit nothing. A dead control in the panel's head is the exact defect this file
// has spent the session clearing. Mounting the form as its own component is what
// makes "there is a form here" and "there is a ✓ here" one fact instead of two.
function GlobalFields({ fields, form, onForm, stored, busy, blocked, onSave }) {
  // WHAT THIS PRESS WILL CHANGE, field by field against what is stored — not
  // "the form has been touched". Retyping a value is not a change and neither is
  // focus, which is the half of the rule that keeps a lit tick worth reading.
  const changed = fields.filter(
    (f) => String(form?.[f.key] ?? '').trim() !== String(stored?.[f.key] ?? '').trim(),
  ).length
  const host = useFormHost(busy ? t('common.action.save.busy') : (blocked || ''))
  useEffect(() => {
    host?.setDirty?.(changed)
    return () => host?.setDirty?.(0)
  }, [host, changed])
  return (
    <form
      id={host?.formId}
      style={FIELDS}
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy && !blocked) onSave()
      }}
    >
      {fields.map((f) => (
        <Field
          key={f.key}
          inputId={f.id}
          label={f.label}
          value={form?.[f.key] ?? ''}
          rows={f.rows || 0}
          onChange={(v) => onForm({ ...form, [f.key]: v })}
        />
      ))}
    </form>
  )
}

// AliasRow — the spellings that FIND this record, with the acts that add one,
// remove one, and split one back out.
//
// EACH CHIP IS A REASON A CREDIT STRING LANDED HERE rather than making a second
// record, which is what the copy above it says. A collision comes back as a 409
// with a sentence, and the sentence is shown rather than a generic failure —
// "somebody is already called that" is the whole of what the reader needs.
//
// REMOVE AND SPLIT ARE DIFFERENT ACTS AND BOTH ARE OFFERED. Removing unfiles the
// spelling and the app stops knowing who it is; splitting gives it a record of its
// own. A reader who merged two people by mistake wants the second, and the label
// says what it does and does not do — the works stay where they are, because
// nothing in the schema remembers which of them came from where.
function AliasRow({ aliases, onAdd, onRemove, onSplit }) {
  const [draft, setDraft] = useState('')
  return (
    <div style={FIELDS}>
      <div className="flex flex-wrap items-center gap-2">
        {aliases.length === 0 && (
          <span className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.alias.none')}</span>
        )}
        {aliases.map((a) => (
          <span key={a} className="tp-filter-chip" style={{ cursor: 'default' }}>
            {a}
            {/* SPLIT SITS BEFORE THE ×, because it is the gentler of the two and the
                one a reader undoing a bad merge is looking for. A word rather than a
                glyph: there is no picture of "give this spelling its own record". */}
            {onSplit && (
              <button
                type="button"
                className="tp-link"
                style={{ marginLeft: '.5em', fontSize: '.85em' }}
                onClick={() => onSplit(a)}
              >
                {t('identity.alias.split.label')}
              </button>
            )}
            {/* AN × AT THE CHIP'S OWN SCALE. The first cut used IconDelete, which is
                a 22px trash can — the same visual weight as the word beside it, on a
                control whose whole job is to be smaller than what it removes. */}
            <button
              type="button"
              aria-label={t('identity.alias.remove.aria', { alias: a })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--soft)',
                marginLeft: '.45em', fontSize: '1.1em', lineHeight: 1, padding: 0,
              }}
              onClick={() => onRemove(a)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {/* THE CAVEAT IS ON THE PAGE, NOT IN A HOVER. "The works stay here" is the
          load-bearing half of what split does, and a title= says it only to a
          reader with a mouse — which on a phone is nobody. */}
      {onSplit && aliases.length > 0 && (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.split.tip')}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          className="tp-input"
          placeholder={t('identity.alias.add.placeholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (draft.trim()) onAdd(draft.trim()).then(() => setDraft(''))
            }
          }}
        />
        <GhostButton icon={<IconPlus />} disabled={!draft.trim()} onClick={() => onAdd(draft.trim()).then(() => setDraft(''))}>
          {t('identity.alias.add.label')}
        </GhostButton>
      </div>
    </div>
  )
}

// MergeControl — fold another record into this one.
//
// IT ASKS FIRST, AND THE CONFIRM SAYS WHAT WILL HAPPEN rather than "are you sure".
// The design pack is explicit that merge is the one destructive operation in this
// model and that the confirm has to carry the consequence; what a reader needs to
// know is that the other record goes, that its works come here, and that every
// cover goes on printing exactly what it prints today. The last of those is the
// one nobody would think to ask about and the one they would notice first.
//
// AND IT SAYS THE BIN HOLDS IT. The pack stops at "asks first"; this app's promise
// is stronger, and a reader who knows the way back is a reader who will actually
// tidy their library.
function MergeControl({ into, onMerged, onError, table = 'people', org = false }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  // BOTH TABLES, ONE CONTROL. 0056 gave characters their own search and their own
  // merge with the same shape as people's, and the case a character merge exists
  // for is the loudest one in the app: the backfill makes a record PER WORK, so
  // eight films of one wizard are eight Harry Potters. A second copy of this
  // control for them would be a second place the confirm's promise is worded.
  //
  // A COMPANY IS NOT A HUMAN BEING, and this sentence said so in as many words —
  // "two records for one human being become one" over Atari. The record it is
  // written about decides which noun it takes, from the same predicate the rest
  // of the screen reads.
  const body = table !== 'people'
    ? 'identity.merge.body.character'
    : org
      ? 'identity.merge.body.company'
      : 'identity.merge.body'

  useEffect(() => {
    if (!q.trim()) return setHits([])
    let stale = false
    json('GET', `/${table}/search?q=${encodeURIComponent(q.trim())}`).then((r) => {
      if (stale || !r.ok) return
      // Never this record: merging something into itself is refused by the server
      // and offering it here would be a row whose only outcome is an error.
      setHits((r.data[table] || []).filter((p) => p.id !== into.id))
    })
    return () => {
      stale = true
    }
  }, [q, into.id, table])

  const merge = async () => {
    setBusy(true)
    const r = await json('POST', `/${table}/merge`, { keep_id: into.id, drop_id: pick.id })
    setBusy(false)
    if (!r.ok) return onError(errText(r))
    toast(t('identity.merge.done', { name: pick.name, into: into.name }))
    setPick(null)
    setQ('')
    onMerged()
  }

  return (
    <div style={FIELDS}>
      <MonoLabel>{t('identity.merge.title')}</MonoLabel>
      <p className="microcopy" style={{ color: 'var(--soft)' }}>{t(body, { name: into.name })}</p>
      <input
        className="tp-input"
        placeholder={t('identity.merge.search.placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {hits.length > 0 && (
        <ul style={FIELDS}>
          {hits.map((p) => (
            <li key={p.id} className="flex items-baseline gap-2">
              <button type="button" className="tp-link" onClick={() => setPick(p)}>{p.name}</button>
              {/* HOW MUCH HANGS OFF THIS RECORD, beside its name. Two people
                  called the same thing is the case this control exists to
                  resolve, and the name alone cannot tell them apart. */}
              <span className="microcopy" style={{ color: 'var(--soft)' }}>
                {t('identity.merge.hit.works', { n: p.works || 0, count: p.works || 0 })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!pick}
        title={t('identity.merge.confirm.title', { name: pick?.name || '', into: into.name })}
        body={
          <div style={FIELDS}>
            <p className="microcopy">{t('identity.merge.confirm.body', { name: pick?.name || '', into: into.name })}</p>
            <p className="microcopy">{t('identity.merge.confirm.covers')}</p>
            <p className="microcopy">{t('identity.merge.confirm.undo')}</p>
          </div>
        }
        confirmLabel={t('identity.merge.confirm.action')}
        confirmDisabled={busy}
        onConfirm={merge}
        onCancel={() => setPick(null)}
      />
    </div>
  )
}

// useRecord — load one record and keep it, with the reload every write needs.
// ProviderLinkDialog — an id, a provider, and the address the app writes itself.
//
// WHAT THIS REPLACES. "Add a link" focused the free-text links field, so a reader
// holding a person's IMDb id had to know the page is /name/<id>/ — not /person/
// or /people/ — before they could type anything. The app has known those three
// patterns since it started fetching portraits (internal/metadata/people.go);
// the reader was looking up something the app could have written.
//
// THE PROVIDER IS A CHOICE AND THE ID IS TYPED, in that order, because the id's
// shape depends on the provider: `nm0000123` is an IMDb id and `1234` a TMDB
// one, and one box would have to guess between them. The hint under the field is
// the chosen provider's own example.
//
// THE LIST IS THE RECORD'S, not a constant: a studio has no IMDb /name/ page and
// a person has no IGDB company page, so providerLinksFor filters by the credits
// the record actually holds.
//
// THE ADDRESS IS SHOWN BEFORE IT IS SAVED. A reader who picked the wrong provider
// sees /person/nm0000123 and fixes it here rather than finding a dead pill later.
// A CHARACTER PASSES NO CREDITS, and gets the person list, which is right: a
// character is written up on IMDb, TMDB and a fandom wiki, and never has a
// company id space.
function ProviderLinkDialog({ open, onClose, onAdd, busy, credits = [] }) {
  const choices = providerLinksFor(credits)
  const [slug, setSlug] = useState(choices[0]?.[1] || '')
  const [id, setId] = useState('')
  useEffect(() => {
    if (!open) return
    setSlug(choices[0]?.[1] || '')
    setId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const url = buildProviderLink(slug, id)
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t('identity.link.id.title')}
      maxWidth={460}
      // THE STANDING PAIR: the tick lights, and counts, only once there is an
      // address to write; the cross is red because it discards.
      dirty={url ? 1 : 0}
      closeDanger
      saveTip={t('identity.link.id.save.tip')}
    >
      {/* THE FORM IS A CHILD, and it has to be. useFormHost reads the context
          FormModal puts around its CHILDREN, so calling it in the component that
          renders the modal reads whatever surface is further out — which left
          `blocked` null inside this dialog, and a null blocked means FormModal
          draws no ✓ at all. The popup rendered with a red ✕ and nothing to
          confirm with, which is half the standing pair and the wrong half. */}
      <ProviderLinkForm
        choices={choices}
        slug={slug}
        onSlug={setSlug}
        id={id}
        onId={setId}
        url={url}
        busy={busy}
        onAdd={onAdd}
      />
    </FormModal>
  )
}

// The body of the dialog above, split out for the one reason its comment gives.
function ProviderLinkForm({ choices, slug, onSlug, id, onId, url, busy, onAdd }) {
  const row = choices.find(([, sl]) => sl === slug)
  const blocked = busy
    ? t('common.action.save.busy')
    : url ? '' : t('identity.link.id.save.blocked')
  // Joins the dialog's header ✓ and tells it why it cannot save yet — the same
  // contract every other form in the app uses.
  const host = useFormHost(blocked)
  return (
    <form
      id={host?.formId}
      style={STACK}
      onSubmit={(e) => { e.preventDefault(); if (url) onAdd(url) }}
    >
      {/* ROUND MEANS A VALUE — the pack's rule, which is why the providers are
          pills and the field under them is not. */}
      <div className="cs-pills" role="radiogroup" aria-label={t('identity.link.id.provider.label')}>
        {choices.map(([, sl, labelKey]) => (
          <button
            key={sl}
            type="button"
            role="radio"
            aria-checked={sl === slug}
            // `active`, which is the class the stylesheet actually styles.
            // This said `is-on` and matched nothing: four providers drew
            // identically, the chosen one included, so the only thing saying
            // which id space you were about to use was the hint underneath.
            className={'tp-filter-chip' + (sl === slug ? ' active' : '')}
            onClick={() => onSlug(sl)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <Field inputId="link-id" label={t('identity.link.id.field.label')} value={id} onChange={onId} />
      {row ? <p className="microcopy" style={{ color: 'var(--faint)' }}>{t(row[3])}</p> : null}
      {/* The address, as it will be stored. Never truncated — it is a name of a
          sort — so it wraps, which is what .work-link-url already does. */}
      {url ? <p className="microcopy work-link-url" style={{ color: 'var(--soft)' }}>{url}</p> : null}
    </form>
  )
}

function useRecord(path) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const r = await json('GET', path)
    if (r.ok) setData(r.data)
    else setErr(errText(r))
  }, [path])
  useEffect(() => {
    load()
  }, [load])
  return { data, err, setErr, load }
}

// Lines — the quotes that point at this record.
//
// THE HALF THE PANEL HAS BEEN MISSING. The person record has carried its linked
// lines since the day the link landed and nothing drew them; the character record
// could not carry them at all until the cast link was written. Both do now, and
// they are the same list with the same two caveats, so they are one component.
//
// THE SHARED COUNT IS NOT A FOOTNOTE. The linker refuses to guess on a line that
// names two speakers — there is no honest single answer — so a list of only the
// linked ones is quietly wrong about how much somebody has said. The sentence says
// how many are missing and why, which is the difference between a list a reader
// can trust and one they cannot.
//
// A QUOTE IS NEVER TRUNCATED WITH AN ELLIPSIS. It wraps and it clamps, and the
// clamp is the app's own ExpandableText rather than an overflow — a cut sentence
// and a short sentence look alike, which is the same failure the name rule names.
function Lines({ lines, shared, empty }) {
  if (!lines.length && !shared) {
    return <p className="microcopy" style={{ color: 'var(--faint)' }}>{empty}</p>
  }
  return (
    <div style={FIELDS}>
      <ul style={FIELDS}>
        {lines.map((l) => (
          <li key={`${l.kind}-${l.id}`} className="identity-line">
            <ExpandableText className="identity-line-text" lines={2} text={l.text} />
            {/* THE SAME PILLS THE CARDS AND HOME WEAR, on the owner's ruling. The
                line's own microcopy stops repeating the names once the chips
                carry them and keeps the WORK, which the chips never say.

                NO DOOR, and here the reason is not Home's: this panel is already
                about the record whose lines these are, so the chip that would
                open a character is the page the reader is standing on. The other
                names on the line have no record behind them at all — the linker
                refuses to guess on an ensemble line, which is why they are chips
                rather than links in the first place.

                An utterance wears none: a standalone quote has a speaker and no
                cast, so there is nobody else on the line to name. */}
            {/* Its own air: `.identity-line` is a grid whose other children are
                single lines of text at a 2px gap, and a 38px pill row in that
                rhythm reads cramped. The row's spacing to its neighbours is the
                caller's, which is why it comes in as a class. */}
            <SpeakerChips images={l.character_images} className="my-1" />
            <span className="microcopy" style={{ color: 'var(--soft)' }}>
              {[l.character_images?.length ? null : l.name, l.work_title].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {shared > 0 && (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {t('identity.lines.shared', { n: shared, count: shared })}
        </p>
      )}
    </div>
  )
}

// ---- the person ------------------------------------------------------------

// Portrait — the record's own face, and the one control that changes it.
//
// A PERSON ID BUYS THE TOP OF THE LADDER. With it the server can reach whatever
// supplier this person is pinned to — and, failing that, the TheTVDB person id a
// cast fetch already stored against their name — instead of handing the name to a
// search engine.
function Portrait({ person, busy, onPicked, onClear }) {
  const { faceButton, pictureEditor } = usePicturePicker({
    face: person.image_path ? personImgURL(person.image_path) : '',
    faceName: person.name,
    label: t('identity.person.portrait.aria', { name: person.name }),
    urlLabel: t('identity.person.portrait.url.aria', { name: person.name }),
    busy,
    onPicked,
    fallbackQuery: person.name,
    search: () => ({ kind: 'portrait', name: person.name, person_id: person.id }),
  })
  return (
    <div style={FIELDS}>
      <div className="flex flex-wrap items-center gap-3">
        {faceButton}
        {/* NO LABEL ON THE PORTRAIT — handoff §1.4. A round face with its picture
            verbs under a panel titled with the person's name does not need the
            word "Photograph"; a cover keeps its label because it sits among eleven
            other named fields and this does not. */}
        <div className="flex flex-col gap-1">
          {person.image_path ? (
            <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-12)', color: 'var(--error)' }} disabled={busy} onClick={onClear}>
              {t('identity.person.portrait.clear.label')}
            </button>
          ) : (
            <span className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.person.portrait.none')}</span>
          )}
        </div>
      </div>
      {pictureEditor}
    </div>
  )
}

function PersonBody({ stack, id, work, onOpenWork = null }) {
  // THE PACK'S CHOOSE SHEET. A tile on a performer's strip stands for one work,
  // and "A WORK CAN HOLD MORE THAN ONE OF HIS ROLES, so a tile… cannot assume
  // what you meant by tapping it: two characters in one film, or the film itself.
  // When there is a choice, it asks; when there is only one thing behind the
  // tile, it just opens it." null = closed.
  const [choose, setChoose] = useState(null)
  const { data, err, setErr, load } = useRecord(`/people/id/${id}`)
  // Same disclosure as the character screen, for the same reason. See there.
  const [names, setNames] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [linkDialog, setLinkDialog] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      sort_name: data.sort_name || '',
      born: data.born || '',
      died: data.died || '',
      // The pack's screen shows the links as a pill strip, and there was nowhere
      // to type one: the panel drew ProviderChips off the same column read-only.
      links: data.links || '',
      note: data.note || '',
    })
  }, [data, work])

  // THE SAME THREE VERBS ON THE PERSON'S CARD. `Portrait` below already builds a
  // picker for the panel's own form; this is the RECORD card's, which had one
  // control — "remove the picture" — and no way to put one there. The fourth verb
  // is absent by the pack's own rule: `s.scope === 'person' ? [] : [...]`, because
  // a person IS the identity and there is no wider scope to set a picture for.
  //
  // ABOVE THE EARLY RETURNS, and that is the rules of hooks rather than tidiness.
  // Placed below them this hook ran on a loaded render and not on a loading or a
  // failed one, which is a different hook count between two renders of one
  // component — React throws over the whole panel and the reader gets a blank
  // screen. `data` is null until the record lands, so every read of it is
  // optional; the handlers are reached through arrows because they are `const`
  // declarations further down and naming one directly here would read it before
  // it exists.
  const personPicture = usePicturePicker({
    face: data?.image_path ? personImgURL(data.image_path) : '',
    faceName: data?.name || '',
    label: t('identity.person.portrait.aria', { name: data?.name || '' }),
    urlLabel: t('identity.person.portrait.url.aria', { name: data?.name || '' }),
    busy,
    named: true,
    onPicked: (url) => setPortrait(url),
    onUpload: (file) => uploadPortrait(file),
    fallbackQuery: data?.name || '',
    search: () => ({ kind: 'portrait', name: data?.name || '', person_id: id }),
  })

  if (err) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>

  // A COMPANY OR A PERSON, decided once and read three times below — the heading,
  // the founded/born rows, and the id spaces the link popup offers. Derived from
  // the record's own credit ROWS rather than passed in, because a `people` row
  // does not carry a kind: what it IS is what the library credits it as.
  //
  // THE ROWS AND NOT THEIR ROLES. This read `.map(c => c.role)` and got a studio
  // wrong every time: a studio's role is `director`, since movies.director holds
  // both facts and only media_type separates them. `data.kinds` looks like the
  // better source and is worse — person_kinds is empty for a record a credit sync
  // created, which is every studio and publisher in a seeded library.
  const org = isOrganisation(data.credits || [])

  const save = async () => {
    setBusy(true)
    const r = await json('PUT', `/people/id/${id}`, form)
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    toast(t('identity.person.saved'))
    load()
  }

  // THE PICTURE SAVES ON ITS OWN, unlike the fields below it. A reader who picks a
  // face out of a strip has finished an act; making them find Save afterwards is
  // the difference between choosing a portrait and filling in a form, and it is
  // also how the character page and the cast row already behave.
  const uploadPortrait = async (file) => {
    setBusy(true)
    const body = new FormData()
    body.append('file', file)
    const r = await uploadWithProgress(`/people/id/${id}/portrait`, body)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.upload.generic')))
    setErr('')
    load()
  }

  const setPortrait = async (url) => {
    setBusy(true)
    const r = await json('PUT', `/people/id/${id}`, url ? { image_url: url } : { clear_image: true })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }

  // WHERE ONE ROLE TILE GOES, factored out because the choose sheet opens the
  // same door from a list. Where the cast row points at no character record there
  // is nothing to open, so it opens that work's credit instead.
  const roleDoor = (a) => (a.character_id
    ? characterPanel(stack, {
      id: a.character_id,
      name: a.character,
      onOpenWork,
      work: { kind: a.kind, id: a.work_id, title: a.work_title, media_type: a.media_type, castId: a.cast_id },
    })
    : personPanel(stack, { id, name: data?.name || '', work: { kind: a.kind, id: a.work_id, title: a.work_title, role: 'performer' } }))

  // NOTHING WRITES credit_as FROM HERE ANY MORE, and that is a capability the app
  // has lost rather than moved — recorded here because a deleted handler leaves
  // no other trace. `PUT /credits` (handleCreditAs) is still the server's route
  // and `work_person.credit_as` is still the column a work prints a name from;
  // the only UI that ever set it was the person's per-work scope, which the
  // owner's ruling retires ("people is always global"). The cast list is not a
  // substitute: it edits work_CAST — characters and performers — and credit_as
  // lives on work_PERSON. So this needs a home, and the two candidates are the
  // work's own credit list and the tile on the person's record that already
  // prints "as Harry". It is the owner's call, not a thing to guess at.

  // APPENDED TO THE FREE-TEXT FIELD, not written to a column of its own. `links`
  // has been one whitespace-separated list since the table had the column, and
  // parseLinks reads it that way — so a link built from an id and a link pasted
  // by hand are the same kind of thing, and the pills below cannot tell them
  // apart. Which is the point: the popup is a typing aid, not a second store.
  const addProviderLink = async (url) => {
    const next = [String(form.links || '').trim(), url].filter(Boolean).join('\n')
    setBusy(true)
    const r = await json('PUT', `/people/id/${id}`, { ...form, links: next })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    setLinkDialog(false)
    load()
  }

  const addAlias = async (alias) => {
    const r = await json('POST', `/people/id/${id}/aliases`, { alias })
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }
  const removeAlias = async (alias) => {
    const r = await json('DELETE', `/people/id/${id}/aliases?alias=${encodeURIComponent(alias)}`)
    if (!r.ok) return setErr(errText(r))
    load()
  }
  // SPLIT IS NOT UNDO AND THE TOAST SAYS SO. It hands back a record with the name;
  // the works stay with this one, because the schema does not remember which of
  // them was credited to the record that got folded in. Saying that in the toast
  // is cheaper than a reader discovering it by counting books.
  const splitAlias = async (alias) => {
    const r = await json('POST', `/people/id/${id}/split`, { alias })
    if (!r.ok) return setErr(errText(r))
    toast(t('identity.alias.split.done', { alias }))
    load()
  }

  // ---- people-global, and it is the ONLY person screen ---------------------
  //
  // A PERSON IS ALWAYS GLOBAL — the owner's ruling. A `work` handed in here is
  // ignored rather than honoured: a person is one record however many works
  // credit them, and the place to change what one work PRINTS is that work's own
  // cast list, which is the screen that holds the row. Every credit is a tile on
  // the strip below and each already says "as Harry".
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'calc(var(--row) * 1.6)' }}>
        <ErrorText>{err}</ErrorText>
        <PersonGlobal
          record={data}
          credits={data.credits || []}
          roles={data.roles || []}
          org={org}
          // WHAT THEY DO BEFORE HOW MUCH OF IT, which is the pack's crumb —
          // "performer · author · 3 works". `roles` is what they PLAYED (cast
          // rows, so its `kind` is the shelf and not a role name, which is the
          // trap here); `credits` is what they MADE, and its `role` is the noun.
          kinds={[
            // `unit.role.actor` AND NOT A NEW "performer" NOUN. The pack's crumb
            // says "performer"; the app's own vocabulary — work_person.role, the
            // unit.role.* family, every cast screen — says actor, and one thing
            // with two names in one interface is the glossary's whole complaint.
            ...((data.roles || []).length ? [t('unit.role.actor', { count: 1 })] : []),
            ...[...new Set((data.credits || []).map((c) => c.role))].map((r) => t(`unit.role.${r}`, { count: 1 })),
          ]}
          portrait={data.image_path ? personImgURL(data.image_path) : ''}
          portraitActions={
            <>
              {personPicture.verbs}
              {data.image_path ? (
                <GhostButton className="cs-verb" onClick={() => setPortrait('')} disabled={busy}>
                  {t('identity.person.portrait.clear.label')}
                </GhostButton>
              ) : null}
              {personPicture.pictureEditor}
            </>
          }
          onNames={() => setNames((v) => !v)}
          onSort={() => focusField('person-sort')}
          onBorn={() => focusField('person-born')}
          onLinkAdd={() => setLinkDialog(true)}
          // THE WORK, NOT THE PERSON AGAIN. See usePersonOpener for what this
          // used to do and why the press produced a copy of the screen it was
          // pressed on. Null where no screen threaded a door, and the tile then
          // says it cannot be opened rather than pretending.
          onOpenWork={onOpenWork ? (c) => onOpenWork(c.kind, c.work_id) : null}
          // A ROLE TILE OPENS THE CHARACTER — the owner's ruling read in the
          // direction a reader travels.
          //
          // UNLESS THE WORK HOLDS MORE THAN ONE OF THEM, which is the pack's own
          // reason for the choose sheet: a performer with two roles in one film
          // has two things behind that film, and picking either silently means
          // opening the wrong record and editing it. Asked only where there IS a
          // choice — one role behind a tile still just opens.
          onOpenRole={(a) => {
            const sameWork = (data.roles || []).filter((r) => r.kind === a.kind && r.work_id === a.work_id)
            if (sameWork.length < 2) return stack.push(roleDoor(a))
            return setChoose({
              title: a.work_title,
              hint: t('identity.choose.roles.hint'),
              options: [
                ...(onOpenWork ? [{
                  key: 'work',
                  label: a.work_title,
                  sub: t('identity.choose.work.sub'),
                  icon: <NavIcon name={GLYPH_NAME[mediumOf(a)] || 'movies'} />,
                  onPick: () => onOpenWork(a.kind, a.work_id),
                }] : []),
                ...sameWork.map((r) => ({
                  key: `r${r.cast_id}`,
                  label: r.character || t('identity.credit.unnamed'),
                  sub: t('identity.choose.role.sub'),
                  face: r.image || '',
                  onPick: () => stack.push(roleDoor(r)),
                })),
              ],
            })
          }}
          onMerge={() => focusField('person-merge')}
        >
          <MonoLabel>{t('identity.lines.title', { n: (data.lines || []).length, count: (data.lines || []).length })}</MonoLabel>
          <Lines lines={data.lines || []} shared={data.shared_lines || 0} empty={t('identity.lines.empty.person')} />
          {names ? (
            <>
              <MonoLabel>{t('identity.alias.title')}</MonoLabel>
              <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.body')}</p>
              <AliasRow aliases={data.aliases || []} onAdd={addAlias} onRemove={removeAlias} onSplit={splitAlias} />
            </>
          ) : null}
          {/* THE PORTRAIT SAVES ITSELF and is not part of the form — see
              setPortrait. It stays outside so the ✓'s count means fields. */}
          <Portrait person={data} busy={busy} onPicked={setPortrait} onClear={() => setPortrait('')} />
          <GlobalFields
            /* Founded/Closed for a company, born/died for a person — the same
               predicate the screen above is headed by, so a row and the field it
               opens cannot disagree about what this record is. */
            fields={[
              { key: 'name', id: 'person-name', label: t('common.field.name.label') },
              { key: 'sort_name', id: 'person-sort', label: t('identity.field.sort') },
              { key: 'born', id: 'person-born', label: org ? t('people.form.founded.label') : t('identity.field.born') },
              { key: 'died', id: 'person-died', label: org ? t('people.form.closed.label') : t('identity.field.died') },
              { key: 'links', id: 'person-links', label: t('identity.field.links'), rows: 2 },
              { key: 'note', id: 'person-note', label: t('identity.field.note'), rows: 2 },
            ]}
            form={form}
            onForm={setForm}
            stored={data}
            busy={busy}
            blocked={form.name.trim() ? '' : t('error.validate.name-required')}
            onSave={save}
          />
          <div id="person-merge">
            <MergeControl into={data} onMerged={load} onError={setErr} org={org} />
          </div>
        </PersonGlobal>
        {choose ? (
          <ChoosePicker spec={choose} busy={busy} onClose={() => setChoose(null)} />
        ) : null}
        <ProviderLinkDialog
          open={linkDialog}
          onClose={() => setLinkDialog(false)}
          onAdd={addProviderLink}
          busy={busy}
          // THE CREDITS DECIDE THE LIST. A studio or a publisher credited on a
          // game gets IGDB's company id space; an author gets IMDb, TMDB, TVDB and
          // the Amazon author page. Same source as `org` above, and the same
          // answer — one predicate, so the popup and the heading cannot disagree.
          credits={data.credits || []}
        />
      </div>
    )

  // NO FALL-THROUGH HERE EITHER. A person is on a work or they are not, and the
  // two branches above are those two answers — the three-scope presentation that
  // stood here repeated the record's own fields inside a work, which is the
  // confusion the credit spelling exists to prevent.
}

// ---- the character ---------------------------------------------------------
//
// THE COMPLETE CHARACTER DESTINATION, which is the owner's own word for it: "this
// is the complete character metadata destination". Everything a character record
// can be changed from is here and nowhere else — the works they are in, the
// performer on each, the picture each work holds of them, which of those pictures
// IS them, the spellings that find them, and the merge that folds a duplicate in.
//
// WHY IT IS A GRID OF CARDS AND NOT A LIST OF TITLES. The appearances used to be
// one line per work: a bold title and, if there was one, a performer's name. That
// is a list a reader has to READ, and it hid the two facts the screen exists to
// show — that a work holds a picture of this character, and that the picture might
// be a different person's face. A shelf is recognised by its spines. So each
// appearance carries the WORK's cover and, over it, the character's own picture on
// that work, which makes "eight Harry Potters, and four of them have Dobby's
// face" a thing you see rather than a thing you audit.
//
// THE THREE ACTS ON A CARD ARE DELIBERATELY DIFFERENT WEIGHTS. Changing the
// picture is reversible and unremarkable. Promoting one to the record is a
// judgement and says so. Taking the work off is refused while its quotes still
// name the character — see character_works.go — and the refusal opens the dialog
// that offers the two ways forward.

function CharacterBody({ stack, id, work, onSearch = null, onOpenWork = null }) {
  const [linkDialog, setLinkDialog] = useState(false)
  const { data, err, setErr, load } = useRecord(`/characters/${id}`)
  // THE PACK'S TWO COUNTS, from the route that has served them since it was
  // written and that nothing had ever called. /whos-in-it answers per cast row —
  // how many of this character's lines this work holds, and how many distinct
  // places in it they speak from — which is exactly the pair the local sheet
  // prints and a question the character record cannot answer, because it is a
  // fact about one work.
  const [counts, setCounts] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  // WHOSE NOTE THE NOTE BOX IS, because the note is the one field on this form
  // that belongs to a CREDIT rather than to the casting the sheet is about. A
  // character billed twice on one work — the case 0063 re-cut its pair index for
  // — has a note per credit, and null means "the sheet's own".
  const [noteCredit, setNoteCredit] = useState(null)
  // The pack's one sheet, as a spec. null = closed. See the picker block below.
  const [picker, setPicker] = useState(null)
  // The removal a work refused, with the number of quotes standing in its way.
  const [drop, setDrop] = useState(null)
  // THE ONE PRESS ON A LOCAL SHEET WHOSE EFFECT LEAVES THE WORK, so it asks
  // first — the pack draws the verb dashed and in the danger colour and hangs its
  // own confirmation off it (`character-popup.dc.html:1265-1274`). Every other
  // verb on that strip changes one work's picture and is undone by choosing
  // another; this one changes what the character looks like on every work that has
  // not set its own, and the reader cannot see those works from here to know what
  // they just changed. Holding the appearance rather than a boolean because the
  // body names the work it came from.
  const [promoteAsk, setPromoteAsk] = useState(null)
  // THE NAME ROW IS A DISPLAY AND ITS EDITOR IS BEHIND IT, which is the pack's
  // model for every row it draws. It is also the only way the two can coexist:
  // the row lists every spelling as its second line, so an always-open chip list
  // under it printed each alias twice and a reader had to work out whether the
  // two lists were the same thing.
  const [names, setNames] = useState(false)
  // THE PACK'S CHOOSE SHEET, which the strip's tiles open. This was a disclosure
  // holding an inline card, and the card's own comment set the condition for its
  // retirement: "every per-work act — this work's picture, promoting it to the
  // record, taking the character off the work — belongs to char-book / char-film
  // / char-game, which are the local screens and are not built yet." They are,
  // and the sheet reaches them. null = closed.
  const [choose, setChoose] = useState(null)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      sort_name: data.sort_name || '',
      // 0063's column, and the record's links, which the pack's screen shows as a
      // row and a pill strip — both were already served and neither had a field.
      born: data.born || '',
      links: data.links || '',
      description: data.description || '',
      note: data.note || '',
    })
  }, [data])

  const save = async () => {
    setBusy(true)
    const r = await json('PUT', `/characters/${id}`, form)
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    toast(t('identity.character.saved'))
    load()
  }
  const addAlias = async (alias) => {
    const r = await json('POST', `/characters/${id}/aliases`, { alias })
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }
  const removeAlias = async (alias) => {
    const r = await json('DELETE', `/characters/${id}/aliases?alias=${encodeURIComponent(alias)}`)
    if (!r.ok) return setErr(errText(r))
    load()
  }
  // SPLIT REACHES THE CHARACTER TABLE TOO, and always could — 0056 shipped
  // `/characters/{id}/split` beside the person one and only the person panel ever
  // offered it. A reader who merged two Wolands by mistake had a way back on one
  // of the two tables.
  const splitAlias = async (alias) => {
    const r = await json('POST', `/characters/${id}/split`, { alias })
    if (!r.ok) return setErr(errText(r))
    toast(t('identity.alias.split.done', { alias }))
    load()
  }

  // WHAT THIS CHARACTER IS ON ONE WORK, which is the finer grain 0056 built the
  // columns for and nothing had ever written. A character legitimately has a
  // different name on each work — Woland is "the professor" in one chapter and
  // "Messire" in another, and a film bills a role differently from the novel — and
  // a different description too. Both are per-row and neither touches the record.
  const saveAppearance = async (a, fields) => {
    setBusy(true)
    const r = await json('PUT', `/cast/${a.cast_id}`, {
      character: fields.character,
      // A BOOK IS REFUSED AN ACTOR rather than quietly cleared (0047's line, which
      // the API follows), so the field is absent for one — not empty.
      ...(a.kind === 'book' ? {} : { actor: fields.actor }),
      description: fields.description,
      // THE PACK'S LOCAL FACTS, sent only when the caller has them. The cast
      // editor has accepted all six since 0063 and this panel never offered
      // them; `undefined` is left out of the body, so the older callers here
      // (the local sheet's own rows) still send exactly what they always did.
      ...(fields.part === undefined ? {} : { part: fields.part }),
      ...(fields.first_appears === undefined ? {} : { first_appears: fields.first_appears }),
      ...(fields.age_here === undefined ? {} : { age_here: fields.age_here }),
      ...(fields.credit_note === undefined ? {} : { credit_note: fields.credit_note }),
      ...(fields.credit_lang === undefined ? {} : { credit_lang: fields.credit_lang }),
      ...(fields.aliases === undefined ? {} : { aliases: fields.aliases }),
    })
    setBusy(false)
    if (!r.ok) {
      setErr(errText(r))
      return false
    }
    setErr('')
    load()
    return true
  }

  // A picture for ONE work, fetched and stored against that work's cast row. The
  // record's own picture is a separate act — see promote.
  // The character side of the same verb — see PersonBody's for why it appends to
  // the free-text field rather than writing a column.
  const addProviderLink = async (url) => {
    const next = [String(form.links || '').trim(), url].filter(Boolean).join('\n')
    setBusy(true)
    const r = await json('PUT', `/characters/${id}`, { ...form, links: next })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    setLinkDialog(false)
    load()
  }

  const setWorkImage = async (castID, url) => {
    setBusy(true)
    const r = await json('POST', `/cast/${castID}/image`, url ? { image_url: url } : undefined)
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }
  // THE UPLOAD HALF OF THE PACK'S THIRD VERB, shared by both scopes of this
  // panel: the work's own picture and the identity's are two routes and one
  // shape. `uploadWithProgress` rather than `json` because a picture is a
  // multipart body and `json` sends JSON — the same call every other upload in
  // this app makes.
  const uploadPicture = async (path, file) => {
    setBusy(true)
    const form = new FormData()
    form.append('file', file)
    const r = await uploadWithProgress(path, form)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.upload.generic')))
    setErr('')
    load()
  }
  // A PASTED ADDRESS FOR THE RECORD ITSELF, which `PUT /characters/{id}/image`
  // grew for this: `promote` sends a cast_id and points the record at a picture
  // one of its works already holds, and that is the ordinary path — but a reader
  // with a picture of the character that none of their works has could not use it
  // at all before.
  const setRecordImage = async (url) => {
    setBusy(true)
    const r = await json('PUT', `/characters/${id}/image`, { image_url: url })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }
  const promote = async (castID, title) => {
    setBusy(true)
    const r = await json('PUT', `/characters/${id}/image`, castID ? { cast_id: castID } : { path: '' })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    toast(castID ? t('identity.character.promote.done', { title }) : t('identity.character.promote.cleared'))
    load()
  }
  // The plain removal, and the one that has answered for the quotes. A 409 is not
  // an error here — it is the question — so it opens the dialog instead of
  // printing a failure the reader can do nothing with.
  const removeWork = async (a, quotes = '') => {
    setBusy(true)
    const r = await json('DELETE', `/characters/${id}/works/${a.cast_id}${quotes}`)
    setBusy(false)
    if (r.status === 409) {
      setDrop({ appearance: a, quotes: r.data?.quotes || 0 })
      return
    }
    if (!r.ok) return setErr(errText(r))
    setErr('')
    setDrop(null)
    toast(t('identity.character.works.remove.done', { title: a.work_title }))
    load()
  }
  const addWork = async (work, actor = '') => {
    setBusy(true)
    const r = await json('POST', `/characters/${id}/works`, {
      kind: work.kind, work_id: work.id, ...(actor ? { actor } : {}),
    })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    toast(t('identity.character.works.add.done', { title: work.title }))
    load()
  }

  // NO EARLY RETURN ABOVE THE REMAINING HOOKS. There was one here — `if (err &&
  // !data) return <ErrorText/>` — and three hooks below it: the two pickers and
  // the /whos-in-it effect. A load that FAILS goes render-1 (no data, no error,
  // every hook runs) → render-2 (an error, still no data, return before the
  // hooks), which is fewer hooks than the render before it, and React throws
  // "Rendered more hooks than during the previous render" over the whole panel.
  // So the reader who most needs to be told what went wrong got a blank screen
  // instead. The error now renders BELOW, beside the loading state, where every
  // hook has already run.
  const works = data?.appearances || []
  // THE APPEARANCE THE READER CAME IN THROUGH, when they came in through one.
  //
  // A character record is a library-wide thing and this panel has always drawn it
  // that way: one grid of every work, in whatever order the query returned. That
  // is the right shape from the metadata console, where the question is "who is
  // this". It is the wrong shape from a film's cast list, where the reader has
  // already said which work they mean and the card they want is one of eight.
  //
  // So the work they arrived from is lifted OUT of the grid and given the first
  // scope, and the grid below says "the others". Not a copy in both places: a card
  // that appears twice invites the reader to edit the wrong one, and the two edit
  // the same row.
  //
  // BY ROW FIRST, BY WORK ONLY AS A FALLBACK. The fallback is not dead code: a
  // caller may legitimately know the work and not the row — "this character, on
  // this film" from somewhere that never touched the cast table — and for the
  // overwhelmingly common case of one billing per work the two agree.
  const here = !work
    ? null
    : (work.castId && works.find((a) => a.cast_id === work.castId))
      || works.find((a) => a.kind === work.kind && a.work_id === work.id)
      || null
  const elsewhere = here ? works.filter((a) => a.cast_id !== here.cast_id) : works
  // WHICH OF THE FIVE SHEETS THIS IS, from the resolver rather than from a chain
  // of questions asked again per section. identityScope.js was written with the
  // local sheets in mind and nothing had imported it, so its answers — the
  // locator noun, whether there is a performer to pair with the part, whether a
  // dub can be credited — sat unused beside screens that needed them. It is live
  // from here: the sheets below read `scope.id`, and a new medium stays a row in
  // that table rather than a branch in this file.
  // RESOLVED FROM THE ROW, NOT FROM THE ARGUMENT, and that is what makes the six
  // scopes total. A caller can name a work the character has no cast row on —
  // stale data, or a row removed since the press — and keying the scope off
  // `work` alone called that a local sheet with nothing local to show. It is the
  // global record: the honest answer to "this character, on a work they are not
  // in" is the character.
  const scope = identityScope({ table: 'character', work: here ? { ...work, ...here } : null })

  // THE LOCAL SHEET'S PORTRAIT CONTROLS, hoisted here for the rules of hooks
  // rather than for tidiness: this component used to bail out on a missing record
  // before `here` was derived, so any hook that needs the cast row could only be
  // called from a child — which is why the per-work picture has always lived
  // inside the strip's inline card, which is retired. The pack's local sheet
  // puts the picture at the top of the
  // screen, so the row is derived first and the guard follows.
  //
  // AND THE LADDER IS FED, which is the half this call left out. `useCharacterPicture`
  // has resolved three rungs since it was written — this work's picture of the
  // role, then the RECORD's, then the performer's headshot — and this call handed
  // it the first rung only, so a character whose identity carries a portrait drew
  // a silhouette on every local sheet while the same character's global card drew
  // the picture. The owner reported it as two screens disagreeing about one fact.
  const localPicture = useCharacterPicture({
    row: here
      ? {
        id: here.cast_id,
        character: here.character,
        actor: here.actor,
        character_image_path: here.image,
        character_record_image: data.image_path || '',
      }
      : { id: 0, character: '', actor: '', character_image_path: '', character_record_image: '' },
    actor: here ? { name: here.actor || '', image_path: here.actor_image || '' } : null,
    workTitle: here?.work_title || '',
    mediaType: here?.media_type || '',
    busy,
    onImage: (url) => here && setWorkImage(here.cast_id, url),
    named: true,
    onUpload: here ? (file) => uploadPicture(`/cast/${here.cast_id}/image/upload`, file) : null,
  })

  // AND THE RECORD'S OWN PICTURE GETS THE SAME THREE VERBS. The pack draws the
  // media block on all five artboards and drops only the FOURTH verb on a global
  // one — `s.scope === 'global' || s.scope === 'person' ? [] : [['Set for the
  // identity', …]]` — because on the identity there is no wider scope to set it
  // for. Fetch, Upload and Paste URL are the same three everywhere, and the
  // global card had none of them: its only control was "clear their picture",
  // which is an undo for a thing there was no way to do from that screen.
  const globalPicture = usePicturePicker({
    face: data?.image_path ? coverImgURL(data.image_path) : '',
    faceName: data?.name || '',
    label: t('cast.picture.aria', { name: data?.name || '' }),
    urlLabel: t('cast.picture.url.aria', { name: data?.name || '' }),
    busy,
    named: true,
    onPicked: (url) => setRecordImage(url),
    onUpload: (file) => uploadPicture(`/characters/${id}/image/upload`, file),
    fallbackQuery: data?.name || '',
    search: () => ({ kind: 'character', name: data?.name || '' }),
  })

  // /whos-in-it, once per work, for the two counts the sheet prints. Guarded on
  // `here`: a global sheet has no work to ask about, and asking anyway would be a
  // request whose answer is discarded.
  useEffect(() => {
    if (!here) { setCounts(null); return }
    let alive = true
    const path = here.kind === 'book' ? 'books' : 'movies'
    json('GET', `/${path}/${here.work_id}/whos-in-it`).then((r) => {
      if (!alive || !r.ok) return
      const row = (r.data?.characters || []).find((c) => c.cast_id === here.cast_id)
      setCounts(row ? { quotes: row.quotes || 0, locators: row.locators || 0 } : { quotes: 0, locators: 0 })
    })
    return () => { alive = false }
  }, [here?.cast_id, here?.work_id, here?.kind])

  if (err && !data) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>

  // ---- char-global, the pack's own screen ----------------------------------
  //
  // OPENED WITH NO WORK, this is `char-global` and it is drawn by the pack's
  // vocabulary in the pack's order — see identityGlobal.jsx for what moved and
  // for the departures. The three local scopes still wear the panel's older
  // presentation; they are the next increment, and the split is here rather than
  // inside the screen so neither has to carry the other's shape.
  //
  // EVERY HANDLER STAYS ABOVE THIS LINE. The screen fetches nothing and saves
  // nothing; it is handed finished functions, which is why it can be rendered
  // from a fixture in a test.
  // THE COUNTS ARE DOORS INTO SEARCH — the owner's instruction. Both cells land
  // on the same query, because both numbers are summaries of it: this character,
  // in this work. The chips are seeded rather than the text, so the reader can
  // widen by removing one instead of retyping.
  const openQuoteSearch = !onSearch || !here ? undefined : () => {
    onSearch(here.kind === 'book' ? 'annotations' : 'dialogues', [
      { field: 'character', value: here.character || data.name, label: here.character || data.name },
      { field: here.kind === 'book' ? 'book' : 'movie', value: here.work_title, label: here.work_title },
    ])
  }

  // The portrait's controls: the picture picker this work already had, plus the
  // pack's "Set for the identity" — which is `promote`, the verb that makes one
  // work's picture the record's own.
  // AND `pictureEditor` GOES WITH IT, which is the half this sheet left out.
  //
  // usePicturePicker returns a PAIR: the face is the trigger and the editor is
  // what the trigger reveals — the URL field, the upload, the provider search.
  // This sheet took the button alone, so pressing the portrait toggled a block
  // that was not on the page: no dialog, no field, no request, nothing. Pressing
  // every control on this panel is how it was found, and it was indistinguishable
  // from a feature nobody had built. The person sheet above destructures both,
  // which is why the same picker works there and not here.
  //
  // THE FACE BUTTON IS GONE FROM THIS STRIP, and its absence is the fix rather
  // than a loss. `PortraitBlock` draws the face itself, a 96px disc at the head of
  // the block; `faceButton` is the CAST ROW's small pressable face. Putting it in
  // the actions slot drew a second, smaller face of the same person beside the
  // first, which is the "two pictures of one thing" the glyph rule names. The
  // trigger it provided is now the pack's own `Paste URL`.
  const localPortraitActions = here ? (
    <>
      {localPicture.verbs}
      <GhostButton
        className="cs-verb cs-verb-wide"
        icon={<IconGlobe />}
        keepLabel
        onClick={() => setPromoteAsk(here)}
        disabled={busy || !here.image}
        title={t('identity.picture.promote.tip')}
      >
        {t('identity.picture.promote.label')}
      </GhostButton>
      {localPicture.pictureEditor}
    </>
  ) : null

  // THE ROWS ARE DISPLAYS AND THEIR EDITORS ARE BEHIND THEM, which is this
  // panel's own established shape: a row states the value and pressing it focuses
  // the field that changes it. Which credit the note belongs to is whichever ✎
  // was pressed — see `noteCredit` above.
  const noteFor = noteCredit && here && noteCredit.cast_id !== here.cast_id ? noteCredit : (here || {})

  // ---- the pack's picker, and what it replaced -----------------------------
  //
  // A ROW STATES ITS VALUE AND OPENS A SHEET TO CHANGE IT. That is the whole
  // shape of these screens in `character-popup.dc.html`, where every editable
  // thing routes through one `openPicker` — "both answer one question about one
  // credit, and two dialogs for that would drift apart".
  //
  // WHAT WAS HERE INSTEAD, and why it was a defect and not a variation: a
  // `<details className="cs-local-fields">` holding seven plain inputs and one
  // `GhostButton` reading "Save". Three things wrong with it at once.
  //   - `cs-local-fields` matches NOTHING in the stylesheet, so it drew as the
  //     browser's own disclosure triangle in the middle of a designed panel.
  //   - A "Save" button is neither half of the standing tick/cross pair: it
  //     cannot go red, carries no count, and the panel's own ✓ stayed absent
  //     because nothing had registered with the host. `InlineField`'s own header
  //     names this exact arrangement as the thing it was written to replace.
  //   - Reaching a field meant `focusField` opening a fold and moving a caret,
  //     which is how six of these rows came to be dead in the first place: the
  //     fold was closed, so the element was unrendered and unfocusable.
  // Routing to `FormModal` gets the pair, the count, the red ✕ and the "you have
  // unsaved changes" ask for free, and none of it can drift from the rest of the
  // app, because it IS the rest of the app.
  //
  // A full-state PUT needs the row's other columns, so each spec sends the three
  // `saveAppearance` always writes (`character`, `actor`, `description`) from the
  // record and overrides the one field the sheet asked about. Sending `{ part }`
  // alone cleared every column it did not mention — the mistake
  // work-put-shape.test.js exists for.
  const localRow = (a, patch) => ({
    character: a.character || '',
    actor: a.actor || '',
    description: a.description || '',
    ...patch,
  })
  // ONE FIELD FOR THE NAME AND EVERY OTHER NAME — the pack's ruling, in its own
  // words: "'Called here' and 'Also called here' were two rows editing one fact:
  // what this work calls the character. Splitting them made the canonical name
  // look like a different KIND of thing from its aliases, when it is only the
  // first of them." So one multi-line value, and THE FIRST LINE IS THE ONE THAT
  // PRINTS — promoting a spelling is a line move rather than a two-field dance.
  //
  // The storage stays as it was: `character` is the printing name and `aliases`
  // is the `·`-joined rest, which is the separator identityLocal.jsx already
  // splits the sub-line on. The merge is in the sheet, not in the column.
  const ALIAS_SPLIT = /[·,;\n]/
  const namesValue = (a) => [
    a.character || '',
    ...String(a.aliases || '').split(ALIAS_SPLIT).map((x) => x.trim()).filter(Boolean),
  ].join('\n')
  const openNames = (a) => setPicker({
    id: `names-${a.cast_id}`,
    title: t('identity.row.called.label'),
    hint: t('identity.local.names.hint'),
    saveTip: t('identity.picker.save.tip'),
    fields: [{ key: 'names', label: t('identity.row.called.label'), value: namesValue(a), rows: 4,
      placeholder: t('identity.local.names.placeholder'), required: true }],
    save: async (d) => {
      const lines = String(d.names || '').split('\n').map((x) => x.trim()).filter(Boolean)
      if (!lines.length) return
      if (await saveAppearance(a, localRow(a, {
        character: lines[0],
        aliases: lines.slice(1).join(' · '),
      }))) { setPicker(null); toast(t('identity.local.names.saved')) }
    },
  })
  // The three facts, and the note. One shape, because they are one question.
  // `hint` IS THE SCOPE SENTENCE, and it belongs in the editor rather than only on
  // the row that opens it. Two of these fields — the per-work description and the
  // credit note — look exactly like the record's own one door away, and a reader
  // who cannot tell them apart renames a character on thirty-one other works by
  // accident. The row's sub-line says it before the press; this says it while
  // they are typing, which is when it matters.
  const openFact = (a, key, label, hint = '') => setPicker({
    id: `${key}-${a.cast_id}`,
    title: label,
    hint,
    saveTip: t('identity.picker.save.tip'),
    fields: [{ key, label, value: a[key] || '', rows: key === 'credit_note' ? 3 : 0 }],
    save: async (d) => {
      if (await saveAppearance(a, localRow(a, { [key]: d[key] ?? '' }))) {
        setPicker(null)
        toast(t('identity.credit.saved', { title: a.work_title || here?.work_title || '' }))
      }
    },
  })
  // THE NOTE BELONGS TO A CREDIT, NOT TO THE SHEET, and `noteCredit` is recorded
  // as well as opened because the sub-line the sheet prints names whose note it is
  // showing. A character with two credits on one film — the case 0063 re-cut
  // `idx_work_cast_pair` for, an on-screen performer and a dub — has two notes,
  // and the ✎ that was pressed says which. Before `noteFor`, `onCreditNote` was
  // `() => focusField(…)`, an arrow taking NO parameter, so the credit the sheet
  // handed it was discarded and the dub's ✎ saved the performer's note.
  // REASSIGN WHO IS ON THIS CREDIT — the door the face has promised since the
  // tooltip was written ("Change who this is") and never had. It is the pack's
  // `mode:'person'` picker, which is now the same sheet "Add another performer"
  // opens, so choosing an existing person is a press rather than a spelling test
  // — and re-typing a name that is nearly one you have is exactly how a second
  // record for one person gets made.
  //
  // A PUT ON THE ROW, not a delete and an add: the credit keeps its note, its
  // language and its billing, all of which are facts about the CASTING rather
  // than about who is in it.
  const openCreditPick = (a) => setPicker({
    id: `pick-${a.cast_id}`,
    title: t('identity.credit.pick.tip'),
    saveTip: t('identity.picker.save.tip'),
    blocked: t('identity.credit.add.blocked'),
    personKind: 'actor',
    fields: [{ key: 'actor', label: t('identity.picker.person.label'), value: a.actor || '', required: true }],
    save: async (d) => {
      if (await saveAppearance(a, localRow(a, { actor: String(d.actor || '').trim() }))) {
        setPicker(null)
        toast(t('identity.credit.saved', { title: a.work_title || here?.work_title || '' }))
      }
    },
  })
  const openCreditNote = (a) => {
    setNoteCredit(a)
    openFact(a, 'credit_note', t('identity.row.note.for', {
      name: a.actor || t('identity.credit.unnamed'),
    }))
  }
  // AND THE ONE THAT CREATES A ROW RATHER THAN EDITING ONE. Two fields, because a
  // dub is a language: `credit_lang` is the only thing that makes a credit a dub —
  // `creditsFor` splits on it — so "add a performer" and "add a dub" are one sheet
  // with the language pre-focused or not, exactly as the pack's picker carries its
  // `langValue`. The performer is required; the language is what sorts it.
  const openAddCredit = (a, dub) => setPicker({
    id: `add-${a.cast_id}-${dub ? 'dub' : 'cast'}`,
    title: t(dub ? 'identity.credit.add.dub' : 'identity.credit.add.performer'),
    hint: t('identity.credit.add.save.tip'),
    saveTip: t('identity.credit.add.save.label'),
    blocked: t('identity.credit.add.blocked'),
    // `personKind` IS WHAT MAKES THIS THE PACK'S LIST rather than a box — see
    // identityPicker.jsx. 'actor' is the kind because that is the role this row
    // credits somebody in; the list is the account's, not this work's, which is
    // the point of it: the performer you are adding is usually somebody the
    // library already knows, and typing their name again slightly differently
    // makes a second record with its own portrait and its own page.
    personKind: 'actor',
    // THE LANGUAGES ARE A SHORTCUT, NOT A SET. The pack lists five and an
    // "Other…"; this offers the five as chips over a box that takes anything,
    // because "Other…" opening nothing is the shape of a control that lies.
    langs: dub ? t('identity.picker.lang.suggestions').split('·').map((x) => x.trim()).filter(Boolean) : null,
    fields: [
      { key: 'actor', label: t('identity.credit.add.performer'), value: '', required: true },
      { key: 'lang', label: t('identity.credit.add.dub.lang.label'), value: '' },
    ],
    save: async (d) => { if (await addCredit(a, d.actor, d.lang)) setPicker(null) },
  })

  // THE PERFORMER BLOCK'S VERBS. A credit is a cast ROW, so every one of these
  // acts on `a.cast_id` — which is what lets a character billed twice in one
  // work (0063 re-cut the pair index for exactly that) have two of them.
  // PUT /movies/{id} IS FULL-STATE, so the body starts from the record and the
  // one field overrides on top. Sending `{ cast_role }` alone cleared every
  // field it did not mention — work-put-shape.test.js exists for exactly that
  // mistake and caught this one, which is the whole argument for keeping it.
  const setRole = async (next) => {
    if (!here || here.kind === 'book') return
    setBusy(true)
    const cur = await json('GET', `/movies/${here.work_id}`)
    if (!cur.ok) { setBusy(false); setErr(errText(cur)); return }
    const r = await json('PUT', `/movies/${here.work_id}`, { ...movieState(cur.data), cast_role: next })
    setBusy(false)
    if (!r.ok) { setErr(errText(r)); return }
    setErr('')
    load()
  }
  // ADD ONE CREDIT TO THIS WORK'S CASTING OF THIS CHARACTER, which is the verb
  // the two add rows name and the only one this sheet lacked. Its opposite,
  // removeCredit, has been here the whole time.
  //
  // A NEW CAST ROW, not an edit of `here`. A work can bill one character twice —
  // 0063 re-cut `idx_work_cast_pair` for exactly that, a young Vito and an old
  // one, an on-screen performer and a dub — so a second performer is a second
  // row rather than a second name in one. The character is `here`'s, because
  // that is what this sheet is about.
  //
  // THE LANGUAGE IS WHAT MAKES IT A DUB. Empty and it joins the original cast;
  // filled and creditsFor sorts it under "Dubbed by" — one field, no flag.
  const addCredit = async (a, actor, lang) => {
    const name = String(actor || '').trim()
    if (!name) return
    setBusy(true)
    const path = a.kind === 'book' ? `/books/${a.work_id}/cast` : `/movies/${a.work_id}/cast`
    const body = { character: a.character || data.name, actor: name }
    if (String(lang || '').trim()) body.credit_lang = String(lang).trim()
    const r = await json('POST', path, body)
    setBusy(false)
    if (!r.ok) { setErr(errText(r)); return false }
    setErr('')
    load()
    // TRUE SO THE SHEET CAN CLOSE ITSELF, and false so it stays open with the
    // reason showing. `saveAppearance` has answered this way since it was
    // written; this one returned nothing, so a failed POST left the picker open
    // with no error and a successful one left it open too.
    return true
  }
  const removeCredit = async (a) => {
    setBusy(true)
    const r = await json('DELETE', `/cast/${a.cast_id}`)
    setBusy(false)
    if (!r.ok) { setErr(errText(r)); return }
    setErr('')
    load()
  }

  // ---- char-book, the first of the pack's local sheets ---------------------
  //
  // ALL THREE MEDIA NOW. What differs between them is what identityScope says
  // differs — a book has no performer block at all, a game's facts row has two
  // cells rather than three because a playable character has no single age, and
  // only a film or a show can credit a dub. None of that is a branch here.
  if (scope.local) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'calc(var(--row) * 1.6)' }}>
        <ErrorText>{err}</ErrorText>
        <CharacterLocal
          record={data}
          work={work}
          here={here}
          scope={scope}
          counts={counts}
          works={works}
          portrait={localPicture.face}
          portraitFrom={localPicture.from}
          portraitActions={localPortraitActions}
          onCalled={() => openNames(here)}
          onPart={() => openFact(here, 'part', t('identity.facts.part'))}
          onFirst={() => openFact(here, 'first_appears', t('identity.facts.first'))}
          onAge={() => openFact(here, 'age_here', t('identity.facts.age'))}
          onNote={() => openFact(here, 'credit_note', t('identity.row.note.label'), t('identity.row.note.sub'))}
          onDescription={() => openFact(here, 'description', t('identity.row.local-desc.label'), t('identity.row.local-desc.sub'))}
          onQuotes={openQuoteSearch}
          onLocator={openQuoteSearch}
          onOpenGlobal={() => stack.open(characterPanel(stack, { id, name: data.name, onSearch }))}
          onRemove={() => removeWork(here)}
          onRole={setRole}
          onOpenCredit={(a) => a.actor_id && stack.open(personPanel(stack, { id: a.actor_id, name: a.actor }))}
          onCreditPick={openCreditPick}
          onCreditNote={openCreditNote}
          onCreditRemove={removeCredit}
          onAddCredit={() => openAddCredit(here, false)}
          onAddDub={() => openAddCredit(here, true)}
        />
        {/* KEYED ON THE SPEC so a new question is a new instance — see FieldPicker's
            header for why seeding the draft in an effect flashes an armed tick. */}
        {picker ? (
          <FieldPicker
            key={picker.id}
            spec={picker}
            busy={busy}
            onClose={() => setPicker(null)}
            onSave={picker.save}
          />
        ) : null}
        <DropWorkDialog
          drop={drop}
          name={data.name}
          busy={busy}
          onCancel={() => setDrop(null)}
          onClear={() => removeWork(drop.appearance, '?quotes=clear')}
          onReplace={(to) => removeWork(drop.appearance, `?quotes=move&to=${encodeURIComponent(to)}`)}
        />
        {/* THE PACK'S OWN CONFIRMATION, word for word from its `ask` block: what
            it becomes, everywhere it reaches, and the one reassurance a reader
            needs before pressing — "This work keeps its own picture either way."
            A dashed red button with no question behind it would be a warning
            colour on a press that never warns. */}
        <ConfirmDialog
          open={!!promoteAsk}
          title={t('identity.picture.promote.ask.title')}
          body={<p className="microcopy">{t('identity.picture.promote.ask.body')}</p>}
          confirmLabel={t('identity.picture.promote.ask.verb')}
          onCancel={() => setPromoteAsk(null)}
          onConfirm={() => {
            const a = promoteAsk
            setPromoteAsk(null)
            if (a) promote(a.cast_id, a.work_title)
          }}
        />
      </div>
    )
  }

  // WHAT A WORK TILE COULD MEAN, as the pack's list. A row with nothing behind it
  // is still DRAWN and says so — the pack's own list carries one ("Available once
  // no work is linked") — but it does not make the press ambiguous.
  const workChoice = (a) => ({
    title: a.work_title,
    hint: t('identity.choose.work.hint'),
    options: [
      {
        key: 'work',
        label: a.work_title,
        sub: t('identity.choose.work.sub'),
        icon: <NavIcon name={GLYPH_NAME[mediumOf(a)] || 'movies'} />,
        onPick: onOpenWork ? () => onOpenWork(a.kind, a.work_id) : null,
        title: onOpenWork ? undefined : t('identity.choose.work.unreachable'),
      },
      {
        key: 'local',
        label: data.name,
        sub: t('identity.choose.local.sub'),
        face: a.image || '',
        meta: a.character && a.character !== data.name ? a.character : '',
        onPick: () => stack.push(characterPanel(stack, {
          id,
          name: data.name,
          onSearch,
          onOpenWork,
          work: { kind: a.kind, id: a.work_id, title: a.work_title, media_type: a.media_type, castId: a.cast_id },
        })),
      },
      ...(a.actor ? [{
        key: 'actor',
        label: a.actor,
        sub: t('identity.choose.actor.sub'),
        face: a.actor_image || '',
        onPick: a.actor_id
          ? () => stack.push(personPanel(stack, { id: a.actor_id, name: a.actor, onOpenWork }))
          : null,
        title: a.actor_id ? undefined : t('identity.credit.unnamed.tip'),
      }] : []),
    ],
  })

  // "WHEN THERE IS A CHOICE, IT ASKS; WHEN THERE IS ONLY ONE THING BEHIND THE
  // TILE, IT JUST OPENS IT." A sheet offering one answer is a sheet the reader
  // has to dismiss to reach the thing they already asked for, and it teaches them
  // to dismiss the ones that matter.
  const openWorkTile = (a) => {
    const spec = workChoice(a)
    const live = spec.options.filter((o) => o.onPick)
    if (live.length > 1) return setChoose(spec)
    return live[0]?.onPick?.()
  }

  if (scope.id === 'char-global') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'calc(var(--row) * 1.6)' }}>
        <ErrorText>{err}</ErrorText>
        <CharacterGlobal
          record={data}
          works={works}
          portraitActions={
            <>
              {globalPicture.verbs}
              {/* THE CLEAR IS THE APP'S AND NOT THE PACK'S, and it stays. The pack
                  has no clear on any artboard because the prototype never had a
                  picture to remove; the app does, and a picture a reader can set
                  three ways and un-set none is a one-way door. Drawn last, after
                  the three that put a picture there. */}
              {data.image_path ? (
                <GhostButton className="cs-verb" onClick={() => promote(0, '')} disabled={busy}>
                  {t('identity.character.promote.clear.label')}
                </GhostButton>
              ) : null}
              {globalPicture.pictureEditor}
            </>
          }
          onNames={() => setNames((v) => !v)}
          onSort={() => focusField('char-sort')}
          onBorn={() => focusField('char-born')}
          onLinkAdd={() => setLinkDialog(true)}
          // THE TILE ASKS WHAT YOU MEANT — the pack's `choose` sheet, offering the
          // work, this character as that work has them, and the performer
          // (`character-popup.dc.html:885-897`). "A tile cannot assume what you
          // meant by tapping it… When there is a choice, it asks; when there is
          // only one thing behind the tile, it just opens it."
          //
          // AND THE INLINE CARD THIS USED TO OPEN IS GONE, on the condition its
          // own comment set: "every per-work act — this work's picture, promoting
          // it to the record, taking the character off the work — belongs to
          // char-book / char-film / char-game, which are the local screens and
          // are not built yet. Dropping the controls now would leave a reader
          // unable to promote a picture at all." They are built, the chooser
          // reaches them, and every act the card held is on them — so the card
          // was the stopgap it always said it was.
          onOpenWork={(a) => openWorkTile(a)}
          onAddWork={() => focusField('char-add-work')}
          onMerge={() => focusField('char-merge')}
          // THE PACK'S REMOVAL ROW, drawn now because the sheet it opens exists.
          // Its whole design is that it does NOT act in bulk — "'Delete' here
          // would reach into three works at once and quietly strip a name off
          // each — the one edit on this screen whose damage you could not see
          // before it happened. So the verb states the reach and then hands back
          // the list… Slower on purpose, and the slowness is the safety." Each row
          // unlinks one work and the sheet stays open, so three become two under
          // the reader's hand.
          onRemoveAll={works.length ? () => setChoose({
            title: t('identity.remove-all.ask.title'),
            hint: t('identity.remove-all.ask.body'),
            options: works.map((a) => ({
              key: `w${a.cast_id}`,
              label: a.work_title,
              sub: t('identity.remove-all.unlink.sub'),
              icon: <NavIcon name={GLYPH_NAME[mediumOf(a)] || 'movies'} />,
              danger: true,
              stay: true,
              onPick: () => removeWork(a),
            })),
          }) : null}
        >
          {/* THE SECTIONS THE PACK DOES NOT DRAW, and the editors its rows are
              shortcuts into. Both are argued in identityGlobal.jsx's header. */}
          <MonoLabel>{t('identity.lines.title', { n: (data.lines || []).length, count: (data.lines || []).length })}</MonoLabel>
          <Lines lines={data.lines || []} shared={data.shared_lines || 0} empty={t('identity.lines.empty.character')} />
          {/* SPLIT HAS NOWHERE TO LIVE IN A ROW OF NAMES — it is a verb per
              spelling, and the row is one line of them — so the chips stay, as
              the row's editor rather than as a section of their own. */}
          {names ? (
            <>
              <MonoLabel>{t('identity.alias.title')}</MonoLabel>
              <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.body')}</p>
              <AliasRow aliases={data.aliases || []} onAdd={addAlias} onRemove={removeAlias} onSplit={splitAlias} />
            </>
          ) : null}
          <div id="char-add-work"><AddWork busy={busy} have={works} onAdd={addWork} /></div>
          <GlobalFields
            fields={[
              { key: 'name', id: 'char-name', label: t('common.field.name.label') },
              { key: 'sort_name', id: 'char-sort', label: t('identity.field.sort') },
              { key: 'born', id: 'char-born', label: t('identity.field.born') },
              { key: 'links', id: 'char-links', label: t('identity.field.links'), rows: 2 },
              { key: 'description', id: 'char-desc', label: t('identity.field.description'), rows: 3 },
              { key: 'note', id: 'char-note', label: t('identity.field.note'), rows: 2 },
            ]}
            form={form}
            onForm={setForm}
            stored={data}
            busy={busy}
            blocked={form.name.trim() ? '' : t('error.validate.name-required')}
            onSave={save}
          />
          <div id="char-merge">
            <MergeControl into={data} table="characters" onMerged={load} onError={setErr} />
          </div>
        </CharacterGlobal>
        {/* A CHARACTER IS NEVER AN ORGANISATION, so its list is the person one —
            which is right: a character has an IMDb page under /name/ the way a
            performer does, and no company id space at all. */}
        {choose ? (
          <ChoosePicker spec={choose} busy={busy} onClose={() => setChoose(null)} />
        ) : null}
        <ProviderLinkDialog
          open={linkDialog}
          onClose={() => setLinkDialog(false)}
          onAdd={addProviderLink}
          busy={busy}
        />
        {/* THE REFUSAL'S DIALOG BELONGS TO EVERY SCREEN THAT CAN REMOVE, and this
            one can: leaving it to the branch below meant a removal the server
            refused — the character still speaks on twelve lines — showed nothing
            at all here, so the press looked like it had failed silently. */}
        <DropWorkDialog
          drop={drop}
          name={data.name}
          busy={busy}
          onCancel={() => setDrop(null)}
          onClear={() => removeWork(drop.appearance, '?quotes=clear')}
          onReplace={(to) => removeWork(drop.appearance, `?quotes=replace&to=${encodeURIComponent(to)}`)}
        />
      </div>
    )
  }

  // NO FALL-THROUGH, AND THAT IS PROVABLE RATHER THAN HOPED. identityScope
  // returns exactly six ids — the two tables crossed with no-work, and the four
  // media collapsing to three character sheets because a show is film-like — and
  // the two branches above take all five a character can be in. The three-scope
  // presentation that used to stand here is gone: it was reachable only when a
  // work was named that the character had no cast row on, which the scope now
  // resolves to the global record instead, because that is the honest answer.
}

// workNoun names what a row is, from the two fields that say so. A book is a book;
// the film side carries media_type, which is 'movie', 'show' or 'game'.
function workNoun(a) {
  if (a.kind === 'book') return 'book'
  return a.media_type === 'show' ? 'show' : a.media_type === 'game' ? 'game' : 'film'
}

// AddWork — put this character into a work they are not in yet.
//
// THE LISTS ARE FETCHED ONCE, WHEN IT IS OPENED, and filtered here. A search
// endpoint over both shelves does not exist and inventing one for a picker would
// be a new route, a new query and a new pair of tests for a control that is
// reaching a few hundred titles the browser is about to hold anyway — the library
// screen loads exactly this and always has.
//
// WORKS THIS CHARACTER IS ALREADY IN ARE NOT OFFERED. The server answers 409 and
// the reader would have learned it by pressing.
function AddWork({ busy, have, onAdd }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(null)
  // WHO PLAYED THEM, OPTIONALLY, AT THE MOMENT OF TAGGING — the owner's own
  // ruling: "this lands a character without a tagged actor (which can also be
  // tagged when adding)". One box above the grid rather than a second step after
  // the pick: naming the performer is the same thought as naming the film, and a
  // form that asks afterwards makes it a separate act nobody completes.
  //
  // It is DROPPED FOR A BOOK rather than sent and refused. 0047's line is that a
  // book has characters and not a cast, and the API rejects the field — so a
  // reader who typed a performer and then picked a novel would get an error about
  // a box they were told was optional.
  const [actor, setActor] = useState('')

  useEffect(() => {
    if (!open || all) return
    let stale = false
    Promise.all([json('GET', '/books'), json('GET', '/movies')]).then(([b, m]) => {
      if (stale) return
      setAll([
        ...((b.ok && b.data.books) || []).map((x) => ({ kind: 'book', id: x.id, title: x.title, cover: x.cover_path, media_type: '' })),
        ...((m.ok && m.data.movies) || []).map((x) => ({ kind: 'movie', id: x.id, title: x.title, cover: x.poster_path, media_type: x.media_type || 'movie' })),
      ])
    })
    return () => {
      stale = true
    }
  }, [open, all])

  const hasKey = new Set((have || []).map((a) => `${a.kind}:${a.work_id}`))
  const term = q.trim().toLowerCase()
  const hits = (all || [])
    .filter((w) => !hasKey.has(`${w.kind}:${w.id}`))
    .filter((w) => !term || w.title.toLowerCase().includes(term))
    .slice(0, 24)

  if (!open) {
    return (
      <div>
        <GhostButton icon={<IconPlus />} onClick={() => setOpen(true)}>
          {t('identity.character.works.add.label')}
        </GhostButton>
      </div>
    )
  }
  return (
    <div style={FIELDS}>
      <input
        className="tp-input"
        autoFocus
        placeholder={t('identity.character.works.add.placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('identity.character.works.add.actor.label')}</MonoLabel>
        <input
          className="tp-input"
          placeholder={t('identity.character.works.add.actor.placeholder')}
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
      </label>
      {!all ? (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('common.state.loading')}</p>
      ) : hits.length === 0 ? (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.character.works.add.none')}</p>
      ) : (
        // A SCROLLER RATHER THAN A BARE overflow, which is the standing rule and
        // not a preference: the fade is what says there is more below, and the
        // press-drag is what lets a mouse reach it. A grid capped at 22em with
        // plain overflow gives a reader neither.
        <Scroller axis="v" className="char-picks">
          {hits.map((w) => (
            <button
              key={`${w.kind}:${w.id}`}
              type="button"
              className="char-pick"
              disabled={busy}
              onClick={async () => {
                await onAdd(w, w.kind === 'book' ? '' : actor.trim())
                setOpen(false)
                setQ('')
                setActor('')
              }}
            >
              {w.cover ? <img src={coverImgURL(w.cover)} alt="" loading="lazy" /> : <span className="char-pick-blank" aria-hidden="true" />}
              <span className="char-pick-title">{w.title}</span>
            </button>
          ))}
        </Scroller>
      )}
      <div>
        <GhostButton onClick={() => setOpen(false)}>{t('common.action.cancel.label')}</GhostButton>
      </div>
    </div>
  )
}

// DropWorkDialog — the question a refused removal asks.
//
// THE COUNT IS IN THE TITLE, because it is the whole of what the reader needs to
// decide with: rewriting three lines and rewriting ninety are different acts and
// only the number tells them apart. It comes from the server's 409 rather than
// from a count this panel makes, so it is the number the write will actually
// touch.
//
// TWO WAYS FORWARD AND NO THIRD. Doing nothing about the quotes is not offered
// because it does not work — a character named on a work's own line is adopted
// back onto its cast on the next read, for ever (cast_from_quotes.go), so a
// removal that leaves the lines alone undoes itself.
function DropWorkDialog({ drop, name, busy, onCancel, onClear, onReplace }) {
  const [to, setTo] = useState('')
  useEffect(() => {
    if (drop) setTo('')
  }, [drop])
  if (!drop) return null
  const n = drop.quotes
  return (
    <ConfirmDialog
      open
      title={t('identity.character.drop.title', { n, count: n, name, title: drop.appearance.work_title })}
      body={
        <div style={FIELDS}>
          <p className="microcopy">{t('identity.character.drop.body', { n, count: n, name })}</p>
          <label className="block">
            <MonoLabel className="mb-1.5 block">{t('identity.character.drop.replace.label')}</MonoLabel>
            <input
              className="tp-input"
              autoFocus
              placeholder={t('identity.character.drop.replace.placeholder')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || busy || !to.trim()) return
                e.preventDefault()
                onReplace(to.trim())
              }}
            />
          </label>
          {/* CLEARING IS THE DESTRUCTIVE ONE OF THE TWO and is not the dialog's
              primary button: the name comes off every line and nothing takes its
              place, so a line that named only this character ends with no speaker
              at all. It is offered because a reader who typed a character in by
              mistake wants exactly that, and it is a link because the button that
              keeps the meaning should be the one under the thumb. */}
          <div>
            <button type="button" className="tp-link" style={{ color: 'var(--error)' }} disabled={busy} onClick={onClear}>
              {t('identity.character.drop.clear.action', { n, count: n })}
            </button>
          </div>
        </div>
      }
      confirmLabel={t('identity.character.drop.replace.action')}
      confirmDisabled={busy || !to.trim()}
      onConfirm={() => onReplace(to.trim())}
      onCancel={onCancel}
    />
  )
}
