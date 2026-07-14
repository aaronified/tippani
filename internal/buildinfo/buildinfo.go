// Package buildinfo carries the running build's identity: the version stamped
// in at build time and where to look for updates. Kept dependency-free so any
// package (and the update check) can read it without import cycles.
package buildinfo

import "os"

// Version is the running build's version. It is set at build time with
//
//	-ldflags "-X tippani/internal/buildinfo.Version=<tag>"
//
// (see the Dockerfile / Makefile / docker-publish workflow) and defaults to
// "dev" for un-stamped local builds such as `go run ./cmd/tippani`.
var Version = "dev"

// Repo is the GitHub "owner/name" whose releases the update check queries;
// Image is the container image a self-update pulls. Both default to the
// canonical project and can be overridden for a fork via env — TIPPANI_REPO /
// TIPPANI_IMAGE — without a rebuild.
func Repo() string  { return envOr("TIPPANI_REPO", "aaronified/tippani") }
func Image() string { return envOr("TIPPANI_IMAGE", "ghcr.io/aaronified/tippani") }

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
