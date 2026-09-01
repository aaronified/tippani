// Mounts the panel stack the way a screen does, so a test can open a descriptor
// and press what the chrome draws.
//
// It lives at test/ root rather than under test/dom/ because the runner's glob is
// `test/dom/**/*.test.{js,jsx}` — a helper named like a test would be collected
// as one and reported as a file with no assertions in it.
import { useEffect } from 'react'
import { PanelHost, usePanelStack } from '../src/ui.jsx'

// `panel` is the descriptor under test; it is opened on mount, which is what a
// screen's own control does. `onStack` hands the stack back so a test can push a
// second level or close from outside.
export function PanelHarness({ panel, onStack }) {
  const stack = usePanelStack()
  const { open } = stack
  useEffect(() => {
    if (panel) open(typeof panel === 'function' ? panel(stack) : panel)
    onStack?.(stack)
    // Once, on mount: re-opening on every render would fight the history
    // round-trip open() performs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}
