// A person's signature, on their record beside the portrait.
//
// THREE VERBS, each the same shape as the portrait's: Upload a file from this
// machine, Fetch from Wikidata, and Remove. Upload and Fetch do not save. Both
// land in one dialog that shows the signature CLEANED — ink on a transparent ground,
// drawn in the text colour so it reads on every theme — with one slider for how
// much of the paper's grain counts as ink, and the standing ✓/✕ pair. Only ✓
// writes anything.
//
// A FETCHED RASTER GOES THROUGH THE SAME DIALOG AS AN UPLOAD, and that is the point
// of the server answering it raw: the reader sees it cleaned at a strength they
// chose, not at a default they never saw. It is saved through the same route,
// credited to Wikidata.
//
// THE PREVIEW AND THE SAVE EACH SEND THE FILE. The server keeps nothing between
// them; the cleaner is deterministic, so what the preview showed is what the save
// stores.
import { useEffect, useRef, useState } from 'react'
import { blobFromDataURL, errText, json, upload } from './api.js'
import { t } from './i18n.js'
import { personImgURL } from './people.jsx'
import {
  FormModal, GhostButton, IconDelete, IconFetch, IconUpload, MonoLabel, Slider, toast, useFilePick, useFormHost,
} from './ui.jsx'

const ACCEPT = 'image/png,image/jpeg,image/gif,image/svg+xml'

// The slider's resting place: the server's own default (internal/signature).
const DEFAULT_STRENGTH = 0.5

// A signature drawn in the text colour. The file is black ink on transparency, so
// it is used as a mask over a block of currentColor; the <img> inside is invisible
// and is only there to give the block its shape and size.
export function SignatureInk({ src, alt }) {
  if (!src) return null
  return (
    <span className="sig-ink" style={{ '--sig': `url("${src}")` }}>
      <img src={src} alt={alt} />
    </span>
  )
}

export function SignatureSlot({ id, name, path, busy, onChanged, onError }) {
  const [pending, setPending] = useState(null) // { blob, source } while the dialog is open
  const [fetching, setFetching] = useState(false)
  const pick = useFilePick({
    accept: ACCEPT,
    ariaLabel: t('identity.signature.upload.aria', { name }),
    onFiles: (file) => setPending({ blob: file, source: '' }),
  })

  const fetchOne = async () => {
    setFetching(true)
    const r = await json('POST', `/people/id/${id}/signature/fetch`)
    setFetching(false)
    if (!r.ok) return onError(errText(r))
    onError('')
    // Nothing to offer is an answer and not a fault, so it is a note and not the
    // red line a failure gets.
    if (!r.data?.found) return toast(t('identity.signature.fetch.none'))
    // DECODED, NOT FETCHED: the page's CSP refuses a fetch of a data: URL, which made this press
    // do nothing at all in a browser while it passed everywhere that stubbed fetch.
    let blob
    try {
      blob = blobFromDataURL(r.data.image)
    } catch {
      return onError(t('identity.signature.preview.failed'))
    }
    setPending({ blob, source: 'wikidata' })
  }

  const clear = async () => {
    const r = await json('PUT', `/people/id/${id}`, { clear_signature: true })
    if (!r.ok) return onError(errText(r))
    onError('')
    onChanged()
  }

  return (
    <div className="sig-slot">
      <MonoLabel>{t('identity.signature.label')}</MonoLabel>
      {path ? (
        <SignatureInk src={personImgURL(path)} alt={t('identity.signature.aria', { name })} />
      ) : (
        <span className="sig-none">{t('identity.signature.none')}</span>
      )}
      <div className="sig-verbs">
        <GhostButton
          type="button"
          className="cs-verb"
          disabled={busy || fetching}
          title={t('identity.signature.fetch.tip')}
          icon={<IconFetch />}
          onClick={fetchOne}
        >
          {fetching ? t('common.state.loading') : t('identity.signature.fetch.label')}
        </GhostButton>
        <GhostButton
          type="button"
          className="cs-verb"
          disabled={busy}
          title={t('identity.signature.upload.tip')}
          icon={<IconUpload />}
          onClick={pick.open}
        >
          {t('identity.signature.upload.label')}
        </GhostButton>
        {pick.input}
        {path ? (
          <GhostButton type="button" className="cs-verb" disabled={busy} icon={<IconDelete />} onClick={clear}>
            {t('identity.signature.clear.label')}
          </GhostButton>
        ) : null}
      </div>
      {pending ? (
        <FormModal
          onClose={() => setPending(null)}
          title={t('identity.signature.dialog.title', { name })}
          maxWidth={460}
          dirty={1}
          closeDanger
          saveTip={t('identity.signature.save.tip')}
        >
          {/* A CHILD, because useFormHost reads the context FormModal puts around its
              children (see ProviderLinkDialog). */}
          <SignatureForm
            id={id}
            name={name}
            blob={pending.blob}
            source={pending.source}
            onSaved={() => { setPending(null); onChanged() }}
          />
        </FormModal>
      ) : null}
    </div>
  )
}

function SignatureForm({ id, name, blob, source, onSaved }) {
  const [strength, setStrength] = useState(DEFAULT_STRENGTH)
  const [preview, setPreview] = useState(null) // a data URL once cleaned
  const [problem, setProblem] = useState('')
  const [saving, setSaving] = useState(false)
  const latest = useRef(0)

  // One preview per (file, strength); an answer to an older one is dropped, so a
  // slow response cannot overwrite the picture for the strength now showing.
  useEffect(() => {
    const mine = ++latest.current
    setPreview(null)
    setProblem('')
    ;(async () => {
      const r = await upload(`/people/id/${id}/signature/preview`, blob, { strength: String(strength) })
      if (mine !== latest.current) return
      if (r.ok && r.data?.image) setPreview(r.data.image)
      else setProblem(errText(r, t('identity.signature.preview.failed')))
    })()
  }, [id, blob, strength])

  const blocked = saving
    ? t('common.action.save.busy')
    : problem
      ? t('identity.signature.save.blocked.bad')
      : preview
        ? ''
        : t('common.state.loading')
  const host = useFormHost(blocked)

  const save = async () => {
    if (blocked) return
    setSaving(true)
    const r = await upload(`/people/id/${id}/signature`, blob, {
      strength: String(strength), ...(source ? { source } : {}),
    })
    setSaving(false)
    if (!r.ok) return setProblem(errText(r, t('error.upload.generic')))
    onSaved()
  }

  return (
    <form id={host?.formId} className="sig-form" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="sig-stage" aria-live="polite">
        {preview ? <SignatureInk src={preview} alt={t('identity.signature.aria', { name })} /> : null}
        {!preview && !problem ? <span className="sig-none">{t('common.state.loading')}</span> : null}
        {problem ? <span className="sig-problem" role="alert">{problem}</span> : null}
      </div>
      <Slider
        label={t('identity.signature.ink.label')}
        min={0}
        max={1}
        step={0.05}
        decimals={2}
        value={strength}
        onCommit={setStrength}
      />
    </form>
  )
}
