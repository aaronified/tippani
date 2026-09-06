#!/usr/bin/env bash
# THE SCRATCH SERVER'S CLEANUP, IN ONE PLACE, because it was written in seven and
# fixed in one.
#
# WHAT HAPPENED. Every harness in this directory boots a Tippani against a
# `mktemp -d` and tears it down with `trap … EXIT`. `run-with-backup.sh` restores
# somebody's real library into one, so when nine of those directories were found
# on disk the trap there was widened to INT, TERM and HUP and given a sweep of
# what a SIGKILL leaves behind. The other six were not touched, and the reasoning
# for widening one of them applies word for word to all of them.
#
# IT BIT, AND IT BIT AS SOMETHING ELSE. A `make controls` run reported
# "account already holds 22 book(s) — refusing to seed on top of it" and exited 2.
# Nothing was wrong with the app or the probe: a previous run had been stopped
# with a TERM, its EXIT trap never fired, its server kept 127.0.0.1:8128, and the
# new server could not bind — so the harness seeded, logged in and measured
# against the DEAD RUN's library while reporting a seeding refusal. A leaked
# process does not announce itself as a leaked process.
#
# SO: `scratch_trap` covers the four signals a shell can be sent, and
# `scratch_sweep` removes what SIGKILL leaves, which is the only thing that can.
# A directory is one of ours if it is a mktemp holding a `tippani.db`; anything
# still being served is left alone, which is what the in-use guard is for — a
# concurrent run at another port is a normal thing to be doing.
#
# AND WITH NO WAY TO ASK, IT SWEEPS NOTHING. Deleting whenever `fuser` is missing
# is the guard inverted: on a machine without it, every concurrent run's data dir
# is fair game. A sweep that cannot tell a dead dir from a live one has to
# decline, and say so.
#
# BUT "IN USE" WAS TOO BLUNT, AND THE THING IT MISSED IS THE ONE THAT MATTERS.
# The leak this file was written for is a server that OUTLIVED its shell — a TERM
# the shell never got to trap, or a SIGKILL. That server goes on holding
# `tippani.db` open, so `fuser` answers yes, so the sweep steps over the very
# directory it exists to remove, and somebody's restored library stays decrypted
# on disk with nothing left that will ever clean it up. The `require_free` guard
# only surfaces it when the NEXT run happens to want the same port; on any other
# port it is invisible and permanent.
#
# A CONCURRENT RUN AND AN ORPHAN LOOK IDENTICAL FROM THE DIRECTORY, and are told
# apart from above: a concurrent run's server has its `run-*.sh` shell as its
# parent, and an orphan's shell is gone, so it has been reparented to init. So
# the sweep removes a scratch dir whose only holders are OUR OWN servers with no
# shell above them — a `<mktemp>/tippani serve`, PPID 1 — and still steps over a
# directory anything else is in, which is what keeps a concurrent run safe.
#
# AND IT SWEEPS WHERE mktemp ACTUALLY PUTS THINGS. `mktemp -d` honours $TMPDIR, so
# a hardcoded /tmp finds nothing on any machine that sets it.

scratch_sweep() {
  local root d
  root="${TMPDIR:-/tmp}"
  root="${root%/}"
  if command -v fuser >/dev/null 2>&1; then
    for d in "$root"/tmp.*; do
      [ -f "$d/tippani.db" ] || continue
      if fuser "$d/tippani.db" >/dev/null 2>&1; then
        scratch_orphans "$d" || continue
      fi
      echo "removing a data dir a killed run left behind: $d"
      rm -rf "$d"
    done
  else
    for d in "$root"/tmp.*; do
      [ -f "$d/tippani.db" ] || continue
      echo "WARNING: $d holds a scratch library and no fuser here to say whether it is in use — remove it by hand" >&2
    done
  fi
}

# scratch_orphans <data-dir>
#
# Answers whether everything holding this directory's database is one of OUR
# scratch servers with no shell above it, and stops them when so. Anything else
# in there — a concurrent run, a shell sitting in the directory, sqlite3 — and it
# declines, because a sweep that guesses is worse than one that leaves a stray
# directory for the next run to report.
scratch_orphans() {
  local data="$1" tmp pids pid exe ppid
  tmp="${TMPDIR:-/tmp}"; tmp="${tmp%/}"
  pids="$(fuser "$data/tippani.db" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true)"
  [ -n "$pids" ] || return 1
  for pid in $pids; do
    # The binary is its own mktemp, not the data dir's — see the run scripts.
    exe="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
    case "$exe" in "$tmp"/tmp.*/tippani) ;; *) return 1 ;; esac
    # `status`, not `stat`: field 4 of stat is only the parent when nothing in
    # the process name contains a space or a bracket, which is not ours to promise.
    ppid="$(awk '/^PPid:/ {print $2}' "/proc/$pid/status" 2>/dev/null)"
    [ "$ppid" = "1" ] || return 1
  done
  for pid in $pids; do
    echo "stopping a scratch server its shell no longer owns: pid $pid serving $data"
    kill "$pid" 2>/dev/null || true
  done
  # The database has to be released before the directory goes, or the removal
  # races the server's own clean shutdown and leaves half of it behind.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    fuser "$data/tippani.db" >/dev/null 2>&1 || return 0
    sleep 0.5
  done
  echo "WARNING: $data is still held after a TERM — left in place" >&2
  return 1
}

# scratch_trap <server-pid> <data-dir> <binary-dir>
#
# ON EVERY SIGNAL, NOT ONLY ON EXIT. `trap … EXIT` fires when the shell RETURNS; a
# run stopped with a TERM — which is what a harness, a Ctrl-C or a supervisor
# sends — never gets there, so the server keeps running and its data dir stays.
# SIGKILL still cannot be trapped, by construction; `scratch_sweep` is what
# answers that, on the next run.
scratch_trap() {
  local pid="$1" data="$2" bindir="$3"
  # shellcheck disable=SC2064  # the values are captured now, on purpose
  trap "kill '$pid' 2>/dev/null || true; wait '$pid' 2>/dev/null || true; rm -rf '$data' '$bindir'" EXIT
  trap "kill '$pid' 2>/dev/null || true; wait '$pid' 2>/dev/null || true; rm -rf '$data' '$bindir'; exit 130" INT
  trap "kill '$pid' 2>/dev/null || true; wait '$pid' 2>/dev/null || true; rm -rf '$data' '$bindir'; exit 143" TERM HUP
}

# scratch_require_free <binary> <bind>
#
# NOTHING MAY ALREADY BE ANSWERING ON THE PORT WE ARE ABOUT TO CLAIM, and this is
# the guard the leak above needed rather than the cleanup. A scratch server that
# cannot bind does not stop the run: the harness goes on to healthcheck the port,
# gets an answer from the DEAD RUN's server, seeds against its library, logs into
# its account and measures it — while reporting whatever that library happens to
# make it report. The failure surfaced as "account already holds 22 book(s)",
# which names the seeding and not the cause.
#
# Asked with the app's own healthcheck rather than with a port scanner, because
# it is the same question the wait loop below is about to ask and it needs no
# tool that may not be installed.
scratch_require_free() {
  local bin="$1" bind="$2"
  if TIPPANI_BIND="$bind" "$bin" healthcheck >/dev/null 2>&1; then
    echo "a tippani is ALREADY answering on $bind — refusing to run against a server this script did not start." >&2
    echo "It is almost certainly a previous run that was killed: find it with \`pgrep -fa \"tippani serve\"\` and stop it," >&2
    echo "or point this run somewhere else with TIPPANI_BIND." >&2
    exit 2
  fi
}
