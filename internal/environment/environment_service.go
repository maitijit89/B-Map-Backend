package environment

import (
	"context"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Pollutant struct {
	Code          string  `json:"code"` // "pm25", "pm10", "no2", "o3", "co"
	DisplayName   string  `json:"display_name"`
	Concentration float64 `json:"concentration"` // in ug/m3 or ppm
	Unit          string  `json:"unit"`
}

type AirQualityResponse struct {
	Location          utils.Coordinate `json:"location"`
	AQI               int              `json:"aqi"`
	Category          string           `json:"category"` // "Good", "Moderate", "Unhealthy"
	DominantPollutant string           `json:"dominant_pollutant"`
	Pollutants        []Pollutant      `json:"pollutants"`
	HealthAdvice      string           `json:"health_advice"`
}

type SolarPotentialResponse struct {
	Location          utils.Coordinate `json:"location"`
	MaxSunshineHours  float64          `json:"max_sunshine_hours_per_year"`
	CarbonOffsetKg    float64          `json:"carbon_offset_kg_per_year"`
	MaxArrayPanels    int              `json:"max_array_panels_count"`
	AnnualEnergyKWh   float64          `json:"annual_energy_kwh"`
	FinancialSavingsUSD float64        `json:"estimated_annual_savings_usd"`
}

type PollenResponse struct {
	Location utils.Coordinate `json:"location"`
	TreePollenIndex int       `json:"tree_pollen_index"` // 0-5
	GrassPollenIndex int      `json:"grass_pollen_index"`
	WeedPollenIndex int       `json:"weed_pollen_index"`
	Summary string            `json:"summary"`
}

type Service interface {
	GetAirQuality(ctx context.Context, lat, lng float64) (*AirQualityResponse, error)
	GetSolarPotential(ctx context.Context, lat, lng float64) (*SolarPotentialResponse, error)
	GetPollen(ctx context.Context, lat, lng float64) (*PollenResponse, error)
}

type environmentService struct{}

func NewEnvironmentService() Service {
	return &environmentService{}
}

func (s *environmentService) GetAirQuality(ctx context.Context, lat, lng float64) (*AirQualityResponse, error) {
	// Synthetic AQI interpolation model
	baseAQI := int(35 + 20*math.Sin(lat*5.0) + 15*math.Cos(lng*5.0))
	if baseAQI < 10 {
		baseAQI = 10
	}
	if baseAQI > 300 {
		baseAQI = 300
	}

	category := "Good"
	advice := "Air quality is satisfactory, and air pollution poses little or no risk."
	if baseAQI > 50 && baseAQI <= 100 {
		category = "Moderate"
		advice = "Air quality is acceptable; however, sensitive individuals may experience minor irritation."
	} else if baseAQI > 100 {
		category = "Unhealthy for Sensitive Groups"
		advice = "Members of sensitive groups may experience health effects. General public is less likely to be affected."
	}

	return &AirQualityResponse{
		Location:          utils.Coordinate{Latitude: lat, Longitude: lng},
		AQI:               baseAQI,
		Category:          category,
		DominantPollutant: "PM2.5",
		Pollutants: []Pollutant{
			{Code: "pm25", DisplayName: "PM2.5 (Fine particulate matter)", Concentration: float64(baseAQI) * 0.35, Unit: "µg/m³"},
			{Code: "pm10", DisplayName: "PM10 (Inhalable particles)", Concentration: float64(baseAQI) * 0.72, Unit: "µg/m³"},
			{Code: "no2", DisplayName: "Nitrogen Dioxide", Concentration: 14.2, Unit: "ppb"},
			{Code: "o3", DisplayName: "Ozone", Concentration: 28.5, Unit: "ppb"},
		},
		HealthAdvice: advice,
	}, nil
}

func (s *environmentService) GetSolarPotential(ctx context.Context, lat, lng float64) (*SolarPotentialResponse, error) {
	sunHours := 1650.0 + 400.0*math.Cos(lat*math.Pi/180.0)
	maxPanels := 24
	energyKWh := float64(maxPanels) * 400.0 * (sunHours / 1000.0)

	return &SolarPotentialResponse{
		Location:            utils.Coordinate{Latitude: lat, Longitude: lng},
		MaxSunshineHours:    math.Round(sunHours),
		CarbonOffsetKg:      math.Round(energyKWh * 0.42),
		MaxArrayPanels:      maxPanels,
		AnnualEnergyKWh:     math.Round(energyKWh),
		FinancialSavingsUSD: math.Round(energyKWh * 0.18),
	}, nil
}

func (s *environmentService) GetPollen(ctx context.Context, lat, lng float64) (*PollenResponse, error) {
	return &PollenResponse{
		Location:         utils.Coordinate{Latitude: lat, Longitude: lng},
		TreePollenIndex:  2,
		GrassPollenIndex: 1,
		WeedPollenIndex:  0,
		Summary:          "Low to moderate pollen levels detected.",
	}, nil
}
