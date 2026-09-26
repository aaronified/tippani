// THE JOURNEYS JOB'S SANDBOX PROBE NAMES EVERY OUTCOME RIGHTLY.
//
// scripts/sandbox-probe.sh starts Chrome with its setuid fallback off, then on if
// the first start found no sandbox, and says which one Chrome rests on. It was
// written into ci.yml and rewritten three times (9cc0d685, cba26beb, ba2552f0),
// and each time a rater found an outcome it named wrong by writing a stub Chrome
// by hand, the last a misconfigured setuid helper read as "not the sandbox". So
// the outcomes are cases here, run against a stub, and what is asserted is what a
// maintainer reads on the run page: the annotation, and whether the job fails.
//
// It knows the script's command line and its two settings (CHROME_PATH and
// SANDBOX_PROBE_TIMEOUT), and Chrome's own messages, which the stub prints.

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SCRIPT = join(REPO, 'scripts', 'sandbox-probe.sh')

// A Chrome that behaves as told: M1 is the start with the setuid fallback off,
// M2 the one with it allowed.
const dir = mkdtempSync(join(tmpdir(), 'sandbox-probe-'))
const CHROME = join(dir, 'chrome')
writeFileSync(CHROME, `#!/usr/bin/env bash
case "$*" in *--disable-setuid-sandbox*) m=$M1;; *) m=$M2;; esac
case $m in
  ok) exit 0;;
  nosb) echo "FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!" >&2; exit 133;;
  suidbad) echo "FATAL:setuid_sandbox_host.cc(163)] The SUID sandbox helper binary was found, but is not configured correctly." >&2; exit 133;;
  hang) sleep 30;;
  other) echo "boom" >&2; exit 7;;
  silent) exit 9;;
esac
`)
chmodSync(CHROME, 0o755)
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function probe(m1, m2 = 'ok') {
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CHROME_PATH: CHROME, SANDBOX_PROBE_TIMEOUT: '1', M1: m1, M2: m2 },
  })
  return { code: r.status, out: r.stdout + r.stderr }
}

describe('the sandbox probe', () => {
  const cases = [
    ['ok', 'x', 0, /the namespace sandbox starts/],
    ['nosb', 'ok', 0, /::warning::the namespace sandbox does not start here; Chrome started on its setuid chrome-sandbox/],
    ['nosb', 'hang', 1, /::error::.*did not finish within 1s, so whether that sandbox works is unknown/],
    ['nosb', 'nosb', 1, /::error::neither sandbox starts: no user namespace, and no chrome-sandbox helper/],
    ['nosb', 'suidbad', 1, /::error::neither sandbox starts: no user namespace, and the chrome-sandbox helper is missing or not owned by root/],
    ['nosb', 'other', 1, /::error::.*exited 7 for a reason it did not name as the sandbox/],
    ['nosb', 'silent', 1, /::error::.*exited 9 for a reason it did not name as the sandbox/],
    ['hang', 'x', 0, /::warning::the sandbox probe did not finish within 1s, so it says nothing about the sandbox/],
    ['silent', 'x', 0, /::warning::the sandbox probe exited 9 for a reason other than the sandbox/],
    ['other', 'x', 0, /boom[\s\S]*::warning::the sandbox probe exited 7 for a reason other than the sandbox/],
  ]
  for (const [m1, m2, code, says] of cases) {
    it(`first start ${m1}, fallback ${m2}: exits ${code} and says so`, () => {
      const r = probe(m1, m2)
      expect(r.out).toMatch(says)
      expect(r.code, r.out).toBe(code)
    })
  }
})
