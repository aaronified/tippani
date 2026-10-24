# ADR-0168: The stored extension comes from the content sniff, never the URL

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/covers.go`

**Decided.** `sniffImageType` classifies the bytes; `imageExt` maps the sniffed type to an extension; the filename is 16 hex characters plus that extension, with nothing caller-controlled anywhere in the path. SVG is probed separately, floored at 48 bytes, refused outright if it contains script, and sandboxed by CSP on serve.

**Why.** A URL's extension is an assertion by whoever wrote the URL. Deriving the stored name from the bytes means a `.jpg` that is really something else cannot become a `.jpg` on my disk. SVG needs its own probe because `http.DetectContentType` never returns `image/svg+xml` — SVG documents sniff as `text/xml` or `text/plain` — and the probe anchors on the document root rather than searching for `<svg`, so an HTML page with an inline SVG cannot pass as an image. Refusing scripted SVG at rest is defence in depth: the serve path already sandboxes it, and a script-free file cannot attack anything even if a header is ever wrong. Mine, and the two-layer treatment of SVG is the part I would not trade away.

<sub>`internal/metadata/covers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
