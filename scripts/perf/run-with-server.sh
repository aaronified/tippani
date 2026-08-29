#!/usr/bin/env bash
# Boots a scratch Tippani server on a fresh data dir, seeds it with the screenshot
# fixture and then bulks it up to a realistic size, measures snappiness against it, and
# tears the server down. Nothing here touches a real data dir.
#
# The bulk step is the point: the defects this harness catches only show on a board
# with hundreds of cards, and the screenshot fixture is deliberately small.
set -euo pipefail

QUOTES="${TIPPANI_PERF_QUOTES:-400}"
ARGS=()
for a in "$@"; do
  case "$a" in
    --quotes=*) QUOTES="${a#*=}" ;;
    *) ARGS+=("$a") ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$(mktemp -d)/tippani"
DATA="$(mktemp -d)"
BIND="${TIPPANI_BIND:-127.0.0.1:8123}"

echo "building $BIN"
(cd "$ROOT" && go build -o "$BIN" ./cmd/tippani)

echo "starting tippani against $DATA on $BIND"
TIPPANI_DATA="$DATA" TIPPANI_BIND="$BIND" "$BIN" serve &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; rm -rf "$DATA" "$(dirname "$BIN")"' EXIT

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

# Seeding creates the account, so the measurement run takes its sign-in path. A
# failure here stops the run: measuring an empty library after asking for a full one
# is a silently wrong result, and every number would be of the wrong thing.
node ../screenshots/seed.mjs --base-url "http://$BIND"
node seed-bulk.mjs --base-url "http://$BIND" --count "$QUOTES"

# Firefox refuses to start as root inside another user's X session; this harness has
# no use for a display either way.
env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY \
  node snappiness.mjs --base-url "http://$BIND" ${ARGS[@]+"${ARGS[@]}"}
