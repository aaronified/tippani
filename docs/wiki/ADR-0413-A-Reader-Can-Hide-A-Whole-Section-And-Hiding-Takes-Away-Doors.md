# ADR-0413: A reader can hide a whole section, and hiding takes away doors rather than data

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.x

**Decided.** Settings → Features switches the Library, the Catalogue and Quotes on and off per account. Switching one off removes its DOORS — its row in all four nav lists, its count tile on Home, the ＋'s offer of that kind, its scope chips on Search, and its row in the shortcut sheet — and changes nothing else. `parsePath` and `statePath` are not feature-aware, so the route still resolves, a bookmark still opens, a quote still links to the book it came from, the keyboard sequence still works, and the review deck still draws on the section. One section always has to stay: the switch is disabled with its reason in words, the server refuses the set with a 400, and `loadPrefs` corrects it on read.

**Why.** Not everybody keeps films, and not everybody keeps a quote that belongs to no book. A tab for something you have never used is a permanent invitation to an empty screen, and until now the strip, the drawer and the phone bar were the same eight destinations for everybody. The distinction that makes this safe is between a DOOR and a CONTENT LINK: a door is a control whose whole purpose is "go to this section", and a content link is the thread from a thing to its source. Muting the second would strand four thousand highlights to spare somebody a tab, so a favourite on Home still opens its book with the Library hidden — what it loses is the tile that only ever said "go to the Library".

**Instead of.** Two things. Deleting or disabling anything, which would make the switch a decision about the reader's library rather than about their screen — the promise "turn it back on and everything is where you left it" is the entire feature and it is only credible because the URL is untouched. And a fifth hand-maintained list of which rows are hidden: routes.js already carries four lists of the same tab keys and says out loud that the shape "only stays correct if something checks it", so there is one `visibleTabs` filter every consumer calls, and the test asserts the absence across all four lists at once rather than as four cases.

**Not a reversal of the retired `navUtilities` toggle above**, and the difference is worth stating because the objection recorded there is the right one to raise. That setting chose *where* two tabs lived, which is two layouts of the same app — two things to test, to describe, and to keep the collapse measurement honest against — in exchange for one row of horizontal space. This chooses *whether a section is yours at all*. It is the same layout with fewer destinations in it, the cost is one filter rather than a second arrangement, and what it buys is not space but not being shown a section you have never used. The sentence that entry ends on still holds: making something configurable is not a way of not deciding, and the decision here is that the sections themselves stay exactly as they are.

**Deliberately not gated by this: the review scope chips.** They name what the DECK draws from rather than where you can go, so hiding the Catalogue does not stop you being asked about a film line you saved. Narrowing somebody's schedule from a cosmetic switch would be the opposite of what this promises.

**Approved.** The owner's, asked for as an optional feature "not everyone needs"; the door/link split and the last-section rule are mine.

<sub>1.16.x — `web/frontend/src/routes.js` · `web/frontend/src/App.jsx` · `web/frontend/src/Settings.jsx` · `internal/httpapi/auth_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
