package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config contains all application configuration loaded from environment variables.
//
// It includes database URLs, Kafka broker settings, API key configuration,
// rate limiting parameters, buffer settings, and polling configuration.
type Config struct {
	Port                string
	KafkaServiceURI     string
	KafkaCACert         string
	KafkaServiceCert    string
	KafkaServiceKey     string
	ControlPlaneDBURL   string
	TimescaleDatabase   string
	IngestKeyPepper     string
	RequireAPIKey       bool
	IngestAPIKey        string
	RateLimitRPS        int
	RateLimitBurst      int
	BatchSize           int
	FlushInterval       time.Duration
	MaxBufferCapacity   int
	MaxEventsPerReq     int
	PublishWorkerCount  int
	LiveTrackRetention  time.Duration
	OrgValidationTTL    time.Duration
	ActivePolling       bool
	PollingSyncInterval time.Duration
	DefaultPollInterval time.Duration
	DefaultPollTimeout  time.Duration
	PollingBackoffMax   time.Duration
	PollTargets         []PollTargetConfig
}

// PollTargetConfig represents configuration for a single polling target.
//
// Defines the endpoint to poll, request method, headers, and timing parameters.
type PollTargetConfig struct {
	Name            string            `json:"name"`
	OrgID           string            `json:"org_id"`
	APIID           string            `json:"api_id"`
	BaseURL         string            `json:"base_url"`
	Path            string            `json:"path"`
	Method          string            `json:"method"`
	IntervalSeconds int               `json:"interval_seconds"`
	TimeoutMS       int               `json:"timeout_ms"`
	Headers         map[string]string `json:"headers"`
	Body            string            `json:"body"`
	ClientRegion    string            `json:"client_region"`
	SchemaVersion   string            `json:"schema_version"`
}

// Load reads configuration from environment variables and .env file.
//
// Priority: .env file < environment variables.
// Returns error if required configuration is missing or invalid.
func Load() (Config, error) {
	loadDotEnv()

	cfg := Config{
		Port:                getEnv("PORT", "8080"),
		KafkaServiceURI:     strings.TrimSpace(os.Getenv("KAFKA_SERVICE_URI")),
		KafkaCACert:         strings.TrimSpace(os.Getenv("KAFKA_CA_CERT")),
		KafkaServiceCert:    strings.TrimSpace(os.Getenv("KAFKA_SERVICE_CERT")),
		KafkaServiceKey:     strings.TrimSpace(os.Getenv("KAFKA_SERVICE_KEY")),
		ControlPlaneDBURL:   strings.TrimSpace(os.Getenv("DATABASE")),
		TimescaleDatabase:   strings.TrimSpace(os.Getenv("TIMESCALE_DATABASE")),
		IngestKeyPepper:     strings.TrimSpace(os.Getenv("INGEST_KEY_PEPPER")),
		RequireAPIKey:       getEnvBool("REQUIRE_API_KEY", true),
		IngestAPIKey:        strings.TrimSpace(os.Getenv("INGEST_API_KEY")),
		RateLimitRPS:        getEnvInt("RATE_LIMIT_RPS", 4000),
		RateLimitBurst:      getEnvInt("RATE_LIMIT_BURST", 8000),
		BatchSize:           getEnvInt("BATCH_SIZE", 500),
		FlushInterval:       time.Duration(getEnvInt("FLUSH_INTERVAL_SECONDS", 2)) * time.Second,
		MaxBufferCapacity:   getEnvInt("MAX_BUFFER_CAPACITY", 50000),
		MaxEventsPerReq:     getEnvInt("MAX_EVENTS_PER_REQUEST", 1000),
		PublishWorkerCount:  getEnvInt("PUBLISH_WORKER_COUNT", 4),
		LiveTrackRetention:  time.Duration(getEnvInt("LIVE_TRACK_RETENTION_MINUTES", 120)) * time.Minute,
		OrgValidationTTL:    time.Duration(getEnvInt("ORG_VALIDATION_TTL_SECONDS", 60)) * time.Second,
		ActivePolling:       getEnvBool("ACTIVE_POLLING_ENABLED", false),
		PollingSyncInterval: time.Duration(getEnvInt("POLLING_SYNC_INTERVAL_SECONDS", 30)) * time.Second,
		DefaultPollInterval: time.Duration(getEnvInt("DEFAULT_POLL_INTERVAL_SECONDS", 30)) * time.Second,
		DefaultPollTimeout:  time.Duration(getEnvInt("DEFAULT_POLL_TIMEOUT_MS", 5000)) * time.Millisecond,
		PollingBackoffMax:   time.Duration(getEnvInt("POLLING_BACKOFF_MAX_SECONDS", 300)) * time.Second,
	}

	pollTargets, err := parsePollTargets(os.Getenv("ACTIVE_POLL_TARGETS"))
	if err != nil {
		return Config{}, err
	}
	cfg.PollTargets = pollTargets

	if cfg.KafkaServiceURI == "" {
		return Config{}, fmt.Errorf("KAFKA_SERVICE_URI is required")
	}
	if cfg.KafkaCACert == "" {
		return Config{}, fmt.Errorf("KAFKA_CA_CERT is required")
	}
	if cfg.KafkaServiceCert == "" {
		return Config{}, fmt.Errorf("KAFKA_SERVICE_CERT is required")
	}
	if cfg.KafkaServiceKey == "" {
		return Config{}, fmt.Errorf("KAFKA_SERVICE_KEY is required")
	}
	if cfg.RequireAPIKey && cfg.IngestAPIKey == "" {
		return Config{}, fmt.Errorf("INGEST_API_KEY is required when REQUIRE_API_KEY=true")
	}
	if cfg.RateLimitRPS <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_RPS must be > 0")
	}
	if cfg.RateLimitBurst <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_BURST must be > 0")
	}
	if cfg.BatchSize <= 0 {
		return Config{}, fmt.Errorf("BATCH_SIZE must be > 0")
	}
	if cfg.FlushInterval <= 0 {
		return Config{}, fmt.Errorf("FLUSH_INTERVAL_SECONDS must be > 0")
	}
	if cfg.MaxBufferCapacity <= 0 {
		return Config{}, fmt.Errorf("MAX_BUFFER_CAPACITY must be > 0")
	}
	if cfg.MaxEventsPerReq <= 0 {
		return Config{}, fmt.Errorf("MAX_EVENTS_PER_REQUEST must be > 0")
	}
	if cfg.PublishWorkerCount <= 0 {
		return Config{}, fmt.Errorf("PUBLISH_WORKER_COUNT must be > 0")
	}
	if cfg.LiveTrackRetention <= 0 {
		return Config{}, fmt.Errorf("LIVE_TRACK_RETENTION_MINUTES must be > 0")
	}
	if cfg.OrgValidationTTL <= 0 {
		return Config{}, fmt.Errorf("ORG_VALIDATION_TTL_SECONDS must be > 0")
	}
	if cfg.PollingSyncInterval <= 0 {
		return Config{}, fmt.Errorf("POLLING_SYNC_INTERVAL_SECONDS must be > 0")
	}
	if cfg.DefaultPollInterval <= 0 {
		return Config{}, fmt.Errorf("DEFAULT_POLL_INTERVAL_SECONDS must be > 0")
	}
	if cfg.DefaultPollTimeout <= 0 {
		return Config{}, fmt.Errorf("DEFAULT_POLL_TIMEOUT_MS must be > 0")
	}
	if cfg.PollingBackoffMax <= 0 {
		return Config{}, fmt.Errorf("POLLING_BACKOFF_MAX_SECONDS must be > 0")
	}

	return cfg, nil
}

