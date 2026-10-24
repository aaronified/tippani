# ADR-0789: A quote's third text, and which reader gets asked for it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's request came with its own worked example:

    অতি সন্ন্যাসীতে গাজন নষ্ট (Ati sannyasite gajon nosto)
    Literal translation: Too many ascetics ruin the festival.
    Similar to "too many cooks spoil the broth"

Four parts, and the ruling on each was theirs: the bracketed romanisation becomes a new
column; the literal translation is the EXISTING `translation` (no separate literal field);
and the counterpart — "similar to too many cooks" — gets **no column at all**, because they
will use the note. That last one is worth recording as a decision rather than an omission:
a counterpart could have been a link to another quote in the library, which is a join table
and a picker, and the owner declined it for now.

WHY THE ROMANISATION IS NOT A SECOND USE OF THE TRANSLATION. It says nothing about the
meaning. A reader who cannot read the script still cannot tell you what the proverb is
about after reading it, and a reader who wants to say it aloud gets nothing from the
translation — so a single column holding either would make the field mean two things at
once, and the review deck would prompt with a pronunciation where it promised a meaning.
That is the argument 0051 made about the note, one field over.

EVERY KIND, on the owner's word: "All quote shall get one." It therefore goes on the shared
`quoteReq`/`quoteRow` rather than on the standalone quote alone — a Bengali line highlighted
in a book wants this exactly as much as a proverb does, which is the test `Language` failed
in 0051 and this passes.

### The gate is the reader's script, not the quote's language

The owner's rule: *"All quote shall get one, but will only be shown for scripts that are not
the same as the chosen language. User may want to store bengali transliteration
everywhere."*

Read carefully, that is not "show it for Bengali". It is the reader's own locale that decides
— so the app in Bengali must offer a BENGALI romanisation of an English quote, and neither
script is hardcoded as the strange one. A "romanise into Latin" rule would have shipped half
the feature and looked complete.

WHICH MEANT THE LANGUAGE FIELD COULD NOT BE THE INPUT. A language here is free text somebody
typed (languages.jsx: no ISO codes, no script column — that is the pending respec), so
"which language is this" is unanswerable from a row. "Which script are these characters" is
answerable from the characters, needs no metadata, and survives the respec unchanged. So
`scriptOf` reads the leading strong character — first match over a fixed order rather than a
majority vote, because a romanisation in brackets inside the same string would tip a vote,
and that is precisely the string this app stores.

AND THE RULE MAY DECLINE TO ASK BUT NEVER HIDE AN ANSWER. A box that disappears while
holding text drops it on the next save, and switching locale would have been enough to do
it. `wantsTransliteration` returns true for any non-empty value regardless of script.

### What the card does, and what it does not

The transliteration sits under the words it respells and above the translation — the order
the owner writes them in. It does NOT join the text-order dial: that dial answers "which
MEANING leads", the original or the translation, and a pronunciation is neither, so it is
carried alongside whichever arrangement the reader chose. Under "translation only" it is
dropped, because the original is not on the card for it to be a pronunciation of.

### Deliberately not done here

- **The capture card does not offer it**, and that is not an oversight: the capture card
  offers no `translation` either. Both belong to the add-surface rework the owner asked for
  in the same message ("each surface needs to only show their specific fields"), and adding
  a romanisation box to a form with no translation box would be the odd half.
- **Stray marks (`cleanup`) does not scan it.** That feature's field list is `quote | note |
  translation`; a transliteration is text and belongs there, and it is a separate pass.
- **The search modal's hit does not draw it.** The hit structs carry the translation; this
  follows when the quote-card types land (`docs/plans/quote-card-types.md`).

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
