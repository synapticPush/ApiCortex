package poller

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// DBTargetStore loads and manages polling target configurations from PostgreSQL.
//
// Queries control plane database for API endpoints and converts them into Target objects.
type DBTargetStore struct {
	db                  *sql.DB
	defaultPollInterval time.Duration
	defaultPollTimeout  time.Duration
	defaultBackoff      time.Duration
}

// NewDBTargetStore creates a new store connected to the control plane database.
//
// Args:
//   - databaseURL: PostgreSQL connection URL
//   - defaultPollInterval: default polling interval if not specified
//   - defaultPollTimeout: default poll timeout
//   - defaultBackoff: default backoff interval on failure
//
// Returns nil store if database URL is empty (passthrough mode).
// Returns error if connection fails or database ping fails.
func NewDBTargetStore(databaseURL string, defaultPollInterval, defaultPollTimeout, defaultBackoff time.Duration) (*DBTargetStore, error) {
	trimmed := normalizeDatabaseURL(databaseURL)
	if trimmed == "" {
		return nil, nil
	}
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
	if defaultPollInterval <= 0 {
		defaultPollInterval = 30 * time.Second
	}
	if defaultPollTimeout <= 0 {
		defaultPollTimeout = 5 * time.Second
	}
	if defaultBackoff <= 0 {
		defaultBackoff = 5 * time.Minute
	}
	return &DBTargetStore{
		db:                  db,
		defaultPollInterval: defaultPollInterval,
		defaultPollTimeout:  defaultPollTimeout,
		defaultBackoff:      defaultBackoff,
	}, nil
}

// Close closes the database connection.
func (s *DBTargetStore) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *DBTargetStore) ListTargets(ctx context.Context) ([]Target, error) {
	if s == nil || s.db == nil {
		return nil, nil
	}

	hasMonitoringEnabled, hasPollInterval, hasTimeout, hasHeaders, err := s.endpointColumnCapabilities(ctx)
	if err != nil {
		return nil, err
	}

	monitoringSelect := "TRUE"
	if hasMonitoringEnabled {
		monitoringSelect = "COALESCE(e.monitoring_enabled, TRUE)"
	}
	intervalSelect := "NULL"
	if hasPollInterval {
		intervalSelect = "e.poll_interval_seconds"
	}
	timeoutSelect := "NULL"
	if hasTimeout {
		timeoutSelect = "e.timeout_ms"
	}
	headersSelect := "NULL"
	if hasHeaders {
		headersSelect = "e.poll_headers_json"
	}

	query := fmt.Sprintf(`
		SELECT
			e.id::text AS endpoint_id,
			e.org_id::text AS org_id,
			e.api_id::text AS api_id,
			a.base_url AS base_url,
			e.path AS path,
			e.method AS method,
			%s AS monitoring_enabled,
			%s AS poll_interval_seconds,
			%s AS timeout_ms,
			%s AS poll_headers_json
		FROM endpoints e
		JOIN apis a ON a.id = e.api_id
		ORDER BY e.created_at DESC
	`, monitoringSelect, intervalSelect, timeoutSelect, headersSelect)

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	targets := make([]Target, 0, 256)
	for rows.Next() {
		var endpointID string
		var orgID string
		var apiID string
		var baseURL string
		var path string
		var method string
		var monitoringEnabled bool
		var pollIntervalSeconds sql.NullInt64
		var timeoutMS sql.NullInt64
		var rawHeaders []byte

		if err := rows.Scan(
			&endpointID,
			&orgID,
			&apiID,
			&baseURL,
			&path,
			&method,
			&monitoringEnabled,
			&pollIntervalSeconds,
			&timeoutMS,
			&rawHeaders,
		); err != nil {
			return nil, err
		}

		if !monitoringEnabled {
			continue
		}

		headers := map[string]string{}
		if len(rawHeaders) > 0 && string(rawHeaders) != "null" {
			_ = json.Unmarshal(rawHeaders, &headers)
		}

		interval := s.defaultPollInterval
		if pollIntervalSeconds.Valid && pollIntervalSeconds.Int64 > 0 {
			interval = time.Duration(pollIntervalSeconds.Int64) * time.Second
		}

		timeout := s.defaultPollTimeout
		if timeoutMS.Valid && timeoutMS.Int64 > 0 {
			timeout = time.Duration(timeoutMS.Int64) * time.Millisecond
		}

		targets = append(targets, Target{
			Name:          path,
			EndpointID:    strings.TrimSpace(endpointID),
			OrgID:         strings.TrimSpace(orgID),
			APIID:         strings.TrimSpace(apiID),
			BaseURL:       strings.TrimSpace(baseURL),
			Path:          strings.TrimSpace(path),
			Method:        strings.ToUpper(strings.TrimSpace(method)),
			Interval:      interval,
			Timeout:       timeout,
			Headers:       headers,
			SchemaVersion: "active-poll.v2",
			MaxBackoff:    s.defaultBackoff,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return targets, nil
}

func (s *DBTargetStore) endpointColumnCapabilities(ctx context.Context) (bool, bool, bool, bool, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'endpoints'
	`)
	if err != nil {
		return false, false, false, false, err
	}
	defer rows.Close()

	hasMonitoringEnabled := false
	hasPollInterval := false
	hasTimeout := false
	hasHeaders := false
	for rows.Next() {
		var column string
		if err := rows.Scan(&column); err != nil {
			return false, false, false, false, err
		}
		switch strings.TrimSpace(strings.ToLower(column)) {
		case "monitoring_enabled":
			hasMonitoringEnabled = true
		case "poll_interval_seconds":
			hasPollInterval = true
		case "timeout_ms":
			hasTimeout = true
		case "poll_headers_json":
			hasHeaders = true
		}
	}
	if err := rows.Err(); err != nil {
		return false, false, false, false, err
	}
	return hasMonitoringEnabled, hasPollInterval, hasTimeout, hasHeaders, nil
}

func normalizeDatabaseURL(databaseURL string) string {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return ""
	}
	trimmed = strings.Replace(trimmed, "postgresql+psycopg2://", "postgres://", 1)
	trimmed = strings.Replace(trimmed, "postgresql://", "postgres://", 1)
	return trimmed
}
