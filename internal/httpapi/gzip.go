package httpapi

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"
)

// Response compression, stdlib only (compress/gzip), no dependency added.
//
// Quote text compresses roughly eight to one, and the list endpoints a client
// mirrors return a lot of it. On a LAN this is invisible; over Tailscale or a
// phone's cellular connection it is the difference between a library sync that
// feels instant and one that doesn't. The SPA benefits identically.
//
// Compression is opt-in per request (Accept-Encoding) and skipped for content
// that is already compressed, so the CPU cost on a NAS stays proportional to
// what it saves.

// compressibleTypes are the response content types worth gzipping. Everything
// else — JPEG and PNG covers, gzipped backup archives — is already compressed,
// where a second pass burns CPU at both ends and can make the payload larger.
var compressibleTypes = []string{
	"application/json",
	"text/",
	"application/javascript",
	"image/svg+xml",
	"application/xml",
}

func compressible(contentType string) bool {
	ct := strings.ToLower(contentType)
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = ct[:i] // drop "; charset=utf-8"
	}
	ct = strings.TrimSpace(ct)
	for _, prefix := range compressibleTypes {
		if strings.HasPrefix(ct, prefix) {
			return true
		}
	}
	return false
}

func acceptsGzip(r *http.Request) bool {
	for _, enc := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		// Ignore any q-value; "gzip;q=0" is rare enough not to be worth parsing,
		// and honouring it wrongly only costs a compressed response.
		if name, _, _ := strings.Cut(enc, ";"); strings.EqualFold(strings.TrimSpace(name), "gzip") {
			return true
		}
	}
	return false
}

// gzipResponseWriter defers the decision to compress until WriteHeader, when
// the handler has set Content-Type and the status is known.
type gzipResponseWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	wroteHeader bool
}

func (g *gzipResponseWriter) WriteHeader(status int) {
	if g.wroteHeader {
		return
	}
	g.wroteHeader = true

	// 204/304 carry no body, and a 1xx is not a response yet. Compressing them
	// would announce an encoding for bytes that never arrive.
	bodyless := status == http.StatusNoContent || status == http.StatusNotModified || status < 200
	if !bodyless && compressible(g.Header().Get("Content-Type")) {
		g.gz = gzip.NewWriter(g.ResponseWriter)
		g.Header().Set("Content-Encoding", "gzip")
		// The handler's Content-Length describes the uncompressed body; leaving
		// it would truncate the response at the client.
		g.Header().Del("Content-Length")
	}
	g.ResponseWriter.WriteHeader(status)
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	if !g.wroteHeader {
		g.WriteHeader(http.StatusOK)
	}
	if g.gz != nil {
		return g.gz.Write(b)
	}
	return g.ResponseWriter.Write(b)
}

func (g *gzipResponseWriter) Close() error {
	if g.gz != nil {
		return g.gz.Close()
	}
	return nil
}

// Flush keeps streaming handlers working through the wrapper: without it the
// embedded ResponseWriter's Flush would bypass the gzip buffer and emit bytes
// out of order.
func (g *gzipResponseWriter) Flush() {
	if g.gz != nil {
		_ = g.gz.Flush()
	}
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// gzipResponses compresses eligible responses for clients that accept it.
func gzipResponses(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Announce that the response varies by encoding whether or not this
		// particular one ends up compressed — otherwise a shared cache could
		// hand a gzipped body to a client that never asked for one.
		w.Header().Set("Vary", "Accept-Encoding")
		if !acceptsGzip(r) {
			next.ServeHTTP(w, r)
			return
		}
		gw := &gzipResponseWriter{ResponseWriter: w}
		defer gw.Close()
		next.ServeHTTP(gw, r)
	})
}

// Assert the wrapper keeps the interfaces handlers reach for.
var (
	_ http.ResponseWriter = (*gzipResponseWriter)(nil)
	_ http.Flusher        = (*gzipResponseWriter)(nil)
	_ io.Closer           = (*gzipResponseWriter)(nil)
)
