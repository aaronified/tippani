package httpapi

import (
	"bytes"
	"database/sql"
	"fmt"
	"net/http"

	"tippani/internal/importer"
	"tippani/internal/metadata"
	"tippani/internal/store"
)

// handleImportIMDb stages a saved IMDb quotes page as film/show dialogue. Like
// every other import it writes nothing into the library: the dialogues sit in the
// pending queue until approved (ROADMAP 1.2.0).
//
// Anchoring (PLAN §5, user request): a page's title rarely matches a title the
// user already curated on the year alone (IMDb's release year and TMDB's often
// differ by one), so dialogues attach to a pre-existing same-title film when
// there is one, rather than spawning a poster-less duplicate. That decision now
// happens at approval — the library may have changed while the quotes waited —
// but it is *previewed* on the staging reply and in the queue, so "this will
// attach to your existing Casablanca (1942)" can be seen and corrected before
// anything is written.
func (s *Server) handleImportIMDb(w http.ResponseWriter, r *http.Request) {
	data, filename, ok := readUpload(w, r)
	if !ok {
		return
	}
	res, err := importer.IMDbQuotes(bytes.NewReader(data))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	s.stageMovies(w, r, "imdb", filename, []*importer.MovieResult{res}, nil)
}

// importMovieResult reports how an imported title resolved: which movie the
// dialogues attach to, whether it was newly created or anchored to a pre-existing
// same-title row, the anchor's own year (to flag a mismatch), and whether the
// match was ambiguous (more than one same-title film existed).
type importMovieResult struct {
	ID           int64
	Created      bool
	Anchored     bool
	MatchedYear  int
	Ambiguous    bool
	Alternatives int
}

// movieSummary is one title's outcome in an approval reply — the shape the import
// endpoints used to answer with directly, before staging moved the write behind
// an explicit approve step.
type movieSummary struct {
	MovieID      int64  `json:"movie_id"`
	Title        string `json:"title"`
	MediaType    string `json:"media_type"`
	Created      bool   `json:"created"`
	Anchored     bool   `json:"anchored"`
	YearImported int    `json:"year_imported"`
	MatchedYear  int    `json:"matched_year"`
	Ambiguous    bool   `json:"ambiguous"`
	Alternatives int    `json:"alternatives"`
	Added        int    `json:"added"`
	Skipped      int    `json:"skipped"`
	Enriched     int    `json:"enriched"`
}

// importMediaType folds anything outside the vocabulary into "movie". Unlike
// normalizeMediaType (movie_handlers.go), which validates a client's field and
// rejects a bad value, a parsed file must never 400 over its media type — an
// import guesses, and the queue is where a wrong guess gets corrected.
//
// It has to name every value the shelf knows, or it silently un-does the
// parsers: "game" arrived in the vocabulary with 0040, this kept folding it to
// "movie", and an imported game landed on the film shelf no matter what the
// parser had worked out. Adding a media type means adding it here too.
func importMediaType(t string) string {
	switch t {
	case "show", "game":
		return t
	}
	return "movie"
}

// findImportMovie previews where imported dialogue would land, writing nothing:
// the best same-title candidate within the same media_type, or a zero result when
// the title is new. Imported titles carry no tmdb/tvdb id, so identity is a fuzzy
// title match.
func findImportMovie(q rowQuerier, uid int64, title, mediaType string, year int) (importMovieResult, error) {
	matches, err := findSimilarMovies(q, uid, title, importMediaType(mediaType), 0)
	if err != nil {
		return importMovieResult{}, err
	}
	return anchorMovie(matches, year), nil
}

// anchorMovie picks the best of the same-title candidates: an exact year match
// dominates, then the most-curated row. A zero ID means "nothing to anchor to".
func anchorMovie(matches []movieDupHint, importedYear int) importMovieResult {
	if len(matches) == 0 {
		return importMovieResult{}
	}
	best := matches[0]
	for _, cand := range matches[1:] {
		if anchorScore(cand, importedYear) > anchorScore(best, importedYear) {
			best = cand
		}
	}
	return importMovieResult{
		ID:           best.ID,
		Anchored:     true,
		MatchedYear:  best.ReleaseYear,
		Ambiguous:    len(matches) > 1,
		Alternatives: len(matches) - 1,
	}
}

