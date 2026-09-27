package outbound

import "testing"

// WHAT A LOG MAY KEEP OF A URL. The function is the observable unit here: it
// takes a string and returns the string a log will keep, and nothing else in the
// app can show more of it than this does. The cases are the real providers'
// URLs as their clients build them (metadata/tmdb.go puts the v3 key in api_key,
// metadata/books.go and google_volume.go put Google's in key) plus the names the
// list carries for providers not yet written.

func TestRedactHidesEveryProviderKeyAndNothingElse(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		// TMDB v3 and Google Books, as the clients spell them.
		{"https://api.themoviedb.org/3/search/movie?query=Dune&api_key=abc123",
			"https://api.themoviedb.org/3/search/movie?query=Dune&api_key=…"},
		{"https://www.googleapis.com/books/v1/volumes?q=isbn:9780&key=AIzaSECRET",
			"https://www.googleapis.com/books/v1/volumes?q=isbn:9780&key=…"},
		// Case does not matter, and neither does a name written escaped.
		{"https://x.test/a?API_KEY=s1&Key=s2&api%5Fkey=s3",
			"https://x.test/a?API_KEY=…&Key=…&api%5Fkey=…"},
		// Every name on the list, one each.
		{"https://x.test/?apikey=1&api-key=2&token=3&access_token=4&refresh_token=5&id_token=6&client_secret=7&secret=8&password=9&passwd=10&pass=11&sig=12&signature=13&auth=14&code=15",
			"https://x.test/?apikey=…&api-key=…&token=…&access_token=…&refresh_token=…&id_token=…&client_secret=…&secret=…&password=…&passwd=…&pass=…&sig=…&signature=…&auth=…&code=…"},
		// A presigned storage link pasted as a cover, both clouds.
		{"https://b.s3.amazonaws.com/c.png?X-Amz-Algorithm=AWS4&X-Amz-Credential=AK%2F1&X-Amz-Signature=ab12&X-Amz-Security-Token=st",
			"https://b.s3.amazonaws.com/c.png?X-Amz-Algorithm=AWS4&X-Amz-Credential=…&X-Amz-Signature=…&X-Amz-Security-Token=…"},
		{"https://storage.googleapis.com/b/c.png?X-Goog-Credential=sa%2F1&X-Goog-Signature=cd34&X-Goog-Expires=60",
			"https://storage.googleapis.com/b/c.png?X-Goog-Credential=…&X-Goog-Signature=…&X-Goog-Expires=60"},
		// cx is an engine id, which a reader needs to see.
		{"https://customsearch.googleapis.com/customsearch/v1?cx=engine42&q=dune&key=k",
			"https://customsearch.googleapis.com/customsearch/v1?cx=engine42&q=dune&key=…"},
		// A password before the host goes, and the rest stays.
		{"https://bob:hunter2@proxy.test:8080/path?q=1", "https://proxy.test:8080/path?q=1"},
		// An @ after the host is data, not credentials.
		{"https://x.test/users/@bob?q=a@b", "https://x.test/users/@bob?q=a@b"},
		// A fragment's pairs, as an implicit OAuth redirect writes them.
		{"https://app.test/cb#access_token=tok&state=s", "https://app.test/cb#access_token=…&state=s"},
		{"https://app.test/cb?x=1#id_token=tok", "https://app.test/cb?x=1#id_token=…"},
		// An empty key says it was never set; there is nothing to hide.
		{"https://x.test/?key=&q=dune", "https://x.test/?key=&q=dune"},
		// A name with no value, and names that merely contain a listed one.
		{"https://x.test/?token&keyword=k&passage=p", "https://x.test/?token&keyword=k&passage=p"},
		// Nothing to hide: byte for byte, escaping and order included.
		{"https://x.test/a%20b?z=1&a=%C3%A9#frag", "https://x.test/a%20b?z=1&a=%C3%A9#frag"},
		// Too broken for url.Parse, and redacted anyway.
		{"https://x.test/%zz?key=s&q=%", "https://x.test/%zz?key=…&q=%"},
	} {
		if got := Redact(c.in); got != c.want {
			t.Errorf("Redact(%q)\n got %q\nwant %q", c.in, got, c.want)
		}
	}
}

func TestRedactTextFindsTheURLsInsideAnErrorsText(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		// What net/http returns when a lookup fails, and what a log used to keep.
		{`Get "https://www.googleapis.com/books/v1/volumes?q=dune&key=AIzaSECRET": dial tcp: lookup www.googleapis.com: no such host`,
			`Get "https://www.googleapis.com/books/v1/volumes?q=dune&key=…": dial tcp: lookup www.googleapis.com: no such host`},
		// Two in one line, one of them upper case, one in angle brackets.
		{"tried HTTPS://a.test/?token=t1 then <http://b.test/x?api_key=t2> and gave up",
			"tried HTTPS://a.test/?token=… then <http://b.test/x?api_key=…> and gave up"},
		// Single quotes end a URL too.
		{"url='https://a.test/?sig=zz' failed", "url='https://a.test/?sig=…' failed"},
		// No URL, no change.
		{"nothing here: key=value", "nothing here: key=value"},
		{"", ""},
	} {
		if got := RedactText(c.in); got != c.want {
			t.Errorf("RedactText(%q)\n got %q\nwant %q", c.in, got, c.want)
		}
	}
}
