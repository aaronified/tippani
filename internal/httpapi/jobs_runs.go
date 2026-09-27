package httpapi

import (
	"fmt"
	"strings"
)

// WHAT THE QUEUED KINDS' RUNS SHARE.
//
// Each run is kept beside the handler whose work it does (runFill in
// metadata_fill.go, and so on), because it calls the same functions the handler
// does and nothing else: one copy of every piece of logic. What is here is only
// how a run names its items in its log — a line an operator reads down a column,
// in English, one per item.

// workTitle is a work of uid's title, as a job's subject names it; "" when uid
// has no such work (another reader's id is not named).
func (s *Server) workTitle(uid int64, kind string, id int64) string {
	table := "books"
	if kind == "movie" {
		table = "movies"
	}
	var title string
	_ = s.Store.DB.QueryRow(`SELECT title FROM `+table+` WHERE id = ? AND user_id = ?`, id, uid).Scan(&title)
	return title
}

// soleSubject is a job's subject when it is about one work or one person: what a
// row in Past jobs names it by. A job of several is about as many things, which
// the Jobs tab counts itself, so its subject is "".
func (s *Server) soleSubject(uid int64, books, movies []int64, people []reverifyAsk, records []int64) string {
	if len(books)+len(movies)+len(people)+len(records) != 1 {
		return ""
	}
	switch {
	case len(books) == 1:
		return s.workTitle(uid, "book", books[0])
	case len(movies) == 1:
		return s.workTitle(uid, "movie", movies[0])
	case len(people) == 1:
		return people[0].Name
	}
	p, err := s.personByID(uid, records[0])
	if err != nil {
		return ""
	}
	return p.Name
}

// queuedWork is one work a job walks.
type queuedWork struct {
	kind string // book | movie
	id   int64
}

// queuedWorks is a job's books and then its films, each in the order its params
// hold them (sorted, since a validate stored them so).
func queuedWorks(books, movies []int64) []queuedWork {
	out := make([]queuedWork, 0, len(books)+len(movies))
	for _, id := range books {
		out = append(out, queuedWork{"book", id})
	}
	for _, id := range movies {
		out = append(out, queuedWork{"movie", id})
	}
	return out
}

// itemName is how a log line names what it is about: a work's title or a
// person's name in guillemets, or, for one with nothing to show (not found, or
// not the owner's), what it is and its id.
func itemName(kind string, id int64, title string) string {
	if t := strings.TrimSpace(title); t != "" {
		return "«" + t + "»"
	}
	noun := kind
	if kind == "movie" {
		noun = "film"
	}
	return fmt.Sprintf("%s #%d", noun, id)
}

// fieldWord is a field as a log line says it: the column's name, where it is not
// the word a person would use.
var fieldWord = map[string]string{
	"published_year": "year", "release_year": "year", "series_index": "series number",
	"isbn": "ISBN", "tmdb_id": "TMDB id", "tvdb_id": "TheTVDB id",
}

// fieldWords is fields as a log line lists them: "year, pages".
func fieldWords(fields []string) string {
	words := make([]string, 0, len(fields))
	for _, f := range fields {
		w, ok := fieldWord[f]
		if !ok {
			w = strings.ReplaceAll(f, "_", " ")
		}
		words = append(words, w)
	}
	return strings.Join(words, ", ")
}
