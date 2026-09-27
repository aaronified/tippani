# A person's signature

Not built. Next in the queue. Verified against `75e55ae` (main, 28 September 2026; its code
is `ee4be1f`'s). Each citation is `path:line` and the text at that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- go.mod internal/store internal/jobs internal/i18n internal/metadata/people.go internal/metadata/covers.go internal/httpapi web/frontend/src/identity.jsx web/frontend/src/MetadataPage.jsx web/frontend/src/share.jsx web/frontend/src/quoteImage.js docs/data/features.json`,
      then `git grep -n` each quoted anchor below.
- [ ] Add a signature image to a person: upload, remove, and show it on their details popup,
      beside the portrait's own verbs (`identity.jsx:1264` `portraitActions={`).
- [ ] Store it beside the portrait, per reader: a `signature_path` column on `people`, whose
      rows are already each reader's (`0012_people.sql:13`
      `user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,`), in the next
      migration. `0079_jobs.sql` is the latest at the pin; the number is taken at build.
- [ ] Reuse an image already on disk rather than keeping a second copy: a signature file is
      named by the first 16 hex characters of the SHA-256 of its cleaned bytes, so two readers
      with the same signature share one file. Sixteen, because every stored image must match
      the name the server serves and parks (`covers_handler.go:26`
      `` var coverFile = regexp.MustCompile(`^[0-9a-f]{16}\.(jpg|png|webp|gif|svg)$`) ``); a
      longer name would 404 and be skipped by the bin. A name taken by different bytes gets a
      random name instead. Portraits are named at random today (`covers.go:234`
      `func StoreImageMax(data []byte, destDir string, max int) (string, error) {`).
