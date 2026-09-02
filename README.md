<p align="center">
  <!-- The app's own mark, from web/frontend/public/ rather than a copy under docs/img:
       the favicon, the installed app's icon and this are one drawing, and a second
       copy is a drawing that goes stale the next time the first one changes. The two
       files differ only in the terracotta — #B4482D on paper, #D8613D on dark. -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/frontend/public/mark-dark.svg">
    <img src="web/frontend/public/mark.svg" alt="" width="104" height="104">
  </picture>
</p>

<h1 align="center">Tippani</h1>

<p align="center"><em>ṭippaṇī · टिप्पणी · টিপ্পনী — a marginal annotation</em></p>

<p align="center">
  A self-hosted, multi-user home for your <strong>book highlights</strong>, <strong>film dialogue</strong> and
  <strong>quotes from anywhere else</strong>.<br>
  Capture or bulk-import them, tag · colour · favourite them, fetch covers and metadata, search everything
  instantly,<br>remember them with a daily quiz, and export it all back out as Obsidian-friendly Markdown.
</p>

<p align="center">
  <a href="https://github.com/aaronified/tippani/releases"><img alt="Release" src="https://img.shields.io/github/v/release/aaronified/tippani?sort=semver&color=blue"></a>
  <a href="https://aaronified.github.io/tippani/roadmap.html"><img alt="Roadmap" src="https://img.shields.io/badge/roadmap-what's%20next-B4482D"></a>
  <a href="go.mod"><img alt="Go" src="https://img.shields.io/github/go-mod/go-version/aaronified/tippani"></a>
  <a href="https://github.com/aaronified/tippani/pkgs/container/tippani"><img alt="Container" src="https://img.shields.io/badge/ghcr.io-aaronified%2Ftippani-2496ED?logo=docker&logoColor=white"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-amd64%20%C2%B7%20arm64%20(untested)-informational">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/aaronified/tippani?color=blue&cacheSeconds=86400"></a>
</p>

<p align="center">
  🎭 <a href="https://aaronified.github.io/tippani/demo/"><strong>Interactive demo</strong></a> — the real interface on
  dummy data, writes disabled, rebuilt whenever the UI changes<br>
  🗺 <a href="https://aaronified.github.io/tippani/roadmap.html"><strong>Roadmap</strong></a> — everything ahead in
  priority order, the known bugs, and what is
  <a href="https://aaronified.github.io/tippani/roadmap.html#aside">set aside on purpose</a>;
  <a href="https://github.com/aaronified/tippani/issues/new?template=feature_request.yml">request a feature</a> ·
  <a href="https://github.com/aaronified/tippani/issues/new?template=bug_report.yml">report a bug</a><br>
  📓 <a href="docs/PLAN.md"><strong>Design log</strong></a> — how it is built and why: one entry per decision, with the
  alternatives considered and the trade-offs behind it
</p>

---

Built for a low-powered NAS that already runs a hundred other things: **one static Go binary** (~12 MB),
SQLite with FTS5, **~25 MB idle RSS**, and **zero background jobs** — no pollers, timers or cron. It speaks
plain HTTP on port 8080 for your LAN and takes TLS whichever way you already have it: a reverse proxy,
Tailscale, or a PEM pair it serves and hot-reloads itself. No Node at runtime; metadata lookups are on-demand
and optional; covers and posters are served from your own disk. Tippani was **written with AI assistance** and
**contains no AI** — no model calls, nothing sent anywhere. Both halves are set out in [`AI.md`](AI.md).

## What it does

<!-- The carousel. One strip of cards wider than the page, so GitHub gives it a horizontal scroll: each card is
     one thing a reader does with the app, with the screen that does it. Real screenshots, one skin/theme/accent
     combination per shot. -->
