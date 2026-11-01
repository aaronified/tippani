package mount

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// WHAT THIS KNOWS: a folder of files in a temp directory, the package's two verbs
// (Walk and ReadFile) and its refusals. The one test that reads source text declares
// itself below, because "we only read" is a promise no behaviour can show: a write
// that never happens in a test is still a write.

func tree(t *testing.T, files ...string) *Root {
	t.Helper()
	dir := t.TempDir()
	for _, f := range files {
		p := filepath.Join(dir, filepath.FromSlash(f))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("content of "+f), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	r, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

var srtOnly = map[string]bool{".srt": true}

// walked returns the files a walk reports from cursor, at most limit when limit > 0
// (the callback then ends the walk, as a Stop does).
func walked(r *Root, cursor string, exts map[string]bool, limit int) (got []string, res WalkResult) {
	res = r.Walk(cursor, exts, func(f Found) bool {
		if limit > 0 && len(got) >= limit {
			return false
		}
		got = append(got, f.Rel)
		return true
	})
	return got, res
}

func TestWalkListsMatchingFilesInStableOrderWithRelativePaths(t *testing.T) {
	r := tree(t, "movies/B Film (2001)/b.en.srt", "movies/A Film (1999)/a.en.srt", "movies/A Film (1999)/a.mkv", "books/x.EPUB", "top.srt")
	got, _ := walked(r, "", map[string]bool{".srt": true, ".epub": true}, 0)
	want := []string{"books/x.EPUB", "movies/A Film (1999)/a.en.srt", "movies/B Film (2001)/b.en.srt", "top.srt"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("got %q", got)
	}
}

// Ending a walk from the callback and resuming after the last handled file covers every
// file exactly once.
func TestEndingAWalkAndResumingCoversEachFileOnce(t *testing.T) {
	var files []string
	for _, d := range []string{"a", "b", "c"} {
		for i := 0; i < 4; i++ {
			files = append(files, d+"/"+string(rune('a'+i))+".srt")
		}
	}
	r := tree(t, files...)
	full, _ := walked(r, "", srtOnly, 0)
	if len(full) != 12 {
		t.Fatalf("setup: %v", full)
	}
	var seen []string
	cursor := ""
	for pass := 0; pass < 20; pass++ {
		got, res := walked(r, cursor, srtOnly, 5)
		seen = append(seen, got...)
		if !res.Stopped {
			break
		}
		cursor = got[len(got)-1]
	}
	sort.Strings(seen)
	if strings.Join(seen, "|") != strings.Join(full, "|") {
		t.Fatalf("resuming skipped or repeated files: got %q, want %q", seen, full)
	}
}

// Each file is reported with its size and modification time.
func TestWalkReportsSizeAndModificationTime(t *testing.T) {
	r := tree(t, "a.srt")
	var f Found
	r.Walk("", srtOnly, func(x Found) bool { f = x; return true })
	if f.Rel != "a.srt" || f.Size != int64(len("content of a.srt")) || f.ModTime <= 0 {
		t.Fatalf("%+v", f)
	}
}

// THE ESCAPE: a symlink pointing out of the mount is refused, not followed. The fixture
// is a symlink; where the platform will not make one (an unprivileged Windows account)
// the case cannot be built and is skipped rather than faked.
func TestASymlinkOutOfTheMountIsRefusedNotFollowed(t *testing.T) {
	outside := t.TempDir()
	secret := filepath.Join(outside, "secret.srt")
	if err := os.WriteFile(secret, []byte("not yours"), 0o644); err != nil {
		t.Fatal(err)
	}
	r := tree(t, "ok.srt")
	if err := os.Symlink(secret, filepath.Join(r.Path(), "escape.srt")); err != nil {
		t.Skipf("cannot make a symlink here: %v", err)
	}
	got, res := walked(r, "", srtOnly, 0)
	if len(got) != 1 || got[0] != "ok.srt" {
		t.Fatalf("followed a link out of the mount: %q", got)
	}
	if res.Skipped.Outside != 1 {
		t.Fatalf("the refusal should be counted: %+v", res.Skipped)
	}
	if _, err := r.ReadFile("escape.srt", 1<<20); !errors.Is(err, ErrOutside) {
		t.Fatalf("read through a link out of the mount: %v", err)
	}
}

func TestAPathThatLeavesTheRootIsRefused(t *testing.T) {
	r := tree(t, "ok.srt")
	outside := filepath.Join(filepath.Dir(r.Path()), "neighbour.srt")
	if err := os.WriteFile(outside, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"../neighbour.srt", "a/../../neighbour.srt", outside, ""} {
		if _, err := r.ReadFile(p, 1<<20); err == nil {
			t.Errorf("read %q from outside the mount", p)
		}
	}
	if b, err := r.ReadFile("ok.srt", 1<<20); err != nil || string(b) != "content of ok.srt" {
		t.Fatalf("%q %v", b, err)
	}
}

func TestOnlyRegularFilesAreRead(t *testing.T) {
	r := tree(t, "dir/x.srt")
	if _, err := r.ReadFile("dir", 1<<20); !errors.Is(err, ErrNotRegular) {
		t.Fatalf("a folder is not a file: %v", err)
	}
}

func TestAFileOverTheLimitIsRefusedNotTruncated(t *testing.T) {
	r := tree(t, "big.srt")
	if _, err := r.ReadFile("big.srt", 5); err == nil {
		t.Fatal("a file over the limit must be an error")
	}
}

func TestExistsSaysWhetherTheFileIsWhereItWas(t *testing.T) {
	r := tree(t, "here.srt")
	if !r.Exists("here.srt") || r.Exists("gone.srt") || r.Exists("../x") {
		t.Fatal("Exists")
	}
}

func TestOpenRefusesWhatIsNotAFolder(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "file")
	_ = os.WriteFile(f, []byte("x"), 0o644)
	if _, err := Open(f); err == nil {
		t.Fatal("a file is not a mount")
	}
	if _, err := Open(filepath.Join(dir, "missing")); err == nil {
		t.Fatal("a missing folder is not a mount")
	}
	if _, err := Open(""); err == nil {
		t.Fatal("an empty path is not a mount")
	}
}

// DECLARED EXCEPTION: this test reads this package's own source text. "Nothing under a
// mount is ever opened for writing" is the promise the app makes, as against the one
// `:ro` makes, and no behaviour shows it: a write that no test happens to trigger is
// still a write. So the guard is that the package CONTAINS none — no call that creates,
// writes, renames, removes, truncates or changes anything — and it fails the day a
// convenience feature adds one.
func TestThePackageContainsNoCallThatWrites(t *testing.T) {
	banned := regexp.MustCompile(`\bos\.(Create|OpenFile|WriteFile|Remove|RemoveAll|Rename|Mkdir|MkdirAll|MkdirTemp|CreateTemp|Truncate|Chmod|Chown|Chtimes|Symlink|Link)\b|\bioutil\.WriteFile\b`)
	files, err := filepath.Glob("*.go")
	if err != nil || len(files) == 0 {
		t.Fatalf("no source found to check: %v", err)
	}
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for i, line := range strings.Split(string(b), "\n") {
			code := line
			if c := strings.Index(code, "//"); c >= 0 {
				code = code[:c]
			}
			if banned.MatchString(code) {
				t.Errorf("%s:%d writes under a mount: %s", f, i+1, strings.TrimSpace(line))
			}
		}
	}
}

