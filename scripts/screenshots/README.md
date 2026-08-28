# Screenshot scaffold

Puppeteer scaffold that walks every screen of the Tippani app and saves one PNG per
screen, per theme. Isolated from `web/frontend`'s own `package.json`/lockfile — this is
tooling, not part of the shipped app.

Drives **Firefox over WebDriver BiDi**, not Chromium over CDP. `puppeteer-core` never
downloads a browser, so the only requirement is a Firefox on the machine: `/usr/bin/firefox`
and the other usual locations are probed, or point at one with `--firefox <path>` /
`PUPPETEER_EXECUTABLE_PATH`.

## Quick start

Against a scratch server it builds, boots, and tears down itself (fresh account,
signup path exercised every run):

```bash
cd scripts/screenshots
npm ci
./run-with-server.sh --out ./out
```

Against a server you already have running (an existing account, so this logs in
rather than signs up — pass matching `--username`/`--password`):

```bash
node capture.mjs --base-url http://127.0.0.1:8080 --username you --password yourpass --out ./out
```

Run `node capture.mjs --help` for the full flag list.

## Seeding

`capture.mjs` creates a fresh account, so by default every screen captures **empty**. Pass
`--seed` to fill it with a small fixed library first:

```bash
./run-with-server.sh --seed --out ./out          # seed, then capture
node seed.mjs --base-url http://127.0.0.1:8080   # seed only
```

`seed.mjs` writes through the public API — the same endpoints the SPA calls, with the same
validation, so a fixture it creates is one the app can actually reach. It creates the
account itself when the server is on onboarding, which is why it runs *before* the browser:
`capture.mjs` then takes its login path.

| Seeded | What for |
| --- | --- |
| 6 tags, **22 books**, 13 annotations | Library, Tags, Quotes, Home counts |
| **22 catalogue titles** — 16 films, 4 shows, 2 games — 8 dialogues | Catalogue, its media-type filters, and the show/game-only fields |
| 5 standalone quotes | The third kind — speaker, occasion, kind, translation |
| 3 anthologies, 10 entries | Anthologies, chosen **by tag** so adding a fixture doesn't silently change which quotes an anthology holds |
| 2 binned quotes | Bin — created then deleted, since delete is a move to trash |
| 3 staged rows | Staging — by exporting a seeded book and re-importing it, so the fixture is the app's own format rather than a second hand-maintained copy of it |
| **43 real cover images** | Shelves and the catalogue grid, which are mostly artwork by area |
| **1 person, with a portrait** | The share image's portrait backdrop, and the Metadata console's photo/link status |

### Artwork

Covers and posters are real, and fetched from the two services that publish them under
terms that allow it — Open Library for book jackets, Wikimedia Commons for film posters and
period television stills. `--no-artwork` skips the lot and needs no network.

Every reference is a **pinned identifier**: a book names an Open Library cover id, a title
names an exact Commons file name. Resolving `"Citizen Kane poster"` by search at run time
would return whatever ranks first that day, which is the same drift this scaffold exists to
remove.

Images are cached under `.artwork-cache/` (gitignored — the art is not ours to commit, and
it is reproducible from the ids in `seed.mjs`). Only the first run touches the network; every
later run reads the cache, which is what keeps the captures byte-identical.

A cover that will not download leaves that work without one and is **reported by name** at
the end of the run. That is a real state — one book carries `nocover` deliberately so the
placeholder is captured too.

### The one image this script does not upload

A person's portrait is the exception, and the reason is a security control working. There
is no multipart upload for one: `PUT /people` takes an `image_url` and fetches it
server-side through `metadata.FetchUserImage`, which refuses loopback and private
addresses at dial time. So serving the disk cache off `127.0.0.1` and handing the server
that URL — the obvious way to keep the bytes local — is precisely the SSRF the guard
exists to stop, and defeating it to seed a fixture would be the worst possible reason to.

The Commons **title** stays pinned, so it is the same photograph every run; what is lost
is the cache, so this is the one fixture image that touches the network on every run. It
fails the same way every other artwork does: recorded against the name, never fatal. A
person with no photo is a real row, and the share card falls back to its no-portrait
layout.

