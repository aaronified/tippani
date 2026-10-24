# ADR-0636: TheTVDB is the default film source, because a role can have a face and TMDB has none

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** Film and show lookups consult TheTVDB before TMDB, and a credit now stores two pictures: `work_cast.image_url` is the actor's headshot and `character_image_url` (0049) is the character in costume. Both suppliers are still searched, both sets of hits are still offered, and every already-pinned title keeps its pin.

**Why.** TheTVDB's character record carries an image PER ROLE — Amanda Waller rather than Viola Davis — and it has been arriving on the extended movie and series payloads this app already fetches, in the same `characters[]` array `personImgURL` comes from. Nothing declared the field, so the bytes were discarded at parse time. TMDB has no equivalent at any endpoint: a person has one profile image and a role has none.

**Two columns, not a better value in one.** The two pictures answer different questions. A headshot is a fact about a PERSON and is the same on every title they appear in — it is what the portrait pipeline resolves and what a rename has to follow. A character image is a fact about ONE ROW: this role, in this work. Overwriting `image_url` with it would put a costume on the actor's identity everywhere, and the first screen to notice would be a people page showing Viola Davis as somebody else. It also has to stay distinguishable from a role that genuinely has no art, which one column cannot express.

**The rejected alternative was re-pinning existing titles.** It is the only thing that would give an existing library character art without the reader lifting a finger, and it costs a search-and-match against TheTVDB for every title — a network call each, from inside `Migrate()`, where a failure has to be swallowed and a wrong match cannot be reviewed. It would also overwrite provider facts on rows nobody asked about, and an upgrade is nobody asking: nothing here wakes on a timer, and the queue runs only what a person or the app's own lookup started. So a pin stays a decision the reader made, and character art arrives one title at a time on re-verify.

**What that costs, plainly: an upgraded library sees no character art until each title is re-verified.** The mitigation is the notice rather than the fix — the Metadata screen's Sources section says how many titles are still pinned to TMDB alone, and stops saying it when the count reaches zero. Self-clearing, so there is no dismissal to store and none to go stale.

**A fresh install is never told.** A notice about a change you never lived through is a sentence the interface made up, so the notice is gated on a marker written by a one-time pass that only fires on a database which already existed (`OneTimeEnv.FreshInstall`). That guard needed its own test: on a genuinely fresh database the pass writes nothing whether the guard is there or not, so inverting it left the obvious test green.

**A TMDB refetch must not erase what TheTVDB found**, and this is the one way the feature can be lost. TMDB sends an empty character image for every row of every title, and a fill applies refetches in bulk and unattended — so under plain assignment a single fill would blank every costume in a library and report success. The `CASE WHEN ? <> ''` guards in `updateProviderCastRow` and `updateCastRowFacts` are what make the two providers additive over a row's life instead of the last fetch winning.

**Verified without reaching the API.** The environment this was written in blocks `thetvdb.github.io`, `api4.thetvdb.com` and `thetvdb.com`, and the repo's own TheTVDB fixture is hand-written without the field — so "the character record has an `image`" could not be confirmed from either. It was established from the generated types in a published client package instead: `ICharacter` declares `image: string`, and `IMovieExtendedRecord`, `ISeriesExtendedRecord` and `IPeopleExtendedRecord` all embed `characters: ICharacter[]` — which are the endpoints this app already calls.

**Not done, and deliberately left:** nothing displays a cast yet. A film's credit chips are the director or creator; `work_cast` is read only by the dialogue form's actor autofill and the quiz's distractors. The character image now reaches the client on `cast[].character_image_url` and has nowhere to be drawn — the screen 0048 called "a screen that does not exist yet" is still that.

<sub>2.2.0 — `internal/metadata/tvdb.go` · `internal/store/migrations/0049_character_image.sql` · `internal/httpapi/cast.go` · `internal/httpapi/lookup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
