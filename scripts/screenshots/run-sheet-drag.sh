#!/usr/bin/env bash
# Boots a scratch Tippani server, seeds it, and asks sheet-drag.mjs whether a
# panel at phone width is a sheet a reader can actually drag: a handle a thumb
# can hit, a rest height that is one of the anchors, a pull up that grows it and
# stays grown, and a pull off the bottom that closes it. Nothing here touches a
# real data dir.
#
# Seeding is not optional: the probe reaches its panel through a film page, and
# an empty library has none.
set -euo pipefail

# shellcheck source=scratch-server.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scratch-server.sh"
# THE ARCHIVE FIRST, IF THERE IS ONE, and before anything is built or booted —
# the restore path boots its own server. `scratch_prefer_archive` never returns
# when it takes that path. The owner's ruling was "use it for all tests"; this
# harness was one of the five that went on seeding while CLAUDE.md said otherwise.
BIND="${TIPPANI_BIND:-127.0.0.1:8129}"
export TIPPANI_BIND="$BIND"
# ALL THREE SURFACES, and that is the point of this loop. The probe used to be
# invoked once with no `--surface` and defaulted to `details` — the one panel the
# owner had already called fine — so two rounds of "the drag is fixed" were
# measured against a surface nobody had complained about. A run that does not press
# the reported one is worse than no run, because its exit code reads as an answer.
SURFACES="${TIPPANI_SHEET_SURFACES:-details character people}"
scratch_prefer_archive sheet-drag bash -c '
  rc=0
  for surf in '"$SURFACES"'; do
    echo "=== sheet-drag: $surf ==="
    node sheet-drag.mjs --base-url "'"http://$BIND"'" --surface "$surf" "$@" || rc=$?
  done
  exit $rc
' -- "$@"

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
rc=0
for surf in $SURFACES; do
  echo "=== sheet-drag: $surf ==="
  env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY \
    node sheet-drag.mjs --base-url "http://$BIND" --surface "$surf" "$@" || rc=$?
done
exit $rc
