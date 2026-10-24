# ADR-0651: Plumbing with no tap is not a feature, and nothing in this repo notices

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** The Details panel gets a People section, and opening it fetches the character pictures that are not local yet.

**What was actually wrong.** 0048 built `work_cast` and six routes to edit it, and said so in its own header: "THERE IS NO SCREEN FOR ANY OF THIS YET, deliberately". 0049 and 0050 then added the character image and somewhere to keep it, and `POST /cast/{id}/image` was written so that "a client may call this for every chip it is about to draw". No client ever did. Three migrations, six routes and a fetch pipeline, and the reader saw no cast list and no character faces — not because anything was broken, but because the last three lines of the feature were never written.

**Nothing catches this.** Every test passed; the routes are covered; the schema tripwire is green. A route with no caller and a column with no reader are both perfectly healthy code. The only thing that would have caught it is somebody opening the app and looking for the thing the migration promised — which is what the owner did, two releases later, and reported as "it is not fetching the same by default either".

**The rule this is worth stating as.** A migration whose header says the screen is pending is a debt with no due date on it. When the screen does arrive, the thing to check is not that the endpoints work — they always did — but that something CALLS them. The test for the fill asserts the request was made at all, which is the assertion the whole feature turns on and the one nobody thinks to write.

**Two pictures, two owners, and they are not merged.** The character's picture belongs to the ROLE (`work_cast.character_image_path`) and the actor's to the PERSON (`people.image_path`), shared by every work they are in. One control for both would be convenient and would make a global edit look local. The row shows both and sends you to the person's own panel for theirs.

<sub>2.2.3 — `web/frontend/src/cast.jsx` · `internal/httpapi/tvdb_cast_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
