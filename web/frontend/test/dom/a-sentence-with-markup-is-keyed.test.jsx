// A sentence that carries markup renders without React's key warning.
//
// THE UNIT IS tNodes, and this file knows it by name: it is the function every screen
// uses to put a <b> or a link into a translated sentence, and the warning is about the
// array it returns. A screen-level render would add the screen around that array and,
// as far as this file can tell, nothing the warning depends on. The two
// sentences are the two screens the warning was reported from (#44): the factory-reset
// prompt, and Add → Files.
//
// React logs "Each child in a list should have a unique "key" prop" through
// console.error in a development build, which is what the dom tier runs. It logs it
// ONCE PER PARENT IT CAN NAME, and a host <p> is named the same wherever it is: two
// <p>s in two components still shared one warning, and the second case sat behind the
// first's and could not fail (measured: reverted, the file failed one case of three).
// So the two sentences sit in a <p> and a <div>. Measured with tNodes' keying taken out:
// both sentence cases fail, and the third, a caller's own key kept, passes, since it
// guards the other direction (a key tNodes must not overwrite).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { t, tNodes } from '../../src/i18n.js'

function ResetPrompt() {
  return <p>{tNodes('account.reset.confirm.prose', { word: <b>RESET</b> })}</p>
}
function NothingLandsNote() {
  return <div>{tNodes('import.nothing-lands.body', { queue: <b>{t('staging.title')}</b> })}</div>
}

let errors
beforeEach(() => {
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  errors.mockRestore()
})

const keyWarnings = () => errors.mock.calls.filter((c) => String(c[0]).includes('unique "key"'))

describe('a translated sentence that carries markup', () => {
  it('renders the factory reset prompt with its bold word and no key warning', () => {
    render(<ResetPrompt />)
    expect(screen.getByText('RESET').tagName).toBe('B')
    expect(keyWarnings()).toEqual([])
  })

  it('renders the pending-import note with its bold queue name and no key warning', () => {
    render(<NothingLandsNote />)
    expect(screen.getByText(t('staging.title')).tagName).toBe('B')
    expect(keyWarnings()).toEqual([])
  })

  it('keeps a key the caller gave', () => {
    const out = tNodes('account.reset.confirm.prose', { word: <b key="mine">RESET</b> })
    expect(out.find((n) => typeof n === 'object').key).toBe('mine')
  })
})
