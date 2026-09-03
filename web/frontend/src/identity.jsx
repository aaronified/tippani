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
import { coverImgURL, errText, json } from './api.js'
import { t } from './i18n.js'
import { useCharacterPicture, usePicturePicker } from './cast.jsx'
import { CharacterGlobal, PersonGlobal } from './identityGlobal.jsx'
import { personImgURL, ProviderChips, SpeakerChips } from './people.jsx'
import { Silhouette } from './silhouette.jsx'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  ExpandableText,
  FieldIconButton,
  GhostButton,
  IconDelete,
  IconPlus,
  InfoDot,
  MonoLabel,
  Scroller,
  toast,
  Tooltip,
} from './ui.jsx'

// A section's stack, from the app's own spacing constant rather than a typed step
// — see the standing rule, and spacing-debt.test.js, which counts the typed ones.
const STACK = { display: 'grid', gap: 'var(--row)' }
const FIELDS = { display: 'grid', gap: 'calc(var(--row) * 0.9)' }

// ---- the panels, as descriptors --------------------------------------------

// personPanel — open a person by id. `work` puts the first scope on screen; open
// it from a list and there is no work to be on, so that section is simply absent
// rather than present and inert.
export function personPanel(stack, { id, name, work = null }) {
  return {
    title: name || t('identity.person.title'),
    wide: true,
    render: () => <PersonBody stack={stack} id={id} work={work} />,
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
export function characterPanel(stack, { id, name, work = null }) {
  return {
    title: name || t('identity.character.title'),
    wide: true,
    render: () => <CharacterBody stack={stack} id={id} work={work} />,
  }
}

// ---- shared pieces ---------------------------------------------------------

// Scope — a section with its blast radius written above it.
//
// THE SENTENCE IS THE POINT. A heading alone ("On this work") is a label a reader
// skims; the line under it is what stops them believing they renamed somebody
// everywhere. It is not optional and there is no variant without one.
function Scope({ title, scope, hint, tone, children }) {
  return (
    <section style={STACK} className={tone ? `identity-scope is-${tone}` : 'identity-scope'}>
      <div>
        <span className="identity-scope-head">
          <MonoLabel>{title}</MonoLabel>
          {/* THE DOT IS FOR THE GRAIN, and the sentence under it for the blast
              radius. They are two different questions — "what IS this section
              about" and "what does saving here change" — and the second read
              alone leaves a reader who has not yet worked out that a character
              exists twice: once on a cast row and once as a record. */}
          {hint ? <InfoDot text={hint} title={title} /> : null}
        </span>
        <p className="microcopy" style={{ color: 'var(--soft)', marginTop: 2 }}>{scope}</p>
      </div>
      {children}
    </section>
  )
}

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
function focusField(id) {
  const el = typeof document === 'undefined' ? null : document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus()
}

// WorkList — the works a record is in, as rows that open nothing.
//
// DELIBERATELY NOT LINKS, for now. A row that looks pressable and is not is worse
// than a row that does not, and opening a work from here means closing the panel
// stack and navigating the shell — which is the work detail screen's job and does
// not exist yet. The rows say what they say; the doors arrive with that screen.
function WorkList({ items, empty, line }) {
  // A LINE, NOT AN EmptyState. That component is sized for a page — it centres and
  // reserves height — and inside a panel section it reads as a hole where a list
  // should be. What is needed here is one sentence saying the list is genuinely
  // empty rather than still loading.
  if (!items.length) return <p className="microcopy" style={{ color: 'var(--faint)' }}>{empty}</p>
  return (
    <ul style={FIELDS}>
      {items.map((w, i) => (
        <li key={`${w.kind}-${w.work_id ?? w.cast_id}-${i}`} className="flex items-baseline gap-2">
          <span style={{ fontWeight: 600 }}>{w.title || w.work_title}</span>
          <span className="microcopy" style={{ color: 'var(--soft)' }}>{line(w)}</span>
        </li>
      ))}
    </ul>
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
function MergeControl({ into, onMerged, onError, table = 'people' }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  // BOTH TABLES, ONE CONTROL. 0056 gave characters their own search and their own
  // merge with the same shape as people's, and the case a character merge exists
  // for is the loudest one in the app: the backfill makes a record PER WORK, so
  // eight films of one wizard are eight Harry Potters. A second copy of this
  // control for them would be a second place the confirm's promise is worded.
  const body = table === 'people' ? 'identity.merge.body' : 'identity.merge.body.character'

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

function PersonBody({ stack, id, work }) {
  const { data, err, setErr, load } = useRecord(`/people/id/${id}`)
  const [creditAs, setCreditAs] = useState('')
  // Same disclosure as the character screen, for the same reason. See there.
  const [names, setNames] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

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
    if (work) {
      const here = (data.credits || []).find((c) => c.kind === work.kind && c.work_id === work.id)
      setCreditAs(here?.credit_as || '')
    }
  }, [data, work])

  if (err) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>

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
  const setPortrait = async (url) => {
    setBusy(true)
    const r = await json('PUT', `/people/id/${id}`, url ? { image_url: url } : { clear_image: true })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    load()
  }

  const saveCreditAs = async () => {
    setBusy(true)
    const r = await json('PUT', '/credits', {
      kind: work.kind, work_id: work.id, role: work.role, person_id: id, credit_as: creditAs,
    })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    toast(t('identity.credit.saved', { title: work.title }))
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

  // ---- people-global, the pack's own screen --------------------------------
  //
  // Same split as the character side: no work means this is `people-global`, and
  // the pack's vocabulary draws it. `people-work` — the credit spelling, which
  // the pack does not draw at all — keeps the panel's older presentation below.
  if (!work) {
    return (
      <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
        <ErrorText>{err}</ErrorText>
        <PersonGlobal
          record={data}
          credits={data.credits || []}
          roles={data.roles || []}
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
            data.image_path ? (
              <GhostButton onClick={() => setPortrait('')} disabled={busy}>
                {t('identity.person.portrait.clear.label')}
              </GhostButton>
            ) : null
          }
          onNames={() => setNames((v) => !v)}
          onSort={() => focusField('person-sort')}
          onBorn={() => focusField('person-born')}
          onLinkAdd={() => focusField('person-links')}
          onOpenWork={(c) => stack.push(personPanel(stack, {
            id, name: data.name, work: { kind: c.kind, id: c.work_id, title: c.title, role: c.role },
          }))}
          // A ROLE TILE OPENS THE CHARACTER — the owner's ruling read in the
          // direction a reader travels. Where the cast row points at no record
          // there is nothing to open, so it opens that work's credit instead.
          onOpenRole={(a) => stack.push(a.character_id
            ? characterPanel(stack, {
              id: a.character_id, name: a.character,
              work: { kind: a.kind, id: a.work_id, title: a.work_title, media_type: a.media_type, castId: a.cast_id },
            })
            : personPanel(stack, { id, name: data.name, work: { kind: a.kind, id: a.work_id, title: a.work_title, role: 'performer' } }))}
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
          <div style={FIELDS}>
            <Portrait person={data} busy={busy} onPicked={setPortrait} onClear={() => setPortrait('')} />
            <Field inputId="person-name" label={t('common.field.name.label')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field inputId="person-sort" label={t('identity.field.sort')} value={form.sort_name} onChange={(v) => setForm({ ...form, sort_name: v })} />
            <Field inputId="person-born" label={t('identity.field.born')} value={form.born} onChange={(v) => setForm({ ...form, born: v })} />
            <Field inputId="person-died" label={t('identity.field.died')} value={form.died} onChange={(v) => setForm({ ...form, died: v })} />
            <Field inputId="person-links" label={t('identity.field.links')} value={form.links} onChange={(v) => setForm({ ...form, links: v })} rows={2} />
            <Field inputId="person-note" label={t('identity.field.note')} value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
            <div className="flex justify-end">
              <GhostButton className="tp-btn-primary" disabled={busy || !form.name.trim()} onClick={save}>
                {t('common.action.save.label')}
              </GhostButton>
            </div>
          </div>
          <div id="person-merge">
            <MergeControl into={data} onMerged={load} onError={setErr} />
          </div>
        </PersonGlobal>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
      <ErrorText>{err}</ErrorText>

      {/* SCOPE 1, and only when there is a work to be on. */}
      {work && (
        <Scope title={t('identity.scope.work.title')} scope={t('identity.scope.work.body', { title: work.title })}>
          <div style={FIELDS}>
            <p className="microcopy" style={{ color: 'var(--soft)' }}>
              {t('identity.scope.work.role', { role: t(`unit.role.${work.role}`, { count: 1 }) })}
            </p>
            <Field label={t('identity.credit.as.label')} value={creditAs} onChange={setCreditAs} />
            <p className="microcopy" style={{ color: 'var(--faint)' }}>
              {t('identity.credit.as.hint', { name: data.name })}
            </p>
            <div className="flex justify-end">
              <GhostButton disabled={busy} onClick={saveCreditAs}>{t('common.action.save.label')}</GhostButton>
            </div>
          </div>
        </Scope>
      )}

      {/* SCOPE 2 — what the record is in, and what finds it. */}
      <Scope title={t('identity.scope.library.title')} scope={t('identity.scope.library.body')}>
        <div style={FIELDS}>
          <MonoLabel>{t('identity.person.credits.title', { n: (data.credits || []).length, count: (data.credits || []).length })}</MonoLabel>
          <WorkList
            items={data.credits || []}
            empty={t('identity.person.credits.empty')}
            line={(w) => [t(`unit.role.${w.role}`, { count: 1 }), w.credit_as && t('identity.credit.as.on', { as: w.credit_as })].filter(Boolean).join(' · ')}
          />
          {/* THE OTHER DIRECTION OF THE CAST — every character this performer has
              been linked to, which is the owner's own ruling for this page. */}
          {(data.roles || []).length > 0 && (
            <>
              <MonoLabel>{t('identity.person.roles.title', { n: data.roles.length, count: data.roles.length })}</MonoLabel>
              <ul style={FIELDS}>
                {data.roles.map((r) => (
                  <li key={r.cast_id} className="flex items-baseline gap-2">
                    {r.character_id ? (
                      <button
                        type="button"
                        className="tp-link"
                        // WITH THE WORK, because the row names one. "Woland ·
                        // The Master and Margarita (2005)" is a question about
                        // that role on that work, and a page that opened on a
                        // grid of eight would make the reader find again the row
                        // they had just pressed.
                        onClick={() => stack.push(characterPanel(stack, {
                          id: r.character_id,
                          name: r.character,
                          // `cast_id` rather than the work alone: this row IS a
                          // cast row, and a performer's roles list is exactly
                          // where a twice-billed character shows up as two rows.
                          work: { kind: r.kind, id: r.work_id, title: r.work_title, castId: r.cast_id },
                        }))}
                      >
                        {r.character}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{r.character}</span>
                    )}
                    <span className="microcopy" style={{ color: 'var(--soft)' }}>{r.work_title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* LINKS OUT, READ-ONLY HERE AND ON PURPOSE. The reference pages are
              fetched and merged by the person modal, which owns the lookup, the
              portrait and the rollback of a half-fetched image. Drawing an editor
              for them here would be the second place that machinery lives; showing
              what is stored costs nothing and is the half the panel is missing
              without it. */}
          {/* WHAT THEY SAID, which the record has carried since the link landed
              and nothing has ever drawn. */}
          <MonoLabel>{t('identity.lines.title', { n: (data.lines || []).length, count: (data.lines || []).length })}</MonoLabel>
          <Lines lines={data.lines || []} shared={data.shared_lines || 0} empty={t('identity.lines.empty.person')} />
          <MonoLabel>{t('identity.links.title')}</MonoLabel>
          <ProviderChips links={data.links} />
          <MonoLabel>{t('identity.alias.title')}</MonoLabel>
          <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.body')}</p>
          <AliasRow aliases={data.aliases || []} onAdd={addAlias} onRemove={removeAlias} onSplit={splitAlias} />
          {/* MERGE IS THE ONE DESTRUCTIVE ACT HERE, so it sits at the bottom of the
              section that is about identity, and it asks before it runs. */}
          <MergeControl into={data} onMerged={load} onError={setErr} />
        </div>
      </Scope>

      {/* SCOPE 3 — the record. A change here reaches every work. */}
      <Scope title={t('identity.scope.record.title')} scope={t('identity.scope.record.person')}>
        <div style={FIELDS}>
          {/* THE PORTRAIT, AT LAST ON THE RECORD. It has only ever been settable
              through the enrichment modal, which writes by (kind, name) and lands
              on the LOWEST id where two records share a name — so a picture chosen
              for the second of two namesakes went onto the first, and the panel
              that knows exactly which record it is looking at could not offer one.
              Same control as a character's, because it is the same act. */}
          <Portrait person={data} busy={busy} onPicked={setPortrait} onClear={() => setPortrait('')} />
          <Field label={t('common.field.name.label')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label={t('identity.field.sort')} value={form.sort_name} onChange={(v) => setForm({ ...form, sort_name: v })} />
          <div className="flex gap-3">
            <Field label={t('identity.field.born')} value={form.born} onChange={(v) => setForm({ ...form, born: v })} />
            <Field label={t('identity.field.died')} value={form.died} onChange={(v) => setForm({ ...form, died: v })} />
          </div>
          <Field label={t('identity.field.note')} value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
          <div className="flex justify-end">
            <GhostButton className="tp-btn-primary" disabled={busy || !form.name.trim()} onClick={save}>
              {t('common.action.save.label')}
            </GhostButton>
          </div>
        </div>
      </Scope>
    </div>
  )
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

function CharacterBody({ stack, id, work }) {
  const { data, err, setErr, load } = useRecord(`/characters/${id}`)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  // The removal a work refused, with the number of quotes standing in its way.
  const [drop, setDrop] = useState(null)
  // THE NAME ROW IS A DISPLAY AND ITS EDITOR IS BEHIND IT, which is the pack's
  // model for every row it draws. It is also the only way the two can coexist:
  // the row lists every spelling as its second line, so an always-open chip list
  // under it printed each alias twice and a reader had to work out whether the
  // two lists were the same thing.
  const [names, setNames] = useState(false)
  // WHICH APPEARANCE'S CARD IS OPEN, by cast row.
  //
  // THE STRIP IS THE SHELF AND THE CARD IS ITS EDITOR. The pack's global screen
  // draws the works as a strip of tiles and nothing else: every per-work act —
  // this work's picture, promoting it to the record, taking the character off the
  // work — belongs to `char-book` / `char-film` / `char-game`, which are the
  // local screens and are not built yet. Dropping the controls now would leave a
  // reader unable to promote a picture at all, and drawing the cards under the
  // strip would list every work twice. So the tile opens its own card, which is
  // the same row→editor shape the name row above it uses.
  const [openWork, setOpenWork] = useState(0)

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
  const setWorkImage = async (castID, url) => {
    setBusy(true)
    const r = await json('POST', `/cast/${castID}/image`, url ? { image_url: url } : undefined)
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

  if (err && !data) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>
  const works = data.appearances || []
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
  if (!here) {
    return (
      <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
        <ErrorText>{err}</ErrorText>
        <CharacterGlobal
          record={data}
          works={works}
          portraitActions={
            data.image_path ? (
              <GhostButton onClick={() => promote(0, '')} disabled={busy}>
                {t('identity.character.promote.clear.label')}
              </GhostButton>
            ) : null
          }
          onNames={() => setNames((v) => !v)}
          onSort={() => focusField('char-sort')}
          onBorn={() => focusField('char-born')}
          onLinkAdd={() => focusField('char-links')}
          // THE TILE OPENS ITS OWN CARD — see `openWork` above for why that
          // rather than pushing the work's screen. The pack opens an exhaustive
          // chooser here (the owner's widening: every character in the work,
          // every person credited on it, and the work itself); that chooser and
          // the local screens are the next increment.
          onOpenWork={(a) => setOpenWork((cur) => (cur === a.cast_id ? 0 : a.cast_id))}
          onAddWork={() => focusField('char-add-work')}
          onMerge={() => focusField('char-merge')}
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
          {/* The opened tile's card, with every per-work act on it. */}
          {works.filter((a) => a.cast_id === openWork).map((a) => (
            <div className="char-works is-one" key={a.cast_id}>
              <AppearanceCard
                a={a}
                busy={busy}
                isFace={!!data.image_path && data.image_path === a.image}
                onImage={(url) => setWorkImage(a.cast_id, url)}
                onSave={(fields) => saveAppearance(a, fields)}
                onPromote={() => promote(a.cast_id, a.work_title)}
                onRemove={() => removeWork(a)}
                onOpenPerson={a.actor_id ? () => stack.push(personPanel(stack, { id: a.actor_id, name: a.actor })) : null}
              />
            </div>
          ))}
          <div id="char-add-work"><AddWork busy={busy} have={works} onAdd={addWork} /></div>
          <div style={FIELDS}>
            <Field inputId="char-name" label={t('common.field.name.label')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field inputId="char-sort" label={t('identity.field.sort')} value={form.sort_name} onChange={(v) => setForm({ ...form, sort_name: v })} />
            <Field inputId="char-born" label={t('identity.field.born')} value={form.born} onChange={(v) => setForm({ ...form, born: v })} />
            <Field inputId="char-links" label={t('identity.field.links')} value={form.links} onChange={(v) => setForm({ ...form, links: v })} rows={2} />
            <Field inputId="char-desc" label={t('identity.field.description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
            <Field inputId="char-note" label={t('identity.field.note')} value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
            <div className="flex justify-end">
              <GhostButton className="tp-btn-primary" disabled={busy || !form.name.trim()} onClick={save}>
                {t('common.action.save.label')}
              </GhostButton>
            </div>
          </div>
          <div id="char-merge">
            <MergeControl into={data} table="characters" onMerged={load} onError={setErr} />
          </div>
        </CharacterGlobal>
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

  return (
    <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
      <ErrorText>{err}</ErrorText>

      {/* WHO THEY ARE, ABOVE THE SCOPES. The face and the two numbers are facts
          about the record rather than a change with a blast radius, so they sit
          above the first Scope rather than inside one — a heading that says "across
          the library" over a portrait would be claiming the portrait is a library
          fact, and it is the opposite. */}
      <CharacterHead record={data} works={works} onClear={() => promote(0, '')} />

      {/* SCOPE 0 — this character ON THE WORK THE READER CAME FROM, and only when
          they came from one. It is the same card the grid below draws, because it
          is the same row and a second layout for it would be a second place the
          picture ladder and the per-work description have to agree. What differs
          is where it sits and what it wears: first, alone, and inked — see
          `.identity-scope.is-work` in the CSS for why the ink rather than a box. */}
      {here && (
        <Scope
          tone="work"
          title={t('identity.scope.work.title')}
          hint={t('identity.scope.work.hint.character')}
          scope={t('identity.scope.work.body', { title: here.work_title })}
        >
          <div className="char-works is-one">
            <AppearanceCard
              a={here}
              busy={busy}
              isFace={!!data.image_path && data.image_path === here.image}
              onImage={(url) => setWorkImage(here.cast_id, url)}
              onSave={(fields) => saveAppearance(here, fields)}
              onPromote={() => promote(here.cast_id, here.work_title)}
              onRemove={() => removeWork(here)}
              onOpenPerson={here.actor_id ? () => stack.push(personPanel(stack, { id: here.actor_id, name: here.actor })) : null}
            />
          </div>
        </Scope>
      )}

      <Scope
        tone="library"
        title={t('identity.scope.library.title')}
        hint={t('identity.scope.library.hint.character')}
        scope={t('identity.scope.library.character')}
      >
        <div style={FIELDS}>
          {/* THE COUNT COUNTS EVERY WORK, including the one lifted out above — a
              character in eight films is in eight films whichever one you opened
              it from. The heading changes to say which set is DRAWN below it. */}
          <MonoLabel>
            {here
              ? t('identity.character.appearances.others', { n: elsewhere.length, count: elsewhere.length })
              : t('identity.character.appearances.title', { n: works.length, count: works.length })}
          </MonoLabel>
          {elsewhere.length === 0 ? (
            <p className="microcopy" style={{ color: 'var(--faint)' }}>
              {here ? t('identity.character.appearances.only') : t('identity.character.appearances.empty')}
            </p>
          ) : (
            <div className="char-works">
              {elsewhere.map((a) => (
                <AppearanceCard
                  key={a.cast_id}
                  a={a}
                  busy={busy}
                  isFace={!!data.image_path && data.image_path === a.image}
                  onImage={(url) => setWorkImage(a.cast_id, url)}
                  onSave={(fields) => saveAppearance(a, fields)}
                  onPromote={() => promote(a.cast_id, a.work_title)}
                  onRemove={() => removeWork(a)}
                  onOpenPerson={a.actor_id ? () => stack.push(personPanel(stack, { id: a.actor_id, name: a.actor })) : null}
                />
              ))}
            </div>
          )}
          <AddWork busy={busy} have={works} onAdd={addWork} />
          {/* THE QUESTION THE FOLD COULD NEVER ANSWER. "Which quotes are this
              role's" has no honest answer over a text column, and this list is the
              whole reason the speaker link is a column rather than a match. */}
          <MonoLabel>{t('identity.lines.title', { n: (data.lines || []).length, count: (data.lines || []).length })}</MonoLabel>
          <Lines lines={data.lines || []} shared={data.shared_lines || 0} empty={t('identity.lines.empty.character')} />
          <MonoLabel>{t('identity.alias.title')}</MonoLabel>
          <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.body')}</p>
          <AliasRow aliases={data.aliases || []} onAdd={addAlias} onRemove={removeAlias} onSplit={splitAlias} />
          {/* MERGE IS THE ONE DESTRUCTIVE ACT HERE, so it sits at the bottom of the
              section about identity and it asks before it runs — and this is the
              table where it is needed most: the 3.1.0 backfill deliberately makes a
              record per work, so eight films of one wizard are eight records
              waiting to be welded by somebody who has decided they are one. */}
          <MergeControl into={data} table="characters" onMerged={load} onError={setErr} />
        </div>
      </Scope>

      <Scope
        tone="record"
        title={t('identity.scope.record.title')}
        hint={t('identity.scope.record.hint.character')}
        scope={t('identity.scope.record.character')}
      >
        <div style={FIELDS}>
          <Field label={t('common.field.name.label')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label={t('identity.field.sort')} value={form.sort_name} onChange={(v) => setForm({ ...form, sort_name: v })} />
          <Field label={t('identity.field.description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
          <Field label={t('identity.field.note')} value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
          <div className="flex justify-end">
            <GhostButton className="tp-btn-primary" disabled={busy || !form.name.trim()} onClick={save}>
              {t('common.action.save.label')}
            </GhostButton>
          </div>
        </div>
      </Scope>

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

// CharacterHead — the face, the name and how much hangs off the record.
//
// THE FACE IS NOT EDITED HERE, and that is the design rather than an omission.
// Every picture a character has belongs to a WORK — one cast row's costume photo —
// and this slot only says which of them the record wears. Choosing is done on the
// card that holds the picture, where the reader can see what they are choosing
// between; a second picker here would be a picture with no work attached, which
// the schema has nowhere to put.
function CharacterHead({ record, works, onClear }) {
  const face = record.image_path ? coverImgURL(record.image_path) : ''
  return (
    <div className="char-head">
      <div className={'char-head-face' + (face ? '' : ' is-empty')}>
        {face ? <img src={face} alt="" /> : <Silhouette name={record.name} />}
      </div>
      <div className="char-head-facts">
        <h2 className="char-head-name">{record.name}</h2>
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          {t('identity.character.appearances.title', { n: works.length, count: works.length })}
          {(record.aliases || []).length > 0 && (
            <> · {t('identity.character.head.aliases', { n: record.aliases.length, count: record.aliases.length })}</>
          )}
        </p>
        {face ? (
          <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-12)' }} onClick={onClear}>
            {t('identity.character.promote.clear.label')}
          </button>
        ) : (
          <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.character.face.none')}</p>
        )}
      </div>
    </div>
  )
}

// AppearanceCard — one work this character is in.
//
// THE WORK'S COVER IS THE CARD and the character's own picture sits on it, which
// is the same stacking a film still has on a poster wall. Where a work holds no
// picture of the character the slot is EMPTY rather than filled with the record's
// own: a panel that silently substitutes cannot then say "this work has none", and
// "has none" is the state the reader is here to fix.
//
// SO THIS ROW IS BUILT BY HAND AND MUST STAY THAT WAY. useCharacterPicture grew a
// middle rung — the record's own default, under the per-work picture — for the
// benefit of a WORK's cast panel, where a merged character should show a face.
// Here that rung is exactly wrong, and the reason it is absent is that this
// object never carries `character_record_image`. Spreading the appearance row in
// to "simplify" this would turn every empty slot on this panel into the record's
// face and take away the one thing the panel is for.
function AppearanceCard({ a, busy, isFace, onImage, onSave, onPromote, onRemove, onOpenPerson }) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const { faceButton, pictureEditor } = useCharacterPicture({
    row: { id: a.cast_id, character: a.character, actor: a.actor, character_image_path: a.image },
    workTitle: a.work_title,
    mediaType: a.media_type,
    busy,
    onImage,
  })
  const cover = a.cover ? coverImgURL(a.cover) : ''
  const open = () => {
    setDraft({ character: a.character || '', actor: a.actor || '', description: a.description || '' })
    setEditing(true)
  }
  const commit = async () => {
    if (!draft.character.trim()) return
    if (await onSave({ ...draft, character: draft.character.trim(), actor: draft.actor.trim() })) setEditing(false)
  }
  return (
    <div className="char-work">
      <div className="char-work-art">
        {cover ? <img className="char-work-cover" src={cover} alt="" loading="lazy" /> : <span className="char-work-cover is-empty" aria-hidden="true" />}
        <span className="char-work-face">{faceButton}</span>
      </div>
      <div className="char-work-facts">
        {/* NEVER TRUNCATED — the standing rule, and a title is a name. It wraps. */}
        <span className="char-work-title">{a.work_title}</span>
        <span className="mono-label">{t(`unit.${workNoun(a)}`, { count: 1 })}</span>
        {/* THE NAME THIS WORK BILLS THEM UNDER, where it differs from the record's.
            One character legitimately reads differently on each work — a novel's
            "the professor" is a film's "Woland" — and a card that printed only the
            record's name would hide the thing the reader came to check. Silent
            where the two agree, because repeating a name under itself is noise. */}
        {a.character && a.character !== '' && (
          <span className="microcopy" style={{ color: 'var(--soft)' }}>{a.character}</span>
        )}
        {/* THE PERFORMER, WHERE THERE IS ONE. A book character has none, and the
            card says nothing rather than drawing an empty slot — a slot invites a
            value and there is nothing true to put in it. */}
        {a.actor ? (
          <span className="microcopy" style={{ color: 'var(--soft)' }}>
            {onOpenPerson ? (
              <button type="button" className="tp-link" onClick={onOpenPerson}>{a.actor}</button>
            ) : (
              a.actor
            )}
          </span>
        ) : null}
        {a.description && !editing && (
          <p className="microcopy char-work-desc">{a.description}</p>
        )}
        <div className="char-work-acts">
          <button type="button" className="tp-link" disabled={busy} onClick={editing ? () => setEditing(false) : open}>
            {editing ? t('common.action.cancel.label') : t('common.action.edit.label')}
          </button>
          {/* PROMOTE IS A JUDGEMENT AND SAYS SO, which is why it is a word rather
              than a glyph: there is no picture of "and this one is what they look
              like". It is absent, not disabled, on a work holding no picture —
              there is nothing to promote and a greyed control invites a press. */}
          {a.image && (
            isFace ? (
              <span className="mono-label" style={{ color: 'var(--accent-ui)' }}>{t('identity.character.promote.current')}</span>
            ) : (
              <button type="button" className="tp-link" disabled={busy} onClick={onPromote}>
                {t('identity.character.promote.label')}
              </button>
            )
          )}
          <Tooltip label={t('identity.character.works.remove.label')}>
            <FieldIconButton
              icon={<IconDelete />}
              ariaLabel={t('identity.character.works.remove.aria', { title: a.work_title })}
              disabled={busy}
              danger
              onClick={() => setConfirming(true)}
            />
          </Tooltip>
        </div>
        {/* THE PER-WORK FIELDS, and the scope line above them is not optional. This
            form writes to one cast row; the identical-looking fields two sections
            down write to the record and reach every work it is on. A reader who
            cannot tell those apart will rename a character everywhere by accident,
            which is the whole reason this file is shaped in scopes. */}
        {editing && draft && (
          <div className="char-work-form">
            <p className="microcopy" style={{ color: 'var(--soft)' }}>
              {t('identity.character.appearance.scope', { title: a.work_title })}
            </p>
            <Field label={t('identity.character.appearance.name')} value={draft.character} onChange={(v) => setDraft({ ...draft, character: v })} />
            {a.kind !== 'book' && (
              <Field label={t('common.field.actor.label')} value={draft.actor} onChange={(v) => setDraft({ ...draft, actor: v })} />
            )}
            <Field label={t('identity.field.description')} value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} rows={3} />
            <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.character.appearance.description.hint')}</p>
            <div className="flex justify-end">
              <GhostButton className="tp-btn-primary" disabled={busy || !draft.character.trim()} onClick={commit}>
                {t('common.action.save.label')}
              </GhostButton>
            </div>
          </div>
        )}
        {confirming && (
          // An inline confirm rather than a dialog, matching the cast row's: this
          // is one card of several and a modal for one of them would be worse. The
          // dialog above it is for the case that is genuinely a question — quotes
          // still naming the character — and this is only the press.
          <div className="char-work-confirm">
            <span className="microcopy">{t('identity.character.works.remove.confirm', { title: a.work_title })}</span>
            <GhostButton type="button" disabled={busy} onClick={onRemove}>{t('common.action.remove.label')}</GhostButton>
            <GhostButton type="button" onClick={() => setConfirming(false)}>{t('common.action.cancel.label')}</GhostButton>
          </div>
        )}
      </div>
      {pictureEditor}
    </div>
  )
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
