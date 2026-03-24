package storage

import (
	"context"
	"database/sql"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"ingest-service/internal/model"
)

type TimescaleWriter struct {
	db *sql.DB
}

func NewTimescaleWriter(databaseURL string) (*TimescaleWriter, error) {
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
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &TimescaleWriter{db: db}, nil
}

func (w *TimescaleWriter) WriteBatch(ctx context.Context, events []model.TelemetryEvent) error {
	if w == nil || w.db == nil || len(events) == 0 {
		return nil
	}
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO api_telemetry (
			time, org_id, api_id, endpoint, method, status, latency_ms, request_size, response_size
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for i := range events {
		eventTime, parseErr := time.Parse(time.RFC3339, events[i].Timestamp)
		if parseErr != nil {
			_ = tx.Rollback()
			return parseErr
		}
		_, execErr := stmt.ExecContext(
			ctx,
			eventTime,
			events[i].OrgID,
			events[i].APIID,
			events[i].Endpoint,
			events[i].Method,
			events[i].Status,
			events[i].LatencyMS,
			events[i].RequestSizeBytes,
			events[i].ResponseSizeBytes,
		)
		if execErr != nil {
			_ = tx.Rollback()
			return execErr
		}
	}
	return tx.Commit()
}

func (w *TimescaleWriter) Close() error {
	if w == nil || w.db == nil {
		return nil
	}
	return w.db.Close()
}
