package orgvalidator

import (
	"context"
	"database/sql"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// cacheEntry represents a cached organization existence lookup.
type cacheEntry struct {
	expiresAt time.Time
	exists    bool
}

// keyCacheEntry represents a cached ingest key hash lookup.
type keyCacheEntry struct {
	expiresAt time.Time
	keyHash   string
	exists    bool
}

// Validator performs organization and API key validation against PostgreSQL database.
//
// Maintains in-memory cache of organization existence and ingest key hashes to
// reduce database queries. Implements bcrypt key validation with pepper.
type Validator struct {
	db       *sql.DB
	ttl      time.Duration
	pepper   string
	mu       sync.RWMutex
	cache    map[string]cacheEntry
	keyCache map[string]keyCacheEntry
}

// New creates a new Validator connected to the control plane database.
//
// Args:
//   - databaseURL: PostgreSQL connection URL
//   - ttl: cache entry time-to-live
//   - pepper: pepper string for bcrypt key hashing
//
// Returns nil Validator if database URL is empty (passthrough mode).
// Returns error if connection fails or database ping fails.
func New(databaseURL string, ttl time.Duration, pepper string) (*Validator, error) {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return nil, nil
	}
	trimmed = strings.Replace(trimmed, "postgresql+psycopg2://", "postgres://", 1)
	trimmed = strings.Replace(trimmed, "postgresql://", "postgres://", 1)
	db, err := sql.Open("postgres", trimmed)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(15 * time.Minute)
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Validator{db: db, ttl: ttl, pepper: pepper, cache: make(map[string]cacheEntry), keyCache: make(map[string]keyCacheEntry)}, nil
}

// Validate checks if an organization exists and is valid.
//
// Uses cached results when available. Returns true for nil Validator (passthrough).
// Returns error on database failures.
func (v *Validator) Validate(ctx context.Context, orgID string) (bool, error) {
	if v == nil {
		return true, nil
	}
	now := time.Now()

	v.mu.RLock()
	cached, ok := v.cache[orgID]
	v.mu.RUnlock()
	if ok && cached.expiresAt.After(now) {
		return cached.exists, nil
	}

	var marker int
	err := v.db.QueryRowContext(ctx, "SELECT 1 FROM organizations WHERE id = $1 LIMIT 1", orgID).Scan(&marker)
	exists := err == nil
	if err != nil && err != sql.ErrNoRows {
		return false, err
	}

	v.mu.Lock()
	v.cache[orgID] = cacheEntry{expiresAt: now.Add(v.ttl), exists: exists}
	v.mu.Unlock()
	return exists, nil
}

// ValidateIngestKey checks if a provided API key matches the organization's ingest key.
//
// Uses cached key hashes. Compares using bcrypt with pepper. Returns false for nil Validator.
// Returns error on database failures.
func (v *Validator) ValidateIngestKey(ctx context.Context, orgID string, providedAPIKey string) (bool, error) {
	if v == nil {
		return false, nil
	}
	if strings.TrimSpace(providedAPIKey) == "" {
		return false, nil
	}
	now := time.Now()

	v.mu.RLock()
	keyCached, keyOk := v.keyCache[orgID]
	v.mu.RUnlock()

	if !keyOk || !keyCached.expiresAt.After(now) {
		var keyHash string
		err := v.db.QueryRowContext(ctx, "SELECT key_hash FROM organization_ingest_keys WHERE org_id = $1 LIMIT 1", orgID).Scan(&keyHash)
		exists := err == nil
		if err != nil && err != sql.ErrNoRows {
			return false, err
		}
		keyCached = keyCacheEntry{expiresAt: now.Add(v.ttl), keyHash: keyHash, exists: exists}
		v.mu.Lock()
		v.keyCache[orgID] = keyCached
		v.mu.Unlock()
	}

	if !keyCached.exists || keyCached.keyHash == "" {
		return false, nil
	}
	payload := []byte(v.pepper + ":" + providedAPIKey)
	if err := bcrypt.CompareHashAndPassword([]byte(keyCached.keyHash), payload); err != nil {
		return false, nil
	}
	return true, nil
}

func (v *Validator) Close() error {
	if v == nil || v.db == nil {
		return nil
	}
	return v.db.Close()
}
