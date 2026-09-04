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
import { MovieLookupPicker } from '../../src/CoverPicker.jsx'

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
const lookups = () => CALLS.filter(([, p]) => p === '/movies/lookup')

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
// Details panel — one pill per id the record holds, and one dialog behind Edit
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
const openIds = async (user) => {
  await user.click(document.querySelector('.cs-pill.is-add'))
  return waitFor(() => {
    const all = [...document.querySelectorAll('[role="dialog"]')]
    const last = all[all.length - 1]
    expect(last.getAttribute('aria-modal')).toBe('true')
    return last
  })
}

describe('the supplier ids are editable', () => {
  it('offers one editor for every id, filled or not', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    // EVERY ID THIS MEDIUM HAS. The strip outside draws only the filled ones —
    // a slot per catalogue would tell the reader which ones their film ought to
    // be in — so this is the place the missing ones are missing from.
    expect(within(dlg).getByLabelText(/^tmdb id$/i)).toBeTruthy()
    expect(within(dlg).getByLabelText(/^thetvdb id$/i)).toBeTruthy()
    expect(within(dlg).getByLabelText(/^imdb id$/i)).toBeTruthy()
  })

  it('still reads as a link to the record when one is set', async () => {
    await open()
    const link = screen.getByRole('link', { name: /65754/ })
    expect(link.getAttribute('href')).toBe('https://www.themoviedb.org/movie/65754')
  })

  it('sends a typed id as a number, not the string the field holds', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^thetvdb id$/i), '11111')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tvdb_id).toBe(11111)
  })

  it('carries the other id through untouched on a one-field save', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^thetvdb id$/i), '11111')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    // PUT is full-state; editing one id must not blank the other.
    expect(puts()[0][2].tmdb_id).toBe(65754)
  })

  it('sends 0 — the API spelling of "clear it" — for an emptied field', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.clear(within(dlg).getByLabelText(/^tmdb id$/i))
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tmdb_id).toBe(0)
  })

  it('refuses to send a value that is not a whole positive id', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.clear(within(dlg).getByLabelText(/^tmdb id$/i))
    await user.type(within(dlg).getByLabelText(/^tmdb id$/i), '-4.5')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tmdb_id).toBe(0)
  })

  it('writes two ids in ONE request, which is what the strip is for', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^thetvdb id$/i), '11111')
    await user.type(within(dlg).getByLabelText(/^imdb id$/i), 'tt0114117')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    // Two rows saving themselves would have been two full-state writes over the
    // top of each other: in parallel the last reply wins, and in sequence each
    // reads the record as it was before the previous reply landed.
    expect(puts()[0][2].tvdb_id).toBe(11111)
    expect(puts()[0][2].imdb_id).toBe('tt0114117')
  })
})

describe('a stored id steers the next search', () => {
  it('rides along with the title in the lookup body', async () => {
    render(<MovieLookupPicker auto title="Persuasion" year={1995} tmdbId={65754} tvdbId="11111" onPick={() => {}} />)
    await waitFor(() => expect(lookups()).toHaveLength(1))
    const body = lookups()[0][2]
    expect(body.title).toBe('Persuasion')
    expect(body.tmdb_id).toBe(65754)
    // A record holds a number and a form field holds a string; both must land
    // as a number, because the id came from whichever surface opened the picker.
    expect(body.tvdb_id).toBe(11111)
  })

  it('says which ids it is searching by, so a pinned first match is explained', async () => {
    render(<MovieLookupPicker auto title="Persuasion" tmdbId={65754} onPick={() => {}} />)
    expect(screen.getByText(/searching by id/i).textContent).toContain('TMDB #65754')
  })

  it('omits an unset id rather than sending a zero the server would reject', async () => {
    render(<MovieLookupPicker auto title="Persuasion" tmdbId={0} tvdbId="" onPick={() => {}} />)
    await waitFor(() => expect(lookups()).toHaveLength(1))
    expect(lookups()[0][2].tmdb_id).toBeUndefined()
    expect(lookups()[0][2].tvdb_id).toBeUndefined()
    expect(screen.queryByText(/searching by id/i)).toBeNull()
  })

  it('searches on open with an id and no title at all', async () => {
    // The title is what used to gate the auto-search; an id names one record
    // exactly, so it is reason enough on its own.
    render(<MovieLookupPicker auto title="" tmdbId={65754} onPick={() => {}} />)
    await waitFor(() => expect(lookups()).toHaveLength(1))
    expect(lookups()[0][2].tmdb_id).toBe(65754)
  })
})
