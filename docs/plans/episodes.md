# Episodes — a name, and up to three orders

Not built. Verified against `75e55ae` (main, 28 September 2026; its code is `ee4be1f`'s). Each
citation is `path:line` and the text at that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- internal/store internal/metadata/tmdb.go internal/metadata/tvdb.go internal/httpapi web/frontend/src/reorder.js web/frontend/src/gestures.jsx web/frontend/src/actions.jsx web/frontend/src/AddSurface.jsx`,
      then `git grep -n` each quoted anchor below.
- [ ] Give an episode of a series a name of its own, and up to three orders, `tv`, `dvd` and
      `custom`, each mapping the episode to a (season, episode) pair: in a real reordering the
      season moves too, so a single position cannot hold one.

The design, each a task:

- [ ] In the next migration (`0079_jobs.sql` is the latest at the pin; the number is taken
      at build): `episodes (id, movie_id → movies ON DELETE CASCADE, name, overview, air_date,
      source)`; `episode_orders (episode_id → episodes ON DELETE CASCADE, kind, season,
      episode, UNIQUE (episode_id, kind))`; and `movies.episode_order TEXT NOT NULL DEFAULT ''`,
      where `''` means `tv`. No CHECK on `kind`, as `media_type` has none; a fourth order is a
      row.
- [ ] `dialogues.season` and `dialogues.episode` always hold the `tv` order
      (`0025_dialogue_episode.sql:31` `ALTER TABLE dialogues ADD COLUMN season INTEGER;`).
      They are inside the dedupe hash (`hash.go:93`
      `func DialogueDedupeHash(text string, season, episode *int, act, quest string) string {`),
      held unique per series (`0003_movies.sql:42` `UNIQUE (movie_id, dedupe_hash)`), so
      switching the order shown rewrites and rehashes nothing: labels, sorting and grouping
      render through `movies.episode_order` and `episodeLabel` (`text.js:107`
      `export function episodeLabel(d) {`).
- [ ] Renumbering the `tv` order is its own act: one confirmation naming how many quotes move,
      one transaction rewriting and rehashing them, and a refusal on any collision rather than
      the skip boot's backfill uses (`hash.go:247`
      `func (s *Store) BackfillDialogueHashes() error {`).
- [ ] Renumbering `custom` touches no dialogue and cannot collide.
- [ ] Staging already carries the name as text (`0047_per_kind_fields.sql:292`
      `ALTER TABLE staged_quotes ADD COLUMN episode_name   TEXT    NOT NULL DEFAULT '';`); on
      approval it resolves to an `episodes` row, made when none exists.
- [ ] Show-only. Films and games get no episodes, and the server already clears episode fields
      off anything else (`dialogue_handlers.go:49` `if mediaType != "show" {`).
- [ ] An **Episodes…** entry in `actionsFor` (`actions.jsx:94`
      `export function actionsFor(kind, item, ctx = {}) {`), opening a `FormModal`
      (`ui.jsx:6451` `export function FormModal({`): a season-grouped list, one row per episode
      with its number, name and a count of the reader's quotes from it; a three-way switch for
      the order shown; drag to reorder and renumber by typing; seasons edited the same way; a
      drag onto another season's group moves an episode between seasons.
- [ ] `custom` starts as a copy of whichever order was showing when it is first chosen.
- [ ] The drag is the app's own, `useRowReorder` (`reorder.js:22`
      `export function useRowReorder(onMove) {`), extended rather than rebuilt: edge-scroll for
      a list longer than a screen, which its header says it lacks (`reorder.js:11`
      `// WHAT IT DOES NOT DO. It does not animate, does not build a drag image and does`),
      and an Alt+↑/↓ keyboard route that every caller gets, Settings's included
      (`Settings.jsx:3528` `const drag = useRowReorder(moveTo)`). Its header's refusal
      (`reorder.js:16` `// THE KEYBOARD IS NOT THIS FILE'S JOB.`) is rewritten in the same
      change.
- [ ] A `drag-reorder` gesture clip in `gestures.jsx`, the eighth beside the seven in
      `GESTURES` (`gestures.jsx:57` `export const GESTURES = [`): inline SVG in `currentColor`,
      reduced motion leaving the held pose. It joins `IMPLEMENTED` (`gestures.jsx:54`
      `export const IMPLEMENTED = ['long-press', 'swipe-left', 'swipe-up', 'swipe-down']`) in
      the commit that binds it, with `vocab.gesture.drag-reorder.label` in `en.txt` and
      `bn.txt` together.
- [ ] Endpoints: `GET /movies/{id}/episodes` (the three orders and quote counts, in a
      read-only transaction) and `PUT /movies/{id}/episodes` (a full-state save of one order,
      in one transaction); `episode_order` goes through the movie's existing update
      (`server.go:505` `mux.Handle("PUT /movies/{id}", s.requireAuth(s.handleUpdateMovie))`).
      A foreign series is 404, never 403, with its own cross-user test.
- [ ] `collectWork` lists `episodes` and `episode_orders` (`trash.go:213`
      `func collectWork(tx *sql.Tx, uid int64, kind string, id int64) (*collected, error) {`),
      and restore makes both again with new ids, remapping `episode_orders.episode_id`.
- [ ] Export and import carry an episode's name and all three orders, beside the line's name
      they carry today (`export_handlers.go:451` `writeBinding(&sb, "episode_name", d.EpisodeName)`,
      `movie_markdown.go:308` `case "episode_name", "episode name":`).
- [ ] An episode with no quotes is kept: a fetched season list is mostly those.
- [ ] A refetch never overwrites a name the reader edited; `source` says who wrote it.
- [ ] A series with no published DVD group gets no `dvd` rows, and the dialog says so.
- [ ] No episode artwork, no per-episode read tracking, no renumbering from the entry form.

The owner's answers, 27 September, each a task:

- [ ] Episodes come with the show's own metadata fetch, in whatever job that fetch already is
      (the owner: *"The same fetch as the show's metadata"*). That fetch runs on three paths,
      and each writes episodes where it writes the show's details: adding a show
      (`movie_handlers.go:442` `d, msg, code := s.fetchSourceDetails(r.Context(), source, sourceID, mediaType)`),
      re-syncing one from its source (`movie_handlers.go:1110`
      `func (s *Server) resyncMovieFromSource(`), and re-verify and fill, which share one fetch
      (`reverify_handlers.go:523` `func (s *Server) reverifyMovie(`; the job kinds
      `jobs_kinds.go:108` `{name: "fill",` and `jobs_kinds.go:124` `{name: "reverify",`). The calls: TMDB `/tv/{id}/season/{n}` through its
      generic getter (`tmdb.go:221` `func (t *TMDB) get(ctx context.Context, path string, q url.Values) ([]byte, error) {`)
      for names and the `tv` order, `/tv/{id}/episode_groups` for a published `dvd` order, and
      TVDB as the second supplier beside `SeriesDetails` (`tvdb.go:197`
      `func (t *TVDB) SeriesDetails(ctx context.Context, id string) (*MovieDetails, error) {`).
      This replaces the old plan's refusal of any automatic fetch.
- [ ] A refetch that adds episodes a `custom` order has never placed puts each right after the
      episode before it in `tv` order, wherever that one sits in `custom`, and marks it "new"
      until the dialog is next saved.
- [ ] The `dvd` order is read-only, as the provider published it, with **Copy to custom** to
      correct it there.
- [ ] One name per episode, shown on every line of it. Lines carry a typed name since 3.0
      (`0047_per_kind_fields.sql:273` `ALTER TABLE dialogues ADD COLUMN episode_name TEXT NOT NULL DEFAULT '';`).
      A one-time upgrade, `internal/store/onetime_<version>_episode_names.go`, seeds each
      episode's name from its lines; where they disagree it leaves the name empty, and the
      dialog lists their names for the reader to pick one.

Decided while planning, so the build needs nothing further:

- [ ] In re-verify, a show's episodes are one review row ("12 new, 3 renamed"), ticked or not
      like any other field, and written by `reverify-apply`.
- [ ] Saving an episode's name writes it onto that episode's lines too, so a line's export and
      the import binding above keep round-tripping.
- [ ] The entry form's episode-name field (`AddSurface.jsx:1478`
      `return <Field key={key} label={t('common.field.episode-name.label')}`) fills from the
      episode's name when it has one, and names the episode only when it has none; renaming is
      the dialog's.
- [ ] Tests: migrating twice is idempotent; switching the order leaves every `dedupe_hash`
      byte-identical; renumbering `tv` rehashes and refuses a collision, read back from the
      rows; season 0 survives everything; a refetch keeps an edited name; bin and restore bring
      back names and a custom order; export and import round-trip all three orders; the upgrade
      seeds names and lists disagreements; the drag works by keyboard alone; the gesture test
      covers the new clip. Assert values, not counts. Each mutation-checked, the mutation named
      in the commit.
- [ ] Re-check at build, as 3.1.0 is untagged at the pin: the job kinds each fetch path runs
      under (`jobs_kinds.go:108` `{name: "fill",`, `jobs_kinds.go:124` `{name: "reverify",`), and the reworded invariant in `CLAUDE.md`.
