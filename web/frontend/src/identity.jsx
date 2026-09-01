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
import { personImgURL, ProviderChips } from './people.jsx'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  FieldIconButton,
  GhostButton,
  IconDelete,
  IconPlus,
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

// characterPanel — the same, for the other table.
export function characterPanel(stack, { id, name }) {
  return {
    title: name || t('identity.character.title'),
    wide: true,
    render: () => <CharacterBody stack={stack} id={id} />,
  }
}

// ---- shared pieces ---------------------------------------------------------

// Scope — a section with its blast radius written above it.
//
// THE SENTENCE IS THE POINT. A heading alone ("On this work") is a label a reader
// skims; the line under it is what stops them believing they renamed somebody
// everywhere. It is not optional and there is no variant without one.
function Scope({ title, scope, children }) {
  return (
    <section style={STACK}>
      <div>
        <MonoLabel>{title}</MonoLabel>
        <p className="microcopy" style={{ color: 'var(--soft)', marginTop: 2 }}>{scope}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, onChange, rows = 0 }) {
  return (
    <label className="block">
      <MonoLabel className="mb-1.5 block">{label}</MonoLabel>
      {rows > 0 ? (
        <textarea className="tp-input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="tp-input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
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
        <div className="flex flex-col gap-1">
          <MonoLabel>{t('identity.person.portrait.title')}</MonoLabel>
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
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      sort_name: data.sort_name || '',
      born: data.born || '',
      died: data.died || '',
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
                        onClick={() => stack.push(characterPanel(stack, { id: r.character_id, name: r.character }))}
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

function CharacterBody({ stack, id }) {
  const { data, err, setErr, load } = useRecord(`/characters/${id}`)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  // The removal a work refused, with the number of quotes standing in its way.
  const [drop, setDrop] = useState(null)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      sort_name: data.sort_name || '',
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
  const addWork = async (work) => {
    setBusy(true)
    const r = await json('POST', `/characters/${id}/works`, { kind: work.kind, work_id: work.id })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setErr('')
    toast(t('identity.character.works.add.done', { title: work.title }))
    load()
  }

  if (err && !data) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>
  const works = data.appearances || []

  return (
    <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
      <ErrorText>{err}</ErrorText>

      {/* WHO THEY ARE, ABOVE THE SCOPES. The face and the two numbers are facts
          about the record rather than a change with a blast radius, so they sit
          above the first Scope rather than inside one — a heading that says "across
          the library" over a portrait would be claiming the portrait is a library
          fact, and it is the opposite. */}
      <CharacterHead record={data} works={works} onClear={() => promote(0, '')} />

      <Scope title={t('identity.scope.library.title')} scope={t('identity.scope.library.character')}>
        <div style={FIELDS}>
          <MonoLabel>{t('identity.character.appearances.title', { n: works.length, count: works.length })}</MonoLabel>
          {works.length === 0 ? (
            <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.character.appearances.empty')}</p>
          ) : (
            <div className="char-works">
              {works.map((a) => (
                <AppearanceCard
                  key={a.cast_id}
                  a={a}
                  busy={busy}
                  isFace={!!data.image_path && data.image_path === a.image}
                  onImage={(url) => setWorkImage(a.cast_id, url)}
                  onPromote={() => promote(a.cast_id, a.work_title)}
                  onRemove={() => removeWork(a)}
                  onOpenPerson={a.actor_id ? () => stack.push(personPanel(stack, { id: a.actor_id, name: a.actor })) : null}
                />
              ))}
            </div>
          )}
          <AddWork busy={busy} have={works} onAdd={addWork} />
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

      <Scope title={t('identity.scope.record.title')} scope={t('identity.scope.record.character')}>
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
        {face ? <img src={face} alt="" /> : <span aria-hidden="true" />}
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
function AppearanceCard({ a, busy, isFace, onImage, onPromote, onRemove, onOpenPerson }) {
  const [confirming, setConfirming] = useState(false)
  const { faceButton, pictureEditor } = useCharacterPicture({
    row: { id: a.cast_id, character: a.character, actor: a.actor, character_image_path: a.image },
    workTitle: a.work_title,
    mediaType: a.media_type,
    busy,
    onImage,
  })
  const cover = a.cover ? coverImgURL(a.cover) : ''
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
        <div className="char-work-acts">
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
                await onAdd(w)
                setOpen(false)
                setQ('')
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
