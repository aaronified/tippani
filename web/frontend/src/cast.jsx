// A work's people: the characters, who plays them, and both of their pictures.
//
// WHAT WAS MISSING. 0048 built `work_cast` and six routes to edit it, and said so
// in its own header: "THERE IS NO SCREEN FOR ANY OF THIS YET, deliberately". Then
// 0049 and 0050 added the character image and somewhere to keep it, and
// POST /cast/{id}/image was written to fetch one on demand — "so a client may call
// this for every chip it is about to draw". No client ever did. So a library could
// hold a full cast with a TheTVDB art URL on every row, and the reader saw no cast
// list and no character faces, because nothing had ever asked for the bytes.
//
// This is that screen, and the thing that asks.
//
// TWO PICTURES OF TWO DIFFERENT THINGS, which is the distinction the schema went
// out of its way to keep and the one this panel exists to make editable. The
// CHARACTER's picture is the role in costume and belongs to the cast row
// (work_cast.character_image_path); the ACTOR's is a headshot and belongs to the
// PERSON (people.image_path), shared by every work they are in. Editing them in one
// place would be convenient and wrong: change Viola Davis's headshot here and it
// changes on every film she is in, which is correct and has to be visible as such.
// So the row shows both and sends you to the person's own panel for theirs.
//
// THE FALLBACK IS UPSTREAM'S. Most roles have no art of their own even on TheTVDB,
// and every TMDB-sourced row has none by definition, so a row with no character
// picture shows the actor's — which is what TheTVDB's own site does, and what the
// quote cards already do.

import { useEffect, useRef, useState } from 'react'
import { coverImgURL, errText, json } from './api.js'
import { t } from './i18n.js'
import { PersonModal, personImgURL, usePeople } from './people.jsx'
import {
  ErrorText,
  Field,
  FieldIconButton,
  GhostButton,
  IconCheck,
  IconClose,
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconUsers,
  InfoDot,
  MonoLabel,
  Tooltip,
} from './ui.jsx'

// The second column's name, from the machine value the server sends. `actor_role`
// has been on the wire since 0048 with a comment saying the words belong to the
// screen that renders it — this is that screen, so this is where the words are.
const roleLabel = (role) =>
  role === 'voice' ? t('cast.role.voice.label') : t('common.field.actor.label')

// IMAGE FETCHES ARE SERIAL, and the cap is why. A film's cast is twenty rows, each
// with a provider URL; firing twenty requests at once would open twenty outbound
// connections from a self-hosted box the moment somebody opened a panel. One at a
// time, oldest first (billing order), and the panel fills in as they land.
const IMAGE_FILL_CAP = 12