- [ ] Offer the signature on image shares of that person's quotes, as an option in the share
      sheet, under the quote there; where the signature itself sits on the card is the
      owner's answer below. The option is remembered and hidden as the portrait's is (`share.jsx:820`
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
      and no taller than the row under the footer's hairline, which starts 10px into the
      footer (`quoteImage.js:1258` `const footTop = M + cardH - CP - FOOTER_H + 10`).
- [ ] Both routes fetch from Wikidata: a "Fetch from Wikidata" button in the signature slot,
      and the person's existing Fetch filling an empty slot. The Fetch a reader presses at the
      pin is `POST /people/portrait` (`identity.jsx:1077`
      `const r = await json('POST', '/people/portrait', { kind: (data.kinds || [])[0] || 'author', name: data.name })`,
      `MetadataPage.jsx:2881` `const r = await json('POST', '/people/portrait', { kind, name: p.name })`),
      and the one-route Fetch is not yet called by any screen (`person_fetch.go:24`
      `// declared to loop the same function (jobs_kinds.go), though no queued kind has`).
      Both call one resolver (`portrait_handlers.go:138`
      `func (s *Server) findPortrait(ctx context.Context, uid int64, kind, name string) (portraitFind, error) {`),
      so the signature is found there and written wherever each route writes the portrait:
      either route fills the slot.

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
- [ ] The Wikidata id is not stored on a person; the resolve finds it on the way to the
      portrait (`people.go:178` `photoID, qid, wikiURL, bio, born, died := authorDetail(ctx, best.key)`)
      and drops it. So the signature's URL is read in that same resolve, beside the
      portrait's (`people.go:137` `ImageURL    string`), and the slot's own button runs the
      resolve and keeps only the signature. A person the resolve does not reach Wikidata for
      gets no signature, and the button says it found none.
- [ ] Commons serves the file resized (`people.go:653`
      `return "https://commons.wikimedia.org/wiki/Special:FilePath/" + url.PathEscape(file) + "?width=600"`),
      so a signature drawn as SVG arrives as a PNG with transparency. The cleaner lays any
      image with alpha over white before it greys it, or the transparent paper would read as
      ink. Only an uploaded SVG is stored as it is.
- [ ] The slot's fetch is a single manual lookup, run in its request and kept as a job: one
      row in the route-to-kind table (`jobkinds.go:29`
      `"POST /people/id/{id}/fetch":  "lookup.person",`), a `lookup.signature` beside it,
      and its title in the Jobs list (`title.go:59` `case "lookup.person":`). The person
      Fetch's fill rides in whichever job that route already is, and the outbound hook
      (`recorder.go:108` `func (l *Lazy) Log(level, format string, args ...any) {`) logs its
      extra request.
- [ ] A raster fetched by the slot's button goes through the same preview and slider; one
      filled by the person Fetch is cleaned at the default threshold.
- [ ] The bin parks the signature with the portrait (`identity_handlers.go:1114`
      `func (s *Server) binRecord(`, from `store/identity.go:1937`
      `func DeletePersonRecord(tx *sql.Tx, uid, id int64) (*RecordDeleteUndo, string, error) {`),
      except a file another row still names, which stays where it is. A signature file is
      deleted only when no person row and no bin row names it; a bin row keeps its parked
      names in `files` (`0031_trash.sql:73`
      `files       TEXT NOT NULL DEFAULT '[]'  -- JSON array of parked image filenames`), so
      one reader emptying their bin never deletes a file another reader's bin is holding.
- [ ] Backup needs nothing: an archive carries the whole data directory except its control
      files (`backup_handlers.go:209` `func (s *Server) controlEntry(name string) bool {`).
      A restore test proves the signature comes back.
- [ ] Export is where the portrait is exported, the anthology EPUB
      (`export_anthology_epub.go:283` `for _, key := range []string{"character_portrait", "portrait"} {`):
      a `signature` field switch beside `portrait` (`anthology_registry.go:173`
      `{Key: "portrait", Kinds: allKinds, Binding: "", Label: "common.field.portrait.label"},`),
      added to every list that names `portrait` beside it: the EPUB's image list
      (`export_anthology_epub.go:356` `for _, key := range []string{"portrait", "character_portrait"} {`),
      the person fields (`anthology_registry.go:190`
      `"bio": true, "born": true, "died": true, "links": true, "portrait": true,`) and their
      order (`anthology_handlers.go:668`
      `var personFieldOrder = []string{"bio", "born", "died", "links", "portrait"}`).
- [ ] The card credits a person, never a character, for the signature: a character signed
      nothing.
- [ ] Keys in `en.txt` and `bn.txt` together, beside the share sheet's portrait label
      (`en.txt:3108` `share.image.portrait.label = portrait`).
- [ ] Tests: a Go API journey (upload, preview, save, bin, restore from the bin, backup,
      restore; the same file comes back, and a second reader's identical signature shares it
      and survives the first reader's bin and its emptying); both Wikidata routes against a
      stub Commons, the person Fetch filling only an empty slot; a removal that the next
      person Fetch leaves removed, and that the slot's own Fetch clears; a card crediting a
      character that offers no signature; Go tests of the cleaner on photographed paper,
      lined paper, uneven light and a transparent PNG, measured by ink kept and background
      cleared; a browser journey from the person popup to a share card with the signature in
      its corner. Each mutation-checked, the mutation named in the commit.
- [ ] The roadmap card still puts it under the quote (`features.json:401`
      `"  Add a person's signature to their details, and put it under their quote on a shared image.",`);
      at build it says the card's bottom right, in the row with the Tippani mark.
- [ ] Re-check at build, as 3.1.0 is untagged at the pin: whether the screens have moved
      from `POST /people/portrait` onto `POST /people/id/{id}/fetch` (`person_fetch.go:24`
      `// declared to loop the same function (jobs_kinds.go), though no queued kind has`); the route-to-kind table (`jobkinds.go:29`
      `"POST /people/id/{id}/fetch":  "lookup.person",`); and the invariant's new wording in
      `CLAUDE.md`, "nothing runs unless a person or the app's own lookup started it, and
      nothing wakes on a timer".
