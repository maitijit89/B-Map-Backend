package database

import (
	"fmt"
	"log"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitPostgres sets up the PostgreSQL connection with PostGIS and runs initial migrations.
func InitPostgres(cfg *config.DatabaseConfig, appEnv string) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		cfg.Host, cfg.User, cfg.Password, cfg.DBName, cfg.Port, cfg.SSLMode, cfg.TimeZone,
	)

	logLevel := logger.Warn
	if appEnv == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB instance: %w", err)
	}

	// Connection pooling configuration
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Ensure PostGIS extension is enabled
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS postgis;").Error; err != nil {
		log.Printf("Warning: Failed to enable PostGIS extension (ensure superuser permissions): %v", err)
	} else {
		log.Println("PostGIS extension initialized successfully")
	}

	return db, nil
}
