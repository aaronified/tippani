#!/bin/bash
# Runs scripts/claude-kit-setup.sh in a sandbox and checks what it did: its own HOME, a real
# `git init`, the installed kit's own kit_guard.py, and stubs only for `claude` and `npm`, the
# two commands that would reach the network. Run it by hand after changing the setup script:
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
  printf '{"version":2,"plugins":{"claude-kit@claude-kit":[{"scope":"user","installPath":"%s/0.2.0","lastUpdated":"2026-09-25T00:00:00Z"}]}}' \
    "$c" > "$1/.claude/plugins/installed_plugins.json"
}
HM="$SB/home"; mkhome "$HM"
C="$HM/.claude/plugins/cache/claude-kit/claude-kit"; G2="$C/0.2.0/skills/git-sync/scripts/kit_guard.py"
IP="$HM/.claude/plugins/installed_plugins.json"
mkdir -p "$SB/bin"
printf '#!/bin/sh\n[ "$CLAUDE_STUB" = ok ] || { echo "stub claude failed" >&2; exit 1; }\n' > "$SB/bin/claude"
printf '#!/bin/sh\nexit 0\n' > "$SB/bin/npm"
chmod +x "$SB/bin/claude" "$SB/bin/npm"

R="$SB/repo"; H="$R/.git/hooks/pre-commit"; X="$R/.git/info/exclude"; OUT="$SB/out"
mkrepo() { rm -rf "$R" "$SB/wt"; git init -q "$R"; mkdir -p "$R/web/frontend" "$R/scripts/screenshots"; }
run() { # stub mode, then optional repo dir and HOME
  env -i PATH="$SB/bin:/usr/bin:/bin" HOME="${3:-$HM}" TIPPANI_DIR="${2:-$R}" CLAUDE_STUB="$1" \
    GIT_CONFIG_NOSYSTEM=1 bash "$SCRIPT" > "$OUT" 2>&1
  echo $? > "$SB/rc"
}
rc() { cat "$SB/rc"; }
last() { tail -1 "$OUT"; }
said() { grep -q -- "$1" "$OUT"; }
ver() { grep '^GUARD=' "$H" | grep -o 'claude-kit/[0-9.]*/' | head -1; }
stage_kit() { mkdir -p "$R/.claude/skills/t"; cp "$KITFILE" "$R/.claude/skills/t/"; git -C "$R" add -f .claude; }
unstage_kit() { git -C "$R" rm -rq --cached .claude; rm -rf "$R/.claude"; }
refuses() { (cd "$R" && ! env -i PATH=/usr/bin:/bin HOME="${1:-$HM}" sh .git/hooks/pre-commit >/dev/null 2>&1); }
line_from_out() { grep 'KIT_GUARD=' "$OUT" | sed 's/^  //'; }

mkrepo; run ok
check "fresh: exit 0, set up" '[ "$(rc)" = 0 ] && [ "$(last)" = "claude-kit: set up" ]'
check "fresh: hook names the recorded version" '[ "$(ver)" = "claude-kit/0.2.0/" ]'
check "fresh: thresholds written" 'python3 -c "import json,sys; e=json.load(open(\"$HM/.claude/settings.json\"))[\"env\"]; sys.exit(0 if all(e[k]==\"100000\" for k in (\"CLAUDE_KIT_DIGEST_MINUTES\",\"CLAUDE_KIT_DIGEST_EVERY\",\"CLAUDE_KIT_DIGEST_TOOLS\")) else 1)"'
check "fresh: no settings .tmp left" '[ ! -e "$HM/.claude/settings.json.tmp" ]'
stage_kit; check "fresh: the hook refuses a staged kit file" 'refuses'; unstage_kit
run ok
check "rerun: set up, one exclude line" '[ "$(last)" = "claude-kit: set up" ] && [ "$(grep -cx "/.visual-verify/" "$X")" = 1 ]'

run fail
check "claude failing: exit 0, both named" '[ "$(rc)" = 0 ] && said "marketplace add failed" && said "plugin install failed" && [ "$(last)" = "claude-kit: 2 step(s) need attention - see the lines above" ]'

cp "$HM/.claude/settings.json" "$SB/s"; echo '{broken' > "$HM/.claude/settings.json"; run ok
check "settings not JSON: left as it was, reported" '[ "$(cat "$HM/.claude/settings.json")" = "{broken" ] && said "not valid JSON"'
cp "$SB/s" "$HM/.claude/settings.json"

