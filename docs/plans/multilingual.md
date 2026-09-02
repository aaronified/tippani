# Multilingual — the Bengali half, and anyone else's

**Status:** the mechanism and the English catalogue **shipped in 2.1.0**; the Bengali
**shipped in 2.1.1**, all 2,446 keys. The eight files and nine Settings cards that pass left
behind are **done too**, at 3,223 keys per language, and a test now holds the property
instead of a comment — see §3. This file is the record of how, and of what is still open;
the two are different lists and only the second one is work.

**The design itself now lives in [`docs/PLAN.md`](../PLAN.md) §13**, as *"There is no source
language: the code holds keys, and English is a file like any other"* — that entry is the one to
read, and the one to keep current. What stays here is the part a decision log is the wrong shape for:
how a six-writer translation was checked after the fact, and the short list of what is still open.

The design was arrived at the expensive way — four rejected drafts and a question round that should
have come first. Do not redesign it.

---

## What shipped

`internal/i18n/` — `en.txt` and `bn.txt` (2,456 keys each), `i18n.go`, `README.md`,
`testdata/`. The frontend imports the same bytes through `web/frontend/src/i18n.js`; the Go binary
embeds them. **Every design decision behind that shape — no source language, both built-ins
compiled in, config-only languages, an empty value meaning absent, the reserved `_` keys, and why
the files live in a Go package rather than in the frontend tree — is one entry in
[`docs/PLAN.md`](../PLAN.md) §13.** It is not repeated here, because two copies of a design is one
copy that goes stale.

## How the Bengali got written

Six writers in two passes — three over the shell, the screens and the help panel, then three
more over the 722 keys the first pass did not reach — each working from the style sheet
below rather than from the English alone. Their fragments were staged in
`internal/i18n/parts/`, merged into `bn.txt` in `en.txt`'s key order, and **deleted**; the
merge is in the 2.1.1 history if it is ever needed.

**A third pass rewrote the whole file (v3, 2.2.x).** One writer, every one of the 3,385
keys, working from a per-key dossier — the English, the context comment, the source line
that renders it, its budget — rather than from the English alone, with the brief that the
app should read as if it had been written in Bengali first: say what a control does where
the English only names it, and use the written Bengali of today (ডিভাইস, ট্যাপ, এনক্রিপ্ট,
ফন্ট, রিলোড) rather than a coined native word nobody says. The register, the orthography and
the দাগ / সংলাপ / উক্তি / উদ্ধৃতি system were kept; every term that changed is listed at the
foot of the style sheet under "v3 decisions", and the header of `bn.txt` now says outright
that it is not a translation of `en.txt`. The checks in the table below were run again over
the result, and an independent rating pass read it against the brief before it landed.

What the merge was checked against, after the fact and mechanically, because six writers is
six registers unless something proves otherwise:

| Check | Result |
| :-- | :-- |
| Key set identical to `en.txt`, same order, no duplicates, no empty values | 2,446 / 2,446 |
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

[`bengali-style.md`](bengali-style.md), beside this file. It is what stops three
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
- **Every token, in every language in the box** — `token-coverage.test.js`. This is the
  standing rule as a build failure: a feature ships its tokens, and the tokens ship their
  English *and* their Bengali, in the same commit. Nothing enforced that until now — a key
  added to `en.txt` and forgotten in `bn.txt` cost nothing at all. The suite stayed green,
  and the only symptom was an English sentence in the middle of a Bengali screen, which the
  reader who chose Bengali is the least able to report.

  **The two kinds of language are held to different standards, and the difference is not a
  compromise.** A compiled-in language is part of the product: nobody chose to install
  `bn.txt` and nobody but us can fix it, so it must carry every token. A file in
  `data/Locales` is somebody else's work in progress, and §7 is explicit that a
  half-finished one is the supported normal — so nothing is demanded of it. What is asserted
  is that the *number* it gets is honest, which is what §7 actually cares about: coverage
  divides by `fullKeys()`, so one dead string in a shipped file silently caps every
  translator in the world below 100%.

  **Plurals are the one place a language may hold fewer strings**, and the test asks
  `Intl.PluralRules` which forms that language can select rather than listing them —
  Japanese selects only `other`, Polish four. It also refuses the opposite: a `.few` in a
  file whose language has no `few` is dead copy the completeness check would excuse forever.

  The scan itself moved to `test/token-scan.js` when this test needed the same answer
  `locale-complete.test.js` was already computing; two extractions over one tree is how the
  two come to disagree about which keys are reachable.

### 3. Known gaps, recorded rather than discovered later

- **The pseudo-locale coverage number has been read, and it is zero.** This entry used to
  say the number was the honest measure of the migration and that nobody had it. The eight
  files the merge agent never reached — `Account.jsx`, `ImportPage.jsx`, `StagingPage.jsx`,
  `BinPage.jsx`, `MetadataPage.jsx`, `ReverifyReview.jsx`, `CoverPicker.jsx`, `people.jsx` —
  and the nine Settings cards have all landed, at 3,223 keys per language with Bengali still
  complete.

  **What holds it is a test, not this paragraph.** `test/dom/screens-i18n.test.jsx` mounts
  every screen `App` can route to under `qps` and fails on any readable plain-ASCII string,
  in a rendered attribute as well as in the page. The screen list is `test/screens.js`,
  shared with the mount smoke test so the two cannot disagree, and derived from the
  `data-screen-label` attributes `App` itself carries.

  **Four values are keyed and deliberately identical in both languages** — the wordmark, the
  `{n}px` size readout, the four characters the credit splitter matches, and the `dev`
  version stamp. They pass through the resolver so the gate can see them; a list of
  exemptions inside the gate is where the next untokenised screen would have hidden.

  **What the pass found, which is the argument for doing it rather than only recording it:**
  three tables that held a key and drew it raw (the shortcut sheet's five headings had been
  the key for as long as the sheet existed); four `t` shadows waiting to break their file
  silently; a `kind → noun` map missing its `studio` row, so the People console read "5
  undefineds still need photos or links"; twenty parenthesised `item(s)` plurals; and
  `label.toLowerCase()` building nine sentences in the cover picker — English casing used as
  grammar, in a language that has no case.
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
