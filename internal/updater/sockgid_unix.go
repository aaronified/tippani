//go:build unix

package updater

import (
	"os"
	"syscall"
)

// socketGID is the group that owns the Docker socket — the number an operator
// has to put in `group_add`. Read rather than guessed: it is 999 on Debian, 998
// on Fedora, something else on a NAS, and telling somebody the wrong one is
// worse than telling them nothing.
func socketGID(path string) (int, bool) {
	fi, err := os.Stat(path)
	if err != nil {
		return 0, false
	}
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, false
	}
	return int(st.Gid), true
}
