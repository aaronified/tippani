#!/usr/bin/env bash
# Every Settings and Metadata surface, at both widths, against a restored archive
# where one is configured and the seeded fixture where it is not — the same branch
# every harness in this directory takes, through the one function that holds it, so
# this cannot drift from the other seven. It boots nothing itself: `run-with-server.sh`
# is the only place the scratch server is started correctly, and `TIPPANI_PROBE` is
# how another probe borrows it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scratch-server.sh
. "$here/scratch-server.sh"

BIND="${TIPPANI_BIND:-127.0.0.1:8137}"
export TIPPANI_BIND="$BIND"
export TIPPANI_PROBE=surfaces.mjs

scratch_prefer_archive surfaces \
  node surfaces.mjs --base-url "http://$BIND" "$@"

scratch_sweep

exec "$here/run-with-server.sh" --seed "$@"
