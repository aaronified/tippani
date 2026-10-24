# ADR-0545: The changelog ships inside the binary rather than being fetched

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.12.0

**Decided.** The root package embeds `CHANGELOG.md`, `internal/changelog` parses it into releases → sections → entries, and `GET /changelog` serves it. A dialog on the Updates card shows it newest first, with the running build marked. Entries stay as markdown and the client renders the three inline spans by hand.

**Why.** The request was "fetch it from git", and the shipped artifact cannot: the image is `distroless/static` with one binary in it, no git and no shell, `.git` and the docs are outside the build context, and the CSP has no `connect-src` so the browser cannot call GitHub either. The two real sources are the embedded file and GitHub's HTTP API.

Embedded wins on the thing this app is actually for. The promise is stated in three places and is load-bearing — "zero background jobs", "nothing external is required to run", and §1's "Tippani never contacts the network on its own", whose own justification is that it is the honest reading of self-hosted. (That is how the first and the last read then. 3.1.0 gave the app jobs a person starts, so the first is "nothing wakes on a timer" now, and reworded §1 to say what a screen may fetch for itself; the argument here never rested on either wording: the case it wins is the offline one.) A changelog that is blank on a LAN-only NAS, behind a firewall, or after the update check has spent the hour's 60 unauthenticated GitHub requests is blank in exactly the situation the product optimises for. And a changelog is a fact about the binary you are RUNNING, not about the internet: the embedded copy answers that exactly, forever, offline. Notes for a version you have not installed are a different question, and the card already answers it with a link — which stays.

**The copy was the cost, and at 3.0.2 it is gone.** `//go:embed` cannot reach outside its package, and there was no Go package at the repo root, so `internal/changelog` kept a byte-identical copy beside itself, with a drift test, `make changelog` and a release-checklist step to hold the two together. The owner, at 3.0.2: *"why are there two changelogs? there should be only one"*. The root is a package now (`changelog.go`, package `tippani`), it embeds `CHANGELOG.md`, and `internal/changelog` reads it from there. The copy, the drift test, the make target, the checklist step and the entry script's second write are gone. `.dockerignore` excludes root Markdown, so `CHANGELOG.md` is named as its one exception, because the image build compiles the root package.

*Where it was wrong:* "there is no Go package at the repo root" was stated as a constraint, when it was a choice that one file could reverse.

**Parsed in Go, rendered in React.** The structure — where a release starts, which section a bullet is in, and crucially which continuation paragraphs belong to which bullet — is done server-side, because a naive line-splitter flattens or drops those paragraphs and the failure is silent. The inline spans are done client-side in thirty lines, because there is no markdown dependency in this frontend and no `dangerouslySetInnerHTML` anywhere in it, and adding either for a dialog opened twice a month is a poor trade. Anything the renderer does not know is shown verbatim: for a changelog that is honest, you just see the asterisks.

**Not admin-gated**, though the button is on the admin-only Updates card. Release history is published on the internet; gating the endpoint would stop a second user on the same instance ever being shown what changed.

**Instead of.** Proxying GitHub's `/releases` (elegant — `release.yml` already puts each version's section in the release body, so it arrives pre-split — but empty offline, and it widens a claim the docs make). Shelling out to git (impossible in the image). A markdown library in the frontend (a dependency and an HTML-injection surface for one dialog).

**Approved.** The reader chose embedded, having been shown that "from git" is not literally possible in the shipped artifact and what each real source costs.

<sub>1.12.0 — `internal/changelog/changelog.go` · `internal/httpapi/changelog_handlers.go` · `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/changelog-dialog.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
