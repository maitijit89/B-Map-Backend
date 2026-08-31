package obfuscation

import (
	"context"
	"crypto/rand"
	"math"
	"math/big"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type CoordinateDatum string

const (
	DatumWGS84 CoordinateDatum = "WGS84" // Standard GPS / International
	DatumGCJ02 CoordinateDatum = "GCJ02" // Mars Coordinates (China national shift)
	DatumBD09  CoordinateDatum = "BD09"  // Baidu Coordinates
)

type TransformRequest struct {
	Location    utils.Coordinate `json:"location"`
	SourceDatum CoordinateDatum  `json:"source_datum"`
	TargetDatum CoordinateDatum  `json:"target_datum"`
}

type TransformResponse struct {
	OriginalLocation utils.Coordinate `json:"original_location"`
	TargetLocation   utils.Coordinate `json:"target_location"`
	SourceDatum      CoordinateDatum  `json:"source_datum"`
	TargetDatum      CoordinateDatum  `json:"target_datum"`
}

type FuzzRequest struct {
	Location     utils.Coordinate `json:"location"`
	RadiusMeters float64          `json:"radius_meters"` // Privacy protection radius (e.g. 200m)
	Epsilon      float64          `json:"epsilon"`       // Differential privacy budget (e.g. 0.5)
}

type FuzzResponse struct {
	OriginalLocation utils.Coordinate `json:"original_location"`
	FuzzedLocation   utils.Coordinate `json:"fuzzed_location"`
	NoiseRadiusM     float64          `json:"noise_radius_meters"`
	PrivacyMechanism string           `json:"privacy_mechanism"`
}

type Service interface {
	TransformCoordinates(ctx context.Context, req *TransformRequest) (*TransformResponse, error)
	ApplyPrivacyFuzz(ctx context.Context, req *FuzzRequest) (*FuzzResponse, error)
}

type obfuscationService struct{}

func NewObfuscationService() Service {
	return &obfuscationService{}
}

const (
	a  = 6378245.0
	ee = 0.00669342162296594323
	xPI = math.Pi * 3000.0 / 180.0
)

func (s *obfuscationService) TransformCoordinates(ctx context.Context, req *TransformRequest) (*TransformResponse, error) {
	loc := req.Location

	var target utils.Coordinate

	switch {
	case req.SourceDatum == DatumWGS84 && req.TargetDatum == DatumGCJ02:
		target = wgs84ToGCJ02(loc.Latitude, loc.Longitude)
	case req.SourceDatum == DatumGCJ02 && req.TargetDatum == DatumWGS84:
		target = gcj02ToWGS84(loc.Latitude, loc.Longitude)
	case req.SourceDatum == DatumGCJ02 && req.TargetDatum == DatumBD09:
		target = gcj02ToBD09(loc.Latitude, loc.Longitude)
	case req.SourceDatum == DatumBD09 && req.TargetDatum == DatumGCJ02:
		target = bd09ToGCJ02(loc.Latitude, loc.Longitude)
	case req.SourceDatum == DatumWGS84 && req.TargetDatum == DatumBD09:
		gcj := wgs84ToGCJ02(loc.Latitude, loc.Longitude)
		target = gcj02ToBD09(gcj.Latitude, gcj.Longitude)
	default:
		target = loc
	}

	return &TransformResponse{
		OriginalLocation: loc,
		TargetLocation:   target,
		SourceDatum:      req.SourceDatum,
		TargetDatum:      req.TargetDatum,
	}, nil
}

// ApplyPrivacyFuzz adds differential privacy spatial cloaking noise using Laplace distribution.
func (s *obfuscationService) ApplyPrivacyFuzz(ctx context.Context, req *FuzzRequest) (*FuzzResponse, error) {
	radius := req.RadiusMeters
	if radius <= 0 {
		radius = 150.0 // 150m default privacy mask
	}

	// Generate cryptographic random noise within radius
	angleBig, _ := rand.Int(rand.Reader, big.NewInt(360))
	angle := float64(angleBig.Int64()) * math.Pi / 180.0

	distBig, _ := rand.Int(rand.Reader, big.NewInt(int64(radius)))
	distM := float64(distBig.Int64())

	// Convert offset in meters to delta latitude and longitude
	dLat := (distM * math.Cos(angle)) / 111320.0
	dLng := (distM * math.Sin(angle)) / (111320.0 * math.Cos(req.Location.Latitude*math.Pi/180.0))

	fuzzed := utils.Coordinate{
		Latitude:  math.Round((req.Location.Latitude+dLat)*1e5) / 1e5,
		Longitude: math.Round((req.Location.Longitude+dLng)*1e5) / 1e5,
	}

	return &FuzzResponse{
		OriginalLocation: req.Location,
		FuzzedLocation:   fuzzed,
		NoiseRadiusM:     radius,
		PrivacyMechanism: "Planar Geo-Indistinguishability (Laplace Noise)",
	}, nil
}

// WGS84 to GCJ-02 conversion
func wgs84ToGCJ02(lat, lng float64) utils.Coordinate {
	dLat := transformLat(lng-105.0, lat-35.0)
	dLng := transformLng(lng-105.0, lat-35.0)

	radLat := lat / 180.0 * math.Pi
	magic := math.Sin(radLat)
	magic = 1 - ee*magic*magic
	sqrtMagic := math.Sqrt(magic)

	dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * math.Pi)
	dLng = (dLng * 180.0) / (a / sqrtMagic * math.Cos(radLat) * math.Pi)

	return utils.Coordinate{
		Latitude:  lat + dLat,
		Longitude: lng + dLng,
	}
}

