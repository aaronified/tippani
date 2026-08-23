# Screenshot scaffold

Puppeteer scaffold that walks every screen of the Tippani app and saves one PNG per
screen, per theme. Isolated from `web/frontend`'s own `package.json`/lockfile — this is
tooling, not part of the shipped app.

## Quick start

Against a scratch server it builds, boots, and tears down itself (fresh account,
signup path exercised every run):

```bash
cd scripts/screenshots
npm install
./run-with-server.sh --out ./out
```

Against a server you already have running (an existing account, so this logs in
rather than signs up — pass matching `--username`/`--password`):

```bash
node capture.mjs --base-url http://127.0.0.1:8080 --username you --password yourpass --out ./out
```

Run `node capture.mjs --help` for the full flag list.

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

Fixed viewport (`--viewport WxH`, default `1280x900`) and device scale factor 1,
transitions/animations disabled, clock pinned to a fixed instant (`--no-freeze-clock` to
turn that off), theme forced via `prefers-color-scheme` emulation rather than inherited
from the host. Add fixture data before capturing if a screen needs to look populated
rather than empty — this scaffold does not seed any.

## Extending

- New screen: add `{ name, path }` to `SCREENS` in `capture.mjs` — `path` matches the
  client route in `web/frontend/src/routes.js`.
- New state (a modal, an error, a populated list): open it via the same click/type path a
  user would use right before calling `page.screenshot`, per `claude-kit`'s
  `screenshot-runner` agent — don't construct it directly.
