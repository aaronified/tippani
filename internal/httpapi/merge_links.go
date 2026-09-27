package httpapi

import (
	"errors"
	"maps"
	"net/url"
	"regexp"
	"strings"
)

// A RECORD'S LINKS ARE ONE FREE-TEXT FIELD, and a fetch folds what it found into
// it. This is that fold, and the reader of the field it rewrites.
//
// The field is lines of addresses, whitespace-separated as it has always been, and
// a line may end in ` | Name`: the reader's name for the last address on it. A
// pipe cannot appear in an address, so a line with one reads the new way and a
// line with none reads exactly as it always did. people.jsx's parseLinks reads the
// field the same way for every screen that draws it.
//
// THE FOLD IS THE BROWSER'S, as people.jsx's mergeLinks, ported for the routes
// that fold on the server: a person's Fetch by id (POST /people/id/{id}/fetch,
// the function the people job loops) and a person's re-verify. The
// People row in the SPA still folds in the browser, with mergeLinks, until it
// moves onto the Fetch route with the Jobs screen. The Go fold that already
// existed, for the re-verify, split the field on whitespace: `https://… | The
// other one` came back as five links — the address, `|`, `The`, `other`, `one` —
// and the apply wrote them, so a re-verify erased every name on the record it
// was asked to check. The browser's rules are the ones ported, and both server
// callers use them.

// linkProviders recognises a link's provider by its host, first match wins, in
// the order a record's links are written back. The same list, in the same order,
// as PROVIDERS in people.jsx: a slug missing here is a fetched link the fold
// drops (a studio's IGDB page, for one) and a stored one it moves to the end.
var linkProviders = []struct {
	slug string
	re   *regexp.Regexp
}{
	{"imdb", regexp.MustCompile(`(?i)(^|\.)imdb\.com$`)},
	{"tmdb", regexp.MustCompile(`(?i)(^|\.)themoviedb\.org$`)},
	{"tvdb", regexp.MustCompile(`(?i)(^|\.)thetvdb\.com$`)},
	{"letterboxd", regexp.MustCompile(`(?i)(^|\.)letterboxd\.com$`)},
	{"igdb", regexp.MustCompile(`(?i)(^|\.)igdb\.com$`)},
	{"wikipedia", regexp.MustCompile(`(?i)(^|\.)wikipedia\.org$`)},
	{"fandom", regexp.MustCompile(`(?i)(^|\.)(fandom|wikia)\.com$`)},
	{"wikidata", regexp.MustCompile(`(?i)(^|\.)wikidata\.org$`)},
	{"wikimedia", regexp.MustCompile(`(?i)(^|\.)wikimedia\.org$`)},
	{"openlibrary", regexp.MustCompile(`(?i)(^|\.)openlibrary\.org$`)},
	{"google", regexp.MustCompile(`(?i)(^|\.)books\.google\.[a-z.]+$`)},
	{"amazon", regexp.MustCompile(`(?i)(^|\.)amazon\.[a-z.]+$`)},
}

// linkLabelSep introduces a link's name on its line.
const linkLabelSep = "|"

// linkLine writes one link back: the address, and its name when it has one. The
// one writer, so a name cannot be stored two ways.
func linkLine(address, label string) string {
	if name := strings.TrimSpace(label); name != "" {
		return address + " " + linkLabelSep + " " + name
	}
	return address
}

// parsedLinks is a links field read: the provider pages (slug → address, the
// first per provider), everything else in the order it was written, and the
// names the reader gave any of them (address → name; absent where none).
type parsedLinks struct {
	known  map[string]string
	extra  []string
	labels map[string]string
}

// parseLinks reads a links field as parseLinks in people.jsx does.
func parseLinks(text string) parsedLinks {
	p := parsedLinks{known: map[string]string{}, labels: map[string]string{}}
	take := func(tok, label string) {
		host, ok := linkHost(tok)
		if !ok {
			// Not an address at all. Kept rather than dropped, but not named: a
			// name names a link, and this is not one.
			p.extra = append(p.extra, tok)
			return
		}
		if slug := linkProvider(host); slug != "" && p.known[slug] == "" {
			p.known[slug] = tok
		} else {
			p.extra = append(p.extra, tok)
		}
		if label != "" {
			p.labels[tok] = label
		}
	}
	for _, line := range strings.Split(text, "\n") {
		head, label, _ := strings.Cut(line, linkLabelSep)
		label = strings.TrimSpace(label)
		// EVERY ADDRESS ON THE LINE, AND THE NAME FOR THE LAST. `a.com b.com` has
		// always been two links, and a name after them was written against the one
		// beside it: spread over both it would name a link the reader did not name,
		// and read as one token it would turn two working links into a dead one.
		tokens := strings.Fields(head)
		for i, tok := range tokens {
			name := ""
			if i == len(tokens)-1 {
				name = label
			}
			take(tok, name)
		}
	}
	return p
}

