// A FAILED REQUEST IS NOT AN EMPTY SCREEN — four more places where it was.
//
// The rule already has two homes in this codebase. The Bin drew "nothing deleted"
// to a reader whose deleted work was sitting on a server that had just refused to
// hand it over, and Stats said "loading…" for as long as the page stayed open.
// Both were fixed in 3.1.0 and both have their tests. An audit of the remaining
// screens found the same shape four more times, in three different disguises:
//
//   SILENCE — the boards list keeps `boards` at null and every reader of it
//   coalesces to []. So the header counted zero boards, the pinned All tile
//   claimed zero quotes, and the "no boards yet" card was suppressed by its own
//   `boards != null` guard. The result looks less like a broken page than a
//   working one, which is the expensive kind of wrong.
//
//   ABSENCE — Home's favourites section is gated on `favs.length > 0`, so three
//   failed requests took the whole wall off the page. Nothing said so, because
//   the only thing that knew was a console.error.
//
//   A DEAD BUTTON — Shuffle fell through `if (r.ok)` and left the screen exactly
//   as it was. Press it, nothing happens, press it again.
//
//   A CONFIDENT WRONG ANSWER — the speaker remap set `cast` to [] on any failure
//   and then drew "this title has no cast" in amber, telling a reader to go and
//   fill in a cast list that may already be complete. It did the same for the
//   whole of a successful round trip, because nothing reset while a request was
//   in flight.
//
// Each case below fails the request and then asserts on what a reader can read.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// `FAIL` is the set of path prefixes this test wants to break; everything else
// answers normally. Failing one route at a time is the point — a test that fails
// every request proves only that the screen noticed the world ended.
let FAIL = []
let CALLS = []
// A response the test can hold open. The speaker-remap cases below are ABOUT the
// window between the request and the response — the frame a reader sees on a slow
// link — and that window does not exist for a mock that resolves immediately.
let HOLD = null

const broken = (path) => FAIL.some((p) => path.startsWith(p))

// THE ANSWER IS DECIDED BEFORE THE GATE, not after it, and that is what makes a
// held response genuinely stale. A first pass awaited the gate first and then read
// the fixture — so a response released after the fixture changed came back
// carrying the NEW data, was indistinguishable from a fresh one, and the
// stale-flight mutation went uncaught.
const answer = (path) => {
  if (broken(path)) {
    // `data.error` and not `error` — errText reads res.data.error, so a mock
    // shaped the other way tests the fallback string rather than the server's.
    return { ok: false, status: 500, data: { error: 'server said no' } }
  }
  if (path.startsWith('/boards')) return { ok: true, data: { boards: BOARDS, total: 12 } }
  if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
  if (path.startsWith('/dialogues')) {
    const id = /movie_id=(\d+)/.exec(path)?.[1]
    return { ok: true, data: { dialogues: id ? DIALOGUES[id] || [] : [] } }
  }
  if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
  if (path.startsWith('/shuffle')) return { ok: true, data: { quote: SHUFFLED } }
  if (path.startsWith('/movies/')) return { ok: true, data: { cast: CAST } }
  if (path.startsWith('/movies')) return { ok: true, data: { movies: [] } }
  if (path.startsWith('/on-this-day')) return { ok: true, data: { quotes: [] } }
  if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
  if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
  if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
  return { ok: true, data: {} }
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push(path)
    const res = answer(path)
    if (HOLD && HOLD.paths.some((p) => path.startsWith(p))) await HOLD.promise
    return res
  }),
}))

let BOARDS = []
let CAST = []
let DIALOGUES = {}
let SHUFFLED = null

