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
	// Each is a job (its route queues it): it fails with the step's sentence as
	// its error, which Settings › Jobs and the prompt that asked for it show.
	for _, path := range []string{"/admin/backup", "/admin/backup/safety"} {
		job := decode[struct {
			Job wireJob `json:"job"`
		}](t, admin.mustDo("POST", path, map[string]string{"password": testPw}, http.StatusAccepted)).Job
		if end := admin.jobEnded(job.ID); end.State != "failed" || end.Error != said {
			t.Fatalf("POST %s with the recovery key cut short ended %s saying %q, want failed saying %q", path, end.State, end.Error, said)
		}
	}
	// And nothing was kept.
	if kept := decode[map[string]any](t, admin.mustDo("GET", "/admin/backup", nil, http.StatusOK)); kept["backup"] != nil {
		t.Fatalf("a failed backup left an archive: %v", kept)
	}
}
