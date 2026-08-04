package importer

import (
	"reflect"
	"strconv"
	"strings"
	"testing"
)

func TestLooksLikeMovieMarkdown(t *testing.T) {
	movie := "---\ntitle: Arrival\ndirector: Denis Villeneuve\nyear: 2016\n---\n\n> A quote.\n- character: Louise\n"
	book := "---\ntitle: Dune\nauthor: Frank Herbert\nisbn: 9780441013593\n---\n\n> A quote.\n- loc: p.12\n"
	movieNoDir := "---\ntitle: X\nyear: 2020\n---\n\n> Line.\n- timestamp: 00:10\n" // detected via binding
	if !LooksLikeMovieMarkdown([]byte(movie)) {
		t.Error("director frontmatter should read as movie")
	}
	if LooksLikeMovieMarkdown([]byte(book)) {
		t.Error("author/isbn should read as book")
	}
	if !LooksLikeMovieMarkdown([]byte(movieNoDir)) {
		t.Error("timestamp binding should read as movie")
	}
}

func TestMovieMarkdownAll(t *testing.T) {
	multi := "---\ntitle: Arrival\ndirector: Denis Villeneuve\nyear: 2016\ngenres: Science Fiction, Drama\n---\n\n" +
		"> If you could see your whole life, would you change things?\n- character: Louise Banks\n- actor: Amy Adams\n- timestamp: 1:41:00\n- tags: beautiful\n- favorite: true\n\n" +
		"---\ntitle: Andor\ntype: show\nyear: 2022\n---\n\n" +
		"> One way out.\n- character: Kino\n"
	res, err := MovieMarkdownAll(strings.NewReader(multi))
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 2 {
		t.Fatalf("got %d titles, want 2", len(res))
	}
	m0 := res[0]
	if m0.Movie.Title != "Arrival" || m0.Movie.Director != "Denis Villeneuve" || m0.Movie.Year != 2016 || m0.Movie.MediaType != "movie" {
		t.Fatalf("movie 0 header = %+v", m0.Movie)
	}
	if !reflect.DeepEqual(m0.Movie.Genres, []string{"Science Fiction", "Drama"}) {
		t.Fatalf("movie 0 genres = %v", m0.Movie.Genres)
	}
	if len(m0.Dialogues) != 1 {
		t.Fatalf("movie 0 dialogues = %d", len(m0.Dialogues))
	}
	d := m0.Dialogues[0]
	if d.Character != "Louise Banks" || d.Actor != "Amy Adams" || d.Timestamp != "1:41:00" || !d.Favorite ||
		!reflect.DeepEqual(d.Tags, []string{"beautiful"}) {
		t.Fatalf("dialogue 0 = %+v", d)
	}
	// Second title is a show and its dialogue didn't leak into the first.
	if res[1].Movie.Title != "Andor" || res[1].Movie.MediaType != "show" {
		t.Fatalf("movie 1 header = %+v", res[1].Movie)
	}
	if len(res[1].Dialogues) != 1 {
		t.Fatalf("movie 1 dialogues = %+v", res[1].Dialogues)
	}
}