// linkHost is an address's host, lowercased; ok is false for something that is
// not an address. The browser's URL parser decides that for people.jsx, and this
// reads the same near enough: an address has a scheme, and on the web's own
// schemes a host (`https://` alone is not one). A mailto: is an address with no
// host, as it is to the browser, so it can be named and belongs to no provider.
//
// GO'S PARSER IS STRICTER THAN THE BROWSER'S, so what it refuses is read again
// by hand (hostByHand). It refuses a `%` not followed by two hex digits, which
// the URL standard passes through as it is: `https://example.org/sale-50%-off`
// is an address to new URL() and was not one here, so the name on it was
// dropped at the fold, the loss this file exists to stop.
func linkHost(tok string) (string, bool) {
	scheme, host := "", ""
	if u, err := url.Parse(tok); err == nil {
		scheme, host = u.Scheme, u.Hostname()
	} else if scheme, host, err = hostByHand(tok); err != nil {
		return "", false
	}
	if scheme == "" {
		return "", false
	}
	switch strings.ToLower(scheme) {
	case "http", "https", "ftp", "ws", "wss":
		if host == "" {
			return "", false
		}
	}
	return strings.ToLower(host), true
}

// linkScheme is an address's scheme, as RFC 3986 spells one.
var linkScheme = regexp.MustCompile(`^([A-Za-z][A-Za-z0-9+.\-]*):`)

// errNotAnAddress is hostByHand's answer for a token with no scheme, or a host
// no browser would take.
var errNotAnAddress = errors.New("not an address")

// hostByHand reads the scheme and the host of an address url.Parse refused: the
// scheme up to the first colon, and the host between `//` and the first `/`, `?`
// or `#`, without its user and port. Only the host is checked, for the `%` a
// browser refuses there too; the path, the query and the fragment may hold
// anything.
func hostByHand(tok string) (scheme, host string, err error) {
	m := linkScheme.FindStringSubmatch(tok)
	if m == nil {
		return "", "", errNotAnAddress
	}
	rest, ok := strings.CutPrefix(tok[len(m[0]):], "//")
	if !ok {
		return m[1], "", nil // mailto:, tel: and the like, which carry no host
	}
	if i := strings.IndexAny(rest, "/?#"); i >= 0 {
		rest = rest[:i]
	}
	if i := strings.LastIndex(rest, "@"); i >= 0 {
		rest = rest[i+1:]
	}
	if strings.HasPrefix(rest, "[") { // an IPv6 literal keeps its colons
		end := strings.Index(rest, "]")
		if end < 0 {
			return "", "", errNotAnAddress
		}
		rest = rest[1:end]
	} else if i := strings.LastIndex(rest, ":"); i >= 0 {
		rest = rest[:i]
	}
	if strings.Contains(rest, "%") {
		return "", "", errNotAnAddress
	}
	return m[1], rest, nil
}

// linkProvider is the slug of the provider a host belongs to, or "".
func linkProvider(host string) string {
	if host == "" {
		return ""
	}
	for _, p := range linkProviders {
		if p.re.MatchString(host) {
			return p.slug
		}
	}
	return ""
}

// mergeLinks folds fetched provider links (slug → address) into a stored links
// field without disturbing anything the reader put there: an address already
// stored for a provider wins over the fetched one, providers are written in
// linkProviders' order, everything else keeps its place after them, and every
// name survives. A fetched slug that is no provider of linkProviders' (an IGDB
// company's "official" site, a studio's "logo_url") is not a link to keep.
//
// THE NAMES SURVIVE THE FOLD. It rewrites the whole field, so a fetch that did not
// touch a link would still erase the name on it — the same class of loss the
// "stored address wins" rule exists to stop, one column over.
func mergeLinks(stored string, fetched map[string]string) string {
	p := parseLinks(stored)
	merged := maps.Clone(p.known)
	for slug, address := range fetched {
		if address != "" && merged[slug] == "" {
			merged[slug] = address
		}
	}
	var out []string
	for _, prov := range linkProviders {
		if address := merged[prov.slug]; address != "" {
			out = append(out, linkLine(address, p.labels[address]))
		}
	}
	for _, address := range p.extra {
		out = append(out, linkLine(address, p.labels[address]))
	}
	return strings.Join(out, "\n")
}
