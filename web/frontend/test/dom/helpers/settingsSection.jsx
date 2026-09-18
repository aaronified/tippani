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
// AND THE PHONE HAS NO TABS AT ALL. Above a phone the rail is a row of tabs;
// on one it is a field, because five tabs on a 390px screen show two and a half.
// A helper that only knew the tabs would fail every phone-width case with
// "cannot find role=tab", which reads like the rail is broken when it is doing
// exactly what it was built to do.
//
// A SECTION THAT IS NOT THERE IS AN ERROR, NOT A NO-OP. A non-admin has no
// Server section, because the cards in it are theirs to not have — so asking for
// it is a mistake in the test, and swallowing it would turn that mistake into a
// case that passes while asserting nothing.
import { fireEvent, screen } from '@testing-library/react'

export async function openSettingsSection(name) {
  const tabs = screen.queryAllByRole('tab', { name })
  if (tabs.length) {
    const tab = tabs[tabs.length - 1]
    fireEvent.click(tab)
    return tab
  }
  // The phone's field: a trigger that opens a listbox, not a native <select>.
  // Its own accessible name is the rail's aria-label, and the option carries the
  // section's label — possibly with a count after it, which is why this matches
  // the start rather than the whole string.
  const triggers = screen.queryAllByRole('button', { name: /which settings to change/i })
  if (triggers.length) {
    fireEvent.click(triggers[triggers.length - 1])
    const options = await screen.findAllByRole('option')
    const option = options.find((o) => (o.textContent || '').startsWith(name))
    if (option) {
      fireEvent.click(option)
      return option
    }
  }
  // Fall through to the tab matcher's own error, which names what it looked for
  // and prints the screen — a better failure than anything this could compose.
  return screen.findByRole('tab', { name })
}
