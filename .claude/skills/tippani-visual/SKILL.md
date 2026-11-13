---
name: tippani-visual
description: Capture and check Tippani's screens against a real backup archive — 390 and 1280, light and dark, via the repo's screenshot harness on the pre-installed Chromium. Use when a change touches the UI, from tippani-gate stage 5 or a rater.
---

# Tippani visual verification

Base: the kit's `visual-verify`. Capture is a fixed recipe: run it through `screenshot-runner` on
**haiku**; never install a browser.

## Recipe

```bash
(cd scripts/screenshots && npm ci)    # once
TIPPANI_BROWSER=chrome scripts/screenshots/run-with-server.sh --seed ...   # or a make target below
```

- Cloud has no Firefox: always `TIPPANI_BROWSER=chrome`, and the report names the engine.
- **Default fixture is the real backup**: `scripts/screenshots/backup.env` (gitignored; holds
  `TIPPANI_BACKUP`, `TIPPANI_BACKUP_PASSWORD`, `TIPPANI_BACKUP_USER`, `TIPPANI_BACKUP_PASS` — exactly those
  four). The password is never written into a committed file. No `backup.env` → harnesses seed and say so
  on their first line; report that the run used the seeded fixture (no covers, 3 cast, non-deterministic).
- Probes: `make controls | typescale | sheet-drag | panel-depth | frame-scroll | hero-control |
  overlay-scroll | metadata-layout | glyph-align`. `controls` needs `--fixture` and takes ~70 min; a
  `small` count one or two over its ceiling is drift — diff the printed lists by name.
- Widths 390 and 1280, light and dark. Feature list = every ask, found on screen and pressed.
- Hygiene list: see `tippani-rate`. Measure where a number exists (`--card-pad`, `sideways`, `make typescale`).
- Cited line numbers from a subagent are leads: grep them before use.
