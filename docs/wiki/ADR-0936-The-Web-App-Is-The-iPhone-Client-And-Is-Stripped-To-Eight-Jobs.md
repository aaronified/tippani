# ADR-0936: The web app is the iPhone client and is stripped to eight jobs

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted (nothing built yet; the work is [Plan: the web app, stripped](Plan-Phone-Web.md))
- **The owner, 23 November 2026:** "Pwa should be about basic stuff for iphone users. Android users will have the app."

**What was decided.** The web app keeps eight jobs: add a quote or work, edit them, check and edit context, search and edit
metadata, share quotes, read and copy the server logs, check the version and update the server, and the Checks screen (Marks and
Files). Alongside them stay the Library, Catalogue and Quotes lists, Anthologies, Boards, the duplicate-merge panel, Bengali and the
desktop layout. Everything else is removed, including the material toggles and tile pickers; the Theme page becomes a dropdown.

**Why.** The Android app is the full client, so the web app's remaining audience is iPhone users on a PWA. At 3.10.1 it is 84
component files, about 80,000 lines and a 12 MB build for a phone that needs a fraction of it, and the code the owner no longer
uses still has to be kept passing.

**Decided by default, on the owner's "your decision".** The Imports tab and file import go. The Bin goes.

**Corrected by the owner the same day.** People, character, work and quote editing stay; only multi-edit (selection mode and the
bulk bar) goes.

**Rejected.** Rebuilding on Astryx first: the spike showed clipping at large text, no Bengali, and a larger bundle, and a rebuild
is cheaper once the screens to rebuild are about twelve. Keeping everything and lazy-loading it, which leaves the maintenance cost.

See also: [ADR-0931](ADR-0931-The-Android-App-Lives-In-Its-Own-Repository.md) · [ADR Index](ADR-Index.md) · [Home](Home.md)