// A directory and a file whose names differ only by what follows the common prefix: "a.srt"
// sorts before the directory "a/" by full path, because '.' sorts before '/'. A walk that
// ordered entries by bare name visited "a/" first, and on resume skipped "a.srt" as done.
func TestAResumedWalkLosesNoFileBesideADirectoryWhoseNameItPrefixes(t *testing.T) {
	r := tree(t, "a/x.srt", "a/y.srt", "a.srt", "a-b.srt", "a b.srt", "b.srt")
	full, _ := walked(r, "", srtOnly, 0)
	var seen []string
	cursor := ""
	for pass := 0; pass < 20; pass++ {
		got, res := walked(r, cursor, srtOnly, 1)
		seen = append(seen, got...)
		if !res.Stopped {
			break
		}
		cursor = got[len(got)-1]
	}
	sort.Strings(seen)
	sort.Strings(full)
	if strings.Join(seen, "|") != strings.Join(full, "|") || len(seen) != 6 {
		t.Fatalf("resuming skipped or repeated files:\n got %q\nwant %q", seen, full)
	}
}

func TestOpenReaderIsContainedAndReadOnly(t *testing.T) {
	r := tree(t, "ok.srt")
	f, size, err := r.OpenReader("ok.srt")
	if err != nil || size == 0 {
		t.Fatalf("%v %d", err, size)
	}
	f.Close()
	if _, _, err := r.OpenReader("../x"); err == nil {
		t.Fatal("a path out of the mount must be refused")
	}
}

func TestListShowsFoldersFirstThenOnlyTheWantedFilesAndRefusesAWayOut(t *testing.T) {
	r := tree(t, "a/x.srt", "b.srt", "c.txt", "a/deep/y.srt")
	top, err := r.List("", srtOnly)
	if err != nil || len(top) != 2 || top[0].Name != "a" || !top[0].Dir || top[1].Name != "b.srt" || top[1].Rel != "b.srt" {
		t.Fatalf("%+v %v", top, err)
	}
	in, err := r.List("a", srtOnly)
	if err != nil || len(in) != 2 || in[0].Rel != "a/deep" || in[1].Rel != "a/x.srt" {
		t.Fatalf("%+v %v", in, err)
	}
	if _, err := r.List("..", srtOnly); err == nil {
		t.Fatal("a listing must not leave the root")
	}
	if _, err := r.List("b.srt", srtOnly); err == nil {
		t.Fatal("a file is not a folder")
	}
}
