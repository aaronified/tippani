# Releasing

Source of truth: this wiki page.

How a release is cut. It is short because the workflow does it: a release is a version typed into one form.

## What a release is

1. **A changelog section.** `CHANGELOG.md` gains `## [X.Y.Z] - YYYY-MM-DD`, in Keep a Changelog form (Added, Changed, Fixed). The
   file is embedded in the binary and served in the app, which is why it is the one document that does not live in this wiki.
2. **A commit** named `chore(release): X.Y.Z`, which changes `CHANGELOG.md` and nothing else.
3. **A tag** `vX.Y.Z` on that commit.

All three are made by [`release.yml`](https://github.com/aaronified/tippani/blob/main/.github/workflows/release.yml) when it is
run by hand ([ADR-0924](ADR-0924-The-Release-Workflow-Cuts-The-Version-From-The-Unreleased-Changelog.md)):

> Actions > release > Run workflow, from `main`, version `3.5.0` (or `v3.5.0`; both are the same version).

It moves the section under `## [Unreleased]` beneath `## [3.5.0] - <today>`, commits that, tags the commit, pushes the commit and
the tag together, starts the image build, and publishes the GitHub Release with that section as its notes. Nothing needs to be done
first except the checks below.

**Writing the notes is writing under `## [Unreleased]`, as each change is made**, with `node scripts/changelog-entry.mjs <Section>
"<entry>"` (it creates `[Unreleased]` and the section if they are missing). If nothing is under `[Unreleased]` when the release
runs, the notes are built from the `feat`, `fix`, `perf` and `refactor` commit subjects since the last tag, and the run says so on
its log; that is a worse changelog than one somebody wrote and better than none. With neither, the run stops before it touches
anything.

The other two ways in still work:

- **Push a tag yourself** (`vX.Y.Z`, with the changelog section already written and committed). The Release is published and
  `docker-publish.yml`, which also listens for tags, builds the image.
- **Run it with a version that already has a tag** (or from a tag). The Release is republished, to backfill one that was missed.
  Nothing is cut or pushed.

Pushing the tag also scans the repository and the built image with Trivy. The result is a **Known vulnerabilities** section at the bottom
of the Release notes (open findings, and accepted ones with the statement from `.trivyignore.yaml`), with the scan reports and an SBOM
attached. It never blocks a release and it is not in `CHANGELOG.md`: that file is hand-written and shown in the app. Pull requests and a daily
run are the gate (`security.yml`).

## Choosing the version

Semantic versioning, read from the actual diff and not from the commit subjects: a new capability or a user-visible change is a minor,
a fix is a patch, a break in what an operator or an export relies on is a major. A patch that adds a small feature has happened (3.3.1);
the changelog says so rather than pretending. The workflow does not choose: the version is what is typed.

## Before running it

- **CI is green on the latest commit of `main`.** A tag on a red commit publishes a red image. The release commit itself is not run
  through CI (a push made with the workflow's own token starts no other workflow), so the commit before it is the one CI judged.
- The documents that go stale with a change are current: the [roadmap](Roadmap.md), the [plans](Plans-Index.md) (a plan that is built is
  folded into an ADR and its page deleted), the [ADRs](ADR-Index.md) for any decision made, the [UI glossary](UI-Glossary.md)
  (`make glossary`), [Developing](Developing.md)'s file map (`node scripts/doc-map-check.mjs`) and its CI table, and every wiki link
  (`node scripts/wiki-check.mjs`).
- `web/dist` is rebuilt (`make frontend`) as the last commit before a push, and committed with `web/dist-inputs.json`.
- `## [Unreleased]` says what the release changes. Read it: it becomes the notes.

## If it fails

- **Before the push** (the version is not a version, nothing to release, a section for it already exists): nothing was changed.
  Fix the cause and run it again.
- **The push is refused** because `main` moved while it ran: the commit and the tag are one atomic push, so neither landed. Run it
  again.
- **After the push** (the Release step or the image build fails): the tag exists, so run it again with the same version. That
  republishes the Release from the tag, and `gh workflow run docker-publish.yml --ref vX.Y.Z` rebuilds the image.

## After the tag

Check that the Release page has the notes and that the image is pulled by `docker compose pull`. A tag cannot be reused: a mistake is
fixed by a new patch version, never by moving the tag.

See also: [Developing](Developing.md) · [Testing](Testing.md) · [Home](Home.md)
