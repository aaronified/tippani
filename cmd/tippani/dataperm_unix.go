//go:build unix

package main

import (
	"io/fs"
	"syscall"
)

// dirOwner reports the uid that owns dir, when the platform has one.
func dirOwner(fi fs.FileInfo) (int, bool) {
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, false
	}
	return int(st.Uid), true
}
