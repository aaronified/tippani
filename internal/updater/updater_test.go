package updater

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareAndUpdateAvailable(t *testing.T) {
	cases := []struct {
		cur, latest string
		cmp         int
		ok          bool
		available   bool
	}{
		{"v1.2.3", "v1.2.4", -1, true, true},
		{"1.2.3", "1.2.3", 0, true, false},
		{"v2.0.0", "v1.9.9", 1, true, false},
		{"v0.9", "v0.10", -1, true, true}, // 9 < 10 numerically, not lexically
		{"dev", "v0.5.0", 0, false, true}, // non-semver current → offer if a release exists
		{"edge", "", 0, false, false},     // no release → nothing to offer
		// A PRE-RELEASE IS A RUN-UP TO ITS VERSION, NOT A SUCCESSOR TO IT.
		// These used to compare equal, so anyone running an rc was told they
		// were up to date on the day the release it was an rc for came out.
		{"v1.0.0-rc1", "v1.0.0", -1, true, true},
		{"v1.0.0", "v1.0.0-rc1", 1, true, false},
		{"v3.0.0-rc.9", "v3.0.0-rc.10", -1, true, true}, // numerically: 9 < 10
		{"v3.0.0-rc.2", "v3.0.0-rc.2", 0, true, false},
		{"v3.0.0-rc", "v3.0.0-rc.1", -1, true, true}, // fewer identifiers first

		// A BRANCH BUILD MUST NOT PASS FOR THE RELEASE IT IS NAMED AFTER, NOR
		// BE OFFERED A DOWNGRADE TO GET THERE. The release branch is "v3", and
		// a bare "v3" parses as 3.0.0 — newer than every real tag, so the
		// tester was told they were current forever. Prefixing it out of semver
		// ("edge-v3") fixed that and bought the opposite: unorderable, so the
		// card offered 2.2.9 — a downgrade — as the update. docker-publish.yml
		// stamps the branch build as a pre-release of the version the branch is
		// FOR, which is the only reading that gets both right.
		{"v3", "v2.9.9", 1, true, false},                 // the first trap
		{"edge-v3", "v2.9.9", 0, false, true},            // the second
		{"3.0.0-edge.f7ddba5", "v2.9.9", 1, true, false}, // ahead of the line
		{"3.0.0-edge.f7ddba5", "v3.0.0-rc.1", -1, true, true},
		{"3.0.0-edge.f7ddba5", "v3.0.0", -1, true, true}, // and of the release
	}
	for _, c := range cases {
		cmp, ok := Compare(c.cur, c.latest)
		if ok != c.ok || (ok && cmp != c.cmp) {
			t.Errorf("Compare(%q,%q) = (%d,%v), want (%d,%v)", c.cur, c.latest, cmp, ok, c.cmp, c.ok)
		}
		if got := UpdateAvailable(c.cur, c.latest); got != c.available {
			t.Errorf("UpdateAvailable(%q,%q) = %v, want %v", c.cur, c.latest, got, c.available)
		}
	}
}

func TestLatestRelease(t *testing.T) {
	// Deliberately NOT in version order, and deliberately with the newest tag
	// published earliest: a channel that ranked by date would pick 3.0.0-rc.1
	// as "latest stable" and 2.9.0 as "latest of any".
	const list = `[
		{"tag_name":"v2.9.0","name":"2.9.0","html_url":"https://x/v2.9.0","published_at":"2026-08-20T00:00:00Z"},
		{"tag_name":"v3.0.0-rc.2","name":"3.0.0-rc.2","prerelease":true,"html_url":"https://x/v3.0.0-rc.2","published_at":"2026-08-10T00:00:00Z"},
		{"tag_name":"v3.0.0-rc.9","name":"3.0.0-rc.9","draft":true,"html_url":"https://x/draft"},
		{"tag_name":"nightly","name":"nightly","prerelease":true,"html_url":"https://x/nightly"}
	]`
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/repos/owner/repo/releases/latest":
			w.Write([]byte(`{"tag_name":"v1.4.0","name":"1.4.0","html_url":"https://x/releases/v1.4.0","published_at":"2026-07-13T00:00:00Z"}`))
		case r.URL.Path == "/repos/owner/repo/releases":
			w.Write([]byte(list))
		default:
			w.WriteHeader(404)
		}
	}))
	defer ts.Close()

	rel, err := LatestRelease(context.Background(), ts.URL, "owner/repo", false)
	if err != nil {
		t.Fatal(err)
	}
	if rel.TagName != "v1.4.0" || rel.HTMLURL == "" {
		t.Fatalf("stable channel: %+v", rel)
	}

	// The pre-release channel reads the list and ranks it. rc.2 beats 2.9.0 on
	// version; the DRAFT rc.9 is higher still and must not be offered, since
	// nothing has been published for it to pull.
	rel, err = LatestRelease(context.Background(), ts.URL, "owner/repo", true)
	if err != nil {
		t.Fatal(err)
	}
	if rel.TagName != "v3.0.0-rc.2" {
		t.Fatalf("pre-release channel: %+v", rel)
	}

	// A repo with no releases (404) is an error, not a panic — on both channels.
	if _, err := LatestRelease(context.Background(), ts.URL, "owner/missing", false); err == nil {
		t.Fatal("expected error for 404 on the stable channel")
	}
	if _, err := LatestRelease(context.Background(), ts.URL, "owner/missing", true); err == nil {
		t.Fatal("expected error for 404 on the pre-release channel")
	}
}

