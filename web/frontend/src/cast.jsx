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

import { useContext, useEffect, useRef, useState } from 'react'
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
  IconSearch,
  IconUsers,
  InfoDot,
  MonoLabel,
  Tooltip,
  UnsavedFieldsContext,
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
// Twenty, which is metadata.maxCast — the largest cast any provider seed can
// produce. Below that the cap is reached on ordinary films and the roles past it
// keep the actor fallback with nothing said; at it, a normal work is covered in
// one pass. A reader-authored cast can be longer (maxWorkCast is 200) and those
// rows have no provider URL to fetch anyway.
const IMAGE_FILL_CAP = 20

export function CastSection({ kind, item, onChanged }) {
  const path = kind === 'book' ? 'books' : 'movies'
  const [rows, setRows] = useState(null) // null while loading
  const [role, setRole] = useState('none')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [person, setPerson] = useState(null) // the actor whose own panel is open
  // ONLY WHERE THERE IS AN ACTOR TO LOOK UP. This map exists to put a headshot
  // beside a cast row's second column, and a book has no second column — the API
  // refuses one — so asking for a book's people was a request per opening whose
  // answer nothing could read.
  const { map: actorMap, reload: reloadActors } = usePeople(kind === 'book' ? '' : 'actor')
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
              workTitle={item.title}
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
function CastRow({ row, role, busy, actor, workTitle, onSave, onRemove, onImage, onOpenPerson }) {
  const [editing, setEditing] = useState(false)
  const [character, setCharacter] = useState(row.character || '')
  const [who, setWho] = useState(row.actor || '')
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [confirming, setConfirming] = useState(false)
  const applyURL = async () => {
    await onImage(url.trim())
    setUrl('')
    setUrlOpen(false)
  }

  // The role in costume if we have it, the actor's headshot if not. Upstream's own
  // fallback — see the file header.
  const face = row.character_image_path
    ? coverImgURL(row.character_image_path)
    : actor?.image_path
      ? personImgURL(actor.image_path)
      : ''

  // REPORTS WHETHER IT LANDED, because the panel's ✓ awaits it before closing and
  // a refused write must stop the close — the same contract a field row keeps.
  const commit = async () => {
    if (!character.trim()) return false
    const body = { character: character.trim() }
    if (role !== 'none') body.actor = who.trim()
    if (!(await onSave(body))) return false
    setEditing(false)
    return true
  }
  const onRowKey = (e) => {
    if (e.key !== 'Enter' || busy) return
    e.preventDefault()
    commit()
  }

  // THE PANEL'S ✓ SAVES THIS ROW TOO. It commits every open field row and closes,
  // and a row typed into here is open work by any reading of that — but a cast row
  // writes through its own endpoint and has no place in the merged patch, so it
  // registers a `save` instead of a field. The registry skips an entry whose key
  // matches no spec, so this contributes nothing to the patch and everything to
  // the promise.
  const host = useContext(UnsavedFieldsContext)
  const dirty = editing && (character !== (row.character || '') || who !== (row.actor || ''))
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => {
    if (!host?.register || !dirty) return
    const id = `cast-${row.id}`
    host.register(id, { save: () => commitRef.current(), close: () => setEditing(false) })
    return () => host.register(id, null)
  }, [host, dirty, row.id])

  if (editing) {
    return (
      <li className="cast-row is-editing">
        <div className="cast-row-fields">
          {/* ENTER SAVES THE ROW. It is the obvious keystroke after typing a name,
              and the panel sits inside the Details form — so without a handler here
              Enter reaches the form and closes the whole panel (see the guard in
              WorkDetails.jsx). Local behaviour beats a swallowed key. */}
          <Field
            label={t('common.field.character.label')}
            nameCase
            value={character}
            autoFocus
            onChange={(e) => setCharacter(e.target.value)}
            onKeyDown={onRowKey}
          />
          {/* A BOOK IS REFUSED AN ACTOR rather than quietly cleared (0047's line,
              which the API follows), so the box is absent for one — not disabled. */}
          {role !== 'none' && (
            <Field label={roleLabel(role)} nameCase value={who} onChange={(e) => setWho(e.target.value)} onKeyDown={onRowKey} />
          )}
        </div>
        <div className="cast-row-acts">
          <FieldIconButton
            icon={<IconCheck />}
            ariaLabel={t('common.action.save.label')}
            disabled={busy || !character.trim()}
            ok
            onClick={commit}
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
          {/* THE SAME OFFER THE PERSON EDITOR MAKES, and for the same reason: there
              is no keyless portrait API, so a picture is a URL you paste — and
              asking somebody to go and find one without helping them look is the
              difference between a field and a chore. Searched by the ROLE and the
              work, which is what you would type: "Amanda Waller Suicide Squad"
              finds the character in costume; the actor's name would find the
              actor, whose photo belongs on their own page. */}
          <button
            type="button"
            className="tp-link tp-link-icon"
            style={{ fontSize: 'var(--type-ui-11)' }}
            onClick={() => window.open(
              `https://www.google.com/search?tbm=isch&q=${encodeURIComponent([row.character, workTitle].filter(Boolean).join(' '))}`,
              '_blank', 'noopener',
            )}
          >
            <IconSearch />
            <span>{t('people.form.image-search')}</span>
          </button>
          <input
            className="tp-input"
            placeholder={t('cast.picture.placeholder')}
            aria-label={t('cast.picture.url.aria', { name: row.character || '' })}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || busy || !url.trim()) return
              e.preventDefault()
              applyURL()
            }}
          />
          <GhostButton
            type="button"
            disabled={busy || !url.trim()}
            onClick={applyURL}
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
  const add = () => {
    if (!character.trim()) return
    const body = { character: character.trim() }
    if (role !== 'none') body.actor = who.trim()
    onAdd(body)
  }
  const onAddKey = (e) => {
    if (e.key !== 'Enter' || busy) return
    e.preventDefault()
    add()
  }
  return (
    <div className="cast-add">
      <div className="cast-row-fields">
        {/* Enter adds, for the reason the edit row's Enter saves. */}
        <Field
          label={t('common.field.character.label')}
          nameCase
          value={character}
          autoFocus
          onChange={(e) => setCharacter(e.target.value)}
          onKeyDown={onAddKey}
        />
        {role !== 'none' && (
          <Field label={roleLabel(role)} nameCase value={who} onChange={(e) => setWho(e.target.value)} onKeyDown={onAddKey} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" disabled={busy || !character.trim()} onClick={add}>
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
          {/* THE HANDLER THIS CONTROL USED TO HAVE. It had an explicit Enter-to-fetch
              in WorkDetails.jsx and lost it on the way into this file; without one,
              Enter here reaches the Details form and closes the panel. */}
          <Field
            label={t('film.imdb.link.label')}
            placeholder={t('film.imdb.link.placeholder')}
            value={link}
            autoFocus
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || busy || !link.trim()) return
              e.preventDefault()
              fromIMDb()
            }}
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

