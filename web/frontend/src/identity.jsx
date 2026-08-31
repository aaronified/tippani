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
import { errText, json } from './api.js'
import { t } from './i18n.js'
import { ProviderChips } from './people.jsx'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  GhostButton,
  IconPlus,
  MonoLabel,
  toast,
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
function MergeControl({ into, onMerged, onError }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim()) return setHits([])
    let stale = false
    json('GET', `/people/search?q=${encodeURIComponent(q.trim())}`).then((r) => {
      if (stale || !r.ok) return
      // Never this record: merging something into itself is refused by the server
      // and offering it here would be a row whose only outcome is an error.
      setHits((r.data.people || []).filter((p) => p.id !== into.id))
    })
    return () => {
      stale = true
    }
  }, [q, into.id])

  const merge = async () => {
    setBusy(true)
    const r = await json('POST', '/people/merge', { keep_id: into.id, drop_id: pick.id })
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
      <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.merge.body', { name: into.name })}</p>
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

function CharacterBody({ stack, id }) {
  const { data, err, setErr, load } = useRecord(`/characters/${id}`)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      sort_name: data.sort_name || '',
      description: data.description || '',
      note: data.note || '',
    })
  }, [data])

  if (err) return <ErrorText>{err}</ErrorText>
  if (!data || !form) return <EmptyState>{t('common.state.loading')}</EmptyState>

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

  return (
    <div style={{ display: 'grid', gap: 'calc(var(--row) * 1.6)' }}>
      <ErrorText>{err}</ErrorText>

      <Scope title={t('identity.scope.library.title')} scope={t('identity.scope.library.character')}>
        <div style={FIELDS}>
          <MonoLabel>{t('identity.character.appearances.title', { n: (data.appearances || []).length, count: (data.appearances || []).length })}</MonoLabel>
          {(data.appearances || []).length === 0 ? (
            <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('identity.character.appearances.empty')}</p>
          ) : (
            <ul style={FIELDS}>
              {data.appearances.map((a) => (
                <li key={a.cast_id} className="flex items-baseline gap-2">
                  <span style={{ fontWeight: 600 }}>{a.work_title}</span>
                  {/* THE PERFORMER, WHERE THERE IS ONE. A book character has none,
                      and the row says nothing rather than drawing an empty slot —
                      a slot invites a value and there is nothing true to put in it. */}
                  {a.actor_id ? (
                    <button
                      type="button"
                      className="tp-link"
                      onClick={() => stack.push(personPanel(stack, { id: a.actor_id, name: a.actor }))}
                    >
                      {a.actor}
                    </button>
                  ) : a.actor ? (
                    <span className="microcopy" style={{ color: 'var(--soft)' }}>{a.actor}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <MonoLabel>{t('identity.alias.title')}</MonoLabel>
          <p className="microcopy" style={{ color: 'var(--soft)' }}>{t('identity.alias.body')}</p>
          <AliasRow aliases={data.aliases || []} onAdd={addAlias} onRemove={removeAlias} />
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
    </div>
  )
}
