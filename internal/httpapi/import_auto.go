package httpapi

import (
	"bytes"
	"net/http"

	"tippani/internal/importer"
	"tippani/internal/olog"
)

// ONE TARGET, AND THE BYTES SAY WHAT THE FILE IS.
//
// Import was seven cards: the reader picked a format and the card they picked
// chose the endpoint. That question is now answered by the file itself. This is
// the dispatch half — the table that turns a source slug into a parser, the
// sniffer that produces a slug, and the fallback for when it cannot.
//
// THE TABLE LIVES HERE AND NOT IN THE IMPORTER, because `importer`'s contract is
// "Pure parsing only — no DB, no HTTP" and a route is neither. It lives here and
// not in the client for the reason theme.js refuses a second copy of its texture
// names: a mapping written twice drifts, and the half that drifts is the half
// nobody is looking at.

// importStager parses `data` and stages it, writing the reply. Every
// POST /import/<source> route is readUpload plus one of these, and so is the
// sniffer — which is why they take BYTES rather than a request whose body can
// only be read once.
type importStager func(*Server, http.ResponseWriter, *http.Request, []byte, string)

// importSources is the one place a source slug becomes a parser. Three callers
// arrive here: the seven per-source routes (which stay — they are the API, and
// they are what every existing test posts to), the sniffer, and the reader's
// "Read this as…" override when it disagrees with the sniffer.
var importSources = map[string]importStager{
	importer.SourceMarkdown:        (*Server).stageMarkdownBytes,
	importer.SourceReadestJSON:     (*Server).stageReadestJSONBytes,
	importer.SourceBookcision:      (*Server).stageBookcisionBytes,
	importer.SourceHardcoverHTML:   (*Server).stageHardcoverBytes,
	importer.SourceGoodreadsHTML:   (*Server).stageGoodreadsBytes,
	importer.SourceKindleNotebook:  (*Server).stageKindleNotebookBytes,
	importer.SourceIMDb:            (*Server).stageIMDbBytes,
	importer.SourceKindleClippings: (*Server).stageKindleClippingsBytes,
}

// importProbeOrder is the fallback: when no signature matched, every parser is
// TRIED and the first that succeeds owns the file.
//
// This is the path the parsers were already built for. Each one errors
// distinctively on a foreign file and each of those errors already has a test —
// TestIMDbQuotesNotAPage, TestAmazonNotebookNotAPage,
// TestKindleClippingsRejectsNonClippings, TestGoodreadsErrors,
// TestHardcoverErrors, TestBookcisionErrors — so "does this parse" is a question
// they can all answer, on bytes already in memory.
//
// ORDER IS SPECIFICITY, MOST FIRST. Markdown and clippings are last because they
// are the two that accept the loosest input: markdown wants only a "---" or a
// "# " to start, and a clippings file only a run of '=' somewhere.
var importProbeOrder = []string{
	importer.SourceReadestJSON,
	importer.SourceBookcision,
	importer.SourceKindleNotebook,
	importer.SourceGoodreadsHTML,
	importer.SourceHardcoverHTML,
	importer.SourceIMDb,
	importer.SourceMarkdown,
	importer.SourceKindleClippings,
}

