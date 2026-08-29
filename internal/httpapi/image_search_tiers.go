package httpapi

// The ladder a picture strip climbs, and the pinned identities that let it start
// at the top.
//
// A STRIP USED TO BE A FLAT MERGE and that was the bug behind "character search
// does not work". Every configured supplier was asked the same web-search
// sentence and their answers were poured into one list in whatever order the
// handler happened to call them — which is the right shape when the suppliers are
// interchangeable and the wrong one the moment they are not. For a ROLE they are
// not remotely interchangeable: TheTVDB has the actual photograph of the actual
// character, and a web image search has a guess built from three words. Asking
// both and merging meant the guess and the photograph arrived as peers.
//
// Worse, the supplier that HAS the picture was never asked at all. `/images/search`
// could reach Google and Amazon and nothing else, so on any install without a
// Custom Search key — which is most of them, it needs a key AND an engine id — a
// character strip came back empty and the interface fell through to opening a
// browser tab. The one supplier that has ever had an image per role was sitting
// behind a key the app ships with, unqueried.
//
// SO: AN ORDERED LADDER, HIGHEST FIRST, AND EVERY RUNG STILL RUNS. The order is
// what changes, not the membership — a reader opening a picker wants to reject
// the first picture, so a strip that short-circuited on its best tier would be a
// strip with one thing in it. What ordering buys is that the 18-hit cap is spent
// from the top: TheTVDB's photograph of the role takes the first slot and a web
// guess takes the eighteenth, rather than the other way round because Google
// answered faster.
//
// A TIER THAT CANNOT RUN IS NOT A FAILURE. No key, no pinned id, wrong media
// type — each is a rung that is simply absent for this request, and the ladder is
// built from the rungs that apply. That is why the tiers are assembled into a
// slice before any of them runs rather than being a chain of ifs: the shape of
// the ladder is a fact worth being able to read, and to log.

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// imageTier is one rung. `name` is what the trace calls it; `run` returns its
// hits and swallows its own failure, because one supplier being down is not the
// request being down.
type imageTier struct {
	name string
	run  func(ctx context.Context) []metadata.ImageHit
}

// castPin is what a cast row can tell the ladder about where to look: the work's
// TheTVDB id (so a role can be found on it) and the role's own name and actor.
//
// PER-USER ISOLATION IS WHY THE CLIENT SENDS AN ID AND NOT THE FACTS. The strip
// could have been passed a tvdb_id and a character name directly, and then a
// request could name somebody else's row. So the client sends `cast_id`, this
// reads it back scoped by user_id, and a row that is not theirs resolves to
// nothing at all — the ladder simply loses its top rung, which is what a 404
// would mean here anyway.
type castPin struct {
	TVDBWorkID string
	MediaType  string
	Character  string
	Actor      string
	PersonID   string // TheTVDB person id, when the row came from TheTVDB
	Source     string // the supplier this row's ids belong to
}

// castPinFor resolves a cast row to the pinned identities behind it. Every miss
// — no id sent, not their row, a work with no TheTVDB pin — returns the zero
// value rather than an error: the caller's next line is "build the ladder from
// what applies", and there is nothing here it could usefully report.
func (s *Server) castPinFor(uid, castID int64) castPin {
	if castID <= 0 {
		return castPin{}
	}
	var p castPin
	var workID int64
	var kind string
	err := s.Store.DB.QueryRow(
		`SELECT c.work_id, c.kind, c.character, c.actor,
		        COALESCE(c.person_id, ''), COALESCE(c.source, '')
		   FROM work_cast c
		  WHERE c.id = ? AND c.user_id = ? AND c.origin <> 'removed'`,
		castID, uid,
	).Scan(&workID, &kind, &p.Character, &p.Actor, &p.PersonID, &p.Source)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			olog.Warnf(olog.CodeCastRowScan, "[meta] image ladder: cast %d unreadable: %v", castID, err)
		}
		return castPin{}
	}
	// A BOOK'S CHARACTER HAS NO TheTVDB WORK, and that is not a failure either —
	// it is the case the ladder's lower rungs exist for. Only a screen work
	// carries the pin this rung needs.
	if kind != "movie" {
		return p
	}
	var tvdbID int64
	var mediaType string
	if err := s.Store.DB.QueryRow(
		`SELECT COALESCE(tvdb_id, 0), COALESCE(media_type, 'movie')
		   FROM movies WHERE id = ? AND user_id = ?`, workID, uid,
	).Scan(&tvdbID, &mediaType); err != nil {
		return p
	}
	p.MediaType = mediaType
	if tvdbID != 0 {
		p.TVDBWorkID = strconv.FormatInt(tvdbID, 10)
	}
	return p
}

