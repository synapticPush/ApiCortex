FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /out/ingest-service ./cmd/server

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=builder /out/ingest-service /app/ingest-service
USER appuser
EXPOSE 8080
ENTRYPOINT ["/app/ingest-service"]
