package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeCertPair generates a self-signed pair for cn into dir, returning the
// two paths. cn varies the encoded size, which also guarantees the fileStamp
// changes between writes regardless of filesystem mtime granularity.
func writeCertPair(t *testing.T, dir, cn string) (certPath, keyPath string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	serial, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	tmpl := x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: cn},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	certPath = filepath.Join(dir, "cert.pem")
	keyPath = filepath.Join(dir, "key.pem")
	if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certPath, keyPath
}

func leafCN(t *testing.T, c *tls.Certificate) string {
	t.Helper()
	leaf, err := x509.ParseCertificate(c.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}
	return leaf.Subject.CommonName
}

func TestCertReloaderServesAndHotReloads(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := writeCertPair(t, dir, "first.example")

	r, err := newCertReloader(certPath, keyPath)
	if err != nil {
		t.Fatal(err)
	}
	got, err := r.GetCertificate(nil)
	if err != nil || got == nil {
		t.Fatalf("GetCertificate: (%v, %v)", got, err)
	}
	if cn := leafCN(t, got); cn != "first.example" {
		t.Fatalf("initial cert CN = %q", cn)
	}

	// Rotate the pair on disk (renewal): the next handshake serves the new one.
	writeCertPair(t, dir, "second-renewed.example")
	got, err = r.GetCertificate(nil)
	if err != nil {
		t.Fatal(err)
	}
	if cn := leafCN(t, got); cn != "second-renewed.example" {
		t.Fatalf("after rotation CN = %q, want second-renewed.example", cn)
	}
}

func TestCertReloaderKeepsOldPairOnBrokenReload(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := writeCertPair(t, dir, "good.example")
	r, err := newCertReloader(certPath, keyPath)
	if err != nil {
		t.Fatal(err)
	}

	// A renewer writing non-atomically (or writing garbage) must not take
	// HTTPS down: the previous pair keeps serving.
	if err := os.WriteFile(keyPath, []byte("not a key, sorry"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := r.GetCertificate(nil)
	if err != nil || got == nil {
		t.Fatalf("GetCertificate after broken write: (%v, %v)", got, err)
	}
	if cn := leafCN(t, got); cn != "good.example" {
		t.Fatalf("kept CN = %q, want good.example", cn)
	}

	// The fix lands (a fresh valid pair): served again on the next handshake.
	writeCertPair(t, dir, "fixed-after-breakage.example")
	got, err = r.GetCertificate(nil)
	if err != nil {
		t.Fatal(err)
	}
	if cn := leafCN(t, got); cn != "fixed-after-breakage.example" {
		t.Fatalf("recovered CN = %q", cn)
	}
}

func TestCertReloaderFailsFastOnMissingFiles(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := writeCertPair(t, dir, "x.example")
	if _, err := newCertReloader(filepath.Join(dir, "nope.pem"), keyPath); err == nil {
		t.Error("missing cert: want error")
	}
	if _, err := newCertReloader(certPath, filepath.Join(dir, "nope.key")); err == nil {
		t.Error("missing key: want error")
	}
}