<table>
  <tr>
    <td valign="top" width="440">
      <img src="docs/img/library-paper-light.jpg" width="440" alt="The Library — paper skin, light theme: a grid of real book covers with genre filters and a colour bar under each cover">
      <br><br><strong>📚 Keep your book highlights</strong><br>
      <sub>Six colour categories you name, tags, chapter and page, a ♥, series. Browse as masonry, list or a
      sortable table; group by series, author, decade or genre; shelve as reading · paused · abandoned ·
      finished.</sub>
    </td>
    <td valign="top" width="440">
      <img src="docs/img/catalogue-film-dark.jpg" width="440" alt="The Catalogue — film skin, dark theme: a grid of film and show posters with dialogue counts">
      <br><br><strong>🎬 Films, shows and games too</strong><br>
      <sub>A line with its timestamp, character and auto-filled actor. A show's lines carry the episode and
      read as <em>S2E6</em>; a game's carry the act and the quest. Posters, details and the cast come from TMDB,
      TheTVDB and IMDb; characters get pictures of their own.</sub>
    </td>
    <td valign="top" width="440">
      <img src="docs/img/quotes-mobile-paper-light.jpg" width="215" alt="Quotes on a phone — paper skin, light theme: standalone quotes in Bengali, Hindi and English, each with its script mark and translation"> <img src="docs/img/home-mobile-film-dark.jpg" width="215" alt="Home on a phone — film skin, dark theme: the Daily Quiz, Practice and the library's counts">
      <br><br><strong>💬 Quotes from anywhere else</strong> · <strong>🧠 Remember what you kept</strong><br>
      <sub>Speeches, letters, essays, proverbs, something a friend said — on boards you make; a proverb board
      asks which languages it holds and puts the translation first. Then a daily quiz and a practice mode:
      spaced repetition along the forgetting curve, five question types including a server-graded
      fill-in-the-blank, and a skip for the shopping list you saved as a quote.</sub>
    </td>
    <td valign="top" width="440">
      <img src="docs/img/search-film-light.jpg" width="440" alt="Search — film skin, light theme: a misspelled query corrected automatically, with results in sections across books and highlights">
      <br><br><strong>🔎 Find it instantly</strong><br>
      <sub>Full-text across titles, people, quotes, notes, tags and dialogue, returned in sections by what
      matched, typo-tolerant. Type <code>tag:</code>, <code>author:</code>, <code>colour:</code> or any of
      sixteen fields and your own library's words drop down as chips.</sub>
    </td>
    <td valign="top" width="440">
      <img src="docs/img/import-paper-dark.jpg" width="440" alt="Import — paper skin, dark theme: cards for Markdown, Bookcision, Hardcover, Goodreads, IMDb and Kindle imports">
      <br><br><strong>📥 Import, then approve</strong><br>
      <sub>Markdown from Tippani or Readest, Kindle three ways (Bookcision, the notebook, <code>My
      Clippings.txt</code>), saved Goodreads and Hardcover pages, IMDb quote pages. Everything waits in a
      pending queue where you correct a whole file at once; importing the same file twice adds nothing.</sub>
    </td>
  </tr>
</table>

<p align="center"><sub>Five cards — scroll sideways for the rest. Paper and Film skins, light and dark, four accents, one
combination per shot. Screenshots lag the interface now and then; <a href="https://aaronified.github.io/tippani/demo/">the
demo</a> never does.</sub></p>

### And the rest

