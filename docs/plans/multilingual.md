# Multilingual — the Bengali half, and anyone else's

**Status:** the mechanism and the English catalogue **shipped in 2.1.0**; the Bengali
**shipped in 2.1.1**, all 2,447 keys. This file is now the record of how, and of what is
still open — the two are different lists and only the second one is work.

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

## How the Bengali got written

Six writers in two passes — three over the shell, the screens and the help panel, then three
more over the 722 keys the first pass did not reach — each working from the style sheet
below rather than from the English alone. Their fragments were staged in
`internal/i18n/parts/`, merged into `bn.txt` in `en.txt`'s key order, and **deleted**; the
merge is in the 2.1.1 history if it is ever needed.

What the merge was checked against, after the fact and mechanically, because six writers is
six registers unless something proves otherwise:

| Check | Result |
| :-- | :-- |
| Key set identical to `en.txt`, same order, no duplicates, no empty values | 2,447 / 2,447 |
| Placeholder parity — every `{hole}` present, in every string | 0 mismatches |
| Nothing lost in the merge: every fragment key present in `bn.txt` | 0 lost |
| Where writers disagreed, `bn.txt` holds one of **their** values, not a third | 442 contested, 0 invented |
| সাধু (literary) register markers — ইহা, তাহা, করিয়া, হইবে, নাই | 0 |
| তুমি / তুই anywhere in the interface | 0 |
| আপনি spelled out where Bengali would drop it | 0 |
| The domain terms, used consistently | দাগ 59 · সংলাপ 51 · উক্তি 53 · উদ্ধৃতি 142 · হাইলাইট 0 · কোট 0 |
| টিপ্পনী used for anything but the app's name | 0 of 13 |
| Sanskritised coinage where the style sheet keeps the loanword | 0 |
| Bengali numerals in literal text, where `{n}` interpolates ASCII | 0 |
| The help budgets — `what` ≤ 160, `how` ≤ 120, `more` ≤ 420 | 0 over, in any role |

The scripts are throwaway and were not kept; the checks that should not be throwaway became
tests instead (`help-budget`, `locale-complete`, `translated-not-sliced`).

**One real defect fell out of the translation**, which is the argument for doing it at all:
the stats calendar labelled its x axis with `monthName(m).slice(0, 3)`. Three UTF-16 code
units is "three letters" only in English — এপ্রিল became এপ্ and অক্টোবর became অক্, while the
other ten months survived and made it look fine. Fixed in 2.1.1 by taking the axis from
`MONTH_KEYS`, the twelve written abbreviations the date picker already used.

## What is left

### 1. The style sheet is a decision, not a suggestion

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

### 2. Verified — and what the tests now hold

The list below was written as "never verified". It is verified now, and the checks live in
tests rather than in this file, which is the only way they stay true:

- **A stranger adding a language** — `locale-resolve.test.js`, "the fallback chain (§8)": a
  new `fr` file appears in the picker, is labelled from `_name`, renders its own strings and
  falls back for the rest, with **no code change**. The `_fallback` chain is followed through
  two hops, a `_fallback` naming nobody is ignored rather than fatal, and **a cycle
  terminates** — including a language that is its own fallback.
- **The broken-config cases** — `internal/i18n/i18n_test.go` and `locale-parser.test.js`
  between them cover a mangled line (costs one string, not the file), a value containing `=`,
  a `#` comment, a BOM before the first key, an empty value meaning *absent*, an empty file,
  a missing directory, an empty directory, and a re-read when a file changes. An unknown
  locale in prefs renders a built-in rather than blanking — `locale-resolve.test.js`, "the
  preference is open (§4)".
- **Coverage** — `locale-resolve.test.js`, "coverage (§7)", and the number is asserted rather
  than displayed on trust.

### 3. Known gaps, recorded rather than discovered later

- **The pseudo-locale coverage number has still never been read** — how many user-facing
  strings are *still* English literals in the source, as opposed to keys. `locale-complete`
  proves every key in the file is reached and every key the code asks for exists, which is a
  different claim: it cannot see a string that never became a key. The merge agent named
  eight files and nine Settings cards it did not reach. **This is the honest measure of the
  migration and the one number nobody has.**
- **The Go side's own user-facing strings are not in the catalogue.** Deliberately out of
  scope for this pass; they are listed in the mechanism agent's report.
- **English `-s` plural fallbacks in `works.jsx`** (`nounPlural = ${noun}s`) are English
  grammar living in code. Unreachable today because every call site passes `nounPlural`, but
  removing them changes three component signatures.
- **The danda rule is written** — this was a gap and is now closed. `help-budget.test.js`
  holds a sentence-break pattern **per language**: `[.?!]\s+[A-Z“]` for English, `।\s+\S` for
  Bengali. Bengali's counts only the danda, not `?` or `!`, because this app's help copy
  *names* those two as keys — `common.help.keyboard.what` opens with "? চাপলে", the ? being
  the key you press, and counting it read one sentence about a question mark as two. A
  compiled-in language with no rule is now a test failure rather than a silent exemption, so
  a third built-in forces somebody to answer the question.

---

## Deliberately not built

**A translation library.** The resolver is a map lookup and a fallback chain. Nothing here
needs plurals-by-locale machinery yet; when it does, `_` reserved keys are where it goes.

**Enforced completeness for any language.** See the table.

**An RTL layout audit.** `_dir` flips text direction and that is all it claims.
