package fare

import (
	"context"
	"math"
	"strings"
	"time"
)

type IndianCity string

const (
	CityDelhi     IndianCity = "DELHI"
	CityMumbai    IndianCity = "MUMBAI"
	CityBengaluru IndianCity = "BENGALURU"
	CityKolkata   IndianCity = "KOLKATA"
	CityChennai   IndianCity = "CHENNAI"
	CityHyderabad IndianCity = "HYDERABAD"
)

type FareEstimateRequest struct {
	City           IndianCity `json:"city"`
	DistanceKm     float64    `json:"distance_km" binding:"required"`
	DurationMinutes int       `json:"duration_minutes"`
	IsNightTime    bool       `json:"is_night_time"` // 11 PM to 5 AM (auto-calculated if false and current hour is night)
}

type FareBreakdown struct {
	VehicleCategory string  `json:"vehicle_category"` // "Auto-Rickshaw (Metered)", "Kaali-Peeli Taxi (Non-AC)", "App Cab Economy", "App Cab Premium"
	BaseFareINR     float64 `json:"base_fare_inr"`
	PerKmRateINR    float64 `json:"per_km_rate_inr"`
	NightSurcharge  float64 `json:"night_surcharge_inr"`
	TotalEstimated  float64 `json:"total_estimated_inr"`
	Notes           string  `json:"notes,omitempty"`
}

type FareEstimateResponse struct {
	City          IndianCity      `json:"city"`
	DistanceKm    float64         `json:"distance_km"`
	DurationMins  int             `json:"duration_minutes"`
	IsNightActive bool            `json:"is_night_surcharge_active"`
	Fares         []FareBreakdown `json:"fare_options"`
}

type Service interface {
	EstimateFares(ctx context.Context, req *FareEstimateRequest) (*FareEstimateResponse, error)
}

type fareService struct{}

func NewFareService() Service {
	return &fareService{}
}

func (s *fareService) EstimateFares(ctx context.Context, req *FareEstimateRequest) (*FareEstimateResponse, error) {
	city := req.City
	if city == "" {
		city = CityDelhi
	}

	dist := req.DistanceKm
	if dist < 0.5 {
		dist = 0.5
	}

	// Check if current hour in IST is night time (11:00 PM to 5:00 AM)
	isNight := req.IsNightTime
	ist := time.Now().UTC().Add(5*time.Hour + 30*time.Minute)
	if ist.Hour() >= 23 || ist.Hour() < 5 {
		isNight = true
	}

	var fares []FareBreakdown

	switch strings.ToUpper(string(city)) {
	case string(CityMumbai):
		// Mumbai Auto RTO: Base ₹23 for first 1.5km, ₹15.33/km after. Night +25%
		autoBase := 23.0
		extraKm := math.Max(0, dist-1.5)
		autoTotal := autoBase + (extraKm * 15.33)
		nightExtra := 0.0
		if isNight {
			nightExtra = autoTotal * 0.25
			autoTotal += nightExtra
		}

		// Mumbai Kaali Peeli Taxi: Base ₹28 for first 1.5km, ₹18.66/km
		taxiBase := 28.0
		taxiTotal := taxiBase + (extraKm * 18.66)
		if isNight {
			taxiTotal += taxiTotal * 0.25
		}

		fares = []FareBreakdown{
			{
				VehicleCategory: "Metered Auto-Rickshaw", BaseFareINR: 23.0, PerKmRateINR: 15.33,
				NightSurcharge: math.Round(nightExtra*100) / 100, TotalEstimated: math.Round(autoTotal),
				Notes: "Official Mumbai RTO Meter Fare (Zero Surge Pricing)",
			},
			{
				VehicleCategory: "Kaali-Peeli Taxi (Non-AC)", BaseFareINR: 28.0, PerKmRateINR: 18.66,
				NightSurcharge: math.Round(nightExtra*100) / 100, TotalEstimated: math.Round(taxiTotal),
				Notes: "Official Mumbai Taxi Meter Fare",
			},
			{
				VehicleCategory: "App Cab Prime (AC)", BaseFareINR: 50.0, PerKmRateINR: 18.0,
				TotalEstimated: math.Round(60.0 + (dist * 17.5)), Notes: "Includes AC, Dynamic demand pricing applies",
			},
		}

	case string(CityBengaluru):
		// Bengaluru Auto RTO: Base ₹30 for first 2.0km, ₹15/km after. Night +50%
		autoBase := 30.0
		extraKm := math.Max(0, dist-2.0)
		autoTotal := autoBase + (extraKm * 15.0)
		nightExtra := 0.0
		if isNight {
			nightExtra = autoTotal * 0.50
			autoTotal += nightExtra
		}

		fares = []FareBreakdown{
			{
				VehicleCategory: "Metered Auto-Rickshaw", BaseFareINR: 30.0, PerKmRateINR: 15.0,
				NightSurcharge: math.Round(nightExtra*100) / 100, TotalEstimated: math.Round(autoTotal),
				Notes: "Official Bengaluru RTO Meter Fare (+50% between 10PM-5AM)",
			},
			{
				VehicleCategory: "App Cab Economy", BaseFareINR: 60.0, PerKmRateINR: 16.0,
				TotalEstimated: math.Round(70.0 + (dist * 16.5)), Notes: "App-based dynamic cab",
			},
		}

	default: // Delhi NCR
		// Delhi Auto RTO: Base ₹30 for first 1.5km, ₹11/km after. Night +25%
		autoBase := 30.0
		extraKm := math.Max(0, dist-1.5)
		autoTotal := autoBase + (extraKm * 11.0)
		nightExtra := 0.0
		if isNight {
			nightExtra = autoTotal * 0.25
			autoTotal += nightExtra
		}

		fares = []FareBreakdown{
			{
				VehicleCategory: "Metered Auto-Rickshaw", BaseFareINR: 30.0, PerKmRateINR: 11.0,
				NightSurcharge: math.Round(nightExtra*100) / 100, TotalEstimated: math.Round(autoTotal),
				Notes: "Official Delhi Transport Department Meter Tariff",
			},
			{
				VehicleCategory: "App Cab Mini (AC)", BaseFareINR: 50.0, PerKmRateINR: 14.5,
				TotalEstimated: math.Round(55.0 + (dist * 14.5)), Notes: "Standard Cab Tier",
			},
			{
				VehicleCategory: "App Bike Taxi", BaseFareINR: 20.0, PerKmRateINR: 6.5,
				TotalEstimated: math.Round(25.0 + (dist * 7.0)), Notes: "Fastest navigation through congested gullies",
			},
		}
	}

	return &FareEstimateResponse{
		City:          city,
		DistanceKm:    dist,
		DurationMins:  req.DurationMinutes,
		IsNightActive: isNight,
		Fares:         fares,
	}, nil
}
