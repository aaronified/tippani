# ADR-0650: A fixed vocabulary beats a text box wherever a screen GROUPS by the field

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** `utterances.medium` — free text since 0026 — is superseded by `utterances.kind` (0053), a CHECKed column holding one of speech, letter, essay, proverb, other, or the empty string. The old column stays, with every value in it.

**What decided it was the grouping, not the typing.** A text box is a perfectly good way to record "radio". It stops being one the moment a screen offers to pile the shelf up by that field, which the Quotes board has done since it had a grouping control: "Speech", "speech", "a speech" and "Speech (radio)" become four headings over one kind of thing, and nothing in the interface can say they are the same or offer to merge them. That is the same failure a genre had, and a genre's answer — `titleCaseGenre`, a normaliser over an open vocabulary — does not apply here, because this vocabulary does not grow. A poem is an essay's SHAPE (a work title and a locator), which is why 0047 named those two columns generically.

**The empty string is one of the values, and 'other' is not the default.** 'other' is a decision. A default that pretends to be one is a claim the card then makes on the reader's behalf about every quote they have not looked at. So an unset kind renders as nothing on a card and as "(not set)" in a chooser.

**Nothing is destroyed, and "drop anything that doesn't match" is read as dropping it from the FIELD.** The `medium` column keeps every value; the interface stops offering the box; the export keeps writing the binding; and the card falls back to the old text whenever no kind is set. A reader who typed "radio" sees "radio" until they file it, rather than watching a field they filled in disappear in the release that replaced it. The alternative — dropping the column — is a table rebuild whose purpose is to delete data, which is two bad ideas in one statement.

**The one-time pass guesses at nothing, and that is the whole of its design.** It folds `medium` where the value IS one of the five words (case-folded, trimmed) and falls back to `category`'s two real answers. It is very tempting to map "radio" and "interview" and "broadcast" onto `speech`, because most of the time that is what somebody meant. A synonym table is a silent reclassification of a library on upgrade with no record of what moved — precisely what 0035's header refused when it chose a default over a guess. `category`'s 'other' is not read either: 0035 defaulted every row to it so that nothing was reclassified, so there it means "nobody has said".

**The importer runs the same fallback**, so restoring a backup written before 0053 lands where upgrading in place lands. Otherwise one library gets two different answers depending on which route it took, and neither is wrong enough to notice. The mapping is written twice on purpose — once in the pass, once in the importer — because the pass is a file to be DELETED once no instance is behind 2.2.3, and a shared helper would make that deletion a refactor.

**The cost, stated.** Widening the list later is a migration and not an edit, because the CHECK is on the column. 0029 took the colour list from four to six by rebuilding five tables. It is worth paying: the alternative is what `medium` already was.

<sub>2.2.3 — `internal/store/migrations/0053_quote_kind.sql` · `internal/store/onetime_2_2_3_quote_kind.go` · `web/frontend/src/quoteKind.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
