#!/usr/bin/env node
// The template a stranger fills in to add a language (design §10).
//
// GENERATED, NEVER HAND-WRITTEN, and that is the whole point: keys are added to
// internal/i18n/en.txt every time a screen gains a string, and a checked-in
// template would be stale by the following commit. Run this and the list is
// current by construction.
//
//   node scripts/locale-template.mjs                            print it
//   node scripts/locale-template.mjs --out data/Locales/fr.txt   write it
//   node scripts/locale-template.mjs --out … --force             overwrite
//
// IT REFUSES TO OVERWRITE unless told twice. The obvious way to use this is to
// re-run it after new keys land, and the obvious file to aim it at is the one
// already holding somebody's translation. Silently truncating that is not a
// mistake worth making possible.
//
// WHY THIS DOES NOT SHARE THE PARSER in web/frontend/src/i18n.js, when almost
// everything else in this work does. That parser answers "what does this file
// MEAN" and deliberately throws away the two things a template is made of: the
// order the keys were written in, and the `#` comments above them. Those comments
// are the translator's only context (§2 puts real weight on them — they are what
// replaces having the English at the call site), so this walks the lines instead.
// It is a different question over the same format, not a second parser: the only
// rules it repeats are "the first = splits" and "a leading # is a comment".
//
// No dependencies, and none wanted: it runs on a bare `node`.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'internal', 'i18n')

const argv = process.argv.slice(2)
const FORCE = argv.includes('--force')
const outAt = argv.indexOf('--out')
const OUT = outAt >= 0 ? argv[outAt + 1] : ''

if (outAt >= 0 && !OUT) {
  console.error('--out needs a path, e.g. --out data/Locales/fr.txt')
  process.exit(2)
}

// read walks one locale file and keeps what a template needs: the keys in the
// order they appear, each with the comment block directly above it.
//
// A BLANK LINE ENDS A COMMENT BLOCK, which is what separates a key's context from
// the file's own header and from a section divider. It is also how en.txt is
// written, so the rule and the file agree rather than one apologising for the
// other.
function read(code) {
  const path = join(SRC, `${code}.txt`)
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const order = []
  const values = new Map()
  const notes = new Map()
  let pending = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') {
      pending = []
      continue
    }
    if (line.startsWith('#')) {
      pending.push(line.replace(/^#\s?/, ''))
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0) continue // a mangled line costs one string here too
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!key) continue
    if (!key.startsWith('_')) {
      if (!values.has(key)) order.push(key)
      values.set(key, value)
      if (pending.length) notes.set(key, pending.slice())
    }
    pending = []
  }
  return { order, values, notes }
}

const en = read('en')
const bn = read('bn')

// The union, in en's order first, then anything only bn has. Union rather than
// en's list alone for the same reason coverage is measured against the union:
// neither language is the source, so a key one of them has is a key the template
// has to offer.
const keys = [...en.order]
for (const key of bn.order) if (!keys.includes(key)) keys.push(key)

const out = []
const say = (line = '') => out.push(line)

say('# A tippani language. Rename this file to your language code: fr.txt, pt-br.txt.')
say('# Drop it in data/Locales/ and it appears in the picker — no rebuild, no restart.')
say('#')
say('# One key = value per line. The FIRST = splits, so a value may contain =.')
say('# A line starting with # is a comment. Blank lines are ignored.')
say('# An empty value counts as NOT TRANSLATED and falls back — so a half-finished')
say('# file is safe to use, and the picker shows how far you have got.')
say('# A line with no = costs exactly that one string; the rest of the file loads.')
say('#')
say('# The comments above each key are its context, then the English and Bengali for')
say('# reference. Translate from whichever you read.')
say('')
say('# --- the three reserved keys ---------------------------------------------')
say('')
say('# REQUIRED. How your language is labelled in the picker, in your own language.')
say('_name =')
say('')
say('# Optional. Which language fills your gaps before a built-in does. A cycle')
say('# between two files is detected and broken, so it costs nothing to get wrong.')
say('# _fallback = en')
say('')
say('# Optional, and honest about its limits: rtl flips TEXT DIRECTION only. The')
say('# layout has NOT been audited for right-to-left — expect misplaced icons and')
say('# edges. It is offered because no direction at all is worse.')
say('# _dir = rtl')
say('')
say(`# --- ${keys.length} string${keys.length === 1 ? '' : 's'} ---------------------------------------------------`)

for (const key of keys) {
  say('')
  for (const note of en.notes.get(key) || bn.notes.get(key) || []) say(`# ${note}`)
  // Trimmed, so an untranslated reference line is `# bn:` rather than `# bn: `
  // with a trailing space nobody typed.
  say(`# en: ${en.values.get(key) || ''}`.trimEnd())
  say(`# bn: ${bn.values.get(key) || ''}`.trimEnd())
  say(`${key} =`)
}

const text = out.join('\n') + '\n'

if (!OUT) {
  process.stdout.write(text)
  console.error(`\n${keys.length} keys (en has ${en.order.length}, bn has ${bn.order.length})`)
  process.exit(0)
}

const dest = join(ROOT, OUT)
if (existsSync(dest) && !FORCE) {
  console.error(`${OUT} already exists. Somebody's translation may be in it — pass --force to overwrite.`)
  process.exit(1)
}
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, text, 'utf8')
console.error(`wrote ${OUT} — ${keys.length} keys to fill in`)
