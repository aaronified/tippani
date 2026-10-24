package mount

import "testing"

// Every path here is a real one from a media library (the shapes Radarr and Sonarr
// write), not a tidy example: ids in braces, season folders, release tags, and the
// language and hearing-impaired markers after the title.

func TestAFilmSubtitleIsNamedByItsFolder(t *testing.T) {
	cases := []struct {
		rel   string
		title string
		year  int
		tmdb  string
	}{
		{"movies/10 Things I Hate About You (1999) {tmdb-4951}/10 Things I Hate About You (1999).en.srt", "10 Things I Hate About You", 1999, "4951"},
		{"movies/12 Angry Men (1957)/12 Angry Men (1957).eng.srt", "12 Angry Men", 1957, ""},
		{"movies/2001 A Space Odyssey (1968) {tmdb-62}/2001 A Space Odyssey (1968) {tmdb-62} [HDTV-1080p][AAC 2.0][x264].hi.srt", "2001 A Space Odyssey", 1968, "62"},
	}
	for _, c := range cases {
		n, ok := ParseSubtitle(c.rel)
		if !ok || n.IsShow || n.Title != c.title || n.Year != c.year || n.TMDB != c.tmdb {
			t.Errorf("%s -> %+v ok=%v", c.rel, n, ok)
		}
	}
}

func TestAnEpisodesSubtitleNamesTheShowNotTheSeasonFolder(t *testing.T) {
	n, ok := ParseSubtitle("shows/Battlestar Galactica (2003) {tvdb-73545}/Season 03/Battlestar Galactica (2003) - S03E01 - Occupation [Bluray-1080p][AAC 5.1][x265]-UTR.en.hi.srt")
	if !ok || !n.IsShow || n.Title != "Battlestar Galactica" || n.Year != 2003 || n.TVDB != "73545" || n.Season != 3 || n.Episode != 1 {
		t.Fatalf("%+v", n)
	}
	// A looser spelling of the same thing.
	n, _ = ParseSubtitle("tv/Andor (2022)/Season 1/andor.s01e04.en.srt")
	if !n.IsShow || n.Title != "Andor" || n.Season != 1 || n.Episode != 4 {
		t.Fatalf("%+v", n)
	}
}

func TestASpecialFolderIsNotTheShow(t *testing.T) {
	n, ok := ParseSubtitle("shows/Doctor Who (2005)/Specials/Doctor Who - S00E03 - Something.en.srt")
	if !ok || n.Title != "Doctor Who" {
		t.Fatalf("%+v", n)
	}
}

func TestASubtitleAtTheRootNamesNothing(t *testing.T) {
	if _, ok := ParseSubtitle("loose.en.srt"); ok {
		t.Fatal("a file with no folder names no work")
	}
}

// Competing tracks for one film: plain English first, hearing-impaired next, any other
// language after, and a forced-only track last of all.
func TestSubtitleRanksPreferPlainEnglish(t *testing.T) {
	rank := func(name string) int { return subtitleRank(name) }
	order := []string{
		"Film (2001).en.srt", "Film (2001).eng.srt", "Film (2001).srt",
		"Film (2001) [HDTV-1080p].en.hi.srt",
		"Film (2001).sv.srt",
		"Film (2001).en.forced.srt",
	}
	if !(rank(order[0]) == 0 && rank(order[1]) == 0 && rank(order[2]) == 0) {
		t.Fatalf("plain english: %d %d %d", rank(order[0]), rank(order[1]), rank(order[2]))
	}
	if !(rank(order[3]) > rank(order[0]) && rank(order[4]) > rank(order[3]) && rank(order[5]) > rank(order[4])) {
		t.Fatalf("ranks: %d %d %d", rank(order[3]), rank(order[4]), rank(order[5]))
	}
}
