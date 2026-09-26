<p align="center">
  <!-- The app's own mark, from web/frontend/public/ rather than a copy under docs/img,
       so the favicon, the installed app's icon and this stay one drawing. -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/frontend/public/mark-dark.svg">
    <img src="web/frontend/public/mark.svg" alt="" width="104" height="104">
  </picture>
</p>

<h1 align="center">Tippani</h1>

<p align="center"><em>ṭippaṇī · टिप्पणी · টিপ্পনী — a note in the margin</em></p>

<p align="center">
  Your book highlights, film lines and favourite quotes, in one place you host yourself.<br>
  Keep them, find them in a second, and actually remember them.
</p>

<p align="center">
  <a href="https://github.com/aaronified/tippani/releases"><img alt="Release" src="https://img.shields.io/github/v/release/aaronified/tippani?sort=semver&color=blue"></a>
  <a href="https://github.com/aaronified/tippani/pkgs/container/tippani"><img alt="Container" src="https://img.shields.io/badge/ghcr.io-aaronified%2Ftippani-2496ED?logo=docker&logoColor=white"></a>
  <a href="go.mod"><img alt="Go" src="https://img.shields.io/github/go-mod/go-version/aaronified/tippani"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/aaronified/tippani?color=blue&cacheSeconds=86400"></a>
</p>

<p align="center">
  <a href="https://aaronified.github.io/tippani/demo/"><strong>Try the demo</strong></a> ·
  <a href="https://aaronified.github.io/tippani/roadmap.html">Roadmap</a> ·
  <a href="https://github.com/aaronified/tippani/wiki/Design-decisions">Design log</a> ·
  <a href="https://aaronified.github.io/tippani/ui-glossary.html">UI glossary</a>
</p>

---

<table>
  <tr>
    <td><img src="docs/img/library-paper-light.jpg" width="440" alt="The Library: a grid of book covers with genre filters"></td>
    <td><img src="docs/img/catalogue-film-dark.jpg" width="440" alt="The Catalogue in the dark film theme: film and show posters"></td>
    <td><img src="docs/img/search-film-light.jpg" width="440" alt="Search correcting a misspelled query, with results across books and highlights"></td>
    <td><img src="docs/img/import-paper-dark.jpg" width="440" alt="Import: Markdown, Bookcision, Hardcover, Goodreads, IMDb and Kindle"></td>
    <td><img src="docs/img/quotes-mobile-paper-light.jpg" width="215" alt="Quotes on a phone in Bengali, Hindi and English, with translations"></td>
    <td><img src="docs/img/home-mobile-film-dark.jpg" width="215" alt="Home on a phone: the Daily Quiz and Practice"></td>
  </tr>
</table>

<p align="center"><sub>The <a href="https://aaronified.github.io/tippani/demo/">demo</a> is always the latest interface.</sub></p>

## What it does

