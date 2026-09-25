package auth

// OpenID Connect sign-in: the authorization-code flow with PKCE, stdlib only.
//
// NO JWT LIBRARY, AND THE ID TOKEN'S SIGNATURE IS NOT CHECKED — ON PURPOSE AND
// BY THE SPEC. The ID token here never passes through the browser: it comes back
// in the response to a POST this server makes to the provider's token endpoint.
// OpenID Connect Core 1.0 §3.1.3.7 step 6 allows exactly that case to rely on
// TLS server validation instead of the JWS signature. What IS checked is every
// claim that binds the token to this login — iss, aud, azp, exp and nonce — which
// the spec requires regardless of how the token arrived. A JWKS fetcher and an
// RSA/ECDSA verifier would add a key cache and a rotation story to defend a hop
// that TLS already defends.
//
// THE PROVIDER IS THE OPERATOR'S OWN, so its client is not gated by
// TIPPANI_OFFLINE (see internal/outbound's `ungated`): switching the app
// offline must not lock every account out of an Authelia on the same LAN.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// OIDC is one configured provider. The zero value is "not configured".
type OIDC struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	// RedirectURL is the callback the provider sends the browser back to. Empty
	// means the handler derives it from the request, which is right unless a
	// proxy rewrites the host.
	RedirectURL string
	// Name labels the sign-in button ("Authelia", "Authentik"…).
	Name string
	// Scopes beyond "openid". Empty means "profile email".
	Scopes []string

	Client *http.Client // nil means the package default below

	mu   sync.Mutex
	disc *oidcDiscovery
	at   time.Time
}

type oidcDiscovery struct {
	Issuer                string   `json:"issuer"`
	AuthorizationEndpoint string   `json:"authorization_endpoint"`
	TokenEndpoint         string   `json:"token_endpoint"`
	UserinfoEndpoint      string   `json:"userinfo_endpoint"`
	TokenAuthMethods      []string `json:"token_endpoint_auth_methods_supported"`
}

// Claims are the ID-token claims the app uses once they have been validated.
type Claims struct {
	Subject           string // "issuer|sub" — the stored link key
	PreferredUsername string
	Email             string
	Name              string
}

// Enabled reports whether enough is configured to offer the button.
func (o *OIDC) Enabled() bool {
	return o != nil && o.Issuer != "" && o.ClientID != ""
}

var oidcDefaultClient = &http.Client{Timeout: 15 * time.Second}

func (o *OIDC) client() *http.Client {
	if o.Client != nil {
		return o.Client
	}
	return oidcDefaultClient
}

// discovery fetches and caches the provider's metadata for an hour, so a
// provider that moves an endpoint is picked up without a restart.
func (o *OIDC) discovery(ctx context.Context) (*oidcDiscovery, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.disc != nil && time.Since(o.at) < time.Hour {
		return o.disc, nil
	}
	u := strings.TrimRight(o.Issuer, "/") + "/.well-known/openid-configuration"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := o.client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oidc discovery: %s answered %d", u, resp.StatusCode)
	}
	var d oidcDiscovery
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&d); err != nil {
		return nil, fmt.Errorf("oidc discovery: %w", err)
	}
	// §4.3: the issuer in the document MUST be the one it was fetched for. A
	// trailing slash is the one difference providers disagree about.
	if strings.TrimRight(d.Issuer, "/") != strings.TrimRight(o.Issuer, "/") {
		return nil, fmt.Errorf("oidc discovery: issuer %q does not match configured %q", d.Issuer, o.Issuer)
	}
	if d.AuthorizationEndpoint == "" || d.TokenEndpoint == "" {
		return nil, errors.New("oidc discovery: endpoints missing")
	}
	o.disc, o.at = &d, time.Now()
	return &d, nil
}

// OIDCLogin is one login in flight: what the callback must see again.
type OIDCLogin struct {
	State, Nonce, Verifier, RedirectURL string
}

func randomURLToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Begin returns the provider URL to send the browser to, and the values the
// callback must be checked against.
func (o *OIDC) Begin(ctx context.Context, redirectURL string) (string, OIDCLogin, error) {
	d, err := o.discovery(ctx)
	if err != nil {
		return "", OIDCLogin{}, err
	}
	var l OIDCLogin
	for _, p := range []*string{&l.State, &l.Nonce, &l.Verifier} {
		if *p, err = randomURLToken(); err != nil {
			return "", OIDCLogin{}, err
		}
	}
	l.RedirectURL = redirectURL
	sum := sha256.Sum256([]byte(l.Verifier))
	scopes := o.Scopes
	if len(scopes) == 0 {
		scopes = []string{"profile", "email"}
	}
	q := url.Values{
		"response_type":         {"code"},
		"client_id":             {o.ClientID},
		"redirect_uri":          {redirectURL},
		"scope":                 {"openid " + strings.Join(scopes, " ")},
		"state":                 {l.State},
		"nonce":                 {l.Nonce},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(sum[:])},
		"code_challenge_method": {"S256"},
	}
	sep := "?"
	if strings.Contains(d.AuthorizationEndpoint, "?") {
		sep = "&"
	}
	return d.AuthorizationEndpoint + sep + q.Encode(), l, nil
}