<table>
  <tr>
    <td valign="top" width="33%">📖 <strong>Anthologies</strong> — quotes in a reading order with your own prose between them, drawn from all three kinds at once. Six switches decide what each passage shows, on screen and in the Markdown alike.</td>
    <td valign="top" width="33%">🎨 <strong>Colour categories</strong> — a tag says what a quote is <em>about</em>, its colour says what <em>kind</em> of note it is. Rename one and every label in the app follows; your exports do not change.</td>
    <td valign="top" width="33%">🔖 <strong>A read log</strong> — progress as a page, a percentage or a season and episode; every reread its own dated entry; and a sort by when you last had the thing in your hands.</td>
  </tr>
  <tr>
    <td valign="top">🎲 <strong>Shuffle and on this day</strong> — one quote at random from anywhere in your library, and whatever you saved on this date in earlier years. Neither touches your review schedule.</td>
    <td valign="top">📊 <strong>Stats</strong> — a capture calendar, a memory breakdown, a decade timeline and superlatives, each of them a doorway straight through to the quotes behind it.</td>
    <td valign="top">🧭 <strong>Search that knows where you are</strong> — from a filtered shelf it arrives filtered; from a book's own page it is scoped to that book. Every chip is removable, so narrowing costs nothing.</td>
  </tr>
  <tr>
    <td valign="top">☑️ <strong>Multiselect on everything</strong> — tick a card's corner, Ctrl-click, or hold on a phone, then set the colour, ♥, tags, a sticker, a shelf, a board or any one field across the whole selection.</td>
    <td valign="top">🩹 <strong>Fill only the gaps</strong> — fetch metadata for a selection and write nothing but the empty fields, so a description you wrote is never overwritten. <em>Re-verify</em> shows every difference and waits for your tick.</td>
    <td valign="top">👤 <strong>People, characters included</strong> — authors, actors, directors, translators, speakers and the characters themselves are real records with a portrait, a bio and a page of their own; one person can be an author here and a translator there.</td>
  </tr>
  <tr>
    <td valign="top">📨 <strong>Share a quote</strong> — as Markdown, WhatsApp, plain text or Reddit, or as an image drawn on your own machine in your theme, with the credited person's portrait as a backdrop.</td>
    <td valign="top">📤 <strong>Export</strong> — one work, a filtered set, your standalone quotes or the whole library, as Obsidian-friendly Markdown that imports cleanly back in.</td>
    <td valign="top">🏷️ <strong>Stickers</strong> — a heart, a star and three faces to start with; upload a transparent PNG or SVG and pin it to a quote so the text flows around it.</td>
  </tr>
  <tr>
    <td valign="top">🧹 <strong>Stray marks</strong> — footnote numbers, pronunciation glosses, double spaces and invisible characters your quotes picked up on the way in, listed with the fix offered and your refusals remembered.</td>
    <td valign="top">🗑️ <strong>A bin, not a delete</strong> — everything comes back with its tags, colours, review history and cover intact. Keep things for 7, 30 or 90 days, or for ever.</td>
    <td valign="top">🌐 <strong>English and Bengali</strong> — both ship in the box and neither is a fallback for the other. Any further language is one text file you drop in, without rebuilding anything.</td>
  </tr>
  <tr>
    <td valign="top">🔤 <strong>Type, your way</strong> — six roles, each face previewed doing its own job, two alternates each and your own uploads accepted; bold, italic, small caps and tabular figures per role; text size on a dial.</td>
    <td valign="top">🎞 <strong>Two skins made of something</strong> — Paper is a note lifted off a desk, Film a frame on a light table, with real texture in every card, button and bar. Ask your system for more contrast and the texture drops away.</td>
    <td valign="top">📱 <strong>Phone-first</strong> — an installable PWA with a drawer, capture one ❝ tap away, full-screen filter sheets, 44 px targets, an icon badge for due cards and waiting imports, and files that open straight into import.</td>
  </tr>
  <tr>
    <td valign="top">👌 <strong>A long press that knows what it is on</strong> — hold a control for its label, hold a card to select it, and hold the <em>words</em> of a quote for nothing at all, because that is how your phone selects text.</td>
    <td valign="top">⌨️ <strong>Keyboard shortcuts</strong> — printed on the buttons that share their job, so nothing has to be memorised; <code>?</code> lists them all, and typing is never a shortcut.</td>
    <td valign="top">🎓 <strong>A guided tour</strong> — a walk through every feature on first run, on its own sample content rather than your library, resumable from Settings wherever you stopped.</td>
  </tr>
  <tr>
    <td valign="top">🔐 <strong>Multi-user</strong> — a fully isolated library per person, a profile behind the avatar for photo, name, password and account switching. Admins hand over admin, and step down.</td>
    <td valign="top">📲 <strong>Paired devices</strong> — a one-time pairing code that a native client swaps for a long-lived token, so a phone never holds your password. Changing your password signs out browsers and leaves paired phones alone.</td>
    <td valign="top">🔗 <strong>Real URLs</strong> — every tab and detail view has its own address, so back and forward work and a link opens straight onto the view.</td>
  </tr>
  <tr>
    <td valign="top">🔄 <strong>Updates when you ask</strong> — Settings checks GitHub for a newer release on demand, never on its own. With the Docker socket, one click pulls and restarts; without it, you get the exact command to run.</td>
    <td valign="top">💾 <strong>Encrypted backup and restore</strong> — one click builds a dated AES-256-GCM archive of the whole data directory; restore it here or on another Tippani, and a password change never orphans an archive this server made.</td>
    <td valign="top">🗣 <strong>Quotes carry their own facts</strong> — a speaker, an occasion, a date that may be only a year, and per kind: who a letter was written to, which essay a line is from, a proverb's region and its translation.</td>
  </tr>
