package httpapi

// Pushover: a message on the reader's phone when something worth walking back
// to has happened.
//
// WHAT SENDS ONE, and the rule that picked them — the reader has plausibly left
// the screen, and the thing is finished or waiting on them:
//
//	daily   the day's review deck is ready (the `notify daily` subcommand)
//	import  a large import has been parsed into staging and waits for review,
//	        and a large approval has landed in the library
//	fetch   a long metadata run finished — the cover/detail refetch over the
//	        whole library, and a bulk "fill gaps" over a big selection
//	backup  a backup archive was written
//
// A small import or a fetch of five works is over before the phone would buzz,
// so each has a threshold below which nothing is sent.
//
// SENT INSIDE THE REQUEST THAT FINISHED THE WORK, with a short timeout, and
// never in a goroutine of its own — the repo's invariant is that nothing
// outlives its request. A slow or failing Pushover costs at most that timeout
// and is logged (TIP-NOTIFY-001); it never fails the import that caused it.
//
// THE DAILY MESSAGE HAS NO TIMER IN THE APP. `tippani notify daily` is run by
// the host's cron, the same answer Design-decisions gives nightly backups:
// the operator's timer, not the app's.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tippani/internal/olog"
	"tippani/internal/outbound"
)

const (
	defaultPushoverAPI = "https://api.pushover.net/1/messages.json"
	notifyTimeout      = 5 * time.Second
	// notifyImportMin is the smallest import (quotes) worth a message.
	notifyImportMin = 50
	// notifyFetchMin is the smallest metadata run (works) worth a message.
	notifyFetchMin = 20
)

var pushoverClient = &http.Client{Timeout: notifyTimeout, Transport: outbound.Transport(nil)}

type notifySettings struct {
	PushoverUser string `json:"pushover_user"`
	AppToken     string `json:"app_token"`
	OnDaily      bool   `json:"on_daily"`
	OnImport     bool   `json:"on_import"`
	OnFetch      bool   `json:"on_fetch"`
	OnBackup     bool   `json:"on_backup"`
	lastDailyDay string
}

func (s *Server) loadNotify(uid int64) (notifySettings, error) {
	n := notifySettings{OnDaily: true, OnImport: true, OnFetch: true, OnBackup: true}
	err := s.Store.DB.QueryRow(`SELECT pushover_user, app_token, on_daily, on_import, on_fetch, on_backup, last_daily_day
		FROM notify_settings WHERE user_id = ?`, uid).
		Scan(&n.PushoverUser, &n.AppToken, &n.OnDaily, &n.OnImport, &n.OnFetch, &n.OnBackup, &n.lastDailyDay)
	if errors.Is(err, sql.ErrNoRows) {
		return n, nil
	}
	return n, err
}

func (n notifySettings) wants(event string) bool {
	switch event {
	case "daily":
		return n.OnDaily
	case "import":
		return n.OnImport
	case "fetch":
		return n.OnFetch
	case "backup":
		return n.OnBackup
	}
	return true // "test"
}

