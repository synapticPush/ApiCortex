package model

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// TelemetryEvent represents a single API request/response observation.
//
// Contains timestamp, organization/API/endpoint identifiers, HTTP method/status,
// latency, message sizes, and optional schema/region information.
type TelemetryEvent struct {
	Timestamp         string `json:"timestamp"`
	OrgID             string `json:"org_id"`
	APIID             string `json:"api_id"`
	EndpointID        string `json:"endpoint_id,omitempty"`
	Endpoint          string `json:"endpoint"`
	Method            string `json:"method"`
	Status            int    `json:"status"`
	LatencyMS         int    `json:"latency_ms"`
	RequestSizeBytes  int    `json:"request_size_bytes,omitempty"`
	ResponseSizeBytes int    `json:"response_size_bytes,omitempty"`
	SchemaHash        string `json:"schema_hash,omitempty"`
	SchemaVersion     string `json:"schema_version,omitempty"`
	ClientRegion      string `json:"client_region,omitempty"`
}

// Validate checks that a TelemetryEvent has valid field values.
//
// Validates:
// - Timestamp is RFC3339 formatted
// - OrgID and APIID are valid UUIDs
// - EndpointID is valid UUID if provided
// - Endpoint length is < 256 characters
// - Method is uppercase
// - Status is valid HTTP status code (100-599)
// - Latency and message sizes are non-negative
//
// Returns error if any validation fails.
func (e TelemetryEvent) Validate() error {
	if strings.TrimSpace(e.Timestamp) == "" {
		return fmt.Errorf("timestamp is required")
	}
	if _, err := time.Parse(time.RFC3339, e.Timestamp); err != nil {
		return fmt.Errorf("timestamp must be RFC3339")
	}
	if strings.TrimSpace(e.OrgID) == "" {
		return fmt.Errorf("org_id is required")
	}
	if _, err := uuid.Parse(e.OrgID); err != nil {
		return fmt.Errorf("org_id must be a valid uuid")
	}
	if strings.TrimSpace(e.APIID) == "" {
		return fmt.Errorf("api_id is required")
	}
	if _, err := uuid.Parse(e.APIID); err != nil {
		return fmt.Errorf("api_id must be a valid uuid")
	}
	if strings.TrimSpace(e.EndpointID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(e.EndpointID)); err != nil {
			return fmt.Errorf("endpoint_id must be a valid uuid")
		}
	}
	if strings.TrimSpace(e.Endpoint) == "" {
		return fmt.Errorf("endpoint is required")
	}
	if len(e.Endpoint) >= 256 {
		return fmt.Errorf("endpoint length must be < 256")
	}
	if strings.TrimSpace(e.Method) == "" {
		return fmt.Errorf("method is required")
	}
	if strings.ToUpper(e.Method) != e.Method {
		return fmt.Errorf("method must be uppercase")
	}
	if e.Status < http.StatusContinue || e.Status > 599 {
		return fmt.Errorf("status must be a valid HTTP status")
	}
	if e.LatencyMS < 0 {
		return fmt.Errorf("latency_ms must be >= 0")
	}
	if e.RequestSizeBytes < 0 {
		return fmt.Errorf("request_size_bytes must be >= 0")
	}
	if e.ResponseSizeBytes < 0 {
		return fmt.Errorf("response_size_bytes must be >= 0")
	}
	return nil
}

// ValidateForModelProcessing validates a TelemetryEvent for processing and model input.
//
// Currently performs standard validation by calling Validate().
// Returns error if validation fails.
func (e TelemetryEvent) ValidateForModelProcessing() error {
	if err := e.Validate(); err != nil {
		return err
	}
	return nil
}
