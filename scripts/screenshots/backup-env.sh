#!/usr/bin/env bash
# WHERE THE ARCHIVE IS, READ FROM ONE FILE, AND EVERY WAY THAT READING FAILED.
#
# THE OWNER'S RULING, 7 September: "why don't you use the backup instead for
# seeding? … save it in your claude.md to use it for all tests." So the archive is
# the default, and `backup.env` beside this script is where its path, its
# passphrase and the account inside it live — gitignored, because the archive is
# somebody's library and those credentials open it.
#
# EVERY FAILURE HERE IS SILENT AND FALLS BACK TO SEEDING, which is why the parsing
# is its own file with its own tests. A harness with no `TIPPANI_BACKUP` seeds and
# says so on its first line — correct when there is no archive, and indistinguishable
# from an archive whose line was dropped. Four ways that happened:
#
#   NO TRAILING NEWLINE. `read` returns false on a final line that has none,
#   having read it perfectly well, so `while read` discards it — and an editor
#   that saves without one dropped whichever variable came last.
#
#   `export FOO=bar`. A line that reads like a shell setting, because it is one,
#   and an allowlist matching `FOO=*` does not see it.
#
#   A QUOTED VALUE. `TIPPANI_BACKUP="/path/with a space.tpbk"` kept its quotes, so
#   the path did not exist.
#
#   CRLF. The value ends in a carriage return, so again the path does not exist.
#
# AND THE ALLOWLIST STAYS. A stray line in that file may not set anything else in
# a shell that is about to run a browser as root, so exactly four names are read
# and everything else is ignored.
#
# THE ACCOUNT IS NOT PUT INTO `TIPPANI_USER` HERE. `run-with-backup.sh` does that,
# after a restore has actually happened — loaded straight, a SEEDED run picked the
# archive's credentials up and tried to sign in to the fixture as somebody who
# does not exist there. Every surface reported "did not render".

# Reads `backup.env` from this script's own directory. An environment variable
# already set wins, so a one-off run can override the file.
backup_env_load() {
  local env_file line key value
  env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup.env"
  [ -f "$env_file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    # Leading whitespace, then an `export ` prefix, then whatever whitespace that
    # was hiding.
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      export[[:space:]]*) line="${line#export}"; line="${line#"${line%%[![:space:]]*}"}" ;;
    esac
    case "$line" in
      TIPPANI_BACKUP=*|TIPPANI_BACKUP_PASSWORD=*|TIPPANI_BACKUP_USER=*|TIPPANI_BACKUP_PASS=*) ;;
      *) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    # ONE MATCHING OUTER PAIR ONLY. A path with a space in it has to be quotable
    # and the quotes are not part of the path; a passphrase may legitimately
    # contain a quote, so nothing else is stripped.
    if [ "${#value}" -ge 2 ]; then
      case "$value" in
        \"*\") value="${value#\"}"; value="${value%\"}" ;;
        \'*\') value="${value#\'}"; value="${value%\'}" ;;
      esac
    fi
    [ -n "${!key:-}" ] || export "$key=$value"
  done < "$env_file"
}