// importProbes answers "do these bytes parse as this source" and throws the
// result away.
//
// THE WINNING SOURCE IS THEN PARSED AGAIN by its real stager. That second parse
// costs microseconds on bytes already in memory, and it buys the staging path
// staying exactly one function per source instead of a parse/stage split threaded
// through four shapes of result (books, catalogue titles, quotes, an anthology).
// It also only ever happens on the fallback, which is the path a file with no
// self-describing mark takes.
var importProbes = map[string]func([]byte) bool{
	importer.SourceReadestJSON: func(d []byte) bool {
		res, _, err := importer.ReadestJSON(bytes.NewReader(d))
		return err == nil && len(res.Annotations) > 0
	},
	importer.SourceBookcision: func(d []byte) bool {
		res, err := importer.Bookcision(bytes.NewReader(d))
		return err == nil && len(res.Annotations) > 0
	},
	importer.SourceKindleNotebook: func(d []byte) bool {
		res, err := importer.AmazonNotebook(bytes.NewReader(d))
		return err == nil && len(res.Annotations) > 0
	},
	importer.SourceGoodreadsHTML: func(d []byte) bool {
		res, err := importer.Goodreads(bytes.NewReader(d))
		return err == nil && len(res.Annotations) > 0
	},
	importer.SourceHardcoverHTML: func(d []byte) bool {
		res, err := importer.HardcoverHTML(bytes.NewReader(d))
		return err == nil && len(res.Annotations) > 0
	},
	importer.SourceIMDb: func(d []byte) bool {
		res, err := importer.IMDbQuotes(bytes.NewReader(d))
		return err == nil && len(res.Dialogues) > 0
	},
	importer.SourceMarkdown: func(d []byte) bool {
		// Markdown() is the gate: it is what refuses a file that is neither
		// frontmatter nor a "# " heading. Which markdown it is stays MarkdownKind's
		// decision inside the stager.
		if importer.MarkdownKind(d) == importer.KindQuotes || importer.MarkdownKind(d) == importer.KindAnthology {
			return true
		}
		_, err := importer.MarkdownAll(bytes.NewReader(d))
		return err == nil
	},
	importer.SourceKindleClippings: func(d []byte) bool {
		res, _, err := importer.KindleClippings(bytes.NewReader(d))
		return err == nil && len(res) > 0
	},
}

// handleImportAuto is the one endpoint the drop target posts to.
//
// `as` is the reader's override, and it is a SECOND door rather than a front one:
// the sniffer answers first, and this field exists because detection can be
// wrong in a way the staging queue cannot repair — `retarget` moves staged rows
// between works, not a file between parsers. A Goodreads page read as Hardcover
// parses empty, and no bulk edit rescues that.
func (s *Server) handleImportAuto(w http.ResponseWriter, r *http.Request) {
	data, filename, ok := readUpload(w, r)
	if !ok {
		return
	}
	// The reader has asserted a format. Their answer outranks the sniffer's, which
	// is the whole point of offering it — but an unknown slug is a client bug, not
	// a file problem, and saying so beats silently sniffing instead.
	if as := r.FormValue("as"); as != "" {
		stage, known := importSources[as]
		if !known {
			writeErr(w, http.StatusBadRequest, "unknown import source: "+as)
			return
		}
		stage(s, w, r, data, filename)
		return
	}
	if source := importer.Detect(data); source != "" {
		importSources[source](s, w, r, data, filename)
		return
	}
	// Nothing signed itself. Name the file if it is something else entirely —
	// answering "unrecognised" to a backup archive, or to the app's own export
	// (which is a zip), is a worse failure than the wall of cards was.
	if miss := importer.NearMiss(data); miss != "" {
		writeErrDetail(w, http.StatusBadRequest, importNearMissMessage(miss),
			map[string]any{"near_miss": miss})
		return
	}
	for _, source := range importProbeOrder {
		if importProbes[source](data) {
			importSources[source](s, w, r, data, filename)
			return
		}
	}
	olog.Warnf(olog.CodeImportUnknown, "[import] no parser claimed %q (%d bytes)", filename, len(data))
	writeErrDetail(w, http.StatusBadRequest,
		"could not tell what this file is — pick a format with “Read this as…”",
		map[string]any{"near_miss": ""})
}

// importNearMissMessage says what the file actually is. The client draws its own
// words from `near_miss`; this is the fallback for anything posting directly.
func importNearMissMessage(miss string) string {
	switch miss {
	case "backup":
		return "that is a Tippani backup — restore it from Settings → Restore"
	case "zip":
		return "export archives are not imported whole — unzip it and drop the files inside"
	case "epub":
		return "Tippani reads your highlights, not your books — export the annotations from your reader"
	case "image":
		return "covers are set from a book or film's own page"
	case "font":
		return "upload a typeface from Settings → Type"
	}
	return "that file is not text, so there is nothing here to read"
}
