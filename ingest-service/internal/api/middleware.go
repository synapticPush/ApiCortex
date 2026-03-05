package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

type contextKey string

const requestIDContextKey contextKey = "request_id"

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*ipLimiter
	rps     rate.Limit
	burst   int
	ttl     time.Duration
}

func NewRateLimiter(rps int, burst int, ttl time.Duration) *RateLimiter {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	rl := &RateLimiter{
		clients: make(map[string]*ipLimiter, 1024),
		rps:     rate.Limit(rps),
		burst:   burst,
		ttl:     ttl,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-rl.ttl)
		rl.mu.Lock()
		for ip, c := range rl.clients {
			if c.lastSeen.Before(cutoff) {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) allow(ip string) bool {
	now := time.Now()
	rl.mu.Lock()
	entry, ok := rl.clients[ip]
	if !ok {
		entry = &ipLimiter{limiter: rate.NewLimiter(rl.rps, rl.burst), lastSeen: now}
		rl.clients[ip] = entry
	} else {
		entry.lastSeen = now
	}
	lim := entry.limiter
	rl.mu.Unlock()
	return lim.Allow()
}

func Chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		h := final
		for i := len(middlewares) - 1; i >= 0; i-- {
			h = middlewares[i](h)
		}
		return h
	}
}

func RecoverMiddleware(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error().Interface("panic", rec).Str("path", r.URL.Path).Msg("panic recovered")
					writeJSONError(w, http.StatusInternalServerError, "internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeadersMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			next.ServeHTTP(w, r)
		})
	}
}

func RequestIDMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
			if reqID == "" {
				reqID = uuid.NewString()
			}
			ctx := context.WithValue(r.Context(), requestIDContextKey, reqID)
			w.Header().Set("X-Request-ID", reqID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RateLimitMiddleware(rl *RateLimiter, logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" || r.URL.Path == "/ready" || r.URL.Path == "/metrics" {
				next.ServeHTTP(w, r)
				return
			}
			ip := clientIP(r)
			if !rl.allow(ip) {
				logger.Warn().Str("ip", ip).Str("path", r.URL.Path).Msg("rate limit exceeded")
				writeJSONError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func APIKeyAuthMiddleware(require bool, apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !require || r.URL.Path == "/health" || r.URL.Path == "/ready" || r.URL.Path == "/metrics" || strings.HasPrefix(r.URL.Path, "/swagger") {
				next.ServeHTTP(w, r)
				return
			}

			provided := strings.TrimSpace(r.Header.Get("X-API-Key"))
			if provided == "" {
				authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
				if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
					provided = strings.TrimSpace(authHeader[7:])
				}
			}

			if !secureEqual(provided, apiKey) {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequestIDFromContext(ctx context.Context) string {
	v := ctx.Value(requestIDContextKey)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func secureEqual(a, b string) bool {
	ab := []byte(a)
	bb := []byte(b)
	if len(ab) == 0 || len(bb) == 0 {
		return false
	}
	ha := sha256.Sum256(ab)
	hb := sha256.Sum256(bb)
	return subtle.ConstantTimeCompare(ha[:], hb[:]) == 1
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return host
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
