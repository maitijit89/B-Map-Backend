package version

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/response"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	RedisKeyVersionConfig = "app:version:config"
	MongoConfigDocID      = "app_version_config"
)

// AppVersionConfig contains the full metadata for the application version.
type AppVersionConfig struct {
	ID           string    `json:"id,omitempty" bson:"_id,omitempty"`
	Version      string    `json:"version" bson:"version"`
	VersionCode  int       `json:"version_code" bson:"version_code"`
	MinVersion   string    `json:"min_version" bson:"min_version"`
	ForceUpdate  bool      `json:"force_update" bson:"force_update"`
	Title        string    `json:"title" bson:"title"`
	ReleaseNotes string    `json:"release_notes" bson:"release_notes"`
	DownloadURL  string    `json:"download_url" bson:"download_url"`
	ApkURL       string    `json:"apk_url" bson:"apk_url"`
	Platform     string    `json:"platform" bson:"platform"` // "android", "ios", "all"
	UpdatedAt    time.Time `json:"updated_at" bson:"updated_at"`
	UpdatedBy    string    `json:"updated_by,omitempty" bson:"updated_by,omitempty"`
}

// PatchVersionRequest is the DTO used to update the version metadata.
type PatchVersionRequest struct {
	Version      *string `json:"version"`
	VersionCode  *int    `json:"version_code"`
	MinVersion   *string `json:"min_version"`
	ForceUpdate  *bool   `json:"force_update"`
	Title        *string `json:"title"`
	ReleaseNotes *string `json:"release_notes"`
	DownloadURL  *string `json:"download_url"`
	ApkURL       *string `json:"apk_url"`
	Platform     *string `json:"platform"`
}

// CheckUpdateResponse is the response returned when clients check for updates.
type CheckUpdateResponse struct {
	CurrentVersion    string `json:"current_version"`
	LatestVersion     string `json:"latest_version"`
	LatestVersionCode int    `json:"latest_version_code"`
	MinVersion        string `json:"min_version"`
	UpdateAvailable   bool   `json:"update_available"`
	IsMandatory       bool   `json:"is_mandatory"`
	Title             string `json:"title"`
	ReleaseNotes      string `json:"release_notes"`
	DownloadURL       string `json:"download_url"`
	ApkURL            string `json:"apk_url"`
	Platform          string `json:"platform"`
	PublishedAt       string `json:"published_at"`
}

// Service defines the contract for version management.
type Service interface {
	GetVersion(ctx context.Context) (*AppVersionConfig, error)
	GetActiveVersion() string
	CheckUpdate(ctx context.Context, currentVer string, currentCode int, platform string) (*CheckUpdateResponse, error)
	PatchVersion(ctx context.Context, req *PatchVersionRequest, updatedBy string) (*AppVersionConfig, error)
}

type versionService struct {
	mu           sync.RWMutex
	current      AppVersionConfig
	db           *mongo.Database
	rdb          *redis.Client
	dbCollection *mongo.Collection
}

// NewVersionService initializes the version service with default version and syncs from MongoDB/Redis.
func NewVersionService(defaultVersion string, db *mongo.Database, rdb *redis.Client) Service {
	if defaultVersion == "" {
		defaultVersion = "0.1.2"
	}

	svc := &versionService{
		current: AppVersionConfig{
			ID:           MongoConfigDocID,
			Version:      defaultVersion,
			VersionCode:  parseVersionCode(defaultVersion),
			MinVersion:   "0.1.0",
			ForceUpdate:  false,
			Title:        "B-Map Navigation System",
			ReleaseNotes: "Initial Indian Geospatial Navigation release",
			DownloadURL:  "",
			ApkURL:       "",
			Platform:     "android",
			UpdatedAt:    time.Now().UTC(),
			UpdatedBy:    "system",
		},
		db:  db,
		rdb: rdb,
	}

	if db != nil {
		svc.dbCollection = db.Collection("system_config")
	}

	// Initialize state from storage
	svc.loadInitialConfig(context.Background())

	// Sync response package global version
	response.SetAppVersion(svc.current.Version)

	return svc
}

// loadInitialConfig attempts to load configuration from Redis or MongoDB.
func (s *versionService) loadInitialConfig(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Try Redis
	if s.rdb != nil {
		val, err := s.rdb.Get(ctx, RedisKeyVersionConfig).Result()
		if err == nil && val != "" {
			var cfg AppVersionConfig
			if jsonErr := json.Unmarshal([]byte(val), &cfg); jsonErr == nil && cfg.Version != "" {
				s.current = cfg
				return
			}
		}
	}

	// 2. Try MongoDB
	if s.dbCollection != nil {
		var cfg AppVersionConfig
		err := s.dbCollection.FindOne(ctx, bson.M{"_id": MongoConfigDocID}).Decode(&cfg)
		if err == nil && cfg.Version != "" {
			s.current = cfg
			// Cache in Redis
			if s.rdb != nil {
				if b, mErr := json.Marshal(cfg); mErr == nil {
					_ = s.rdb.Set(ctx, RedisKeyVersionConfig, string(b), 24*time.Hour).Err()
				}
			}
			return
		}

		// If not found in MongoDB, persist initial default
		_, _ = s.dbCollection.UpdateOne(
			ctx,
			bson.M{"_id": MongoConfigDocID},
			bson.M{"$set": s.current},
			options.UpdateOne().SetUpsert(true),
		)
	}

	// Cache in Redis
	if s.rdb != nil {
		if b, err := json.Marshal(s.current); err == nil {
			_ = s.rdb.Set(ctx, RedisKeyVersionConfig, string(b), 24*time.Hour).Err()
		}
	}
}