// personPin is a person's pinned supplier identity — the thing that turns "some
// actor called Hugo Weaving" into "TheTVDB person 294011" and makes a portrait
// lookup exact rather than namesake-prone.
type personPin struct {
	Source   string // tmdb | tvdb | wikidata | openlibrary | manual | ""
	SourceID string
	Name     string
	// THE LINKS FIELD IS A PINNED IDENTITY IN DISGUISE. A person resolved through
	// Open Library carries their Wikipedia article here, which is the exact
	// article — so the Wikimedia rung can fetch a known page instead of searching
	// a name and hoping it is not a namesake. Free text, space-separated, exactly
	// as mergePersonLinks writes it.
	Links string
}

// personPinFor resolves a person by id when the client knows one, and by name
// when it does not — the people console has always worked from a name, and a
// portrait strip opened there should not have to learn a new parameter to get a
// better answer. Scoped by user_id both ways.
func (s *Server) personPinFor(uid, personID int64, name string) personPin {
	var p personPin
	var err error
	switch {
	case personID > 0:
		err = s.Store.DB.QueryRow(
			`SELECT COALESCE(source, ''), COALESCE(source_id, ''), name, COALESCE(links, '')
			   FROM people WHERE id = ? AND user_id = ?`, personID, uid,
		).Scan(&p.Source, &p.SourceID, &p.Name, &p.Links)
	case strings.TrimSpace(name) != "":
		err = s.Store.DB.QueryRow(
			`SELECT COALESCE(source, ''), COALESCE(source_id, ''), name, COALESCE(links, '')
			   FROM people WHERE user_id = ? AND name = ?`, uid, strings.TrimSpace(name),
		).Scan(&p.Source, &p.SourceID, &p.Name, &p.Links)
	default:
		return personPin{}
	}
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			olog.Warnf(olog.CodeCastRowScan, "[meta] image ladder: person unreadable: %v", err)
		}
		return personPin{}
	}
	return p
}

// tvdbPersonIDFromCast finds a TheTVDB person id for a name by looking at what
// the reader's own cast rows already recorded.
//
// WHY THIS IS WORTH A QUERY. TheTVDB has no person search this client can express
// — `tvdbType` collapses every search to movie or series — so a name alone cannot
// reach a TheTVDB person. But a reader asking for a portrait of an actor almost
// always has that actor in a film they have already fetched, and that fetch
// stored `peopleId` on the cast row. So the id is usually already in the library,
// put there by a lookup that happened weeks ago, and this is the difference
// between the top rung applying and not.
//
// Newest row wins on the assumption that the most recently fetched work is the
// most recently correct; a namesake collision here costs one wrong portrait
// offered in a picker, which the reader then does not pick.
func (s *Server) tvdbPersonIDFromCast(uid int64, name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	var id string
	if err := s.Store.DB.QueryRow(
		`SELECT c.person_id
		   FROM work_cast c
		   JOIN movies m ON m.id = c.work_id AND m.user_id = c.user_id
		  WHERE c.user_id = ? AND c.kind = 'movie' AND c.actor = ?
		    AND c.source = 'tvdb' AND COALESCE(c.person_id, '') <> ''
		    AND c.origin <> 'removed' AND m.tvdb_id IS NOT NULL
		  ORDER BY c.id DESC LIMIT 1`, uid, name,
	).Scan(&id); err != nil {
		return ""
	}
	return strings.TrimSpace(id)
}

// tvdbCharacterTier is the rung that has the actual photograph of the actual
// role. Absent unless the work is pinned to TheTVDB and a key resolves.
func (s *Server) tvdbCharacterTier(pin castPin, subject string) *imageTier {
	tvdb, _ := s.resolveTVDB()
	if tvdb == nil || pin.TVDBWorkID == "" {
		return nil
	}
	role := subject
	if strings.TrimSpace(role) == "" {
		role = pin.Character
	}
	return &imageTier{name: "tvdb", run: func(ctx context.Context) []metadata.ImageHit {
		hits, err := tvdb.CharacterImages(ctx, pin.MediaType, pin.TVDBWorkID, role)
		if err != nil {
			olog.Warnf(olog.CodeMetaLookupFailed, "[meta] tvdb character art %q: %v", role, err)
			return nil
		}
		return hits
	}}
}

// tvdbPortraitTier asks TheTVDB for every portrait it holds of a person. Needs a
// TheTVDB person id, which comes either from the person's own pin or from a cast
// row that recorded one.
func (s *Server) tvdbPortraitTier(uid int64, pin personPin, castPersonID, name string) *imageTier {
	tvdb, _ := s.resolveTVDB()
	if tvdb == nil {
		return nil
	}
	id := strings.TrimSpace(castPersonID)
	if id == "" && pin.Source == "tvdb" {
		id = pin.SourceID
	}
	if id == "" {
		id = s.tvdbPersonIDFromCast(uid, firstNonEmpty(pin.Name, name))
	}
	if id == "" {
		return nil
	}
	return &imageTier{name: "tvdb", run: func(ctx context.Context) []metadata.ImageHit {
		hits, err := tvdb.PersonImages(ctx, id)
		if err != nil {
			olog.Warnf(olog.CodeMetaLookupFailed, "[meta] tvdb portraits for person %s: %v", id, err)
			return nil
		}
		return hits
	}}
}

