// Put a picture in the frame it will be shown in.
//
// THE FRAME IS THE FRAME THE APP DRAWS — a circle for a person or a character, 2:3
// for a cover or a poster, 3:2 for a board (frames.js) — so what the reader sees here is
// what every screen will show, and nothing is cut away that they did not see go. Drag to
// move, the slider to zoom, and two presses for the two extremes: fill the frame (the
// picture is cut at the edges) or show all of it (the frame is filled out from the
// picture's own edge colour, so a wide logo sits in a circle without a bar).
//
// THE PICTURE IS EDITED IN THE BROWSER, from something the page may draw and read back:
// a file from this machine (a `data:` URL), a picture that is only an address (its bytes,
// fetched by the server — POST /images/preview — because the page's img-src does not
// name the host and a remote image would taint the canvas), or one already kept, from its
// own same-origin copy (Reframe). The result goes through the screen's own upload route,
// which also removes the file it replaces. Nothing is stored before the reader keeps it.
import { useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { FRAMES, clampPlacement, edgeColours, needsFrame, renderFrame, sizes, startPlacement } from './frames.js'
import { FormModal, GhostButton, MonoLabel, Slider, toast, useFormHost } from './ui.jsx'

const PREVIEW_WIDTH = 480
const NUDGE = 0.02

// `reframing`: the picture is one already kept. Keeping it unmoved changes nothing, so
// it closes without re-encoding and re-uploading it (which would lose a little quality
// and replace its supplier's credit with the reader's, for no change at all).
export function FrameDialog({ src, frame, name, reframing = false, onSave, onClose }) {
  // ARMED ONLY BY A CHANGE, as every tick here is: the picture moved or was zoomed from where
  // it started.
  const [changed, setChanged] = useState(0)
  // AND NOT CLOSABLE WHILE IT IS BEING KEPT. A ✕ then would close the dialog while the
  // upload went on and kept the picture anyway, which reads as "cancelled".
  const [saving, setSaving] = useState(false)
  return (
    <FormModal
      onClose={() => { if (!saving) onClose() }}
      title={t('frame.dialog.title', { name })}
      maxWidth={460}
      // A picture not yet kept already differs from what is stored, so its tick is lit from the
      // start (accepting the centred crop is the commonest thing to do); one already kept is lit
      // only by a move, since leaving it as it is keeps nothing.
      dirty={reframing ? changed : 1}
      closeDanger
      saveTip={t('frame.save.tip')}
    >
      {/* A CHILD, because useFormHost reads the context FormModal puts around its
          children (see SignatureForm). */}
      <FrameForm
        src={src} frame={frame} name={name} reframing={reframing}
        saving={saving} setSaving={setSaving} onChanged={setChanged}
        onSave={onSave} onClose={onClose}
      />
    </FormModal>
  )
}

function FrameForm({ src, frame, name, reframing, saving, setSaving, onChanged, onSave, onClose }) {
  const spec = FRAMES[frame]
  const [img, setImg] = useState(null)
  const [edges, setEdges] = useState(null)
  const [place, setPlace] = useState(null)
  const [problem, setProblem] = useState('')
  const start = useRef(null)
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
      start.current = startPlacement(im.naturalWidth, im.naturalHeight, frame)
      setPlace(start.current)
      setImg(im)
    }
    im.onerror = () => live && setProblem(t('frame.problem.load'))
    im.src = src
    return () => { live = false }
  }, [src, frame])

  const moved = !!(place && start.current && (
    Math.abs(place.size - start.current.size) > 1e-6
    || Math.abs(place.x - start.current.x) > 1e-6
    || Math.abs(place.y - start.current.y) > 1e-6))
  useEffect(() => { onChanged(moved ? 1 : 0) }, [moved, onChanged])

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
    // Nothing moved on a picture already kept: there is nothing to keep.
    if (reframing && !moved) return onClose()
    setSaving(true)
    const out = document.createElement('canvas')
    // NEVER LARGER THAN THE PICTURE IS. Scaling a 90-pixel thumbnail up to the frame's full width
    // stored a soft picture that every size warning (cover width, the portrait's under-400) then
    // called fine. Written at the pixels the source has, up to the frame's own width.
    const width = Math.min(spec.width, Math.max(1, Math.round(iw / place.size)))
    renderFrame(out, img, place, frame, width, edges)
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
  // NOT VALIDATED BY THE BROWSER: the only input is the zoom range, whose value follows the
  // picture's size and is rarely a whole number of steps from its minimum. jsdom reads that
  // as invalid and drops the submit; a browser snaps it. Nothing here needs the browser's own
  // validation, so it is off rather than left to differ between the two.
  return (
    <form id={host?.formId} className="frame-form" noValidate onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); save() }}>
      <div
        ref={stage}
        className={'frame-stage' + (spec.round ? ' is-round' : '')}
        style={{ aspectRatio: String(spec.ratio) }}
        tabIndex={0}
        // A press here MOVES THE PICTURE; a sheet that claims it for itself would move the sheet.
        data-no-sheet-drag=""
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
            onLive={(v) => move(() => ({ size: v }))}
            // The thumb is followed live (`onLive`). The release commit is a no-op on purpose: the
            // Slider rounds it to two places, which would move a picture the reader only focused
            // or tapped, and turn an untouched Reframe into a re-upload.
            onCommit={() => {}}
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

