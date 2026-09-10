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
  <a href="https://aaronified.github.io/tippani/ui-glossary.html"><img alt="UI glossary" src="https://img.shields.io/badge/glossary-every%20control-B4482D"></a>
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
  alternatives considered and the trade-offs behind it<br>
  🔤 <a href="https://aaronified.github.io/tippani/ui-glossary.html"><strong>UI glossary</strong></a> — every control in
  the interface, named and pressable, generated from the source rather than drawn by hand
</p>

---

Built for a low-powered NAS that already runs a hundred other things: **one static Go binary** (~12 MB),
SQLite with FTS5, **~25 MB idle RSS**, and **zero background jobs** — no pollers, timers or cron. It speaks
plain HTTP on port 8080 for your LAN and takes TLS whichever way you already have it: a reverse proxy,
Tailscale, or a PEM pair it serves and hot-reloads itself. No Node at runtime; metadata lookups are on-demand
and optional; covers and posters are served from your own disk. Tippani was **written with AI assistance** and
**contains no AI** — no model calls, nothing sent anywhere. Both halves are set out in [`AI.md`](AI.md).

## Screenshots

<!-- Six real screenshots, one strip wider than the page so GitHub gives it a horizontal
     scroll. Purely visual now — what each screen does is explained under Features below. -->
<table>
  <tr>
    <td><img src="docs/img/library-paper-light.jpg" width="440" alt="The Library — paper skin, light theme: a grid of real book covers with genre filters and a colour bar under each cover"></td>
    <td><img src="docs/img/catalogue-film-dark.jpg" width="440" alt="The Catalogue — film skin, dark theme: a grid of film and show posters with dialogue counts"></td>
    <td><img src="docs/img/search-film-light.jpg" width="440" alt="Search — film skin, light theme: a misspelled query corrected automatically, with results in sections across books and highlights"></td>
    <td><img src="docs/img/import-paper-dark.jpg" width="440" alt="Import — paper skin, dark theme: cards for Markdown, Bookcision, Hardcover, Goodreads, IMDb and Kindle imports"></td>
    <td><img src="docs/img/quotes-mobile-paper-light.jpg" width="215" alt="Quotes on a phone — paper skin, light theme: standalone quotes in Bengali, Hindi and English, each with its script mark and translation"></td>
    <td><img src="docs/img/home-mobile-film-dark.jpg" width="215" alt="Home on a phone — film skin, dark theme: the Daily Quiz, Practice and the library's counts"></td>
  </tr>
</table>

<p align="center"><sub>Six screens — scroll sideways for the rest. Paper and Film skins, light and dark, four
accents, one combination per shot. Screenshots lag the interface now and then;
<a href="https://aaronified.github.io/tippani/demo/">the demo</a> never does.</sub></p>

## Features

<table>
  <tr>
    <td valign="top" width="33%">📚 <strong>Books, films, shows, games and quotes — one library</strong> — a book highlight keeps its chapter and page, a film or show line its timestamp and episode (<em>S2E6</em>), a game line its act and quest. A standalone quote — a speech, a letter, an essay, a proverb, something a friend said — keeps a speaker, an occasion and its own translation where it needs one.</td>
    <td valign="top" width="33%">📖 <strong>Anthologies</strong> — quotes gathered into a reading order with your own prose between them, drawn from all three kinds at once. Six switches decide what each passage shows, on screen and in the exported Markdown alike.</td>
    <td valign="top" width="33%">📡 <strong>Auto-fetching metadata</strong> — search a title, pick the right match from a short list, and its cover, cast, blurb and details fill in from TMDB, IGDB, Google Books and more, nothing typed by hand. Run it again later on a selection and it fills only what's still empty; <em>Re-verify</em> shows every difference and waits for your tick.</td>
  </tr>
  <tr>
    <td valign="top">🔎 <strong>Find it instantly</strong> — full-text search across titles, people, quotes, notes, tags and dialogue, returned in sections by what matched, typo-tolerant. Type <code>tag:</code>, <code>author:</code>, <code>colour:</code> or any of sixteen fields and your own library's words drop down as chips.</td>
    <td valign="top">📥 <strong>Import, then approve</strong> — Markdown from Tippani or Readest, Kindle three ways (Bookcision, the notebook, <code>My Clippings.txt</code>), saved Goodreads and Hardcover pages, IMDb quote pages. Everything waits in a pending queue where you correct a whole file at once; importing the same file twice adds nothing.</td>
    <td valign="top">📨 <strong>Share a quote as an image</strong> — drawn on your own device in your paper or film theme, with the credited person's portrait as a backdrop, then straight to your phone's share sheet or a download. The same dialog also hands a quote out as Markdown, WhatsApp text, plain text or Reddit.</td>
  </tr>
  <tr>
    <td valign="top">🧠 <strong>Scientific spaced repetition</strong> — every quote carries a memory half-life and returns along the Ebbinghaus forgetting curve, asked one of five ways including a server-graded fill-in-the-blank, in a Daily Quiz and an open Practice mode alike. <a href="docs/spaced-repetition-difficulty.md">The research behind it</a> — which curve, which scheduler, and what was measured before any of it shipped.</td>
    <td valign="top">🌐 <strong>Multilingual by design</strong> — the app holds no source language: English and Bengali both ship in the box, neither a fallback for the other, and a quote can carry its own translation alongside the original script. A third language is one text file dropped in — nothing to rebuild, nothing to restart. <a href="docs/bengali-style.md">The Bengali style sheet</a> is what a fourth would be written against.</td>
    <td valign="top">✨ <strong>And the rest</strong> — <strong>Multi-user</strong> · <strong>Export</strong> · <strong>Encrypted backup</strong> · <strong>Detailed stats</strong></td>
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

