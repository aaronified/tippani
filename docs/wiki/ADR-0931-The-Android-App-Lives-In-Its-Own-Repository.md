# ADR-0931: The Android app lives in its own repository

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0014](ADR-0014-Android-Only-For-The-Native-Client-No-Unbuildable-Ios-Directory.md), which put the app in `mobile/` of this repository

**What was decided.** The Android client is [aaronified/tippani-app](https://github.com/aaronified/tippani-app), a separate public repository
under GPL-3.0. This repository keeps the server and the web app, under MIT. The owner decided it on 6 November 2026, having been given the
risks of both layouts. Android only still stands (ADR-0014): no `ios/` directory.

**Why.** The app has its own release track (signed APKs on `app-v*` tags), its own secrets (a signing keystore, a feedback mailbox), its own
toolchain (Flutter and Gradle) and, now, its own licence. In this repository it would have shared the server's changelog and release
workflow, the server's CI queue (which was already the bottleneck), the protected-branch rules and the 256 MB history, and a signing-key
mistake would have been one commit away from the server's code. A licence is a property of a repository, and the app wants GPL-3.0 where the
server is MIT.

**What moves and what stays.** The plan (`Plan-Android-App.md`), the roadmap card (§20) and the index entry moved to the app's repository
and are removed here; git holds the old pages. The server's side of the contract stays here: pairing and device tokens, `GET /capabilities`
and its `apiRevision`, `noted_at` on create, and idempotent `409`s on a retried write. **The server work the app needs** (a photo kept with a
quote, the shared text cleanup of §7) is filed here, as an issue on this repository, when it is taken on.

**The cost, stated.** The API contract now has two homes, and a server change can break an installed app with no CI in either repository
noticing. The app is to read `apiRevision` before it holds a token and to refuse a server outside the range it was built for, and the
server's `apiRevision` is bumped for any change to a route the app calls. Cross-repository work is two pull requests in the right order.
