package olog

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// TestCodesDocumented enforces that the Code Registry (codes.go) and the operator
// lookup (docs/troubleshoot.md) stay in lockstep: every registered code has a row
// in the doc, and every code mentioned in the doc is registered with a non-empty
// description. This is what keeps "grep the log for the code, look it up" from
// silently rotting as codes are added.
func TestCodesDocumented(t *testing.T) {
	const docPath = "../../docs/troubleshoot.md"
	body, err := os.ReadFile(docPath)
	if err != nil {
		t.Fatalf("read %s: %v", docPath, err)
	}
	codeRe := regexp.MustCompile(`TIP-[A-Z]+-[0-9]+`)
	inDoc := map[string]bool{}
	for _, m := range codeRe.FindAllString(string(body), -1) {
		inDoc[m] = true
	}

	for code, desc := range Registry {
		if strings.TrimSpace(desc) == "" {
			t.Errorf("code %s has an empty description in Registry", code)
		}
		if !inDoc[string(code)] {
			t.Errorf("code %s is in Registry (codes.go) but has no row in %s", code, docPath)
		}
	}
	for c := range inDoc {
		if _, ok := Registry[Code(c)]; !ok {
			t.Errorf("code %s appears in %s but is not in Registry (codes.go)", c, docPath)
		}
	}
}
