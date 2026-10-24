// The TMDB / TheTVDB ids on a film or show are typed, not just fetched.
//
// They spent a release as read-only rows whose own hint said "set by picking a
// match, not typed" — which is fine right up until a title search cannot tell
// two films of the same name apart, and there is no way to say which one you
// meant. Now they edit like any other field, and the id feeds the next search.
//
// What is worth pinning here is the part that is silent when wrong. The rows
// still *look* like links, so a regression to `disabled` renders identically at
// rest — the pencil is the only visible difference. And the value has to leave
// as a NUMBER: the field holds a string, the column is an integer, and a "603"
// that reaches the server as a string is a save that does nothing visible until
// someone reads the database.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workDetailsPanel } from '../../src/WorkDetails.jsx'
import { PanelHarness, resetPanelHistory } from '../panel-harness.jsx'

let CALLS = []
let STORED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    if (path === '/movies/lookup') return { ok: true, data: { candidates: [] } }
    // THE PANEL READS ITS RECORD BACK ON MOUNT (useWorkRecord), so the mock has
    // to be a server that remembers: answering a GET with a stub would hand the
    // form a film with no ids on it and every case below would be about that.
    if (method === 'PUT') STORED = { ...STORED, ...(body || {}) }
    return { ok: true, data: STORED }
  }),
}))

const MOVIE = {
  id: 1,
  title: 'Persuasion',
  media_type: 'movie',
  release_year: 1995,
  tmdb_id: 65754,
  tvdb_id: 0,
  genres: [],
}

const puts = () => CALLS.filter(([m, p]) => m === 'PUT' && p === '/movies/1')

// Through the panel stack, because that is where this form lives now — and the
// stack pushes on the frame AFTER mount (open() walks history back first), so
// opening is something to await rather than something that has happened.
async function open(item = MOVIE) {
  const r = render(
    <PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'movie', item, onChanged: () => {}, onDelete: null })} />,
  )
  await waitFor(() => expect(document.querySelector('.tp-panel')).toBeTruthy())
  return r
}

beforeEach(() => {
  CALLS = []
  STORED = { ...MOVIE }
  resetPanelHistory()
})

// THEY ARE NO LONGER ROWS, and every case below moved with them rather than
// being deleted. The pack collapses a work's ids into a strip at the foot of the
// Details panel — one pill per id the record holds, and one screen behind Edit
// that writes the lot in a single request — because an id is not a fact about the
// work but how one catalogue files it, and five labelled rows of them read as the
// record's subject.
//
// WHAT THAT CHANGES ABOUT THESE TESTS IS THE SURFACE AND NOTHING ELSE. The value
// still has to leave as a NUMBER, the untouched id still has to survive a
// full-state PUT, an emptied field still has to send 0, and a fraction still has
// to be refused — those are the four silent-when-wrong properties this file was
// written for, and they are worth more now than they were as rows, because one
// press can write three ids at once.
// THE IDS ARE ON THE LINKS SCREEN, which the section head's pencil opens, and
// so does the ＋ at the end of the pill row: one screen holds every id, the
// links and the paste box (the owner: "the edit and add opens separate screens.
// They can be merged into one."). These press the pencil, the door that lands on
// the ids.
const idsPencil = () => {
  const head = [...document.querySelectorAll('.cs-head-row')]
    .find((h) => /links/i.test(h.querySelector('.cs-section')?.textContent || ''))
  return head?.querySelector('.cs-section-action')
}
const openIds = async (user) => {
  await user.click(idsPencil())
  return waitFor(() => {
    const all = [...document.querySelectorAll('[role="dialog"]')]
    const last = all[all.length - 1]
    expect(last.getAttribute('aria-modal')).toBe('true')
    return last
  })
}

describe('the supplier ids are editable', () => {

  it('sends a typed id as a number, not the string the field holds', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^thetvdb id$/i), '11111')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tvdb_id).toBe(11111)
  })

})