const { default: QuotesPage } = await import('../../src/Quotes.jsx')
const { default: Home } = await import('../../src/Home.jsx')
const { SpeakerRemap } = await import('../../src/MetadataPage.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

// hold / release — open a gate on the named routes, and shut it. The test drives
// the in-flight frame explicitly rather than hoping to catch it.
const hold = (...paths) => {
  let release
  HOLD = { paths, promise: new Promise((r) => { release = r }) }
  const mine = HOLD
  return async () => {
    // Clears the gate only if it is still this one — a second hold() may have
    // replaced it, and shutting that one would defeat the test that opened it.
    if (HOLD === mine) HOLD = null
    release()
    await act(async () => {})
  }
}

beforeEach(() => {
  FAIL = []
  CALLS = []
  HOLD = null
  // Keyed by film, so a response held open carries ITS film's speakers and not
  // whichever film the test last spoke about.
  DIALOGUES = {
    4: [{ id: 1, movie_id: 4, quote: 'Never talk to strangers.', character: 'Woland' }],
    5: [{ id: 2, movie_id: 5, quote: 'Let everything come true.', character: 'the Stalker' }],
  }
  BOARDS = [{ id: 1, name: 'Proverbs', quotes: 2, description: '', color: 'yellow', image_path: '', hidden: false, pos: 1 }]
  CAST = [{ id: 7, character: 'Woland', actor: 'Oleg Basilashvili' }]
  SHUFFLED = { kind: 'quote', id: 3, quote: 'A line from somewhere' }
})
afterEach(() => cleanup())

const body = () => document.body.textContent

describe('the quotes board list when /boards fails', () => {
  const mount = async () => {
    render(<QuotesPage creditSeparators=",;&" openId={null} onOpen={() => {}} onClose={() => {}} />)
    await act(async () => {})
  }

  it('says the request failed', async () => {
    FAIL = ['/boards']
    await mount()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
  })

  it('does not claim the reader has no boards', async () => {
    FAIL = ['/boards']
    await mount()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    // The empty card names the New-board button in its copy; asserting on that
    // sentence rather than on a class is what makes this survive a restyle.
    expect(body(), 'the empty state was shown over a failed load').not.toMatch(/No boards yet/i)
  })

  it('does not count quotes it never received', async () => {
    FAIL = ['/boards']
    await mount()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    // The pinned All tile printed `total`, which is 0 until a response arrives —
    // a specific, false, confident number, and the one most likely to be read as
    // truth because it looks like data rather than like an absence.
    //
    // ASKED BY ROLE, after a first pass asked by regex and passed under the
    // mutation: `/\b0 quotes\b/` cannot match "…All quotes0 quotes", because
    // textContent runs the tile's two spans together and there is no word
    // boundary between "s" and "0". The tile either is a control on this page or
    // it is not; that is the thing to ask.
    expect(
      screen.queryByRole('button', { name: /all quotes/i }),
      'the All tile offered a count for a list that never loaded',
    ).toBeNull()
  })

  it('does not count boards it never received', async () => {
    FAIL = ['/boards']
    await mount()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    expect(body(), 'the header counted a list that never loaded').not.toMatch(/0 boards/i)
  })

  it('still draws the list when the request succeeds', async () => {
    await mount()
    await waitFor(() => expect(screen.getByText('Proverbs')).toBeTruthy())
    expect(body()).not.toMatch(/server said no/i)
  })
})

describe("Home's favourites wall", () => {
  const mount = async () => {
    render(
      <>
      <ToastHost />
      <Home
        user={{ username: 'alice', preferences: {} }}
        stats={{}}
        onOpenBook={() => {}}
        onOpenMovie={() => {}}
        onGoLibrary={() => {}}
        onGoMovies={() => {}}
        onGoQuotes={() => {}}
        onPending={() => {}}
        onReviewImport={() => {}}
      />
      </>,
    )
    await act(async () => {})
  }

  it('says so when every list behind it fails', async () => {
    FAIL = ['/annotations', '/dialogues', '/quotes']
    await mount()
    // THE SECTION HAS TO BE ON THE PAGE AT ALL, which is the actual repair: the
    // gate was `favs.length > 0`, so the failure removed the heading, the count
    // and any chance of saying anything.
    await waitFor(() => expect(body()).toMatch(/server said no/i))
  })

  it('does not print a count of the favourites it could not read', async () => {
    FAIL = ['/annotations', '/dialogues', '/quotes']
    await mount()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    // The count is drawn as "♥ {n}" and never as the word — a first pass looked
    // for "0 favourites", which is a string this app has never rendered, and so
    // passed under the mutation that puts the count back. A tally beside an error
    // is the same false claim in smaller type.
    expect(body(), 'a count was printed over an error').not.toMatch(/♥\s*0/)
  })

  it('stays quiet when only the film-title lookup fails', async () => {
    // /movies is a lookup for a tile's subtitle, not a source of favourites.
    // Counting it among the failures would put an error over a wall that loaded.
    FAIL = ['/movies']
    await mount()
    await act(async () => {})
    expect(body()).not.toMatch(/server said no/i)
  })
})

describe('Shuffle', () => {
  const mount = async () => {
    render(
      <>
      <ToastHost />
      <Home
        user={{ username: 'alice', preferences: {} }}
        stats={{}}
        onOpenBook={() => {}}
        onOpenMovie={() => {}}
        onGoLibrary={() => {}}
        onGoMovies={() => {}}
        onGoQuotes={() => {}}
        onPending={() => {}}
        onReviewImport={() => {}}
      />
      </>,
    )
    await act(async () => {})
  }

  const press = async () => {
    fireEvent.click(screen.getByRole('button', { name: /shuffle/i }))
    await act(async () => {})
  }

  it('says when it could not fetch a line', async () => {
    FAIL = ['/shuffle']
    await mount()
    await press()
    await waitFor(() => expect(body()).toMatch(/server said no/i))
  })

  it('says when there is nothing to shuffle rather than doing nothing', async () => {
    // A 200 with no quote is the honest answer for an empty library, and it looked
    // exactly like the failure above: the button went busy and came back, and the
    // page did not change. Not an error — the reader is told what would make it
    // work.
    SHUFFLED = null
    await mount()
    await press()
    await waitFor(() => expect(body()).toMatch(/nothing to shuffle/i))
  })

  it('draws the line when there is one', async () => {
    await mount()
    await press()
    await waitFor(() => expect(screen.getByText(/A line from somewhere/)).toBeTruthy())
  })
})

describe('the speaker remap', () => {
  const mount = async () => {
    render(
      <SpeakerRemap
        movies={[
          { id: 4, title: 'The Master and Margarita', dialogue_count: 3, release_year: 1994 },
          { id: 5, title: 'Stalker', dialogue_count: 2, release_year: 1979 },
        ]}
        onDone={() => {}}
        user={{ preferences: {} }}
      />,
    )
    await act(async () => {})
  }

  const pick = async () => {
    fireEvent.change(document.querySelector('select'), { target: { value: '4' } })
  }

  // THE SPEAKER LABELS, and not the page text. A first pass asserted on the whole
  // body and passed for the wrong reason: every cast row is also an <option> in
  // each label's dropdown, so "Woland" is on the page whenever the CAST contains
  // Woland, whether or not any line is labelled that. Reading the label rows is
  // the only way to ask which title's speakers are on screen.
  const labelRows = () => [...document.querySelectorAll('.name-scroll')].map((n) => n.textContent)

  it('does not say a title has no cast before it has read the title', async () => {
    await mount()
    const release = hold('/movies/', '/dialogues')
    await act(async () => { pick() })
    // THE FRAME THE READER SEES ON A SLOW LINK, held open on purpose. Both claims
    // were on the screen here — in amber — about a title the panel had not read a
    // byte of, and both were then taken back.
    expect(body(), 'no cast was asserted mid-flight').not.toMatch(/no cast/i)
    expect(body(), 'no speaker labels were asserted mid-flight').not.toMatch(/no speaker labels/i)
    await release()
  })

  it('says it is reading rather than saying nothing', async () => {
    await mount()
    const release = hold('/movies/', '/dialogues')
    await act(async () => { pick() })
    expect(body()).toMatch(/reading this title/i)
    await release()
  })

  it('does not leave the previous title\'s speakers under the new title', async () => {
    // THE WORSE HALF OF THE SAME BUG. Nothing was cleared when the selection
    // changed, so a second pick left the first film's rows on screen under the
    // second film's name — offering labels to remap that the chosen film does not
    // contain.
    await mount()
    await act(async () => { pick() })
    await waitFor(() => expect(labelRows().join(' ')).toMatch(/Woland/))
    const release = hold('/movies/', '/dialogues')
    // A DIFFERENT FILM, and that is the whole fixture. A first pass went 4 → '' →
    // 4 inside one act; React collapsed that to no change at all, the effect never
    // re-ran, and the case passed under the mutation because there was nothing for
    // it to clear.
    await act(async () => {
      fireEvent.change(document.querySelector('select'), { target: { value: '5' } })
    })
    expect(labelRows().join(' '), "the first title's speaker survived the change").not.toMatch(/Woland/)
    await release()
  })

  it('lets the newest pick win when two reads are in the air', async () => {
    // TWO FLIGHTS, RESOLVED OUT OF ORDER. Switching titles twice on a slow link
    // leaves two requests racing, and without a guard the SLOWER one wins simply
    // by landing last — painting the first title's speakers under the second
    // title's name, which is the same wrong screen as the stale-state bug above
    // and arrives by a different road.
    await mount()
    const releaseFirst = hold('/movies/', '/dialogues')
    await act(async () => { pick() })

    // The second pick, answered immediately, while the first is still held.
    HOLD = null
    await act(async () => {
      fireEvent.change(document.querySelector('select'), { target: { value: '5' } })
    })
    await waitFor(() => expect(labelRows().join(' ')).toMatch(/the Stalker/))

    // Now the first lands. It is the answer to a question nobody is asking.
    await releaseFirst()
    expect(labelRows().join(' '), 'a stale response replaced the current title').toMatch(/the Stalker/)
    expect(labelRows().join(' '), 'a stale response replaced the current title').not.toMatch(/Woland/)
  })

  it("does not leave the previous title's speakers under an error", async () => {
    // THE PATH THE `!loading` GATE DOES NOT COVER. While a read is in flight the
    // rows are hidden, so the state left over from the previous title is invisible;
    // when the read FAILS, loading goes false and that gate opens again — and
    // without the explicit clears the reader gets the first title's speaker rows
    // sitting under an error about the second, offering labels to remap that the
    // selected title does not contain.
    await mount()
    await act(async () => { pick() })
    await waitFor(() => expect(labelRows().join(' ')).toMatch(/Woland/))
    FAIL = ['/movies/']
    await act(async () => {
      fireEvent.change(document.querySelector('select'), { target: { value: '5' } })
    })
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    expect(labelRows().join(' '), "the previous title's speakers outlived the failure").not.toMatch(/Woland/)
  })

  it('does not turn a failed read into an empty cast', async () => {
    FAIL = ['/movies/']
    await mount()
    await act(async () => { pick() })
    await waitFor(() => expect(body()).toMatch(/server said no/i))
    // The amber line tells a reader to go and fill in a cast. Over a failure that
    // is advice to fix something that may not be broken.
    expect(body(), 'a failed read was reported as an empty cast').not.toMatch(/no cast/i)
  })

  it('shows the cast once it has arrived', async () => {
    await mount()
    await act(async () => { pick() })
    await waitFor(() => expect(body()).not.toMatch(/reading this title/i))
    expect(body()).not.toMatch(/no cast/i)
    expect(labelRows().join(' ')).toMatch(/Woland/)
  })
})