// An unrankable tag is not allowed to win over one that ranks, and is not
// allowed to make the whole list come back empty either.
func TestLatestOfAnyFallsBackOnlyWhenNothingRanks(t *testing.T) {
	serve := func(body string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(body))
		}))
	}
	ts := serve(`[{"tag_name":"nightly"},{"tag_name":"v1.0.0"}]`)
	defer ts.Close()
	rel, err := LatestRelease(context.Background(), ts.URL, "o/r", true)
	if err != nil || rel.TagName != "v1.0.0" {
		t.Fatalf("ranked tag should win: %+v %v", rel, err)
	}

	ts2 := serve(`[{"tag_name":"nightly"},{"tag_name":"codename-badger"}]`)
	defer ts2.Close()
	rel, err = LatestRelease(context.Background(), ts2.URL, "o/r", true)
	if err != nil || rel.TagName != "nightly" {
		t.Fatalf("first published tag is the fallback: %+v %v", rel, err)
	}

	ts3 := serve(`[{"tag_name":"v1.0.0","draft":true}]`)
	defer ts3.Close()
	if _, err := LatestRelease(context.Background(), ts3.URL, "o/r", true); err == nil {
		t.Fatal("a list of nothing but drafts is an error, not a nil release")
	}
}

func TestIsPrerelease(t *testing.T) {
	for _, c := range []struct {
		v    string
		want bool
	}{
		{"3.0.0-edge.f7ddba5", true},
		{"v3.0.0-rc.1", true},
		{"v3.0.0", false},
		{"2.2.9", false},
		{"edge", false},    // unplaceable, not a run-up
		{"edge-v3", false}, // ditto: the old branch stamp stays on stable
		{"dev", false},
	} {
		if got := IsPrerelease(c.v); got != c.want {
			t.Errorf("IsPrerelease(%q) = %v, want %v", c.v, got, c.want)
		}
	}
}

func TestSplitRef(t *testing.T) {
	cases := map[string][2]string{
		"ghcr.io/owner/tippani:latest": {"ghcr.io/owner/tippani", "latest"},
		"ghcr.io/owner/tippani":        {"ghcr.io/owner/tippani", "latest"},
		"registry:5000/img:v1":         {"registry:5000/img", "v1"},
	}
	for ref, want := range cases {
		img, tag := splitRef(ref)
		if img != want[0] || tag != want[1] {
			t.Errorf("splitRef(%q) = (%q,%q), want (%q,%q)", ref, img, tag, want[0], want[1])
		}
	}
}

// A BUILD THAT TRACKS A MOVING TAG. `:v3` is rebuilt on every push to the
// branch and no GitHub release is created for any of them, so the release list
// — everything the pre-release channel can see — is genuinely empty of anything
// newer while the image the box points at has moved several times.
func TestBranchBuildReadsItsOwnBranchAndCommit(t *testing.T) {
	for _, c := range []struct {
		version, branch, commit string
		ok                      bool
	}{
		{"3.0.0-edge.v3.a66ff6c", "v3", "a66ff6c", true},             // the shape CI stamps now
		{"edge.main.a66ff6c", "main", "a66ff6c", true},               // the default branch
		{"edge.release.2.x.abc1234", "release.2.x", "abc1234", true}, // dots in a branch name
		// The two-identifier form that shipped first: the branch comes from the
		// major, which is the assumption the workflow already makes backwards.
		{"3.0.0-edge.f7ddba5", "v3", "f7ddba5", true},
		{"4.1.0-edge.abc1234", "v4", "abc1234", true},
		{"v3.0.0-rc.1", "", "", false}, // a run-up, but a published one
		{"3.0.0", "", "", false},       // the release itself
		{"edge", "", "", false},        // main
		{"edge-v3", "", "", false},     // the old, unorderable stamp
		{"dev", "", "", false},         // a local build
		{"3.0.0-edge", "", "", false},  // no commit to compare
	} {
		b, sha, ok := BranchBuild(c.version)
		if ok != c.ok || b != c.branch || sha != c.commit {
			t.Errorf("BranchBuild(%q) = (%q, %q, %v), want (%q, %q, %v)", c.version, b, sha, ok, c.branch, c.commit, c.ok)
		}
	}
}