Tagore is the person seeded because this file already credits him twice — as the author of
*Gitanjali* and as the speaker of a standalone quote — so one row covers two of the share
card's three `facesFor` paths (`author` and `speaker`). The film's `actor` path has nobody
seeded yet; the card renders all three identically, so it is coverage that is missing
rather than behaviour.

One fixture in each list is deliberately oversized — a 168-character book title, a long note,
a five-word tag. `visual-verify` asks for a long-content capture because truncation bugs
exist only in that state, and a library of tidy short strings never finds one. Statuses are
spread across reading/completed/paused/abandoned/none so the filters, the progress bars and
the Stats screen all have something to show.

Seeding refuses to run twice over the same account (`--force` overrides). A second pass
would double every list and change every count on screen, and it would look like it worked.

Editing fixtures: the tables at the top of `seed.mjs` are the part to change. Two values
there are the app's internal vocabulary rather than the obvious word, and both are a 400 if
you guess — a film's status is `watching`, not `reading`, and an anthology entry's kind is
`book` / `screen` / `utterance`, not the name of the endpoint that created it.

## What it captures

Every screen the app itself marks with `data-screen-label` (`home`, `library`, `movies`,
`quotes`, `anthologies`, `tags`, `metadata`, `search`, `stats`, `staging`, `settings`,
`bin`), once per theme in `--themes` (default `light,dark`). `book-detail` and
`movie-detail` need a real id — pass `--book-id`/`--movie-id` once you have a fixture, or
they're skipped with a reason in `out/manifest.json`.

Sign-in is driven through the real onboarding/login form (autocomplete-tagged fields), not
constructed out of band — a screen reachable only by a route that isn't actually offered
is a screen that has never been screenshotted honestly.

## Determinism

Two runs against two scratch servers produce byte-identical PNGs. That is the property
worth protecting: without it a before/after pair contains your change plus whatever the
harness let drift, and nothing says which moved the pixels.

| Control | How |
| --- | --- |
| Theme | Firefox pref `layout.css.prefers-color-scheme.content-override` (**0 = dark, 1 = light**), so the app's own `system` resolution in `src/theme.js` is exercised rather than bypassed |
| Viewport | Fixed `--viewport WxH` (default `1280x900`), device scale factor 1 |
| Motion | `ui.prefersReducedMotion` pref **and** a zero-duration stylesheet — a transition written without a reduced-motion guard ignores the query |
| Clock | `Date` pinned to a fixed instant (`--no-freeze-clock` to turn off) |
| Randomness | `Math.random` replaced with a fixed-seed mulberry32 (`--no-seed-random` to turn off) — Home's greeting pool is deliberately unseeded in the app |
| Fonts | `document.fonts.ready` awaited before every capture; the app's woff2 faces change every metric on screen while a fallback is substituted |
| Locale / timezone | Pinned via BiDi `emulateLocale`/`emulateTimezone` (`--locale`, `--timezone`; default `en-US`, `UTC`) |
| Artwork | Fetched once and cached on disk, so a re-upload upstream cannot change the library under you |
| Fixture data | `--seed` writes a fixed library through the API — no random ids, no `new Date()` |

One browser is launched **per theme**, because Firefox reads preferences when the profile
starts — a theme is not something you can switch on a live page. A fresh profile also
means a fresh session per theme, which is why the first theme signs up and the rest log in.

Fixture data is the other half of it, and `--seed` writes the same library every time —
see Seeding above. Without it the account is empty, which is a legitimate set of captures
but not a comparable one for anything list-shaped.

### Why not Chromium

`page.emulateMediaFeatures`, the usual way to force `prefers-color-scheme`, is routed by
Puppeteer through a CDP emulation manager. On Firefox it throws
`UnsupportedOperation: CDP support is required for this feature`. The preference above
replaces it. Keeping both engines would mean two of every control in the table — the kit's
`visual-verify` skill is explicit that a second driver gives you a second harness to keep
deterministic, so this one picks an engine.

## Extending

- New screen: add `{ name, path }` to `SCREENS` in `capture.mjs` — `path` matches the
  client route in `web/frontend/src/routes.js`.
- New state (a modal, an error, a populated list): open it via the same click/type path a
  user would use right before calling `page.screenshot`, per `claude-kit`'s
  `screenshot-runner` agent — don't construct it directly.
- New determinism control: add it to the table above. An uncontrolled source of variation
  that nobody wrote down is found again the hard way, by a diff nobody can explain.
