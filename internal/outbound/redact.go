package outbound

import (
	"net/url"
	"regexp"
	"strings"
)

// WHAT A URL MAY SHOW IN A LOG. The logs are kept now — in the database, for
// thirty days, exported as Markdown and handed to whoever the operator asks for
// help — so a provider key in a request line or in an error's text is a key
// published. Two providers carry theirs in the query string (Google Books' key=,
// TMDB v3's api_key=); the rest travel in a header or a POST body and never reach
// a URL. The list below is wider than those two on purpose: the names an OAuth
// flow, a signed link or a hand-rolled API puts a secret under, so the next
// provider is covered before anybody remembers to add it.
//
// IT LIVES HERE, NOT IN THE LOGBOOK, because this package is the leaf every
// outward call already passes through and every logger can import: the jobs
// package's one door for log text uses it, and metadata's own trace lines are to
// join it (its redactURL is the older, two-name copy of this list), so there is
// one list and not three.

// secretParams are the query names whose values never reach a log. Compared
// case-insensitively. cx is deliberately absent: it is a Custom Search engine id,
// not a secret, and the one thing a reader debugging a search needs to see.
var secretParams = map[string]bool{
	"key": true, "api_key": true, "apikey": true, "api-key": true,
	"token": true, "access_token": true, "refresh_token": true, "id_token": true,
	"client_secret": true, "secret": true,
	"password": true, "passwd": true, "pass": true,
	"sig": true, "signature": true, "auth": true, "code": true,
}

// hidden is what a secret's value becomes. One character that cannot be mistaken
// for a real value, and not asterisks, which some keys contain.
const hidden = "…"

// Redact hides the secrets in one URL: the value of every query parameter named
// in secretParams becomes "…", and any user:password@ before the host is dropped.
// Everything else is left byte for byte — the order, the escaping, the fragment —
// because the rest of a URL is exactly what a reader needs to tell two failed
// lookups apart. An empty value stays empty: "key=" says the key was never set,
// which is worth reading, and hides nothing.
//
// It works on the text rather than through url.Parse, so a URL too broken to
// parse is still redacted rather than returned whole, and a fragment's pairs
// (#access_token=, as an implicit OAuth redirect writes them) are treated like
// the query's.
func Redact(raw string) string {
	s := dropUserinfo(raw)
	q := strings.IndexByte(s, '?')
	f := strings.IndexByte(s, '#')
	switch {
	case q >= 0 && (f < 0 || q < f):
		end := len(s)
		if f > q {
			end = f
		}
		out := s[:q+1] + redactPairs(s[q+1:end])
		if f > q {
			out += "#" + redactPairs(s[f+1:])
		}
		return out
	case f >= 0:
		return s[:f+1] + redactPairs(s[f+1:])
	}
	return s
}

// dropUserinfo removes "user:password@" from the authority. Only the authority
// is looked at: an @ later in the path or the query is data.
func dropUserinfo(s string) string {
	i := strings.Index(s, "://")
	if i < 0 {
		return s
	}
	start := i + 3
	end := len(s)
	if j := strings.IndexAny(s[start:], "/?#"); j >= 0 {
		end = start + j
	}
	if at := strings.LastIndexByte(s[start:end], '@'); at >= 0 {
		return s[:start] + s[start+at+1:]
	}
	return s
}

// redactPairs hides the values of the secret names in an &-separated list of
// name=value pairs, leaving every other pair as it was written.
func redactPairs(q string) string {
	if q == "" {
		return q
	}
	pairs := strings.Split(q, "&")
	changed := false
	for i, p := range pairs {
		eq := strings.IndexByte(p, '=')
		if eq < 0 || eq == len(p)-1 {
			continue
		}
		name := p[:eq]
		if n, err := url.QueryUnescape(name); err == nil {
			name = n
		}
		if secretParams[strings.ToLower(name)] {
			pairs[i] = p[:eq+1] + hidden
			changed = true
		}
	}
	if !changed {
		return q
	}
	return strings.Join(pairs, "&")
}

// urlShaped is what RedactText treats as a URL: a scheme, then everything up to
// whitespace, a quote or an angle bracket. Go's own *url.Error quotes the URL
// (`Get "https://…": dial tcp …`), so the quote is where one ends in the text
// this mostly sees.
var urlShaped = regexp.MustCompile(`(?i)https?://[^\s"'<>]+`)

// RedactText runs Redact over every URL-shaped substring of s: a provider's error
// text, a request line, anything a log is about to keep. Text with no URL in it
// is returned as it came, without a regexp pass.
func RedactText(s string) string {
	if !strings.Contains(s, "://") {
		return s
	}
	return urlShaped.ReplaceAllStringFunc(s, Redact)
}