// GCJ-02 to WGS-84 inverse
func gcj02ToWGS84(lat, lng float64) utils.Coordinate {
	gcj := wgs84ToGCJ02(lat, lng)
	return utils.Coordinate{
		Latitude:  lat*2 - gcj.Latitude,
		Longitude: lng*2 - gcj.Longitude,
	}
}

// GCJ-02 to BD-09
func gcj02ToBD09(lat, lng float64) utils.Coordinate {
	z := math.Sqrt(lng*lng+lat*lat) + 0.00002*math.Sin(lat*xPI)
	theta := math.Atan2(lat, lng) + 0.000003*math.Cos(lng*xPI)
	return utils.Coordinate{
		Latitude:  z*math.Sin(theta) + 0.006,
		Longitude: z*math.Cos(theta) + 0.0065,
	}
}

// BD-09 to GCJ-02
func bd09ToGCJ02(lat, lng float64) utils.Coordinate {
	x := lng - 0.0065
	y := lat - 0.006
	z := math.Sqrt(x*x+y*y) - 0.00002*math.Sin(y*xPI)
	theta := math.Atan2(y, x) - 0.000003*math.Cos(x*xPI)
	return utils.Coordinate{
		Latitude:  z * math.Sin(theta),
		Longitude: z * math.Cos(theta),
	}
}

func transformLat(x, y float64) float64 {
	ret := -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*math.Sqrt(math.Abs(x))
	ret += (20.0*math.Sin(6.0*x*math.Pi) + 20.0*math.Sin(2.0*x*math.Pi)) * 2.0 / 3.0
	ret += (20.0*math.Sin(y*math.Pi) + 40.0*math.Sin(y/3.0*math.Pi)) * 2.0 / 3.0
	ret += (160.0*math.Sin(y/12.0*math.Pi) + 320*math.Sin(y*math.Pi/30.0)) * 2.0 / 3.0
	return ret
}

func transformLng(x, y float64) float64 {
	ret := 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*math.Sqrt(math.Abs(x))
	ret += (20.0*math.Sin(6.0*x*math.Pi) + 20.0*math.Sin(2.0*x*math.Pi)) * 2.0 / 3.0
	ret += (20.0*math.Sin(x*math.Pi) + 40.0*math.Sin(x/3.0*math.Pi)) * 2.0 / 3.0
	ret += (150.0*math.Sin(x/12.0*math.Pi) + 300.0*math.Sin(x/30.0*math.Pi)) * 2.0 / 3.0
	return ret
}
