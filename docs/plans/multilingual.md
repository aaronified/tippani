# Multilingual — the Bengali half, and anyone else's

**Status:** the mechanism and the English catalogue **shipped in 2.1.0**. The Bengali is
written but not merged. This file exists for the session that finishes it.

The design is settled and was arrived at the expensive way — four rejected drafts and a
question round that should have come first. Do not redesign it. It is recorded in
`docs/PLAN.md` under §13 once this ships; until then, here.

---

## What shipped

`internal/i18n/` — `en.txt` (2,446 keys), `bn.txt` (a scaffold: `_name = বাংলা`),
`i18n.go`, `README.md`, `testdata/`. The frontend imports the same bytes through
`web/frontend/src/i18n.js`; the Go binary embeds them.

| Decision | Why it is that way |
| :-- | :-- |
| **No source language.** The code holds keys only — `t('library.filters.genre.placeholder')`, never an English fallback argument. | The owner: *"do not make it work like random apps… it is supposed to be at least bilingual from inception"*, then *"i say translate, but i mean trilingual, and quadrilingual, etc."* An English literal at the call site makes every other language a patch that chases it. |
| **Keys are long and self-describing**, with a `#` comment above any whose context the string cannot give. 1,299 of the 2,446 carry one. | The English left the call site, so the key is what a maintainer reads. A key nobody can read is a call site nobody can read. |
| **English and Bengali are both compiled in.** | So a missing, empty or corrupt config directory cannot leave the app with no text. Both, so neither is the other's last resort. |
| **Any other language is config-only**: `data/Locales/xx.txt`. | Which forces the locale pref to be validated against what exists rather than a constant list. |
| **`data/Locales` overrides the embedded copies**, per key, including `en.txt`. | The override path privileges nobody either. Any word in the app is the owner's to change without a rebuild. |
| **Coverage is shown, never enforced.** | Demanding completeness means no contributions. One test *does* fail if the percentage is wrong: a lying number is worse than none. |
| **`_name`, `_fallback`, `_dir`** — reserved, underscore-prefixed, never rendered. | `_fallback` lets a language name its neighbour before a built-in (Bhojpuri → Hindi → built-in), with a cycle guard. `_dir = rtl` flips direction and the README says plainly the **layout has not been audited for RTL**. |
| **An empty value means absent, not empty.** `key =` is unfilled; the resolver walks on. | This is what lets the generated template be dropped in half-finished without blanking the interface. It is the rule that makes the format usable by a stranger. |

**Why `internal/i18n/` and not the frontend tree**, which the plan originally said: `go:embed`
cannot escape its own package directory, so a file under `web/frontend` cannot be compiled
into the binary — and both built-ins must be. Vite resolves anything, so the frontend reaches
across. One file, two consumers, nothing to drift.

---

## What is left

### 1. Merge the Bengali — it is written, not lost

Three writers produced **2,214 of 2,446 keys** before the session limit stopped them. The
fragments are at:

```
.claude/tmp/bn-partial/bn-1.txt    730 keys   the shell and the controls
.claude/tmp/bn-partial/bn-2.txt   1061 keys   the screens
.claude/tmp/bn-partial/bn-3.txt    423 keys   help and the info dots (INCOMPLETE)
```

`.claude/` is gitignored and is a scratch directory — **check these still exist before
planning around them**, and if they are gone, the style sheet below is what makes rewriting
them cheap rather than a fresh start.

To finish: complete fragment 3, concatenate into `internal/i18n/bn.txt` in `en.txt`'s key
order keeping its section comments and the existing `_name` line, reconcile any term the
three rendered differently (**§3 of the style sheet wins**), then delete the fragments.

### 2. The style sheet is a decision, not a suggestion

[`bengali-style.md`](bengali-style.md), 918 lines, beside this file. It is what stops three
parallel writers producing three registers in one interface. Its load-bearing calls:

- **চলিত, not সাধু** — modern colloquial. Software Bengali drifts into literary register and
  reads like a government form; that is the failure mode above all others.
- **আপনি, but drop the pronoun** — §1.3 calls this the single biggest fluency lever.
- **The three domain terms**, which matter more than any single label:
  a book highlight → **দাগ** (*বইয়ে দাগ দেওয়া* — the mark stands for the line it marks, and
  it is what the coloured bar on the card literally is), a film line → **সংলাপ**, a
  standalone quote → **উক্তি**, with **উদ্ধৃতি** as the umbrella.
- **টিপ্পনী is reserved** and does one job only, because the app is called that: *টিপ্পনীতে
  ১২টি টিপ্পনী* is unusable.
- A 60-word term table (§3), the loanword line (কভার, ট্যাগ, ফাইল stay; Sanskritised coinage
  does not), and three worked calque-versus-written examples (§5).

### 3. Never verified

The sceptic never ran. Nothing below has been proven, and all of it should be, because it is
the difference between the feature working and appearing to:

- **A stranger adding a language.** Run the template script, write `data/Locales/fr.txt` with
  `_name` and two keys, and confirm: French appears in the picker labelled from `_name`,
  those two strings render, the rest falls back, the coverage percentage is right, and
  nothing logs an error a contributor would read as failure. **If any step needs a code
  change, the requirement is not met.**
- **The broken-config cases**, which are the normal case for a hand-edited file: no
  directory, empty file, BOM, a line with no `=`, a value containing `=`, trailing spaces in
  a key, an unknown locale in prefs, a `_fallback` cycle. Each must degrade, never blank.
- **The pseudo-locale coverage number** — how many user-facing strings are *still* English
  literals in the source. The honest measure of the migration, and it has never been read.
  The merge agent named eight files and nine Settings cards it did not reach.

### 4. Known gaps, recorded rather than discovered later

- **"`what` is one sentence" is Latin-script only.** The rule counts `[.?!]\s+[A-Z“]`;
  Bengali has no case, so a Bengali paragraph passes it and is caught only by the 160-char
  cap. A দাঁড়ি (danda) rule is worth writing once there is Bengali prose to write it against.
- **The Go side's own user-facing strings are not in the catalogue.** Deliberately out of
  scope for this pass; they are listed in the mechanism agent's report.
- **English `-s` plural fallbacks in `works.jsx`** (`nounPlural = ${noun}s`) are English
  grammar living in code. Unreachable today because every call site passes `nounPlural`, but
  removing them changes three component signatures.
- **The help `more` bodies are in the catalogue** (the owner chose the largest scope), so
  Bengali owes ~23,000 characters of folded prose. Fragment 3 is where that lives and is the
  one that did not finish.

---

## Deliberately not built

**A translation library.** The resolver is a map lookup and a fallback chain. Nothing here
needs plurals-by-locale machinery yet; when it does, `_` reserved keys are where it goes.

**Enforced completeness for any language.** See the table.

**An RTL layout audit.** `_dir` flips text direction and that is all it claims.
