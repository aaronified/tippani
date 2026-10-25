# Android app (roadmap §20, issue #37)

Source of truth: this wiki page.

Not built. Written against `558059cf` (main, 25 October 2026). The server half exists; the app does not. This plan
adds the app's feature list, what to reuse from Lexodle and Fluenough, the release and signing set-up, and the open
questions. It extends the §20 entry in the [Roadmap](Roadmap.md).

## What the app is

A native Flutter client for Android, in `mobile/`, for one reader's own Tippani server. It is not a wrapper around
the web app. Its first job is the one thing a web page does badly on a phone: photograph a page of a book and turn
a highlighted passage into a quote. It also does the rest of what Tippani does (see feature 5).

Android only. No `ios/` directory ships, because building and signing for iOS needs a Mac. The Dart stays
platform-neutral.

## What the server already gives it

All of this is built (the files are named below):

- **Pairing.** Settings shows a QR code (`POST /auth/devices/pair`, valid 5 minutes, single use). The app scans it and
  claims it (`POST /auth/devices/claim`, rate limited) for a **device token**. Tokens are listed and revoked in
  Settings (`GET/DELETE /auth/devices`). `internal/httpapi/pairing_handlers.go`.
- **Version handshake.** `GET /capabilities` needs no credential and returns an `apiRevision` integer, so the app can
  tell whether it and the server are compatible before it holds a token. `internal/httpapi/capabilities_handler.go`.
- **Offline-friendly writes.** `noted_at` on create keeps a queued capture's real date; a duplicate answers `409` with
  the existing row, so retrying a flush is safe.
- List paging, gzip, and the shared quote shape.

What the server lacks for this plan (small, listed under Tasks): a shared text-cleanup step for captured text, a
photo kept with a quote, and an app-release feed that does not mix with the server's releases.

## Decisions to confirm

1. **Package id.** Suggest `io.github.aaronified.tippani` (Lexodle uses `io.github.aaronified.lexodle`).
2. **A new keystore for this app.** Reusing Lexodle's would tie two apps' security together. The owner supplies it as
   repository secrets (below).
3. **Licence.** The repository's licence applies; Fluenough's app-store exception is not copied unless asked.
4. **"All Tippani functions" is phased**, not one release (feature 5).
5. **The donation disclaimer's wording.** Fluenough has none to copy: a search of its code, docs and UI found no
   donation disclaimer or donation screen. A draft is under feature 3; the owner confirms or replaces it.
6. **Minimum Android version.** Whatever the installed Flutter gives. Wallpaper colours need Android 12; older phones
   get a fixed fallback palette.

## Features

### 1. Capture a page and highlight the passage

The flow: photograph a page, the app recognises the text on the device, the reader selects the passage on the photo,
the app proposes a book, the page and the chapter, the reader corrects anything, and it saves as a quote.

- **On-device OCR** with ML Kit text recognition (`google_mlkit_text_recognition`). No upload and no server cost.
  Neither Lexodle nor Fluenough uses a camera or OCR package; this is new work.
- **Capture:** `camera` or `image_picker`, then crop and straighten.
- **Highlight on the photo:** draw the recognised lines over the photo; the reader drags across them or taps lines to
  select. The selection is the quote text. Each recognised line carries a bounding box, which is also what makes the
  next two steps possible.
- **Page number and chapter from the header and footer, when visible.** The recognised blocks have positions, so:
  the top and bottom bands of the page (about the first and last 8% of its height) are searched; a short line that is
  only digits or a roman numeral is the **page number**; a short centred or running line in the top band that is not
  part of the body is the **chapter or running head**. The app shows what it found, marked as proposed, and the reader
  accepts or edits. If nothing is visible, nothing is proposed. A guess is never silently saved.
- **Clean-up of the recognised text** (rejoin hyphenated line breaks, drop running heads, fix quote marks and
  ligatures) belongs on the **server**, shared with every import source ([Roadmap](Roadmap.md) §7), so the app calls it
  and the cleanup is written once.
