package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"tippani/internal/auth"
	"tippani/internal/buildinfo"
)

const maxAuthBody = 4 << 10 // 4 KiB is plenty for credentials

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "username and password required")
		return
	}
	if !s.loginLimiter.Allow(s.clientIP(r) + "|" + req.Username) {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}

	var id int64
	var hash string
	err := s.Store.DB.QueryRow(
		`SELECT id, password_hash FROM users WHERE username = ?`, req.Username,
	).Scan(&id, &hash)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		auth.CheckPasswordDummy(req.Password) // equalize timing
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	case err != nil:
		internalError(w, r, "look up user", err)
		return
	}
	if !auth.CheckPassword(hash, req.Password) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	// Switching accounts from Profile logs in over a session that is still valid,
	// and startSession only overwrites the COOKIE — the old row would sit in the
	// sessions table until it expired, reachable by anyone who had the token.
	// Retire it here, after the password check, so a failed switch leaves the
	// session you are still using alone.
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		_ = s.Sessions.Delete(c.Value)
	}

	s.startSession(w, r, id, req.Username)
}

// startSession creates a session, sets the cookie, and writes {username}.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, id int64, uname string) {
	token, err := s.Sessions.Create(id)
	if err != nil {
		internalError(w, r, "create session", err)
		return
	}
	http.SetCookie(w, s.sessionCookie(token, int(auth.SessionLifetime.Seconds())))
	writeJSON(w, http.StatusOK, map[string]string{"username": uname})
}