// TestLooksLikeMovieMarkdownRouting pins which files route where. The case that
// matters is "bare film": a catalogue export whose optional fields are all empty
// — no director, no collection, no character/actor/timestamp on any line. Before
// the exporter wrote an unconditional "type:" line that file carried nothing
// identifying it as a film, so re-importing it created a book with annotations.
func TestLooksLikeMovieMarkdownRouting(t *testing.T) {
	for _, tc := range []struct {
		name string
		md   string
		want bool
	}{
		{
			"bare film with only a type line",
			"---\ntitle: Stalker\ntype: movie\n---\n\n> Let everything come true.\n",
			true,
		},
		{
			"bare film without a type line is indistinguishable, defaults to book",
			"---\ntitle: Stalker\n---\n\n> Let everything come true.\n",
			false,
		},
		{
			"type line wins over nothing else",
			"---\ntitle: Andor\ntype: show\n---\n\n> One way out.\n",
			true,
		},
		{
			"type: book routes to the book importer",
			"---\ntitle: Invisible Cities\ntype: book\n---\n\n> Cities, like dreams.\n",
			false,
		},
		{
			"case-insensitive type line",
			"---\ntitle: Stalker\nType: Movie\n---\n\n> Let everything come true.\n",
			true,
		},
		{
			"unknown type falls through to the heuristics",
			"---\ntitle: Something\ntype: banana\nauthor: A. Writer\n---\n\n> A quote.\n",
			false,
		},
		{
			"legacy film export detected by its director",
			"---\ntitle: Stalker\ndirector: Andrei Tarkovsky\n---\n\n> Let everything come true.\n",
			true,
		},
		{
			"legacy film export detected by a character binding",
			"---\ntitle: Stalker\n---\n\n> Let everything come true.\n- character: Stalker\n",
			true,
		},
		{
			"book export detected by author",
			"---\ntitle: Invisible Cities\nauthor: Italo Calvino\n---\n\n> A quote.\n",
			false,
		},
		{
			"book export detected by a loc binding",
			"---\ntitle: Invisible Cities\n---\n\n> A quote.\n- loc: p.42\n",
			false,
		},
		{
			// Colour is shared by both kinds since migration 0021, so it must never
			// tip the decision either way.
			"colour alone decides nothing",
			"---\ntitle: Ambiguous\n---\n\n> A quote.\n- color: pink\n",
			false,
		},
		{
			"colour does not stop a film being recognised",
			"---\ntitle: Stalker\ntype: movie\n---\n\n> A line.\n- color: pink\n",
			true,
		},
		{
			"CRLF line endings",
			"---\r\ntitle: Stalker\r\ntype: movie\r\n---\r\n\r\n> A line.\r\n",
			true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := LooksLikeMovieMarkdown([]byte(tc.md)); got != tc.want {
				t.Fatalf("LooksLikeMovieMarkdown = %v, want %v for:\n%s", got, tc.want, tc.md)
			}
		})
	}
}

// A show's line carries which episode it is from. The exporter writes one number
// per key, but the shapes people type by hand — S2E5, s02e05, 2x05 — carry both on
// a single key, so either key accepts them. nil is "the file didn't say", which is
// a different fact from 0: season 0 is where a series keeps its specials.
func TestMovieMarkdownEpisodeBindings(t *testing.T) {
	num := func(n int) *int { return &n }
	for _, tc := range []struct {
		name    string
		binding string
		season  *int
		episode *int
	}{
		{"plain numbers, one per key", "- season: 2\n- episode: 6\n", num(2), num(6)},
		{"season zero is a real season", "- season: 0\n- episode: 1\n", num(0), num(1)},
		{"season alone", "- season: 4\n", num(4), nil},
		{"combined on the episode key", "- episode: S2E5\n", num(2), num(5)},
		{"combined, zero padded", "- episode: s02e05\n", num(2), num(5)},
		{"combined on the season key", "- season: S3E9\n", num(3), num(9)},
		{"the x form", "- episode: 2x05\n", num(2), num(5)},
		{"the ep alias", "- ep: 7\n- season: 1\n", num(1), num(7)},
		{"nonsense is ignored", "- season: sometime\n- episode: later\n", nil, nil},
		{"nothing at all", "", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			md := "---\ntitle: Reel Seven\ntype: show\n---\n\n> A line.\n" + tc.binding
			all, err := MovieMarkdownAll(strings.NewReader(md))
			if err != nil {
				t.Fatal(err)
			}
			if len(all) != 1 || len(all[0].Dialogues) != 1 {
				t.Fatalf("expected one title with one dialogue, got %+v", all)
			}
			d := all[0].Dialogues[0]
			if !samePtr(d.Season, tc.season) || !samePtr(d.Episode, tc.episode) {
				t.Fatalf("got season=%s episode=%s, want season=%s episode=%s",
					ptrStr(d.Season), ptrStr(d.Episode), ptrStr(tc.season), ptrStr(tc.episode))
			}
		})
	}
}

func samePtr(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func ptrStr(p *int) string {
	if p == nil {
		return "nil"
	}
	return strconv.Itoa(*p)
}
