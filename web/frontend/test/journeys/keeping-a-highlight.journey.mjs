// A reader looking at one highlight keeps it, from the card it is on.
//
// WHAT THEY HAD TO DO BEFORE. "Add to anthology" was a BULK action and only a bulk
// action — the registry said so in as many words: "gathering ONE quote is a real
// thing to want, but the selection is how you say which quotes, and the card menu
// has no picker in it". So a reader who had just read something they wanted to keep
// had to start a selection, tick the thing in front of them, find the bar's ⋯, and
// choose from a list of anthologies that had to already exist. The owner asked for
// the card menu to have it, and the picker is what made that possible: it finds an
// anthology or makes one from the name you type.
//
// THE WORK'S OWN MENU IS NOT HERE AND THAT IS A LIMIT OF THE VOCABULARY, NOT A GAP
// IN THE FEATURE. A work tile has no visible ⋯ — its menu opens on right-click,
// long-press or Shift+F10 — and this directory's verbs are deliberately the ones a
// reader has words for (`see`, `press`, `type`…), with no gesture among them. That
// menu's contents are held by `test/dom/work-card-menu.test.jsx`, which fires the
// real contextMenu event and asserts the row is in it.
//
// THE MUTATION: delete the `press('Add to anthology')` and this fails on the
// combobox that never opens; delete the `type` of the name and it fails at the end,
// on an anthology nobody made.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const KEPT = 'Lines I want to keep'

it('a reader keeps one highlight in a new anthology without selecting anything', async () => {
  await app.goto('/library')
  // One of the four public-domain books the fixture keeps verbatim, so naming it
  // survives a regeneration of the derived ones.
  await app.press("Grimm's Fairy Stories")

  // The card's own overflow, then the verb inside it — the two presses a reader
  // makes. Before this change the menu held Copy, Share, Edit, Favourite and
  // Delete, and stopped.
  await app.press('More actions')
  await app.press('Add to anthology')

  // NO ANTHOLOGY EXISTS YET, so this name can only work if the box creates one.
  // That is the half the old `Select` could not do: with an empty list it drew an
  // error telling the reader to go to another screen, losing the card they were on.
  await app.type('Anthology', KEPT)
  await app.press('Save')

  // WAIT FOR THE APP TO SAY IT LANDED, rather than navigating off the moment the
  // press is made. The dialog closes as soon as it is pressed and the request is
  // still in flight behind it, so a `goto` here is a race — and a race this journey
  // won often enough to look green. The toast is the app's own signal that the
  // server answered.
  await app.see('gathered')

  // What the server kept, read back off the anthologies screen.
  await app.goto('/anthologies')
  await app.see(KEPT)
  await app.press(KEPT)
  // AND IT HAS THE PASSAGE IN IT rather than merely existing: the anthology's own
  // screen names the book each entry came out of.
  await app.see("Grimm's Fairy Stories")

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
