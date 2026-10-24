package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"tippani/internal/outbound"
)

// fakePushover records every message it is sent, as Pushover's API takes them.
type fakePushover struct {
	mu   sync.Mutex
	msgs []map[string]string
}

func newFakePushover(t *testing.T, srv *Server) *fakePushover {
	t.Helper()
	f := &fakePushover{}
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.PostForm.Get("user") == "" || r.PostForm.Get("token") == "" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"status":0,"errors":["user or token missing"]}`))
			return
		}
		f.mu.Lock()
		f.msgs = append(f.msgs, map[string]string{
			"user": r.PostForm.Get("user"), "token": r.PostForm.Get("token"),
			"title": r.PostForm.Get("title"), "message": r.PostForm.Get("message"),
		})
		f.mu.Unlock()
		_, _ = w.Write([]byte(`{"status":1}`))
	}))
	t.Cleanup(p.Close)
	srv.PushoverAPI = p.URL
	return f
}

func (f *fakePushover) sent() []map[string]string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]map[string]string(nil), f.msgs...)
}

const testPushoverUser = "uQiRzpo4DXghDmr9QzzfQu27cmVRsG"

func TestPushoverTestButtonUsesTheReadersKeyAndTheServerToken(t *testing.T) {
	srv := newTestServer(t)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	c := signupAdmin(t, srv.Handler())

	// Nothing set up: the test button says so rather than pretending.
	c.mustDo("POST", "/auth/notifications/test", nil, http.StatusBadGateway)

	c.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": "not a key!"}, http.StatusBadRequest)
	got := decode[struct {
		Settings       notifySettings `json:"settings"`
		ServerAppToken bool           `json:"server_app_token"`
	}](t, c.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, 200))
	if got.Settings.PushoverUser != testPushoverUser || !got.ServerAppToken || !got.Settings.OnDaily {
		t.Fatalf("settings after save: %+v", got)
	}
	c.mustDo("POST", "/auth/notifications/test", nil, 200)
	msgs := push.sent()
	if len(msgs) != 1 || msgs[0]["user"] != testPushoverUser || msgs[0]["token"] != srv.PushoverToken {
		t.Fatalf("pushover received %+v", msgs)
	}

	// A reader's own app token wins over the server's, and is never read back.
	own := decode[map[string]any](t, c.mustDo("PUT", "/auth/notifications",
		map[string]any{"app_token": "ownTokenOwnTokenOwnToken123456"}, 200))
	if own["has_app_token"] != true || own["settings"].(map[string]any)["app_token"] != "" {
		t.Fatalf("own token echoed or not recorded: %+v", own)
	}
	c.mustDo("POST", "/auth/notifications/test", nil, 200)
	if msgs = push.sent(); msgs[1]["token"] != "ownTokenOwnTokenOwnToken123456" {
		t.Fatalf("own token not used: %+v", msgs[1])
	}

	// TIPPANI_OFFLINE reaches Pushover too: the phone is the internet.
	t.Setenv(outbound.EnvVar, "1")
	c.mustDo("POST", "/auth/notifications/test", nil, http.StatusBadGateway)
}

// The cron half: one message per reader per day, naming the deck the quiz
// would serve, and nothing for a reader with nothing due.
func TestSendDailyDecksOncePerDay(t *testing.T) {
	srv := newTestServer(t)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	for _, c := range []*testClient{alice, bob} {
		c.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, 200)
	}
	book := createBook(t, alice, "Meditations")
	for i := 0; i < 3; i++ {
		alice.mustDo("POST", "/annotations", map[string]any{"book_id": book,
			"quote": fmt.Sprintf("Line %d of the Meditations, long enough to ask about.", i)}, http.StatusCreated)
	}
	ageSeededItems(t, srv)
	deck := decode[struct {
		Items []any `json:"items"`
	}](t, alice.mustDo("GET", "/review/daily?offset=0", nil, 200))

	res, err := srv.SendDailyDecks(context.Background(), 0)
	if err != nil {
		t.Fatal(err)
	}
	msgs := push.sent()
	if len(msgs) != 1 || !strings.HasPrefix(msgs[0]["message"], fmt.Sprintf("%d card", len(deck.Items))) || len(deck.Items) == 0 {
		t.Fatalf("daily: results %+v, messages %+v, deck of %d", res, msgs, len(deck.Items))
	}
	for _, r := range res {
		if r.Username == "bob" && (r.Sent || r.Skipped != "nothing due") {
			t.Fatalf("bob has no quotes and was %+v", r)
		}
	}
	if _, err := srv.SendDailyDecks(context.Background(), 0); err != nil {
		t.Fatal(err)
	}
	if n := len(push.sent()); n != 1 {
		t.Fatalf("a second run the same day sent again (%d messages)", n)
	}
}

// A written backup archive tells the admin's phone, naming the file; switching
// backups off silences it.
func TestPushoverOnBackup(t *testing.T) {
	srv := newTestServer(t)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, 200)
	name := backupNow(c).Name
	msgs := push.sent()
	if len(msgs) != 1 || msgs[0]["title"] != "Backup ready" || name == "" || !strings.Contains(msgs[0]["message"], name) {
		t.Fatalf("backup %q sent %+v", name, msgs)
	}
	c.mustDo("PUT", "/auth/notifications", map[string]any{"on_backup": false}, 200)
	backupNow(c)
	if n := len(push.sent()); n != 1 {
		t.Fatalf("backups switched off, yet %d messages", n)
	}
}

// One reader's broken row does not cost the others their morning message: the
// run carries on past it and still reports the failure. Mutation: returning on
// the first error (the original shape) leaves bob with nothing.
func TestSendDailyDecksCarriesOnPastOneReader(t *testing.T) {
	srv := newTestServer(t)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	for _, c := range []*testClient{alice, bob} {
		c.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, 200)
	}
	book := createBook(t, bob, "Meditations")
	bob.mustDo("POST", "/annotations", map[string]any{"book_id": book,
		"quote": "A line long enough to be asked about in the morning."}, http.StatusCreated)
	ageSeededItems(t, srv)
	// A value no boolean scans from: alice's settings row cannot be read.
	if _, err := srv.Store.DB.Exec(`UPDATE notify_settings SET on_import = 'broken'
		WHERE user_id = (SELECT id FROM users WHERE username = 'alice')`); err != nil {
		t.Fatal(err)
	}
	res, err := srv.SendDailyDecks(context.Background(), 0)
	if err == nil || !strings.Contains(err.Error(), "alice") {
		t.Fatalf("alice's failure was not reported: %v", err)
	}
	if len(push.sent()) != 1 || len(res) != 2 || !res[1].Sent {
		t.Fatalf("bob did not get his message after alice failed: %+v, %d sent", res, len(push.sent()))
	}
}
