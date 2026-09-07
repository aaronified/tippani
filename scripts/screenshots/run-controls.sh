#!/usr/bin/env bash
# Boots a scratch Tippani server, seeds it, and presses EVERY control on every
# screen — asking of each one whether anything at all changed, and if not,
# whether the control said so. Nothing here touches a real data dir.
#
# TWO WIDTHS, because two of the three questions are width-dependent. The desktop
# pass is where the ⋯ drops its own Help row (the top bar draws a ? beside it), and
# the phone pass is the only one where the 44px touch floor means anything — a desk
# pointer does not need it, so checking it at 1280 would be inventing a rule.
set -euo pipefail

# The scratch server's cleanup, shared: a trap that covers every signal a shell
# can be sent, and a sweep of what a SIGKILL left behind. See scratch-server.sh
# for the run this cost.
# shellcheck source=scratch-server.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scratch-server.sh"

# THE ARCHIVE FIRST, IF THERE IS ONE — and the decision belongs HERE, before
# anything is built or booted. It was in the Makefile, which runs before
# `scratch-server.sh` has read `backup.env`, so `make controls` could not see the
# archive it was configured with and seeded anyway while reporting the backup
# shelf's ceiling. One entry point, one decision, after the configuration is
# loaded.
HERE_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${TIPPANI_BACKUP:-}" ] && [ -f "${TIPPANI_BACKUP}" ]; then
  echo "controls: against the archive at $TIPPANI_BACKUP"
  rc=0
  bash "$HERE_EARLY/run-with-backup.sh" bash "$HERE_EARLY/controls-both.sh" backup "$@" || rc=$?
  exit "$rc"
fi
echo "controls: against the seeded fixture (no TIPPANI_BACKUP; see scripts/screenshots/backup.env)"

scratch_sweep

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$(mktemp -d)/tippani"
DATA="$(mktemp -d)"
BIND="${TIPPANI_BIND:-127.0.0.1:8128}"

echo "building $BIN"
(cd "$ROOT" && go build -o "$BIN" ./cmd/tippani)

scratch_require_free "$BIN" "$BIND"
echo "starting tippani against $DATA on $BIND"
TIPPANI_DATA="$DATA" TIPPANI_BIND="$BIND" "$BIN" serve &
PID=$!
scratch_trap "$PID" "$DATA" "$(dirname "$BIN")"

ok=0
for _ in $(seq 1 40); do
  if TIPPANI_BIND="$BIND" "$BIN" healthcheck; then ok=1; break; fi
  sleep 0.5
done
[ "$ok" = 1 ] || { echo "server never became healthy" >&2; exit 1; }

cd "$HERE"
if [ ! -d node_modules ]; then
  echo "installing harness dependencies (puppeteer-core)"
  npm ci
fi

node seed.mjs --base-url "http://$BIND"
node seed-cast.mjs --base-url "http://$BIND" || true

# Firefox refuses to start as root inside another user's X session, and this
# harness has no use for a display either way.
# BOTH WIDTHS LIVE IN `controls-both.sh`, shared with the backup path. They differ
# in one thing — which library the server is holding — so that is the only thing
# they should differ in, and a run against a real archive had been reproducing the
# rest from a line in CLAUDE.md that a person types.
#
# `seed` NAMES THE SHELF THIS RUN IS AGAINST. The touch-floor count is a fact
# about the library as much as about the app — a bigger library draws more
# controls — so a ceiling recorded against the owner's backup says nothing about
# this one. It was compared across the two for a while: the seeded run measures
# 187 against a ceiling of 326, which is 139 controls of slack in a gate whose
# whole job is to have none.
#
# NOT `exec`, which replaces this shell so the EXIT trap never fires and the
# scratch server outlives the run — the mistake `run-with-backup.sh` documents at
# length, after four orphaned servers and nine data dirs holding a restored copy
# of somebody's library were found on disk.
rc=0
bash "$HERE/controls-both.sh" seed "$@" || rc=$?
exit "$rc"
