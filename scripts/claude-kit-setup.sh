#!/bin/bash
# claude-kit for tippani in a fresh cloud container. Paste into the environment's setup
# script. Needs aaronified/claude-kit attached to the session (private repo: the git proxy
# serves it only then). Idempotent: safe to run on a container that already has it.
# Exits 1 if any step failed, after trying the rest, so a setup log says what is missing.
set -u
failed=0
warn() { echo "claude-kit: $*" >&2; failed=1; }

claude plugin marketplace add aaronified/claude-kit \
  || warn "marketplace add failed - is aaronified/claude-kit attached to this session?"
claude plugin install claude-kit@claude-kit || warn "plugin install failed"

# The digest stays off (tippani CLAUDE.md). The project env block has failed to reach the
# hooks in a remote session, so the three thresholds go in user settings as well.
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
with open(p, "w") as fh:
    json.dump(s, fh, indent=2)
EOF

# Per-clone lines the kit asks for, and the dependencies its test and capture skills drive.
R=${TIPPANI_DIR:-/home/user/tippani}
if [ -d "$R/.git" ]; then
  K=$(ls -d ~/.claude/plugins/cache/claude-kit/claude-kit/*/ 2>/dev/null | sort -V | tail -1)
  H="$R/.git/hooks/pre-commit"
  if [ -z "$K" ]; then
    warn "plugin cache not found - commit guard not written"
  elif [ ! -e "$H" ] || grep -q 'claude-kit pre-commit guard' "$H"; then
    # Absent, or the kit's own hook (rewritten so it names the installed version).
    python3 "${K}skills/git-sync/scripts/kit_guard.py" --hook > "$H" && chmod +x "$H" \
      || warn "commit guard not written"
  else
    warn "$H is someone else's hook and was left alone; add this line to it:" \
      "python3 ${K}skills/git-sync/scripts/kit_guard.py --staged || exit 1"
  fi
  grep -qx '/.visual-verify/' "$R/.git/info/exclude" 2>/dev/null \
    || printf '/.visual-verify/\n' >> "$R/.git/info/exclude" \
    || warn ".visual-verify/ not added to .git/info/exclude"
  (cd "$R/web/frontend" && npm ci --no-audit --no-fund) || warn "npm ci failed in web/frontend"
  (cd "$R/scripts/screenshots" && npm ci --no-audit --no-fund) || warn "npm ci failed in scripts/screenshots"
else
  # Not a failure: the setup script may run before the clone. Run this again from the
  # session to add the per-clone pieces.
  echo "claude-kit: $R not cloned yet - skipped the commit guard, the exclude line and npm ci" >&2
fi
exit $failed