export function CastSection({ kind, item, onChanged }) {
  const path = kind === 'book' ? 'books' : 'movies'
  const [rows, setRows] = useState(null) // null while loading
  const [role, setRole] = useState('none')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [person, setPerson] = useState(null) // the actor whose own panel is open
  const { map: actorMap, reload: reloadActors } = usePeople(kind === 'book' ? 'author' : 'actor')
  // Guards the image fill so re-rendering does not re-run it. A ref rather than
  // state: it must not itself cause a render.
  const filled = useRef(false)

  const load = async (fill = false) => {
    const r = await json('GET', `/${path}/${item.id}/cast`)
    if (!r.ok) return setErr(errText(r, t('error.load.cast')))
    setErr('')
    setRole(r.data.actor_role || 'none')
    setRows(r.data.cast || [])
    if (fill) fillImages(r.data.cast || [])
    return r.data.cast || []
  }

  // THE MISSING HALF OF 0050. A row carries the provider's art URL from the
  // moment the cast is fetched and an empty path until somebody asks for the
  // bytes. This asks — once per opening, only for the rows that have a URL and no
  // file, and one at a time.
  //
  // A failure is silent by design: the endpoint is idempotent and cheap to call
  // again, the row falls back to the actor's headshot meanwhile, and a red line
  // over a cast list because one of twenty pictures did not download would be
  // worse than the missing picture.
  async function fillImages(list) {
    const want = (list || []).filter((c) => c.character_image_url && !c.character_image_path).slice(0, IMAGE_FILL_CAP)
    for (const c of want) {
      const r = await json('POST', `/cast/${c.id}/image`)
      if (!r.ok || !r.data?.character_image_path) continue
      setRows((cur) => (cur || []).map((x) => (x.id === c.id ? { ...x, ...r.data } : x)))
    }
  }

  useEffect(() => {
    if (!open) return
    const first = !filled.current
    filled.current = true
    load(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id])

  // Re-opening a different work must fetch that work's pictures too.
  useEffect(() => { filled.current = false }, [item.id])

  async function save(id, fields) {
    setBusy('row')
    const r = await json('PUT', `/cast/${id}`, fields)
    setBusy('')
    if (!r.ok) { setErr(errText(r, t('error.save.generic'))); return false }
    setErr('')
    await load()
    onChanged?.()
    return true
  }

  async function add(fields) {
    setBusy('add')
    const r = await json('POST', `/${path}/${item.id}/cast`, fields)
    setBusy('')
    if (!r.ok) { setErr(errText(r, t('error.save.generic'))); return false }
    setErr('')
    await load()
    onChanged?.()
    return true
  }

  async function remove(id) {
    setBusy('row')
    const r = await json('DELETE', `/cast/${id}`)
    setBusy('')
    if (!r.ok) return setErr(errText(r, t('error.delete.generic')))
    setErr('')
    await load()
    onChanged?.()
  }

  // A picture the reader chose, through the same route the provider's goes
  // through — so nothing downstream can tell one from the other, and a later
  // refetch leaves it alone (the path is not a provider fact).
  async function setImage(id, url) {
    setBusy('image')
    const r = await json('POST', `/cast/${id}/image`, { image_url: url })
    setBusy('')
    if (!r.ok) return setErr(errText(r, t('error.load.cast-picture')))
    setErr('')
    setRows((cur) => (cur || []).map((x) => (x.id === id ? { ...x, ...r.data } : x)))
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" onClick={() => setOpen(true)}>
          <IconUsers />
          <span>{t('cast.open.label')}</span>
        </GhostButton>
        <InfoDot title={t('cast.info.title')} text={t('cast.info.body')} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <MonoLabel>{t('cast.heading.label')}</MonoLabel>
        <InfoDot title={t('cast.info.title')} text={t('cast.info.body')} />
        <span className="flex-1" />
        <FieldIconButton
          icon={<IconPlus />}
          ariaLabel={t('cast.add.aria')}
          onClick={() => setAdding(true)}
          disabled={!!busy}
        />
        <FieldIconButton
          icon={<IconClose />}
          ariaLabel={t('common.action.close.label')}
          onClick={() => setOpen(false)}
        />
      </div>

      <ErrorText>{err}</ErrorText>

      {/* The two on-demand fills, side by side, because they answer the same
          question from two sources — and which one to press depends on the work:
          TheTVDB has the character art and nothing for games, IMDb has the games. */}
      {kind !== 'book' && (
        <CastFills item={item} onFilled={() => load(true)} />
      )}

      {rows === null ? (
        <p className="microcopy">{t('common.state.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="microcopy">{t('cast.empty.prose')}</p>
      ) : (
        <ul className="cast-list">
          {rows.map((c) => (
            <CastRow
              key={c.id}
              row={c}
              role={role}
              busy={!!busy}
              actor={actorMap[c.actor]}
              onSave={(f) => save(c.id, f)}
              onRemove={() => remove(c.id)}
              onImage={(u) => setImage(c.id, u)}
              onOpenPerson={c.actor ? () => setPerson({ kind: 'actor', name: c.actor }) : null}
            />
          ))}
        </ul>
      )}

      {adding && (
        <CastAdd
          role={role}
          busy={!!busy}
          onCancel={() => setAdding(false)}
          onAdd={async (f) => { if (await add(f)) setAdding(false) }}
        />
      )}

      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => { reloadActors(); setPerson(null) }}
        />
      )}
    </div>
  )
}

