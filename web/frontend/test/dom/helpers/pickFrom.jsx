// CHOOSE AN ANSWER FROM ONE OF THE APP'S DROPDOWNS.
//
// WHY THIS EXISTS. Until the dropdown sweep, eight screens still drew a native
// `<select>`, and a jsdom test set one by firing a change event at it with the
// VALUE TOKEN behind the option — `{ target: { value: 'year' } }`. That is not
// something a reader can do: nobody types a value token, and the token is not on
// the screen at all. It also could not survive the app's own `Select`, which is a
// button and a panel of buttons, because there is no element to fire a change at.
//
// SO THIS PRESSES. Open the chooser by the name it answers to, then press the row
// whose WORDS the reader would read. That is the same two presses a person makes,
// and a change to either half breaks it — which is the point: the old form went on
// passing over a control the theme had never reached.
//
// ONE FUNCTION, NOT FOUR COPIES. Four test files drive a dropdown; a pasted pair
// of presses in each is four places to fix the day the panel changes shape, which
// is the directive the panel itself was extracted under.
//
// THE PANEL IS A PORTAL, so its rows are not inside the chooser's own element —
// they are on `document.body`. A query scoped to the trigger finds nothing, which
// is the mistake this saves the next caller from making.
import { fireEvent, screen, within } from '@testing-library/react'

// Open the chooser named `name` and press the option reading `option`.
//
// `name` is the chooser's accessible name — what `ariaLabel` puts on the trigger.
// `option` is the text on the row, matched the way Testing Library matches any
// visible string; pass a RegExp where the row carries more than the words you
// mean to name.
export function pickFrom(name, option) {
  fireEvent.click(screen.getByLabelText(name))
  const panel = screen.getByRole('listbox')
  fireEvent.click(within(panel).getByRole('option', { name: option }))
}

// What the chooser currently SAYS, which is the only thing a reader can read off
// it. The value behind the answer is not on the screen.
export const chosenIn = (name) => screen.getByLabelText(name).textContent.trim()
