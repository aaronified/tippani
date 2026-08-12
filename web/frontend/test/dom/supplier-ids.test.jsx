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

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkDetails } from '../../src/WorkDetails.jsx'
import { MovieLookupPicker } from '../../src/CoverPicker.jsx'

let CALLS = []

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    if (path === '/movies/lookup') return { ok: true, data: { candidates: [] } }
    return { ok: true, data: { id: 1, title: 'Persuasion', ...(body || {}) } }
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

function open(item = MOVIE) {
  return render(<WorkDetails open kind="movie" item={item} onChanged={() => {}} />)
}

beforeEach(() => {
  CALLS = []
})

describe('the supplier id rows are editable', () => {
  it('offers a pencil on both ids, not a disabled row', async () => {
    open()
    // The whole point of the change: an edit control that was not there before.
    expect(screen.getByLabelText(/edit tmdb id/i)).toBeTruthy()
    expect(screen.getByLabelText(/edit thetvdb id/i)).toBeTruthy()
  })

  it('still reads as a link to the record when one is set', () => {
    open()
    const link = screen.getByRole('link', { name: /65754/ })
    expect(link.getAttribute('href')).toBe('https://www.themoviedb.org/movie/65754')
  })

  it('sends a typed id as a number, not the string the field holds', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByLabelText(/edit thetvdb id/i))
    await user.type(screen.getByRole('textbox'), '11111')
    await user.click(screen.getByLabelText(/save thetvdb id/i))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tvdb_id).toBe(11111)
  })

  it('carries the other id through untouched on a one-field save', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByLabelText(/edit thetvdb id/i))
    await user.type(screen.getByRole('textbox'), '11111')
    await user.click(screen.getByLabelText(/save thetvdb id/i))
    await waitFor(() => expect(puts()).toHaveLength(1))
    // PUT is full-state; editing one id must not blank the other.
    expect(puts()[0][2].tmdb_id).toBe(65754)
  })

  it('sends 0 — the API spelling of "clear it" — for an emptied field', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByLabelText(/edit tmdb id/i))
    await user.clear(screen.getByRole('textbox'))
    await user.click(screen.getByLabelText(/save tmdb id/i))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tmdb_id).toBe(0)
  })

  it('refuses to send a value that is not a whole positive id', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByLabelText(/edit tmdb id/i))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '-4.5')
    await user.click(screen.getByLabelText(/save tmdb id/i))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].tmdb_id).toBe(0)
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
