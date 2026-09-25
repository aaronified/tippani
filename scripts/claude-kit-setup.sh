#!/bin/bash
# claude-kit for tippani in a fresh cloud container. Paste into the environment's setup
# script. Needs aaronified/claude-kit attached to the session (private repo: the git proxy
# serves it only then). Idempotent: safe to run on a container that already has it.
#
# Always exits 0. The cloud docs: "if the script exits non-zero, the session fails to start"
# (code.claude.com/docs/en/cloud-environments, Script requirements), and a session without
# the kit is better than no session. A step that failed, or that it could not verify, is
# printed as it happens and counted in the last line, so the setup log says what is missing.
# The same page asks for it to finish within about five minutes; its slowest steps, the
# two npm ci runs, took seconds in this container.
#
# The environment runs this once per cache: at its first session, and again when the setup
# script or the allowed hosts change or the cache expires after about seven days (same page,
# Environment caching). So the session that builds the cache must be started with the kit
# picked (add_repo comes too late), or the cache holds no kit until the next rebuild. This
# route has not yet run end to end; tippani's CLAUDE.md says what that leaves unknown and
# how a session checks whether the kit loaded and whether the guard runs. A session whose
# guard does not run can run this itself (after an add_repo of the kit if the plugin cache
# has no copy of the guard) to add the hook and the exclude line to its own clone; the
# plugin it installs loads only in a `claude -p` started in the same container, since every
# cloud session is a fresh VM. scripts/claude-kit-setup-check.sh checks this script.
set -u
failed=0
warn() { echo "claude-kit: $*" >&2; failed=$((failed + 1)); }

claude plugin marketplace add aaronified/claude-kit \
  || warn "marketplace add failed - is aaronified/claude-kit attached to this session?"
claude plugin install claude-kit@claude-kit || warn "plugin install failed"

# The digest stays off (tippani CLAUDE.md). A session with several repositories does not
# read the repo's .claude/settings.json, so the thresholds go in user settings as well.
python3 - <<'EOF' || warn "digest thresholds not written to ~/.claude/settings.json"
import json, os, sys
p = os.path.expanduser("~/.claude/settings.json")
try:
    s = json.load(open(p)) if os.path.exists(p) else {}
except ValueError as e:
    sys.exit(f"claude-kit: {p} is not valid JSON ({e}); left as it is")
s.setdefault("env", {}).update(
    {k: "100000" for k in ("CLAUDE_KIT_DIGEST_MINUTES", "CLAUDE_KIT_DIGEST_EVERY", "CLAUDE_KIT_DIGEST_TOOLS")})
os.makedirs(os.path.dirname(p), exist_ok=True)
# Beside it and moved: this file also holds enabledPlugins, and a failed write must not
# leave it truncated.
with open(p + ".tmp", "w") as fh:
    json.dump(s, fh, indent=2)
os.replace(p + ".tmp", p)
EOF

