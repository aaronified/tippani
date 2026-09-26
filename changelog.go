// Package tippani is the repository root as a Go package, and it holds one
// thing: CHANGELOG.md, embedded so the binary can show its own release notes.
//
// It exists because //go:embed cannot reach a file outside the directory of the
// package that embeds it. Until 3.0.2 internal/changelog kept a byte-identical
// copy beside itself, with a drift test to hold the two together. The owner:
// "why are there two changelogs? there should be only one". So the file's own
// directory is a package, and internal/changelog reads it from here.
package tippani

import _ "embed"

// Changelog is CHANGELOG.md, as it was when the binary was built.
//
//go:embed CHANGELOG.md
var Changelog string
