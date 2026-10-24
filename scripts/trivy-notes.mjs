// Renders Trivy JSON reports as the "Known vulnerabilities" section of the release notes.
//
//   node scripts/trivy-notes.mjs trivy-fs.json trivy-image.json >> notes.md
//
// A report that is missing or unreadable is skipped and the section says so, because the scan
// never blocks a release: a release page that silently claimed "none" after a failed scan would
// be worse than one that says the scan did not complete.
//
// Two lists. OPEN is what the scan found and nobody has accepted. ACCEPTED is what `.trivyignore.yaml`
// suppresses, each with the statement written beside it, so a reader of the release page sees the
// reasoning and not only the ID.

import { readFileSync } from 'node:fs'

const files = process.argv.slice(2)
const open = new Map()
const accepted = new Map()
const skipped = []

// One entry per finding, however many files it was found in: the locations are merged.
function add(map, key, row) {
  const have = map.get(key)
  if (!have) map.set(key, { ...row, wheres: [row.where] })
  else if (!have.wheres.includes(row.where)) have.wheres.push(row.where)
}

for (const file of files) {
  let report
  try {
    report = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    skipped.push(file)
    continue
  }
  for (const result of report.Results ?? []) {
    for (const v of result.Vulnerabilities ?? []) {
      add(open, `${v.VulnerabilityID}|${v.PkgName}`, {
        id: v.VulnerabilityID,
        url: v.PrimaryURL,
        pkg: `${v.PkgName} ${v.InstalledVersion}`,
        severity: v.Severity,
        fixed: v.FixedVersion || 'no fix yet',
        where: result.Target,
      })
    }
    for (const s of result.Secrets ?? []) {
      add(open, `secret|${s.RuleID}|${result.Target}|${s.StartLine}`, {
        id: s.RuleID,
        pkg: 'secret',
        severity: s.Severity,
        fixed: 'remove and rotate',
        where: `${result.Target}:${s.StartLine}`,
      })
    }
    for (const m of result.Misconfigurations ?? []) {
      add(open, m.ID, {
        id: m.ID,
        url: m.PrimaryURL,
        pkg: m.Title,
        severity: m.Severity,
        fixed: 'see the rule',
        where: result.Target,
      })
    }
    for (const f of result.ExperimentalModifiedFindings ?? []) {
      if (f.Status !== 'ignored') continue
      const v = f.Finding ?? {}
      const id = v.VulnerabilityID ?? v.ID ?? v.RuleID ?? 'unknown'
      add(accepted, `${id}|${v.PkgName ?? ''}`, {
        id,
        url: v.PrimaryURL,
        pkg: v.PkgName ? `${v.PkgName} ${v.InstalledVersion ?? ''}`.trim() : '',
        severity: v.Severity,
        fixed: v.FixedVersion || 'no fix yet',
        where: result.Target,
        statement: (f.Statement ?? '').trim(),
      })
    }
  }
}

const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const bySeverity = (a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.id.localeCompare(b.id)
const link = (r) => (r.url ? `[${r.id}](${r.url})` : r.id)
const where = (r) => r.wheres.map((w) => `\`${w}\``).join(', ')
const row = (r) => `| ${link(r)} | ${r.pkg} | ${r.severity ?? ''} | ${r.fixed} | ${where(r)} |`
const head = '| ID | Package | Severity | Fixed in | Where |\n| --- | --- | --- | --- | --- |'

const out = ['## Known vulnerabilities', '']
out.push(
  'Scanned with [Trivy](https://trivy.dev) at release time: Go and npm dependencies, committed secrets, the Dockerfile and the built image. ' +
    'This section is informational and never blocks a release.',
  '',
)
if (skipped.length) out.push(`**The scan did not complete** (no readable report: ${skipped.join(', ')}). Treat the lists below as incomplete.`, '')
if (open.size === 0 && !skipped.length) {
  out.push('**None open.**', '')
} else if (open.size) {
  out.push('### Open', '', head, ...[...open.values()].sort(bySeverity).map(row), '')
}
if (accepted.size) {
  out.push('### Accepted, with the reason', '')
  for (const r of [...accepted.values()].sort(bySeverity)) {
    out.push(`- **${link(r)}** — ${r.pkg ? `${r.pkg}, ` : ''}${(r.severity ?? '').toLowerCase()}, fixed in ${r.fixed}, in ${where(r)}.`)
    if (r.statement) out.push(`  ${r.statement}`)
  }
  out.push('')
}
process.stdout.write(out.join('\n'))
