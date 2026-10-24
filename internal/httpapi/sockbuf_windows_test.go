//go:build windows

package httpapi

import "syscall"

// setReceiveBuffer: the Windows form of the Unix helper beside it (a handle, not a descriptor), so
// the package's tests compile on a Windows machine at all. Before this one call was Unix-only and
// the whole package would not build there.
func setReceiveBuffer(fd uintptr, bytes int) error {
	return syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_RCVBUF, bytes)
}
