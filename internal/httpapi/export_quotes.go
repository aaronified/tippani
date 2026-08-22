package httpapi

// Markdown export for standalone quotes (ROADMAP §24) — the third `type:`.
//
// The shape deliberately mirrors renderBookExport rather than inventing one,
// because the two are the same problem: a set of quotes, each carrying a
// locator, grouped by the coarsest part of that locator.
//
//	chapter -> occasion         the "## " heading
//	page    -> speaker/date/... the bindings under each quote
//
// A quote with no occasion is a proverb, and it lands where a chapterless
// annotation lands: first, before any "## " line. That ordering is not
// cosmetic — the parser attributes a quote to the heading above it, so a
// proverb written after a heading would come back belonging to a speech.
//
// There is one frontmatter block for the whole file rather than one per work,
// because there is no work. It carries `type: quotes` and nothing else, and it
// is what routes the re-import: a standalone-quote file has no author, no isbn
// and no locator, so without it MarkdownKind's fallthrough would read every one
// of them as a book with no title.

import (
	"net/http"
	"strings"

	"tippani/internal/olog"
)

// handleExportQuotes renders a chosen set of standalone quotes — the
// in-view/filtered set the UI passes, or all when ids is empty — as ONE
// markdown file. Unowned ids are skipped rather than refused, matching
// exportSet: an export is a read, and a stale id in a filtered selection is not
// worth failing the whole download over.
func (s *Server) handleExportQuotes(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[export] handleExportQuotes uid=%d", uid)
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	md, err := s.renderQuotesExport(uid, body.IDs)
	if err != nil {
		internalError(w, r, "render quotes export", err)
		return
	}
	serveMarkdown(w, "tippani-quotes.md", md)
}

// utteranceExportRow is the flat row the renderer walks — deliberately not
// utteranceRow, which carries sticker coordinates and an id the file has no
// use for.
type utteranceExportRow struct {
	id                                             int64
	quote, note, color                             string
	speaker, occasion, occasionDate, place, medium string
	category, language, translation                string
	// 0047 — what a proverb, a letter and an essay carry. Written unconditionally
	// for every quote, whatever board it is on, because the kind lives on the BOARD
	// and the board does not round-trip yet: a file that only wrote a recipient for
	// a quote currently sitting on a letter board would lose it the moment the
	// reader moved that quote, which is the failure this whole pass is about.
	region, recipient, workTitle, locator string
	occasionCirca                         bool
	favorite                              bool
	notedAt                               string
}