// tmdbPortraitTier is the second rung for a face: one profile image per person,
// which is all TMDB has ever had. Reached by the person's pinned TMDB id when
// there is one, and otherwise by TMDB's own person search — namesake-prone, which
// is exactly why it sits BELOW the pinned rungs rather than beside them.
func (s *Server) tmdbPortraitTier(pin personPin, name string) *imageTier {
	tmdb, _ := s.resolveTMDB()
	if tmdb == nil {
		return nil
	}
	pinned := ""
	if pin.Source == "tmdb" {
		pinned = strings.TrimSpace(pin.SourceID)
	}
	who := firstNonEmpty(pin.Name, name)
	if pinned == "" && strings.TrimSpace(who) == "" {
		return nil
	}
	return &imageTier{name: "tmdb", run: func(ctx context.Context) []metadata.ImageHit {
		id := pinned
		if id == "" {
			id = tmdb.PersonSearchID(ctx, who)
		}
		if id == "" {
			return nil
		}
		meta, err := tmdb.PersonDetails(ctx, id)
		if err != nil || meta == nil || meta.ImageURL == "" {
			if err != nil {
				olog.Warnf(olog.CodeMetaLookupFailed, "[meta] tmdb portrait for %q: %v", who, err)
			}
			return nil
		}
		return []metadata.ImageHit{{URL: meta.ImageURL, Source: "tmdb"}}
	}}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// wikipediaLinkOf picks the Wikipedia article out of a person's stored links.
// Recognised by HOST rather than by position, using the same provider table the
// link merger writes with, so a reader who pasted their own article gets the same
// benefit as one whose article arrived from Open Library.
func wikipediaLinkOf(links string) string {
	for _, tok := range strings.Fields(links) {
		u, err := url.Parse(tok)
		if err != nil || u.Hostname() == "" {
			continue
		}
		if strings.HasSuffix(strings.ToLower(u.Hostname()), "wikipedia.org") {
			return tok
		}
	}
	return ""
}

// wikimediaPortraitTier is the third rung for a face: free, keyless, and exact
// whenever the person's own record carries their article.
//
// NO KEY MEANS NO GATE, which makes this the first rung an unconfigured install
// can actually reach — a self-built binary with no TheTVDB key and no Custom
// Search pair had literally no portrait source before it.
func (s *Server) wikimediaPortraitTier(pin personPin, name string) *imageTier {
	who := firstNonEmpty(pin.Name, name)
	article := wikipediaLinkOf(pin.Links)
	qid := ""
	if pin.Source == "wikidata" {
		qid = pin.SourceID
	}
	if who == "" && article == "" && qid == "" {
		return nil
	}
	return &imageTier{name: "wikimedia", run: func(ctx context.Context) []metadata.ImageHit {
		return metadata.WikimediaPortraitImages(ctx, who, article, qid)
	}}
}

// wikimediaCharacterTier is the rung under TheTVDB for a role, and the only one
// that works for a role TheTVDB has never heard of — a character in a BOOK, a
// game's typed voice cast, anything on a title pinned to TMDB. Those are exactly
// the rows the character picture never existed for.
//
// The work's title is passed as context and is also what gets refused: see
// WikimediaCharacterImages for why the film's own article is the wrong answer
// that looks most like a right one.
func (s *Server) wikimediaCharacterTier(character, workTitle string) *imageTier {
	if strings.TrimSpace(character) == "" {
		return nil
	}
	return &imageTier{name: "wikimedia", run: func(ctx context.Context) []metadata.ImageHit {
		return metadata.WikimediaCharacterImages(ctx, character, workTitle)
	}}
}

// fandomCharacterTier is the rung under Wikimedia, and the one that covers the
// long tail: Wikipedia writes about a character when the character is notable
// outside their story, and Fandom writes about all of them. Keyless, and honest
// about being a guess — see FandomCharacterImages for why the wiki slug cannot
// be resolved properly and what a wrong guess costs.
func (s *Server) fandomCharacterTier(character, workTitle string) *imageTier {
	if strings.TrimSpace(character) == "" || strings.TrimSpace(workTitle) == "" {
		return nil
	}
	return &imageTier{name: "fandom", run: func(ctx context.Context) []metadata.ImageHit {
		return metadata.FandomCharacterImages(ctx, character, workTitle)
	}}
}

// googleScrapeTier is the bottom of the ladder and is absent unless the reader
// has said yes. See metadata.GoogleImageScrape for why this one needs a setting
// of its own where every other opt-in rides on a credential.
func (s *Server) googleScrapeTier(query string) *imageTier {
	on, err := s.Store.GetSetting(settingGoogleScrape)
	if err != nil || on != "1" || strings.TrimSpace(query) == "" {
		return nil
	}
	return &imageTier{name: "google-scrape", run: func(ctx context.Context) []metadata.ImageHit {
		return metadata.GoogleImageScrape(ctx, query, true, 8)
	}}
}
