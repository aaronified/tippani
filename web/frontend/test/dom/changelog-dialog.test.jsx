// The changelog, in the app — on the Server screen, not behind a door.
//
// IT WAS A DIALOG. The pack gives the release log a group of its own at the foot
// of Server ("What changed", settings-restructured.dc.html:2760), so the button
// that opened it is gone and the list is simply there. What this file asserts did
// not change — the ordering, the folding, the running mark, and above all the
// hand-rolled inline renderer — because those are properties of the list and not
// of the frame that used to hold it. Only the way in changed.
//
// The Updates card has always linked to GitHub's releases page, and that link is
// the right answer to "what is in a version I have not installed". This is the
// other question — what is in the one I am running — and it is answerable with no
// network at all, which on the hardware this app is built for (a NAS on a LAN,
// behind Tailscale, sometimes genuinely offline) is the difference between a
// dialog and an empty dialog.
//
// What is asserted here is mostly the RENDERER, because it is the part with a
// failure mode: there is no markdown dependency in this frontend and no
// dangerouslySetInnerHTML anywhere in it, so the inline spans are done by hand in
// thirty lines, and a hand-rolled renderer is exactly the thing that quietly
// mangles an entry six releases down the list where nobody looks.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let RESP

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (path === '/changelog') return { ok: true, data: RESP }
    return { ok: true, data: {} }
  }),
}))

const Settings = (await import('../../src/Settings.jsx')).default

const ADMIN = { username: 'a', is_admin: true, version: '1.12.0', preferences: {} }

const release = (version, over = {}) => ({
  version,
  date: '2026-08-14',
  sections: [{ title: 'Added', entries: ['Something happened.'] }],
  ...over,
})

beforeEach(() => {
  CALLS = []
  RESP = {
    current: '1.12.0',
    current_listed: true,
    releases: [release('1.12.0'), release('1.11.2'), release('1.11.1')],
  }
})

const openLog = async () => {
  render(<Settings user={ADMIN} />)
  // No door to press any more: reaching the Server section IS reaching the log.
  await openSettingsSection('Server')
  await waitFor(() => expect(screen.getByText('1.12.0')).toBeTruthy())
}