// handleStatus is public: it tells the SPA whether first-run onboarding is
// still open (no users yet) so it can show the "create admin" screen. While it
// is, the kept backup archive (if an operator dropped one into <data>/backups)
// is surfaced too, so onboarding can offer restore-instead-of-signup — never
// afterwards, when backup existence is admin-only knowledge.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	var n int
	if err := s.Store.DB.QueryRow(`SELECT count(*) FROM users`).Scan(&n); err != nil {
		internalError(w, r, "count users", err)
		return
	}
	resp := map[string]any{"needs_onboarding": n == 0}
	if n == 0 {
		resp["backup"] = nil
		if name, info := s.newestBackup(); name != "" {
			// Includes how the archive is keyed, so onboarding can ask for the
			// right credential instead of guessing. For an account-keyed archive
			// that means the account NAME appears on an unauthenticated endpoint —
			// acceptable here and nowhere else: this branch only runs while the
			// users table is empty, the operator is the person who put the archive
			// there, and without the name they cannot be told whose password to
			// type. It stops being reported the moment an account exists.
			resp["backup"] = s.backupMetaAt(s.backupsDir(), name, info)
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleSignup creates the first user (the admin) during onboarding. It only
// succeeds while the users table is empty; afterwards the admin adds users
// in-app (PLAN §2). The insert is atomic, so concurrent onboarding requests
// can't create two admins.
func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "username and password required")
		return
	}
	// Rate-limit this unauthenticated route so it can't be used to pin CPU via
	// repeated bcrypt hashing during the (brief) onboarding window.
	if !s.loginLimiter.Allow(s.clientIP(r) + "|signup") {
		writeErr(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}
	uname, ok := normalizeUsername(req.Username)
	if !ok {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	if msg := passwordProblem(req.Password); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	// Serialize the whole check→hash→insert against an in-progress onboarding
	// restore (POST /auth/restore, which holds backupMu across its swap). Without
	// this, a signup could commit an admin during a slow restore that then swaps
	// the DB and discards it; the restore's late users-empty re-guard only closes
	// the race because a signup can't commit while the lock is held. TryLock so a
	// running restore returns a clean 409 instead of blocking for minutes.
	if !s.backupMu.TryLock() {
		writeErr(w, http.StatusConflict, "a restore is running; try again shortly")
		return
	}
	defer s.backupMu.Unlock()
	// Cheap check before the expensive hash: once any user exists onboarding is
	// closed, so don't spend bcrypt on a request we're going to reject.
	var exists bool
	if err := s.Store.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users)`).Scan(&exists); err != nil {
		internalError(w, r, "check for existing users", err)
		return
	}
	if exists {
		writeErr(w, http.StatusForbidden, "onboarding is closed; ask an admin to add you")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		internalError(w, r, "hash password", err)
		return
	}
	// The INSERT ... WHERE NOT EXISTS stays as the atomic guard: if a concurrent
	// signup won the race after the check above, this inserts nothing.
	res, err := s.Store.DB.Exec(
		`INSERT INTO users (username, password_hash, is_admin)
		 SELECT ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM users)`,
		uname, hash,
	)
	if err != nil {
		internalError(w, r, "create admin user", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusForbidden, "onboarding is closed; ask an admin to add you")
		return
	}
	id, _ := res.LastInsertId()
	if s.SeedNewUsers {
		seedDefaultTags(s.Store.DB, id) // starter tag/sticker vocabulary (v3)
	}
	s.startSession(w, r, id, uname)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		_ = s.Sessions.Delete(c.Value)
	}
	http.SetCookie(w, s.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	p, err := s.loadPrefs(userID(r))
	if err != nil {
		internalError(w, r, "load prefs", err)
		return
	}
	var avatar string
	_ = s.Store.DB.QueryRow(`SELECT avatar_path FROM users WHERE id = ?`, userID(r)).Scan(&avatar)
	writeJSON(w, http.StatusOK, map[string]any{
		"id":          userID(r),
		"username":    username(r),
		"is_admin":    isAdmin(r),
		"preferences": p,
		"avatar_path": avatar,
		"version":     buildinfo.Version, // running build, for the Settings → Updates card
		// releases_url points at the GitHub releases page for the configured repo
		// (honours TIPPANI_REPO) — the "version → changelog" link in Settings and
		// the mobile drawer. Pure string, no network call.
		"releases_url": "https://github.com/" + buildinfo.Repo() + "/releases",
	})
}

// handleUpdateMe changes the caller's own display name. The session stores only
// the user id and re-reads username/is_admin on each request (auth.Validate's
// JOIN), so the new name takes effect on the next request with no re-issue.
func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request")
		return
	}
	uname, ok := normalizeUsername(req.Username)
	if !ok {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	// Atomic uniqueness: rename only if no OTHER user holds the name. Setting it
	// to your own current name is a no-op that still reports success.
	res, err := s.Store.DB.Exec(
		`UPDATE users SET username = ? WHERE id = ?
		 AND NOT EXISTS (SELECT 1 FROM users WHERE username = ? AND id <> ?)`,
		uname, userID(r), uname, userID(r))
	if err != nil {
		internalError(w, r, "update username", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusConflict, "username already taken")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": uname})
}

// ---- UI preferences (§10; enums from the UI instructions §4) ----

var (
	prefAesthetics = map[string]bool{"paper": true, "film": true}
	prefThemes     = map[string]bool{"light": true, "dark": true, "system": true}
	prefAccents    = map[string]bool{"terracotta": true, "ochre": true, "olive": true, "slate": true}
	// The single-medium scopes, and the legacy aliases. "both" predates
	// standalone quotes and now means all three media — see scopeFlags.
	//
	// Any COMBINATION is also accepted, as a comma-separated list: the three
	// media are independent choices and this preference could only ever express
	// one of them or all of them. Someone who wanted books and quotes but not
	// films had no way to say so, and the Settings screen could not even send
	// "quotes" — it offered Books, Films & shows, and a third option labelled
	// "Both" that silently meant all three. See srScopeValid.
	srScopes = map[string]bool{"books": true, "movies": true, "screen": true, "quotes": true, "both": true}
	// tourStates — the guided feature tour's lifecycle ("" = never seen, so it
	// auto-opens once on first login; the UI never writes "" back).
	tourStates = map[string]bool{"": true, "done": true, "skipped": true, "postponed": true}
)

// defaultCreditSeps is the full roadmap separator set for multi-author
// credit splitting (see metadata.SplitCredits).
const defaultCreditSeps = "comma,semicolon,amp,and"

// normalizeCreditSeps canonicalizes the creditSeparators pref: "none"
// (splitting off), or a comma-separated subset of comma/semicolon/amp/and in
// canonical order. ok=false for empty or unknown tokens.
func normalizeCreditSeps(v string) (string, bool) {
	v = strings.TrimSpace(v)
	if strings.EqualFold(v, "none") {
		return "none", true
	}
	set := map[string]bool{}
	for _, tok := range strings.Split(v, ",") {
		t := strings.ToLower(strings.TrimSpace(tok))
		if t == "" {
			continue
		}
		switch t {
		case "comma", "semicolon", "amp", "and":
			set[t] = true
		default:
			return "", false
		}
	}
	if len(set) == 0 {
		return "", false
	}
	out := make([]string, 0, 4)
	for _, t := range []string{"comma", "semicolon", "amp", "and"} {
		if set[t] {
			out = append(out, t)
		}
	}
	return strings.Join(out, ","), true
}

// clampInt returns def when v is unset (0), else v bounded to [lo, hi].
func clampInt(v, lo, hi, def int) int {
	if v == 0 {
		return def
	}
	return max(lo, min(v, hi))
}

// clampFloat returns def when v is unset (0), else v bounded to [lo, hi].
func clampFloat(v, lo, hi, def float64) float64 {
	if v == 0 {
		return def
	}
	return max(lo, min(v, hi))
}

// prefs is the whole preference set. Retired keys — the pre-0.4 "home"
// start-page, the pre-0.7 "navUtilities" nav-placement toggle (Tags +
// Metadata are always in the navbar now), and the "srGrow"/"srShrink"
// half-life factors (the fixed interval ladder in review_handlers.go replaced
// the tunable update rule) — are dropped on read and on the next PUT.
type prefs struct {
	Aesthetic string `json:"aesthetic"`
	Theme     string `json:"theme"`
	Accent    string `json:"accent"`
	// CreditSeparators: which separators split a joined multi-author credit
	// ("Gaiman & Pratchett") into distinct people — a comma-separated subset
	// of {comma, semicolon, amp, and} in canonical order, or "none" to turn
	// splitting off. Unset (older rows) defaults to all four; libraries that
	// store authors as "Last, First" turn comma off.
	CreditSeparators string `json:"creditSeparators"`
	// Spaced repetition (v0.5.0 Daily Quiz & Practice), per-user, defaults +
	// clamps applied in loadPrefs. SRDaily (Daily Quiz deck size) is 2..10;
	// SRReviewScope bounds BOTH modes: one medium (books|movies|quotes), the
	// legacy "both" meaning all three, or any comma-separated combination of the
	// three — see scopeFlags. SRPracticeCounts
	// opts Practice into moving the schedule (off by default, so Practice is
	// study without distortion).
	SRDaily       int    `json:"srDaily"`
	SRReviewScope string `json:"srReviewScope"`
	// SRSeen is the "seeing" multiplier — practising (not skipping), sharing, or
	// favouriting a card lengthens its half-life marginally. 1.0 = off (default),
	// so this reinforcement is entirely opt-in.
	SRSeen           float64 `json:"srSeen"`
	SRPracticeCounts bool    `json:"srPracticeCounts"`
	// Guided feature tour (Settings → Onboarding). Tour is its lifecycle state
	// (see tourStates); "postponed" keeps TourStep as the 0-based step to resume
	// from — the Settings card shows a Resume button for it.
	Tour     string `json:"tour"`
	TourStep int    `json:"tourStep"`
	// Colour categories. A quote's colour is the one thing above tags in the
	// hierarchy — it is what KIND of note this is — and until now the four were
	// called yellow, blue, pink and orange, which describes a highlighter rather
	// than a thought.
	//
	// The stored TOKEN never changes. `color` stays yellow|blue|pink|orange in
	// every table, in every Markdown export, and in the import rule that reads a
	// missing colour as yellow. What is per-user is presentation: what slot N is
	// CALLED, what it LOOKS like, and whether it is offered at all.
	//
	// FLAT FIELDS, not a map or a slice, and not for style: ui_test.go declares a
	// mirror of this struct and compares it with !=, and a struct containing a
	// map is not comparable in Go. Four slots is also not a number that grows —
	// widening the palette means rebuilding four tables whose CHECK constraints
	// SQLite cannot alter, each an FK parent with cascading children and two of
	// them backing FTS5 indexes with live triggers. That is its own release.
	//
	// EVERY DEFAULT IS THE ZERO VALUE, deliberately. "" means "use the built-in",
	// which keeps the mirror comparisons in ui_test.go honest, and means an
	// account that has never opened the card stores nothing at all.
	//
	// SLOT 1 IS NOT A CATEGORY and cannot be named or hidden. It is the DEFAULT:
	// the column default is 'yellow' and an import with no colour writes 'yellow'
	// too, so a yellow quote may be yellow because someone chose it or because
	// nobody chose anything. Naming it "Inspirational" would silently relabel
	// every unmarked quote ever imported. Its colour is presentation and stays
	// editable.
	CatName1   string `json:"catName1"`
	CatName2   string `json:"catName2"`
	CatName3   string `json:"catName3"`
	CatName4   string `json:"catName4"`
	CatName5   string `json:"catName5"`
	CatName6   string `json:"catName6"`
	CatColor1  string `json:"catColor1"`
	CatColor2  string `json:"catColor2"`
	CatColor3  string `json:"catColor3"`
	CatColor4  string `json:"catColor4"`
	CatColor5  string `json:"catColor5"`
	CatColor6  string `json:"catColor6"`
	CatHidden1 bool   `json:"catHidden1"`
	CatHidden2 bool   `json:"catHidden2"`
	CatHidden3 bool   `json:"catHidden3"`
	CatHidden4 bool   `json:"catHidden4"`
	CatHidden5 bool   `json:"catHidden5"`
	CatHidden6 bool   `json:"catHidden6"`
}

// catSlots is how many colour categories exist, and it is not a number this file
// gets to choose: it must match annotationColors, because a slot with no token
// is a name for a colour nothing can be. 0029 took it from four to six by
// rebuilding four tables to widen a CHECK SQLite cannot alter, so the next
// change to this constant is another migration, not an edit here.
const catSlots = 6

// catNameMax bounds a category name, in runes. Five words is the house rule for
// a label, and these ARE labels — they ride a swatch tooltip, a filter chip and a
// group heading, none of which has room for a sentence.
//
// Fifteen, down from twenty-four. Twenty-four was a number nothing on the client
// was built to hold: the Stats breakdown's label column ellipsised anything past
// about seventeen characters, which is a chart truncating the categories it is
// breaking down. The column is now cut to hold a full-length name, and this is
// the length it is cut for — so the cap and the layout agree instead of one
// apologising for the other. Every built-in name fits with room over.
//
// LOWERING A CAP IS NOT RETROACTIVE. Rows stored under the old limit are still in
// the database and are still served; nothing here rewrites them, because a
// preferences read is not the place to edit somebody's data. The client caps on
// the way in (capCategoryName in theme.js), so an over-long name displays capped
// everywhere at once and the next save it makes writes the capped value back.
const catNameMax = 15

// accentHexes is what a category colour may not be. The rule is that a category
// colour can never be mistaken for the app's own accent, and an exact match is
// the case worth refusing outright — the curated swatch list the picker offers
// stays clear of the neighbourhood as well, and a frontend test holds it there.
var accentHexes = map[string]bool{
	"#b4482d": true, // terracotta
	"#c8992b": true, // ochre
	"#3f7d5a": true, // olive
	"#2f6d8f": true, // slate
}

// catColorsValid checks every slot. A loop rather than a chain of ||, because a
// chain is where the fifth and sixth slots would have been forgotten.
func catColorsValid(p *prefs) bool {
	for _, c := range catColorPtrs(p) {
		if !catColorValid(*c) {
			return false
		}
	}
	return true
}

// normalizeCats drops anything a category slot may not hold, on READ as well as
// on write. The write path already refuses these, so this is about the row that
// did not come through it: a restored archive, a hand-edited database, or a
// preference written by a version that allowed something this one does not.
//
// Slot 1 is forced back to unnamed and visible every time. It is the DEFAULT
// colour — the column default and what an import with no colour writes — so a
// name on it is a claim about quotes nobody categorised, and hiding it would
// hide the bucket most quotes are in.
func normalizeCats(p *prefs) {
	p.CatName1 = ""
	p.CatHidden1 = false
	names := catNamePtrs(p)
	colors := catColorPtrs(p)
	for i := range names {
		// A stored value that no longer passes is cleared to "" — the built-in —
		// rather than truncated or kept. Every other field in loadPrefs falls back
		// to its default the same way, and a name silently cut in half is worse
		// than the name the app came with.
		if n, ok := trimCap(*names[i], catNameMax); ok {
			*names[i] = n
		} else {
			*names[i] = ""
		}
		if !catColorValid(*colors[i]) {
			*colors[i] = ""
		}
	}
}

// The three slot lists, in one place each. Flat FIELDS because ui_test.go
// compares the whole struct with != and a struct holding a map is not
// comparable; flat ACCESSORS because everything downstream wants to loop, and
// six hand-written repetitions of the same line is where a slot gets missed.
func catNamePtrs(p *prefs) []*string {
	return []*string{&p.CatName1, &p.CatName2, &p.CatName3, &p.CatName4, &p.CatName5, &p.CatName6}
}
func catColorPtrs(p *prefs) []*string {
	return []*string{&p.CatColor1, &p.CatColor2, &p.CatColor3, &p.CatColor4, &p.CatColor5, &p.CatColor6}
}
func catHiddenPtrs(p *prefs) []*bool {
	return []*bool{&p.CatHidden1, &p.CatHidden2, &p.CatHidden3, &p.CatHidden4, &p.CatHidden5, &p.CatHidden6}
}

// catColorValid accepts "" (use the built-in) or a six-digit hex that is not one
// of the theme accents.
//
// The SERVER does not hold the curated palette. The picker is a curated set of
// swatches because free hex entry produces libraries nobody can read, but that
// is an affordance rather than a data rule — and putting the list here would
// mean two copies of sixteen constants, which is the shape everything else in
// this release has been pulling apart. What the server owes is that the value is
// a colour and is not an accent.
func catColorValid(v string) bool {
	if v == "" {
		return true
	}
	if len(v) != 7 || v[0] != '#' {
		return false
	}
	for _, r := range v[1:] {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f' || r >= 'A' && r <= 'F') {
			return false
		}
	}
	return !accentHexes[strings.ToLower(v)]
}

// loadPrefs reads users.preferences and applies defaults for anything unset:
// theme "system", accent "terracotta", and aesthetic per theme — dark defaults
// to film, everything else to paper (instructions §4).
func (s *Server) loadPrefs(uid int64) (prefs, error) {
	var raw string
	if err := s.Store.DB.QueryRow(
		`SELECT preferences FROM users WHERE id = ?`, uid).Scan(&raw); err != nil {
		return prefs{}, err
	}
	var p prefs
	_ = json.Unmarshal([]byte(raw), &p) // bad stored JSON -> all defaults
	if !prefThemes[p.Theme] {
		p.Theme = "system"
	}
	if !prefAccents[p.Accent] {
		p.Accent = "terracotta"
	}
	if !prefAesthetics[p.Aesthetic] {
		if p.Theme == "dark" {
			p.Aesthetic = "film"
		} else {
			p.Aesthetic = "paper"
		}
	}
	if norm, ok := normalizeCreditSeps(p.CreditSeparators); ok {
		p.CreditSeparators = norm
	} else {
		p.CreditSeparators = defaultCreditSeps
	}
	p.SRDaily = clampInt(p.SRDaily, 2, 10, reviewQuota)
	if !srScopeValid(p.SRReviewScope) {
		p.SRReviewScope = "both"
	}
	p.SRSeen = clampFloat(p.SRSeen, 1.0, 1.5, reviewSeen)
	if !tourStates[p.Tour] {
		p.Tour = ""
	}
	normalizeCats(&p)
	if p.TourStep < 0 || p.TourStep > 99 {
		p.TourStep = 0
	}
	return p, nil
}

// handleUpdatePreferences is a partial update: it loads the current set, overlays
// only the fields present in the body, validates, and stores. So the Appearance
// panel and the spaced-repetition card can each PUT just their own field(s)
// without clobbering the other's. Any appearance field it does receive is a
// required enum; the rest are optional (empty = leave as-is, so older clients
// that don't know a field aren't rejected).
func (s *Server) handleUpdatePreferences(w http.ResponseWriter, r *http.Request) {
	cur, err := s.loadPrefs(userID(r))
	if err != nil {
		internalError(w, r, "load prefs", err)
		return
	}
	var in struct {
		Aesthetic        *string  `json:"aesthetic"`
		Theme            *string  `json:"theme"`
		Accent           *string  `json:"accent"`
		CreditSeparators *string  `json:"creditSeparators"`
		SRDaily          *int     `json:"srDaily"`
		SRReviewScope    *string  `json:"srReviewScope"`
		SRSeen           *float64 `json:"srSeen"`
		SRPracticeCounts *bool    `json:"srPracticeCounts"`
		Tour             *string  `json:"tour"`
		TourStep         *int     `json:"tourStep"`
		// Pointer-typed like the rest, and for the same reason: a client sending
		// one field must not clear the others. Unlike the rest, an EMPTY name or
		// colour is a real value here — it means "back to the built-in" — so
		// these cannot use the `!= ""` shorthand the older string fields use.
		CatName1   *string `json:"catName1"`
		CatName2   *string `json:"catName2"`
		CatName3   *string `json:"catName3"`
		CatName4   *string `json:"catName4"`
		CatName5   *string `json:"catName5"`
		CatName6   *string `json:"catName6"`
		CatColor1  *string `json:"catColor1"`
		CatColor2  *string `json:"catColor2"`
		CatColor3  *string `json:"catColor3"`
		CatColor4  *string `json:"catColor4"`
		CatColor5  *string `json:"catColor5"`
		CatColor6  *string `json:"catColor6"`
		CatHidden1 *bool   `json:"catHidden1"`
		CatHidden2 *bool   `json:"catHidden2"`
		CatHidden3 *bool   `json:"catHidden3"`
		CatHidden4 *bool   `json:"catHidden4"`
		CatHidden5 *bool   `json:"catHidden5"`
		CatHidden6 *bool   `json:"catHidden6"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	if in.Aesthetic != nil {
		cur.Aesthetic = *in.Aesthetic
	}
	if in.Theme != nil {
		cur.Theme = *in.Theme
	}
	if in.Accent != nil {
		cur.Accent = *in.Accent
	}
	// Optional fields: an empty/zero value means "leave unchanged", so a client
	// PUTting only one field (or an older client omitting the newer ones) is
	// neither rejected nor allowed to clobber the rest.
	// creditSeparators validates here rather than in the switch below — the
	// stored form is the normalized one ("none", or a canonical-order token
	// list), so a bad value must be rejected before it can be canonicalized.
	if in.CreditSeparators != nil && *in.CreditSeparators != "" {
		norm, ok := normalizeCreditSeps(*in.CreditSeparators)
		if !ok {
			writeErr(w, http.StatusBadRequest,
				`creditSeparators must be "none" or a comma-separated subset of comma, semicolon, amp, and`)
			return
		}
		cur.CreditSeparators = norm
	}
	// Category slots. Set before the validation switch so a bad value is caught
	// there rather than normalised into something the caller did not ask for.
	catNameTooLong := false
	inNames := []*string{in.CatName1, in.CatName2, in.CatName3, in.CatName4, in.CatName5, in.CatName6}
	inColors := []*string{in.CatColor1, in.CatColor2, in.CatColor3, in.CatColor4, in.CatColor5, in.CatColor6}
	inHidden := []*bool{in.CatHidden1, in.CatHidden2, in.CatHidden3, in.CatHidden4, in.CatHidden5, in.CatHidden6}
	curNames, curColors, curHidden := catNamePtrs(&cur), catColorPtrs(&cur), catHiddenPtrs(&cur)
	for i := 0; i < catSlots; i++ {
		if inNames[i] != nil {
			// Refused, not truncated. Every other short free-text field on this
			// server rejects an over-long value rather than storing a cut-off
			// one, and a name that comes back shorter than you typed it is a
			// worse answer than being told it does not fit.
			n, ok := trimCap(*inNames[i], catNameMax)
			if !ok {
				catNameTooLong = true
			}
			*curNames[i] = n
		}
		if inColors[i] != nil {
			*curColors[i] = strings.TrimSpace(*inColors[i])
		}
		if inHidden[i] != nil {
			*curHidden[i] = *inHidden[i]
		}
	}
	if in.SRDaily != nil && *in.SRDaily != 0 {
		cur.SRDaily = *in.SRDaily
	}
	if in.SRReviewScope != nil && *in.SRReviewScope != "" {
		cur.SRReviewScope = *in.SRReviewScope
	}
	if in.SRSeen != nil && *in.SRSeen != 0 {
		cur.SRSeen = *in.SRSeen
	}
	// A bool has no "empty" sentinel, so presence is the pointer being non-nil.
	if in.SRPracticeCounts != nil {
		cur.SRPracticeCounts = *in.SRPracticeCounts
	}
	if in.Tour != nil && *in.Tour != "" {
		cur.Tour = *in.Tour
	}
	// Step 0 is a real resume point (postponed on the welcome step), so presence
	// is the signal here too — not the zero-value guard the other ints use.
	if in.TourStep != nil {
		cur.TourStep = *in.TourStep
	}
	switch {
	case !prefAesthetics[cur.Aesthetic]:
		writeErr(w, http.StatusBadRequest, "aesthetic must be paper or film")
		return
	case !prefThemes[cur.Theme]:
		writeErr(w, http.StatusBadRequest, "theme must be light, dark or system")
		return
	case !prefAccents[cur.Accent]:
		writeErr(w, http.StatusBadRequest, "accent must be terracotta, ochre, olive or slate")
		return
	case cur.SRDaily < 2 || cur.SRDaily > 10:
		writeErr(w, http.StatusBadRequest, "srDaily must be between 2 and 10")
		return
	case catNameTooLong:
		writeErr(w, http.StatusBadRequest,
			fmt.Sprintf("a category name must be %d characters or fewer", catNameMax))
		return
	case cur.CatName1 != "":
		writeErr(w, http.StatusBadRequest,
			"the first colour is the default one quotes get when nobody chooses, so it cannot be named")
		return
	case cur.CatHidden1:
		writeErr(w, http.StatusBadRequest,
			"the first colour is the default one quotes get when nobody chooses, so it cannot be hidden")
		return
	case !catColorsValid(&cur):
		writeErr(w, http.StatusBadRequest,
			"a category colour must be a #rrggbb hex, and not one of the theme accents")
		return
	case !srScopeValid(cur.SRReviewScope):
		writeErr(w, http.StatusBadRequest, "srReviewScope must be books, movies, quotes or both, or a comma-separated combination")
		return
	case cur.SRSeen < 1.0 || cur.SRSeen > 1.5:
		writeErr(w, http.StatusBadRequest, "srSeen must be between 1.0 and 1.5")
		return
	case !tourStates[cur.Tour]:
		writeErr(w, http.StatusBadRequest, "tour must be done, skipped or postponed")
		return
	case cur.TourStep < 0 || cur.TourStep > 99:
		writeErr(w, http.StatusBadRequest, "tourStep must be between 0 and 99")
		return
	}
	raw, err := json.Marshal(cur)
	if err != nil {
		internalError(w, r, "marshal prefs", err)
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE users SET preferences = ? WHERE id = ?`, string(raw), userID(r)); err != nil {
		internalError(w, r, "save prefs", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	var req struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request")
		return
	}
	if msg := passwordProblem(req.New); msg != "" {
		writeErr(w, http.StatusBadRequest, "new "+msg)
		return
	}
	var hash string
	if err := s.Store.DB.QueryRow(
		`SELECT password_hash FROM users WHERE id = ?`, userID(r),
	).Scan(&hash); err != nil {
		internalError(w, r, "load password hash", err)
		return
	}
	if !auth.CheckPassword(hash, req.Current) {
		writeErr(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}
	newHash, err := auth.HashPassword(req.New)
	if err != nil {
		internalError(w, r, "hash password", err)
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE users SET password_hash = ? WHERE id = ?`, newHash, userID(r),
	); err != nil {
		internalError(w, r, "update password", err)
		return
	}
	// Revoke every existing session for this user (a leaked cookie must not
	// survive a password change), then re-issue one for the current caller so
	// changing your own password doesn't log you out.
	if err := s.Sessions.DeleteAllForUser(userID(r)); err != nil {
		internalError(w, r, "revoke sessions", err)
		return
	}
	token, err := s.Sessions.Create(userID(r))
	if err != nil {
		internalError(w, r, "create session", err)
		return
	}
	http.SetCookie(w, s.sessionCookie(token, int(auth.SessionLifetime.Seconds())))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Password shape (1.4.1). The upper bound used to be bcrypt's own 72-byte limit,
