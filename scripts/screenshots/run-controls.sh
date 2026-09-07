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
# `--fixture seed` NAMES THE SHELF THIS RUN IS AGAINST. The touch-floor count is a
# fact about the library as much as about the app — a bigger library draws more
# controls — so a ceiling recorded against the owner's backup says nothing about
# this one. It was compared across the two for a while: the seeded run measures
# 187 against a ceiling of 326, which is 139 controls of slack in a gate whose
# whole job is to have none.
RUN=(env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY node controls.mjs --base-url "http://$BIND" --fixture seed)

# THE PROBE'S CODES MEAN THINGS, AND THIS USED TO FLATTEN THEM ALL TO 1. `2` is a
# refusal (no `--fixture`, or a shelf nobody has recorded) and `3` is "the app came
# back clean but the touch floor was measured against nothing" — both invisible
# through a `|| rc=1`, which is how the exit-3 rule could be written, tested and
# documented while nothing that runs it could ever report one. The worst code wins,
# so a real failure still outranks an unratcheted width.
rc=0
worst() { [ "$1" -gt "$rc" ] && rc="$1"; return 0; }
echo; echo "──── desktop (1280) ────"
"${RUN[@]}" --width 1280 "$@" || worst "$?"
echo; echo "──── phone (390) ────"
"${RUN[@]}" --width 390 "$@" || worst "$?"
exit "$rc"
