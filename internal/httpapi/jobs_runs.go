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

// workName is how a log line names a work: its title in guillemets, or, for one
// with no title to show (not found, or not the owner's), what it is and its id.
func workName(kind string, id int64, title string) string {
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
