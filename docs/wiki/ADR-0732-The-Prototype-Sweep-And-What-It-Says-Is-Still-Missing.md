# ADR-0732: The prototype sweep, and what it says is still missing

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask, and the half of it I first answered badly: "look for features in the
prototype and enable those." My first pass read §1.2, found one unbuilt clause and
reported that as though it were the sweep. It was not. This is Part 1 of `handoff.md`
enumerated against the code, section by section, with the probe named so a later reader
can check the verdict rather than trust it.*

| § | Claim | Verdict |
| --- | --- | --- |
| 1.1 | Details is a form, not a corridor of sheets | **built.** `WorkDetails.jsx`'s spec list is the pack's order exactly — title · subtitle · people · description · genres · year · language · publisher · series · pages · isbn · links — and the four fields the pack exempts (description, genres, people, cover) are the four carrying `sheet: true` or their own `kind` |
| 1.2 | metadata source is per field | **built**, and the cast list joined it this release. The last clause — tapping a tag opens that field's candidates — is **built too now**; see "The door behind a field's mark" |
| 1.3 | links out, on works and people | **built** for paste-and-parse, the globe, and the two provenances. Appending a provider by picking it from a list is **built too now**, though not as the pack draws it; see "The list you pick a link from" |
| 1.4 | a picture is not a field | **built.** `CoverPicker.jsx`'s `resLabel` measures `naturalWidth`/`naturalHeight` and inks below the floor, which is the part of the pack most easily faked and was not |
| 1.5 | quotes carry their speaker | **stored and never shown.** 0056 gave `annotations` and `dialogues` a `speaker_cast_id` into `work_cast`, 0059 added the person columns beside it, and the trash and merge both maintain them — but the column is not serialised by any handler, so no client can draw the chip. The data has been right for three migrations and the feature does not exist |
| 1.6 | books have characters | **built.** `CastSection` serves both sides; the fetch is the only film-only part |
| 1.7 | duplicate a quote | **built** |
| 1.8 | six default portraits, hashed by name | **built.** `SILHOUETTE_COUNT = 6`, `silhouetteIndex(name)` |
| 1.9 | the person panel is three scopes | **built**, and the character panel now matches it |
| 1.10 | Metadata, Stats and Settings are real screens | **built.** All three carry phone branches; the prototype's own Part 4 still lists them as desk-only there |
| 1.11 | a pick closes its panel | **not verified.** The only `stack.back()` calls found are `onDone` after a save, not after a pick — suggestive, not conclusive, and this needs a render rather than a grep |
| 1.12 | shell corrections | **the panel header follows the pack's structure** — `.tp-panel-slot` is two flexible slots reserving 44px with the title on the box, and `.tp-panel-head` casts unconditionally, both for the pack's stated reasons. **Its HEIGHT is a departure since the sheet round:** 60px to 48px, on the owner's "make it slimmer. by at least 30-40%" — argued in the phone-sheet entry, and it reaches the DESK panel too, deliberately. One component may not be two heights by width: that is the drift "similar things should act similarly" exists to stop, and the room being removed was room around a 44px key rather than anything the pack draws. **Help's placement differs:** it is a row in the ⋯ and a button of its own rather than against the search field. Whether that is a recorded departure or a drift, I did not establish |

**Three named gaps come out of this, in the order I would take them.** §1.5's chip is
first and is the one worth doing next: the storage is done, the merge and trash already
maintain it, and the character page it would open was built this release — so it is a
handler field and a chip, not a feature. §1.2's tap is second, and is also mostly a door:
`fieldAlt{source, value}` is already computed per field and `ReverifyReview.jsx` already
draws the candidates side by side. §1.3's provider list is third and is the only one that
is genuinely new work.

**All three are now closed**, each with its own entry below. §1.2 turned out NOT to be
mostly a door, and the sentence above was wrong about why: see that entry. §1.3 is built
but deliberately not as the pack draws it, which is its entry's whole argument. That
leaves 1.11 and 1.12's help placement, which are a render and a ruling rather than work.

**Two rows are honestly unfinished rather than answered**, and are left saying so: 1.11,
and the help placement in 1.12. Both need the screen rather than the source, and a
verdict guessed from a grep is worse in this table than an admission.

<sub>Unreleased — investigation only; no code in this entry</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