// How big a picture is, from an address the page can draw. A picture that neither loads nor
// fails within a few seconds is answered as one that cannot be measured, so no flow waits on
// it for ever.
export function measure(src) {
  return new Promise((resolve) => {
    const im = new globalThis.Image()
    const give = setTimeout(() => resolve(null), 8000)
    im.onload = () => { clearTimeout(give); resolve({ w: im.naturalWidth, h: im.naturalHeight }) }
    im.onerror = () => { clearTimeout(give); resolve(null) }
    im.src = src
  })
}

// THE ONE FRAMING FLOW, for every picture the app keeps. A cover, a poster, a person, a
// character, the profile photo and a board's picture all do the same thing — the picture is
// put in its frame BEFORE it is kept, cancelling keeps nothing, and keeping stores what was
// framed — so it lives here and each screen passes in only what differs: which frame, and what
// keeping a framed picture means to it (`onKeep(blob)`, always the screen's own upload).
//
// THREE WAYS A PICTURE ARRIVES, each handed to the hook the way it arrives:
//   frameFile     a file from this machine, drawn from a data: URL;
//   frameAddress  a picture that is only an address (a search result, a pasted URL), which the
//                 page may not load and could not read back from a canvas if it did, so the
//                 server fetches it and returns the bytes (POST /images/preview — nothing is
//                 stored);
//   reframe       a picture already kept, drawn from its own same-origin copy.
// Each answers 'framed' (the editor is open), 'fits' (no editor needed — the caller keeps the
// picture as it came) or, for an address, 'failed' (it could not be fetched for the frame, or
// not decoded) or 'superseded' (a newer choice was made while this one was being fetched, so
// this one is dropped and the caller does nothing). A caller that cannot frame a picture keeps
// it as it always did, by its address, so a real fetch failure is reported by the route that
// knows it.
export function useFraming({ frame, name, onKeep }) {
  const [open, setOpen] = useState(null) // { src, reframing } while the dialog is up
  const [previewing, setPreviewing] = useState(false)
  const latest = useRef(0)
  // How many previews are out. `previewing` follows THIS and not the newest call: a preview
  // superseded by a later choice still has to put the flag down, or it stays up for the life of
  // the component and the controls it disables never come back.
  const inflight = useRef(0)

  const frameFile = async (file) => {
    // A file chosen now is the newest choice: a picture still being fetched for an earlier one
    // must not open over it, nor be chosen after it.
    latest.current += 1
    const src = await readAsDataURL(file).catch(() => '')
    const m = src ? await measure(src) : null
    if (m && needsFrame(m.w, m.h, frame)) {
      setOpen({ src, reframing: false })
      return 'framed'
    }
    return 'fits'
  }

  const frameAddress = async (address, { always = false } = {}) => {
    const mine = ++latest.current
    inflight.current += 1
    setPreviewing(true)
    // Fetching can take a few seconds and the strip it was chosen from has closed — so say so, but
    // only if it is taking a while: most pictures come back at once and fit, and a message about
    // opening a frame that then does not open would be wrong.
    const slow = setTimeout(() => toast(t('frame.preparing')), 700)
    const r = await json('POST', '/images/preview', { url: address }).catch(() => ({ ok: false }))
    const m = r.ok && r.data?.image ? await measure(r.data.image) : null
    clearTimeout(slow)
    inflight.current -= 1
    if (inflight.current === 0) setPreviewing(false)
    if (mine !== latest.current) return 'superseded'
    if (!m) return 'failed'
    if (always || needsFrame(m.w, m.h, frame)) {
      setOpen({ src: r.data.image, reframing: false })
      return 'framed'
    }
    return 'fits'
  }

  const reframe = (src) => setOpen({ src, reframing: true })

  const dialog = open ? (
    <FrameDialog
      src={open.src} frame={frame} name={name} reframing={open.reframing}
      onSave={onKeep} onClose={() => setOpen(null)}
    />
  ) : null

  return { dialog, frameFile, frameAddress, reframe, previewing }
}
