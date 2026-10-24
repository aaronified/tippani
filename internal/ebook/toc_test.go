package ebook

import "testing"

// THE GOLDEN TEST FOR THE EXTRACTION RULE. A location this app proposes is a percent of
// the text Read yields, so the rule that makes the text (markup stripped, whitespace
// collapsed, script/style/head/nav dropped) and the rule that counts it (runes, paragraphs
// end to end, no separator, floor) are frozen here with their numbers. If this fails
// because the rule was changed on purpose, every location ever proposed is renumbered:
// say so in the changelog before editing the numbers.

const goldenOPF3 = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
 <manifest>
  <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
  <item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>
  <item id="b" href="b.xhtml" media-type="application/xhtml+xml"/>
  <item id="c" href="c.xhtml" media-type="application/xhtml+xml"/>
 </manifest>
 <spine><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine>
</package>`

const goldenNav = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc"><ol>
 <li><a href="a.xhtml">The   Beginning</a></li>
 <li><a href="c.xhtml#s1">The End</a></li>
 <li><a href="c.xhtml#s2">Later heading in c</a></li>
</ol></nav>
<nav epub:type="landmarks"><ol><li><a href="b.xhtml">Not a chapter</a></li></ol></nav>
</body></html>`

// 10 + 10 + 20 + 10 + 10 runes of text; see the want table below.
const goldenA = `<html><head><title>x</title></head><body><p>0123456789</p><p>abcde<i>fghij</i></p></body></html>`
const goldenB = `<html><body><script>var junk=1;</script><p>01234567890123456789</p></body></html>`
const goldenC = `<html><body><p>ABCDEFGHIJ</p><p>klmnopqrst</p></body></html>`

func goldenBook(t *testing.T, opfText string, extra ...entry) []byte {
	es := []entry{
		{"mimetype", "application/epub+zip"},
		{"META-INF/container.xml", container},
		{"OEBPS/content.opf", opfText},
		{"OEBPS/a.xhtml", goldenA},
		{"OEBPS/b.xhtml", goldenB},
		{"OEBPS/c.xhtml", goldenC},
	}
	return epubOf(t, append(es, extra...)...)
}

func TestTheExtractionRuleIsPinnedChapterTitlesAndPercentsIncluded(t *testing.T) {
	ps, err := Read(goldenBook(t, goldenOPF3, entry{"OEBPS/nav.xhtml", goldenNav}))
	if err != nil {
		t.Fatal(err)
	}
	// 5 paragraphs, 10+10+20+10+10 = 60 runes; starts 0,10,20,40,50 -> 0,16,33,66,83.
	want := []struct {
		text    string
		chapter string
		percent int
	}{
		{"0123456789", "The Beginning", 0},
		{"abcdefghij", "The Beginning", 16},
		{"01234567890123456789", "The Beginning", 33}, // b is untitled: it stays in the chapter before it
		{"ABCDEFGHIJ", "The End", 66},                 // first entry into c wins, not the later heading
		{"klmnopqrst", "The End", 83},
	}
	if len(ps) != len(want) {
		t.Fatalf("got %+v", ps)
	}
	for i, w := range want {
		if ps[i].Text != w.text || ps[i].Chapter != w.chapter || ps[i].Percent != w.percent {
			t.Errorf("paragraph %d: %+v, want %+v", i, ps[i], w)
		}
	}
}

func TestAnEPUB2NCXNamesChaptersToo(t *testing.T) {
	opf2 := `<package xmlns="http://www.idpf.org/2007/opf" version="2.0"><manifest>
 <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
 <item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="c" href="c.xhtml"/></manifest>
 <spine toc="ncx"><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine></package>`
	ncx := `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>
 <navPoint id="1"><navLabel><text>Part One</text></navLabel><content src="a.xhtml"/>
  <navPoint id="2"><navLabel><text>Chapter Two</text></navLabel><content src="b.xhtml#top"/></navPoint>
 </navPoint></navMap></ncx>`
	ps, err := Read(goldenBook(t, opf2, entry{"OEBPS/toc.ncx", ncx}))
	if err != nil {
		t.Fatal(err)
	}
	got := []string{ps[0].Chapter, ps[2].Chapter, ps[4].Chapter}
	if got[0] != "Part One" || got[1] != "Chapter Two" || got[2] != "Chapter Two" {
		t.Fatalf("%q", got)
	}
}

func TestABookWithNoContentsHasPercentsAndNoChapterNames(t *testing.T) {
	ps, err := Read(goldenBook(t, goldenOPF3)) // nav.xhtml is declared but missing
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range ps {
		if p.Chapter != "" {
			t.Fatalf("invented a chapter: %+v", p)
		}
	}
	if ps[3].Percent != 66 {
		t.Fatalf("%+v", ps[3])
	}
}
