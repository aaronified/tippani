package httpapi

import (
	"context"
	"errors"

	"tippani/internal/olog"
	"tippani/internal/outbound"
)

// logOutwardFailure logs a call out to a supplier or an image host that failed,
// a lookup or a download, as an error under code: the code an operator looks up
// in Troubleshooting when a lookup answers "failed" or a picture never arrives.
//
// EXCEPT A REFUSAL BY TIPPANI_OFFLINE, which is not a failure. The operator
// switched the app offline on purpose, and the gate has already kept its own line
// for the call ("→ refused (offline)"), in the job the request became or in the
// system log. Offline, where every browser journey runs, a fill or a re-verify
// asks for every work it is given and a work page for every picture it has no
// file for, and an error for each would bury the ones that are real. It is a
// trace line instead. Every other failure (a key rejected, a quota used up, the host
// allowlist, the size and format checks, a host that said no) is logged as it
// was.
//
// AND A CALL A STOP CANCELLED, which is not a failure either: somebody pressed
// Stop, the job's log says who, and the call's own line says it was cancelled. A
// Stop All over a fill of two thousand works would otherwise leave an error in
// the system log that nothing went wrong to earn. So is a request whose reader
// went away, for the same reason.
//
// One helper for every such line, so that the rule is written once. It was
// first written for the two picture downloads alone, and the lookups beside them
// went on logging each refusal as an error.
func logOutwardFailure(code olog.Code, err error, format string, args ...any) {
	if errors.Is(err, outbound.ErrOffline) || errors.Is(err, context.Canceled) {
		olog.Tracef(format, args...)
		return
	}
	olog.Errorf(code, format, args...)
}

// warnOutwardFailure is the same rule for the calls whose failure was always a
// warning rather than an error — a picture a review's apply or a fill could not
// fetch, one film supplier of several that did not answer — where the work goes
// on without it: a call a Stop cut is a trace line, not a warning. Offline
// refusals stay warnings here, as they were.
func warnOutwardFailure(code olog.Code, err error, format string, args ...any) {
	if errors.Is(err, context.Canceled) {
		olog.Tracef(format, args...)
		return
	}
	olog.Warnf(code, format, args...)
}