// upsertImportMovie finds or creates the film/show to attach dialogues to: it
// anchors to the best pre-existing same-title row when there is one, otherwise it
// creates a bare row that a later TMDB/TVDB lookup can enrich.
func upsertImportMovie(tx *sql.Tx, uid int64, m importer.MovieHeader) (importMovieResult, error) {
	mediaType := importMediaType(m.MediaType)
	got, err := findImportMovie(tx, uid, m.Title, mediaType, m.Year)
	if err != nil {
		return importMovieResult{}, err
	}
	if got.ID != 0 {
		return got, nil
	}
	id, err := nextID(tx, "movies")
	if err != nil {
		return importMovieResult{}, err
	}
	if _, err := tx.Exec(
		`INSERT INTO movies (id, updated_at, user_id, title, release_year, media_type)
		 VALUES (?, datetime('now'), ?, ?, ?, ?)`,
		id, uid, m.Title, nullableInt(m.Year), mediaType); err != nil {
		return importMovieResult{}, err
	}
	if err := applyImportedShelf(tx, "movie", mediaType, uid, id, movieShelf(m)); err != nil {
		return importMovieResult{}, err
	}
	return importMovieResult{ID: id, Created: true}, nil
}

// anchorScore ranks a same-title candidate for imported dialogues: an exact
// release-year match dominates, then a curated poster, then existing dialogues,
// then recency (higher id). Higher wins.
func anchorScore(h movieDupHint, importedYear int) int {
	score := 0
	if importedYear != 0 && h.ReleaseYear == importedYear {
		score += 8
	}
	if h.HasPoster {
		score += 4
	}
	if h.DialogueCount > 0 {
		score += 2
	}
	return score
}