// useCharacterArt — the fetch for the faces a WORK PAGE is about to draw.
//
// WHY IT IS NOT ENOUGH THAT THE PANEL DOES IT. `POST /cast/{id}/image` was
// written so that "a client may call this for every chip it is about to draw",
// and the People panel (above) was the first client ever to call it. But the
// panel is not where character faces are drawn en masse: a film's dialogue board
// is, and a reader who never opens People saw the same empty chips they had
// before — which is the half of "it is not fetching the same by default either"
// the panel did not answer.
//
// IT COSTS NOTHING WHEN THERE IS NOTHING TO DO, and that is the whole design.
// `GET /movies/{id}` already carries the cast with both image fields on every
// row, so the caller can tell from what it is holding whether any role has a
// provider picture and no file — and only then does this go and ask for the ids
// it needs to fetch them by. A work whose art is already local makes no request
// at all.
//
// Serial and capped, like the panel's: twenty roles would otherwise be twenty
// outbound connections the moment somebody opened a film.
//
// `onFilled` is called once, after the last one lands, so the page can refetch
// the rows that carry `character_images` — those are resolved server-side, so
// the pictures do not appear until the list is asked again.
export function useCharacterArt(kind, workID, cast, onFilled) {
  const done = useRef('')
  useEffect(() => {
    const key = `${kind}:${workID}`
    if (!workID || done.current === key) return
    // The question the caller can already answer from what it is holding.
    const pending = (cast || []).some((c) => c?.character_image_url && !c?.character_image_path)
    if (!pending) return
    let live = true
    const path = kind === 'book' ? 'books' : 'movies'
    ;(async () => {
      const r = await json('GET', `/${path}/${workID}/cast`)
      if (!live || !r.ok) return
      const want = (r.data?.cast || [])
        .filter((c) => c.character_image_url && !c.character_image_path)
        .slice(0, IMAGE_FILL_CAP)
      let got = 0
      for (const c of want) {
        if (!live) return
        const one = await json('POST', `/cast/${c.id}/image`)
        if (one.ok && one.data?.character_image_path) got += 1
      }
      // MARKED DONE ONLY ON THE WAY OUT. Setting it before the loop meant a parent
      // refetch part-way through killed the run AND made the re-run return early —
      // so the pictures that had already downloaded were never shown either, and it
      // healed only on a fresh mount.
      if (!live) return
      done.current = key
      // Only when something actually arrived: a refetch that changes nothing is a
      // request and a re-render for no reason.
      if (got) onFilled?.()
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, workID, cast])
}
