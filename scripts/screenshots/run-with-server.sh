#!/usr/bin/env bash
# Boots a scratch Tippani server (fresh data dir, so /auth/status reports
# needs_onboarding and the scaffold's signup path actually runs), waits for it to
# answer healthcheck the same way ci.yml's smoke test does, runs capture.mjs
# against it, then tears the server down. Nothing here touches a real data dir.
#
# With --seed, seed.mjs runs first and fills the account with the fixture library, so
# the captures show populated screens. That flag is consumed here and every other
# argument is passed through to capture.mjs untouched.
set -euo pipefail

SEED=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--seed" ]; then SEED=1; else ARGS+=("$a"); fi
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="$(mktemp -d)/tippani"
DATA="$(mktemp -d)"
BIND="${TIPPANI_BIND:-127.0.0.1:8080}"

echo "building $BIN"
(cd "$ROOT" && go build -o "$BIN" ./cmd/tippani)

echo "starting tippani against $DATA on $BIND"
TIPPANI_DATA="$DATA" TIPPANI_BIND="$BIND" "$BIN" serve &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; rm -rf "$DATA" "$(dirname "$BIN")"' EXIT

ok=0
for _ in $(seq 1 40); do
  if TIPPANI_BIND="$BIND" "$BIN" healthcheck; then
    ok=1
    break
  fi
  sleep 0.5
done
[ "$ok" = 1 ] || { echo "server never became healthy" >&2; exit 1; }

cd "$(dirname "${BASH_SOURCE[0]}")"
if [ ! -d node_modules ]; then
  echo "installing scaffold dependencies (puppeteer-core)"
  npm ci
fi

# Before the browser, not during it: seeding creates the account too, so capture.mjs
# then takes its login path rather than its signup path. A failure here stops the run —
# capturing an empty library after asking for a seeded one would be a silently wrong
# result, and every screenshot would be of the wrong thing.
if [ "$SEED" = 1 ]; then
  node seed.mjs --base-url "http://$BIND"
fi

# Firefox refuses to start as root inside another user's X session, and this harness
# has no use for a display either way. scripts/perf/run-with-server.sh has said this
# since it was written; this one had not, so a capture run died at browser launch with
# a message about $XAUTHORITY that says nothing about screenshots.
env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY \
  node capture.mjs --base-url "http://$BIND" ${ARGS[@]+"${ARGS[@]}"}
