#!/usr/bin/env bash
# Boots a scratch Tippani server, restores the archive if there is one, and asks
# overlay-scroll.mjs the owner's question from their own phone: when an overlay is
# dismissed, is the page still where they left it? A panel and each popover on a
# work page at 390px, with `GET /characters/:id` held back to stand in for a mobile
# network. Nothing here touches a real data dir.
#
# A library is not optional: the probe stands on a work page, and an empty one has
# none.
set -euo pipefail

# shellcheck source=scratch-server.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scratch-server.sh"
# THE ARCHIVE FIRST, IF THERE IS ONE, and before anything is built or booted —
# the restore path boots its own server. `scratch_prefer_archive` never returns
# when it takes that path. The owner's ruling was "use it for all tests"; this
# harness was one of the five that went on seeding while CLAUDE.md said otherwise.
BIND="${TIPPANI_BIND:-127.0.0.1:8129}"
export TIPPANI_BIND="$BIND"
scratch_prefer_archive overlay-scroll node overlay-scroll.mjs --base-url "http://$BIND" "$@"

scratch_sweep

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$(mktemp -d)/tippani"
DATA="$(mktemp -d)"

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

# Firefox refuses to start as root inside another user's X session, and this
# harness has no use for a display either way.
env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY \
  node overlay-scroll.mjs --base-url "http://$BIND" "$@"
