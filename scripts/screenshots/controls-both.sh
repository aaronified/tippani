#!/usr/bin/env bash
# BOTH WIDTHS, ONE VERDICT — the half of `make controls` that does not care how
# the library got there.
#
# It was inside `run-controls.sh`, which SEEDS; a run against a restored backup
# had to reproduce it by hand from a line in CLAUDE.md, and a line a person types
# is a line that gets typed wrong. The two paths differ in one thing — which
# library the server is holding — so that is the only thing they should differ in.
#
# THE PROBE'S CODES MEAN THINGS. `2` is a refusal (no `--fixture`, or a shelf
# nobody has recorded) and `3` is "the app came back clean but the touch floor was
# measured against nothing". Both were flattened to 1 by a `|| rc=1` for as long
# as this lived in the other script. The worst code wins, so a real failure still
# outranks an unratcheted width.
#
# usage: controls-both.sh <fixture> [extra controls.mjs args…]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="${1:?usage: controls-both.sh <fixture> [args…]}"
shift || true
BIND="${TIPPANI_BIND:-127.0.0.1:8128}"

cd "$HERE"
[ -d node_modules ] || npm ci

# Firefox refuses to start as root inside another user's X session, and this
# harness has no use for a display either way.
RUN=(env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY node controls.mjs --base-url "http://$BIND" --fixture "$FIXTURE")

rc=0
worst() { [ "$1" -gt "$rc" ] && rc="$1"; return 0; }
echo; echo "──── desktop (1280) ────"
"${RUN[@]}" --width 1280 "$@" || worst "$?"
echo; echo "──── phone (390) ────"
"${RUN[@]}" --width 390 "$@" || worst "$?"
exit "$rc"
