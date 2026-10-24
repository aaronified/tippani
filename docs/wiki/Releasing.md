# Releasing

Source of truth: this wiki page.

How a release is cut. It is short because the pipeline does the publishing; a release is a changelog section and a tag.

## What a release is

1. **A changelog section.** `CHANGELOG.md` gains `## [X.Y.Z] - YYYY-MM-DD`, in Keep a Changelog form (Added, Changed, Fixed), written
   from the range since the last tag. The file is embedded in the binary and served in the app, which is why it is the one document
   that does not live in this wiki.
2. **A commit** named `chore(release): X.Y.Z`, whose body says what the version is and the range it covers (`vA..HEAD`), and what was
   not run.
3. **A tag** `vX.Y.Z` on that commit.

Pushing the tag does the rest. [`release.yml`](https://github.com/aaronified/tippani/blob/main/.github/workflows/release.yml) cuts the
GitHub Release with that version's changelog section as its notes, and
[`docker-publish.yml`](https://github.com/aaronified/tippani/blob/main/.github/workflows/docker-publish.yml) publishes the multi-arch
image to GHCR under the version and the moving series tags. The version the binary reports comes from the tag.

Pushing the tag also scans the repository and the built image with Trivy. The result is a **Known vulnerabilities** section at the bottom
of the Release notes (open findings, and accepted ones with the statement from `.trivyignore.yaml`), with the scan reports and an SBOM
attached. It never blocks a release and it is not in `CHANGELOG.md`: that file is hand-written and shown in the app. Pull requests and a daily
run are the gate (`security.yml`).

## Choosing the version

Semantic versioning, read from the actual diff and not from the commit subjects: a new capability or a user-visible change is a minor,
a fix is a patch, a break in what an operator or an export relies on is a major. A patch that adds a small feature has happened (3.3.1);
the changelog says so rather than pretending.

## Before the tag

- The documents that go stale with a change are current: the [roadmap](Roadmap.md), the [plans](Plans-Index.md) (a plan that is built is
  folded into an ADR and its page deleted), the [ADRs](ADR-Index.md) for any decision made, the [UI glossary](UI-Glossary.md)
  (`make glossary`), [Developing](Developing.md)'s file map (`node scripts/doc-map-check.mjs`) and its CI table, and every wiki link
  (`node scripts/wiki-check.mjs`).
- `web/dist` is rebuilt (`make frontend`) as the last commit before a push, and committed with `web/dist-inputs.json`.
- CI is green on the commit being tagged. A tag on a red commit publishes a red image.
- The changelog is written, and the release is cut, by a `sonnet`-tier agent; the session on a higher model reviews what comes back.

## After the tag

Check that the Release page has the notes and that the image is pulled by `docker compose pull`. A tag cannot be reused: a mistake is
fixed by a new patch version, never by moving the tag.

See also: [Developing](Developing.md) · [Testing](Testing.md) · [Home](Home.md)
