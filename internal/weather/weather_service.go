package weather

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type IMDAlertLevel string

const (
	AlertGreen  IMDAlertLevel = "GREEN_NO_WARNING"
	AlertYellow IMDAlertLevel = "YELLOW_BE_AWARE"
	AlertOrange IMDAlertLevel = "ORANGE_BE_PREPARED"
	AlertRed    IMDAlertLevel = "RED_TAKE_ACTION"
)

type WeatherHazardType string

const (
	HazardDenseFog       WeatherHazardType = "DENSE_WINTER_FOG"
	HazardHeavyRain      WeatherHazardType = "HEAVY_MONSOON_RAINFALL"
	HazardHeatwave       WeatherHazardType = "EXTREME_HEATWAVE"
	HazardAirQualityPoor WeatherHazardType = "SEVERE_AQI_SMOG"
)

type HighwayWeatherReport struct {
	Location          utils.Coordinate  `json:"location"`
	HighwayName       string            `json:"highway_name"` // "Yamuna Expressway", "NH-44", "Mumbai-Pune"
	TemperatureC      float64           `json:"temperature_celsius"`
	VisibilityMeters  float64           `json:"visibility_meters"`
	IsDenseFog        bool              `json:"is_dense_fog_active"` // Visibility < 50 meters
	RainfallMmPerHour float64           `json:"rainfall_mm_per_hour"`
	IMDAlert          IMDAlertLevel     `json:"imd_alert_level"`
	HazardType        WeatherHazardType `json:"hazard_type,omitempty"`
	SafetyAdvisory    string            `json:"safety_advisory"`
	ReportedAt        time.Time         `json:"reported_at"`
	IsManualOverride  bool              `json:"is_manual_override,omitempty"`
}

type ManualWeatherOverride struct {
	HighwayName       string            `json:"highway_name" binding:"required"`
	TemperatureC      float64           `json:"temperature_celsius"`
	VisibilityMeters  float64           `json:"visibility_meters"`
	IsDenseFog        bool              `json:"is_dense_fog_active"`
	RainfallMmPerHour float64           `json:"rainfall_mm_per_hour"`
	IMDAlert          IMDAlertLevel     `json:"imd_alert_level"`
	HazardType        WeatherHazardType `json:"hazard_type"`
	SafetyAdvisory    string            `json:"safety_advisory"`
	UpdatedBy         string            `json:"updated_by,omitempty"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

type Service interface {
	GetHighwayWeather(ctx context.Context, lat, lng float64, highway string) (*HighwayWeatherReport, error)
	SetManualOverride(override ManualWeatherOverride)
	GetActiveOverrides() []ManualWeatherOverride
	DeleteOverride(highwayName string) bool
}

type weatherService struct {
	overrides map[string]ManualWeatherOverride
	mu        sync.RWMutex
}

func NewWeatherService() Service {
	return &weatherService{
		overrides: make(map[string]ManualWeatherOverride),
	}
}

func (s *weatherService) SetManualOverride(override ManualWeatherOverride) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := strings.ToLower(strings.TrimSpace(override.HighwayName))
	override.UpdatedAt = time.Now().UTC()
	s.overrides[key] = override
}

func (s *weatherService) GetActiveOverrides() []ManualWeatherOverride {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]ManualWeatherOverride, 0, len(s.overrides))
	for _, v := range s.overrides {
		list = append(list, v)
	}
	return list
}

func (s *weatherService) DeleteOverride(highwayName string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := strings.ToLower(strings.TrimSpace(highwayName))
	if _, exists := s.overrides[key]; exists {
		delete(s.overrides, key)
		return true
	}
	return false
}

func (s *weatherService) GetHighwayWeather(ctx context.Context, lat, lng float64, highway string) (*HighwayWeatherReport, error) {
	s.mu.RLock()
	key := strings.ToLower(strings.TrimSpace(highway))
	if override, exists := s.overrides[key]; exists {
		s.mu.RUnlock()
		return &HighwayWeatherReport{
			Location:          utils.Coordinate{Latitude: lat, Longitude: lng},
			HighwayName:       override.HighwayName,
			TemperatureC:      override.TemperatureC,
			VisibilityMeters:  override.VisibilityMeters,
			IsDenseFog:        override.IsDenseFog,
			RainfallMmPerHour: override.RainfallMmPerHour,
			IMDAlert:          override.IMDAlert,
			HazardType:        override.HazardType,
			SafetyAdvisory:    override.SafetyAdvisory,
			ReportedAt:        override.UpdatedAt,
			IsManualOverride:  true,
		}, nil
	}
	s.mu.RUnlock()

	vis := 1500.0
	isFog := false
	alert := AlertGreen
	var hazard WeatherHazardType = ""
	advisory := "Normal driving conditions. Maintain standard highway speeds."

	// Check North India winter fog corridor (Lat 27 - 31 N during winter / early morning)
	if lat >= 27.0 && lat <= 31.0 && (highway == "Yamuna Expressway" || highway == "NH-44" || highway == "NE-4") {
		vis = 35.0 // 35 meters visibility (Dense Fog)
		isFog = true
		alert = AlertOrange
		hazard = HazardDenseFog
		advisory = "Caution: Extreme Dense Fog on Expressway. Visibility below 40 meters. Turn ON fog lamps and keep speed below 50 km/h."
	}

	return &HighwayWeatherReport{
		Location:          utils.Coordinate{Latitude: lat, Longitude: lng},
		HighwayName:       highway,
		TemperatureC:      16.5,
		VisibilityMeters:  vis,
		IsDenseFog:        isFog,
		RainfallMmPerHour: 0.0,
		IMDAlert:          alert,
		HazardType:        hazard,
		SafetyAdvisory:    advisory,
		ReportedAt:        time.Now().UTC(),
		IsManualOverride:  false,
	}, nil
}
