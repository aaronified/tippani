# ADR-0920: A quote is matched in the script it was written in

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md)

**Why this was looked at.** The matcher (`internal/srcmatch`) finds a quote inside the file it came from, and it was written and
measured on English. The library holds Bengali, and a Bengali interface exists, so it was tested on eight scripts: Bengali, Hindi,
Russian, French, Arabic, Japanese, Chinese and Thai. Every one was found, but for three reasons that were luck.

**What was wrong.**

- **Vowel signs were treated as punctuation.** The comparison form kept only letters and digits. In Bengali, Hindi and Thai the
  vowel signs, the virama and the tone marks are marks, not letters, so a word was cut into fragments ("আমি" became "আম"). Fragments
  are short and common, so a lookup found too many places, and a short Bengali quote was judged against a budget that was too
  small.
- **Languages with no spaces were looked up by whole clauses.** Matching finds candidate places by the quote's words. Japanese,
  Chinese and Thai put no spaces between words, so a "word" was a whole clause and a quote taken from inside a sentence shared
  nothing with the file. A Japanese or Chinese quote from the middle of a sentence was **not found at all**.
- **A word edge was required of a word-for-word hit.** That is right for "yes" inside "yesterday" and cannot be asked of a script
  with no word edges.
- Smaller: an accent written as a separate combining mark ("e" then U+0301) cost an edit against the plain "é"; Russian "ё" and "е"
  cost one.

**What replaced it.**

- A mark that belongs to a word (an Indic vowel sign, a virama, a Thai tone mark) stays in the comparison form. A mark that texts
  print or leave out at will (a combining accent, Hebrew points, Arabic vowel points) is dropped, as an apostrophe is.
- In Han, Hiragana, Katakana, Thai, Lao, Khmer and Myanmar text, a run of four or more letters is looked up as overlapping runs of
  four letters. The file is indexed on every second position and a quote on every position, so one of the quote's keys is always one
  the file holds, whatever the alignment.
- A word-for-word hit may begin or end beside a letter of those scripts.
- "ё" folds to "е".
- A scan matches titles with a leading article removed on both sides (the, a, an, le, la, les, el, los, las, der, die, das, il), so
  "Fires of Heaven" is "The Fires of Heaven" ([#62](https://github.com/aaronified/tippani/issues/62)).

**What is still not covered.** Korean uses spaces and is looked up as any spaced language. Right-to-left text is compared as the
letters it holds. Scripts not named above that have no spaces are looked up as spaced text. Nothing here reorders, transliterates
or translates: a quote and its file have to be in the same script.

See also: [Source files and context](Source-Files-And-Context.md) · [ADR index](ADR-Index.md) · [Home](Home.md)
