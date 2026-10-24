//go:build !windows

package httpapi

import "syscall"

// setReceiveBuffer shrinks a socket's receive buffer, which is how a test makes a phone that went
// to sleep mid-download: the server fills the small buffer and then waits on the client. The call
// takes a file descriptor on Unix and a handle on Windows, so it is one function per platform.
func setReceiveBuffer(fd uintptr, bytes int) error {
	return syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_RCVBUF, bytes)
}
