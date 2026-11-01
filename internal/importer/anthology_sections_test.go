package importer

import (
	"strings"
	"testing"
)

const sectionedFile = `---
type: anthology
title: Parts
---

The introduction.

# First part

Why these three belong together.

## Calvino

> Cities, like dreams, are made of desires and fears.

- speaker: Italo Calvino

## Stalker

> The Zone is a very complicated system of traps.

# Second part

## Borges

> Time is the substance I am made of.

# A heading with nothing after it
`

func TestAnAnthologyFileSectionRidesOnTheEntryItOpens(t *testing.T) {
	a, err := AnthologyMarkdown(strings.NewReader(sectionedFile))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Entries) != 3 {
		t.Fatalf("%d entries, want 3 (a heading is not a passage)", len(a.Entries))
	}
	if a.Intro != "The introduction." {
		t.Errorf("intro = %q", a.Intro)
	}
	for i, want := range []struct{ title, prose string }{
		{"First part", "Why these three belong together."},
		{"", ""},
		{"Second part", ""},
	} {
		got := a.Entries[i]
		if got.AnthologySection != want.title || got.AnthologySectionProse != want.prose {
			t.Errorf("entry %d opens section %q / %q, want %q / %q", i, got.AnthologySection, got.AnthologySectionProse, want.title, want.prose)
		}
	}
	if a.Entries[0].AnthologyNote != "" {
		t.Errorf("the section's prose was taken as the first entry's commentary: %q", a.Entries[0].AnthologyNote)
	}
}

func TestAFileWithNoSectionsParsesAsBefore(t *testing.T) {
	a, err := AnthologyMarkdown(strings.NewReader("---\ntype: anthology\ntitle: Plain\n---\n\n## One\n\nNote.\n\n> Quote.\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Entries) != 1 || a.Entries[0].AnthologySection != "" || a.Entries[0].AnthologyNote != "Note." {
		t.Errorf("entries: %+v", a.Entries)
	}
}
