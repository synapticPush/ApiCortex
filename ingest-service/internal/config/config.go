package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               string
	KafkaServiceURI    string
	KafkaCACert        string
	KafkaServiceCert   string
	KafkaServiceKey    string
	RequireAPIKey      bool
	IngestAPIKey       string
	RateLimitRPS       int
	RateLimitBurst     int
	BatchSize          int
	FlushInterval      time.Duration
	MaxBufferCapacity  int
	MaxEventsPerReq    int
	PublishWorkerCount int
}

func Load() (Config, error) {
	cfg := Config{
		Port:               getEnv("PORT", "8080"),
		KafkaServiceURI:    strings.TrimSpace(os.Getenv("KAFKA_SERVICE_URI")),
		KafkaCACert:        strings.TrimSpace(os.Getenv("KAFKA_CA_CERT")),
		KafkaServiceCert:   strings.TrimSpace(os.Getenv("KAFKA_SERVICE_CERT")),
		KafkaServiceKey:    strings.TrimSpace(os.Getenv("KAFKA_SERVICE_KEY")),
		RequireAPIKey:      getEnvBool("REQUIRE_API_KEY", true),
		IngestAPIKey:       strings.TrimSpace(os.Getenv("INGEST_API_KEY")),
		RateLimitRPS:       getEnvInt("RATE_LIMIT_RPS", 4000),
		RateLimitBurst:     getEnvInt("RATE_LIMIT_BURST", 8000),
		BatchSize:          getEnvInt("BATCH_SIZE", 500),
		FlushInterval:      time.Duration(getEnvInt("FLUSH_INTERVAL_SECONDS", 2)) * time.Second,
		MaxBufferCapacity:  getEnvInt("MAX_BUFFER_CAPACITY", 50000),
		MaxEventsPerReq:    getEnvInt("MAX_EVENTS_PER_REQUEST", 1000),
		PublishWorkerCount: getEnvInt("PUBLISH_WORKER_COUNT", 4),
	}

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

	return cfg, nil
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
