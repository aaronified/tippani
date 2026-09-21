#!/usr/bin/env bash
# EVERY GLYPH THAT SITS BESIDE TEXT, MEASURED, at both widths — against a restored
# archive where one is configured and the seeded fixture where it is not, through
# the one function that holds that branch so this cannot drift from the other
# harnesses. It boots nothing itself: `run-with-server.sh` is the only place the
# scratch server is started correctly, and `TIPPANI_PROBE` is how another probe
# borrows it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scratch-server.sh
. "$here/scratch-server.sh"

BIND="${TIPPANI_BIND:-127.0.0.1:8139}"
export TIPPANI_BIND="$BIND"
export TIPPANI_PROBE=glyph-align.mjs

scratch_prefer_archive glyph-align \
  node glyph-align.mjs --base-url "http://$BIND" "$@"

scratch_sweep

exec "$here/run-with-server.sh" --seed "$@"
