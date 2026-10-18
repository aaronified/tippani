// Put a picture in the frame it will be shown in.
//
// THE FRAME IS THE FRAME THE APP DRAWS — a circle for a person or a character, 2:3
// for a cover or a poster (frames.js) — so what the reader sees here is what every
// screen will show, and nothing is cut away that they did not see go. Drag to move,
// the slider to zoom, and two presses for the two extremes: fill the frame (the
// picture is cut at the edges) or show all of it (the frame is filled out from the
// picture's own edge colour, so a wide logo sits in a circle without a bar).
//
// THE PICTURE IS EDITED IN THE BROWSER, AND THAT IS WHY IT IS ALWAYS A STORED ONE OR
// A FILE FROM THIS MACHINE. A picture on a supplier's server cannot be drawn to a
// canvas that is then read (the page's img-src is 'self' and `data:`, and a remote
// image taints the canvas), so a fetched or pasted picture is stored first, by the
// route that always stored it, and framed from the stored copy, which is same-origin.
// The result goes back through the same upload route a file from disk uses, which
// also removes the file it replaces.
import { useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { FRAMES, clampPlacement, edgeColours, needsFrame, renderFrame, sizes, startPlacement } from './frames.js'
import { FormModal, GhostButton, MonoLabel, Slider, useFormHost } from './ui.jsx'

const PREVIEW_WIDTH = 480
const NUDGE = 0.02

export function FrameDialog({ src, frame, name, onSave, onClose }) {
  return (
    <FormModal
      onClose={onClose}
      title={t('frame.dialog.title', { name })}
      maxWidth={460}
      dirty={1}
      closeDanger
      saveTip={t('frame.save.tip')}
    >
      {/* A CHILD, because useFormHost reads the context FormModal puts around its
          children (see SignatureForm). */}
      <FrameForm src={src} frame={frame} name={name} onSave={onSave} onClose={onClose} />
    </FormModal>
  )
}

function FrameForm({ src, frame, name, onSave, onClose }) {
  const spec = FRAMES[frame]
  const [img, setImg] = useState(null)
  const [edges, setEdges] = useState(null)
  const [place, setPlace] = useState(null)
  const [problem, setProblem] = useState('')
  const [saving, setSaving] = useState(false)
  const canvas = useRef(null)
  const stage = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    let live = true
    const im = new globalThis.Image()
    im.onload = () => {
      if (!live) return
      // An SVG with no size of its own has no shape to frame.
      if (!im.naturalWidth || !im.naturalHeight) return setProblem(t('frame.problem.load'))
      setEdges(edgeColours(im))
      setPlace(startPlacement(im.naturalWidth, im.naturalHeight, frame))
      setImg(im)
    }
    im.onerror = () => live && setProblem(t('frame.problem.load'))
    im.src = src
    return () => { live = false }
  }, [src, frame])

  useEffect(() => {
    if (img && place && edges && canvas.current) renderFrame(canvas.current, img, place, frame, PREVIEW_WIDTH, edges)
  }, [img, place, edges, frame])

  const iw = img?.naturalWidth || 1
  const ih = img?.naturalHeight || 1
  const range = img ? sizes(iw, ih, spec.ratio) : { cover: 1, contain: 1 }
  const move = (patch) => setPlace((p) => clampPlacement({ ...p, ...patch(p) }, iw, ih, frame))

  const onPointerDown = (e) => {
    if (!place) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, x: place.x, y: place.y }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    const box = stage.current?.getBoundingClientRect()
    if (!d || !box?.width) return
    // Pixels on the stage to shares of the frame's width, the unit a placement is in.
    const k = 1 / box.width
    move(() => ({ x: d.x + (e.clientX - d.px) * k, y: d.y + (e.clientY - d.py) * k }))
  }
  const onPointerUp = () => { drag.current = null }
  const onKeyDown = (e) => {
    const step = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] }[e.key]
    if (!step) return
    e.preventDefault()
    move((p) => ({ x: p.x + step[0], y: p.y + step[1] }))
  }

  const blocked = saving
    ? t('common.action.save.busy')
    : problem
      ? t('frame.problem.load')
      : place
        ? ''
        : t('common.state.loading')
  const host = useFormHost(blocked)

  const save = async () => {
    if (blocked) return
    setSaving(true)
    const out = document.createElement('canvas')
    renderFrame(out, img, place, frame, spec.width, edges)
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      setSaving(false)
      return setProblem(t('frame.problem.save'))
    }
    await onSave(blob)
    setSaving(false)
    onClose()
  }

  // AND THE SUBMIT STOPS HERE. The dialog is a portal, and React carries a portal's events up
  // its React parent, not its DOM one — so a dialog opened from inside a form (a board's)
  // would otherwise also submit THAT form, saving the board when the reader meant to frame.
  //
  // NOT VALIDATED BY THE BROWSER. The zoom slider's value is whatever size the picture
  // is at, which is rarely a whole number of steps from its minimum, and a range
  // input off its step makes the whole form invalid — so the tick looked live and
  // the submit was silently dropped.
  return (
    <form id={host?.formId} className="frame-form" noValidate onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); save() }}>
      <div
        ref={stage}
        className={'frame-stage' + (spec.round ? ' is-round' : '')}
        style={{ aspectRatio: String(spec.ratio) }}
        tabIndex={0}
        role="group"
        aria-label={t('frame.stage.aria', { name })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvas} className="frame-canvas" />
        {spec.round ? <span className="frame-mask" aria-hidden="true" /> : null}
        {!place && !problem ? <span className="frame-note">{t('common.state.loading')}</span> : null}
        {problem ? <span className="frame-note is-problem" role="alert">{problem}</span> : null}
      </div>
      <MonoLabel>{t({ face: 'frame.hint.face', work: 'frame.hint.work', board: 'frame.hint.board' }[frame])}</MonoLabel>
      {place ? (
        <>
          <Slider
            label={t('frame.zoom.label')}
            min={range.contain}
            max={range.cover * 4}
            step={(range.cover * 4 - range.contain) / 100 || 0.01}
            decimals={2}
            value={place.size}
            readout={`${Math.round(place.size / range.cover * 100)}%`}
            onCommit={(v) => move(() => ({ size: v }))}
          />
          <div className="frame-presets">
            <GhostButton type="button" title={t('frame.fill.tip')} onClick={() => move(() => ({ size: range.cover, x: 0, y: 0 }))}>
              {t('frame.fill.label')}
            </GhostButton>
            <GhostButton type="button" title={t('frame.fit.tip')} onClick={() => move(() => ({ size: range.contain, x: 0, y: 0 }))}>
              {t('frame.fit.label')}
            </GhostButton>
          </div>
        </>
      ) : null}
    </form>
  )
}

