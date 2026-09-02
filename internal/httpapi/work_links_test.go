package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// A work's links out — 0062.
//
// A person has had a `links` column since the person panel learned to fetch
// reference pages and a character gained one in 0057. The thing a reader is most
// likely to want to open somewhere else — the work — had none, so a Goodreads
// page lived in the note on one of its quotes.

type linked struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Links string `json:"links"`
}

const twoLinks = "https://www.imdb.com/title/tt0084787/ https://example.org/a-review"

func TestABookKeepsItsLinks(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[linked](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Thing", "links": twoLinks,
	}, http.StatusCreated))
	if made.Links != twoLinks {
		t.Fatalf("create: %q", made.Links)
	}
	got := decode[linked](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Links != twoLinks {
		t.Fatalf("fetch: %q", got.Links)
	}
	// Full-state: a body that names no links clears them, like every other column
	// on this PUT.
	cleared := decode[linked](t, c.mustDo("PUT", "/books/"+itoa(made.ID),
		map[string]any{"title": "The Thing"}, http.StatusOK))
	if cleared.Links != "" {
		t.Fatalf("a full-state PUT left %q", cleared.Links)
	}
	c.mustDo("POST", "/books", map[string]any{
		"title": "Too Many", "links": strings.Repeat("https://example.org/x ", 400),
	}, http.StatusBadRequest)
}

func TestAFilmKeepsItsLinks(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[linked](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Stalker", "links": twoLinks,
	}, http.StatusCreated))
	got := decode[linked](t, c.mustDo("GET", "/movies/"+itoa(made.ID), nil, http.StatusOK))
	if got.Links != twoLinks {
		t.Fatalf("fetch: %q", got.Links)
	}
	cleared := decode[linked](t, c.mustDo("PUT", "/movies/"+itoa(made.ID),
		map[string]any{"title": "Stalker", "media_type": "movie"}, http.StatusOK))
	if cleared.Links != "" {
		t.Fatalf("a full-state PUT left %q", cleared.Links)
	}
}

func TestLinksRoundTripThroughTheExportAndTheQueue(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[linked](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov", "links": twoLinks,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": made.ID, "quote": "Manuscripts don't burn",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(made.ID)+"/export?format=md", nil, http.StatusOK).Body.String()
	// ONE LINE. The column is whitespace-separated already and a frontmatter value
	// is one line, so the export re-joins rather than inventing a list syntax.
	if !strings.Contains(md, "links: https://www.imdb.com/title/tt0084787/ https://example.org/a-review") {
		t.Fatalf("the export did not carry the links:\n%s", md)
	}

	c2 := signupAdmin(t, newTestServer(t).Handler())
	res := stage(t, c2, "/import/markdown", "mm.md", []byte(md))
	c2.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)
	list := decode[struct {
		Books []linked `json:"books"`
	}](t, c2.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("the import made %d books", len(list.Books))
	}
	back := decode[linked](t, c2.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if back.Links != twoLinks {
		t.Fatalf("the round trip lost the links: %q", back.Links)
	}
}

// A GAME'S PUBLISHER WAS BEING LOST IN THE QUEUE, and had been since staging and
// 0042 met: the Markdown parser read it, the movies column existed, and the
// staged_works row between them had no slot for it — so importing a catalogue
// export dropped it in silence, with a successful import and matching counts.
// 0062's links would have landed in the identical hole.
func TestACatalogueImportKeepsThePublisherAndTheLinks(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	md := "---\ntitle: Disco Elysium\ntype: game\nyear: 2019\ndirector: ZA/UM\n" +
		"publisher: ZA/UM Studio\nlinks: https://www.igdb.com/games/disco-elysium\n---\n\n" +
		"> The world is a mess.\n- character: Kim Kitsuragi\n"
	res := stage(t, c, "/import/markdown", "game.md", []byte(md))
	c.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)

	list := decode[struct {
		Movies []struct {
			ID        int64  `json:"id"`
			Title     string `json:"title"`
			Publisher string `json:"publisher"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 {
		t.Fatalf("the import made %d titles", len(list.Movies))
	}
	got := decode[struct {
		Publisher string `json:"publisher"`
		Links     string `json:"links"`
	}](t, c.mustDo("GET", "/movies/"+itoa(list.Movies[0].ID), nil, http.StatusOK))
	if got.Publisher != "ZA/UM Studio" {
		t.Fatalf("the queue lost the publisher: %q", got.Publisher)
	}
	if got.Links != "https://www.igdb.com/games/disco-elysium" {
		t.Fatalf("the queue lost the links: %q", got.Links)
	}
}
