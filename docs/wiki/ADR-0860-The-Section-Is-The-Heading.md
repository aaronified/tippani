# ADR-0860: The section is the heading

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE OWNER, LOOKING AT THE SCREENS:** *"In a lot of places, you have two levels of
headers, each with their own infodots. Consolidate as much as possible."* They were right
everywhere, and a capture of every Settings and Metadata surface is what made it countable:
Metadata's Characters section drew "Characters ⓘ" in the drill head and then "Characters ⓘ"
again on the line below it, with nothing between. Review drew "Review ⓘ" then "Daily quiz &
practice ⓘ". Sections drew three levels — "Sections ⓘ", "Features ⓘ", "In this order ⓘ".

**THE RULE THAT REPLACED IT.** A section holding exactly ONE card or console draws ONE
heading, and the rail owns it; the section's info dot is the only one at that level. Where a
section holds more than one, the inner titles are what tells them apart and they stay — so
Server keeps "Updates" and "Backup & restore", Works keeps "Duplicate books" beside its
list, and Characters keeps "Speaker & character remap" beside its list. What a console keeps
on that line is what the SECTION cannot say: how many rows the filters left.

**NINE HEADINGS WENT, AND SEVENTEEN LOCALE KEYS WITH THEM.** Appearance, Language, Daily
quiz & practice, Features, Colour categories, Language marks, Metadata sources, Catalogue,
Characters, People. `locale-complete.test.js` is what turned the last of that into a chore
rather than a judgement: it fails on a key nothing renders, because dead copy caps every
translator below 100%.

**"CATALOGUE" UNDER "WORKS" WAS WORSE THAN A REPEAT.** Two words for one thing, and the
reader has to work out that they are one.

**METADATA'S RAIL HAD NO PER-SECTION DOT AND SETTINGS' HAS HAD ONE ALL ALONG.** That is why
every Metadata console had grown its own: with nothing at the section level answering "what
am I looking at", each list answered it again under a tab that had already named it. Eight
`metadata.section.*.info.body` keys, derived from the id the way Settings derives its own.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
