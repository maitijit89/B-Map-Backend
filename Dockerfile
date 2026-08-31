# ==========================================
# Stage 1: Build binary using Golang Alpine
# ==========================================
FROM golang:1.23-alpine AS builder

# Install build dependencies (git, ca-certificates, tzdata)
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Cache Go modules layers
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy full application source
COPY . .

# Build statically linked binary with optimizations (-w -s strips debug symbols)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /build/bin/b-map-server \
    ./cmd/server

# ==========================================
# Stage 2: Minimal Production Runtime
# ==========================================
FROM alpine:3.20

# Install runtime SSL certs, timezone data, and curl for healthchecks
RUN apk --no-cache add ca-certificates tzdata curl \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled binary and certificates from builder
COPY --from=builder /build/bin/b-map-server /app/b-map-server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Use non-root user for container security
USER appuser

# Expose server port
EXPOSE 8080

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Execute the application
ENTRYPOINT ["/app/b-map-server"]