**🧠 It helps you remember.** A short Daily Quiz brings quotes back just before you would forget them,
using a real spaced-repetition model. Five kinds of question, including fill-in-the-blank, and a Practice
mode whenever you want more. [How it works](https://github.com/aaronified/tippani/wiki/Spaced-repetition).

**📚 One library for everything you read and watch.** Books keep their chapter and page. Films and shows keep
their timestamp and episode. Games keep their act and quest. A quote from anywhere else (a speech, a letter,
something a friend said) keeps its speaker and, if you want, its translation.

**📡 Covers and details fill themselves in.** Type a title, pick the right match, and the cover, cast and blurb
arrive from TMDB, IGDB, Google Books and others. Nothing to type by hand.

**🔎 Find anything instantly.** Search every title, person, quote, note and tag at once. It forgives typos, and
typing `author:`, `tag:` or `colour:` suggests words from your own library.

**📖 Anthologies.** Gather quotes into your own reading order, write between them, and export the result as
Markdown or EPUB.

**📨 Share a quote as a picture.** Tippani draws a quote card on your device, in your theme, with the speaker's
portrait behind it, and sends it to your phone's share sheet. Plain text, Markdown, WhatsApp and Reddit formats too.

**📥 Bring your highlights with you.** Kindle (Bookcision, the notebook, or `My Clippings.txt`), Readest and
Tippani Markdown, saved Goodreads and Hardcover pages, IMDb quote pages. Imports wait for your approval, and the
same file never adds anything twice.

**🌐 Any language.** English and Bengali ship in the box, and a quote keeps its own script and translation. Adding
another interface language is one text file, with no rebuild.

**And also:** several accounts on one server, sign-in through your own identity provider (Authelia, Authentik,
Keycloak…), Pushover notifications, a [gethomepage](https://gethomepage.dev) widget, detailed stats, full
export, and encrypted backups.

## Light on your server

- One ~12 MB binary with the interface built in. No Node, no separate database server.
- About 25 MB of memory when idle, and nothing running in the background.
- Covers are stored on your own disk. Metadata lookups are optional, and nothing is fetched on a timer.
- `TIPPANI_OFFLINE=1` stops every outside connection.
- Tippani was written with AI assistance and contains no AI: no model calls, nothing sent anywhere.
  [How this was written](https://github.com/aaronified/tippani/wiki/How-this-was-written).

## Quick start

```sh
docker run -d --name tippani --restart unless-stopped -p 8080:8080 -v tippani-data:/data ghcr.io/aaronified/tippani:latest
```

Or with Compose:

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

Open `http://<host>:8080` and **create your admin account straight away**: until the first account exists,
whoever reaches the page first becomes admin. The admin adds everyone else from Profile.

The image runs on `linux/amd64` (tested) and `linux/arm64` (published, not yet tested).

## Configuration

Metadata keys (TMDB, TheTVDB, Google Books) are set **in the app**, under Metadata › Sources. The published
images include built-in TMDB and TheTVDB credentials, so films and shows work with nothing configured; a key you
save always wins. A binary you build yourself has no built-in key until you pass
`make build TMDB_TOKEN=… TVDB_TOKEN=…`.

| Setting | Default | What it does |
| :-- | :-- | :-- |
| `/data` volume | `tippani-data` | Everything Tippani keeps: the database, covers, translations and backups. Must be writable by uid 65532. |
| `TIPPANI_BIND` | `0.0.0.0:8080` in the image | Listen address. Publish `127.0.0.1:8080:8080` to keep it local behind a proxy or VPN. |
| `TIPPANI_TLS_CERT` / `TIPPANI_TLS_KEY` | unset | A PEM certificate and key. Tippani then serves HTTPS itself and picks up renewals automatically. |
| `TIPPANI_COOKIE_SECURE` | `0` | Set `1` when a proxy in front handles HTTPS. |
| `TIPPANI_TRUSTED_PROXY` | `0` | Set `1` to trust `X-Forwarded-*` headers from your proxy. |
| `TIPPANI_OFFLINE` | `0` | Set `1` to block every outside connection. Your library still works. |
| `TIPPANI_OIDC_*` | unset | Single sign-on. See below. |
| `TIPPANI_PUSHOVER_TOKEN` | unset | A shared Pushover app token, so each reader only needs their own user key. |
| `TIPPANI_DOCKER_HOST` | unset | Docker Engine address for one-click updates, e.g. `tcp://dockerproxy:2375`. |
| `TIPPANI_LOG_LEVEL` | `info` | `debug` for detailed logs. Every `TIP-*` code is in [Troubleshooting](https://github.com/aaronified/tippani/wiki/Troubleshooting). |

**Commands** (`docker exec -i tippani /tippani …`): `user add <name>`, `user passwd <name>`, `user del <name>`
(passwords read from stdin), `notify daily`, `healthcheck`, `version`.

<details>
<summary><strong>More settings</strong></summary>

| Setting | Default | What it does |
| :-- | :-- | :-- |
| `TIPPANI_DATA` | `/data` in the image | Data directory. |
| `TIPPANI_DOCKER_SOCK` | `/var/run/docker.sock` | Where a mounted Docker socket is. |
| `TIPPANI_UPDATER_IMAGE` | `nickfedor/watchtower` | The one-shot image an update uses to recreate the container. |
| `TIPPANI_OIDC_REDIRECT_URL` | derived | Set it if your proxy rewrites the host and is not trusted. |
| `TIPPANI_OIDC_SCOPES` | `profile email` | Extra scopes beside `openid`. |
| `GOMAXPROCS` · `GOMEMLIMIT` · `GOGC` | Go defaults | Runtime limits for a busy NAS. |

**TheTVDB's free key needs your subscriber PIN** beside it; both fields are in Metadata › Sources.

**Plain-file backup.** On the host: `sqlite3 tippani.db "VACUUM INTO 'backup.db'"` against the `/data` folder.

</details>

<details>
<summary><strong>One-click updates</strong></summary>

Settings › Server can pull the new image and restart the container. Give it Docker access through a socket proxy
rather than the socket itself:

```yaml
services:
  dockerproxy:
    image: tecnativa/docker-socket-proxy
    restart: unless-stopped
    environment:
      CONTAINERS: 1
      IMAGES: 1
      POST: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [tippani-internal]

  tippani:
    image: ghcr.io/aaronified/tippani:latest
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
    internal: true

volumes:
  tippani-data:
```

Or mount the socket directly: `-v /var/run/docker.sock:/var/run/docker.sock:ro` plus
`group_add: ["<your docker group id>"]` (`stat -c %g /var/run/docker.sock` prints it), since the image does not run as root.
One-click updates only work on a moving tag such as `:latest`.

> [!WARNING]
> Updating means creating and starting containers, which is powerful access to your Docker host. The proxy narrows
> it (no socket in Tippani's container, most endpoints blocked) but does not remove it. Only turn it on if you
> want one-click updates.

</details>

<details>
<summary><strong>Single sign-on (Authelia example)</strong></summary>

Any OpenID Connect provider works: Authelia, Authentik, Keycloak, Pocket ID, Zitadel.

1. **Register Tippani with your provider**, with the redirect URI `https://<your tippani>/api/auth/oidc/callback`,
   PKCE `S256`, and client auth `client_secret_basic`. For Authelia:

   ```yaml
   identity_providers:
     oidc:
       clients:
         - client_id: 'tippani'
           client_name: 'Tippani'
           client_secret: '$pbkdf2-sha512$310000$…'   # the digest, see below
           public: false
           authorization_policy: 'two_factor'
           require_pkce: true
           pkce_challenge_method: 'S256'
           redirect_uris:
             - 'https://tippani.example.com/api/auth/oidc/callback'
           scopes: ['openid', 'profile', 'email']
           response_types: ['code']
           grant_types: ['authorization_code']
           token_endpoint_auth_method: 'client_secret_basic'
   ```

   `authelia crypto hash generate pbkdf2 --variant sha512 --random --random.length 72 --random.charset rfc3986`
   prints a password (for Tippani) and its digest (for `client_secret`).

2. **Point Tippani at it:**

   ```yaml
   environment:
     TIPPANI_OIDC_ISSUER: "https://auth.example.com"
     TIPPANI_OIDC_CLIENT_ID: "tippani"
     TIPPANI_OIDC_CLIENT_SECRET: "<the password from step 1>"
     TIPPANI_OIDC_NAME: "Authelia"
     TIPPANI_COOKIE_SECURE: "1"
     TIPPANI_TRUSTED_PROXY: "1"
   ```

3. **Each reader links their account once:** sign in with your password, open Profile › Single sign-on, and press
   **Link Authelia**. After that, "Sign in with Authelia" works. Your password keeps working too.

Optional: `TIPPANI_OIDC_AUTO_CREATE=1` creates accounts for new identities, and `TIPPANI_OIDC_LINK_USERNAME=1`
links an identity to the account with the same username. Only use the second if people can't choose their own
username at the provider. A failed sign-in logs `TIP-AUTH-001` with the reason.

</details>

<details>
<summary><strong>Pushover notifications</strong></summary>

1. Create an app at [pushover.net/apps/build](https://pushover.net/apps/build) and copy its token. Set it once as
   `TIPPANI_PUSHOVER_TOKEN`, or let each reader paste their own.
2. In Profile › Notifications, paste your Pushover user key, save, and send a test.
3. Choose what reaches you: the daily review, large imports, long metadata fetches, and (for admins) backups.

The daily message needs one line in the host's cron, since Tippani has no timer of its own:

```cron
0 8 * * * docker exec tippani /tippani notify daily
```

</details>

<details>
<summary><strong>Dashboard widget (gethomepage)</strong></summary>

Shows four numbers from your library: works, quotes, forgotten and mastered. In Profile › Dashboard widget press
**Make a key**, then copy the YAML it shows into gethomepage's `services.yaml`. The key is shown once, and it can
only read those four numbers.

```yaml
- Tippani:
    href: https://tippani.example.com
    widget:
      type: customapi
      url: https://tippani.example.com/api/widget
      headers:
        X-API-Key: tpw_…
      mappings:
        - { field: works, label: Works }
        - { field: quotes, label: Quotes }
        - { field: forgot, label: Forgot }
        - { field: mastered, label: Mastered }
```

</details>

<details>
<summary><strong>Without Docker</strong></summary>

Go 1.26+ builds it. Node is only needed to rebuild the interface.

```sh
make build                                                        # -> bin/tippani
./bin/tippani serve                                               # http://127.0.0.1:8080
printf '%s\n' 'a-long-password' | ./bin/tippani user add alice   # or create the admin from the CLI
```

[`deploy/tippani.service`](deploy/tippani.service) is a hardened systemd unit, and
[`deploy/Caddyfile.example`](deploy/Caddyfile.example) puts HTTPS in front. To build, change or fork it, see
[Developing](https://github.com/aaronified/tippani/wiki/Developing). Release history is in [`CHANGELOG.md`](CHANGELOG.md).

</details>

> [!CAUTION]
> **Amazon cookie (optional, at your own risk).** An admin can paste an Amazon session cookie in Metadata ›
> Sources to fetch book descriptions and genres. It is stored write-only, but it gives access to your Amazon
> account, and scraping is against Amazon's terms. Covers and Kindle import work without it.

## Coming next

An Android app that turns a photographed page into a highlight, more imports (Kobo, Apple Books, Readwise),
collections, passkeys and 2FA, and opt-in AI summaries. The [roadmap](https://aaronified.github.io/tippani/roadmap.html)
has the full list in priority order. [Request a feature](https://github.com/aaronified/tippani/issues/new?template=feature_request.yml)
or [report a bug](https://github.com/aaronified/tippani/issues/new?template=bug_report.yml).

## Credits

<!-- Each supplier's own logo file, unmodified, because their terms ask for the logo.
     TheTVDB publishes one for light and one for dark backgrounds, hence the <picture>. -->

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
    subscribing.</b> Show and film records, episode data, and character images.</sub></td>
  </tr>
</table>

Book details come from [Google Books](https://books.google.com/) and [Open Library](https://openlibrary.org/),
book covers and author photos from [Amazon](https://www.amazon.com/), and people's links from
[Wikidata](https://www.wikidata.org/). [IMDb](https://www.imdb.com/) pages are read on request for game casts and
quote imports. Why only two logos: see [Provider marks](https://github.com/aaronified/tippani/wiki/Provider-marks).

Built with [pretext](https://github.com/chenglou/pretext) (text flowing around stickers),
[Phosphor](https://github.com/phosphor-icons/core), [Tabler](https://github.com/tabler/tabler-icons) and
[Atlas](https://atlasicons.vectoricons.net/) icons (MIT), [CC0 Textures](https://cc0-textures.com/),
and eighteen open font families via [Fontsource](https://fontsource.org/) (SIL OFL 1.1), all bundled rather than
fetched. Thanks to [Bookcision](https://bookcision.readwise.io/) and [Readest](https://github.com/readest/readest)
for making highlights portable.

## License

MIT. See [`LICENSE`](LICENSE).
