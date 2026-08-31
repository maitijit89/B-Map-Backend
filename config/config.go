package config

import (
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
	GoogleMaps GoogleMapsConfig
	SMTP       SMTPConfig
	KeepAlive  KeepAliveConfig
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
	URI      string
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

type RedisConfig struct {
	URL              string
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

type GoogleMapsConfig struct {
	APIKey       string
	PlacesAPIKey string
	APISecret    string
}

type SMTPConfig struct {
	Host      string
	Port      int
	Username  string
	Password  string
	FromEmail string
	FromName  string
}

type KeepAliveConfig struct {
	Enabled         bool
	IntervalMinutes int
	TargetURL       string
}

// LoadConfig loads application configuration from .env and environment variables.
func LoadConfig() *Config {
	_ = godotenv.Load(".env", "../../.env", "../.env")

	port := getEnv("APP_PORT", "8080")
	appURL := getEnv("APP_URL", "http://localhost:"+port)

	return &Config{
		App: AppConfig{
			Env:  getEnv("APP_ENV", "development"),
			Port: port,
			Name: getEnv("APP_NAME", "B Map"),
			URL:  appURL,
		},
		JWT: JWTConfig{
			Secret:      getEnv("JWT_SECRET", "super_secret_jwt_key_b_map_2026"),
			ExpiryHours: getEnvAsInt("JWT_EXPIRY_HOURS", 72),
		},
		DB: DatabaseConfig{
			URI:      getEnv("MONGODB_URI", getEnv("MONGO_URL", getEnv("DATABASE_URL", ""))),
			Host:     getEnv("DB_HOST", getEnv("MONGO_HOST", "localhost")),
			Port:     getEnv("DB_PORT", getEnv("MONGO_PORT", "27017")),
			User:     getEnv("DB_USER", getEnv("MONGO_USER", "")),
			Password: getEnv("DB_PASSWORD", getEnv("MONGO_PASSWORD", "")),
			DBName:   getEnv("DB_NAME", getEnv("MONGO_DB", "b_map_db")),
		},
		Redis: RedisConfig{
			URL:              getEnv("REDIS_URL", "rediss://default:gQAAAAAAA_M6AAIgcDI3ZTIxZjE2N2RmYmQ0MzA2YjRjNDIxOTQ2YmVhMGVlNw@national-bug-258874.upstash.io:6379"),
			Host:             getEnv("REDIS_HOST", "national-bug-258874.upstash.io"),
			Port:             getEnv("REDIS_PORT", "6379"),
			Password:         getEnv("REDIS_PASSWORD", "gQAAAAAAA_M6AAIgcDI3ZTIxZjE2N2RmYmQ0MzA2YjRjNDIxOTQ2YmVhMGVlNw"),
			DB:               getEnvAsInt("REDIS_DB", 0),
			OTPExpiryMinutes: getEnvAsInt("OTP_EXPIRY_MINUTES", 5),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: getEnv("CLOUDINARY_CLOUD_NAME", "jon6vask"),
			APIKey:    getEnv("CLOUDINARY_API_KEY", "439324579931125"),
			APISecret: getEnv("CLOUDINARY_API_SECRET", "9346Mxh4TmJd-anhDqFVPqDKCgg"),
			Folder:    getEnv("CLOUDINARY_FOLDER", "b_map_uploads"),
		},
		GoogleMaps: GoogleMapsConfig{
			APIKey:       getEnv("GOOGLE_MAPS_API_KEY", "AIzaSyC5xaYmrltiPZaNNzAwc62ULZoSXFe0IPc"),
			PlacesAPIKey: getEnv("GOOGLE_PLACES_API_KEY", "AIzaSyC5xaYmrltiPZaNNzAwc62ULZoSXFe0IPc"),
			APISecret:    getEnv("GOOGLE_MAPS_API_SECRET", "ojqqznoex52Tp0KTbD8D4xbFGtk="),
		},
		SMTP: SMTPConfig{
			Host:      getEnv("SMTP_HOST", "smtp.gmail.com"),
			Port:      getEnvAsInt("SMTP_PORT", 587),
			Username:  getEnv("SMTP_USERNAME", "maitidebjit2@gmail.com"),
			Password:  getEnv("SMTP_PASSWORD", "zrlq mahe eyeq lkhh"),
			FromEmail: getEnv("SMTP_FROM_EMAIL", "maitidebjit2@gmail.com"),
			FromName:  getEnv("SMTP_FROM_NAME", "B Map"),
		},
		KeepAlive: KeepAliveConfig{
			Enabled:         getEnvAsBool("KEEPALIVE_ENABLED", true),
			IntervalMinutes: getEnvAsInt("KEEPALIVE_INTERVAL_MINUTES", 2),
			TargetURL:       getEnv("KEEPALIVE_TARGET_URL", appURL+"/health"),
		},
	}
}

func getEnvAsBool(key string, fallback bool) bool {
	strValue := getEnv(key, "")
	if strValue == "" {
		return fallback
	}
	val, err := strconv.ParseBool(strValue)
	if err == nil {
		return val
	}
	return fallback
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
