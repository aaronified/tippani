// An admin on a phone opens Settings › Jobs and reads the System logs card: the six
// levels are one row that scrolls, the log is a still well whose lines scroll and
// fade inside it, a copy button in the well's corner copies what is in it, and the
// two exports — "What is shown" and "All" — share one row with no word before them.
//
// WHAT WENT WRONG, and the owner photographed it (30 September): the levels wrapped
// onto two rows; the well itself wore the fade, so a scrolled pane's top edge was
// eaten into the card ("It is a recessed well. The log text should be inside it and
// edgemasked, not the well!", said once before and never fixed); there was no way to
// copy the lines; and the exports were "Export" / "What is shown" / "Everything kept
// (30 days)" over two rows.
//
// WHY A JOURNEY. A row that wraps, a mask that clips the well, a clipboard that
// holds the lines: each is what a browser does at a width, and none is wrong to
// read in the source.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - `app.page` MEASURES what no word of the vocabulary does: where the six level
//     chips sit (found by their words inside the group named "Which levels to show"), where
//     the two export links sit (by their words), and whether a fade is drawn, read
//     as the computed mask of the log (found by its role and name) and of the box
//     it sits in. A mask is the fade; there is no other way to ask whether one is
//     on the well.
//   - THE CLIPBOARD IS READ BACK through Chrome's permission for this origin
//     (`overridePermissions`), because what a copy button promises is what lands
//     on the clipboard, and a toast is only the app saying so.
//
// THE MUTATIONS, each built and run and put back:
//   - `row` off the levels' ChipSwitches (jobsSection.jsx): red, the chips sit on
//     two rows;
//   - the well's fade put back on the well (LogWell's Scroller given the well's
//     class and the outer box dropped): red, the well is masked;
//   - the copy button taken out of LogWell: red at "Copy these lines";
//   - the lines' room for the button taken out of index.css (`padding-inline-end`
//     on a well that has a copy): red, "the lines run to 344, under the copy
//     button at 304".

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('on a phone the system logs read in a still well, copy from its corner, and filter and export from one row each', async () => {
  // A few screens first, so the server has request lines to show.
  for (const path of ['/', '/library', '/quotes', '/stats']) await app.goto(path)
  await app.goto('/settings/jobs')
  await app.see('System logs')
  await app.see('What is shown')

  const at = await app.page.evaluate(() => {
    const card = document.querySelector('section[aria-label="System logs"]')
    const group = card.querySelector('[role="group"][aria-label="Which levels to show"]')
    const chips = ['Error', 'Warning', 'Info', 'Request', 'File', 'Trace']
      .map((w) => [...group.querySelectorAll('button')].find((b) => b.textContent.trim() === w))
    const links = ['What is shown', 'All']
      .map((w) => [...card.querySelectorAll('a')].find((a) => a.textContent.trim() === w))
    const log = card.querySelector('[role="log"][aria-label="System log lines"]')
    const mask = (el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage || 'none'
    return {
      chipTops: chips.map((c) => (c ? Math.round(c.getBoundingClientRect().top) : null)),
      rowFaded: mask(group) !== 'none',
      linkTops: links.map((a) => (a ? Math.round(a.getBoundingClientRect().top) : null)),
      exportWord: card.innerText.split('\n').some((l) => l.trim() === 'Export'),
      // THE WELL is whichever box paints the well's fill: the log itself or the
      // nearest box around it that draws a background.
      wellMasked: mask([log, ...(function* up(el) { for (let e = el.parentElement; e; e = e.parentElement) yield e })(log)]
        .find((el) => !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(getComputedStyle(el).backgroundColor))) !== 'none',
      linesOverflow: log.scrollHeight > log.clientHeight,
      linesMasked: mask(log) !== 'none',
      // WHERE THE LINES STOP AND THE COPY BUTTON STARTS: the lines' box without its
      // padding, against the button named for the copy.
      linesEnd: log.getBoundingClientRect().right - parseFloat(getComputedStyle(log).paddingRight),
      copyStart: [...card.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Copy these lines')?.getBoundingClientRect().left,
    }
  })

  expect(new Set(at.chipTops).size, `the six levels sit on ${new Set(at.chipTops).size} rows`).toBe(1)
  expect(at.chipTops.includes(null), 'a level chip is missing').toBe(false)
  expect(at.rowFaded, 'the levels overflow a phone and their row wears no fade').toBe(true)
  expect(new Set(at.linkTops).size, '"What is shown" and "All" sit on different rows').toBe(1)
  expect(at.exportWord, 'the word "Export" still stands before the two').toBe(false)
  expect(at.linesOverflow, 'the log did not fill its well, so nothing about its fade was measured').toBe(true)
  expect(at.wellMasked, 'the well itself is masked, so its edge fades into the card').toBe(false)
  expect(at.linesMasked, 'the lines scroll under no fade').toBe(true)
  // THE COPY DOES NOT SIT ON THE LINES. It floats and does not scroll, and the lines
  // wrap, so a line running under it had its end hidden for good.
  expect(at.copyStart, 'no copy button on the well').toBeTruthy()
  expect(at.linesEnd, `the lines run to ${Math.round(at.linesEnd)}, under the copy button at ${Math.round(at.copyStart)}`).toBeLessThanOrEqual(at.copyStart + 0.5)
  expect(await app.sideways()).toBe(0)

  // THE COPY. What lands on the clipboard is the well's lines, clock first.
  await app.page.browserContext().overridePermissions(app.baseUrl, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  await app.press('Copy these lines')
  await app.see('copied')
  const copied = await app.page.evaluate(() => navigator.clipboard.readText())
  expect(copied, 'the clipboard does not hold the log').toMatch(/^\d\d:\d\d:\d\d Request GET \/api\//m)
})
