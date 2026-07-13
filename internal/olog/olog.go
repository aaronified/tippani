// Package olog writes operational log lines to BOTH stdout and stderr, so a
// deployment that captures only one stream still sees them (owner request: keep
// detailed logs on stdout and stderr). Use it for significant, low-frequency
// events — startup, integrity checks, index repair, database reset — NOT for
// per-request or per-query spam (that stays on the stdlib logger / stderr).
//
// Both streams get the standard "2006/01/02 15:04:05" timestamp prefix so the
// two copies line up; Docker/compose adds its own outer timestamp on top.
package olog

import (
	"log"
	"os"
)

var (
	out = log.New(os.Stdout, "", log.LstdFlags)
	err = log.New(os.Stderr, "", log.LstdFlags)
)

// Printf logs an operational line to stdout and stderr.
func Printf(format string, args ...any) {
	out.Printf(format, args...)
	err.Printf(format, args...)
}

// Alertf is Printf for problems — same dual-stream delivery, but prefixed so a
// corruption/repair alert stands out in a wall of logs.
func Alertf(format string, args ...any) {
	Printf("!! "+format, args...)
}
