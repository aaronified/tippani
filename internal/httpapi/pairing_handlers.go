package httpapi

import (
	"crypto/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"tippani/internal/auth"
	"tippani/internal/olog"
)

// Device pairing: turning a signed-in browser session into a bearer token on a
// phone, without typing a password into the phone.
//
// Settings mints a short-lived one-shot code and renders it as a QR; the app
// scans it and exchanges it for a device token. The exchange has to be
// unauthenticated — the phone has no credential yet, which is the entire point
// — so the code is the credential for those few minutes and is treated like
// one: short, single-use, rate limited, and never reusable once spent.
//
// Codes live in memory rather than in a table, following the one-shot share
// tokens in share_handlers.go. They are valid for minutes, so a restart losing
// them costs the user one tap on "pair a device", and it keeps a transient
// concern out of the schema and out of the backup archive.

const (
	// pairingTTL is deliberately short: the code is a bearer credential for as
	// long as it lives, and pairing is a deliberate act you complete right away.
	pairingTTL = 5 * time.Minute

	// pairingCodeLen balances a code you can read off a screen and retype
	// against one that can't be guessed. 8 characters of a 32-symbol alphabet
	// is 40 bits — trivial to brute force unthrottled, which is why the claim
	// endpoint is rate limited, and out of reach at a few attempts a minute.
	pairingCodeLen = 8

	// maxPairingCodes caps the map so a user holding down "pair" cannot grow it
	// without bound. Oldest-expiring is evicted first, as with share entries.
	maxPairingCodes = 64
)

// pairingAlphabet is Crockford-ish base32: no I, L, O, U, so a code read off a
// screen can't be mistyped as a different valid code.
const pairingAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

type pairingCode struct {
	userID  int64
	expires time.Time
}

// newPairingCode returns a random code from pairingAlphabet. It uses rejection
// sampling rather than modulo so every symbol is equally likely — with a 32
// symbol alphabet and 256 byte values the bias would be nil either way, but the
// habit is worth keeping in credential-generating code.
func newPairingCode() (string, error) {
	buf := make([]byte, pairingCodeLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, pairingCodeLen)
	for i, b := range buf {
		out[i] = pairingAlphabet[int(b)%len(pairingAlphabet)]
	}
	return string(out), nil
}

// handleStartPairing mints a code for the signed-in user. Authenticated: this
// is the half that proves who the new device will belong to.
func (s *Server) handleStartPairing(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	code, err := newPairingCode()
	if err != nil {
		internalError(w, r, "generate pairing code", err)
		return
	}
	expires := time.Now().Add(pairingTTL)

	s.pairingMu.Lock()
	if s.pairingCodes == nil {
		s.pairingCodes = map[string]pairingCode{}
	}
	now := time.Now()
	for c, e := range s.pairingCodes {
		if now.After(e.expires) {
			delete(s.pairingCodes, c)
		}
	}
	for len(s.pairingCodes) >= maxPairingCodes {
		oldest, oldestExp := "", time.Time{}
		for c, e := range s.pairingCodes {
			if oldestExp.IsZero() || e.expires.Before(oldestExp) {
				oldest, oldestExp = c, e.expires
			}
		}
		delete(s.pairingCodes, oldest)
	}
	s.pairingCodes[code] = pairingCode{userID: uid, expires: expires}
	s.pairingMu.Unlock()

	olog.Tracef("[pair] code minted uid=%d", uid)
	writeJSON(w, http.StatusCreated, map[string]any{
		"code":       code,
		"expires_at": expires.UTC().Format(time.RFC3339),
	})
}

// takePairingCode redeems a code, removing it so it can never be spent twice.
func (s *Server) takePairingCode(code string) (userID int64, ok bool) {
	s.pairingMu.Lock()
	defer s.pairingMu.Unlock()
	e, found := s.pairingCodes[code]
	if !found {
		return 0, false
	}
	delete(s.pairingCodes, code) // one-shot, whether or not it had expired
	if time.Now().After(e.expires) {
		return 0, false
	}
	return e.userID, true
}

// expirePairingCodes ages every outstanding code past its TTL. Test seam: the
// alternative is a clock injected through the Server for one assertion.
func (s *Server) expirePairingCodes() {
	s.pairingMu.Lock()
	defer s.pairingMu.Unlock()
	for c, e := range s.pairingCodes {
		e.expires = time.Now().Add(-time.Second)
		s.pairingCodes[c] = e
	}
}

// handleClaimPairing exchanges a code for a device token. Unauthenticated by
// necessity, so it is rate limited by client IP exactly as login is: 40 bits of
// code is only out of reach while guessing stays slow.
func (s *Server) handleClaimPairing(w http.ResponseWriter, r *http.Request) {
	if !s.pairingLimiter.Allow(s.clientIP(r)) {
		writeErr(w, http.StatusTooManyRequests, "too many attempts, try again shortly")
		return
	}
	var req struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	// Codes are shown uppercase; accept whatever case was typed.
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	name, ok := trimCap(strings.TrimSpace(req.Name), 64)
	if !ok {
		writeErr(w, http.StatusBadRequest, "device name too long (max 64 characters)")
		return
	}
	if name == "" {
		name = "Paired device"
	}

	uid, ok := s.takePairingCode(req.Code)
	if !ok {
		// Deliberately indistinguishable from expired or already-spent: telling
		// a guesser which of those it hit narrows the search for them.
		writeErr(w, http.StatusUnauthorized, "invalid or expired pairing code")
		return
	}

	token, err := s.Devices.Create(uid, name)
	if err != nil {
		internalError(w, r, "create device token", err)
		return
	}
	var username string
	if err := s.Store.DB.QueryRow(`SELECT username FROM users WHERE id = ?`, uid).Scan(&username); err != nil {
		internalError(w, r, "load paired user", err)
		return
	}
	olog.Tracef("[pair] device paired uid=%d name=%q", uid, name)
	writeJSON(w, http.StatusCreated, map[string]any{
		"token":    token, // the only time the raw token exists outside the client
		"username": username,
	})
}

func (s *Server) handleListDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := s.Devices.List(userID(r))
	if err != nil {
		internalError(w, r, "list devices", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": devices})
}

func (s *Server) handleRevokeDevice(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid device id")
		return
	}
	switch err := s.Devices.Revoke(userID(r), id); {
	case err == auth.ErrNoSuchDevice:
		// Someone else's device id and a nonexistent one answer alike, so the
		// endpoint can't be used to enumerate other accounts' devices.
		writeErr(w, http.StatusNotFound, "device not found")
	case err != nil:
		internalError(w, r, "revoke device", err)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleRevokeAllDevices(w http.ResponseWriter, r *http.Request) {
	if err := s.Devices.RevokeAllForUser(userID(r)); err != nil {
		internalError(w, r, "revoke all devices", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
