# Change one surface yourself — the 27 tiles, per slot

Not built; the machinery is, and nothing reaches it. Verified against `75e55ae` (main,
28 September 2026; its code is `ee4be1f`'s). Each citation is `path:line` and the text at
that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- web/frontend/src/theme.js web/frontend/src/Settings.jsx web/frontend/src/savedThemes.js web/frontend/src/share.jsx internal/httpapi/auth_handlers.go internal/store internal/i18n docs/design/prototypes/settings-restructured.dc.html`,
      then `git grep -n` each quoted anchor below. Nothing here waits on 3.1.0, so there is
      no in-flight item to re-check.
- [ ] Draw the pack's row in Theme's second group, **Change one surface yourself** —
      "Keep the set and swap just the desk, or just the page" — with its button **Open the
      27 tiles** (`docs/design/prototypes/settings-restructured.dc.html:2604` `k: 'tilesDoor'`).
- [ ] The button opens a `slots` row in the same group — "The set proposes; a surface you
      set yourself disposes" (`settings-restructured.dc.html:2600` `k: 'slots'`) — as the
      Colours row answers in its own row (`Settings.jsx:5376` `colourDoors()`).
- [ ] In it: one tab per surface (`theme.js:502` `export const SLOTS = ['ground', 'shell',
      'card', 'cover']`), then every tile drawn twice, on the card's ground and on the
      accent, marked "this set" or "yours" (`settings-restructured.dc.html:3203`
      `} else if (r.kind === 'tiles') {`). Pressing the picked tile again clears the slot, as
      the pack does (`settings-restructured.dc.html:3242`
      `if (ov[slot] === name) delete ov[slot]; else ov[slot] = name;`).
- [ ] The tiles offered are `TILE_NAMES`, the 27 that are not `flat`
      (`theme.js:511` `export const TILE_NAMES = Object.keys(TEXTILES).filter((n) => n !== 'flat')`),
      which no screen imports today; one test does (`material-sets.test.jsx:17`
      `import { applyTheme, getResolvedTheme, MAT_SET_LABELS, MAT_SETS, surfaceStyle, TILE_NAMES } from '../../src/theme.js'`).
- [ ] Writing or clearing a slot is one `PUT` of the preference (`auth_handlers.go:1025`
      `func (s *Server) handleUpdatePreferences(`). A cleared slot is the empty name, which
      already means "whatever the set says" (`auth_handlers.go:380`
      `// Per-slot texture overrides: one tile name each, or empty for "whatever the`); a
      `null` field is read as "not sent" and changes nothing.
- [ ] A saved look carries `tiles` (`savedThemes.js:22` `const FIELDS = [...,
      'tiles', 'texTweak']`), but wearing one never applies them: `wearTheme` sends `tiles`
      (`Settings.jsx:4975` `json('PUT', '/auth/me/preferences', fields)`), the server has no
      such field, and an imported theme file goes the same way (`Settings.jsx:4999`
      `wearTheme(got.theme)`). Wearing a look or importing a file writes its `tiles` under
      the look's own set.
- [ ] The share picture takes the override too: `tileFor` has an override parameter
      (`theme.js:533` `export function tileFor(setName, slot, override) {`) that its callers
      never pass (`share.jsx:83` `const tile = tileFor(material, "card");`,
      `share.jsx:925` `loadTileImage(tileFor(imageMaterial, "card").url),`), so a page
      override would show in the app and not on the share image.
- [ ] Rewrite the comment that says the picker is not built, which names `tileDesk`,
      `tilePage` and `tileBinding` (`Settings.jsx:4709`
      `// caller, applyTheme reading tileDesk/tileShell/tilePage/tileBinding, a saved look`);
      the whole paragraph goes stale when this ships, not only its names.

The owner's rulings, 26 September, each a task:

- [ ] A slot override belongs to its material set. Switching sets shows that set's own
      overrides, and none of another's.
- [ ] The material dials stay where they are (`Settings.jsx:5522`
      `<GhostButton icon={<IconSliders />} keepLabel onClick={() => setPhysOpen(true)}>`).
      The slots row is added beside them, and nothing moves.

Decided while planning, so the build needs nothing further:

- [ ] Overrides are kept per set, as the pack keeps them (`settings-restructured.dc.html:3218`
      `const picked = (this.state.setTiles[setId] || {})[slot];`), in one preference,
      `tileSlots`: a JSON string, as `texTweak` is (`auth_handlers.go:683`
      `` TexTweak string `json:"texTweak"` ``), because the preference struct is compared
      whole and cannot hold a map. It reads `{"<set>": {"<slot>": "<tile>"}}`. The server
      checks every key and value: a set name of the same shape `badTileName` allows, a slot
      that is one of the four, and a tile that passes `badTileName` (`auth_handlers.go:865`
      `func badTileName(v string) bool {`); anything else is a 400.
- [ ] The four keys that exist today are global (`auth_handlers.go:394`
      `` TileGround string `json:"tileGround"` ``, through `:397`), read by `applyTheme` (`theme.js:752`
      `tiles: SLOTS.map((slot) => {`). A one-time upgrade,
      `internal/store/onetime_<version>_tile_slots.go`, moves a reader's values under the
      set they are wearing (`auth_handlers.go:373` `` MaterialSet string `json:"materialSet"` ``),
      or under `manuscript`, the default set, when they never chose one
      (`theme.js:248` `export const MAT_SET_DEFAULT = 'manuscript'`). Nothing on screen
      changes on upgrade, and the four keys retire.
- [ ] The new key joins the Theme section's reset list, where the four sit now
      (`Settings.jsx:270` `'tileGround', 'tileShell', 'tileCard', 'tileCover',`).
- [ ] The panel draws no per-tile "Tweak", although the pack's renderer has one: the dials
      already own that, and the owner's ruling keeps them where they are.
- [ ] The door's glyph is not the pack's `sliders`: the dials door beside it already wears
      `IconSliders` (`Settings.jsx:5522`
      `<GhostButton icon={<IconSliders />} keepLabel onClick={() => setPhysOpen(true)}>`),
      and one glyph on two doors says they open the same thing. The build picks an existing
      glyph no other Theme control wears, or draws one.
- [ ] Keys in `en.txt` and `bn.txt` together.
- [ ] Tests: a journey opens the panel, puts one tile on one surface, switches set and back,
      sees the pick return under its own set only, then clears it and sees the set's own
      material; a journey that wears a saved look carrying an override and sees it applied;
      Go tests of the preference check (a bad set, slot or tile is a 400) and of the upgrade,
      with and without a chosen set. Each mutation-checked, the mutation named in the commit.