</table>

> **Ahead:** an Android app that photographs a page and turns it into a highlight with OCR on the device; more
> ways in — Kobo, Apple Books and Readwise imports, a PWA share-target, a bookmarklet; collections and tag
> shelves; passkeys, 2FA and API tokens; an EPUB anthology export; a [Homepage](https://gethomepage.dev) widget;
> opt-in AI summaries; and quiet, opt-in achievements.
> **[The roadmap](https://aaronified.github.io/tippani/roadmap.html)** has all of it, in priority order.

## Quick start

**One command:**

```sh
docker run -d --name tippani --restart unless-stopped -p 8080:8080 -v tippani-data:/data ghcr.io/aaronified/tippani:latest
```

**Compose** — the repo's [`docker-compose.yml`](docker-compose.yml), minus its comments:

```yaml
services:
  tippani:
    image: ghcr.io/aaronified/tippani:latest
    container_name: tippani
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - tippani-data:/data

volumes:
  tippani-data:
```

```sh
docker compose up -d
```

<sub>The image is multi-arch: <code>linux/amd64</code> is the tested platform; <code>linux/arm64</code> is published
and <strong>untested</strong> — the binary is pure Go and the page is byte-identical, so try it and report back.</sub>

Open `http://<host>:8080` and **create the admin account**. Onboarding is unauthenticated until the first
user exists — whoever reaches the port first claims admin — so do it right away (the Port row below says how
to keep it host-local meanwhile). The admin adds everyone else from **Settings → Users**.

**Compose, with one-click updates through a socket proxy** — keeps the Docker socket out of Tippani's
container (admin-only, Settings → Updates):

```yaml
services:
  dockerproxy:
    image: tecnativa/docker-socket-proxy
    restart: unless-stopped
    environment:
      CONTAINERS: 1   # inspect self, create/start the one-shot updater
      IMAGES: 1       # pull the new image
      POST: 1         # the create/start/pull calls above are POSTs
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [tippani-internal]

  tippani:
    image: ghcr.io/aaronified/tippani:latest
    container_name: tippani
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - tippani-data:/data
    environment:
      TIPPANI_DOCKER_HOST: tcp://dockerproxy:2375
    networks: [default, tippani-internal]

networks:
  tippani-internal:
    internal: true    # the proxy is reachable only from inside the stack

volumes:
  tippani-data:
```

> [!WARNING]
> **What the proxy buys, honestly.** An update must be allowed to *create and start containers*, and that
> permission is host-root-equivalent in the wrong hands. The proxy still helps — no socket file in the app
> container, the exec/volumes/secrets/swarm endpoints stay blocked, the API is reachable only inside the
> stack — but it is a hardened version of the same opt-in trade-off as the socket mount, not a removal of it.

### Configuration

Everything the container and the binary accept. Metadata API keys — TMDB, TheTVDB, Google Books — are set
**in the app** under Settings → Metadata sources, not here: a TMDB v3 key or v4 read token from
[themoviedb.org](https://www.themoviedb.org/settings/api) covers most catalogues, and everything else works
with no key at all.

| Option | Default | What it does |
| :-- | :-- | :-- |
| **Port** | | |
| `8080` | published as `8080:8080` | Plain HTTP for your LAN. Publish `127.0.0.1:8080:8080` to keep it host-local behind a proxy or VPN. Inside the container the bind is `0.0.0.0:8080`. |
| **Volumes** | | |
| `/data` | named volume `tippani-data` | Everything Tippani owns: `tippani.db` (SQLite), `MediaCover/` (covers and posters), `Locales/` (translations and their template), the backup archive. Bind-mount any folder you already back up — it must be writable by uid 65532, which the image runs as. |
| `/certs` (any path, `:ro`) | *not mounted* | A PEM certificate (full chain) and key, named by the two `TLS` variables. Tippani then **serves HTTPS itself**: the pair re-loads on the next handshake after a renewal (a botched write keeps the old pair and logs `TIP-HTTP-001`), secure cookies are implied, and the healthcheck adapts. Worth doing on a LAN: a certificate your devices trust is what lights up the padlock, PWA install and the clipboard APIs — from a home CA, `tailscale cert`, or a wildcard your ACME tooling already renews; self-signed works with the usual warnings. Tippani does not speak ACME itself — a renewal loop is a background job, and there are none. |
| `/var/run/docker.sock` | *not mounted* | Lets Settings → Updates pull the new image and restart the container in one click. It also hands the container control of your Docker host: mount it `:ro`, add `group_add: ["<your docker gid>"]` because the image is non-root, and know it only works on a moving tag such as `:latest`. Or use the proxy stack above. |
| **Environment** | | |
| `TIPPANI_BIND` | `127.0.0.1:8080` — image: `0.0.0.0:8080` | Listen address, `host:port`. |
| `TIPPANI_DATA` | `./data` — image: `/data` | Data directory. |
| `TIPPANI_TLS_CERT` / `TIPPANI_TLS_KEY` | *(unset)* | Paths to the PEM certificate and private key — both or neither. See `/certs`. |
| `TIPPANI_COOKIE_SECURE` | `0` | `1` when TLS terminates in a proxy in front. Implied when the TLS pair is set. |
| `TIPPANI_TRUSTED_PROXY` | `0` | `1` to trust `X-Forwarded-For` in the login rate limiter. |
| `TIPPANI_DOCKER_HOST` | *(unset)* | Engine API for updates: `tcp://dockerproxy:2375` for a socket proxy, or `unix:///path`. Wins over the socket path. |
| `TIPPANI_DOCKER_SOCK` | `/var/run/docker.sock` | Where the mounted socket is, if not the default path. |
| `TIPPANI_UPDATER_IMAGE` | `containrrr/watchtower` | The one-shot image the update runs to recreate the container. Pin a digest if you like. |
| `TIPPANI_LOG_LEVEL` | `info` | `debug` for per-operation `[trace]` lines. Every logged `TIP-*` code has a row in [`docs/troubleshoot.md`](docs/troubleshoot.md). |
| `GOMAXPROCS` · `GOMEMLIMIT` · `GOGC` | Go's defaults | Runtime caps for a busy NAS. The systemd unit ships `1` · `64MiB` · `200`; the reasoning is in the design log. |
| **Commands** — `docker exec -i tippani /tippani …`, or the binary | | |
| `serve` | the default | Start the server. |
| `user add <name>` | | Create a user, password read from stdin — the CLI way to bootstrap an empty instance. |
| `user passwd <name>` | | Reset a password, read from stdin. |
| `user del <name>` | | Delete a user and everything in their library. |
| `healthcheck` | | Probe `/healthz` on the configured port and exit 0 when healthy. The image runs it every 30 s. |
| `version` | | Print the build version. |

> [!CAUTION]
> **Amazon cookie — optional, at your own risk.** Under Settings → Amazon (advanced) an admin may paste an
> Amazon session cookie to enrich book metadata (description and genres) by scraping the product page. It is
> off by default; covers and Kindle import work without it. The cookie is stored write-only and never shown
> back, but it grants access to your Amazon account, and automated scraping is against Amazon's Conditions of
> Use — only you can decide to enable it. Tippani never ships, shares or centralises it.

**A plain-file backup too.** Beside the in-app archive, `sqlite3 tippani.db "VACUUM INTO 'backup.db'"` from
cron, off-peak, gives you a database file you can inspect — run it on the host against the `/data` mount, since
the image is distroless and carries no `sqlite3`.

### Without Docker

Go 1.26+ builds it; Node is only needed to rebuild the frontend, and only on your dev machine.

```sh
make build                                                        # -> bin/tippani, static, CGO_ENABLED=0
./bin/tippani serve                                               # http://127.0.0.1:8080, then onboard in the browser
printf '%s\n' 'a-long-password' | ./bin/tippani user add alice   # or bootstrap the admin from the CLI
```

[`deploy/tippani.service`](deploy/tippani.service) is a hardened non-root systemd unit with the runtime caps
above, and [`deploy/Caddyfile.example`](deploy/Caddyfile.example) puts TLS and basic auth in front of it.
Building, changing and forking — the map of the tree, the pull-request conventions, renaming the module — is
[`DEVELOPMENT.md`](DEVELOPMENT.md); release history is [`CHANGELOG.md`](CHANGELOG.md).

## Attribution

Book metadata comes from [Google Books](https://books.google.com/) and
[Open Library](https://openlibrary.org/); book covers and author images from
[Amazon](https://www.amazon.com/). All film and show metadata and posters come from the
[TMDB](https://www.themoviedb.org/) and [TheTVDB](https://thetvdb.com/) APIs — this product uses the
TMDB and TheTVDB APIs but is not endorsed or certified by either. Author and actor reference links resolve
through Open Library, TMDB and [Wikidata](https://www.wikidata.org/) (for the Wikipedia hop), and link out
to IMDb, TMDB, TheTVDB, Wikipedia and Open Library. [IMDb](https://www.imdb.com/) pages are also read, on
request, for a game's cast and for quote-page imports.

Standing on the shoulders of:

- **[pretext](https://github.com/chenglou/pretext)** — the text-reflow calculation that lets a quote wrap
  naturally around a pinned sticker.
- **[CC0 Textures](https://cc0-textures.com/)** — the public-domain texture packs behind the paper · wood ·
  metal · glass surfaces of the two skins.
- **[Bookcision](https://bookcision.readwise.io/)** and **[Readest](https://github.com/readest/readest)** —
  their highlight and Markdown exports are read directly as import sources; thanks to both for making Kindle
  and cross-device highlights portable.
- **[Fontsource](https://fontsource.org/)**, and the type designers behind the eighteen families that ship in
  the build — Newsreader, Source Serif 4, Literata, Hanken Grotesk, Inter, Public Sans, IBM Plex Mono,
  JetBrains Mono, Source Code Pro, Caveat, Kalam, Gloria Hallelujah, Noto Serif Bengali, Hind Siliguri, Tiro
  Bangla, Noto Serif Devanagari, Hind and Tiro Devanagari Hindi. Every one is under the **SIL Open Font
  License 1.1**, and every one is bundled rather than fetched.

## License

MIT — see [`LICENSE`](LICENSE).
