// A PICTURE BLOCK OFFERS EVERY WAY A PICTURE CAN ARRIVE, AND NAMES EACH ONE.
//
// THE SPECIFICATION. `docs/design/prototypes/character-popup.dc.html:1257-1264`
// draws the media block with a row of NAMED buttons and calls them "the repo's
// order":
//
//     ['Fetch',      'refresh', 'Look for a better one at the sources', false],
//     ['Upload',     'upload',  'A file from this machine',            false],
//     ['Paste URL',  'open',    'From the web, by address',            false],
//     ...(scope is global or person ? [] :
//        [['Set for the identity', 'globe', 'Use this everywhere',      true]]),
//
// Four rules are stated there and every one is testable without knowing a line of
// the implementation:
//
//   THEY ARE NAMED, not glyphs. A picture verb that goes wrong is expensive to
//   undo and an unlabelled icon is a guess.
//
//   THERE ARE THREE ON AN IDENTITY AND FOUR ON A WORK. The fourth is spread over
//   the last argument — `danger: true` — and is dropped wherever the scope IS the
//   identity, because there is no wider scope to set a picture for.
//
//   THE FOURTH ASKS FIRST. The pack hangs its own confirmation off that button
//   ("Use this picture for the identity?" … "This work keeps its own picture
//   either way") and draws it dashed in the error colour. Every other verb on the
//   strip changes one work's picture and is undone by choosing another.
//
//   AND EVERY BUTTON DOES SOMETHING. This is the repo's own standing bar, not the
//   pack's — `make controls` presses every control on every screen and a press
//   with no effect is a defect. A named button that presses and does nothing is
//   worse than an absent one: the reader believes they have used the feature.
//
// WHY A COUNT AND A PRESS AND NOT A SNAPSHOT. A snapshot passes for the markup it
// was taken from and fails on every legitimate change to it. What the pack states
// is a NUMBER and a set of CONSEQUENCES, and both survive rewording, restyling
// and re-nesting.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the block quoted above. Nothing about which
// component draws it or which hook returns it.
//
// DECLARED EXCEPTION, TWO: the cases that frame a picture read one CSS class,
// `form.frame-form`, to find the frame dialog's own tick among the sheet's — it is a portal
// over a sheet with ticks of its own. And the cases that check who a picked picture is credited to
// know the request it leaves as — `POST /cast/{id}/image` for a role and `PUT
// /characters/{id}/image` for the record, with the body's `image_url` and
// `image_source` — because the mocked network is the only place the credit can be
// seen in this tier; what the server stores from it is people_sources_test.go's.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../../src/i18n.js'

