#!/usr/bin/env bash
# THE OWNER'S OWN LIBRARY, NOT THE FIXTURE. `seed.mjs` builds a library out of
# public-domain titles with no cover artwork (this container cannot fetch one)
# and a cast of three — so a whole class of defect is invisible to every probe
# that uses it: a card whose chip and whose credit line print the same performer,
# a name long enough to be truncated, a poster behind a medium glyph. Every one of
# those was reported by the owner from their own phone and none of them could
# reproduce here.
#
# So the harness restores a REAL backup instead. The archive is sealed; the
# password opens it. Point TIPPANI_BACKUP at one and TIPPANI_BACKUP_PASSWORD at
# its password.
#
# THE ARCHIVE IS SOMEBODY'S LIBRARY. It never leaves this machine: the server it
# is restored into binds to 127.0.0.1, its data dir is a mktemp that the trap
# removes, and nothing here uploads, copies or prints its contents.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$(mktemp -d)/tippani"
DATA="$(mktemp -d)"
BIND="${TIPPANI_BIND:-127.0.0.1:8128}"
ARCHIVE="${TIPPANI_BACKUP:-}"
PASSWORD="${TIPPANI_BACKUP_PASSWORD:-}"

[ -n "$ARCHIVE" ] || { echo "set TIPPANI_BACKUP to a .tpbk archive" >&2; exit 2; }
[ -f "$ARCHIVE" ] || { echo "no archive at $ARCHIVE" >&2; exit 2; }

# AND SWEEP UP AFTER A RUN THAT WAS KILLED OUTRIGHT. A trap cannot answer
# SIGKILL, so the only way a restored library never accumulates is for the NEXT
# run to remove what the last one could not. A directory is one of ours if it is a
# mktemp holding a `tippani.db`; anything still being served is left alone, which
# is what the `fuser` guard is for — a concurrent run at another port is a normal
# thing to be doing.
for d in /tmp/tmp.*; do
  [ -f "$d/tippani.db" ] || continue
  if command -v fuser >/dev/null 2>&1 && fuser "$d/tippani.db" >/dev/null 2>&1; then continue; fi
  echo "removing a data dir a killed run left behind: $d"
  rm -rf "$d"
done

echo "building $BIN"
(cd "$ROOT" && go build -o "$BIN" ./cmd/tippani)

echo "starting tippani against $DATA on $BIND"
TIPPANI_DATA="$DATA" TIPPANI_BIND="$BIND" "$BIN" serve &
PID=$!
# ON EVERY SIGNAL, NOT ONLY ON EXIT — and this was found the way these things are
# found: nine directories, each holding a full restored copy of the owner's
# library, left on disk by runs that were interrupted. `trap … EXIT` fires when
# the shell RETURNS; a run stopped with a TERM (which is what a harness, a Ctrl-C
# or a supervisor sends) never gets there, so the server kept running and its data
# dir stayed. The whole point of the mktemp is that somebody's library does not
# outlive the run that needed it, and a cleanup that only covers the tidy case
# does not do that.
#
# SIGKILL still cannot be trapped, by construction. What answers that is the
# sweep at the head of this script, which removes any data dir a previous run
# left behind before this one starts.
cleanup() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; rm -rf "$DATA" "$(dirname "$BIN")"; }
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM HUP

ok=0
for _ in $(seq 1 40); do
  if TIPPANI_BIND="$BIND" "$BIN" healthcheck; then ok=1; break; fi
  sleep 0.5
done
[ "$ok" = 1 ] || { echo "server never became healthy" >&2; exit 1; }

# THE ONBOARDING RESTORE, which is the one that works on a server with no users:
# `POST /auth/restore/upload` is gated on the users table being empty and needs
# no session. A fresh mktemp data dir is exactly that state.
# UNDER /api, and the first cut of this was not. `server.go` mounts every JSON
# route under `/api/`; the root handler serves the SPA shell for anything else —
# so `POST /auth/restore/upload` returned **200 and index.html**, this script read
# the status code, called it a restore and ran the whole probe against an EMPTY
# library. A 200 from the wrong path is the worst kind of pass.
echo "restoring $ARCHIVE"
code=$(curl -sS -o /tmp/restore-out.$$ -w '%{http_code}' \
  -F "file=@${ARCHIVE}" -F "password=${PASSWORD}" \
  "http://$BIND/api/auth/restore/upload")
if [ "$code" != "200" ]; then
  echo "restore failed ($code): $(head -c 400 /tmp/restore-out.$$)" >&2
  rm -f /tmp/restore-out.$$
  exit 1
fi
rm -f /tmp/restore-out.$$

# The server swaps the database under itself; give it a moment and re-check.
for _ in $(seq 1 40); do
  TIPPANI_BIND="$BIND" "$BIN" healthcheck >/dev/null 2>&1 && break
  sleep 0.5
done

# AND THEN ASK THE APP, rather than trusting the status code. `needs_onboarding`
# is true exactly while the users table is empty, so it is the one answer that
# distinguishes "restored" from "took a 200 from the wrong handler".
onboarding=$(curl -sS "http://$BIND/api/auth/status" | tr -d ' ')
case "$onboarding" in
  *'"needs_onboarding":false'*) echo "restored — the library is up" ;;
  *) echo "restore did not take: $onboarding" >&2; exit 1 ;;
esac

cd "$HERE"
[ -d node_modules ] || npm ci
# NOT `exec`. It replaces this shell, so the EXIT trap above never fires — the
# scratch server outlives the run and the mktemp data dir, holding somebody's
# restored library, is never removed. Four orphaned servers accumulated before
# this was noticed.
rc=0
env -u XAUTHORITY -u DISPLAY -u WAYLAND_DISPLAY "$@" || rc=$?
exit "$rc"