describe('opening it', () => {
  // STILL LAZY, JUST ON A DIFFERENT BOUNDARY. The history is a quarter of a
  // megabyte of markdown and the old reason for not fetching it was "a dialog
  // nobody opened". The reason now is "a section most readers are not on":
  // Settings does not open on Server, and Server is admin-only. So the cost is
  // still paid only by somebody who went looking.
  it('fetches nothing while the reader is on another section', async () => {
    render(<Settings user={ADMIN} />)
    await openSettingsSection('Review')
    expect(CALLS.filter(([, p]) => p === '/changelog')).toEqual([])
  })

  it('fetches once when the section is reached', async () => {
    await openLog()
    expect(CALLS.filter(([, p]) => p === '/changelog')).toHaveLength(1)
  })

  // AND AN ANSWER WITH NO RELEASES IN IT SAYS SO RATHER THAN THROWING. As a
  // dialog this could not happen to a reader who never pressed the button; on the
  // screen it renders every time, and `{}` from an old build or a proxy used to
  // reach `data.releases.map` and take the whole section down.
  it('says there is nothing to show rather than throwing on an empty answer', async () => {
    RESP = {}
    render(<Settings user={ADMIN} />)
    await openSettingsSection('Server')
    await waitFor(() => expect(screen.getByText(/No releases to show/)).toBeTruthy())
  })

  const versions = () => [...document.querySelectorAll('.cl-version')].map((n) => n.textContent)

  it('lists the releases in the order the server sent them', async () => {
    // "The latest release on top" is a property of the FILE, preserved by the
    // parser and then by this — not a client-side sort, which would be a second
    // opinion about ordering that could disagree with the changelog itself.
    await openLog()
    fireEvent.click(screen.getByRole('button', { name: /Read the whole log/ }))
    expect(versions()).toEqual(['1.12.0', '1.11.2', '1.11.1'])
  })

  // TWO AT REST, AND THE REST BEHIND A PRESS — the pack's own shape for this group
  // ("The last two releases, with the rest behind Show more"), and what lets the
  // list stop scrolling inside itself. As a dialog body it carried a max-height and
  // its own scrollbar; on a page that is a nested scroller with no fade and no way
  // to see the whole set.
  it('stands at two releases and opens to the whole log', async () => {
    await openLog()
    expect(versions()).toEqual(['1.12.0', '1.11.2'])

    fireEvent.click(screen.getByRole('button', { name: /Read the whole log/ }))
    expect(versions()).toEqual(['1.12.0', '1.11.2', '1.11.1'])

    fireEvent.click(screen.getByRole('button', { name: /Fold the log/ }))
    expect(versions()).toEqual(['1.12.0', '1.11.2'])
  })

  // AND NO BUTTON WHEN THERE IS NOTHING FOLDED AWAY. "Read the whole log" over a
  // log that is already whole is a press that does nothing.
  it('offers no control when every release is already shown', async () => {
    RESP = { current: '1.12.0', current_listed: true, releases: [release('1.12.0')] }
    render(<Settings user={ADMIN} />)
    await openSettingsSection('Server')
    await waitFor(() => expect(screen.getByText('1.12.0')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Read the whole log/ })).toBeNull()
  })

  it('opens only the newest, and folds the rest', async () => {
    // Seventy releases expanded is a scroll bar with no landmarks in it.
    await openLog()
    const heads = screen.getAllByRole('button', { expanded: false })
    expect(heads.length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
  })

  it('unfolds one on a press, and folds it again', async () => {
    await openLog()
    const second = screen.getByText('1.11.2').closest('button')
    expect(second.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(second)
    expect(second.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(second)
    expect(second.getAttribute('aria-expanded')).toBe('false')
  })

  it('marks the build you are actually running', async () => {
    // The one thing a link to the releases page cannot tell you.
    await openLog()
    const running = document.querySelectorAll('.cl-running')
    expect(running).toHaveLength(1)
    expect(running[0].closest('.cl-release').textContent).toContain('1.12.0')
  })

  it('says so plainly when the running build is not a release', async () => {
    RESP = { ...RESP, current: 'dev', current_listed: false }
    await openLog()
    expect(document.querySelectorAll('.cl-running')).toHaveLength(0)
    expect(screen.getByText(/not one of the versions above/)).toBeTruthy()
  })
})

describe('the inline renderer', () => {
  const only = (entry) => {
    RESP = { ...RESP, releases: [release('1.12.0', { sections: [{ title: 'Added', entries: [entry] }] })] }
  }

  it('renders **bold** as bold, without the asterisks', async () => {
    only('**A thing.** And the rest of it.')
    await openLog()
    const b = document.querySelector('.cl-entry b')
    expect(b.textContent).toBe('A thing.')
    expect(document.querySelector('.cl-entry').textContent).not.toContain('**')
  })

  it('renders `code` as code, without the backticks', async () => {
    only('It lives in `internal/changelog`.')
    await openLog()
    expect(document.querySelector('.cl-entry code').textContent).toBe('internal/changelog')
    expect(document.querySelector('.cl-entry').textContent).not.toContain('`')
  })

  it('renders a link, and opens it safely', async () => {
    only('See [the roadmap](https://example.com/roadmap) for what is next.')
    await openLog()
    const a = document.querySelector('.cl-entry a')
    expect(a.textContent).toBe('the roadmap')
    expect(a.getAttribute('href')).toBe('https://example.com/roadmap')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('refuses a link that is not http(s), keeping the words', async () => {
    // Trusted content — it ships inside the binary — but a scheme is worth
    // refusing by rule rather than by trust, because the rule costs a line.
    only('A [bad one](javascript:alert(1)) here.')
    await openLog()
    expect(document.querySelector('.cl-entry a')).toBeNull()
    expect(document.querySelector('.cl-entry').textContent).toContain('bad one')
  })

  it('keeps a multi-paragraph entry as paragraphs under ONE bullet', async () => {
    // The failure a naive renderer has, and the one the server parser works to
    // avoid: an entry in this changelog routinely runs to two paragraphs.
    only('The first paragraph.\n\nAnd the second one.')
    await openLog()
    const paras = document.querySelectorAll('.cl-entry p')
    expect(paras).toHaveLength(2)
    expect(paras[0].textContent).toBe('The first paragraph.')
    expect(paras[1].textContent).toBe('And the second one.')
    expect(document.querySelectorAll('.cl-entry')).toHaveLength(1)
  })

  it('shows anything it does not understand verbatim, rather than eating it', async () => {
    // An honest failure for a changelog: you see the syntax.
    only('A ~~strikethrough~~ and an ![image](x.png).')
    await openLog()
    const text = document.querySelector('.cl-entry').textContent
    expect(text).toContain('~~strikethrough~~')
  })

  it('groups entries under their section heading', async () => {
    RESP = {
      ...RESP,
      releases: [
        release('1.12.0', {
          sections: [
            { title: 'Added', entries: ['One.', 'Two.'] },
            { title: 'Fixed', entries: ['Three.'] },
          ],
        }),
      ],
    }
    await openLog()
    const sections = [...document.querySelectorAll('.cl-section')]
    expect(sections).toHaveLength(2)
    expect(sections[0].textContent).toContain('Added')
    expect(within(sections[0]).getAllByRole('listitem')).toHaveLength(2)
    expect(within(sections[1]).getAllByRole('listitem')).toHaveLength(1)
  })
})
