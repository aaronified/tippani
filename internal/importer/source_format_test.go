package importer

import "testing"

// SourceFormat is a pure function over bytes, so it is tested as one: the file
// in, the format out. What it must never do is read the name, and it is not given
// one.
func TestSourceFormatReadsTheBytes(t *testing.T) {
	epub := append([]byte("PK\x03\x04\x14\x00\x00\x00\x00\x00mimetypeapplication/epub+zip"), make([]byte, 32)...)
	cases := []struct {
		name string
		in   []byte
		want string
		role string
	}{
		{"srt", []byte("1\n00:00:01,000 --> 00:00:03,000\nHi\n"), "srt", "subtitle"},
		{"srt with a BOM and CRLF", []byte("\xef\xbb\xbf1\r\n00:00:01,000 --> 00:00:03,000\r\nHi\r\n"), "srt", "subtitle"},
		{"vtt", []byte("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHi\n"), "vtt", "subtitle"},
		{"a vtt-looking cue without its header is not an srt", []byte("00:00:01.000 --> 00:00:03.000\nHi\n"), "txt", "text"},
		{"ass", []byte("[Script Info]\nTitle: x\n[Events]\nDialogue: 0,0:00:01.00,0:00:03.00,D,,0,0,0,,Hi\n"), "ass", "subtitle"},
		{"lrc", []byte("[ti:Song]\n[00:01.00]first\n[00:05.50]second\n"), "lrc", "text"},
		{"prose", []byte("It was a bright cold day in April.\n"), "txt", "text"},
		{"epub", epub, "epub", "text"},
		{"some other zip", []byte("PK\x03\x04\x14\x00\x00\x00\x00\x00hello"), "", ""},
		{"a png", []byte("\x89PNG\r\n\x1a\n\x00\x00"), "", ""},
		{"nothing", nil, "", ""},
	}
	for _, c := range cases {
		got := SourceFormat(c.in)
		if got != c.want {
			t.Errorf("%s: format %q, want %q", c.name, got, c.want)
		}
		if role := SourceRole(got); role != c.role {
			t.Errorf("%s: role %q, want %q", c.name, role, c.role)
		}
	}
}

func TestAKindleBookAndAPdfAreRecognisedByTheirBytesNotTheirNames(t *testing.T) {
	mobi := make([]byte, 100)
	copy(mobi[60:], "BOOKMOBI")
	for name, tc := range map[string]struct {
		data []byte
		want string
	}{
		"a Palm database holding a book":         {mobi, "mobi"},
		"a PDF":                                  {[]byte("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"), "pdf"},
		"a PDF with junk before the header":      {append([]byte("\r\n\r\n"), []byte("%PDF-1.4\n")...), "pdf"},
		"a text that only mentions the PDF mark": {[]byte("A line of prose, then, much later, the word %PDF- in the middle of it."), "txt"},
		"a Palm database that is not a book":     {append(make([]byte, 60), append([]byte("TEXtREAd"), make([]byte, 40)...)...), ""},
	} {
		if got := SourceFormat(tc.data); got != tc.want {
			t.Errorf("%s: %q, want %q", name, got, tc.want)
		}
	}
	if SourceRole("mobi") != RoleText || SourceRole("pdf") != RoleText {
		t.Error("an ebook is a text source, whatever its container")
	}
}
