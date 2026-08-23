#!/usr/bin/env bash
# Boots a scratch Tippani server (fresh data dir, so /auth/status reports
# needs_onboarding and the scaffold's signup path actually runs), waits for it to
# answer healthcheck the same way ci.yml's smoke test does, runs capture.mjs
# against it, then tears the server down. Nothing here touches a real data dir.
set -euo pipefail

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
  npm install
fi

node capture.mjs --base-url "http://$BIND" "$@"
