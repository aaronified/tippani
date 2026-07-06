package importer

import (
	"reflect"
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
		"> One way out.\n- character: Kino\n- rating: 5\n"
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
	if len(res[1].Dialogues) != 1 || res[1].Dialogues[0].Rating != 5 {
		t.Fatalf("movie 1 dialogues = %+v", res[1].Dialogues)
	}
}