// Finish exchanges the code and validates the ID token against the login.
func (o *OIDC) Finish(ctx context.Context, l OIDCLogin, code string) (Claims, error) {
	d, err := o.discovery(ctx)
	if err != nil {
		return Claims{}, err
	}
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {l.RedirectURL},
		"code_verifier": {l.Verifier},
	}
	// client_secret_basic is the spec's default (Core §9); post is used only
	// when the provider says basic is not on offer.
	basic := len(d.TokenAuthMethods) == 0
	for _, m := range d.TokenAuthMethods {
		if m == "client_secret_basic" {
			basic = true
		}
	}
	if !basic || o.ClientSecret == "" {
		form.Set("client_id", o.ClientID)
		if o.ClientSecret != "" {
			form.Set("client_secret", o.ClientSecret)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.TokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return Claims{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	if basic && o.ClientSecret != "" {
		// RFC 6749 §2.3.1: both halves are form-encoded before Basic.
		req.SetBasicAuth(url.QueryEscape(o.ClientID), url.QueryEscape(o.ClientSecret))
	}
	resp, err := o.client().Do(req)
	if err != nil {
		return Claims{}, fmt.Errorf("oidc token: %w", err)
	}
	defer resp.Body.Close()
	var tok struct {
		IDToken     string `json:"id_token"`
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Desc        string `json:"error_description"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&tok); err != nil {
		return Claims{}, fmt.Errorf("oidc token: %d, %w", resp.StatusCode, err)
	}
	if resp.StatusCode != http.StatusOK || tok.IDToken == "" {
		return Claims{}, fmt.Errorf("oidc token: %d %s %s", resp.StatusCode, tok.Error, tok.Desc)
	}
	c, sub, err := o.validate(tok.IDToken, l.Nonce, time.Now())
	if err != nil {
		return Claims{}, err
	}
	// NAMES MAY NOT BE IN THE ID TOKEN. Several providers (Authelia's default
	// claims policy among them) put only the identity in it and serve
	// preferred_username and email from userinfo. The link key needs neither,
	// but auto-create and username linking do, so ask once when both are absent.
	if c.PreferredUsername == "" && c.Email == "" && tok.AccessToken != "" && d.UserinfoEndpoint != "" {
		o.fillFromUserinfo(ctx, d.UserinfoEndpoint, tok.AccessToken, sub, &c)
	}
	return c, nil
}

// fillFromUserinfo copies the name claims from the userinfo endpoint. Best
// effort: a failure leaves the claims as they were. Core §5.3.2: the answer's
// sub MUST equal the ID token's, or it is about somebody else and is ignored.
func (o *OIDC) fillFromUserinfo(ctx context.Context, endpoint, accessToken, sub string, c *Claims) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := o.client().Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	var u struct {
		Sub               string `json:"sub"`
		PreferredUsername string `json:"preferred_username"`
		Email             string `json:"email"`
		Name              string `json:"name"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&u) != nil || u.Sub != sub {
		return
	}
	c.PreferredUsername, c.Email = u.PreferredUsername, u.Email
	if c.Name == "" {
		c.Name = u.Name
	}
}

// audience is a string or an array of strings (Core §2).
type audience []string

func (a *audience) UnmarshalJSON(b []byte) error {
	var one string
	if json.Unmarshal(b, &one) == nil {
		*a = audience{one}
		return nil
	}
	var many []string
	if err := json.Unmarshal(b, &many); err != nil {
		return err
	}
	*a = many
	return nil
}

// validate returns the claims and the raw sub (the userinfo check needs it).
func (o *OIDC) validate(idToken, nonce string, now time.Time) (Claims, string, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return Claims{}, "", errors.New("oidc: id_token is not a JWT")
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return Claims{}, "", fmt.Errorf("oidc: id_token payload: %w", err)
	}
	var c struct {
		Iss               string   `json:"iss"`
		Sub               string   `json:"sub"`
		Aud               audience `json:"aud"`
		Azp               string   `json:"azp"`
		Exp               float64  `json:"exp"`
		Nonce             string   `json:"nonce"`
		PreferredUsername string   `json:"preferred_username"`
		Email             string   `json:"email"`
		Name              string   `json:"name"`
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		return Claims{}, "", fmt.Errorf("oidc: id_token claims: %w", err)
	}
	switch {
	case strings.TrimRight(c.Iss, "/") != strings.TrimRight(o.Issuer, "/"):
		return Claims{}, "", fmt.Errorf("oidc: issuer %q is not %q", c.Iss, o.Issuer)
	case c.Sub == "":
		return Claims{}, "", errors.New("oidc: id_token has no sub")
	case !contains(c.Aud, o.ClientID):
		return Claims{}, "", errors.New("oidc: id_token is not for this client")
	case len(c.Aud) > 1 && c.Azp != "" && c.Azp != o.ClientID:
		return Claims{}, "", errors.New("oidc: id_token azp is another client")
	case c.Exp == 0 || now.After(time.Unix(int64(c.Exp), 0).Add(time.Minute)):
		return Claims{}, "", errors.New("oidc: id_token expired")
	case !ConstantTimeEqual(c.Nonce, nonce):
		return Claims{}, "", errors.New("oidc: nonce mismatch")
	}
	return Claims{
		Subject:           strings.TrimRight(c.Iss, "/") + "|" + c.Sub,
		PreferredUsername: c.PreferredUsername,
		Email:             c.Email,
		Name:              c.Name,
	}, c.Sub, nil
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
