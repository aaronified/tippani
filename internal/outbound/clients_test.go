// THIS FILE READS SOURCE TEXT, AND HERE IS THE DECLARATION FOR IT.
//
// WHAT IT KNOWS: that an outbound HTTP client in Go is spelled `&http.Client{`,
// and which files in this repo contain one.
//
// WHY NOTHING OBSERVABLE COULD SERVE: every other test of this switch drives a
// real client at a real stub and counts the stub's entries — which is the right
// shape and catches everything except the thing that actually happens. What
// actually happens is that somebody adds a fifth provider next month, writes
// `&http.Client{Timeout: …}` because that is what the four above it look like,
// and ships it. No journey exists for a provider nobody has written a journey
// for; no counting stub is reached by a client no test calls. The defect is
// invisible at the moment it is committed and visible only in a packet capture.
//
// So this counts the clients, and every one of them either carries the gate or
// is named below with a reason. It is a ceiling in both directions: a new gated
// client must be added here too, which is a one-line edit that makes somebody
// read this paragraph.
//
// WHAT IT CANNOT SEE, said plainly rather than claimed away. A client built by a
// helper (`newClient()`), assigned from a variable, or returned by a third-party
// package has no `&http.Client{` in it. A brace inside a string literal inside a
// client literal would confuse the matcher. This is a regex over source text and
// not a type system; the claim is "the obvious spelling", which is what all five
// clients in this repo are, and not "every possible client".
package outbound

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// UNGATED BY DESIGN, each verified at its own line. Neither of these leaves the
// machine, and switching the app offline must not break either.
var ungated = map[string]struct {
	count int
	why   string
}{
	"cmd/tippani/main.go":        {1, "the healthcheck subcommand probes 127.0.0.1/healthz — its own loopback port, not the internet"},
	"internal/updater/docker.go": {2, "the Docker Engine API over a mounted unix socket or a local docker-socket-proxy; local infrastructure, and a box switched offline still has a daemon"},
}

func repoRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "go.mod")); err != nil {
		t.Fatalf("%s is not the repo root: %v", root, err)
	}
	return root
}

// clientsIn returns the source of each `&http.Client{…}` literal in src, brace
// matched so the whole literal is returned and not just its first line.
func clientsIn(src string) []string {
	var out []string
	for i := 0; ; {
		j := strings.Index(src[i:], "&http.Client{")
		if j < 0 {
			return out
		}
		start := i + j
		depth, end := 0, -1
		for k := start + len("&http.Client"); k < len(src); k++ {
			switch src[k] {
			case '{':
				depth++
			case '}':
				if depth--; depth == 0 {
					end = k + 1
				}
			}
			if end >= 0 {
				break
			}
		}
		if end < 0 {
			return append(out, src[start:]) // unbalanced; report what there is
		}
		out = append(out, src[start:end])
		i = end
	}
}

func TestEveryOutboundClientCarriesTheGate(t *testing.T) {
	root := repoRoot(t)
	seen := map[string]int{}
	var bare []string

	for _, dir := range []string{"internal", "cmd"} {
		err := filepath.Walk(filepath.Join(root, dir), func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			// .claude/worktrees holds a full second checkout of this repo and is
			// gitignored, so a walk that does not skip it counts the app twice.
			if info.IsDir() && (info.Name() == ".claude" || info.Name() == "node_modules") {
				return filepath.SkipDir
			}
			if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			src, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(root, path)
			rel = filepath.ToSlash(rel)
			for _, lit := range clientsIn(string(src)) {
				seen[rel]++
				if !strings.Contains(lit, "outbound.Transport(") {
					bare = append(bare, rel)
				}
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	if len(seen) == 0 {
		t.Fatal("no &http.Client{ found anywhere — the walk is looking in the wrong place, so this test is measuring nothing")
	}

	for _, rel := range bare {
		if _, ok := ungated[rel]; !ok {
			t.Errorf("%s builds an http.Client with no outbound.Transport, so TIPPANI_OFFLINE does not reach it.\n"+
				"Wrap its transport — outbound.Transport(nil), or outbound.Transport(base) to keep one it already has — "+
				"or, if the call genuinely never leaves the machine, add it to `ungated` above with the reason.", rel)
		}
	}

	// AND THE ALLOWLIST IS EXACT. A second client appearing in a file that is
	// already excused would be excused with it, which is how an allowlist stops
	// being a list and becomes a hole.
	for rel, ex := range ungated {
		if got := seen[rel]; got != ex.count {
			t.Errorf("%s has %d http.Client literals, and %d is excused here (%s). "+
				"Read the new one: gate it, or raise the count and say why it does not need gating.",
				rel, got, ex.count, ex.why)
		}
	}
}
