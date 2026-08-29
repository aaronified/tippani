//go:build !unix

package main

import "io/fs"

// dirOwner has no answer off unix: there is no uid to report, and the advice
// that would name one is not the advice a Windows host needs anyway.
func dirOwner(fs.FileInfo) (int, bool) { return 0, false }