func TestBranchHead(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/owner/repo/commits/v3" {
			w.WriteHeader(404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"sha":"a66ff6c1234567890abcdef"}`))
	}))
	defer ts.Close()

	// THE WHOLE SHA, not an abbreviation of somebody's choosing. The caller
	// compares by prefix and abbreviates for display, because the width on the
	// other side of that comparison is git's to change.
	got, err := BranchHead(context.Background(), ts.URL, "owner/repo", "v3")
	if err != nil || got != "a66ff6c1234567890abcdef" {
		t.Fatalf("BranchHead = (%q, %v), want the sha as GitHub gave it", got, err)
	}
	// A branch that has been merged and tidied away is a 404, not a panic.
	if _, err := BranchHead(context.Background(), ts.URL, "owner/repo", "v9"); err == nil {
		t.Fatal("expected an error for a branch that is not there")
	}
}

// TWO ABBREVIATIONS OF ONE COMMIT ARE ONE COMMIT.
//
// THE DEFECT THIS IS FOR, reported as "this is now checking one letter short in
// update and finding ghost updates": the version CI stamps carries
// `git rev-parse --short HEAD`, and `--short` is not a fixed width — git derives
// it from `core.abbrev`, which grows with the object count. This repository
// crossed that boundary and began stamping eight characters, while the head was
// truncated to seven. The two could never be equal, so every check offered an
// update to the commit already running, for ever.
//
// A test that pinned either width would be the same bet in a new place, so what
// is asserted is the RELATION: an abbreviation and its full sha name one commit,
// and two different commits do not, whatever their lengths.
func TestAnAbbreviationAndItsShaAreTheSameCommit(t *testing.T) {
	const full = "cff9ae6e1f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f"

	for _, c := range []struct {
		name string
		a, b string
		want bool
	}{
		// The exact pair from the report: eight characters against the forty.
		{"the eight CI stamped, against the full sha", "cff9ae6e", full, true},
		{"the seven it used to stamp, against the full sha", "cff9ae6", full, true},
		{"seven against eight — one image rebuilt, one not", "cff9ae6", "cff9ae6e", true},
		{"the same width, the same commit", "cff9ae6e", "cff9ae6e", true},
		{"either way round", full, "cff9ae6e", true},
		// Hex is case-insensitive and a hand-typed sha may be either.
		{"cased differently", "CFF9AE6E", full, true},
		{"padded", " cff9ae6e ", full, true},

		{"a different commit of the same length", "cff9ae6e", "a66ff6c1", false},
		{"a different commit, differently abbreviated", "cff9ae6", "a66ff6c1234567890", false},
		// THE FLOOR. Without it an empty or near-empty string is a prefix of
		// everything, and every box in the world reports itself up to date — the
		// failure nobody would report, because it looks like nothing happening.
		{"nothing at all", "", full, false},
		{"one character", "c", full, false},
		{"six characters", "cff9ae", full, false},
		{"two empties", "", "", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := SameCommit(c.a, c.b); got != c.want {
				t.Errorf("SameCommit(%q, %q) = %v, want %v", c.a, c.b, got, c.want)
			}
		})
	}
}

// AND THE ONE SHOWN BESIDE A VERSION IS CUT TO THAT VERSION'S OWN WIDTH, so
// "v3 @ cff9ae6e" and "you are on 3.0.0-edge.v3.cff9ae6e" read as one fact
// rather than as two shas that differ by a character.
func TestTheOfferedCommitIsAbbreviatedLikeTheRunningOne(t *testing.T) {
	const full = "cff9ae6e1f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f"
	for _, c := range []struct{ like, want string }{
		{"cff9ae6e", "cff9ae6e"},
		{"cff9ae6", "cff9ae6"},
		{"cff9ae6e1f2", "cff9ae6e1f2"},
		// Never shorter than a usable abbreviation, and never longer than what
		// there is to abbreviate.
		{"", "cff9ae6"},
		{"abc", "cff9ae6"},
		{full + "extra", full},
	} {
		if got := AbbrevCommit(full, c.like); got != c.want {
			t.Errorf("AbbrevCommit(full, %q) = %q, want %q", c.like, got, c.want)
		}
	}
}

// THE VERSION SHAPES CI ACTUALLY PRODUCES, end to end: what BranchBuild reads out
// of them has to be something SameCommit can match against a real head. This is
// the join the defect fell through — each half was right and the pair was not.
func TestAStampedVersionMatchesItsOwnBranchHead(t *testing.T) {
	const full = "cff9ae6e1f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f"
	for _, version := range []string{
		"3.0.0-edge.v3.cff9ae6e", // a release branch, eight characters
		"3.0.0-edge.v3.cff9ae6",  // the same branch, built when git said seven
		"edge.main.cff9ae6e",     // the default branch
		"3.0.0-edge.cff9ae6e",    // the two-identifier form that shipped first
	} {
		_, commit, ok := BranchBuild(version)
		if !ok {
			t.Fatalf("BranchBuild(%q) did not read a branch build", version)
		}
		if !SameCommit(commit, full) {
			t.Errorf("%q reports an update to the commit it is already running", version)
		}
	}
}
