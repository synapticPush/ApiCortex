package orgvalidator

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

type cacheEntry struct {
	expiresAt time.Time
	exists    bool
}

type keyCacheEntry struct {
	expiresAt time.Time
	keyHash   string
	exists    bool
}

type Validator struct {
	db       *sql.DB
	ttl      time.Duration
	pepper   string
	mu       sync.RWMutex
	cache    map[string]cacheEntry
	keyCache map[string]keyCacheEntry
}

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
	hashBytes := sha256.Sum256(payload)
	calculated := hex.EncodeToString(hashBytes[:])
	return subtle.ConstantTimeCompare([]byte(calculated), []byte(keyCached.keyHash)) == 1, nil
}

func (v *Validator) Close() error {
	if v == nil || v.db == nil {
		return nil
	}
	return v.db.Close()
}
