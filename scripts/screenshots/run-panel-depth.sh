#!/usr/bin/env bash
# Boots a scratch Tippani server, seeds it with the screenshot fixture, and asks
# panel-depth.mjs whether a panel that opens another panel leaves the second one on
# screen — the go/push race jsdom cannot reproduce. Nothing here touches a real data dir.
#
# Seeding is not optional, and for a different reason than the scroll probe's: a
# chip with no cast row behind it is drawn and says so with aria-disabled, so an
# unseeded run finds no live door to press and reports SKIP rather than ok.
set -euo pipefail

# The scratch server's cleanup, shared: a trap that covers every signal a shell
# can be sent, and a sweep of what a SIGKILL left behind. See scratch-server.sh
# for the run this cost.
# shellcheck source=scratch-server.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scratch-server.sh"
# THE ARCHIVE FIRST, IF THERE IS ONE, and before anything is built or booted —
# the restore path boots its own server. `scratch_prefer_archive` never returns
# when it takes that path. The owner's ruling was "use it for all tests"; this
# harness was one of the five that went on seeding while CLAUDE.md said otherwise.
BIND="${TIPPANI_BIND:-127.0.0.1:8126}"
export TIPPANI_BIND="$BIND"
scratch_prefer_archive panel-depth node panel-depth.mjs --base-url "http://$BIND" "$@"

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

# AND THE CAST ROW THE PROBE'S SUBJECT NEEDS. seed.mjs gives the library its works
# and quotes; a chip only becomes a DOOR when the work's cast knows the name the
# line puts on it, which is a second seeding step. Without it this probe finds
# only correctly-dead chips and now fails rather than reporting a hollow pass.
node seed-cast.mjs --base-url "http://$BIND" --movie-id 2

# Firefox refuses to start as root inside another user's X session, and this
# harness has no use for a display either way.
env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY \
  # NO `--movie-id`: the probe asks the library which film has a cast. The 2 that
  # was here is a fact about THIS fixture (seed-cast.mjs put a cast on it), and the
  # same flag on the archive path asked for a page that is not a film.
  node panel-depth.mjs --base-url "http://$BIND" "$@"
