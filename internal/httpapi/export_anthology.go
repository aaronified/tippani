package httpapi

// Markdown export for an anthology (0043) — the fourth `type:`, and the first one
// that writes the reader's own PROSE rather than only their records.
//
// THE ANTHOLOGY SUPPLIES ORDER AND PROSE AND NOTHING ELSE, which is the point of
// its shape and the reason this file is short: each entry's passage and
// attribution go through the same per-quote rendering the other three exports use
// (writeQuoteBlock / writeBinding), so a quote reads identically here and in a
// quotes file. What this adds is the sequence and the writing between the entries.
//
// The layout, and every line of it is load-bearing for the round trip:
//
//	---
//	type: anthology
//	title: Cities and their ghosts
//	---
//
//	The introduction.
//
//	## Invisible Cities — Italo Calvino
//
//	The commentary that introduces this entry.
//
//	> Cities, like dreams, are made of desires and fears.
//
//	- speaker: Italo Calvino
//	- occasion: Invisible Cities
//
// THE HEADING IS AN ENTRY DELIMITER THAT HAPPENS TO READ AS AN ATTRIBUTION.
// Without it the introduction and the first entry's commentary would be the same
// run of prose with nothing between them, and no parser could tell which was
// which. It is written from the entry's own source and credit, which are also in
// the bindings underneath — deliberately, so nothing has to parse a heading back
// into two facts. A book export makes the same choice in reverse (the chapter is
// the heading and is NOT repeated as a binding) because there the heading GROUPS
// several quotes; here it delimits exactly one, and duplication buys robustness.
//
// A BOOK HIGHLIGHT EXPORTS AS AN ATTRIBUTED PASSAGE, not as a record with an
// ISBN — its work becomes `occasion` and its author becomes `speaker`, which are
// the bindings the standalone-quote format already has for "where this came from"
// and "who is answerable for it". That is what makes the file readable as a
// document and what makes its re-import land as standalone quotes; the loss is
// stated in the importer's header rather than hidden here.

import (
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// handleExportAnthology renders one anthology as a Markdown file.
func (s *Server) handleExportAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	uid := userID(r)
	olog.Tracef("[export] anthology uid=%d id=%d", uid, id)
	var title, intro string
	var fields anthologyFields
	err := s.Store.DB.QueryRow(`SELECT title, intro, `+anthologyFieldCols+` FROM anthologies WHERE id = ? AND user_id = ?`,
		id, uid).Scan(append([]any{&title, &intro}, fields.scanTargets()...)...)
	if err != nil {
		// Not found and a read error are one answer here on purpose: an export is a
		// read, and telling a caller which of the two it was would confirm that
		// somebody else's anthology exists.
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	entries, err := s.entriesFor(uid, id)
	if err != nil {
		internalError(w, r, "render anthology export", err)
		return
	}
	serveMarkdown(w, sanitizeFilename(title)+".md", renderAnthologyExport(title, intro, fields, entries))
}

// THE FIELD SWITCHES ARE A FILTER, NOT A SECOND RENDERER (0045). writeQuoteBlock
// and writeBinding are shared with the other three export formats, and the way to
// suppress a binding for an anthology is to not call writeBinding for it — inside
// the same callback the shared renderer already invokes. Copying the function so
// this format could have its own version is how four export formats would start to
// disagree about what a quote looks like, one small fix at a time.
//
// WHAT YOU SEE IS WHAT YOU EXPORT. The same six flags drive the reading view, so a
// hidden credit is absent from both. An export that quietly differs from the screen
// is the kind of surprise you find in a file you have already sent somebody.
//
// The heading is the one place a hidden field can still leak, and it is handled:
// anthologyHeading is built from the source and the credit, so it takes the flags
// too. With both hidden it falls back to the entry's position, which is what the
// delimiter has always been for — a section with no heading is unparseable.
func renderAnthologyExport(title, intro string, f anthologyFields, entries []anthologyEntryRow) string {
	var sb strings.Builder
	// `title` is in the frontmatter because the importer needs it before it reads a
	// single entry: it is what an approved import resolves to a row.
	writeFrontmatter(&sb, kv{"type", "anthology"}, kv{"title", title})
	if strings.TrimSpace(intro) != "" {
		sb.WriteString("\n")
		sb.WriteString(strings.TrimRight(intro, "\n"))
		sb.WriteString("\n")
	}
	for i, e := range entries {
		sb.WriteString("\n## ")
		sb.WriteString(anthologyHeading(e, i, f))
		sb.WriteString("\n")
		// The commentary is the reader's own writing about this passage, and hiding it
		// is the switch most likely to be used in anger: an anthology made to send
		// somebody is not always one you want your marginalia in.
		if !f.HideCommentary && strings.TrimSpace(e.Note) != "" {
			sb.WriteString("\n")
			sb.WriteString(strings.TrimRight(e.Note, "\n"))
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
		writeQuoteBlock(&sb, e.Quote, e.QuoteNote, func(note string) {
			// Source and credit are written as the two bindings the quotes format
			// already has for them, whichever kind the entry actually is. A film
			// line's `speaker` is its character (and its actor after a dot), which is
			// the attribution a reader means by a film quote.
			if !f.HideCredit {
				writeBinding(&sb, "speaker", e.Credit)
			}
			if !f.HideSource {
				writeBinding(&sb, "occasion", e.Source)
			}
			// Off by default, both of them, so an existing anthology exports byte for
			// byte as it did before this feature — which is what keeps a re-export
			// diffing clean against a file written last year.
			if f.ShowLocator {
				writeBinding(&sb, "locator", e.Locator)
			}
			if f.ShowDate {
				writeBinding(&sb, "date", e.Date)
			}
			writeBinding(&sb, "note", note)
			// The default colour is left out, so a file mentions colour only when one
			// was chosen — the same rule all three other exports follow, and what
			// keeps a re-export diffing clean against an older file.
			if !f.HideColour && e.Color != "yellow" {
				writeBinding(&sb, "color", e.Color)
			}
			writeFavorite(&sb, e.Favorite)
		})
	}
	return sb.String()
}

// anthologyHeading is what an entry is called at the top of its section.
//
// The position is the fallback rather than the format, because "3." above a
// passage tells a reader nothing they cannot count. It is what a proverb with no
// occasion and no speaker gets, and it exists so the delimiter is never an empty
// heading — which would make the file unparseable in the one case where the
// reader has written the least.
//
// It takes the field switches because it is built from the source and the credit,
// which means it is the one place a hidden field would otherwise still be printed
// — in the largest type on the page. With both hidden every heading is a position,
// and the fallback that existed for the emptiest entry becomes the format for the
// whole file, which is exactly right: a reader who has turned off the attribution
// has asked for a document of passages.
func anthologyHeading(e anthologyEntryRow, i int, f anthologyFields) string {
	parts := []string{}
	if s := strings.TrimSpace(e.Source); s != "" && !f.HideSource {
		parts = append(parts, s)
	}
	if c := strings.TrimSpace(e.Credit); c != "" && !f.HideCredit {
		parts = append(parts, c)
	}
	if len(parts) == 0 {
		return strconv.Itoa(i + 1)
	}
	return strings.Join(parts, " — ")
}
