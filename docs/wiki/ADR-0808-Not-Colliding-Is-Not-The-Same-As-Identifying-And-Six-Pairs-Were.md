# ADR-0808: Not colliding is not the same as identifying, and six pairs were colliding anyway

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, on a mark the derivation produced and the last entry called finished:
*"Bengali ব vs Assamese অ, assamese should get their r, that is uniquely assamese. Same
for all languages."*

**They are right, and the rule was wrong rather than the row.** অ is the first letter of
অসমীয়া, so the derivation was doing exactly what the entry above describes — and it is
also the first vowel of the script Bengali writes, so the tile said "a Bengali-script
language that is not Bengali" and stopped. The claimed-set tie-break guarantees that no
two languages of a script share a mark. It never guaranteed that a mark IDENTIFIES its
language, and the entry above conflated the two.

So a row may now carry its own `mark`, and where it does that letter is one no other
listed language of its script writes: **ৰ** where Bengali writes র, **ښ** for Pashto,
**ѓ** for Macedonian, **ß** for German — forty rows of ninety-one. A language
that genuinely has none keeps the derivation, which is the honest answer: Hindi, Nepali
and Sanskrit share a Devanagari alphabet entirely, and inventing a distinguishing letter
for them would be the confidently-wrong answer this module exists to refuse.

### Where the last entry was wrong

**SIX PAIRS OF LANGUAGES SHARED A MARK AT 8dc0a259, AND THE COMMENT SAID THEY COULD
NOT.** `sk`/`es` on s, `lv`/`pl` on l, `zu`/`it` on i, `eu`/`et` on e, `gl`/`tl` on g,
`eo`/`en` on E. The derivation's last resort was `usable[0]` — the autonym's first
usable rune, taken whether or not it was already claimed — and nothing in the suite
compared marks across the whole list, so the one invariant the tie-break exists for was
false and every test passed. It was found by printing all eighty-six and diffing them,
which is a thing no test was doing and one now does.

The cause is structural rather than incidental: **Latin has twenty-six letters and this
list has forty-seven languages written in it.** Exhaustion is guaranteed, not unlucky.
The fallback is now the autonym, then the English name (Latin only — "Galician" is in
the same script as "galego" while "Bengali" is not in the same script as বাংলা), then
the script's own alphabet derived from every listed autonym. A letter nothing in the
language's name offers is not evocative, and that is the right trade: a mark that says
little is a mark; two boards wearing the same letter is not.

**A MODIFIER LETTER IS AS UNRENDERABLE AS A COMBINING ONE.** Uzbek drew `ʻ` — U+02BB
MODIFIER LETTER TURNED COMMA, out of oʻzbekcha — because `standalone` excluded `\p{M}`
and `\p{P}` and stopped there. A tile that is a comma reads as a bug for the same reason
a dotted circle does. `\p{Lm}` is excluded now.

**AND THE BOARD FORM'S OWN COMMENT DESCRIBED A CONTROL THAT IS NOT THERE.** It said
every other language "arrives through the box below, which offers all eighty-six as you
type" — and that box is a plain `Field` offering nothing, because the combobox was
deliberately deferred in the same commit and the comment three lines down says so. Two
comments, one screen, opposite claims.

### Where the rule is a judgement rather than a fact, and it is written down as one

**BENGALI KEEPS ব RATHER THAN TAKING র, WHICH IS ALSO UNIQUELY ITS OWN.** Applied
without thought, "a letter no other language of the script writes" gives the pair (র,
ৰ) — and those differ by one short diagonal, so the two covers are indistinguishable at
22px. That is the same failure the owner reported, reached from the other side. Where
the technically-unique letter is a visual twin, the legible one wins, and ব is the first
letter of বাংলা.

**SOME MARKS ARE "THE LETTER THIS LANGUAGE IS KNOWN BY" RATHER THAN "A LETTER NO ONE
ELSE HAS", and mixing the two grades silently would be the defect `CLAUDE.md` names.**
Galician's **x**, Russian's **Ж**, Quechua's **q**, Mongolian's **ө** and Māori's **ā**
are all letters other listed languages also write; each was chosen because it identifies
the language and was free. The uniqueness that is actually enforced — and tested — is
that no two MARKS are equal, which is the property a reader can see.

### Five languages, and a three-letter code

Scottish Gaelic (`gd`), Māori (`mi`), Quechua (`qu`), Inuktitut (`iu`, and a new script)
and Maa (`mas`). Irish was already here under its own name; Scottish Gaelic was not, and
"Gaelic" is deliberately NOT aliased to either — it means one in Ireland and the other
in Scotland, and an app that picks is an app that is wrong half the time.

**Maa has no ISO 639-1 code, and taking that as a refusal would have been wrong about
the standard rather than strict with it.** BCP 47 (RFC 5646 §2.2.1) says a primary
language subtag is the SHORTEST AVAILABLE code — 639-1 where one exists, 639-3 where
none does — so `mas` is Maa's correct tag and the code column takes two letters or
three.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
