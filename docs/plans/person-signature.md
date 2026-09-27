# A person's signature

Not built. Next in the queue. Verified against `75e55ae` (main, 28 September 2026; its code
is `ee4be1f`'s). Each citation is `path:line` and the text at that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- internal/store/migrations internal/metadata/people.go internal/metadata/covers.go internal/httpapi web/frontend/src/identity.jsx web/frontend/src/share.jsx web/frontend/src/quoteImage.js`,
      then `git grep -n` each quoted anchor below.
- [ ] Add a signature image to a person: upload, remove, and show it on their details popup,
      beside the portrait's own verbs (`identity.jsx:1264` `portraitActions={`).
- [ ] Store it beside the portrait, per reader: a `signature_path` column on `people`, whose
      rows are already each reader's (`0012_people.sql:13`
      `user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,`), in the next
      migration. `0079_jobs.sql` is the latest at the pin; the number is taken at build.
- [ ] Reuse an image already on disk rather than keeping a second copy: a signature file is
      named by the SHA-256 of its cleaned bytes, so two readers with the same signature share
      one file. Portraits are named at random today (`covers.go:234`
      `func StoreImageMax(data []byte, destDir string, max int) (string, error) {`).
- [ ] Offer the signature on image shares of that person's quotes, as an option in the share
      sheet, under the quote, remembered and hidden as the portrait's is (`share.jsx:820`
      `const [portrait, setPortrait] = usePersistedState("tippani:sharePortrait", false);`,
      `share.jsx:821` `const canPortrait =`).
- [ ] Draw it tinted to the share card's ink so it reads on every theme: the ink fills the
      signature's alpha, as a portrait takes its tint (`quoteImage.js:651`
      `function fadedPortrait(img, w, h, dir, tint, surface, url) {`).
- [ ] Carry it through backup and restore, export and the bin like the portrait.

The owner, 26 September: *"the signature feature needs a robust background removal and a
fetch frm wikidata."* Each a task:

- [ ] Remove the background of an uploaded signature robustly, so that only the ink is kept
      whatever paper or photo it was captured on.
- [ ] Fetch a person's signature from Wikidata (property P109, "signature"), through the
      outbound gate, as a lookup a reader starts.

The owner's answers, 27 September, each a task:

- [ ] Background removal runs on the server in pure Go, standard library only — `go.mod`
      requires no image module today, and adds none: greyscale, flatten uneven light by
      dividing by a wide blur, Otsu threshold, ink kept as alpha. The same code cleans an
      upload and a fetched raster. An SVG is kept as it is.
- [ ] After an upload the reader sees the cleaned signature before anything is saved, with
      ✓/✕ and one "ink strength" slider that moves the threshold.
- [ ] On the share card the signature sits in the bottom right corner, in the footer row where
      the Tippani mark and wordmark sit, which is drawn from the left today
      (`quoteImage.js:1287` `drawMark(ctx, innerX, base - FOOT_CAP / 2 - markInk / 2, MARK_SIZE, theme.dark)`),
      and no taller than that row (`quoteImage.js:794` `const FOOTER_H = 34`).
- [ ] Both routes fetch from Wikidata: a "Fetch from Wikidata" button in the signature slot,
      and the person's existing Fetch (`person_fetch.go:43`
      `func (s *Server) fetchPerson(ctx context.Context, uid, id int64) (personRow, map[string]string, error) {`)
      filling an empty slot after it writes the portrait (`person_fetch.go:54`
      `if err := s.persistPortrait(uid, id, kind, found); err != nil {`).

Decided while planning, so the build needs nothing further:

- [ ] A removed signature is remembered on the row, so the person's Fetch never puts it back;
      the slot's own Fetch and an upload clear the memory. Without it, the owner's "both"
      would undo every removal at the next Fetch.
- [ ] Routes beside the portrait's: an upload like `POST /people/id/{id}/portrait`
      (`server.go:351` `mux.Handle("POST /people/id/{id}/portrait", s.requireAuth(s.handlePersonImageUpload))`),
      a preview that cleans and returns the image and writes nothing, removal through the
      record's update as `clear_image` does (`identity_handlers.go:266`
      `` ClearImage bool   `json:"clear_image"` ``), and the slot's fetch.
- [ ] P109 is read the way P18 is: `WikidataImageURL` takes the property instead of fixing
      P18 (`people.go:630` `q := url.Values{"action": {"wbgetclaims"}, "property": {"P18"}, "entity": {qid}, "format": {"json"}}`),
      and both go to Commons, already an allowed host (`covers.go:34`
      `"commons.wikimedia.org":           true,`).
- [ ] The slot's fetch is a single manual lookup, run in its request and kept as a job: one
      row in the route-to-kind table (`jobkinds.go:29`
      `"POST /people/id/{id}/fetch":  "lookup.person",`), a `lookup.signature` beside it. The
      person Fetch's fill rides in `lookup.person`, and the outbound hook logs its extra
      request.
- [ ] A raster fetched by the slot's button goes through the same preview and slider; one
      filled by the person Fetch is cleaned at the default threshold.
- [ ] The bin parks the signature with the portrait (`identity_handlers.go:1114`
      `func (s *Server) binRecord(`, from `store/identity.go:1937`
      `func DeletePersonRecord(tx *sql.Tx, uid, id int64) (*RecordDeleteUndo, string, error) {`),
      except a file another row still names, which stays where it is; a signature file is
      deleted only when no row names it.
- [ ] Backup needs nothing: an archive carries the whole data directory except its control
      files (`backup_handlers.go:209` `func (s *Server) controlEntry(name string) bool {`).
      A restore test proves the signature comes back.
- [ ] Export is where the portrait is exported, the anthology EPUB
      (`export_anthology_epub.go:283` `for _, key := range []string{"character_portrait", "portrait"} {`):
      a `signature` field switch beside `portrait` (`anthology_registry.go:173`
      `{Key: "portrait", Kinds: allKinds, Binding: "", Label: "common.field.portrait.label"},`).
- [ ] The card credits a person, never a character, for the signature: a character signed
      nothing.
- [ ] Keys in `en.txt` and `bn.txt` together, beside the share sheet's portrait label
      (`en.txt:3108` `share.image.portrait.label = portrait`).
- [ ] Tests: a Go API journey (upload, preview, save, bin, restore from the bin, backup,
      restore; the same file comes back, and a second reader's identical signature shares it
      and survives the first reader's bin); Go tests of the cleaner on photographed paper,
      lined paper and uneven light, measured by ink kept and background cleared; a browser
      journey from the person popup to a share card with the signature in its corner. Each
      mutation-checked, the mutation named in the commit.
- [ ] Re-check at build, as 3.1.0 is untagged at the pin: the route-to-kind table and the
      outbound hook (`jobkinds.go:29`), and the reworded invariant in `CLAUDE.md`.