- **Saving:** `POST` a quote on the chosen book with `noted_at`, `source`, the page or location, and the chapter. A
  capture made offline queues and flushes when the server is reachable; `409` makes a retry safe.
- **The photo is kept with the quote** (server: one nullable image column on the existing image pipeline), so the
  evidence stays beside the transcription.

### 2. Update check and automatic update

Reuse the design both apps already share: ask the GitHub releases API, compare versions, download the APK with the
`ota_update` plugin into app storage, check its SHA-256 against the asset's `digest`, then Android's installer opens.
Android itself enforces that an upgrade is signed with the same key. See Lexodle `lib/update_check.dart`,
`apk_install_ota.dart`, `update_section.dart` and Fluenough `lib/app/update_checker.dart`,
`lib/core/updates/github_release_check.dart`.

- Take Fluenough's extras: delete the downloaded APK after the update, a 60-second stall check, an "open the download
  page" fallback, and "What's new" read from the release notes.
- Automatic checking is **off by default** (each check is a request to GitHub), as in both apps. Manual check always
  works.
- **The app is released on its own tags.** Tippani's server releases use `vX.Y.Z` and `releases/latest` points at
  them. The app uses tags `app-vX.Y.Z`, and the update check lists releases and picks the newest `app-v*` one, not
  `/latest`.
- The app also reads `GET /capabilities` and says plainly when the server is too old or too new for it.
- Needed on Android: the `ota_update` FileProvider and its paths file, core library desugaring, and removing the
  storage permissions. The owner turns on "Install unknown apps" for the app once.

### 3. Donation

Reuse Lexodle's section (`lib/donate.dart`, `tools/make_donate_qr.py`, `assets/donate/upi-qr.svg`, the `upi`
`<queries>` entry in the manifest): the QR code, a copy-ID button, and a "pay with a UPI app" button that opens the
phone's UPI apps with the payee filled in. It takes `flutter_svg` and `url_launcher`.

