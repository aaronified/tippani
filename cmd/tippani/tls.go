package main

// Native HTTPS (opt-in): TIPPANI_TLS_CERT + TIPPANI_TLS_KEY point at a PEM
// pair and Tippani serves TLS itself — no reverse-proxy container required.
// Certificates come from wherever the operator already gets them (their own
// home CA, `tailscale cert`, an acme.sh/certbot renewal on the host); Tippani
// deliberately does NOT speak ACME — renewal loops are background jobs with
// third-party dependencies, and the ethos is zero of those.

import (
	"crypto/tls"
	"os"
	"sync"
	"time"

	"tippani/internal/olog"
)

// fileStamp is the change detector for a cert/key file: size + mtime. Cheap
// (one Stat) and good enough — renewals replace the file, which bumps mtime.
// A same-size same-second in-place rewrite could in principle be missed on a
// coarse-mtime filesystem; a restart always reloads, so that edge stays benign.
type fileStamp struct {
	size int64
	mod  time.Time
}

func stampFile(path string) (fileStamp, error) {
	fi, err := os.Stat(path)
	if err != nil {
		return fileStamp{}, err
	}
	return fileStamp{size: fi.Size(), mod: fi.ModTime()}, nil
}

// certReloader serves the PEM pair at certPath/keyPath and re-reads it when
// either file changes on disk, checked per TLS handshake (two Stats per
// connection — nothing per request). External renewal tooling can therefore
// rotate the files in place and the next handshake serves the new pair, no
// restart needed. A failed re-load keeps serving the previous pair (coded
// warn in the logs) rather than dropping TLS: a renewer that writes cert and
// key non-atomically parses as a mismatched pair for a moment, and the retry
// triggers again once the second file lands (its stamp changes too).
type certReloader struct {
	certPath, keyPath string

	mu        sync.Mutex
	cert      *tls.Certificate
	certStamp fileStamp
	keyStamp  fileStamp
}

// newCertReloader eagerly loads the pair so a misconfiguration fails the boot
// (log.Fatal in serve) instead of surfacing as failed handshakes later.
func newCertReloader(certPath, keyPath string) (*certReloader, error) {
	r := &certReloader{certPath: certPath, keyPath: keyPath}
	if err := r.reload(); err != nil {
		return nil, err
	}
	return r, nil
}

// reload parses the pair and, only on success, swaps it in with fresh stamps.
// Callers hold r.mu (construction is single-threaded).
func (r *certReloader) reload() error {
	cs, err := stampFile(r.certPath)
	if err != nil {
		return err
	}
	ks, err := stampFile(r.keyPath)
	if err != nil {
		return err
	}
	cert, err := tls.LoadX509KeyPair(r.certPath, r.keyPath)
	if err != nil {
		return err
	}
	r.cert, r.certStamp, r.keyStamp = &cert, cs, ks
	return nil
}

// GetCertificate is the tls.Config hook: hand back the current pair, first
// re-loading it if either file changed since the last look.
func (r *certReloader) GetCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cs, csErr := stampFile(r.certPath)
	ks, ksErr := stampFile(r.keyPath)
	if csErr == nil && ksErr == nil && (cs != r.certStamp || ks != r.keyStamp) {
		if err := r.reload(); err != nil {
			// Keep serving the previous good pair, and adopt the observed stamps
			// so a broken file warns once instead of once per handshake — the
			// stamps change again when the operator (or the renewer's second
			// write) fixes it, which re-triggers the reload.
			r.certStamp, r.keyStamp = cs, ks
			olog.Warnf(olog.CodeHTTPTLSReload,
				"[serve] tls cert/key re-load failed — still serving the previous pair: %v", err)
		}
	}
	return r.cert, nil
}