// GetVersion returns the current version metadata.
func (s *versionService) GetVersion(ctx context.Context) (*AppVersionConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cfg := s.current
	return &cfg, nil
}

// GetActiveVersion returns the active version string.
func (s *versionService) GetActiveVersion() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current.Version
}

// CheckUpdate checks if the client's current version needs an update.
func (s *versionService) CheckUpdate(ctx context.Context, currentVer string, currentCode int, platform string) (*CheckUpdateResponse, error) {
	s.mu.RLock()
	cfg := s.current
	s.mu.RUnlock()

	currentVer = cleanVersion(currentVer)
	if currentVer == "" {
		currentVer = "0.0.0"
	}

	// Compare current version against latest version
	cmpLatest := CompareVersions(currentVer, cfg.Version)
	updateAvailable := cmpLatest < 0

	// If version code provided, also check if code is lower
	if currentCode > 0 && cfg.VersionCode > 0 && currentCode < cfg.VersionCode {
		updateAvailable = true
	}

	// Determine if update is mandatory
	isMandatory := cfg.ForceUpdate
	if !isMandatory && cfg.MinVersion != "" {
		cmpMin := CompareVersions(currentVer, cfg.MinVersion)
		if cmpMin < 0 {
			isMandatory = true
		}
	}

	targetPlatform := cfg.Platform
	if targetPlatform == "" {
		targetPlatform = "android"
	}

	return &CheckUpdateResponse{
		CurrentVersion:    currentVer,
		LatestVersion:     cfg.Version,
		LatestVersionCode: cfg.VersionCode,
		MinVersion:        cfg.MinVersion,
		UpdateAvailable:   updateAvailable,
		IsMandatory:       isMandatory,
		Title:             cfg.Title,
		ReleaseNotes:      cfg.ReleaseNotes,
		DownloadURL:       cfg.DownloadURL,
		ApkURL:            cfg.ApkURL,
		Platform:          targetPlatform,
		PublishedAt:       cfg.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// PatchVersion applies partial updates to the version configuration and persists changes.
func (s *versionService) PatchVersion(ctx context.Context, req *PatchVersionRequest, updatedBy string) (*AppVersionConfig, error) {
	if req == nil {
		return nil, fmt.Errorf("request body cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if req.Version != nil && strings.TrimSpace(*req.Version) != "" {
		cleanVer := cleanVersion(*req.Version)
		s.current.Version = cleanVer
		if req.VersionCode == nil {
			s.current.VersionCode = parseVersionCode(cleanVer)
		}
	}
	if req.VersionCode != nil {
		s.current.VersionCode = *req.VersionCode
	}
	if req.MinVersion != nil {
		s.current.MinVersion = cleanVersion(*req.MinVersion)
	}
	if req.ForceUpdate != nil {
		s.current.ForceUpdate = *req.ForceUpdate
	}
	if req.Title != nil {
		s.current.Title = *req.Title
	}
	if req.ReleaseNotes != nil {
		s.current.ReleaseNotes = *req.ReleaseNotes
	}
	if req.DownloadURL != nil {
		s.current.DownloadURL = *req.DownloadURL
	}
	if req.ApkURL != nil {
		s.current.ApkURL = *req.ApkURL
	}
	if req.Platform != nil && strings.TrimSpace(*req.Platform) != "" {
		s.current.Platform = *req.Platform
	}

	s.current.UpdatedAt = time.Now().UTC()
	if updatedBy != "" {
		s.current.UpdatedBy = updatedBy
	}

	// Update response package global version
	response.SetAppVersion(s.current.Version)

	// Persist to MongoDB
	if s.dbCollection != nil {
		_, err := s.dbCollection.UpdateOne(
			ctx,
			bson.M{"_id": MongoConfigDocID},
			bson.M{"$set": s.current},
			options.UpdateOne().SetUpsert(true),
		)
		if err != nil {
			// Log but don't fail in-memory update
		}
	}

	// Persist to Redis
	if s.rdb != nil {
		if b, err := json.Marshal(s.current); err == nil {
			_ = s.rdb.Set(ctx, RedisKeyVersionConfig, string(b), 24*time.Hour).Err()
		}
	}

	cfgCopy := s.current
	return &cfgCopy, nil
}

// CompareVersions compares two semver strings (e.g., "0.1.2" vs "0.1.3").
// Returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2.
func CompareVersions(v1, v2 string) int {
	parts1 := splitVersion(v1)
	parts2 := splitVersion(v2)

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		p1 := 0
		if i < len(parts1) {
			p1 = parts1[i]
		}
		p2 := 0
		if i < len(parts2) {
			p2 = parts2[i]
		}

		if p1 < p2 {
			return -1
		}
		if p1 > p2 {
			return 1
		}
	}

	return 0
}

func cleanVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	return v
}

func splitVersion(v string) []int {
	clean := cleanVersion(v)
	if clean == "" {
		return []int{0}
	}
	parts := strings.Split(clean, ".")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		// Strip any non-digit suffix (e.g. "2-beta" -> 2)
		var digits strings.Builder
		for _, r := range p {
			if r >= '0' && r <= '9' {
				digits.WriteRune(r)
			} else {
				break
			}
		}
		num, err := strconv.Atoi(digits.String())
		if err != nil {
			nums = append(nums, 0)
		} else {
			nums = append(nums, num)
		}
	}
	return nums
}

func parseVersionCode(v string) int {
	nums := splitVersion(v)
	code := 0
	multiplier := 10000
	for i, n := range nums {
		if i >= 3 {
			break
		}
		code += n * multiplier
		multiplier /= 100
	}
	if code == 0 {
		return 1
	}
	return code
}
