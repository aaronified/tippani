#!/bin/bash
# claude-kit for tippani in a fresh cloud container. Paste into the environment's setup
# script. Needs aaronified/claude-kit attached to the session (private repo: the git proxy
# serves it only then). Idempotent: safe to run on a container that already has it.
set -u

claude plugin marketplace add aaronified/claude-kit \
  || echo "claude-kit: marketplace add failed - is aaronified/claude-kit attached to this session?"
claude plugin install claude-kit@claude-kit

# The digest stays off (tippani CLAUDE.md). The project env block has failed to reach the
# hooks in a remote session, so the three thresholds go in user settings as well.
python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
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
  if [ -n "$K" ] && [ ! -e "$R/.git/hooks/pre-commit" ]; then
    python3 "$K/skills/git-sync/scripts/kit_guard.py" --hook > "$R/.git/hooks/pre-commit" \
      && chmod +x "$R/.git/hooks/pre-commit"
  fi
  grep -qx '/.visual-verify/' "$R/.git/info/exclude" 2>/dev/null \
    || printf '/.visual-verify/\n' >> "$R/.git/info/exclude"
  (cd "$R/web/frontend" && npm ci --no-audit --no-fund)
  (cd "$R/scripts/screenshots" && npm ci --no-audit --no-fund)
else
  echo "claude-kit: $R not cloned yet - skipped the guard hook, the exclude line and npm ci"
fi
