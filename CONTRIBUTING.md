# Contributing

Tippani is built by one person, and a change is welcome when it keeps the app small, self-hosted and quiet. Open an
[issue](https://github.com/aaronified/tippani/issues) before a large change so the shape can be agreed first.

## Build and run

```bash
make run                      # go run ./cmd/tippani serve -> :8080, onboard in the browser
cd web/frontend && npm ci
npm run dev                   # Vite dev server, proxies /api to 127.0.0.1:8080
```

[Developing](docs/wiki/Developing.md) maps the whole repository: where a change goes, and how to know it worked.

## Before you open a pull request

```bash
go vet ./... && go test ./...
cd web/frontend && npm test && npm run lint:rules
node scripts/wiki-check.mjs && node scripts/doc-map-check.mjs
```

- **A test names something a person sees happen**, one per behaviour. Not wording, not markup, not a private helper. See
  [Testing](docs/wiki/Testing.md).
- **A decision is an ADR page**, `docs/wiki/ADR-NNNN-Title.md`, numbered after the last and added to the
  [index](docs/wiki/ADR-Index.md). It says why, and what was turned down. Pages are never renumbered.
- **Documentation lives in the wiki** (`docs/wiki/`), as Markdown with `Page-Name.md` links. The UI glossary is generated:
  `make glossary`. `CHANGELOG.md` is the one document elsewhere, because the app shows it.
- **Rebuild `web/dist`** (`make frontend`) as the last commit of a change that touches the frontend.
- **Both languages.** A new string goes into the English and the Bengali locale files, with the same keys.
- **Commit messages** are Conventional Commits (`feat(scope): ...`, `fix(scope): ...`) and say why.

## Reporting a problem

A bug is an issue. A security problem is not: see [SECURITY.md](SECURITY.md).
