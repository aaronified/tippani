#!/bin/bash
# Runs scripts/claude-kit-setup.sh in a sandbox and checks what it did: its own HOME, a real
# `git init`, real `git commit`s for the hook, the installed kit's own kit_guard.py, and stubs
# only for `claude` and `npm` - the two commands that would reach the network - which log
# their arguments so the check can see they were called right. Run it by hand after changing
# the setup script:
#
#   bash scripts/claude-kit-setup-check.sh      # exit 0 all cases pass, 1 any fails,
#                                               # 2 no installed kit to take the guard from
#
# Not in CI: the guard comes from the kit, a private repository CI cannot fetch, and a CI copy
# built on a stub guard would be checking the stub. Nothing here touches ~/.claude or this
# clone.
set -u
SCRIPT="$(cd "$(dirname "$0")" && pwd)/claude-kit-setup.sh"
REAL=$(ls ~/.claude/plugins/cache/claude-kit/claude-kit/*/skills/git-sync/scripts/kit_guard.py 2>/dev/null | sort -V | tail -1)
[ -n "$REAL" ] || { echo "no installed claude-kit to take kit_guard.py from" >&2; exit 2; }
KITFILE="$(dirname "$REAL")/../../test-summary/SKILL.md"

SB=$(mktemp -d)
trap 'rm -rf "$SB"' EXIT
pass=0 fail=0
check() { # name, then a condition to evaluate
  local name=$1; shift
  if eval "$*"; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL $name: $*" >&2; fi
}

mkhome() { # a HOME whose plugin cache holds 0.2.0 and 0.10.0, with 0.2.0 on the record
  local c="$1/.claude/plugins/cache/claude-kit/claude-kit" v
  for v in 0.2.0 0.10.0; do
    mkdir -p "$c/$v/skills/git-sync/scripts" "$c/$v/skills/test-summary"
    cp "$REAL" "$c/$v/skills/git-sync/scripts/"
    cp "$KITFILE" "$c/$v/skills/test-summary/"
  done
  record "$1" "$c/0.2.0"
}
record() { # HOME, the installPath its plugin record names
  printf '{"version":2,"plugins":{"claude-kit@claude-kit":[{"scope":"user","installPath":"%s","lastUpdated":"2026-09-25T00:00:00Z"}]}}' \
    "$2" > "$1/.claude/plugins/installed_plugins.json"
}
HM="$SB/home"; mkhome "$HM"
C="$HM/.claude/plugins/cache/claude-kit/claude-kit"; G2="$C/0.2.0/skills/git-sync/scripts/kit_guard.py"
IP="$HM/.claude/plugins/installed_plugins.json"
CALLS="$SB/calls"
mkdir -p "$SB/bin"
printf '#!/bin/sh\necho "claude $*" >> "%s"\n[ "$CLAUDE_STUB" = ok ] || { echo "stub claude failed" >&2; exit 1; }\n' "$CALLS" > "$SB/bin/claude"
printf '#!/bin/sh\necho "npm $* in $PWD" >> "%s"\n' "$CALLS" > "$SB/bin/npm"
chmod +x "$SB/bin/claude" "$SB/bin/npm"

R="$SB/repo"; H="$R/.git/hooks/pre-commit"; X="$R/.git/info/exclude"; OUT="$SB/out"
ATTN1="claude-kit: 1 step(s) need attention - see the lines above"
mkrepo() { rm -rf "$R" "$SB/wt"; git init -q "$R"; mkdir -p "$R/web/frontend" "$R/scripts/screenshots"; }
run() { # stub mode, then optional repo dir and HOME
  : > "$CALLS"
  env -i PATH="$SB/bin:/usr/bin:/bin" HOME="${3:-$HM}" TIPPANI_DIR="${2:-$R}" CLAUDE_STUB="$1" \
    GIT_CONFIG_NOSYSTEM=1 bash "$SCRIPT" > "$OUT" 2>&1
  echo $? > "$SB/rc"
}
rc() { cat "$SB/rc"; }
last() { tail -1 "$OUT"; }
said() { grep -q -- "$1" "$OUT"; }
called() { grep -qx -- "$1" "$CALLS"; }
ver() { grep '^GUARD=' "$H" | grep -o 'claude-kit/[0-9.]*/' | head -1; }
stage_kit() { mkdir -p "$R/.claude/skills/t"; cp "$KITFILE" "$R/.claude/skills/t/"; git -C "$R" add -f .claude; }
unstage_kit() { git -C "$R" rm -rq --cached .claude; rm -rf "$R/.claude"; }
refuses() { # a real commit with the kit file staged: git runs the hook only if it is executable
  if env -i PATH=/usr/bin:/bin HOME="${1:-$HM}" GIT_CONFIG_NOSYSTEM=1 \
      git -C "$R" -c user.email=c@c -c user.name=c commit -q -m probe >/dev/null 2>&1; then
    git -C "$R" update-ref -d HEAD; return 1   # it went through: undo, and say so
  fi
}
line_from_out() { grep 'KIT_GUARD=' "$OUT" | sed 's/^  //'; }
accepts() { # the control: the same hook lets an ordinary file through
  echo x > "$R/ordinary.txt"; git -C "$R" add ordinary.txt
  if env -i PATH=/usr/bin:/bin HOME="${1:-$HM}" GIT_CONFIG_NOSYSTEM=1 \
      git -C "$R" -c user.email=c@c -c user.name=c commit -q -m probe >/dev/null 2>&1; then
    git -C "$R" update-ref -d HEAD; git -C "$R" rm -q --cached ordinary.txt; rm "$R/ordinary.txt"
  else
    git -C "$R" rm -q --cached ordinary.txt; rm "$R/ordinary.txt"; return 1
  fi
}

mkrepo; run ok
check "fresh: exit 0, set up" '[ "$(rc)" = 0 ] && [ "$(last)" = "claude-kit: set up" ]'
check "fresh: the marketplace and the plugin, by name" 'called "claude plugin marketplace add aaronified/claude-kit" && called "claude plugin install claude-kit@claude-kit"'
check "fresh: npm ci in both packages" 'called "npm ci --no-audit --no-fund in $R/web/frontend" && called "npm ci --no-audit --no-fund in $R/scripts/screenshots"'
check "fresh: hook names the recorded version, executable" '[ "$(ver)" = "claude-kit/0.2.0/" ] && [ -x "$H" ]'
check "fresh: thresholds written" 'python3 -c "import json,sys; e=json.load(open(\"$HM/.claude/settings.json\"))[\"env\"]; sys.exit(0 if all(e[k]==\"100000\" for k in (\"CLAUDE_KIT_DIGEST_MINUTES\",\"CLAUDE_KIT_DIGEST_EVERY\",\"CLAUDE_KIT_DIGEST_TOOLS\")) else 1)"'
check "fresh: no settings .tmp left" '[ ! -e "$HM/.claude/settings.json.tmp" ]'
check "fresh: git lets an ordinary commit through the hook" 'accepts'
stage_kit; check "fresh: git refuses a commit with a kit file staged" 'refuses'; unstage_kit
run ok
check "rerun: set up, one exclude line" '[ "$(last)" = "claude-kit: set up" ] && [ "$(grep -cx "/.visual-verify/" "$X")" = 1 ]'

run fail
check "claude failing: exit 0, both named and counted" '[ "$(rc)" = 0 ] && said "marketplace add failed" && said "plugin install failed" && [ "$(last)" = "claude-kit: 2 step(s) need attention - see the lines above" ]'

cp "$HM/.claude/settings.json" "$SB/s"; echo '{broken' > "$HM/.claude/settings.json"; run ok
check "settings not JSON: left as it was, counted" '[ "$(cat "$HM/.claude/settings.json")" = "{broken" ] && said "not valid JSON" && [ "$(last)" = "$ATTN1" ]'
cp "$SB/s" "$HM/.claude/settings.json"

printf '#!/bin/sh\necho mine\n' > "$H"; chmod +x "$H"; cp "$H" "$SB/h"; run ok
check "someone else's hook: untouched, counted, line offered" 'cmp -s "$H" "$SB/h" && said "not the kit" && [ -n "$(line_from_out)" ] && [ "$(last)" = "$ATTN1" ]'
{ line_from_out; echo 'true'; } >> "$H"; run ok
check "the offered line parses" 'sh -n "$H"'
check "a hook with the line is still counted" 'said "not the kit" && [ "$(last)" = "$ATTN1" ]'
check "the offered line lets an ordinary commit through" 'accepts'
stage_kit; check "the offered line refuses, with a command after it" 'refuses'
mkdir -p "$C/0.3.0"; cp -r "$C/0.2.0/skills" "$C/0.3.0/"; mv "$C/0.2.0" "$SB/v2"; mv "$C/0.10.0" "$SB/v10"
check "... and still does after the kit moves to 0.3.0" 'refuses'
rm -rf "$C/0.3.0"; mv "$SB/v2" "$C/0.2.0"; mv "$SB/v10" "$C/0.10.0"; unstage_kit

python3 "$G2" --hook | sed "s#$C/0.2.0#/gone/claude-kit/claude-kit/0.1.0#g" > "$H"; run ok
check "the kit's hook naming a gone version: rewritten to the recorded one" '[ "$(ver)" = "claude-kit/0.2.0/" ] && [ "$(last)" = "claude-kit: set up" ]'
python3 "$G2" --hook | sed '3i # an older wording' > "$H"; cp "$H" "$SB/h"; run ok
check "a kit hook whose text drifted: untouched, counted" 'cmp -s "$H" "$SB/h" && said "not the kit" && [ "$(last)" = "$ATTN1" ]'
{ printf '#!/bin/sh\nmake lint\n'; python3 "$G2" --hook | sed 1d; } > "$H"; cp "$H" "$SB/h"; run ok
check "the kit's text under someone's commands: untouched, counted" 'cmp -s "$H" "$SB/h" && said "not the kit" && [ "$(last)" = "$ATTN1" ]'

python3 "$G2" --hook > "$H"; cp "$H" "$SB/h"; mv "$G2" "$SB/g"; run ok
check "guard gone from the cache: hook kept, reported" 'cmp -s "$H" "$SB/h" && said "commit guard not written"'
mv "$SB/g" "$G2"

mv "$IP" "$SB/ip"; rm "$H"; run ok
check "no plugin record: the newest cached version" '[ "$(ver)" = "claude-kit/0.10.0/" ]'
record "$HM" "$C/0.9.9"; rm "$H"; run ok
check "a record naming a missing directory: the newest cached version" '[ "$(ver)" = "claude-kit/0.10.0/" ]'
mv "$SB/ip" "$IP"

mkrepo; printf '*.log' > "$X"; run ok
check "exclude with no final newline: the pattern on its own line" '[ "$(cat "$X")" = "$(printf "*.log\n/.visual-verify/")" ]'
mkrepo; printf '# visual-verify screenshots go in .visual-verify\n' > "$X"; run ok
check "exclude that only mentions visual-verify: the pattern still added" 'grep -qx "/.visual-verify/" "$X"'

mkrepo; git -C "$R" -c user.email=c@c -c user.name=c commit -q --allow-empty -m c
git -C "$R" worktree add -q "$SB/wt"; mkdir -p "$SB/wt/web/frontend" "$SB/wt/scripts/screenshots"; run ok "$SB/wt"
check "linked worktree: hook and exclude in the main .git" '[ -x "$H" ] && grep -qx "/.visual-verify/" "$X"'

mkrepo; git -C "$R" config core.hooksPath .githooks; run ok
check "core.hooksPath: the hook goes there" '[ -x "$R/.githooks/pre-commit" ] && [ ! -e "$H" ]'

mkrepo; stage_kit; git -C "$R" -c user.email=c@c -c user.name=c commit -q --no-verify -m c; run ok
check "a tracked kit file: the audit reports it" 'said "found kit files tracked" && [ "$(last)" = "$ATTN1" ]'

mkrepo; mv "$G2" "$SB/g"
printf 'import runpy, sys\nif "--tracked" in sys.argv: sys.exit(2)\nsys.argv[0] = "%s"\nrunpy.run_path("%s", run_name="__main__")\n' "$SB/g" "$SB/g" > "$G2"
run ok
check "the audit unable to run: said so, not blamed on files" 'said "could not run" && ! said "found kit files"'
mv "$SB/g" "$G2"

run ok "$SB/not-a-clone"
check "not a clone: exit 0, counted, not set up" '[ "$(rc)" = 0 ] && said "not a clone yet" && [ "$(last)" = "$ATTN1" ]'

HS="$SB/home with space"; mkhome "$HS"; mkrepo; run ok "" "$HS"
check "HOME with a space: set up" '[ "$(last)" = "claude-kit: set up" ]'
printf '#!/bin/sh\necho mine\n' > "$H"; chmod +x "$H"; run ok "" "$HS"; { line_from_out; echo 'true'; } >> "$H"; stage_kit
check "HOME with a space: the offered line refuses" 'refuses "$HS"'

echo "claude-kit-setup-check: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
