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
# AND IT SWEEPS WHERE mktemp ACTUALLY PUTS THINGS. `mktemp -d` honours $TMPDIR, so
# a hardcoded /tmp finds nothing on any machine that sets it.

scratch_sweep() {
  local root d
  root="${TMPDIR:-/tmp}"
  root="${root%/}"
  if command -v fuser >/dev/null 2>&1; then
    for d in "$root"/tmp.*; do
      [ -f "$d/tippani.db" ] || continue
      fuser "$d/tippani.db" >/dev/null 2>&1 && continue
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