// CastRow — one credit. Resting it is two names and a face; editing it is two
// boxes; and the picture controls are always the row's own, never the panel's.
function CastRow({ row, role, busy, actor, onSave, onRemove, onImage, onOpenPerson }) {
  const [editing, setEditing] = useState(false)
  const [character, setCharacter] = useState(row.character || '')
  const [who, setWho] = useState(row.actor || '')
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [confirming, setConfirming] = useState(false)

  // The role in costume if we have it, the actor's headshot if not. Upstream's own
  // fallback — see the file header.
  const face = row.character_image_path
    ? coverImgURL(row.character_image_path)
    : actor?.image_path
      ? personImgURL(actor.image_path)
      : ''

  if (editing) {
    return (
      <li className="cast-row is-editing">
        <div className="cast-row-fields">
          <Field
            label={t('common.field.character.label')}
            nameCase
            value={character}
            autoFocus
            onChange={(e) => setCharacter(e.target.value)}
          />
          {/* A BOOK IS REFUSED AN ACTOR rather than quietly cleared (0047's line,
              which the API follows), so the box is absent for one — not disabled. */}
          {role !== 'none' && (
            <Field label={roleLabel(role)} nameCase value={who} onChange={(e) => setWho(e.target.value)} />
          )}
        </div>
        <div className="cast-row-acts">
          <FieldIconButton
            icon={<IconCheck />}
            ariaLabel={t('common.action.save.label')}
            disabled={busy || !character.trim()}
            ok
            onClick={async () => {
              const body = { character: character.trim() }
              if (role !== 'none') body.actor = who.trim()
              if (await onSave(body)) setEditing(false)
            }}
          />
          <FieldIconButton
            icon={<IconClose />}
            ariaLabel={t('common.action.cancel.label')}
            disabled={busy}
            onClick={() => {
              setCharacter(row.character || '')
              setWho(row.actor || '')
              setEditing(false)
            }}
          />
        </div>
      </li>
    )
  }

  return (
    <li className="cast-row">
      {face ? (
        <img className="cast-face" src={face} alt="" />
      ) : (
        <span className="cast-face is-empty" aria-hidden="true" />
      )}
      <span className="cast-names">
        <span className="cast-character">{row.character || t('cast.unnamed.label')}</span>
        {row.actor && (
          <span className="cast-actor">
            {onOpenPerson ? (
              <button type="button" className="tp-link" onClick={onOpenPerson}>{row.actor}</button>
            ) : (
              row.actor
            )}
          </span>
        )}
      </span>
      <span className="cast-row-acts">
        {/* THE CHARACTER'S PICTURE, on the row that owns it. The actor's is on the
            actor, reached by their name above — see the file header for why the two
            are not one control. */}
        <Tooltip label={t('cast.picture.tip')}>
          <FieldIconButton
            icon={<IconRefresh />}
            ariaLabel={t('cast.picture.aria', { name: row.character || '' })}
            disabled={busy}
            onClick={() => setUrlOpen((v) => !v)}
          />
        </Tooltip>
        <FieldIconButton
          icon={<IconEdit />}
          ariaLabel={t('common.action.edit.field.aria', { field: row.character || '' })}
          disabled={busy}
          onClick={() => setEditing(true)}
        />
        <FieldIconButton
          icon={<IconDelete />}
          ariaLabel={t('cast.remove.aria', { name: row.character || '' })}
          disabled={busy}
          danger
          onClick={() => setConfirming(true)}
        />
      </span>
      {confirming && (
        // AN INLINE CONFIRM, and not a dialog. A deleted provider row leaves a
        // tombstone so a later refetch declines to bring it back — that is the
        // point of the table — which makes this less recoverable than it looks and
        // worth one press to confirm. A modal for one row of twenty would be worse.
        <span className="cast-row-confirm">
          <span className="microcopy">{t('cast.remove.confirm.prose', { name: row.character || '' })}</span>
          <GhostButton type="button" disabled={busy} onClick={onRemove}>{t('common.action.remove.label')}</GhostButton>
          <GhostButton type="button" onClick={() => setConfirming(false)}>{t('common.action.cancel.label')}</GhostButton>
        </span>
      )}
      {urlOpen && (
        <span className="cast-row-url">
          <input
            className="tp-input"
            placeholder={t('cast.picture.placeholder')}
            aria-label={t('cast.picture.url.aria', { name: row.character || '' })}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <GhostButton
            type="button"
            disabled={busy || !url.trim()}
            onClick={async () => { await onImage(url.trim()); setUrl(''); setUrlOpen(false) }}
          >
            {t('common.action.apply.label')}
          </GhostButton>
        </span>
      )}
    </li>
  )
}