# Per-clone pieces the kit asks for, and the dependencies its test and capture skills drive.
R=${TIPPANI_DIR:-/home/user/tippani}
if git -C "$R" rev-parse --git-dir >/dev/null 2>&1; then
  # --git-path follows a linked worktree and core.hooksPath.
  HOOKS=$(cd "$R" && git rev-parse --path-format=absolute --git-path hooks)
  EXCLUDE=$(cd "$R" && git rev-parse --path-format=absolute --git-path info/exclude)
  # The installed copy, as the plugin record names it; the newest cached one if there is no
  # record, since the cache can hold a version that is no longer installed.
  K=$(python3 - <<'EOF' 2>/dev/null
import json, os
d = json.load(open(os.path.expanduser("~/.claude/plugins/installed_plugins.json")))
rows = sorted(d["plugins"]["claude-kit@claude-kit"], key=lambda r: r.get("lastUpdated", ""))
print(rows[-1]["installPath"].rstrip("/") + "/")
EOF
)
  [ -n "$K" ] && [ -d "$K" ] \
    || K=$(ls -d ~/.claude/plugins/cache/claude-kit/claude-kit/*/ 2>/dev/null | sort -V | tail -1)
  G=${K:+${K}skills/git-sync/scripts/kit_guard.py}
  H="$HOOKS/pre-commit"
  NEW=${G:+$(python3 "$G" --hook 2>/dev/null)}
  # The kit's own hook is exactly what --hook prints, give or take the version path it
  # names. Anything else is someone else's, however much of the kit's text it carries - a
  # hook with the guard appended under the kit's comment included. A kit hook from a version
  # whose text differs is treated as someone else's too: left alone, with a warning.
  unpath() { sed 's#/[^ ]*/kit_guard\.py#KIT_GUARD#g'; }
  if [ -z "$NEW" ]; then
    warn "commit guard not written - no plugin cache, or kit_guard.py --hook failed"
  elif [ ! -e "$H" ] || [ "$(unpath < "$H")" = "$(printf '%s\n' "$NEW" | unpath)" ]; then
    # Written beside it and moved, so a failed write never leaves a truncated hook.
    mkdir -p "$HOOKS" && printf '%s\n' "$NEW" > "$H.tmp" && chmod +x "$H.tmp" && mv "$H.tmp" "$H" \
      || { rm -f "$H.tmp"; warn "commit guard not written"; }
  else
    # Someone else's hook, or a kit hook from a version whose text differs. Left alone:
    # a script that rewrites someone's hook gets disabled, and a line appended to one that
    # ends in `exec` never runs. And not judged: whether a hook runs the guard cannot be
    # read from its text - a path behind a variable, a call that is only printed, a guard
    # whose file has gone, an early `exit 0` above it - so it is reported on every run
    # rather than passed on a guess. The line offered finds whichever kit version is
    # installed and skips itself when none is.
    warn "$H is not the kit's hook, so this script cannot tell whether it runs the guard." \
      "If it is an older kit hook, delete it and run this again; otherwise make sure it runs:"
    echo '  KIT_GUARD=$(ls ~/.claude/plugins/cache/claude-kit/claude-kit/*/skills/git-sync/scripts/kit_guard.py 2>/dev/null | sort -V | tail -1); [ -z "$KIT_GUARD" ] || python3 "$KIT_GUARD" --staged || exit 1' >&2
  fi
  mkdir -p "$(dirname "$EXCLUDE")"
  if ! grep -qx '/.visual-verify/' "$EXCLUDE" 2>/dev/null; then
    # A file with no final newline would glue the pattern onto its last line.
    { [ -s "$EXCLUDE" ] && [ -n "$(tail -c1 "$EXCLUDE")" ] && echo; echo '/.visual-verify/'; } >> "$EXCLUDE" \
      || warn ".visual-verify/ not added to $EXCLUDE"
  fi
  (cd "$R/web/frontend" && npm ci --no-audit --no-fund) || warn "npm ci failed in web/frontend"
  (cd "$R/scripts/screenshots" && npm ci --no-audit --no-fund) || warn "npm ci failed in scripts/screenshots"
  # The kit's audit half: no kit file may be tracked, at any path. Its exit codes: 1 means
  # kit files found, 2 means it could not run.
  if [ -n "$G" ]; then
    rc=0
    (cd "$R" && python3 "$G" --tracked) || rc=$?
    case $rc in
      0) ;;
      1) warn "kit_guard --tracked found kit files tracked in $R (listed above)" ;;
      *) warn "kit_guard --tracked could not run in $R (exit $rc)" ;;
    esac
  fi
else
  # The setup script may run before the clone. Counted, so the last line does not say "set up"
  # over a half that never ran.
  warn "$R is not a clone yet - skipped the commit guard, the exclude line and npm ci;" \
    "run this again from the session once it is"
fi

if [ "$failed" -gt 0 ]; then
  echo "claude-kit: $failed step(s) need attention - see the lines above" >&2
else
  echo "claude-kit: set up"
fi
exit 0