// pushover sends one message. It returns the error so the test button can
// report it; every other caller goes through notify, which only logs.
func (s *Server) pushover(ctx context.Context, n notifySettings, title, message string) error {
	token := n.AppToken
	if token == "" {
		token = s.PushoverToken
	}
	if n.PushoverUser == "" || token == "" {
		return errors.New("no Pushover user key or application token")
	}
	api := s.PushoverAPI
	if api == "" {
		api = defaultPushoverAPI
	}
	ctx, cancel := context.WithTimeout(ctx, notifyTimeout)
	defer cancel()
	form := url.Values{"token": {token}, "user": {n.PushoverUser}, "title": {title}, "message": {message}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, api, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := pushoverClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("pushover answered %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

// notify sends an event's message if the reader has Pushover set up and wants
// that kind. Never fails its caller.
func (s *Server) notify(ctx context.Context, uid int64, event, title, message string) {
	n, err := s.loadNotify(uid)
	if err != nil {
		olog.Warnf(olog.CodeNotifySend, "[notify] settings uid=%d: %v", uid, err)
		return
	}
	if n.PushoverUser == "" || !n.wants(event) {
		return
	}
	// Detached from the request's cancellation but not from its lifetime: the
	// work is already done, so a reader closing the tab should not cancel the
	// message about it, and notifyTimeout still bounds the call inside the
	// handler that makes it.
	if err := s.pushover(context.WithoutCancel(ctx), n, title, message); err != nil {
		olog.Warnf(olog.CodeNotifySend, "[notify] %s uid=%d: %v", event, uid, err)
	}
}

// notifyAfter flushes the response already written, then sends the message, so
// the reader's screen is not held for Pushover's round trip.
func (s *Server) notifyAfter(w http.ResponseWriter, r *http.Request, uid int64, event, title, message string) {
	_ = http.NewResponseController(w).Flush()
	s.notify(r.Context(), uid, event, title, message)
}

func (s *Server) handleGetNotify(w http.ResponseWriter, r *http.Request) {
	n, err := s.loadNotify(userID(r))
	if err != nil {
		internalError(w, r, "notify settings", err)
		return
	}
	// The app token is write-only once stored: the screen says whether one is
	// set, not what it is.
	hasToken := n.AppToken != ""
	n.AppToken = ""
	writeJSON(w, http.StatusOK, map[string]any{
		"settings":         n,
		"has_app_token":    hasToken,
		"server_app_token": s.PushoverToken != "",
	})
}

func (s *Server) handlePutNotify(w http.ResponseWriter, r *http.Request) {
	var in struct {
		PushoverUser *string `json:"pushover_user"`
		AppToken     *string `json:"app_token"`
		OnDaily      *bool   `json:"on_daily"`
		OnImport     *bool   `json:"on_import"`
		OnFetch      *bool   `json:"on_fetch"`
		OnBackup     *bool   `json:"on_backup"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	uid := userID(r)
	n, err := s.loadNotify(uid)
	if err != nil {
		internalError(w, r, "notify settings", err)
		return
	}
	// Pushover keys are 30 characters of [A-Za-z0-9]; anything else is a paste
	// that caught a space or a label, and is refused rather than stored.
	valid := func(k string) bool {
		if len(k) > 64 {
			return false
		}
		for _, c := range k {
			if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
				return false
			}
		}
		return true
	}
	if in.PushoverUser != nil {
		n.PushoverUser = strings.TrimSpace(*in.PushoverUser)
	}
	if in.AppToken != nil {
		n.AppToken = strings.TrimSpace(*in.AppToken)
	}
	if !valid(n.PushoverUser) || !valid(n.AppToken) {
		writeErr(w, http.StatusBadRequest, "Pushover keys are letters and digits only")
		return
	}
	for _, p := range []struct {
		in  *bool
		out *bool
	}{{in.OnDaily, &n.OnDaily}, {in.OnImport, &n.OnImport}, {in.OnFetch, &n.OnFetch}, {in.OnBackup, &n.OnBackup}} {
		if p.in != nil {
			*p.out = *p.in
		}
	}
	if _, err := s.Store.DB.Exec(`INSERT INTO notify_settings (user_id, pushover_user, app_token, on_daily, on_import, on_fetch, on_backup)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET pushover_user = excluded.pushover_user, app_token = excluded.app_token,
		  on_daily = excluded.on_daily, on_import = excluded.on_import, on_fetch = excluded.on_fetch, on_backup = excluded.on_backup`,
		uid, n.PushoverUser, n.AppToken, n.OnDaily, n.OnImport, n.OnFetch, n.OnBackup); err != nil {
		internalError(w, r, "notify settings", err)
		return
	}
	s.handleGetNotify(w, r)
}

func (s *Server) handleTestNotify(w http.ResponseWriter, r *http.Request) {
	n, err := s.loadNotify(userID(r))
	if err != nil {
		internalError(w, r, "notify settings", err)
		return
	}
	if err := s.pushover(r.Context(), n, "Tippani", "Notifications are working."); err != nil {
		olog.Warnf(olog.CodeNotifySend, "[notify] test uid=%d: %v", userID(r), err)
		writeErr(w, http.StatusBadGateway, "Pushover did not accept the message: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// DailyDeckResult is one reader's line in the `notify daily` report.
type DailyDeckResult struct {
	Username string
	Cards    int
	Sent     bool
	Skipped  string // why nothing was sent, when nothing was
}

// SendDailyDecks tells every reader with Pushover set up that today's deck is
// ready, once per reviewer-local day. offset is the reviewers' UTC offset in
// minutes — the same number the client sends with /review/daily.
func (s *Server) SendDailyDecks(ctx context.Context, offset int) ([]DailyDeckResult, error) {
	rows, err := s.Store.DB.Query(`SELECT u.id, u.username FROM users u
		JOIN notify_settings n ON n.user_id = u.id
		WHERE n.pushover_user <> '' AND n.on_daily = 1 ORDER BY u.id`)
	if err != nil {
		return nil, err
	}
	type who struct {
		id   int64
		name string
	}
	var users []who
	for rows.Next() {
		var u who
		if err := rows.Scan(&u.id, &u.name); err != nil {
			rows.Close()
			return nil, err
		}
		users = append(users, u)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	day, _, _ := reviewDay(offset)
	var out []DailyDeckResult
	// ONE READER'S FAILURE IS THAT READER'S. A bad row for the first account
	// must not leave everyone after it without their message, so an error is
	// written on that reader's line and the run goes on; the joined errors are
	// returned at the end, so the cron job still exits non-zero and says why.
	var errs []error
	fail := func(res DailyDeckResult, uid int64, err error) {
		olog.Warnf(olog.CodeNotifySend, "[notify] daily uid=%d: %v", uid, err)
		res.Skipped = err.Error()
		out = append(out, res)
		errs = append(errs, fmt.Errorf("%s: %w", res.Username, err))
	}
	for _, u := range users {
		res := DailyDeckResult{Username: u.name}
		n, err := s.loadNotify(u.id)
		if err != nil {
			fail(res, u.id, err)
			continue
		}
		if n.lastDailyDay == day {
			res.Skipped = "already sent today"
			out = append(out, res)
			continue
		}
		deck, err := s.dailyDeck(u.id, offset)
		if err != nil {
			fail(res, u.id, err)
			continue
		}
		res.Cards = len(deck.items)
		if res.Cards == 0 {
			res.Skipped = "nothing due"
			out = append(out, res)
			continue
		}
		if err := s.pushover(ctx, n, "Today's review is ready",
			countOf(res.Cards, "card", "cards")+" waiting in your daily deck."); err != nil {
			fail(res, u.id, err)
			continue
		}
		if _, err := s.Store.DB.Exec(`UPDATE notify_settings SET last_daily_day = ? WHERE user_id = ?`, day, u.id); err != nil {
			// Sent but not recorded: a second run today would send again, which
			// is the lesser harm next to not sending.
			fail(res, u.id, err)
			continue
		}
		res.Sent = true
		out = append(out, res)
	}
	return out, errors.Join(errs...)
}

// count is "1 card" / "3 cards" for a notification's sentence.
func countOf(n int, one, many string) string {
	return fmt.Sprintf("%d %s", n, plural(n, one, many))
}
