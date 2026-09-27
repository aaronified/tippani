package httpapi

import (
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
// One helper for every such line, so that the rule is written once. It was
// first written for the two picture downloads alone, and the lookups beside them
// went on logging each refusal as an error.
func logOutwardFailure(code olog.Code, err error, format string, args ...any) {
	if errors.Is(err, outbound.ErrOffline) {
		olog.Tracef(format, args...)
		return
	}
	olog.Errorf(code, format, args...)
}
