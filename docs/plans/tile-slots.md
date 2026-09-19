# Change one surface yourself — the 27 tiles, per slot

**Status: not built. The machinery is, and it is unreachable.**

The pack draws a third row in Theme's second group
(`docs/design/prototypes/settings-restructured.dc.html:2597-2607`):

| | |
| --- | --- |
| Row | **Change one surface yourself** — "Keep the set and swap just the desk, or just the page" |
| Its button | **Open the 27 tiles** |
| What opens | a `slots` row — "The set proposes; a surface you set yourself disposes" — one picker per surface, any of the 27 tiles on any of them |
| Its info | "One surface at a time. Any surface takes any of the 27 tiles. What you leave alone stays the set's own material." |

**WHY THIS FILE EXISTS RATHER THAN THE FEATURE.** The session that rebuilt this section
was told "no new features now, but keep notes", and this is a feature: the app has never
drawn a per-slot picker. It is written down because the half of it that IS built is
invisible, and invisible half-built things are what somebody deletes by accident —

- `web/frontend/src/theme.js` exports `TILE_NAMES` (26 tiles, `flat` excluded) and **no
  file imports it**;
- `applyTheme` already reads `tileDesk`, `tileShell`, `tilePage` and `tileBinding` from
  the preferences and paints them over the set's own materials;
- a saved look already carries `tiles`, so a theme file exported from another install can
  contain slot overrides this install cannot edit;
- `MaterialPhysics`'s own comment used to tell the next reader the control was "one row
  up", which was false on every screen.

**WHAT BUILDING IT MEANS.** One row under the material grid, its button opening an inline
panel in the same row (the pack's shape, and the shape the Colours row now uses): four
surfaces, each a picker over `TILE_NAMES` plus "whatever the set says". Writing a slot is
a `PUT` of one preference field; clearing it is `null`, which is how a surface goes back
to following the set. The saved-look format needs nothing — it already carries the fields.

**WHAT IT IS NOT.** It is not the material DIALS, which ship: those are what a material
does with light, per tile, behind "Open the dials". A slot is which material is there at
all.
