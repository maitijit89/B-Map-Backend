package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	App        AppConfig
	JWT        JWTConfig
	DB         DatabaseConfig
	Redis      RedisConfig
	Cloudinary CloudinaryConfig
}

type AppConfig struct {
	Env  string
	Port string
	Name string
	URL  string
}

type JWTConfig struct {
	Secret      string
	ExpiryHours int
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
	TimeZone string
}

type RedisConfig struct {
	Host             string
	Port             string
	Password         string
	DB               int
	OTPExpiryMinutes int
}

type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
	Folder    string
}

// LoadConfig loads application configuration from .env and environment variables.
func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it, reading from system environment")
	}

	return &Config{
		App: AppConfig{
			Env:  getEnv("APP_ENV", "development"),
			Port: getEnv("APP_PORT", "8080"),
			Name: getEnv("APP_NAME", "B-Map-Backend"),
			URL:  getEnv("APP_URL", "http://localhost:8080"),
		},
		JWT: JWTConfig{
			Secret:      getEnv("JWT_SECRET", "super_secret_jwt_key_b_map_2026"),
			ExpiryHours: getEnvAsInt("JWT_EXPIRY_HOURS", 72),
		},
		DB: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "b_map_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
			TimeZone: getEnv("DB_TIMEZONE", "UTC"),
		},
		Redis: RedisConfig{
			Host:             getEnv("REDIS_HOST", "localhost"),
			Port:             getEnv("REDIS_PORT", "6379"),
			Password:         getEnv("REDIS_PASSWORD", ""),
			DB:               getEnvAsInt("REDIS_DB", 0),
			OTPExpiryMinutes: getEnvAsInt("OTP_EXPIRY_MINUTES", 5),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
			APIKey:    getEnv("CLOUDINARY_API_KEY", ""),
			APISecret: getEnv("CLOUDINARY_API_SECRET", ""),
			Folder:    getEnv("CLOUDINARY_FOLDER", "b_map_uploads"),
		},
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	strValue := getEnv(key, "")
	if value, err := strconv.Atoi(strValue); err == nil {
		return value
	}
	return fallback
}
