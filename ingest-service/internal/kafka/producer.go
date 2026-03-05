package kafka

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	kafkago "github.com/segmentio/kafka-go"

	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
)

const TopicTelemetryRaw = "telemetry.raw"

type Producer struct {
	writer  *kafkago.Writer
	logger  zerolog.Logger
	metrics *metrics.Registry
}

func NewProducer(brokersCSV, caPath, certPath, keyPath string, logger zerolog.Logger, m *metrics.Registry) (*Producer, error) {
	brokers := splitAndTrim(brokersCSV)
	if len(brokers) == 0 {
		return nil, fmt.Errorf("no kafka brokers provided")
	}

	tlsConfig, err := loadTLSConfig(caPath, certPath, keyPath)
	if err != nil {
		return nil, fmt.Errorf("load TLS config: %w", err)
	}

	transport := &kafkago.Transport{
		TLS: tlsConfig,
	}

	writer := &kafkago.Writer{
		Addr:                   kafkago.TCP(brokers...),
		Topic:                  TopicTelemetryRaw,
		BatchTimeout:           10 * time.Millisecond,
		RequiredAcks:           kafkago.RequireAll,
		AllowAutoTopicCreation: false,
		Balancer:               &kafkago.LeastBytes{},
		Transport:              transport,
		Async:                  false,
	}

	return &Producer{writer: writer, logger: logger, metrics: m}, nil
}

func (p *Producer) PublishBatch(ctx context.Context, events []model.TelemetryEvent) error {
	if len(events) == 0 {
		return nil
	}

	encoded, err := encodeBatchGzip(events)
	if err != nil {
		return fmt.Errorf("encode batch: %w", err)
	}

	msg := kafkago.Message{
		Time:  time.Now().UTC(),
		Value: encoded,
		Headers: []kafkago.Header{
			{Key: "content-encoding", Value: []byte("gzip")},
			{Key: "content-type", Value: []byte("application/json")},
			{Key: "schema", Value: []byte("telemetry.raw.batch.v1")},
		},
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		p.metrics.IncKafkaErrors()
		return fmt.Errorf("write kafka message: %w", err)
	}

	p.metrics.AddEventsPublished(len(events))
	return nil
}

func (p *Producer) Close() error {
	return p.writer.Close()
}

func encodeBatchGzip(events []model.TelemetryEvent) ([]byte, error) {
	payload, err := json.Marshal(events)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	if _, err := zw.Write(payload); err != nil {
		_ = zw.Close()
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func loadTLSConfig(caPath, certPath, keyPath string) (*tls.Config, error) {
	caCert, err := os.ReadFile(caPath)
	if err != nil {
		return nil, err
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA cert")
	}

	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion:   tls.VersionTLS12,
		RootCAs:      caPool,
		Certificates: []tls.Certificate{cert},
	}, nil
}

func splitAndTrim(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			out = append(out, t)
		}
	}
	return out
}