// Read a file as a data URL, which the page may draw (`data:` is on its img-src) where
// it may not draw an object URL.
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new globalThis.FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

// How big a picture is, from an address the page can draw.
export function measure(src) {
  return new Promise((resolve) => {
    const im = new globalThis.Image()
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight })
    im.onerror = () => resolve(null)
    im.src = src
  })
}

// THE ONE FRAMING FLOW, for every picture the app keeps. A cover, a poster, a person
// and a character all do the same thing — the picture is put in its frame BEFORE it is
// kept, cancelling keeps nothing, and keeping stores what was framed — so it lives
// here and each screen passes in only what differs: which frame, and what keeping a
// framed picture means to it (`onKeep(blob)`, always the screen's own upload).
//
// THREE WAYS A PICTURE ARRIVES, each handed to the hook the way it arrives:
//   frameFile     a file from this machine, drawn from a data: URL;
//   frameAddress  a picture that is only an address (a search result, a pasted URL),
//                 which the page may not load and could not read back from a canvas
//                 if it did, so the server fetches it and returns the bytes
//                 (POST /images/preview — nothing is stored);
//   reframe       a picture already stored, drawn from its own same-origin copy.
// Each answers 'framed' (the editor is open), 'fits' (no editor needed — the caller
// keeps the picture as it came) or, for an address, 'failed' (it could not be fetched).
export function useFraming({ frame, name, onKeep }) {
  const [open, setOpen] = useState(null) // { src } while the dialog is up
  const [previewing, setPreviewing] = useState(false)

  const frameFile = async (file) => {
    const src = await readAsDataURL(file).catch(() => '')
    const m = src ? await measure(src) : null
    if (m && needsFrame(m.w, m.h, frame)) {
      setOpen({ src })
      return 'framed'
    }
    return 'fits'
  }

  const frameAddress = async (address, { always = false } = {}) => {
    setPreviewing(true)
    const r = await json('POST', '/images/preview', { url: address }).catch(() => ({ ok: false }))
    setPreviewing(false)
    if (!r.ok || !r.data?.image) return 'failed'
    const m = await measure(r.data.image)
    if (always || (m && needsFrame(m.w, m.h, frame))) {
      setOpen({ src: r.data.image })
      return 'framed'
    }
    return 'fits'
  }

  const reframe = (src) => setOpen({ src })

  const dialog = open ? (
    <FrameDialog src={open.src} frame={frame} name={name} onSave={onKeep} onClose={() => setOpen(null)} />
  ) : null

  return { dialog, frameFile, frameAddress, reframe, previewing }
}
