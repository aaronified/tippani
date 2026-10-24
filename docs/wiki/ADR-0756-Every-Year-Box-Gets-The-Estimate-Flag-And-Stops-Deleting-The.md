# ADR-0756: Every year box gets the estimate flag, and stops deleting the phrase that carried it

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The owner: *"every capture screen shall get the same year/circa behaviour. both
the checkbox and the text parsing."* Four boxes — a book's add and edit forms, a film's two —
and what was wrong there is worse than a missing checkbox.

**A DOCUMENTED CAPABILITY WAS UNREACHABLE.** Every one of the four ran
`value.replace(/\D/g, '').slice(0, 4)` on each keystroke, while the comment above two of them
said `parseYearInput` "reads '380 BCE' and 'c. 1500' as well as '1719'". Both statements were
true and they could not both matter: the parser could read the phrase and the box could not
hold it. An estimate and a BCE year were impossible to type, and nothing said so.

**AND IT DESTROYED DATA THAT WAS ALREADY THERE.** The edit forms seeded the box from
`formatYear`, so a book recorded as `c. 1500` opened with that in the field — and the first
keystroke anywhere in it stripped the `c. `, so the next save cleared the flag. No error, and
the year still looked right afterwards. This is the defect worth remembering: it needed no
bad input, only an edit.

**`formatYear` WAS DOING TWO JOBS AND FAILING THE SECOND IN EVERY LANGUAGE BUT ONE.** It
resolves one of four locale keys, so in Bengali it returns a Bengali prefix and
`parseYearInput`'s `/^(?:circa|ca|c)\.?/i` cannot match it. The estimate therefore
round-tripped in English and was silently dropped elsewhere. `yearInputValue` is the editable
form and resolves nothing; `formatYear` stays for display. The ordinary split between what a
machine reads and what a person reads.

**THE FLAG IS DERIVED FROM THE STRING, not stored beside it.** One state, one answer to "is
this approximate": the checkbox reads `parseYearInput(value).circa` and toggling rewrites the
prefix. A second piece of state would disagree with the phrase the first time either was set
alone, and a doubled marker cannot arise. It is disabled with no year, because `c. ` alone
reads back as nothing and the flag would appear to untick itself.

**AND THIS OVERRULES A RECORDED DECISION, said plainly rather than left to be rediscovered.**
`WorkDetails`' inline year editor argues the other way: *"'c. 380 BCE' is how the year of an
ancient text is actually written, and splitting that across two controls asks the reader to
disassemble a phrase they already know."* That reasoning is sound and is why the phrase still
works and the box still accepts it. The checkbox is an ADDITION to it, for the reader who does
not know the phrase is allowed. The inline editor is unchanged — it is not a capture screen,
and it never had the strip.

**Newly possible, and shown rather than swallowed:** while the box stripped to digits nothing
invalid could be typed. `sometime in the 90s` is now enterable and saves as no year, so an
unparseable phrase takes a red border and `aria-invalid` — no new string, because the red edge
beside a field the reader is looking at already says it.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/src/Library.jsx` · `web/frontend/src/Movies.jsx` · `web/frontend/test/dom/year-circa.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
