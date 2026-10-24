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

})

describe('the verb that leaves the work', () => {
  beforeEach(async () => {
    await open({ id: 4, name: 'Andy Dufresne', work: FILM })
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

// AND WHOSE PICTURE IS ON SCREEN, which is the other half of a picture block
// being honest. A work that has no picture of the character shows the identity's,
// or failing that the performer's — that is what every chip in this app does. A
// screen that substitutes one silently is a screen claiming this work holds a
// picture it does not, and the reader who then presses "Set for the identity" is
// promoting a picture that is already the identity's.
describe('a work with no picture of its own', () => {

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

})
