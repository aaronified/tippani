package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// A BACKUP THAT FAILS SAYS WHICH STEP FAILED, THE SAME WAY WHEREVER IT WAS ASKED
// FOR: the Server card's kept backup and the safety copy a restore or a reset
// asks for first.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the
// instance recovery key's file in the data dir (recoveryKeyFile), which it cuts
// short, because a step failing is what is under test and nothing a person does
// over HTTP damages that file; on a real server the same thing is a disk that
// filled while the key was written. Everything else is the API an admin uses.

func TestAFailedBackupSaysWhichStepFailed(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	if err := os.WriteFile(filepath.Join(srv.DataDir, recoveryKeyFile), []byte("cut short"), 0o600); err != nil {
		t.Fatal(err)
	}

	const said = "the instance recovery key could not be read or created"
	// The kept backup is a job (POST /admin/backup queues it): it fails with the
	// step's sentence as its error, which Settings › Jobs shows.
	job := decode[struct {
		Job wireJob `json:"job"`
	}](t, admin.mustDo("POST", "/admin/backup", map[string]string{"password": testPw}, http.StatusAccepted)).Job
	if end := admin.jobEnded(job.ID); end.State != "failed" || end.Error != said {
		t.Fatalf("the backup job with the recovery key cut short ended %s saying %q, want failed saying %q", end.State, end.Error, said)
	}
	for _, path := range []string{"/admin/backup/safety"} {
		rec := admin.do("POST", path, map[string]string{"password": testPw})
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("POST %s with the recovery key cut short: %d %s, want 500", path, rec.Code, rec.Body)
		}
		if got := decode[struct {
			Error string `json:"error"`
		}](t, rec).Error; got != said {
			t.Fatalf("POST %s with the recovery key cut short says %q, want %q", path, got, said)
		}
	}
	// And nothing was kept.
	if kept := decode[map[string]any](t, admin.mustDo("GET", "/admin/backup", nil, http.StatusOK)); kept["backup"] != nil {
		t.Fatalf("a failed backup left an archive: %v", kept)
	}
}
