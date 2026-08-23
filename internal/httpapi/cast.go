package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// The shared shape of a work's cast (0048) — the row, the read, and the one
// helper that decides what the second column is called.
//
// The handlers are in cast_handlers.go; the merge that a metadata fetch runs
// against this table is the seed path's, and it lives with the fetch.

// castOrigin values. This vocabulary is `origin` in the schema and 0048's header
// is where the merge rule it encodes is argued. Repeated here in one line each
// because a handler reading `castCorrected` should not have to open a migration
// to find out what it protects.
const (
	// castProvider: seeded by a fetch and never touched. A refetch owns it whole.
	castProvider = "provider"
	// castCorrected: seeded by a fetch and then edited. A refetch may take the
	// provider's own facts (billing, person_id, image_url, source) and may not
	// touch the character or the actor.
	castCorrected = "corrected"
	// castReader: typed by hand, no provider row underneath. A refetch cannot see
	// it UNTIL the provider catches up and adoptCastRow claims it, from which point
	// the row has a provider key and the merge does read it — what protects it then
	// is this word, in the switch and in the retraction pass. See mergeProviderCast.
	castReader = "reader"
	// castRemoved: a tombstone for a provider row the reader deleted. It keeps
	// its keys and its provider_key so the next fetch recognises and skips it.
	castRemoved = "removed"
)

// The three answers to "what is the second column?", as a MACHINE value the
// client maps to a word. Never English prose on the wire: the label belongs to
// the screen that renders it, in both interface languages, and that screen is a
// pending design. A token published ahead of it would be an orphan key, which
// locale-complete.test.js fails the build over — it was written after 37 such
// keys had to be deleted.
const (
	actorRoleNone  = "none"  // a book: there is no second column, and an actor is refused
	actorRoleActor = "actor" // a film or a show
	actorRoleVoice = "voice" // a game: the same column, the client says "voice actor"
)

// maxWorkCast caps one work's list. The provider seed is at most 20
// (metadata.maxCast), so this is ten times the largest thing a fetch can
// produce and still small enough that the whole list is one screen's worth of
// rows rather than a paging problem.
const maxWorkCast = 200

// maxCastName is the free-text metadata cap this repo uses for a character and
// an actor everywhere else (dialogues.character, dialogues.actor).
const maxCastName = 128

// actorRole reports what a work's second column holds. Derived from
// movies.media_type in ONE place, because "a game says voice actor" is exactly
// the kind of rule that gets added to three of the four sites that need it.
func actorRole(kind, mediaType string) string {
	if kind == "book" {
		return actorRoleNone
	}
	if mediaType == "game" {
		return actorRoleVoice
	}
	return actorRoleActor
}

// castRow is one (character, actor) pair on the wire.
//
// The provider's own facts — person_id, image_url, billing, source — are
// REPORTED and never accepted: they are what the portrait pipeline and the
// quiz's distractor ordering read, no edit surface will ever offer them, and a
// refetch takes them back regardless of who has touched the row. `origin` is
// reported for the same reason and accepted for none: it is the merge rule's own
// bookkeeping, and a client that could set it could exempt a row from a refetch.
type castRow struct {
	ID        int64  `json:"id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	PersonID  string `json:"person_id"`
	ImageURL  string `json:"image_url"`
	// The role in costume, where the provider has one — TheTVDB only (0049). A
	// provider's fact like the four above it, reported and never accepted.
	CharacterImageURL string `json:"character_image_url"`
	Billing           int    `json:"billing"`
	Origin            string `json:"origin"`
	Source            string `json:"source"`
}

// castCols is the SELECT list every read here shares, so a column added to the
// row struct is added in one place rather than in three that drift.
const castCols = `id, character, actor, person_id, image_url, character_image_url, billing, origin, source`

func scanCastRow(sc interface{ Scan(...any) error }) (castRow, error) {
	var c castRow
	err := sc.Scan(&c.ID, &c.Character, &c.Actor, &c.PersonID, &c.ImageURL,
		&c.CharacterImageURL, &c.Billing, &c.Origin, &c.Source)
	return c, err
}

// loadCast reads one work's live cast in billing order.
//
// Tombstones are excluded: a row the reader deleted is gone as far as anything
// outside the merge is concerned, and it survives only so a refetch can decline
// to bring it back.
//
// ORDER BY billing, id is the provider's order with the hand-typed rows after
// it, because a reader-authored row is given MAX(billing)+1 when it is created —
// an uncredited part sorting below the billed cast, which is where it belongs.
// The id tiebreak makes the order total: billing is a provider's array index and
// nothing stops two rows sharing one after a correction.
func loadCast(q interface {
	Query(string, ...any) (*sql.Rows, error)
}, kind string, workID int64) ([]castRow, error) {
	rows, err := q.Query(
		`SELECT `+castCols+` FROM work_cast
		 WHERE kind = ? AND work_id = ? AND origin <> ?
		 ORDER BY billing, id`, kind, workID, castRemoved)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []castRow{}
	for rows.Next() {
		c, err := scanCastRow(rows)
		if err != nil {
			// One unreadable row must not cost the reader the rest of the cast.
			olog.Warnf(olog.CodeCastRowScan, "[cast] %s %d: %v", kind, workID, err)
			continue
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// loadCastForExport is loadCast WITH THE TOMBSTONES IN, for the one caller that
// needs them: the Markdown export.
//
// Every other read wants the list as it stands, and loadCast gives them that. An
// export is a backup, and a backup that drops the tombstones hands the library
// back in a state where the next lookup on every restored title re-adds the
// credits the reader deleted on purpose. `origin` rides out with each row and the
// export writes it as a word, so the round trip carries the provenance rather
// than flattening it to the provider's.
//
// Same ORDER BY, so the file's line order is the billing order and the import can
// rebuild `billing` from position alone.
func loadCastForExport(q interface {
	Query(string, ...any) (*sql.Rows, error)
}, kind string, workID int64) ([]castRow, error) {
	rows, err := q.Query(
		`SELECT `+castCols+` FROM work_cast
		 WHERE kind = ? AND work_id = ?
		 ORDER BY billing, id`, kind, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []castRow{}
	for rows.Next() {
		c, err := scanCastRow(rows)
		if err != nil {
			olog.Warnf(olog.CodeCastRowScan, "[cast] export %s %d: %v", kind, workID, err)
			continue
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// loadCastMembers is loadCast in the wire shape `movies.cast_json` used, so
// GET /movies/{id} can go on answering byte-identically while the data underneath
// it moves from a blob to a table. That equality is what makes "no frontend work"
// true rather than aspirational: Movies.jsx and MetadataPage.jsx both read
// cast[].character / .actor / .person_id / .image_url, and neither has to learn
// anything.
//
// person_id and image_url are omitempty on CastMember, so a hand-typed row —
// which can carry neither, by design — serialises exactly as a pre-0037 blob
// entry did: the two names and nothing else.
//
// character_image_url (0049) is omitempty for the same reason and is the one
// place that equality is now a superset rather than an identity: a TheTVDB row
// with character art carries a key the blob never had. Additive, so no existing
// reader sees a difference, and a reader that wants the role's face has to ask
// for it by name.
func loadCastMembers(q interface {
	Query(string, ...any) (*sql.Rows, error)
}, kind string, workID int64) ([]metadata.CastMember, error) {
	rows, err := loadCast(q, kind, workID)
	if err != nil {
		return nil, err
	}
	out := make([]metadata.CastMember, 0, len(rows))
	for _, c := range rows {
		out = append(out, metadata.CastMember{
			Character: c.Character, Actor: c.Actor,
			PersonID: c.PersonID, ImageURL: c.ImageURL,
			CharacterImageURL: c.CharacterImageURL,
		})
	}
	return out, nil
}

// castQuerier is the single method the two cast lookups need, so one
// implementation serves a handler holding *sql.DB and an import loop holding
// *sql.Tx. Named rather than inlined because two functions below take it.
type castQuerier interface {
	QueryRow(query string, args ...any) *sql.Row
}

// castCurated reports whether a work's cast has EVER BEEN TOUCHED — any row at
// all, live, corrected, hand-typed or TOMBSTONED.
//
// It exists for the unattended fill (metadata_fill.go), and the tombstone is the
// whole reason it cannot be answered by looking at a value. A reader who deletes
// every credit a provider seeded leaves four tombstones and an empty list, and a
// tombstone is invisible to every read outside the merge ON PURPOSE — loadCast
// filters it, loadCastMembers therefore filters it, and so the cast the re-verify
// diff holds up as "stored" is legitimately empty. To a filter whose whole job is
// "is this field empty?", that is indistinguishable from a film nobody has ever
// looked at, and the two want opposite answers.
//
// A FAILED READ ANSWERS "CURATED", which is the same failure direction
// missingStored takes for a type it does not recognise: declining to fill costs a
// field the reader can still ask for, and filling wrongly costs a list somebody
// built by hand.
//
// Scoped by (kind, work_id) and not by user, exactly as loadCast is: a work
// belongs to one reader, and the caller has already proven the work is theirs.
func castCurated(q castQuerier, kind string, workID int64) bool {
	var have bool
	if err := q.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM work_cast WHERE kind = ? AND work_id = ?)`,
		kind, workID).Scan(&have); err != nil {
		olog.Warnf(olog.CodeCastRowScan, "[cast] curation check %s %d: %v", kind, workID, err)
		return true
	}
	return have
}

