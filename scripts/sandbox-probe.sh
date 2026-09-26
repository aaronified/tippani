#!/usr/bin/env bash
# The journeys job's sandbox probe: does Chrome at $CHROME_PATH start with its
# sandbox on here, and on which of the two it has. ci.yml's journeys job runs it,
# and its comment above the step says why the browser is named and what was
# rejected. Kept as a script so a test can run it against a stub Chrome
# (web/frontend/test/pure/sandbox-probe.test.js): the step was rewritten three
# times, and each time a rater found an outcome it named wrong by writing a stub
# by hand.
#
# It starts Chrome once with the setuid fallback switched off and, if that fails
# for want of a sandbox, once more with it allowed. It says which sandbox Chrome
# rests on, and exits 1 if the fallback does not start Chrome, whether refused or
# only hung. A first start that fails for any other reason prints Chrome's words
# and its status as a warning, and leaves the verdict to the journeys.
#
#   CHROME_PATH=/usr/bin/google-chrome bash scripts/sandbox-probe.sh
#   SANDBOX_PROBE_TIMEOUT=60 is the seconds each start may take.
set -e
T="${SANDBOX_PROBE_TIMEOUT:-60}"
# As root, capture.mjs's launchOptions adds --no-sandbox, the option this
# job's comment rejects, so a job that ever runs as root says so here.
[ "$(id -u)" != 0 ] || echo "::warning::this job runs as root, so the harness launches Chrome with --no-sandbox (capture.mjs launchOptions)"
restrict=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo absent)
echo "kernel.apparmor_restrict_unprivileged_userns=$restrict"
err=$(timeout "$T" "$CHROME_PATH" --headless --disable-setuid-sandbox --dump-dom about:blank 2>&1 >/dev/null) && rc=0 || rc=$?
if [ "$rc" = 0 ]; then
  if [ "$restrict" = 1 ]; then
    echo "the namespace sandbox starts, and AppArmor's chrome profile is what lets it"
  else
    echo "the namespace sandbox starts; user namespaces are not restricted here"
  fi
elif grep -q 'No usable sandbox' <<<"$err"; then
  # Measured, not assumed: the fallback works only if the helper is there
  # and setuid root, so the same start is tried with it allowed.
  ls -l "$(dirname "$(readlink -f "$CHROME_PATH")")/chrome-sandbox" || true
  err2=$(timeout "$T" "$CHROME_PATH" --headless --dump-dom about:blank 2>&1 >/dev/null) && rc2=0 || rc2=$?
  if [ "$rc2" = 0 ]; then
    echo "::warning::the namespace sandbox does not start here; Chrome started on its setuid chrome-sandbox"
  else
    [ -z "$err2" ] || printf '%s\n' "$err2" | tail -n 20
    # Either way the journeys cannot rely on a sandbox, so the job stops.
    # Chrome names its sandbox failures, and those say which; a hang or
    # any other exit is reported with its status, since it says neither.
    if [ "$rc2" = 124 ]; then
      echo "::error::the namespace sandbox does not start, and Chrome on the setuid helper did not finish within ${T}s, so whether that sandbox works is unknown"
    elif grep -q 'No usable sandbox' <<<"$err2"; then
      echo "::error::neither sandbox starts: no user namespace, and no chrome-sandbox helper for Chrome to fall back to"
    elif grep -q 'SUID sandbox helper binary' <<<"$err2"; then
      echo "::error::neither sandbox starts: no user namespace, and the chrome-sandbox helper is missing or not owned by root with mode 4755"
    else
      echo "::error::the namespace sandbox does not start, and Chrome on the setuid helper exited $rc2 for a reason it did not name as the sandbox"
    fi
    exit 1
  fi
else
  [ -z "$err" ] || printf '%s\n' "$err" | tail -n 20
  if [ "$rc" = 124 ]; then
    echo "::warning::the sandbox probe did not finish within ${T}s, so it says nothing about the sandbox"
  else
    echo "::warning::the sandbox probe exited $rc for a reason other than the sandbox"
  fi
fi
