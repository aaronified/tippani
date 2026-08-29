//go:build !unix

package updater

// socketGID has no answer off unix, where there is no group to join.
func socketGID(string) (int, bool) { return 0, false }