**The published images carry built-in TMDB and TheTVDB credentials**, Jellyfin-style, so films and shows look
up with nothing configured; a key you save always wins, and deleting yours falls back to the built-in rather
than to nothing. Both are injected at build time from repository secrets rather than committed, so **a binary
you build yourself has no built-in** — `make build TMDB_TOKEN=… TVDB_TOKEN=…` fills the slots, and without
them film lookup answers `503` until a key is saved. A shipped credential is not a secret one: TMDB's is a v4
**read** token, which cannot write to the account behind it, and both providers rate-limit per client IP, so a
shared credential never pools into one quota.

**TheTVDB's free key needs your PIN.** TheTVDB issues two kinds of v4 key: a paid *project* key logs in with
the key alone, while the free *user-supported* key logs in only with your **subscriber PIN** beside it — and
their dashboard shows such a key as *inactive* until a subscription backs it. Both fields are in Settings →
Metadata sources; without the PIN that kind of key is refused at login and results come from TMDB instead,
which the picker now says out loud.

**Optional: search the web for cover art, posters and portraits.** A
[Programmable Search](https://programmablesearchengine.google.com/) engine id plus a Custom Search API key
turn the *search covers* and *search images* buttons into an in-app picture strip (100 searches a day are
free). Without them, book covers still come from Google Books, Open Library and — keylessly, by ISBN —
Amazon's image CDN, and *search images* opens a web search in a browser tab as it always has.

**Trying an unreleased branch.** A release branch publishes an image named after itself —
`ghcr.io/aaronified/tippani:v3` while v3 is in flight — so it can be pulled on the box it is meant for with no
toolchain there. It moves with every push to that branch and carries unfinished work by definition: point a
**separate** data directory at it (`-v /srv/tippani-v3:/data`) rather than your real library, since a branch
may add migrations a released build will not read back.

| Option | Default | What it does |
| :-- | :-- | :-- |
| **Port** | | |
| `8080` | published as `8080:8080` | Plain HTTP for your LAN. Publish `127.0.0.1:8080:8080` to keep it host-local behind a proxy or VPN. Inside the container the bind is `0.0.0.0:8080`. |
| **Volumes** | | |
| `/data` | named volume `tippani-data` | Everything Tippani owns: `tippani.db` (SQLite), `MediaCover/` (covers and posters), `Locales/` (translations and their template), the backup archive. Bind-mount any folder you already back up — it must be writable by uid 65532, which the image runs as. |
| `/certs` (any path, `:ro`) | *not mounted* | A PEM certificate (full chain) and key, named by the two `TLS` variables. Tippani then **serves HTTPS itself**: the pair re-loads on the next handshake after a renewal (a botched write keeps the old pair and logs `TIP-HTTP-001`), secure cookies are implied, and the healthcheck adapts. Worth doing on a LAN: a certificate your devices trust is what lights up the padlock, PWA install and the clipboard APIs — from a home CA, `tailscale cert`, or a wildcard your ACME tooling already renews; self-signed works with the usual warnings. Tippani does not speak ACME itself — a renewal loop is a background job, and there are none. |
| `/var/run/docker.sock` | *not mounted* | Lets Settings → Updates pull the new image and restart the container in one click. It also hands the container control of your Docker host: mount it `:ro`, add `group_add: ["<your docker gid>"]` because the image is non-root (`stat -c %g /var/run/docker.sock` prints the number — 999 on Debian, 998 on Fedora, something else on a NAS), keep the `:ro` on the volume line and nowhere else, and know it only works on a moving tag such as `:latest`. Or use the proxy stack above. |
| **Environment** | | |
| `TIPPANI_BIND` | `127.0.0.1:8080` — image: `0.0.0.0:8080` | Listen address, `host:port`. |
| `TIPPANI_DATA` | `./data` — image: `/data` | Data directory. |
| `TIPPANI_TLS_CERT` / `TIPPANI_TLS_KEY` | *(unset)* | Paths to the PEM certificate and private key — both or neither. See `/certs`. |
| `TIPPANI_COOKIE_SECURE` | `0` | `1` when TLS terminates in a proxy in front. Implied when the TLS pair is set. |
| `TIPPANI_TRUSTED_PROXY` | `0` | `1` to trust `X-Forwarded-For` in the login rate limiter. |
| `TIPPANI_DOCKER_HOST` | *(unset)* | Engine API for updates: `tcp://dockerproxy:2375` for a socket proxy, or `unix:///path`. Wins over the socket path. |
| `TIPPANI_DOCKER_SOCK` | `/var/run/docker.sock` | Where the mounted socket is, if not the default path. |
| `TIPPANI_UPDATER_IMAGE` | `nickfedor/watchtower` | The one-shot image the update runs to recreate the container. Pin a digest if you like. The unmaintained `containrrr/watchtower` will not work: its last release speaks Engine API 1.25 and current daemons refuse anything below 1.40. |
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

<!-- The two marks below are each supplier's OWN file, committed unmodified, because
     each licence asks for the logo rather than for a mention. TMDB publishes five
     approved SVGs at themoviedb.org/about/logos-attribution; this is "primary short".
     TheTVDB publishes two at thetvdb.com/api-information (Attribution), one for a dark
     ground and one for a light one — hence the <picture>, so the README reads in both
     of GitHub's themes. Their wording is theirs verbatim, and their link goes where
     their own sample sends it. Nobody else here requires a mark, and three of them
     would be wrong to carry one: see the note below. -->

<table>
  <tr>
    <td width="230" align="center">
      <a href="https://www.themoviedb.org/"><img src="docs/img/providers/tmdb.svg" width="190" alt="TMDB"></a>
    </td>
    <td><sub>Film, show and game metadata, posters and cast. <b>This product uses the TMDB API but is not
    endorsed or certified by TMDB.</b></sub></td>
  </tr>
  <tr>
    <td width="230" align="center">
      <a href="https://thetvdb.com/subscribe"><picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/img/providers/thetvdb-dark.png">
        <img src="docs/img/providers/thetvdb-light.png" width="150" alt="TheTVDB">
      </picture></a>
    </td>
    <td><sub><b>Metadata provided by TheTVDB. Please consider adding missing information or
    subscribing.</b> Show and film records, episode data, and the per-character images no other
    source has.</sub></td>
  </tr>
</table>

Book metadata comes from [Google Books](https://books.google.com/) and
[Open Library](https://openlibrary.org/); book covers and author images from
[Amazon](https://www.amazon.com/). Author and actor reference links resolve through Open Library,
TMDB and [Wikidata](https://www.wikidata.org/) (for the Wikipedia hop), and link out to IMDb, TMDB,
TheTVDB, Wikipedia and Open Library. [IMDb](https://www.imdb.com/) pages are also read, on request,
for a game's cast and for quote-page imports.

**Why only two logos.** A mark is a claim, so it goes only where the supplier's own terms ask for
one. TMDB and TheTVDB do. Open Library and Wikidata publish open data and ask for a credit, not a
badge. Amazon's image CDN and IMDb's pages are read without any agreement that would license their
marks, and a logo there would suggest a partnership that does not exist — the plain sentences above
say what is actually read, which is the honest version. Every logo here is the supplier's own file,
committed unchanged, and none is recoloured, cropped or redrawn. The small monochrome
glyphs *inside* the app are a different object doing a different job — a source indicator
in the app's own ink, not an attribution mark — and their origins and licences are set out
in [`docs/PROVIDER-MARKS.md`](docs/PROVIDER-MARKS.md).

Standing on the shoulders of:

- **[pretext](https://github.com/chenglou/pretext)** — the text-reflow calculation that lets a quote wrap
  naturally around a pinned sticker.
- **[Phosphor Icons](https://github.com/phosphor-icons/core)** — the **MIT**-licensed fill weight behind the
  solid glyphs: the nav rail, the favourite, the three shelf marks in their ON state, the practise mortarboard
  and the colour palette. Everything else is drawn by hand in `ui.jsx`, and a fill has to argue its way in —
  see the *Icons* section of [the UI glossary](https://aaronified.github.io/tippani/ui-glossary.html).
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
