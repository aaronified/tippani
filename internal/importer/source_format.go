package importer

import (
	"bytes"
	"regexp"
)

// The formats a work's source file can be, and the two jobs one can have.
//
// Format comes from the BYTES, as Detect's does and for the same reason: a
// subtitle saved as `.txt`, or the owner's own `.ass.txt`, is a real file that an
// extension test turns away. Renaming a file therefore changes nothing here.
const (
	SourceFormatSRT  = "srt"
	SourceFormatVTT  = "vtt"
	SourceFormatASS  = "ass"
	SourceFormatLRC  = "lrc"
	SourceFormatEPUB = "epub"
	// SourceFormatMOBI is the Kindle container: MOBI, AZW and AZW3 are one format
	// by their bytes, and a file's extension never decides which it is.
	SourceFormatMOBI = "mobi"
	SourceFormatPDF  = "pdf"
	SourceFormatTXT  = "txt"

	// RoleSubtitle is a timed track: the position of a line is a timestamp.
	// RoleText is prose: the position is a place in the text.
	RoleSubtitle = "subtitle"
	RoleText     = "text"
)

var (
	// 00:01:02,500 --> 00:01:04,000, the comma being SRT's mark. VTT writes a
	// full stop and carries its own WEBVTT header, so a stop here would let a
	// VTT without its header pass for an SRT.
	srtCue = regexp.MustCompile(`(?m)^\d{1,2}:\d{2}:\d{2},\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2},\d{1,3}`)
	// [01:23.45] or [01:23], the start of every lyric line.
	lrcLine = regexp.MustCompile(`(?m)^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]`)
)

// blankSpace is what may precede a PDF's mark.
const blankSpace = "\x00\r\n\t "

// SourceFormat answers what these bytes are as a source file, or "" when they are
// none of the eight. It decides the format and nothing else: which subject may carry
// which format is the caller's, because it knows the subject.
//
// ORDER IS SPECIFICITY. A format with a mark its writer always emits goes first
// (the EPUB's zip mimetype, a Palm database's "BOOKMOBI", a PDF's "%PDF-", WEBVTT, the
// SSA section headers); a timed-line shape
// (SRT, LRC) next; plain text last, since every other format is also text and
// would be claimed by it.
func SourceFormat(data []byte) string {
	if len(data) >= 4 && data[0] == 'P' && data[1] == 'K' &&
		(data[2] == 3 || data[2] == 5 || data[2] == 7) {
		// An EPUB's mimetype entry is the zip's first, by specification, so it sits
		// in the first few hundred bytes; any other zip is not a source.
		if bytes.Contains(data[:min(len(data), 4096)], []byte("application/epub+zip")) {
			return SourceFormatEPUB
		}
		return ""
	}
	if len(data) >= 68 && string(data[60:68]) == "BOOKMOBI" {
		return SourceFormatMOBI
	}
	// A PDF opens with its mark, after at most some blank space: a text that merely
	// mentions "%PDF-" is still text.
	if bytes.HasPrefix(bytes.TrimLeft(data[:min(len(data), 1024)], blankSpace), []byte("%PDF-")) {
		return SourceFormatPDF
	}
	if !LooksLikeText(data) {
		return ""
	}
	head := data
	if len(head) > detectHead {
		head = head[:detectHead]
	}
	text := trimBOM(head)

	switch {
	case bytes.HasPrefix(text, []byte("WEBVTT")):
		return SourceFormatVTT
	case bytes.Contains(text, []byte("[Script Info]")) || bytes.Contains(text, []byte("[Events]")):
		return SourceFormatASS
	case srtCue.Match(text):
		return SourceFormatSRT
	case lrcLine.Match(text):
		return SourceFormatLRC
	}
	return SourceFormatTXT
}

// SourceRole is the job a format does. An LRC is a timed lyric track, but to the
// reader it is a song's text, and the plan lists it there; the parser, not the
// role, is what treats it as timed.
func SourceRole(format string) string {
	switch format {
	case SourceFormatSRT, SourceFormatVTT, SourceFormatASS:
		return RoleSubtitle
	case SourceFormatEPUB, SourceFormatMOBI, SourceFormatPDF, SourceFormatTXT, SourceFormatLRC:
		return RoleText
	}
	return ""
}