// castSourceForFetch names the provider that supplied a seeded row, in the
// vocabulary the `source` column uses.
//
// It is NOT simply the details record's own Source, and the one place the two
// part is the one place it matters. A game's record comes from IGDB, but IGDB
// HAS NO CAST — no person endpoint, no credit endpoint, and a characters
// endpoint that carries no link to a performer. Every voice credit in this app
// is Wikidata's, joined on the IGDB slug, whether the details themselves arrived
// from IGDB or from the Wikidata fallback. Writing 'igdb' on those rows would
// name a supplier that could not have supplied them, and would send the portrait
// pipeline looking for an IGDB person id that does not exist.
func castSourceForFetch(detailSource string) string {
	switch detailSource {
	case "igdb", "wikidata":
		return "wikidata"
	default:
		return detailSource
	}
}

// castSourceForWork guesses which provider a work's cast came from, from the id
// the title is currently pinned by.
//
// A GUESS, and deliberately the same one 0048's backfill makes, because the
// re-verify apply path is handed a list of approved field VALUES and not the
// record they were fetched from — the fresh cast arrives as JSON in an approval
// map, with no supplier attached to it. A row seeded by TMDB on a title later
// re-pinned to TheTVDB is therefore mislabelled, which costs a portrait lookup
// one wrong namespace and nothing else.
func castSourceForWork(tx *sql.Tx, movieID int64) string {
	var tmdbID, tvdbID, igdbID int64
	if err := tx.QueryRow(
		`SELECT COALESCE(tmdb_id, 0), COALESCE(tvdb_id, 0), COALESCE(igdb_id, 0)
		 FROM movies WHERE id = ?`, movieID).Scan(&tmdbID, &tvdbID, &igdbID); err != nil {
		return ""
	}
	switch {
	case tmdbID != 0:
		return "tmdb"
	case tvdbID != 0:
		return "tvdb"
	case igdbID != 0:
		return "wikidata"
	}
	return ""
}

// storedCast is the merge's view of one row a provider seeded: enough to decide
// what may be done to it, and nothing else.
type storedCast struct {
	id          int64
	providerKey string
	origin      string
}