let RECORD
let CALLS
let IMAGES = []
let PREVIEW = {}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && /^\/characters\/\d+$/.test(path)) return { ok: true, data: RECORD }
    if (method === 'POST' && path === '/images/preview') {
      return PREVIEW ? { ok: true, data: PREVIEW } : { ok: false, status: 502, data: { error: 'no' } }
    }
    if (method === 'POST' && path === '/images/search') {
      return { ok: true, data: { sources: { tvdb: true }, images: IMAGES } }
    }
    if (/whos-in-it/.test(path)) return { ok: true, data: { characters: [] } }
    return { ok: true, data: {} }
  }),
  uploadWithProgress: vi.fn(async (path) => {
    CALLS.push(['UPLOAD', path, null])
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')

function Harness({ panel }) {
  const stack = usePanelStack()
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (opened) return
    setOpened(true)
    stack.open(panel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}

const APPEARANCE = {
  cast_id: 9,
  kind: 'movie',
  work_id: 3,
  work_title: 'The Shawshank Redemption',
  media_type: 'movie',
  character: 'Andy Dufresne',
  character_id: 4,
  actor: 'Tim Robbins',
  actor_id: 11,
  actor_image: 'tim.jpg',
  image: 'andy.jpg',
  cover: 'poster.jpg',
}

const FILM = { kind: 'movie', id: 3, title: 'The Shawshank Redemption', media_type: 'movie', castId: 9 }

beforeEach(() => {
  window.history.replaceState({}, '')
  CALLS = []
  RECORD = {
    id: 4,
    name: 'Andy Dufresne',
    image_path: 'record.jpg',
    aliases: [],
    lines: [],
    shared_lines: 0,
    appearances: [APPEARANCE],
  }
})
afterEach(() => cleanup())

const open = async (opts) => {
  const stack = { open: () => {}, push: () => {}, close: () => {} }
  await act(async () => { render(<Harness panel={characterPanel(stack, opts)} />) })
}

// The strip beside the face: every control the picture block offers.
const strip = () => document.querySelector('.cs-face-actions')
const verbButtons = () => [...(strip()?.querySelectorAll('button') || [])]
const named = () => verbButtons().map((b) => b.textContent.trim()).filter(Boolean)
const byWord = (re) => verbButtons().find((b) => re.test(b.textContent))

// jsdom never decodes an image, so no `load` ever fires and a picture has no shape.
// The browser's Image is the environment, not the app: this gives every picture the
// size a test names, as a real decode would, and a canvas that can be asked for bytes.
const picturesAre = (w, h) => {
  vi.stubGlobal('Image', class {
    set src(_) {
      this.naturalWidth = w
      this.naturalHeight = h
      setTimeout(() => this.onload?.())
    }
  })
  HTMLCanvasElement.prototype.toBlob = (done) => done(new Blob(['framed'], { type: 'image/jpeg' }))
}
afterEach(() => vi.unstubAllGlobals())
const chooseFile = async () => {
  const file = strip().querySelector('input[type="file"]')
  await act(async () => {
    fireEvent.change(file, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
}
const uploads = () => CALLS.filter(([m]) => m === 'UPLOAD')

describe('a character seen from inside one work', () => {
  beforeEach(async () => {
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
  })

  // THIS WORK'S PICTURE, TAKEN FROM THE STRIP, IS ITS SUPPLIER'S TOO: the work's
  // cast row is written with the strip's source, as the record's is.
  it("credits this work's picture taken from the strip to the supplier that offered it", async () => {
    IMAGES = [{ url: 'https://pics.test/andy-film.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/b', source: 'google' }]
    try {
      await act(async () => { byWord(/fetch/i).click() })
      const pick = await screen.findByRole('button', { name: /^Use this picture from / })
      await act(async () => { pick.click() })
      await waitFor(() => {
        const save = CALLS.find(([m, p, b]) => m === 'POST' && p === '/cast/9/image' && b?.image_url)
        expect(save, 'the pick saved nothing on this work').toBeTruthy()
        expect(save[2].image_source).toBe('google-images')
      })
    } finally {
      IMAGES = []
    }
  })

  it('offers a way to fetch, a way to upload and a way to paste an address', () => {
    expect(strip(), 'the picture block has no control strip at all').toBeTruthy()
    const words = named().join(' | ')
    for (const re of [/fetch/i, /upload/i, /paste/i]) {
      expect(re.test(words), `no button named for ${re} — the strip reads: ${words}`).toBe(true)
    }
  })

  it('and a fourth, which is the only one that leaves this work', () => {
    const words = named().join(' | ')
    expect(/identity/i.test(words),
      `the verb that sets the picture for the identity is missing — the strip reads: ${words}`).toBe(true)
  })

  it('names every one of them rather than drawing a bare glyph', () => {
    // A control with a picture and no word is a guess. Every button in this strip
    // carries text or, at the very least, an accessible name — and there are at
    // least three of them, so this cannot pass by there being none.
    expect(verbButtons().length,
      'fewer than three controls in the picture strip').toBeGreaterThanOrEqual(3)
    for (const b of verbButtons()) {
      const label = b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title') || ''
      expect(label.length, 'a button in the picture strip has no name of any kind').toBeGreaterThan(0)
    }
  })

  it('leaves them all pressable, because a greyed verb with no way to un-grey it is a dead end', () => {
    // "Set for the identity" is the exception the pack allows for: it promotes
    // THIS WORK's picture, so it needs one. Every other verb is a way of getting a
    // picture and cannot depend on already having it.
    expect(verbButtons().length,
      'fewer than three controls in the picture strip').toBeGreaterThanOrEqual(3)
    for (const b of verbButtons()) {
      if (/identity/i.test(b.textContent)) continue
      expect(b.disabled, `"${b.textContent.trim()}" is greyed out at rest`).toBe(false)
    }
  })

  it('asks the suppliers when Fetch is pressed', async () => {
    await act(async () => { byWord(/fetch/i).click() })
    expect(CALLS.some(([m, p]) => m === 'POST' && p === '/images/search'),
      'Fetch went nowhere — nothing asked the suppliers for a picture').toBe(true)
  })

  it('opens a file chooser when Upload is pressed', async () => {
    const file = strip().querySelector('input[type="file"]')
    expect(file, 'Upload has no file input behind it — there is nothing to choose from').toBeTruthy()
    const clicked = vi.fn()
    file.click = clicked
    await act(async () => { byWord(/upload/i).click() })
    expect(clicked, 'pressing Upload opened no file chooser').toHaveBeenCalled()
  })

  it('and the file the reader picks is actually sent', async () => {
    picturesAre(1000, 1000) // already the shape of its frame
    await chooseFile()
    await waitFor(() => expect(uploads().length,
      'a file was chosen and nothing was uploaded').toBe(1))
  })

  // FETCH AND PASTE URL FRAME A FACE EXACTLY AS A COVER IS FRAMED: before anything is
  // kept, so backing out keeps nothing. What the test knows, declared: a picture that
  // is only an address is fetched for the frame by POST /images/preview (the page may
  // not load it), what is kept goes up as an upload, and a picture that already fits
  // is saved by its address as it always was — so its supplier is still credited.
  describe('a picture taken by address', () => {
    const pickFromStrip = async () => {
      IMAGES = [{ url: 'https://pics.test/wide.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/b', source: 'google' }]
      await act(async () => { byWord(/fetch/i).click() })
      const pick = await screen.findByRole('button', { name: /^Use this picture from / })
      await act(async () => { pick.click() })
    }
    const saved = () => CALLS.filter(([m, p]) => m === 'POST' && p === '/cast/9/image')
    afterEach(() => { IMAGES = []; PREVIEW = {} })

    it('is shown in its frame before it is kept, and nothing is kept yet', async () => {
      PREVIEW = { image: 'data:image/png;base64,AAAA' }
      picturesAre(1600, 701)
      await pickFromStrip()
      await screen.findByText(/^Frame — /)
      expect(CALLS.find(([m, p]) => p === '/images/preview')[2]).toEqual({ url: 'https://pics.test/wide.jpg' })
      expect(saved().length, 'the picture was saved before it had been framed').toBe(0)
      expect(uploads().length).toBe(0)
    })

    it('keeps nothing when the reader backs out', async () => {
      PREVIEW = { image: 'data:image/png;base64,AAAA' }
      picturesAre(1600, 701)
      await pickFromStrip()
      await screen.findByText(/^Frame — /)
      await act(async () => { screen.getByRole('button', { name: t('common.action.close.label') }).click() })
      expect(saved().length + uploads().length, 'a picture the reader refused was kept anyway').toBe(0)
    })

    it('keeps what the reader framed, as an upload of their own', async () => {
      PREVIEW = { image: 'data:image/png;base64,AAAA' }
      picturesAre(1600, 701)
      await pickFromStrip()
      await screen.findByText(/^Frame — /)
      const tick = () => document.querySelector('button[type="submit"][form="' + document.querySelector('form.frame-form')?.id + '"]')
      await screen.findByRole('slider', { name: t('frame.zoom.label') })
      await waitFor(() => expect(tick()?.disabled).toBe(false))
      await act(async () => { tick().click() })
      await waitFor(() => expect(uploads().length, 'keeping the framing stored nothing').toBe(1))
      expect(saved().length, 'the unframed original was saved as well').toBe(0)
    })

    it('is saved by its address, credited to its supplier, when it already fits', async () => {
      PREVIEW = { image: 'data:image/png;base64,AAAA' }
      picturesAre(1000, 1000)
      await pickFromStrip()
      await waitFor(() => expect(saved().length).toBe(1))
      expect(saved()[0][2].image_source).toBe('google-images')
    })

    it('is saved by its address when the server could not fetch it for the frame', async () => {
      PREVIEW = null // the preview route answers an error
      picturesAre(1600, 701)
      await pickFromStrip()
      await waitFor(() => expect(saved().length, 'a picture that could not be previewed was dropped').toBe(1))
    })
  })

  it('shows a picture of the wrong shape in its frame before anything is kept', async () => {
    picturesAre(1600, 701) // a wide logo, which a circle would cut in half
    await chooseFile()
    await screen.findByText(/^Frame — /)
    expect(uploads().length, 'the file was stored before the reader had framed it').toBe(0)
    expect(screen.queryByText(/dimmed part is cut off/),
      'the dialog does not say what the circle will cut away').toBeTruthy()
  })

  it('and keeps what the reader framed, not the file as it came', async () => {
    picturesAre(1600, 701)
    await chooseFile()
    await screen.findByText(/^Frame — /)
    // The sheet underneath has ticks of its own; this one belongs to the frame's form.
    const tick = () => document.querySelector('button[type="submit"][form="' + document.querySelector('form.frame-form')?.id + '"]')
    // The zoom slider is drawn once the picture has loaded; until then the tick is blocked.
    await screen.findByRole('slider', { name: t('frame.zoom.label') })
    await waitFor(() => expect(tick()?.disabled, 'the frame dialog tick stayed blocked').toBe(false))
    await act(async () => { tick().click() })
    await waitFor(() => expect(uploads().length,
      'keeping the framing stored nothing').toBe(1))
  })

  it('leaves nothing behind when the reader backs out of the frame', async () => {
    picturesAre(1600, 701)
    await chooseFile()
    await screen.findByText(/^Frame — /)
    await act(async () => { screen.getByRole('button', { name: t('common.action.close.label') }).click() })
    expect(uploads().length, 'a file the reader refused was stored anyway').toBe(0)
  })

  it('reveals somewhere to type an address when Paste URL is pressed', async () => {
    const before = document.querySelectorAll('input:not([type="file"])').length
    await act(async () => { byWord(/paste/i).click() })
    const after = document.querySelectorAll('input:not([type="file"])').length
    expect(after, 'Paste URL revealed no field to paste into').toBeGreaterThan(before)
  })
})

describe('the verb that leaves the work', () => {
  beforeEach(async () => {
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
  })

  it('asks before it acts, because the reader cannot see what it changes', async () => {
    await act(async () => { byWord(/identity/i).click() })
    expect(CALLS.some(([m, p]) => m === 'PUT' && /\/characters\/4\/image/.test(p)),
      'the identity portrait was replaced on one press, with no question asked').toBe(false)
    // A QUESTION, NOT ITS WORDING. What the reader is owed is a surface that
    // stops the press and offers a way to answer it; which sentence it uses is
    // the locale's business, and a test that pins the English fails on the
    // Bengali build while the feature is intact. The next case presses the yes.
    const asked = [...document.querySelectorAll('[role=dialog], .tp-panel, .tp-modal')]
      .some((el) => [...el.querySelectorAll('button')].length >= 2)
    expect(asked, 'no question was asked either — the press did nothing at all').toBe(true)
  })

  it('and does it once the question is answered', async () => {
    await act(async () => { byWord(/identity/i).click() })
    const yes = [...document.querySelectorAll('button')]
      .find((b) => /yes|set it everywhere/i.test(b.textContent))
    expect(yes, 'the question has no way to say yes').toBeTruthy()
    await act(async () => { yes.click() })
    expect(CALLS.some(([m, p]) => m === 'PUT' && /\/characters\/4\/image/.test(p)),
      'answering yes changed nothing').toBe(true)
  })
})

describe("the character's own record, which IS the identity", () => {
  beforeEach(async () => { await open({ id: 4, name: 'Andy Dufresne' }) })

  it('still offers the three ways a picture arrives', () => {
    const words = named().join(' | ')
    for (const re of [/fetch/i, /upload/i, /paste/i]) {
      expect(re.test(words), `no button named for ${re} on the record — the strip reads: ${words}`).toBe(true)
    }
  })

  // A PICTURE TAKEN FROM THE STRIP IS ITS SUPPLIER'S. The record's own picker
  // dropped the source on the way to the save, so the server, told nothing,
  // recorded every strip pick on a character's record as the reader's.
  it("credits a picture taken from the strip to the supplier that offered it", async () => {
    IMAGES = [{ url: 'https://pics.test/andy.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/a', source: 'google' }]
    try {
      await act(async () => { byWord(/fetch/i).click() })
      const pick = await screen.findByRole('button', { name: /^Use this picture from / })
      await act(async () => { pick.click() })
      await waitFor(() => {
        const save = CALLS.find(([m, p, b]) => m === 'PUT' && p === '/characters/4/image' && b?.image_url)
        expect(save, 'the pick saved nothing').toBeTruthy()
        expect(save[2].image_source).toBe('google-images')
      })
    } finally {
      IMAGES = []
    }
  })

  it('but not the fourth, because there is no wider scope to set it for', () => {
    const words = named().join(' | ')
    expect(verbButtons().length,
      'fewer than three controls in the picture strip').toBeGreaterThanOrEqual(3)
    expect(/set for the identity/i.test(words),
      'the record offers to set its own picture for itself').toBe(false)
  })
})

// AND WHOSE PICTURE IS ON SCREEN, which is the other half of a picture block
// being honest. A work that has no picture of the character shows the identity's,
// or failing that the performer's — that is what every chip in this app does. A
// screen that substitutes one silently is a screen claiming this work holds a
// picture it does not, and the reader who then presses "Set for the identity" is
// promoting a picture that is already the identity's.
describe('a work with no picture of its own', () => {
  it("draws the character's own picture rather than a blank", async () => {
    RECORD.appearances = [{ ...APPEARANCE, image: '' }]
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
    const face = document.querySelector('.cs-portrait .cs-face img')
    expect(face, 'the picture block drew nothing, though the record has a picture').toBeTruthy()
  })

  it('and says whose picture it is', async () => {
    // A DIFFERENCE, NOT A SENTENCE. The rule is that a borrowed picture is
    // announced as borrowed; the words are the locale's. So the block is read
    // twice — once where the work HAS its own still, once where it is showing
    // the identity's — and the two have to differ. Pinning the English here made
    // the case a spell-check of one string: it would pass over a screen that
    // said the wrong thing in the right words, and fail on a working screen in
    // any other language.
    RECORD.appearances = [{ ...APPEARANCE }]
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
    const own = document.querySelector('.cs-portrait').textContent
    cleanup()
    RECORD.appearances = [{ ...APPEARANCE, image: '' }]
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
    const borrowed = document.querySelector('.cs-portrait').textContent
    expect(borrowed,
      'the picture is not this work\'s and the screen says exactly what it says when it is').not.toBe(own)
  })

  it("does NOT fall back to the performer, and says there is no picture", async () => {
    // THE OWNER'S RULING, reversing what this case used to assert. "when i said
    // that actor image is the fallback for the character, i meant it strictly
    // for the pills, not the character menus. how will i know then that the
    // character has some other image?"
    //
    // On a 22px chip the performer's face is a better guess than a silhouette
    // and claims nothing. On a sheet whose whole subject is this character's
    // picture, it is a lie the reader cannot see through: the page shows a
    // photograph, so the reader concludes the character has one — and the fact
    // they actually needed, that nobody has set a picture for the role, is the
    // one the substitution hides. `store.CastOf`'s own comment has said this
    // about the server for as long as it has existed: "a panel that shows the
    // global picture where the work has none must be able to SAY so."
    RECORD.image_path = ''
    RECORD.appearances = [{ ...APPEARANCE, image: '' }]
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
    const block = document.querySelector('.cs-portrait')
    expect(block.querySelector('.cs-face img'),
      "the performer's photograph is standing in for the character's").toBeFalsy()
    expect(block.querySelector('.cs-face svg') || block.querySelector('.cs-face'),
      'the slot drew nothing at all, not even a silhouette').toBeTruthy()
    // And it SAYS so, in whatever words the locale uses.
    expect(block.textContent.trim().length,
      'the sheet shows no picture and does not say why').toBeGreaterThan(0)
    expect(block.textContent, "it names the performer, which is the substitution the ruling forbids")
      .not.toMatch(/Tim Robbins/)
  })

  it('while a credit row — a pill — still shows the performer, which is what the ruling keeps', async () => {
    // The other half of the same ruling, so this file holds both and neither can
    // be "fixed" by breaking the other. A cast row's small face is a pill.
    RECORD.image_path = ''
    RECORD.appearances = [{ ...APPEARANCE, image: '' }]
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
    const credit = document.querySelector('.cs-credit')
    expect(credit, 'no credit row on a film').toBeTruthy()
    expect(credit.querySelector('img'),
      "the credit row lost the performer's face, which the ruling keeps").toBeTruthy()
  })
})
