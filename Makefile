.PHONY: all build run test clean docker-build docker-up lint coverage

APP_NAME=bmap-server
BIN_DIR=bin

all: test build

build:
	@echo "==> Building $(APP_NAME)..."
	@go build -o $(BIN_DIR)/$(APP_NAME) ./cmd/server

run: build
	@echo "==> Running $(APP_NAME)..."
	@./$(BIN_DIR)/$(APP_NAME)

test:
	@echo "==> Running test suite..."
	@go test -v -race ./...

coverage:
	@echo "==> Generating test coverage report..."
	@go test -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

docker-build:
	@echo "==> Building Docker image..."
	@docker build -t $(APP_NAME):latest .

docker-up:
	@echo "==> Starting containers via Docker Compose..."
	@docker-compose up -d

clean:
	@echo "==> Cleaning build artifacts..."
	@rm -rf $(BIN_DIR) coverage.out coverage.html
