# Security

## Reporting a vulnerability

Please report it privately, through GitHub's **Report a vulnerability** on the
[Security tab](https://github.com/aaronified/tippani/security/advisories/new), and not in a public issue. Include what you did,
what you expected and what happened. You will get an answer, and a fix is a patch release with the problem named in the changelog
once it is safe to name it.

Only the latest release is supported.

## What the app promises

- **Self-hosted, one binary.** There is no hosted service and no telemetry. Outbound requests are the metadata and image lookups
  an administrator enables, and nothing else.
- **A reader sees only their own data**, and an administrator's settings are for administrators.
- **Library folders are read-only.** A mounted folder is never written, a path that resolves outside it is refused, and a reader
  never sends a path: they choose a work, and the server signs what it offers. See [Library folders](docs/wiki/Library-Folders.md).
- **Source files are never served back.** What leaves the server is extracted text, not the file.

## How it is checked

[Trivy](https://trivy.dev) scans the repository (Go and npm dependencies, committed secrets, the Dockerfile) and the built image on
every push and weekly, and fails the build on a fixed HIGH or CRITICAL finding (`.github/workflows/security.yml`). Anything it is
told to ignore is in `.trivyignore` with the reason.
