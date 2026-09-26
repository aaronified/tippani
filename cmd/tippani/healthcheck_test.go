package main

// THE CONTAINER'S HEALTH CHECK, RUN AS THE CONTAINER RUNS IT: this test binary is
// started again as `tippani healthcheck`, against a real server, and its exit code
// and what it printed are what Docker would record.
//
// WHAT IT KNOWS, declared because a test here may not know the code: that the
// test binary runs main() when TIPPANI_TEST_AS_BINARY=1 (TestMain below), and the
// pool, through store.HoldEveryConnectionForTest, to put the server in the state
// issue #40 describes.

import (
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"tippani/internal/httpapi"
	"tippani/internal/store"
)

func TestMain(m *testing.M) {
	if os.Getenv("TIPPANI_TEST_AS_BINARY") == "1" {
		main()
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestTheHealthcheckCommandSaysWhyItFailed(t *testing.T) {
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(httpapi.New(st, fstest.MapFS{}, dir, false, false).Handler())
	t.Cleanup(ts.Close)

	check := func() (int, string) {
		cmd := exec.Command(os.Args[0], "healthcheck")
		cmd.Env = append(os.Environ(), "TIPPANI_TEST_AS_BINARY=1",
			"TIPPANI_BIND="+ts.Listener.Addr().String(), "TIPPANI_TLS_CERT=")
		var stderr strings.Builder
		cmd.Stderr = &stderr
		err := cmd.Run()
		code := 0
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		} else if err != nil {
			t.Fatalf("run healthcheck: %v", err)
		}
		return code, stderr.String()
	}

	if code, out := check(); code != 0 {
		t.Fatalf("a healthy server: healthcheck exited %d: %s", code, out)
	}
	store.HoldEveryConnectionForTest(t, st.DB)
	code, out := check()
	if code != 1 {
		t.Fatalf("a server with no connection to give: healthcheck exited %d, want 1 (issue #40): %s", code, out)
	}
	if !strings.Contains(out, "unhealthy (status 503): TIP-HEALTH-001") {
		t.Fatalf("the healthcheck failed without saying why, which is all `docker inspect` would show: %q", out)
	}
}
