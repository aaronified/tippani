package auth

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// KeyedLimiter rate-limits per key (e.g. "ip|username") for login brute-force
// protection (PLAN §2). Stale entries are pruned opportunistically.
type KeyedLimiter struct {
	mu    sync.Mutex
	m     map[string]*keyedEntry
	limit rate.Limit
	burst int
}

type keyedEntry struct {
	lim  *rate.Limiter
	seen time.Time
}

func NewKeyedLimiter(limit rate.Limit, burst int) *KeyedLimiter {
	return &KeyedLimiter{m: make(map[string]*keyedEntry), limit: limit, burst: burst}
}

func (k *KeyedLimiter) Allow(key string) bool {
	k.mu.Lock()
	defer k.mu.Unlock()
	now := time.Now()
	if len(k.m) > 1024 { // prune under lock; login volume is tiny
		for key, e := range k.m {
			if now.Sub(e.seen) > 10*time.Minute {
				delete(k.m, key)
			}
		}
	}
	e, ok := k.m[key]
	if !ok {
		e = &keyedEntry{lim: rate.NewLimiter(k.limit, k.burst)}
		k.m[key] = e
	}
	e.seen = now
	return e.lim.Allow()
}
