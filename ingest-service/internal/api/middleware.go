package api

import (
	"context"
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
const ingestAPIKeyContextKey contextKey = "ingest_api_key"

// ipLimiter tracks rate limiting state per IP address.
type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter implements per-IP rate limiting with automatic cleanup of stale entries.
type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*ipLimiter
	rps     rate.Limit
	burst   int
	ttl     time.Duration
}

// NewRateLimiter creates a new rate limiter with specified RPS, burst, and TTL.
//
// Args:
//   - rps: requests per second limit for each IP
//   - burst: burst capacity for token bucket
//   - ttl: idle time before removing IP entry (minimum 5 minutes)
//
// Starts a background cleanup goroutine.
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

// cleanupLoop periodically removes stale rate limiter entries.
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

// Chain composes multiple middleware functions in reverse order.
//
// Applies middlewares from last to first, so the first middleware in the list
// is closest to the handler.
func Chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		h := final
		for i := len(middlewares) - 1; i >= 0; i-- {
			h = middlewares[i](h)
		}
		return h
	}
}

// CORSMiddleware adds CORS headers and handles preflight requests.
//
// Validates origin against allowed list and sets appropriate CORS headers.
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		origins[trimmed] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if _, ok := origins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RecoverMiddleware recovers from panics and logs them as errors.
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

// SecurityHeadersMiddleware adds security-related HTTP response headers.
//
// Sets headers for:
// - Clickjacking protection (X-Frame-Options)
// - MIME type sniffing protection (X-Content-Type-Options)
// - Referrer policy (no-referrer)
// - Feature permissions (geolocation, microphone, camera disabled)
// - HSTS (Strict-Transport-Security)
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

// RequestIDMiddleware generates and attaches a unique request ID to each request.
//
// Uses X-Request-ID header if provided, otherwise generates a new UUID.
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

// RateLimitMiddleware enforces per-IP rate limiting.
//
// Exempts health, readiness, and metrics endpoints from rate limiting.
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

// APIKeyAuthMiddleware validates API key authentication for telemetry endpoints.
//
// Exempts health, readiness, metrics, and swagger endpoints.
// Stores validated API key in request context for downstream access.
func APIKeyAuthMiddleware(require bool, apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !require || r.URL.Path == "/health" || r.URL.Path == "/ready" || r.URL.Path == "/metrics" || strings.HasPrefix(r.URL.Path, "/swagger") {
				next.ServeHTTP(w, r)
				return
			}
			provided := ExtractProvidedAPIKey(r)
			if provided == "" {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if secureEqual(provided, apiKey) {
				ctx := context.WithValue(r.Context(), ingestAPIKeyContextKey, provided)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			if r.URL.Path != "/v1/telemetry" {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			ctx := context.WithValue(r.Context(), ingestAPIKeyContextKey, provided)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ExtractProvidedAPIKey(r *http.Request) string {
	provided := strings.TrimSpace(r.Header.Get("X-API-Key"))
	if provided != "" {
		return provided
	}
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func ProvidedAPIKeyFromContext(ctx context.Context) string {
	v := ctx.Value(ingestAPIKeyContextKey)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
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
	maxLen := len(ab)
	if len(bb) > maxLen {
		maxLen = len(bb)
	}
	pa := make([]byte, maxLen)
	pb := make([]byte, maxLen)
	copy(pa, ab)
	copy(pb, bb)
	valuesEqual := subtle.ConstantTimeCompare(pa, pb) == 1
	lengthsEqual := subtle.ConstantTimeEq(int32(len(ab)), int32(len(bb))) == 1
	return valuesEqual && lengthsEqual
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
