// Put a mounted Settings screen on the section a test is about.
//
// WHY EVERY SETTINGS TEST NEEDS THIS NOW. Settings used to be one scrolling grid
// with every card on it, so a test could mount the screen and look straight for
// the control it cared about. The v3 pack makes it five named screens behind a
// rail, so the Backup card is no longer on the page when the page opens — it is
// one press away, exactly as it is for a reader.
//
// ONE FUNCTION, NOT TEN COPIES. Ten test files mount this screen, and a press
// pasted into each is ten places to fix the day the rail changes shape — which is
// the same directive the rail itself was extracted under.
//
// IT PRESSES; IT DOES NOT SEED. The section is remembered per device, so a test
// could reach in and write the stored key instead. That would be a test knowing
// how the screen persists its state, and it would keep passing if the rail stopped
// working entirely. Pressing the tab is what a reader does and what breaks when
// the tab breaks.
// THE LAST RAIL, NOT THE ONLY ONE. A case that mounts the screen twice — to
// compare one set of stored preferences against another — has two rails on the
// page, and `findByRole` refuses a name that matches twice rather than guessing.
// The convention those cases already use is `.at(-1)`: the screen mounted most
// recently is the one under test. So this takes the last, and a single mount is
// the same thing with a list of one.
// AND THE PHONE HAS NO TABS AT ALL. Above a phone the rail is a row of tabs; on
// one it is an INDEX — a list of the sections, one tall row each, which opens the
// section it names. It was a field for a while and the owner rejected that: a
// dropdown makes you operate a control before navigation begins. A helper that
// only knew the tabs would fail every phone-width case with "cannot find
// role=tab", which reads like the rail is broken when it is doing exactly what it
// was built to do.
//
// A SECTION THAT IS NOT THERE IS AN ERROR, NOT A NO-OP. A non-admin has no
// Server section, because the cards in it are theirs to not have — so asking for
// it is a mistake in the test, and swallowing it would turn that mistake into a
// case that passes while asserting nothing.
import { fireEvent, screen, within } from '@testing-library/react'

export async function openSettingsSection(name) {
  const tabs = screen.queryAllByRole('tab', { name })
  if (tabs.length) {
    const tab = tabs[tabs.length - 1]
    fireEvent.click(tab)
    return tab
  }
  // The phone's index: a navigation landmark holding one button per section. The
  // row's text starts with the section's name and may carry a count after it,
  // which is why this matches the start rather than the whole string.
  const navs = screen.queryAllByRole('navigation', { name: /which settings to change/i })
  if (navs.length) {
    const rows = within(navs[navs.length - 1]).getAllByRole('button')
    const row = rows.filter((r) => (r.textContent || '').trim().startsWith(name)).at(-1)
    if (row) {
      fireEvent.click(row)
      return row
    }
  }
  // Fall through to the tab matcher's own error, which names what it looked for
  // and prints the screen — a better failure than anything this could compose.
  return screen.findByRole('tab', { name })
}