// backfillImportMovie fills in the fields a catalogue export carries and the
// stored row lacks. Fill-empty-only throughout: a director, collection or genre
// set already on the row — curated by hand, or from TMDB's belongs_to_collection
// — always wins over the file's version.
func backfillImportMovie(tx *sql.Tx, uid, movieID int64, m importer.MovieHeader, seps metadata.CreditSeps) error {
	if m.Director != "" {
		if _, err := tx.Exec(
			`UPDATE movies SET director = COALESCE(director, ?), updated_at = datetime('now') WHERE id = ?`,
			nullable(m.Director), movieID); err != nil {
			return err
		}
	}
	// NULLIF rather than COALESCE, because this column is NOT NULL DEFAULT ''
	// (0042): an unset publisher is the empty string, not a NULL, so COALESCE
	// would treat "never filled in" as "already filled in" and the fill-empty-only
	// rule would never fire.
	if m.Publisher != "" {
		if _, err := tx.Exec(
			`UPDATE movies SET publisher = COALESCE(NULLIF(publisher, ''), ?), updated_at = datetime('now') WHERE id = ?`,
			m.Publisher, movieID); err != nil {
			return err
		}
	}
	if m.Series != "" {
		if _, err := tx.Exec(
			`UPDATE movies SET series = COALESCE(series, ?), series_index = COALESCE(series_index, ?), updated_at = datetime('now')
			 WHERE id = ?`,
			nullable(m.Series), nullableFloat(m.SeriesIndex), movieID); err != nil {
			return err
		}
	}
	// Shelf state, fill-empty-only like the rest: re-importing an older export
	// must not un-mark something you are part-way through, nor duplicate a watch
	// history the row already has. The row's OWN media type decides whether an
	// episode position is meaningful — the file may disagree with what is stored.
	var mediaType string
	if err := tx.QueryRow(`SELECT media_type FROM movies WHERE id = ?`, movieID).Scan(&mediaType); err != nil {
		return err
	}
	if err := applyImportedShelf(tx, "movie", mediaType, uid, movieID, movieShelf(m)); err != nil {
		return err
	}
	if len(m.Genres) > 0 { // only when the row has no genres (don't clobber a curated set)
		var hasGenres bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM movie_genres WHERE movie_id = ?)`, movieID).Scan(&hasGenres); err != nil {
			return err
		}
		if !hasGenres {
			if err := setGenres(tx, "movie", uid, movieID, m.Genres); err != nil {
				return err
			}
		}
	}
	// 0056. The director above is fill-empty-only, so whether it changed is not
	// something this function knows — it reads the column back rather than
	// guessing, which is also what makes a repeated import a no-op here.
	if err := store.SyncCreditsFromColumns(tx, uid, "movie", movieID, seps); err != nil {
		return err
	}
	return nil
}

// writeMovieDialogues inserts/enriches a batch of parsed dialogues against a
// film/show that has ALREADY been resolved, inside the caller's transaction. The
// counterpart of writeBookAnnotations, and split from upsertImportMovie for the
// same reason: the staging queue hands this loop a title the *user* picked when
// they retarget a misdetected file, and the dedupe, fill-empty enrichment and
// tag-union rules stay one implementation.
func writeMovieDialogues(tx *sql.Tx, uid, movieID int64, dialogues []importer.Dialogue, seps metadata.CreditSeps) (int, int, error) {
	// The media type, since only a show's lines may carry an episode. The actor
	// autofill used to be fed from here too — it read the title's stored TMDB blob —
	// and now queries the cast mapping per line instead (0048), which is what lets
	// an imported GAME line take the voice actor the reader typed. There was never
	// anything in the blob for a game to take.
	var mediaType string
	_ = tx.QueryRow(`SELECT COALESCE(media_type, 'movie') FROM movies WHERE id = ?`,
		movieID).Scan(&mediaType)
	show := mediaType == "show"
	// A GAME IS THE THIRD MEDIUM AND NEEDS ITS OWN GATE (0047), which is the same
	// gate normalizeLocator applies at the API, in the same direction: which
	// locators a line keeps is decided by the DESTINATION's media type, never by
	// the file's, because retargeting a misdetected file onto the right work is
	// the whole repair the queue exists for.
	game := mediaType == "game"

	// The film's quiz opt-out, inherited by every line this loop writes.
	//
	// A SECOND READ OF A ROW ALREADY FETCHED, on purpose. The query above ignores
	// its error because a missing media type costs a locator clear and nothing
	// else, and the same tolerance applied here would turn a failed read into a silent
	// "included" — the exact shape of the bug this fixes. It goes through
	// workExclusion so both import paths answer this question the same way.
	excluded, err := workExclusion(tx, "movies", movieID)
	if err != nil {
		return 0, 0, err
	}

	added, enriched := 0, 0
	// One id reservation for the batch (idBlock, id_floor.go).
	ids := newIDBlock(tx, "dialogues", len(dialogues))
	for _, d := range dialogues {
		actor := autofillActor(tx, "movie", movieID, d.Character, d.Actor)
		// A film has one runtime and no episodes. Retargeting a show's file onto a
		// film is a legitimate repair, so the locator is dropped rather than
		// treated as an error — the same forgiveness the colour default gets. An
		// episode with no season is dropped for the same reason it is rejected at
		// the API: it cannot be ordered against a numbered season.
		season, episode := d.Season, d.Episode
		if !show || season == nil {
			season, episode = nil, nil
		}
		// A game is placed by its act and its quest and by nothing else, so the
		// other two clears are the mirror image of the one above: a game keeps no
		// timestamp (it has no runtime to point into), and everything that is not a
		// game keeps no act and no quest. An episode's NAME needs an episode to be
		// the name of, so it follows `show`.
		//
		// Cleared BEFORE the hash, which is the ordering that matters: act and quest
		// are in DialogueDedupeHash, so a film line still carrying a stale quest
		// would hash as though it were a game's and fork a duplicate of a line
		// already on the record. Same contract as dialogueReq.hash().
		act, quest := d.Act, d.Quest
		if !game {
			act, quest = "", ""
		}
		timestamp := d.Timestamp
		if game {
			timestamp = ""
		}
		episodeName := d.EpisodeName
		if !show {
			episodeName = ""
		}
		// Same rule as the book importer: IMDb quote pages carry no colour, so
		// an unset one lands on the yellow default (PLAN §3).
		color := d.Color
		if color == "" {
			color = "yellow"
		}
		if !validColor(color) {
			return 0, 0, importClientError{fmt.Sprintf("invalid color %q", d.Color)}
		}
		// dialogues.quote is NOT NULL — a note-only row (legal for annotations,
		// and reachable here by retargeting book highlights onto a film) promotes
		// its note into the quote, exactly as the Markdown exporter does.
		quote, note := d.Quote, d.Note
		if quote == "" {
			quote, note = note, ""
		}
		if quote == "" {
			continue
		}
		// Computed once, from the cleared locators, and used by all three statements
		// below — the INSERT, the enrichment's WHERE, and the lookup that finds the
		// row a collision landed on. Three spellings of the same hash is three places
		// to forget the same argument.
		hash := store.DialogueDedupeHash(quote, season, episode, act, quest)
		did, err := ids.take()
		if err != nil {
			return 0, 0, err
		}
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO dialogues
			  (id, movie_id, quote, note, translation, color, character, actor, timestamp, season, episode,
			   act, quest, episode_name, favorite, dedupe_hash, noted_at, review_excluded)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			did, movieID, quote, nullable(note),
			// 0051, plain string, out of the hash — see the annotation importer.
			d.Translation, color, nullable(d.Character), nullable(actor),
			nullable(timestamp), season, episode,
			// Plain strings: NOT NULL DEFAULT '' (0047), so nullable("") would send the
			// NULL the column refuses rather than the default it already has.
			act, quest, episodeName,
			d.Favorite, hash, nullable(d.NotedAt),
			excluded)
		if err != nil {
			return 0, 0, err
		}
		if n, _ := ins.RowsAffected(); n == 0 {
			upd, err := tx.Exec(`
				UPDATE dialogues SET
				  note      = COALESCE(note, ?),
				  character = COALESCE(character, ?),
				  actor     = COALESCE(actor, ?),
				  timestamp = COALESCE(timestamp, ?),
				  season    = COALESCE(season, ?),
				  episode   = COALESCE(episode, ?),
				  noted_at  = COALESCE(noted_at, ?),
				  episode_name = CASE WHEN episode_name = '' THEN ? ELSE episode_name END,
				  translation = CASE WHEN translation = '' THEN ? ELSE translation END,
				  color     = CASE WHEN color = 'yellow' AND ? <> 'yellow' THEN ? ELSE color END,
				  favorite  = MAX(favorite, ?),
				  updated_at = datetime('now')
				WHERE movie_id = ? AND dedupe_hash = ?
				  AND (   (note IS NULL AND ? IS NOT NULL)
				       OR (character IS NULL AND ? IS NOT NULL)
				       OR (actor IS NULL AND ? IS NOT NULL)
				       OR (timestamp IS NULL AND ? IS NOT NULL)
				       OR (season IS NULL AND ? IS NOT NULL)
				       OR (episode IS NULL AND ? IS NOT NULL)
				       OR (noted_at IS NULL AND ? IS NOT NULL)
				       OR (episode_name = '' AND ? <> '')
				       OR (translation = '' AND ? <> '')
				       OR (color = 'yellow' AND ? <> 'yellow')
				       OR (favorite = 0 AND ?))`,
				nullable(note), nullable(d.Character), nullable(actor), nullable(timestamp),
				season, episode, nullable(d.NotedAt),
				// THE EPISODE NAME AND THE TRANSLATION ENRICH. Act and quest are IN the dedupe hash
				// (0047), so a row this line collided with already holds the same pair by
				// construction — donating them would be writing a value onto itself. The
				// episode name is not in the hash, which is exactly why it can be missing
				// from the copy already staged and arrive with the second file.
				//
				// CASE WHEN and `<> ''` rather than COALESCE and IS NOT NULL, because on a
				// NOT NULL DEFAULT '' column the obvious spelling donates nothing while
				// reporting an enrichment. See enrichStagedQuote.
				episodeName, d.Translation,
				color, color, d.Favorite,
				movieID, hash,
				nullable(note), nullable(d.Character), nullable(actor), nullable(timestamp),
				season, episode, nullable(d.NotedAt),
				episodeName, d.Translation,
				color, d.Favorite)
			if err != nil {
				return 0, 0, err
			}
			n, _ := upd.RowsAffected()
			if n > 0 {
				enriched++
			}
			// The row already holding the slot — not the id reserved above, which
			// this ignored insert left attached to nothing.
			//
			// Looked up whenever there is something to do with it, which is now the
			// enrichment as well as the tags: a COALESCE that just filled a blank
			// actor is exactly the write 0059's link has to follow, and it is
			// precisely the write whose result the caller does not know without
			// reading it back.
			if n > 0 || len(d.Tags) > 0 {
				var existingID int64
				if err := tx.QueryRow(`SELECT id FROM dialogues WHERE movie_id = ? AND dedupe_hash = ?`,
					movieID, hash).Scan(&existingID); err == nil {
					if len(d.Tags) > 0 {
						if err := addTags(tx, "dialogue", uid, existingID, d.Tags); err != nil {
							return 0, 0, err
						}
					}
					if n > 0 {
						if err := store.SyncQuotePerson(tx, uid, store.KindScreen, existingID, seps); err != nil {
							return 0, 0, err
						}
					}
				}
			}
			continue
		}
		added++
		if err := store.SyncQuotePerson(tx, uid, store.KindScreen, did, seps); err != nil {
			return 0, 0, err
		}
		if len(d.Tags) > 0 {
			if err := setTags(tx, "dialogue", uid, did, d.Tags); err != nil {
				return 0, 0, err
			}
		}
	}
	return added, enriched, nil
}