func parsePollTargets(raw string) ([]PollTargetConfig, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var targets []PollTargetConfig
	if err := json.Unmarshal([]byte(raw), &targets); err != nil {
		return nil, fmt.Errorf("ACTIVE_POLL_TARGETS must be valid JSON array: %w", err)
	}

	for i := range targets {
		t := &targets[i]
		t.Name = strings.TrimSpace(t.Name)
		t.OrgID = strings.TrimSpace(t.OrgID)
		t.APIID = strings.TrimSpace(t.APIID)
		t.BaseURL = strings.TrimSpace(t.BaseURL)
		t.Path = strings.TrimSpace(t.Path)
		t.Method = strings.ToUpper(strings.TrimSpace(t.Method))
		t.ClientRegion = strings.TrimSpace(t.ClientRegion)
		t.SchemaVersion = strings.TrimSpace(t.SchemaVersion)
		if t.IntervalSeconds <= 0 {
			t.IntervalSeconds = 30
		}
		if t.TimeoutMS <= 0 {
			t.TimeoutMS = 5000
		}
		if t.Method == "" {
			t.Method = "GET"
		}
		if t.SchemaVersion == "" {
			t.SchemaVersion = "active-poll.v1"
		}
		if t.OrgID == "" || t.APIID == "" || t.BaseURL == "" || t.Path == "" {
			return nil, fmt.Errorf("ACTIVE_POLL_TARGETS[%d] must include org_id, api_id, base_url, and path", i)
		}
	}

	return targets, nil
}

func loadDotEnv() {
	paths := []string{".env"}

	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		paths = append(paths,
			filepath.Join(execDir, ".env"),
			filepath.Join(execDir, "..", ".env"),
		)
	}

	seen := make(map[string]struct{}, len(paths))
	uniquePaths := make([]string, 0, len(paths))
	for _, path := range paths {
		cleanPath := filepath.Clean(path)
		if _, exists := seen[cleanPath]; exists {
			continue
		}
		seen[cleanPath] = struct{}{}
		uniquePaths = append(uniquePaths, cleanPath)
	}

	for _, path := range uniquePaths {
		if _, err := os.Stat(path); err == nil {
			_ = godotenv.Load(path)
		}
	}
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func getEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func getEnvBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	if raw == "1" || raw == "true" || raw == "yes" || raw == "on" {
		return true
	}
	if raw == "0" || raw == "false" || raw == "no" || raw == "off" {
		return false
	}
	return fallback
}