printf '#!/bin/sh\necho mine\n' > "$H"; cp "$H" "$SB/h"; run ok
check "someone else's hook: untouched, reported, line offered" 'cmp -s "$H" "$SB/h" && said "not the kit" && [ -n "$(line_from_out)" ]'
line_from_out >> "$H"; run ok
check "the offered line parses" 'sh -n "$H"'
check "a hook with the line is still reported" 'said "not the kit"'
stage_kit; check "the offered line refuses a staged kit file" 'refuses'
mkdir -p "$C/0.3.0"; cp -r "$C/0.2.0/skills" "$C/0.3.0/"; mv "$C/0.2.0" "$SB/v2"; mv "$C/0.10.0" "$SB/v10"
check "... and still does after the kit moves to 0.3.0" 'refuses'
rm -rf "$C/0.3.0"; mv "$SB/v2" "$C/0.2.0"; mv "$SB/v10" "$C/0.10.0"; unstage_kit

python3 "$G2" --hook | sed "s#$C/0.2.0#/gone/claude-kit/claude-kit/0.1.0#g" > "$H"; run ok
check "the kit's hook naming a gone version: rewritten to the recorded one" '[ "$(ver)" = "claude-kit/0.2.0/" ] && [ "$(last)" = "claude-kit: set up" ]'
python3 "$G2" --hook | sed '3i # an older wording' > "$H"; cp "$H" "$SB/h"; run ok
check "a kit hook whose text drifted: untouched, reported" 'cmp -s "$H" "$SB/h" && said "not the kit"'
{ printf '#!/bin/sh\nmake lint\n'; python3 "$G2" --hook | sed 1d; } > "$H"; cp "$H" "$SB/h"; run ok
check "the kit's text under someone's commands: untouched, reported" 'cmp -s "$H" "$SB/h" && said "not the kit"'

python3 "$G2" --hook > "$H"; cp "$H" "$SB/h"; mv "$G2" "$SB/g"; run ok
check "guard gone from the cache: hook kept, reported" 'cmp -s "$H" "$SB/h" && said "commit guard not written"'
mv "$SB/g" "$G2"

mv "$IP" "$SB/ip"; rm "$H"; run ok
check "no plugin record: the newest cached version" '[ "$(ver)" = "claude-kit/0.10.0/" ]'
mv "$SB/ip" "$IP"

mkrepo; printf '*.log' > "$X"; run ok
check "exclude with no final newline: the pattern on its own line" '[ "$(cat "$X")" = "$(printf "*.log\n/.visual-verify/")" ]'

mkrepo; git -C "$R" -c user.email=c@c -c user.name=c commit -q --allow-empty -m c
git -C "$R" worktree add -q "$SB/wt"; mkdir -p "$SB/wt/web/frontend" "$SB/wt/scripts/screenshots"; run ok "$SB/wt"
check "linked worktree: hook and exclude in the main .git" '[ -e "$H" ] && grep -qx "/.visual-verify/" "$X"'

mkrepo; git -C "$R" config core.hooksPath .githooks; run ok
check "core.hooksPath: the hook goes there" '[ -e "$R/.githooks/pre-commit" ] && [ ! -e "$H" ]'

mkrepo; stage_kit; git -C "$R" -c user.email=c@c -c user.name=c commit -q --no-verify -m c; run ok
check "a tracked kit file: the audit reports it" 'said "found kit files tracked"'

mkrepo; mv "$G2" "$SB/g"
printf 'import runpy, sys\nif "--tracked" in sys.argv: sys.exit(2)\nsys.argv[0] = "%s"\nrunpy.run_path("%s", run_name="__main__")\n' "$SB/g" "$SB/g" > "$G2"
run ok
check "the audit unable to run: said so, not blamed on files" 'said "could not run" && ! said "found kit files"'
mv "$SB/g" "$G2"

run ok "$SB/not-a-clone"
check "not a clone: a note, exit 0" '[ "$(rc)" = 0 ] && said "not a clone yet"'

HS="$SB/home with space"; mkhome "$HS"; mkrepo; run ok "" "$HS"
check "HOME with a space: set up" '[ "$(last)" = "claude-kit: set up" ]'
printf '#!/bin/sh\necho mine\n' > "$H"; run ok "" "$HS"; line_from_out >> "$H"; stage_kit
check "HOME with a space: the offered line refuses a staged kit file" 'refuses "$HS"'

echo "claude-kit-setup-check: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