- **Payee:** UPI ID `das.arani@pingpay`, name `Arani Das`, currency INR, no amount. Regenerate the QR from the same two
  values (the script draws filled squares; segno's stroked rows showed seams on a phone).
- Replace Lexodle's hard-coded copy and its theme helper; keep the style of the rest of the app.
- **Text above the QR code (draft, for the owner to confirm).** The owner's line first, then the disclaimer:
  "If you want to support development, or just want to buy me a cup of tea, donate."
  "Tippani is free and has no ads. Donating is voluntary, buys nothing and is not refundable. Reporting a bug helps just as
  much."

### 4. Report a bug

Reuse Fluenough's chain (its decision ADR-0021): the bug button opens a form; the form opens the reader's own mail app
with a prefilled mail; an hourly GitHub Actions job reads the inbox over IMAP and opens a GitHub issue. No server of
Tippani's and no token in the app.

- **App:** a report form with kinds Support (private), Bug and Feedback (public issues); a title and details; optional
  device info (app version, Android version, screen size, text scale, theme) with the exact lines shown; optional
  attached log, both off by default. Fluenough: `lib/features/report/report_page.dart`,
  `lib/core/feedback/report.dart`, `lib/app/report_mail.dart`.
- **Workflow (I write it):** `.github/workflows/app-feedback-mail.yml` and `scripts/mail_to_issues.py`, adapted from
  Fluenough's `feedback-mail.yml` and `tools/mail_to_issues.py`: subject prefix `[Tippani app]`; label by kind plus
  `from-app`; Support mail never becomes an issue; the sender's address is never copied; a log is never copied into the
  issue; filed mails are tagged in Gmail, never marked read. With no secrets set, the job does nothing and says so.
  Tests in Python, as Fluenough does.
- **The address is created: `tippanidev@gmail.com`.** It goes into the app as a constant and into the secret
  `FEEDBACK_GMAIL_ADDRESS`. **Still for the owner:** turn on 2-step verification and IMAP for it, make an app password, and
  add the repository secrets `FEEDBACK_GMAIL_ADDRESS` and `FEEDBACK_GMAIL_APP_PASSWORD` before the workflow can run. The
  password is never written in the repository or the app.
- The issue text is public. The form says so.

### 5. All of Tippani's functions

Phased, in this order, each phase a release of the app:

1. **Core:** pair with a server, capture (feature 1), browse the library, quotes and search, the daily quiz, add and
   edit a quote.
2. **Reading side:** work details with source file and context, boards and anthologies, share a quote as a picture.
3. **Management:** metadata and people, Checks (imports, cleanup, found files, corrections, locators), bin, stats.
4. **Settings and admin:** profile, devices, backups, jobs, library folders, server settings (admin only).

Every screen calls the same server API as the web app, so a function needs no new server code unless listed under
Tasks. An in-app web view for the long tail is not planned (it needs a token-to-session exchange the server does not
have); phase 3 and 4 screens are built natively. Say if a web-view bridge is acceptable for them.

### 6. Theme

First version: Material 3 with **Android's dynamic colour** (the `dynamic_color` package, `DynamicColorBuilder`),
falling back to a seed palette from Tippani's accent on older phones, with the system light and dark setting. Neither
Lexodle nor Fluenough has dynamic colour yet. Textures and the web app's material sets are a later phase.

## Release and signing

- **Signing.** Copy Lexodle's mechanism: the keystore comes from secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
  `KEY_ALIAS` and `KEY_PASSWORD` (the owner provides the keystore as for Lexodle; use a new one for this app). The
  workflow decodes it, passes it to Gradle through AGP's injected signing properties (no Gradle edits), builds, then
  verifies the APK's certificate against the keystore's and fails on a mismatch. **It fails if a secret is missing**
  (Fluenough's rule), because a debug-signed APK cannot be upgraded by a release-signed one. The signing material is
  removed at the end of the job.
- **Workflows.** `mobile.yml` on pull requests and pushes touching `mobile/`: `flutter pub get`, `flutter analyze`,
  `flutter test`, a format check, and a debug build. `app-release.yml` on tags `app-v*`: the same, then the signed APK
  named `tippani-app-vX.Y.Z.apk` attached to a GitHub release, with notes from the log since the previous `app-v` tag.
- **Version.** The tag is the version; the build number is the run number. A check fails the release if the tag and
  `pubspec.yaml` disagree.
- **Layout.** `mobile/` holds a committed `android/` (Lexodle's way; Fluenough generates it in CI). The wiki, the
  file map in Developing and the CI table are updated with it.

## Tasks

- [ ] Re-verify this plan against the code before starting; correct what moved.
- [ ] **Server:** shared text-cleanup step for captured text (roadmap §7); a nullable photo on a quote; confirm the
      `apiRevision` covers what the app needs and bump it.
- [ ] **Scaffold:** `mobile/` with package id, dynamic-colour theme, navigation, settings storage, the HTTP client with
      the device token, `GET /capabilities` check, tests, `mobile.yml`.
- [ ] **Pairing:** scan the QR, claim, store the token (platform secure storage), show and revoke devices.
- [ ] **Capture:** camera, OCR, selection on the photo, page and chapter proposal, correction screen, offline queue.
- [ ] **Update:** port the check and installer; `app-v*` release lookup; the manifest pieces.
- [ ] **Donation:** port the section, regenerate the QR, the disclaimer.
- [ ] **Bug report:** the form, `app-feedback-mail.yml`, `scripts/mail_to_issues.py` and its tests.
- [ ] **Release:** `app-release.yml` with signing and verification; first signed APK.
- [ ] Phases 2 to 4 of feature 5.
- [ ] Docs: user page for the app, Developing's file map and CI table, the Roadmap, the changelog.

## Out of scope

iOS; the Play Store; textures and material sets in the first version; server-side OCR.

See also: [Plans index](Plans-Index.md) · [Roadmap](Roadmap.md) · [Developing](Developing.md) · [Home](Home.md)
