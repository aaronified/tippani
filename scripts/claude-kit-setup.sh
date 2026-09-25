#!/bin/bash
# claude-kit for tippani in a fresh cloud container. Paste into the environment's setup
# script. Needs aaronified/claude-kit attached to the session (private repo: the git proxy
# serves it only then). Idempotent: safe to run on a container that already has it.
#
# Always exits 0. The cloud docs: "if the script exits non-zero, the session fails to start"
# (code.claude.com/docs/en/cloud-environments, Script requirements), and a session without
# the kit is better than no session. A failed step is printed as it happens and counted in
# the last line, so the setup log says what is missing.
#
# The environment runs this once per cache: at its first session, and again when the setup
# script or the allowed hosts change or the cache expires after about seven days (same page,
# Environment caching). So the session that builds the cache needs the kit attached, or the
# cache holds no kit until the next rebuild. In any session, no claude-kit in
# `claude plugin list` or no .git/hooks/pre-commit means: run this from the session.
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
  H="$HOOKS/pre-commit"
  if [ -z "$K" ]; then
    warn "plugin cache not found - commit guard not written"
  elif [ ! -e "$H" ] || grep -q 'claude-kit pre-commit guard' "$H"; then
    # Absent, or the kit's own hook, rewritten so it names the installed version. Written
    # beside it and moved, so a failed write never leaves a truncated hook.
    mkdir -p "$HOOKS" \
      && python3 "${K}skills/git-sync/scripts/kit_guard.py" --hook > "$H.tmp" \
      && chmod +x "$H.tmp" && mv "$H.tmp" "$H" \
      || { rm -f "$H.tmp"; warn "commit guard not written"; }
  elif ! grep -Eq '^[^#]*kit_guard\.py.*--staged' "$H"; then
    # Someone else's hook, not already calling the guard (a comment naming it does not
    # count). Not edited, though the kit says to append: a hook that ends in `exec` never
    # reaches an appended line, and a script that rewrites someone's hook gets disabled.
    # The line to add finds whichever kit version is installed and skips itself when none
    # is, as the kit's own hook does.
    warn "$H is someone else's hook and was left alone; add this line to it:"
    echo '  G=$(ls ~/.claude/plugins/cache/claude-kit/claude-kit/*/skills/git-sync/scripts/kit_guard.py 2>/dev/null | sort -V | tail -1); [ -z "$G" ] || python3 "$G" --staged || exit 1' >&2
  fi
  mkdir -p "$(dirname "$EXCLUDE")"
  if ! grep -qx '/.visual-verify/' "$EXCLUDE" 2>/dev/null; then
    # A file with no final newline would glue the pattern onto its last line.
    { [ -s "$EXCLUDE" ] && [ -n "$(tail -c1 "$EXCLUDE")" ] && echo; echo '/.visual-verify/'; } >> "$EXCLUDE" \
      || warn ".visual-verify/ not added to $EXCLUDE"
  fi
  (cd "$R/web/frontend" && npm ci --no-audit --no-fund) || warn "npm ci failed in web/frontend"
  (cd "$R/scripts/screenshots" && npm ci --no-audit --no-fund) || warn "npm ci failed in scripts/screenshots"
  # The kit's audit half: no kit file may be tracked, at any path.
  if [ -n "$K" ]; then
    (cd "$R" && python3 "${K}skills/git-sync/scripts/kit_guard.py" --tracked) \
      || warn "kit_guard --tracked found kit files tracked in $R (listed above)"
  fi
else
  # The setup script may run before the clone. Run this again from the session to add them.
  echo "claude-kit: $R is not a clone yet - skipped the commit guard, the exclude line and npm ci" >&2
fi

if [ "$failed" -gt 0 ]; then
  echo "claude-kit: $failed step(s) failed - see the lines above" >&2
else
  echo "claude-kit: set up"
fi
exit 0
