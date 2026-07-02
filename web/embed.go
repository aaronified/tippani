// Package web embeds the built frontend. Run `make frontend` (or the Docker
// build) to replace the committed placeholder in dist/ with the real SPA.
package web

import "embed"

//go:embed all:dist
var Dist embed.FS