func (s *Server) renderQuotesExport(uid int64, ids []int64) (string, error) {
	q := `SELECT id, quote, COALESCE(note,''), color, COALESCE(speaker,''), COALESCE(occasion,''),
	             COALESCE(occasion_date,''), COALESCE(place,''), COALESCE(medium,''),
	             category, language, translation,
	             region, recipient, work_title, locator, occasion_circa,
	             favorite, COALESCE(noted_at,'')
	      FROM utterances WHERE user_id = ?`
	args := []any{uid}
	if len(ids) > 0 {
		q += ` AND id IN (?` + strings.Repeat(",?", len(ids)-1) + `)`
		for _, id := range ids {
			args = append(args, id)
		}
	}
	// Insertion order, matching the book export. Grouping below re-orders by
	// occasion but keeps each occasion's quotes in the order they were saved.
	q += ` ORDER BY id`

	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var us []utteranceExportRow
	for rows.Next() {
		var u utteranceExportRow
		// No COALESCE on the five: NOT NULL DEFAULT (0047), so the zero value is
		// what a row predating them holds. Same rule as utteranceCols.
		if err := rows.Scan(&u.id, &u.quote, &u.note, &u.color, &u.speaker, &u.occasion,
			&u.occasionDate, &u.place, &u.medium,
			&u.category, &u.language, &u.translation,
			&u.region, &u.recipient, &u.workTitle, &u.locator, &u.occasionCirca,
			&u.favorite, &u.notedAt); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] quote row scan failed: %v", err)
			continue
		}
		us = append(us, u)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] quote row iteration failed: %v", err)
		return "", err
	}
	tags, err := s.exportUtteranceTags(uid)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	// `type` is the only frontmatter there is, and it is always written — see
	// the file header.
	writeFrontmatter(&sb, kv{"type", "quotes"})

	order := []string{""}
	grouped := map[string][]utteranceExportRow{}
	for _, u := range us {
		if _, seen := grouped[u.occasion]; !seen && u.occasion != "" {
			order = append(order, u.occasion)
		}
		grouped[u.occasion] = append(grouped[u.occasion], u)
	}
	for _, occ := range order {
		if occ != "" {
			sb.WriteString("\n## ")
			sb.WriteString(occ)
			sb.WriteString("\n")
		}
		for _, u := range grouped[occ] {
			sb.WriteString("\n")
			writeQuoteBlock(&sb, u.quote, u.note, func(note string) {
				// The occasion is the heading, so it is NOT repeated here — the
				// same rule the book export applies to chapter. Everything else
				// that locates the quote is a binding.
				writeBinding(&sb, "speaker", u.speaker)
				// The second party, right after the first: a letter's `to` is the
				// field that makes it a letter, and reading it two lines under the
				// person who wrote it is how a letter is addressed on paper.
				writeBinding(&sb, "recipient", u.recipient)
				writeBinding(&sb, "occasion_date", u.occasionDate)
				// The date's PRECISION, immediately under the date it qualifies, and
				// written only when it is on — the same rule `favorite` follows, and
				// the same reason: a file should say a thing only when the thing is
				// true, so a shelf of exact dates exports as it did before 0047.
				writeCirca(&sb, u.occasionCirca)
				writeBinding(&sb, "place", u.place)
				// Region pairs with place the way it pairs with language on the form: a
				// Bengali proverb from Sylhet is not one from Kolkata.
				writeBinding(&sb, "region", u.region)
				writeBinding(&sb, "medium", u.medium)
				// The essay's two, coarse to fine, exactly as the book export writes a
				// chapter before a page. `work_title` and `locator` are named
				// generically in the SCHEMA so poem/lyrics/article are one day a label
				// rather than a migration — but the FILE spells the locator `page`,
				// which is what the reader is shown and what a hand-written file would
				// reach for. See applyQuoteBinding for why it cannot be `locator`.
				writeBinding(&sb, "work_title", u.workTitle)
				writeBinding(&sb, "page", u.locator)
				// 0035. `other` is left out for the same reason yellow is: a file
				// should mention the category only when one was chosen, so a shelf
				// of ordinary quotes exports exactly as it did before the boards
				// existed and diffs clean against an older file.
				if u.category != "other" {
					writeBinding(&sb, "category", u.category)
				}
				writeBinding(&sb, "language", u.language)
				writeBinding(&sb, "translation", u.translation)
				writeBinding(&sb, "note", note)
				// Same rule as the other two exports: the default colour is left
				// out, so a file only mentions colour when one was chosen.
				if u.color != "yellow" {
					writeBinding(&sb, "color", u.color)
				}
				writeBinding(&sb, "tags", strings.Join(tags[u.id], ", "))
				// `date` is when YOU saved it, matching the book export's key.
				// When it was SAID is occasion_date above — two different facts
				// that a single `date` key would silently merge.
				writeBinding(&sb, "date", dateOnly(u.notedAt))
				writeFavorite(&sb, u.favorite)
			})
		}
	}
	return sb.String(), nil
}

// exportUtteranceTags maps quote id -> sorted tag names for one account in a
// single query. It cannot reuse exportTags, which is keyed on a parent work's
// id — the thing this kind does not have.
func (s *Server) exportUtteranceTags(uid int64) (map[int64][]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT ut.utterance_id, t.name FROM utterance_tags ut
		JOIN tags t ON t.id = ut.tag_id
		JOIN utterances u ON u.id = ut.utterance_id
		WHERE u.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]string{}
	for rows.Next() {
		var id int64
		var n string
		if err := rows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeExportRowScan, "[export] quote tag row scan failed: %v", err)
			continue
		}
		out[id] = append(out[id], n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeExportRowScan, "[export] quote tag row iteration failed: %v", err)
		return out, err
	}
	return out, nil
}