// CastAdd — a character the provider never listed, or never could. This is the
// endpoint 0048 was built for: every game whose Wikidata lookup came back empty
// had no way to name a voice actor at all.
function CastAdd({ role, busy, onAdd, onCancel }) {
  const [character, setCharacter] = useState('')
  const [who, setWho] = useState('')
  return (
    <div className="cast-add">
      <div className="cast-row-fields">
        <Field
          label={t('common.field.character.label')}
          nameCase
          value={character}
          autoFocus
          onChange={(e) => setCharacter(e.target.value)}
        />
        {role !== 'none' && (
          <Field label={roleLabel(role)} nameCase value={who} onChange={(e) => setWho(e.target.value)} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton
          type="button"
          disabled={busy || !character.trim()}
          onClick={() => {
            const body = { character: character.trim() }
            if (role !== 'none') body.actor = who.trim()
            onAdd(body)
          }}
        >
          {t('common.action.add.label')}
        </GhostButton>
        <GhostButton type="button" onClick={onCancel}>{t('common.action.cancel.label')}</GhostButton>
      </div>
    </div>
  )
}

// CastFills — the two on-demand sources, in one row.
//
// TheTVDB takes no input: the id is on the record, and a search here is where the
// wrong cast gets attached to the right work. IMDb takes the page you are looking
// at, for the same reason from the other end — it has no id on the record to use.
function CastFills({ item, onFilled }) {
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const [err, setErr] = useState('')
  const [link, setLink] = useState('')
  const [imdb, setImdb] = useState(false)

  async function fromTVDB() {
    setBusy('tvdb'); setErr(''); setSaid('')
    const r = await json('POST', `/movies/${item.id}/cast/tvdb`)
    setBusy('')
    if (!r.ok) return setErr(errText(r, t('error.load.tvdb-cast')))
    const n = (r.data?.cast || []).length
    setSaid(t('cast.fill.done.prose', { title: r.data?.title || '', n }))
    onFilled?.()
  }

  async function fromIMDb() {
    setBusy('imdb'); setErr(''); setSaid('')
    const r = await json('POST', `/movies/${item.id}/cast/imdb`, { imdb: link.trim() })
    setBusy('')
    if (!r.ok) return setErr(errText(r, t('error.load.imdb-cast')))
    const n = (r.data?.cast || []).length
    setSaid(t('film.imdb.done.prose', { title: r.data?.title?.title || link.trim(), n }))
    setLink('')
    setImdb(false)
    onFilled?.()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Games have no TheTVDB record at all, so the control that cannot work for
            them is absent rather than shown and refused. */}
        {item.media_type !== 'game' && (
          <GhostButton type="button" onClick={fromTVDB} disabled={!!busy}>
            <IconUsers />
            <span>{busy === 'tvdb' ? t('film.imdb.busy.label') : t('cast.fill.tvdb.label')}</span>
          </GhostButton>
        )}
        <GhostButton type="button" onClick={() => setImdb((v) => !v)} disabled={!!busy}>
          <IconUsers />
          <span>{t('film.imdb.open.label')}</span>
        </GhostButton>
        <InfoDot title={t('cast.fill.info.title')} text={t('cast.fill.info.body')} />
      </div>
      {imdb && (
        <div className="space-y-2">
          <Field
            label={t('film.imdb.link.label')}
            placeholder={t('film.imdb.link.placeholder')}
            value={link}
            autoFocus
            onChange={(e) => setLink(e.target.value)}
          />
          <GhostButton type="button" onClick={fromIMDb} disabled={!!busy || !link.trim()}>
            {busy === 'imdb' ? t('film.imdb.busy.label') : t('film.imdb.go.label')}
          </GhostButton>
        </div>
      )}
      <ErrorText>{err}</ErrorText>
      {said && <p className="microcopy">{said}</p>}
    </div>
  )
}
