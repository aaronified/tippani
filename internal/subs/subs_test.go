package subs

import (
	"errors"
	"testing"
)

// The parsers are pure functions over bytes, so they are tested as ones: a file in,
// cues out. Every fixture is synthetic and small, and each is the shape of a trap
// the plan found in real files rather than a tidy example.

func texts(cues []Cue) []string {
	out := make([]string, len(cues))
	for i, c := range cues {
		out[i] = c.Text
	}
	return out
}

func TestSRTWithABOMCRLFAndMarkup(t *testing.T) {
	in := "\xef\xbb\xbf1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Hello</i> there,\r\nGeneral.\r\n\r\n" +
		"2\r\n00:01:02,250 --> 00:01:04,000\r\n<font color=\"#ff0\">Kenobi.</font>\r\n"
	cues, err := Parse(SRT, []byte(in))
	if err != nil {
		t.Fatal(err)
	}
	if got := texts(cues); len(got) != 2 || got[0] != "Hello there, General." || got[1] != "Kenobi." {
		t.Fatalf("texts = %q", got)
	}
	if cues[0].Start != 1000 || cues[0].End != 3500 || cues[1].Start != 62250 {
		t.Fatalf("times = %+v", cues)
	}
	if cues[0].Index != 0 || cues[1].Index != 1 {
		t.Fatalf("indexes = %d %d", cues[0].Index, cues[1].Index)
	}
}

func TestVTTShortClocksSettingsAndNotes(t *testing.T) {
	in := "WEBVTT\n\nNOTE this is a comment\nnot a cue\n\nSTYLE\n::cue { color: red }\n\n" +
		"intro\n00:01.500 --> 00:03.000 align:start position:0%\nFirst line\n\n" +
		"01:00:00.000 --> 01:00:02.000\n<v Anna>An hour in</v>\n"
	cues, err := Parse(VTT, []byte(in))
	if err != nil {
		t.Fatal(err)
	}
	if got := texts(cues); len(got) != 2 || got[0] != "First line" || got[1] != "An hour in" {
		t.Fatalf("texts = %q", got)
	}
	if cues[0].Start != 1500 || cues[1].Start != 3600000 {
		t.Fatalf("times = %+v", cues)
	}
}

// A comma in the speech is not a column break, and the column order is the file's.
func TestASSTextKeepsItsCommasAndOverridesAreStripped(t *testing.T) {
	in := "[Script Info]\nTitle: x\n\n[V4+ Styles]\nStyle: a,b,c\n\n[Events]\n" +
		"Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" +
		"Dialogue: 0,0:00:04.07,0:00:06.00,Default,,0,0,0,,{\\an8}Well, well, well\\Nwhat is this?\n" +
		"Comment: 0,0:00:07.00,0:00:08.00,Default,,0,0,0,,not speech\n"
	cues, err := Parse(ASS, []byte(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(cues) != 1 || cues[0].Text != "Well, well, well what is this?" {
		t.Fatalf("cues = %+v", cues)
	}
	// Two digits are centiseconds: 4.07 s, not 4.007.
	if cues[0].Start != 4070 {
		t.Fatalf("start = %d", cues[0].Start)
	}
}

func TestASSColumnsInADifferentOrder(t *testing.T) {
	in := "[Events]\nFormat: Start, End, Text, Layer\nDialogue: 0:00:01.00,0:00:02.00,Hi\n"
	// A table whose Text is not last cannot be split by comma safely, so this must
	// not invent a line from the wrong column.
	cues, err := Parse(ASS, []byte(in))
	if err == nil && len(cues) > 0 && cues[0].Text == "" {
		t.Fatalf("an empty cue leaked: %+v", cues)
	}
}

func TestSRTAndASSAgreeOnTheSameCueToWithinFiveMilliseconds(t *testing.T) {
	srt, _ := Parse(SRT, []byte("1\n00:00:04,074 --> 00:00:06,000\nHi\n"))
	ass, _ := Parse(ASS, []byte("[Events]\nFormat: Start, End, Text\nDialogue: 0:00:04.07,0:00:06.00,Hi\n"))
	if d := srt[0].Start - ass[0].Start; d < 0 || d > 5 {
		t.Fatalf("srt %d vs ass %d", srt[0].Start, ass[0].Start)
	}
}

func TestLRCMultipleTagsAndEachLineEndsWhereTheNextBegins(t *testing.T) {
	in := "[ti:Song]\n[ar:Somebody]\n[00:12.00]first\n[00:20.50][01:30.00]chorus\n[00:30.00]second\n"
	cues, err := Parse(LRC, []byte(in))
	if err != nil {
		t.Fatal(err)
	}
	if got := texts(cues); len(got) != 4 || got[0] != "first" || got[1] != "chorus" || got[2] != "second" || got[3] != "chorus" {
		t.Fatalf("texts = %q", got)
	}
	if cues[0].End != cues[1].Start {
		t.Fatalf("a line should end where the next begins: %+v", cues[:2])
	}
}

func TestACueWithNoWordsIsDropped(t *testing.T) {
	cues, err := Parse(SRT, []byte("1\n00:00:01,000 --> 00:00:02,000\n<i> </i>\n\n2\n00:00:03,000 --> 00:00:04,000\nreal\n"))
	if err != nil || len(cues) != 1 || cues[0].Text != "real" || cues[0].Index != 0 {
		t.Fatalf("%+v %v", cues, err)
	}
}

func TestAnEmptyTrackSaysSoAndAnUnknownFormatIsRefused(t *testing.T) {
	if _, err := Parse(SRT, []byte("nothing timed here\n")); !errors.Is(err, ErrNoCues) {
		t.Fatalf("err = %v", err)
	}
	if _, err := Parse("mp3", []byte("x")); err == nil {
		t.Fatal("an unknown format should be refused")
	}
}