// validated only so a long password returned a clean 400 instead of a 500 out of
// HashPassword. It is 20 CHARACTERS now, and the alphabet is printable ASCII, for
// a reason beyond taste: a password is also a backup-archive passphrase (see
// backup_crypto.go), so it has to survive being typed on a phone keyboard, on
// another machine's keyboard, and possibly months later on a fresh install where
// getting it wrong means the archive does not open. Diacritics and non-Latin
// input are exactly what does not survive that trip — the same glyph can arrive
// as one code point or as two, and the bytes that get hashed differ.
const (
	minPasswordChars = 8
	maxPasswordChars = 20
)

// asciiPrintable reports whether every byte is in the printable ASCII range
// (0x20 space through 0x7E "~"). A multi-byte UTF-8 sequence necessarily has a
// byte ≥ 0x80, so scanning bytes rejects every non-ASCII rune without decoding.
func asciiPrintable(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] < 0x20 || s[i] > 0x7e {
			return false
		}
	}
	return true
}

func passwordProblem(pw string) string {
	switch {
	case len(pw) < minPasswordChars:
		return "password must be at least 8 characters"
	// Length in BYTES is the right check given asciiPrintable below: for ASCII
	// the two are the same, and a non-ASCII password is refused outright.
	case len(pw) > maxPasswordChars:
		return "password must be at most 20 characters"
	case !asciiPrintable(pw):
		return "password may use letters, digits and punctuation only — no accents or non-Latin characters"
	}
	return ""
}

func (s *Server) sessionCookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}
