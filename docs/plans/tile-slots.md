# Change one surface yourself — the 27 tiles, per slot

Not built; the machinery is, and nothing reaches it. Verified against `75e55ae` (main,
28 September 2026; its code is `ee4be1f`'s). Each citation is `path:line` and the text at
that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- web/frontend/src/theme.js web/frontend/src/Settings.jsx web/frontend/src/savedThemes.js internal/httpapi/auth_handlers.go`,
      then `git grep -n` each quoted anchor below.
- [ ] Draw the pack's third row in Theme's second group, **Change one surface yourself** —
      "Keep the set and swap just the desk, or just the page" — with its button **Open the
      27 tiles** (`docs/design/prototypes/settings-restructured.dc.html:2604` `k: 'tilesDoor'`).
- [ ] The button opens a `slots` row in the same group — "The set proposes; a surface you
      set yourself disposes" (`settings-restructured.dc.html:2600` `k: 'slots'`) — as the
      Colours row answers in its own row (`Settings.jsx:5376` `colourDoors()`).
- [ ] In it: one tab per surface (`theme.js:502` `export const SLOTS = ['ground', 'shell',
      'card', 'cover']`), then every tile drawn twice, on the card's ground and on the
      accent, marked "this set" or "yours" (`settings-restructured.dc.html:3203`
      `} else if (r.kind === 'tiles') {`), and "whatever the set says" to clear the slot.
- [ ] The tiles offered are `TILE_NAMES`, the 27 that are not `flat`
      (`theme.js:511` `export const TILE_NAMES = Object.keys(TEXTILES).filter((n) => n !== 'flat')`),
      which nothing imports today.
- [ ] Writing a slot is one `PUT` of the preference (`auth_handlers.go:1025`
      `func (s *Server) handleUpdatePreferences(`); clearing it is `null`, and the surface
      follows the set again.
- [ ] A saved look carries `tiles` already (`savedThemes.js:22` `const FIELDS = [...,
      'tiles', 'texTweak']`) and goes on carrying the overrides of the look's own set.
- [ ] Correct the comment that still names `tileDesk`, `tilePage` and `tileBinding`
      (`Settings.jsx:4709` `// caller, applyTheme reading tileDesk/tileShell/tilePage/tileBinding, a saved look`).

The owner's rulings, 26 September, each a task:

- [ ] A slot override belongs to its material set. Switching sets shows that set's own
      overrides, and none of another's.
- [ ] The material dials stay where they are (`Settings.jsx:5522`
      `<GhostButton icon={<IconSliders />} keepLabel onClick={() => setPhysOpen(true)}>`).
      The slots row is added beside them, and nothing moves.

Decided while planning, so the build needs nothing further:

- [ ] Overrides are kept per set, as the pack keeps them (`settings-restructured.dc.html:3218`
      `const picked = (this.state.setTiles[setId] || {})[slot];`): one preference holding
      each set's picks by slot, every value checked by `badTileName` (`auth_handlers.go:865`
      `func badTileName(v string) bool {`).
- [ ] The four keys that exist today are global (`auth_handlers.go:394`
      `` TileGround string `json:"tileGround"` ``, through `:397`), read by `applyTheme` (`theme.js:752`
      `tiles: SLOTS.map((slot) => {`). A one-time upgrade,
      `internal/store/onetime_<version>_tile_slots.go`, moves a reader's values under the
      set they are wearing (`materialSet`), so nothing on screen changes on upgrade, and
      the four keys retire.
- [ ] The new key joins the Theme section's reset list, where the four sit now
      (`Settings.jsx:270` `'tileGround', 'tileShell', 'tileCard', 'tileCover',`).
- [ ] The panel draws no per-tile "Tweak", although the pack's renderer has one: the dials
      already own that, and the owner's ruling keeps them where they are.
- [ ] Keys in `en.txt` and `bn.txt` together.
- [ ] Tests: a journey opens the panel, puts one tile on one surface, switches set and back,
      and sees the pick return under its own set only; Go tests of the preference check and
      of the upgrade. Each mutation-checked, the mutation named in the commit.
