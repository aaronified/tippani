package mount

import (
	"path"
	"regexp"
	"strconv"
	"strings"
)

// What a path says about the work it belongs to.
//
// THE ONE PLACE THE APP DEPENDS ON A NAME, and the plan says so rather than pretend
// otherwise: a subtitle contains no title, no year and no identifier (the owner's own
// file opens with an advertisement), so there is nothing inside it to read. A film's
// subtitle is identified by the folder it sits in, which every media server already
// lays out as `Movie Title (Year)/…`, and a show's episode by the SxxExx in the
// file's name. Where the guess is wrong the reader reassigns it; nothing here is
// trusted enough to write on its own, and a scan only ever PROPOSES.
//
// The layouts below are the ones a real library has: Radarr/Sonarr-style folders with
// a trailing {tmdb-123} / {tvdb-123} id, `Season 03` folders, and subtitle names that
// carry a language and a hearing-impaired marker after the title.

// SubtitleName is what a subtitle's path says.
type SubtitleName struct {
	Title string
	Year  int
	// IsShow is true when the file's name carries an episode.
	IsShow          bool
	Season, Episode int
	// TMDB and TVDB are the ids a media manager puts in a folder name, "" when absent. An
	// id that the library also holds is an exact match, no fuzz.
	TMDB, TVDB string
	// Rank orders competing subtitle files for the same film or episode: lower is
	// better. A plain English track beats a hearing-impaired one, which beats any other
	// language, since the quotes the reader keeps are in the language they read.
	Rank int
}

var (
	idTag      = regexp.MustCompile(`\{(tmdb|tvdb|imdb)-([A-Za-z0-9]+)\}`)
	yearTag    = regexp.MustCompile(`\((\d{4})\)`)
	episodeTag = regexp.MustCompile(`(?i)\bS(\d{1,3})[ ._-]?E(\d{1,4})\b`)
	seasonDir  = regexp.MustCompile(`(?i)^(season|series|staffel|saison)\s*\d+$|^specials?$`)
	bracketed  = regexp.MustCompile(`\[[^\]]*\]`)
)

// cleanFolder takes the work's name out of a folder or file stem: ids, the year and
// bracketed release tags removed, whitespace collapsed.
func cleanFolder(s string) (title string, year int, tmdb, tvdb string) {
	for _, m := range idTag.FindAllStringSubmatch(s, -1) {
		switch strings.ToLower(m[1]) {
		case "tmdb":
			tmdb = m[2]
		case "tvdb":
			tvdb = m[2]
		}
	}
	if m := yearTag.FindStringSubmatch(s); m != nil {
		year, _ = strconv.Atoi(m[1])
	}
	s = idTag.ReplaceAllString(s, "")
	s = yearTag.ReplaceAllString(s, "")
	s = bracketed.ReplaceAllString(s, "")
	return strings.Join(strings.Fields(s), " "), year, tmdb, tvdb
}

// ParseSubtitle reads a subtitle's relative path. ok is false when no work can be named.
func ParseSubtitle(rel string) (SubtitleName, bool) {
	rel = strings.ReplaceAll(rel, `\`, "/")
	dir, file := path.Split(rel)
	dir = strings.Trim(dir, "/")
	if dir == "" {
		return SubtitleName{}, false // a subtitle at the root names no folder
	}
	var n SubtitleName
	n.Rank = subtitleRank(file)

	folders := strings.Split(dir, "/")
	if m := episodeTag.FindStringSubmatch(file); m != nil {
		n.IsShow = true
		n.Season, _ = strconv.Atoi(m[1])
		n.Episode, _ = strconv.Atoi(m[2])
		// The show is the nearest ancestor that is not a "Season 03" folder.
		for i := len(folders) - 1; i >= 0; i-- {
			if seasonDir.MatchString(strings.TrimSpace(folders[i])) {
				continue
			}
			n.Title, n.Year, n.TMDB, n.TVDB = cleanFolder(folders[i])
			break
		}
	} else {
		n.Title, n.Year, n.TMDB, n.TVDB = cleanFolder(folders[len(folders)-1])
	}
	return n, n.Title != ""
}

// subtitleRank scores a subtitle file name for preference, lower being better.
func subtitleRank(file string) int {
	stem := strings.TrimSuffix(file, path.Ext(file))
	parts := strings.Split(strings.ToLower(stem), ".")
	rank := 0
	lang := ""
	hearing := false
	for _, p := range parts[1:] { // the first part is the title, which may be anything
		switch p {
		case "hi", "sdh", "cc":
			hearing = true
		case "forced":
			rank += 30
		default:
			if len(p) <= 3 && lang == "" && regexp.MustCompile(`^[a-z]{2,3}(-[a-z]{2,4})?$`).MatchString(p) {
				lang = p
			}
		}
	}
	switch lang {
	case "", "en", "eng", "english", "en-us", "en-gb":
		// English, or unmarked, which in a library of English films is the same.
	default:
		rank += 20
	}
	if hearing {
		rank += 5
	}
	return rank
}