// mergeProviderCast folds a freshly fetched cast list into a work's mapping.
//
// THIS FUNCTION IS THE MERGE RULE. Everything else in the feature exists so that
// it can be written: a refetch MAY add rows the provider has started listing and
// MAY rewrite rows nobody has touched, and it MUST NOT change or remove a row the
// reader has edited, typed or deleted. As a table, because the four `origin`
// states are exactly the four answers:
//
//	provider   seeded and untouched — the refetch owns it whole, names included,
//	           and deletes it when the provider stops listing it
//	corrected  seeded and then edited — the refetch takes the provider's own facts
//	           and leaves both names alone, for ever
//	reader     typed by hand — the refetch takes the provider's facts and leaves
//	           both names alone, for ever, exactly as for `corrected`. It is
//	           invisible to the merge only until the provider catches up
//	removed    a tombstone — nothing at all is written to it. The empty case below
//	           says what does and does not enforce that
//
// TWO OF THOSE FOUR ROWS USED TO CLAIM A MECHANISM THAT DOES NOT EXIST, so this
// paragraph is here to stop it being written back. `reader` said "the refetch
// cannot even see it, because it has no provider_key and the query below reads
// only rows that have one" — true on the day the row is typed and FALSE from the
// first fetch in which the provider starts listing that pair, because adoptCastRow
// gives the row a provider key on purpose so the listing is re-matched rather than
// duplicated beside it. `removed` said its empty case was "the whole of its
// enforcement", when nothing in this function writes `origin` at all and so no
// branch of the switch could resurrect anything.
//
// WHAT ACTUALLY PROTECTS A ROW THE READER HAS TOUCHED IS THE `origin` WORD ON IT,
// read in exactly two places: the switch below, whose `default:` takes the
// provider's facts and never a name, and the retraction pass, which deletes only
// rows still marked `provider`. Both are pinned by cast_protection_test.go —
// remove either and a named test fails. The non-empty `provider_key` narrowing on
// the query below is NOT one of them; see the note sitting on it.
//
// WHAT THE RULE PROTECTS IS `character` AND `actor`, AND NOTHING ELSE. `billing`,
// `person_id`, `image_url` and `source` are the provider's own facts: no edit
// surface will ever offer them, the portrait pipeline and the quiz's distractor
// ordering are what read them, and a refetch takes them back on every row
// whoever has touched it. This is the one place the rule can look like it is
// being broken, so it is said out loud here rather than left to be discovered in
// a diff.
//
// It runs INSIDE THE CALLER'S TRANSACTION, which is not incidental. The blob it
// replaces was marshalled before Begin and written as one value, so it needed no
// read at all; this needs a read of the stored rows and then a write against
// them, and two browser tabs pressing "look up" are two request goroutines on one
// file.
//
// `source` is the supplier the fresh list came from (castSourceForFetch /
// castSourceForWork). `in` is the provider's list in billing order — its index
// becomes `billing`.
func mergeProviderCast(tx *sql.Tx, uid int64, kind string, workID int64, source string, in []metadata.CastMember) error {
	// AN EMPTY LIST IS NOT A RETRACTION, and this early return is the one place
	// the merge is deliberately more careful than the blob it replaces.
	//
	// The blob wrote '[]' whenever a fetch came back with no cast, which erased
	// every credit the title had. That is indefensible here, because this app has
	// a cast lookup that returns nothing ALL THE TIME and by design: a game's
	// voice credits are a second, best-effort Wikidata request that is allowed to
	// fail precisely so a failure there cannot fail the whole fetch (TIP-META-018
	// measures it — 14 of 24 titles have no Wikidata credits at all). A provider
	// that lists nobody is indistinguishable from a request that never asked, and
	// a title genuinely losing its entire cast is not a thing that happens. So an
	// empty list changes nothing, while a provider retracting ONE row still does
	// exactly what it should.
	if len(in) == 0 {
		return nil
	}

	// `provider_key <> ''` IS A NARROWING AND NOT A PROTECTION, and it is labelled
	// as one because it used to be cited as the reason a hand-typed row was safe.
	// It is not: a reader row gains a key the moment adoptCastRow claims it, so it
	// arrives in this very set, and a skeptic dropped this predicate without moving
	// a single test. What it does is keep rows out of `byKey` that have nothing to
	// be keyed by — every reader-authored row on the work would otherwise pile up
	// under the one empty string, which no fetched entry can ever match anyway
	// (a key is two names joined by a separator, so it is never '').
	//
	// It is kept rather than dropped for that reason alone, and the redundancy is
	// stated rather than left as an apparent second line of defence: the origin
	// checks below are the whole of it.
	rows, err := tx.Query(
		`SELECT id, provider_key, origin FROM work_cast
		 WHERE user_id = ? AND kind = ? AND work_id = ? AND provider_key <> ''`,
		uid, kind, workID)
	if err != nil {
		return err
	}
	var stored []storedCast
	byKey := map[string]storedCast{}
	for rows.Next() {
		var s storedCast
		if err := rows.Scan(&s.id, &s.providerKey, &s.origin); err != nil {
			rows.Close()
			return err
		}
		stored = append(stored, s)
		// TOMBSTONES ARE IN THIS INDEX, and they are half the reason it is built:
		// a tombstone whose provider_key matches an entry in the fresh list is how
		// the merge learns not to hand back a row somebody deleted.
		byKey[s.providerKey] = s
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// Keyed by ROW ID rather than by provider key, because ONE ROW CAN BE REACHED
	// BY TWO DIFFERENT FETCHED ENTRIES — by its provider key, and by its folded
	// pair through the adoption path below. The question both the skip below and
	// the retraction pass ask is "did the fresh list account for this ROW", so the
	// row is what has to be marked.
	//
	// A ROW THIS LOOP INSERTS IS MARKED TOO, and that is not bookkeeping tidiness.
	// A provider list holding both ("Neo","Keanu Reeves") and ("neo","keanu
	// reeves") — the double billing 0048's backfill has an INSERT OR IGNORE for —
	// gives the first entry a new row and then hands the second entry that same row
	// through adoption. Unmarked, the second entry overwrites the first's names and
	// billing, so the row records whichever spelling the provider happened to list
	// last. Marked, the entry that seeded the row keeps it, which is the same rule
	// the backfill's OR IGNORE already applies to the same data.
	seen := map[int64]bool{}
	for i, p := range in {
		character, actor := strings.TrimSpace(p.Character), strings.TrimSpace(p.Actor)
		if character == "" && actor == "" {
			// Neither a character nor an actor is not a credit. Storing it would
			// file every such entry under one key and collide them with each other.
			continue
		}
		key := store.ProviderKey(character, actor)
		row, ok := byKey[key]
		if !ok {
			// ADOPTION. The reader may have typed this exact pair already — or the
			// provider may have changed its own casing, which changes the key — so
			// before inserting, look the pair up as the READER-FACING folded pair.
			// Without this the insert below would hit idx_work_cast_pair and fail
			// the entire refetch over a row somebody had already got right.
			row, ok, err = adoptCastRow(tx, uid, kind, workID, character, actor, key)
			if err != nil {
				return err
			}
		}
		if !ok {
			res, err := tx.Exec(
				`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
				                        provider_key, person_id, image_url, character_image_url,
				                        billing, origin, source)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				uid, kind, workID, character, store.CastKey(character), actor, store.CastKey(actor),
				key, p.PersonID, p.ImageURL, p.CharacterImageURL, i, castProvider, source)
			if err != nil {
				return err
			}
			// THIS IS THE SEED, so the key just written is the frozen one, and the
			// row is marked so a later entry folding onto the same pair cannot come
			// back through adoption and rewrite it (see `seen` above). A failure to
			// read the id back leaves it unmarked, which is the behaviour that was
			// there before — no worse, and not worth failing a refetch over.
			if newID, ierr := res.LastInsertId(); ierr == nil {
				seen[newID] = true
			}
			continue
		}
		if seen[row.id] {
			// Two entries in one fetched list folding onto one row — a provider
			// billing "Neo" and "neo" separately. The pair unique allows exactly
			// one of them, the first is already written, and THE FIRST IS THE ONE
			// THAT STANDS: taking the second would change the row's names, its
			// billing and (before the freeze below) its key to the spelling the
			// provider happened to list last, which is not a decision anybody made.
			continue
		}
		seen[row.id] = true
		switch row.origin {
		case castRemoved:
			// Nothing is written onto a tombstone. THIS BRANCH IS NOT WHAT MAKES A
			// DELETION STICK, and it is said in those words because the comment that
			// used to sit here called itself "the whole of its enforcement" — and a
			// skeptic then deleted the branch without a single test noticing.
			//
			// WHAT ENFORCES THE NO-RESURRECTION RULE is three things, none of them
			// here: handleDeleteCast keeps the row instead of deleting it, every read
			// outside the merge filters `origin <> 'removed'`, and NO STATEMENT IN
			// THIS FUNCTION WRITES `origin` — so a tombstone leaves any branch of this
			// switch still a tombstone. Fold this case into the provider case and the
			// deleted credit still does not come back.
			//
			// WHAT IT DOES ENFORCE is narrower, real, and now pinned by
			// TestARecasedRefetchNeitherRevivesNorRewritesTheTombstone: A TOMBSTONE
			// RECORDS WHAT THE READER DELETED, IN THE WORDS THEY WERE LOOKING AT. It
			// is the one row in the table nobody can see, so the Markdown export is
			// the only place it is ever shown back to them — and a supplier re-casing
			// its own names reaches it here through adoptCastRow's folded-pair lookup,
			// where updateProviderCastRow would respell their deletion and re-bill it
			// to the head of the file's cast line. Letting it gains nothing: `billing`,
			// `person_id` and `image_url` on a row that is not on the list are read by
			// nobody.
		case castProvider:
			if err := updateProviderCastRow(tx, row.id, character, actor, p, i, source); err != nil {
				return err
			}
		default: // corrected | reader — both names are the reader's now
			if err := updateCastRowFacts(tx, row.id, p, i, source); err != nil {
				return err
			}
		}
	}

	// The retraction pass. A row the fresh list did not account for is one the
	// provider has stopped listing, and ONLY AN UNTOUCHED PROVIDER ROW GOES:
	//
	//	corrected  kept, unchanged, and it KEEPS ITS PROVIDER KEY — so if the
	//	           provider lists that person again the row is re-matched rather
	//	           than duplicated beside it
	//	reader     kept; it is in this set at all only because adoption gave it a
	//	           provider key
	//	removed    kept; deleting the tombstone is exactly how a deletion comes
	//	           undone
	//
	// THE `origin` CHECK ON THE NEXT LINE IS WHERE THE LAST THREE OF THOSE ARE
	// ENFORCED, and it is the only place. It reads like belt-and-braces beside the
	// query's `provider_key <> ''` and it is not: an adopted reader row and a
	// corrected row both have keys, so both reach this loop, and dropping this
	// clause deletes them outright the moment a supplier tidies the entry out of
	// its list. Pinned by TestARetractionLeavesTheReadersAdoptedRowAlone and
	// TestARetractedCorrectionIsKeptAndStillRematched, which are the only two tests
	// in the suite that fail when it goes.
	for _, row := range stored {
		if seen[row.id] || row.origin != castProvider {
			continue
		}
		if _, err := tx.Exec(`DELETE FROM work_cast WHERE id = ?`, row.id); err != nil {
			return err
		}
	}
	return nil
}

// adoptCastRow finds the row already holding a fetched entry's FOLDED pair, and
// claims it for the provider IF AND ONLY IF it has no provider key yet.
//
// Two very different situations reach here. Either the reader typed a credit the
// provider had not published yet and has now caught up with — that row has no
// key, so this IS its seed: it keeps its origin and merely gains the key that
// links it to the listing. AND THAT MAKES IT VISIBLE TO EVERY LATER MERGE, which
// is the part 0048 got wrong for a while: from here on the row is in
// mergeProviderCast's stored set like any other, and the only thing standing
// between it and the retraction pass's DELETE is the `reader` word on it.
//
// Or the row already has one, because the provider
// changed its own capitalisation and so changed the key it computes while the
// folded pair stayed put — and then nothing is written, because
// PROVIDER_KEY IS FROZEN AT SEED. 0048 says so on the column and in its header,
// and the freeze is enforced here or nowhere.
//
// WHY FREEZING AND NOT RE-KEYING, which is what this did first. A re-key looks
// harmless and is not, for two reasons that compound:
//
//   - IT IS NOT STABLE. A provider list holding both ("Neo","Keanu Reeves") and
//     ("neo","keanu reeves") reaches one row twice — once by key, once by folded
//     pair — and a re-key leaves the row wearing whichever key came second. The
//     next fetch matches the other entry by key first and swaps it back. The key
//     flips on every refetch, which is the exact opposite of what an identity
//     anchor is for, and it is the anchor carryWorkCast and the retraction pass
//     both lean on.
//   - IT BUYS NOTHING. The only thing a re-key would improve is the NEXT fetch's
//     byKey hit, and the miss it saves lands right back here — where the folded
//     pair finds the row anyway. One extra indexed lookup per re-cased entry per
//     fetch is the whole cost of the freeze.
//
// A live row is preferred to a tombstone, and a tombstone is returned rather than
// passed over — that is what stops a refetch resurrecting a deleted row by the
// side door when the only thing that changed was the provider's casing. It is
// this LOOKUP that does that, not the write: the caller reads `origin` and does
// nothing with a tombstone whatever its key says.
//
// WHAT THE FREEZE COSTS, plainly: a provider row whose supplier has re-cased a
// name carries a key that no longer equals ProviderKey(its own names). Nothing
// reads it that way — the merge computes the key from the FETCHED entry and this
// function covers the miss — and applyImportedCast, which does rebuild a key from
// the names, says what that costs there.
func adoptCastRow(tx *sql.Tx, uid int64, kind string, workID int64, character, actor, key string) (storedCast, bool, error) {
	var row storedCast
	err := tx.QueryRow(
		`SELECT id, provider_key, origin FROM work_cast
		 WHERE user_id = ? AND kind = ? AND work_id = ? AND character_key = ? AND actor_key = ?
		 ORDER BY CASE origin WHEN ? THEN 1 ELSE 0 END, id LIMIT 1`,
		uid, kind, workID, store.CastKey(character), store.CastKey(actor), castRemoved).
		Scan(&row.id, &row.providerKey, &row.origin)
	if errors.Is(err, sql.ErrNoRows) {
		return storedCast{}, false, nil
	}
	if err != nil {
		return storedCast{}, false, err
	}
	if row.providerKey == "" {
		if _, err := tx.Exec(`UPDATE work_cast SET provider_key = ? WHERE id = ?`, key, row.id); err != nil {
			return storedCast{}, false, err
		}
		row.providerKey = key
	}
	return row, true, nil
}

// updateProviderCastRow rewrites an untouched provider row whole. This is the
// only statement in the feature that changes a `character` or an `actor` without
// a reader having asked for it, and it may because nobody has touched this row:
// the provider is the only author it has ever had.
func updateProviderCastRow(tx *sql.Tx, id int64, character, actor string, p metadata.CastMember, billing int, source string) error {
	_, err := tx.Exec(
		`UPDATE work_cast SET character = ?, character_key = ?, actor = ?, actor_key = ?,
		        person_id = CASE WHEN ? <> '' THEN ? ELSE person_id END,
		        image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END,
		        character_image_url = CASE WHEN ? <> '' THEN ? ELSE character_image_url END,
		        billing = ?, source = ?, updated_at = datetime('now')
		 WHERE id = ?`,
		character, store.CastKey(character), actor, store.CastKey(actor),
		p.PersonID, p.PersonID, p.ImageURL, p.ImageURL,
		p.CharacterImageURL, p.CharacterImageURL, billing, source, id)
	return err
}

// updateCastRowFacts takes the provider's facts and leaves both names exactly as
// the reader left them. The row's own `origin` is not touched either: a corrected
// row stays corrected however often it is refetched, which is what makes the
// protection permanent rather than good for one fetch.
//
// A PROVIDER THAT SAYS NOTHING DOES NOT ERASE WHAT AN EARLIER FETCH FOUND — hence
// the CASE expressions rather than plain assignment. TheTVDB supplies a portrait
// URL where TMDB sometimes has none, and a fetch from the thinner of two records
// should cost the reader an update, not a headshot they already had.
//
// character_image_url (0049) turns that from a courtesy into the thing holding
// the feature up. TMDB has no character art AT ALL, so it sends an empty string
// for every row of every title, every time — and a title re-verified after being
// seeded by TheTVDB would lose every costume it had under plain assignment. The
// CASE is what makes the two providers additive over a row's life instead of the
// last fetch winning.
func updateCastRowFacts(tx *sql.Tx, id int64, p metadata.CastMember, billing int, source string) error {
	_, err := tx.Exec(
		`UPDATE work_cast SET person_id = CASE WHEN ? <> '' THEN ? ELSE person_id END,
		        image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END,
		        character_image_url = CASE WHEN ? <> '' THEN ? ELSE character_image_url END,
		        billing = ?, source = ?, updated_at = datetime('now')
		 WHERE id = ?`,
		p.PersonID, p.PersonID, p.ImageURL, p.ImageURL,
		p.CharacterImageURL, p.CharacterImageURL, billing, source, id)
	return err
}

// castActorFor answers the question the quote form asks on every save: who plays
// this character in this work?
//
// ORDER BY billing, id LIMIT 1 reproduces exactly what the blob loop's `break`
// did — the highest-billed match wins when a provider bills one character twice,
// which it legitimately does for a role two people play (young and old Vito
// Corleone) and for a recast part. A tombstoned row answers nothing, because it
// is not on the list any more.
//
// Finding nobody is NOT AN ERROR and is not logged: quoting a bit-part nobody
// credited is the ordinary case, and making the cast a gate on saving a quote
// would be the wrong trade in an app whose only required field is the quote
// itself. A genuine query failure is a different thing and does get a line.
func castActorFor(q castQuerier, kind string, workID int64, character string) string {
	var actor string
	err := q.QueryRow(
		`SELECT actor FROM work_cast
		 WHERE kind = ? AND work_id = ? AND character_key = ? AND origin <> ? AND actor <> ''
		 ORDER BY billing, id LIMIT 1`,
		kind, workID, store.CastKey(character), castRemoved).Scan(&actor)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return ""
	case err != nil:
		olog.Warnf(olog.CodeCastRowScan, "[cast] actor lookup %s %d %q: %v", kind, workID, character, err)
		return ""
	}
	return strings.TrimSpace(actor)
}

// encodeCast / decodeCast carry a parsed cast through staged_works.cast_json,
// exactly as encodeReads / decodeReads carry a read log through reads_json and
// for the same reason: the queue sits in the middle of the export/import round
// trip, and a field that is not carried across it is lost between the parse and
// the approval. A bad encode or decode degrades to "no cast" rather than failing
// an import of somebody's quotes.
func encodeCast(cast []importer.CastEntry) string {
	if len(cast) == 0 {
		return "[]"
	}
	b, err := json.Marshal(cast)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func decodeCast(s string) []importer.CastEntry {
	var out []importer.CastEntry
	if s == "" || s == "[]" {
		return nil
	}
	_ = json.Unmarshal([]byte(s), &out)
	return out
}

// applyImportedCast writes a parsed cast onto a work at approval.
//
// FILL-EMPTY-ONLY, AND THE WHOLE LIST OR NOTHING: if the work already has a
// single cast row — live or tombstoned — the file's list is ignored entirely.
// That is applyImportedShelf's rule for the read log, copied deliberately, and
// the argument is the same one twice over. Re-importing an old export must not
// duplicate a list that is already there, and it must not overwrite a newer one.
// It matters more here: this table's whole purpose is that the reader's rows are
// not a provider's to rewrite, and a merge-by-row on the way in would have to
// decide whether a two-year-old file outranks a correction made last week. It
// does not, and the file is the thing with a copy somewhere else.
//
// A BOOK'S ACTORS ARE CLEARED RATHER THAN REFUSED, which is 0047's rule stated
// once more: the API rejects a field the kind does not have, because a request is
// somebody asking now; an import clears it, because a file is something somebody
// already wrote — and refusing it would fail an import over a line the reader
// cannot see. It is also what makes retargeting a film's file onto a book work at
// all, which is the queue's own repair.
//
// PROVENANCE IS REBUILT, NOT INVENTED:
//
//	provider   the default when a file says nothing, and it gets a provider_key
//	           built from the two names — which is what an untouched row's key is
//	           at seed, so it is reconstructible with nothing stored. It can differ
//	           from the key the row actually carried, in the one case where the
//	           supplier re-cased a name after seeding it (adoptCastRow freezes the
//	           key and says why). That costs nothing: the rebuilt key is what the
//	           provider's CURRENT list computes, so it matches sooner rather than
//	           later, and the folded-pair adoption covers it either way
//	corrected  kept, with NO provider key: the key held the provider's original
//	           spelling, which the export deliberately does not carry, and writing
//	           the corrected name into it would claim the provider had said it. A
//	           row with no key is invisible to a refetch, which is the most
//	           protected state there is, and adoptCastRow re-links it by folded
//	           pair on the next fetch when it can
//	reader     kept, with no key, exactly as handleAddCast writes it
//	removed    kept AS A TOMBSTONE, with its key reconstructed — and it still
//	           works: mergeProviderCast matches a fresh entry to it by that key,
//	           and adoptCastRow would find it by folded pair even without one
//
// What that costs, plainly: the provider's person id and portrait URL are not in
// the file (importer.CastEntry says why), so a restored library shows no
// headshots until the next lookup, which takes them back on every row regardless.
func applyImportedCast(tx *sql.Tx, kind, mediaType string, uid, workID int64, in []importer.CastEntry) error {
	if len(in) == 0 {
		return nil
	}
	var have bool
	if err := tx.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM work_cast WHERE user_id = ? AND kind = ? AND work_id = ?)`,
		uid, kind, workID).Scan(&have); err != nil {
		return err
	}
	if have {
		return nil
	}
	role := actorRole(kind, mediaType)
	billing := 0
	for _, e := range in {
		character, okChar := trimCap(e.Character, maxCastName)
		actor, okActor := trimCap(e.Actor, maxCastName)
		if !okChar || !okActor {
			// A name longer than every other name field in this schema allows is a
			// mangled file rather than a name. Dropping the row is the forgiveness an
			// import owes; failing the file over it is not.
			continue
		}
		if role == actorRoleNone {
			actor = ""
		}
		if character == "" && actor == "" {
			continue
		}
		if billing >= maxWorkCast {
			// The cap the API enforces, enforced on the way in too: a hand-edited file
			// must not be able to write a list no screen could show.
			break
		}
		origin := castOriginForImport(e.Origin)
		providerKey := ""
		if origin == castProvider || origin == castRemoved {
			providerKey = store.ProviderKey(character, actor)
		}
		// OR IGNORE, and it is the pair unique doing the ignoring — 0048's backfill
		// makes the same choice for the same reason. A hand-edited file naming one
		// pair twice is a duplicate, and dropping the second is right; the
		// alternative is failing somebody's whole import over it.
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO work_cast (user_id, kind, work_id, character, character_key,
			                                  actor, actor_key, provider_key, billing, origin)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, kind, workID, character, store.CastKey(character), actor, store.CastKey(actor),
			providerKey, billing, origin); err != nil {
			return err
		}
		billing++
	}
	return nil
}

// castOriginForImport folds a file's origin word into the schema's vocabulary,
// defaulting to the provider's.
//
// A VALUE THE VOCABULARY DOES NOT KNOW BECOMES 'provider', not an error: `origin`
// is the merge rule's own bookkeeping and the least privileged value is the safe
// place to land — a row a refetch may rewrite, rather than one it may never
// touch. An unknown word in a hand-edited file must not be able to pin a name
// against every future lookup.
func castOriginForImport(s string) string {
	switch s {
	case castCorrected, castReader, castRemoved:
		return s
	}
	return castProvider
}

// castPair joins a row's two FOLDED keys into the one string a Go map can be
// keyed by, so "is this credit already on that work?" is a lookup rather than a
// query per row. store.ProviderKey is reused for the join rather than a second
// separator being chosen here: it is the same unit separator for the same reason
// — both halves are free text somebody typed, and a comma, a slash or a pipe all
// turn up inside a real credit.
func castPair(charKey, actorKey string) string {
	return store.ProviderKey(charKey, actorKey)
}

// carryWorkCast moves the cast of the works a MERGE is about to delete onto the
// work that survives it. Called from handleMergeMovies and handleMergeBooks,
// before their DELETE.
//
// WITHOUT THIS A MERGE DESTROYS THE READER'S CAST. Both merges re-point the
// quotes and then hard-delete the source rows, and 0048's two AFTER DELETE
// triggers reap the cast of anything deleted — so merging a duplicate took every
// voice actor the reader had typed on it, every name they had corrected and every
// row they had deleted, with no bin snapshot to recover from because a merge takes
// none. It is the feature's one rule — a refetch never overwrites or deletes a row
// the reader has touched — broken by a different verb.
//
// IT IS SHARED between the two merges while the rest of handleMergeMovies is a
// deliberate statement-for-statement mirror of handleMergeBooks. That mirror
// exists because the genre join table, the child quote table and the orphan person
// kind all differ per side; none of them appears here. work_cast is ONE table
// addressed by (kind, work_id) — 0024's polymorphic shape — so there is no table
// name to interpolate and nothing to get subtly wrong, and a second copy would be
// a second place this rule had to be learnt.
//
// ---------------------------------------------------------------- both sides
//
// WHEN BOTH WORKS NAME THE SAME CHARACTER THE SURVIVOR'S ROW STAYS and the
// source's is dropped. Not a preference: idx_work_cast_pair allows exactly one
// live row per folded (character, actor) on a work, so one of the two has to go,
// and the survivor's is the one the reader is looking at and the one their quotes
// have just been re-pointed at.
//
// BUT THE PROVENANCE IS MERGED WHERE THE ROW IS NOT. A survivor's row still
// labelled 'provider' is lifted to 'corrected' when the row it absorbs was the
// reader's, because otherwise the next refetch would rewrite a name they had
// already fixed on the copy they merged away — the feature's rule applied to a
// second source of truth. It only ever moves in the protecting direction:
// 'corrected' and 'reader' are never demoted by a plain provider row arriving
// from the other side.
//
// The survivor's row does NOT take the source row's provider_key, and does not
// need to: adoptCastRow claims a row it finds by folded pair on the very next
// fetch, so the link is made by the merge that runs then, with the row's own
// origin deciding what may be done to it. Writing it here would be a second copy
// of that rule in a place that cannot see the provider's list.
//
// --------------------------------------------------------------- tombstones
//
// A TOMBSTONE IS CARRIED, because a deletion the reader made is as much their
// decision as a name they typed, and a merge that dropped it would let the
// survivor's next refetch hand back a credit somebody removed on purpose.
//
// A LIVE ROW BEATS A TOMBSTONE, whichever side holds it. If the survivor already
// lists the pair the source tombstoned, the tombstone is dropped: a merge is
// additive everywhere else — quotes re-pointed, genres unioned — and removing a
// credit the reader can see on the survivor because they deleted it from a
// duplicate they are destroying is not a trade anybody asked for. In the other
// direction the same rule carries a live source row over the survivor's own
// tombstone, which is why that tombstone is deleted below rather than left to
// collide with it — AND ONLY ONCE THE ROW THAT REPLACES IT IS CERTAIN TO BE
// CARRIED, because the provider-key branch further down drops some source rows
// instead of carrying them and a tombstone deleted ahead of it leaves the pair
// with nothing at all.
//
// AND THE TIE-BREAK IS SENSITIVE TO ROW ORDER ACROSS SEVERAL `from` WORKS, which
// is worth knowing before trusting it too far. `claimed` is filled by carry()
// inside this same loop, so when two duplicates both hold the provider's entry and
// the reader deleted it on only one of them, whichever arrives first decides:
// tombstone first and the later live row takes the drop branch below, live row
// first and the tombstone is what gets dropped. Rows arrive in (work_id, billing,
// id) order, so "first" means the lower row id, which is not a fact about the
// reader's intent at all.
//
// It is left alone rather than fixed here. Both outcomes are defensible — the
// reader deleted the credit once and kept it once — and picking between them is a
// product question, not a merge-ordering one. What is NOT defensible is the older
// behaviour this replaced, where the same case ended with no row at all and the
// next refetch resurrected the credit; that is the bug this ordering exists to
// close. Untested, deliberately: a test would pin an answer nobody has chosen.
//
// A DROPPED TOMBSTONE IS NOT SILENT: it gets a trace line naming the pair,
// because "the credit I deleted came back after a merge" is otherwise a change
// with no record of the decision behind it. It is a decision and not a failure,
// so it is Tracef rather than a coded warning.
//
// ------------------------------------------------- what is still lost, plainly
//
// The source's movies.cast_json goes with its row. That blob is the frozen
// provider list 0048 keeps for one release as a repair copy — and after this
// function the rows it would be used to rebuild are on the survivor, which is the
// copy that matters. It is the same loss the merge already accepts on every other
// column of the row it deletes: the overview, the poster, the runtime.
//
// maxWorkCast IS NOT ENFORCED HERE, deliberately. The cap stops a client writing
// a list no screen could show; a merge is not a client typing, and the only way
// to hold the cap would be to drop rows the reader made — which is the defect
// this function exists to fix, reintroduced with a number attached. Merging two
// fully-credited films can therefore leave a survivor above 200 rows, and the
// next hand-typed addition to it is refused until it is back under.
func carryWorkCast(tx *sql.Tx, uid int64, kind string, into int64, from []int64) error {
	if len(from) == 0 {
		return nil
	}
	// The survivor's rows, indexed the two ways a carried row can collide with
	// them: the folded pair (idx_work_cast_pair, partial — live rows only) and the
	// provider key (idx_work_cast_provider, every row that has one). Both are
	// maintained as rows arrive, because two sources can hold the same credit and
	// the second has to collide with the first's new home rather than with nothing.
	type targetRow struct {
		id     int64
		origin string
	}
	live := map[string]targetRow{} // folded pair -> the survivor's live row
	tombs := map[string][]int64{}  // folded pair -> the survivor's tombstones
	claimed := map[string]bool{}   // provider keys already spoken for on the survivor
	maxBilling := -1
	rows, err := tx.Query(
		`SELECT id, character_key, actor_key, provider_key, origin, billing FROM work_cast
		 WHERE user_id = ? AND kind = ? AND work_id = ?`, uid, kind, into)
	if err != nil {
		return err
	}
	for rows.Next() {
		var (
			id                  int64
			charKey, actorKey   string
			providerKey, origin string
			billing             int
		)
		if err := rows.Scan(&id, &charKey, &actorKey, &providerKey, &origin, &billing); err != nil {
			rows.Close()
			return err
		}
		pair := castPair(charKey, actorKey)
		if origin == castRemoved {
			tombs[pair] = append(tombs[pair], id)
		} else {
			live[pair] = targetRow{id: id, origin: origin}
		}
		if providerKey != "" {
			claimed[providerKey] = true
		}
		if billing > maxBilling {
			maxBilling = billing
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// Every source row is read before any of them is written. A cursor left open
	// across writes on one SQLite connection is the self-deadlock this package
	// already takes care to avoid (loadStagedForApproval says so in as many words),
	// and the loop below both updates and deletes.
	type sourceRow struct {
		id                        int64
		character, actor          string
		pair, providerKey, origin string
	}
	args := make([]any, 0, len(from)+2)
	args = append(args, uid, kind)
	for _, id := range from {
		args = append(args, id)
	}
	// ORDER BY work_id, billing, id keeps each source's own billing order intact as
	// its rows are appended, so a duplicate's cast lands on the survivor in the
	// order its provider billed it rather than in whatever order SQLite scanned.
	srcRows, err := tx.Query(
		`SELECT id, character, actor, character_key, actor_key, provider_key, origin FROM work_cast
		 WHERE user_id = ? AND kind = ? AND work_id IN (`+inClause(len(from))+`)
		 ORDER BY work_id, billing, id`, args...)
	if err != nil {
		return err
	}
	var src []sourceRow
	for srcRows.Next() {
		var (
			s                 sourceRow
			charKey, actorKey string
		)
		if err := srcRows.Scan(&s.id, &s.character, &s.actor, &charKey, &actorKey,
			&s.providerKey, &s.origin); err != nil {
			srcRows.Close()
			return err
		}
		s.pair = castPair(charKey, actorKey)
		src = append(src, s)
	}
	srcRows.Close()
	if err := srcRows.Err(); err != nil {
		return err
	}

	// MAX(billing)+1 and upwards, which is handleAddCast's rule for a hand-typed
	// row and it is right here for the same reason: the survivor's billing order is
	// its own provider's, and a credit arriving from a duplicate is an addition to
	// that list rather than a re-billing of it.
	carry := func(s sourceRow, providerKey string) error {
		maxBilling++
		if _, err := tx.Exec(
			`UPDATE work_cast SET work_id = ?, provider_key = ?, billing = ?, updated_at = datetime('now')
			 WHERE id = ? AND user_id = ?`, into, providerKey, maxBilling, s.id, uid); err != nil {
			return err
		}
		if s.origin == castRemoved {
			tombs[s.pair] = append(tombs[s.pair], s.id)
		} else {
			live[s.pair] = targetRow{id: s.id, origin: s.origin}
		}
		if providerKey != "" {
			claimed[providerKey] = true
		}
		return nil
	}

	for _, s := range src {
		if s.origin == castRemoved {
			_, listed := live[s.pair]
			switch {
			case listed:
				olog.Tracef("[cast] merge into %s %d keeps the live %q / %q and drops a tombstone for it",
					kind, into, s.character, s.actor)
			case len(tombs[s.pair]) > 0:
				olog.Tracef("[cast] merge into %s %d already records %q / %q as removed",
					kind, into, s.character, s.actor)
			case s.providerKey != "" && claimed[s.providerKey]:
				// The survivor already holds a row for this provider entry, under a name
				// the reader has since changed — so the entry is accounted for, and a
				// tombstone beside it would break idx_work_cast_provider.
				olog.Tracef("[cast] merge into %s %d already holds the provider entry behind %q / %q",
					kind, into, s.character, s.actor)
			default:
				if err := carry(s, s.providerKey); err != nil {
					return err
				}
			}
			continue
		}
		if t, ok := live[s.pair]; ok {
			if t.origin == castProvider && (s.origin == castCorrected || s.origin == castReader) {
				if _, err := tx.Exec(
					`UPDATE work_cast SET origin = ?, updated_at = datetime('now')
					 WHERE id = ? AND user_id = ?`, castCorrected, t.id, uid); err != nil {
					return err
				}
				t.origin = castCorrected
				live[s.pair] = t
			}
			continue
		}
		// WHETHER THIS ROW IS CARRIED AT ALL IS DECIDED BEFORE ANYTHING IS DELETED,
		// and that order is load-bearing. The branch below drops the SOURCE row
		// instead of carrying it, so a survivor tombstone deleted ahead of it left
		// the pair holding NEITHER — not the live row the "a live row beats a
		// tombstone" rule promises and not the tombstone the other branch promises.
		// The canonical way in is two copies of one film seeded from the same
		// provider entry, the reader deleting the credit on the copy they keep: that
		// tombstone lands in `tombs` and never in `live`, so the pair lookup above
		// misses it while `claimed` still holds its provider_key. Both sides of one
		// credit then went missing at once and the next refetch handed it back —
		// worse than the defect this function was written to fix, which at least
		// left the survivor's own cast alone.
		key := s.providerKey
		if key != "" && claimed[key] {
			if s.origin == castProvider {
				// Untouched on both sides, and the survivor already accounts for this
				// provider entry — either with a live row under a name the reader changed
				// (the folded pair did not match) or with the tombstone that records their
				// deleting it. Either way the survivor's own row is the one that stands
				// and there is nothing of the reader's in this row to save.
				continue
			}
			// The two names ARE the reader's, so the row comes across and gives up its
			// claim on the provider entry instead. With no provider_key a refetch
			// cannot see it at all, which is the most protected state there is, and the
			// next fetch re-links it by folded pair through adoptCastRow if it can.
			key = ""
		}
		// A live row beats a tombstone — see the header. The survivor's tombstones
		// for this pair go, because a tombstone exists to stop a refetch resurrecting
		// a row and the row is here now, in front of the reader. Only from here on is
		// that actually true: the carry below cannot be skipped.
		for _, id := range tombs[s.pair] {
			if _, err := tx.Exec(`DELETE FROM work_cast WHERE id = ? AND user_id = ?`, id, uid); err != nil {
				return err
			}
		}
		delete(tombs, s.pair)
		if err := carry(s, key); err != nil {
			return err
		}
	}
	return nil
}
