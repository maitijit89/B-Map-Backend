# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o b_map_api ./cmd/api/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates

# Copy the binary from builder
COPY --from=builder /app/b_map_api .
COPY --from=builder /app/env.example .env

# Expose port
EXPOSE 8080

# Command to run
CMD ["./b_map_api"]
