package httpapi

import (
	"bytes"
	"database/sql"
	"fmt"
	"net/http"

	"tippani/internal/importer"
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

// importMediaType folds anything that isn't a show into "movie". Unlike
// normalizeMediaType (movie_handlers.go), which validates a client's field and
// rejects a bad value, a parsed file must never 400 over its media type — an
// import guesses, and the queue is where a wrong guess gets corrected.
func importMediaType(t string) string {
	if t == "show" {
		return "show"
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
func backfillImportMovie(tx *sql.Tx, uid, movieID int64, m importer.MovieHeader) error {
	if m.Director != "" {
		if _, err := tx.Exec(
			`UPDATE movies SET director = COALESCE(director, ?), updated_at = datetime('now') WHERE id = ?`,
			nullable(m.Director), movieID); err != nil {
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
	return nil
}

// writeMovieDialogues inserts/enriches a batch of parsed dialogues against a
// film/show that has ALREADY been resolved, inside the caller's transaction. The
// counterpart of writeBookAnnotations, and split from upsertImportMovie for the
// same reason: the staging queue hands this loop a title the *user* picked when
// they retarget a misdetected file, and the dedupe, fill-empty enrichment and
// tag-union rules stay one implementation.
func writeMovieDialogues(tx *sql.Tx, uid, movieID int64, dialogues []importer.Dialogue) (int, int, error) {
	// The actor autofill reads the title's stored TMDB cast, so fetch it once —
	// along with the media type, since only a show's lines may carry an episode.
	var castJSON, mediaType string
	_ = tx.QueryRow(`SELECT COALESCE(cast_json, ''), COALESCE(media_type, 'movie') FROM movies WHERE id = ?`,
		movieID).Scan(&castJSON, &mediaType)
	show := mediaType == "show"

	added, enriched := 0, 0
	// One id reservation for the batch (idBlock, id_floor.go).
	ids := newIDBlock(tx, "dialogues", len(dialogues))
	for _, d := range dialogues {
		actor := autofillActor(castJSON, d.Character, d.Actor)
		// A film has one runtime and no episodes. Retargeting a show's file onto a
		// film is a legitimate repair, so the locator is dropped rather than
		// treated as an error — the same forgiveness the colour default gets. An
		// episode with no season is dropped for the same reason it is rejected at
		// the API: it cannot be ordered against a numbered season.
		season, episode := d.Season, d.Episode
		if !show || season == nil {
			season, episode = nil, nil
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
		did, err := ids.take()
		if err != nil {
			return 0, 0, err
		}
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO dialogues
			  (id, movie_id, quote, note, color, character, actor, timestamp, season, episode, favorite, dedupe_hash, noted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			did, movieID, quote, nullable(note), color, nullable(d.Character), nullable(actor),
			nullable(d.Timestamp), season, episode, d.Favorite, store.DialogueDedupeHash(quote, season, episode), nullable(d.NotedAt))
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
				       OR (color = 'yellow' AND ? <> 'yellow')
				       OR (favorite = 0 AND ?))`,
				nullable(note), nullable(d.Character), nullable(actor), nullable(d.Timestamp),
				season, episode, nullable(d.NotedAt),
				color, color, d.Favorite,
				movieID, store.DialogueDedupeHash(quote, season, episode),
				nullable(note), nullable(d.Character), nullable(actor), nullable(d.Timestamp),
				season, episode, nullable(d.NotedAt),
				color, d.Favorite)
			if err != nil {
				return 0, 0, err
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				enriched++
			}
			if len(d.Tags) > 0 {
				// The row already holding the slot — not the id reserved above, which
				// this ignored insert left attached to nothing.
				var existingID int64
				if err := tx.QueryRow(`SELECT id FROM dialogues WHERE movie_id = ? AND dedupe_hash = ?`,
					movieID, store.DialogueDedupeHash(quote, season, episode)).Scan(&existingID); err == nil {
					if err := addTags(tx, "dialogue", uid, existingID, d.Tags); err != nil {
						return 0, 0, err
					}
				}
			}
			continue
		}
		added++
		if len(d.Tags) > 0 {
			if err := setTags(tx, "dialogue", uid, did, d.Tags); err != nil {
				return 0, 0, err
			}
		}
	}
	return added, enriched, nil
}
