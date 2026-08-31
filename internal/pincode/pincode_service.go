package pincode

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// PINCodeInfo represents an official Indian postal code spatial area.
type PINCodeInfo struct {
	PINCode      string           `json:"pincode"`      // e.g. "110001"
	PostOffice   string           `json:"post_office"`  // e.g. "Connaught Place H.O"
	District     string           `json:"district"`     // e.g. "Central Delhi"
	State        string           `json:"state"`        // e.g. "Delhi"
	Circle       string           `json:"circle"`       // e.g. "Delhi Circle"
	Center       utils.Coordinate `json:"center"`
	BoundingBox  []float64        `json:"bounding_box"` // [minLng, minLat, maxLng, maxLat]
}

// ParsedIndianAddress represents landmark-centric decomposition of an Indian address string.
type ParsedIndianAddress struct {
	RawInput      string           `json:"raw_input"`
	PINCode       string           `json:"pincode,omitempty"`
	Landmarks     []string         `json:"landmarks,omitempty"`
	MetroPillar   string           `json:"metro_pillar,omitempty"`
	StreetGali    string           `json:"street_or_gali,omitempty"`
	LocalityArea  string           `json:"locality_or_area,omitempty"`
	CityDistrict  string           `json:"city_district,omitempty"`
	State         string           `json:"state,omitempty"`
	BestMatchPin  *PINCodeInfo     `json:"best_match_pin,omitempty"`
	EstimatedLoc  utils.Coordinate `json:"estimated_location"`
	Confidence    float64          `json:"confidence_score"` // 0.0 - 1.0
}

type Service interface {
	LookupPINCode(ctx context.Context, pincode string) (*PINCodeInfo, error)
	ParseIndianAddress(ctx context.Context, address string) (*ParsedIndianAddress, error)
	ReverseLookup(ctx context.Context, lat, lng float64) (*PINCodeInfo, error)
}

type pincodeService struct {
	directory map[string]PINCodeInfo
}

func NewPINCodeService() Service {
	// Seed prominent Indian PIN Codes across key zones
	dir := map[string]PINCodeInfo{
		"110001": {
			PINCode: "110001", PostOffice: "Connaught Place H.O", District: "Central Delhi", State: "Delhi", Circle: "Delhi Circle",
			Center: utils.Coordinate{Latitude: 28.6304, Longitude: 77.2177}, BoundingBox: []float64{77.20, 28.61, 77.24, 28.65},
		},
		"110016": {
			PINCode: "110016", PostOffice: "Hauz Khas S.O", District: "South Delhi", State: "Delhi", Circle: "Delhi Circle",
			Center: utils.Coordinate{Latitude: 28.5494, Longitude: 77.2001}, BoundingBox: []float64{77.18, 28.53, 77.22, 28.57},
		},
		"400001": {
			PINCode: "400001", PostOffice: "Mumbai G.P.O.", District: "Mumbai", State: "Maharashtra", Circle: "Maharashtra Circle",
			Center: utils.Coordinate{Latitude: 18.9401, Longitude: 72.8354}, BoundingBox: []float64{72.82, 18.92, 72.85, 18.96},
		},
		"400050": {
			PINCode: "400050", PostOffice: "Bandra West S.O", District: "Mumbai Suburban", State: "Maharashtra", Circle: "Maharashtra Circle",
			Center: utils.Coordinate{Latitude: 19.0596, Longitude: 72.8295}, BoundingBox: []float64{72.81, 19.04, 72.85, 19.08},
		},
		"560001": {
			PINCode: "560001", PostOffice: "Bangalore G.P.O.", District: "Bengaluru Urban", State: "Karnataka", Circle: "Karnataka Circle",
			Center: utils.Coordinate{Latitude: 12.9784, Longitude: 77.5994}, BoundingBox: []float64{77.58, 12.96, 77.62, 13.00},
		},
		"560034": {
			PINCode: "560034", PostOffice: "Koramangala S.O", District: "Bengaluru Urban", State: "Karnataka", Circle: "Karnataka Circle",
			Center: utils.Coordinate{Latitude: 12.9352, Longitude: 77.6245}, BoundingBox: []float64{77.60, 12.91, 77.65, 12.96},
		},
		"500081": {
			PINCode: "500081", PostOffice: "HITEC City S.O", District: "Hyderabad", State: "Telangana", Circle: "Telangana Circle",
			Center: utils.Coordinate{Latitude: 17.4435, Longitude: 78.3772}, BoundingBox: []float64{78.35, 17.42, 78.40, 17.47},
		},
		"600001": {
			PINCode: "600001", PostOffice: "Chennai G.P.O.", District: "Chennai", State: "Tamil Nadu", Circle: "Tamil Nadu Circle",
			Center: utils.Coordinate{Latitude: 13.0900, Longitude: 80.2890}, BoundingBox: []float64{80.26, 13.07, 80.31, 13.11},
		},
		"700001": {
			PINCode: "700001", PostOffice: "Kolkata G.P.O.", District: "Kolkata", State: "West Bengal", Circle: "West Bengal Circle",
			Center: utils.Coordinate{Latitude: 22.5726, Longitude: 88.3639}, BoundingBox: []float64{88.34, 22.55, 88.39, 22.60},
		},
	}
	return &pincodeService{directory: dir}
}

func (s *pincodeService) LookupPINCode(ctx context.Context, pincode string) (*PINCodeInfo, error) {
	p := strings.TrimSpace(pincode)
	info, exists := s.directory[p]
	if !exists {
		return nil, errors.New("PIN code not found in Indian postal registry")
	}
	return &info, nil
}

// ParseIndianAddress extracts Indian landmark patterns (e.g. "Opposite Metro Pillar 128, Near SBI, Gali No 4")
func (s *pincodeService) ParseIndianAddress(ctx context.Context, address string) (*ParsedIndianAddress, error) {
	res := &ParsedIndianAddress{
		RawInput:   address,
		Confidence: 0.70,
	}

	// 1. Extract 6-digit PIN code via regex
	pinRegex := regexp.MustCompile(`\b([1-9][0-9]{5})\b`)
	if match := pinRegex.FindString(address); match != "" {
		res.PINCode = match
		if pinInfo, exists := s.directory[match]; exists {
			res.BestMatchPin = &pinInfo
			res.EstimatedLoc = pinInfo.Center
			res.CityDistrict = pinInfo.District
			res.State = pinInfo.State
			res.Confidence = 0.95
		}
	}

	// 2. Extract Metro Pillar number (e.g. "Metro Pillar 128", "Pillar No. 45")
	pillarRegex := regexp.MustCompile(`(?i)(?:metro\s+pillar|pillar\s+no\.?)\s*([0-9]+[a-z]?)`)
	if match := pillarRegex.FindStringSubmatch(address); len(match) > 1 {
		res.MetroPillar = match[0]
	}

	// 3. Extract Landmark patterns ("Near ...", "Opposite ...", "Behind ...", "Beside ...")
	landmarkRegex := regexp.MustCompile(`(?i)(?:near|opp|opposite|behind|beside|adj|adjacent to)\s+([^,]+)`)
	matches := landmarkRegex.FindAllStringSubmatch(address, -1)
	for _, m := range matches {
		if len(m) > 1 {
			res.Landmarks = append(res.Landmarks, strings.TrimSpace(m[1]))
		}
	}

	// 4. Extract Street / Gali / Marg
	galiRegex := regexp.MustCompile(`(?i)(?:gali\s+no\.?|street\s+no\.?|road\s+no\.?|marg|rasta|lane)\s*([^,]+)`)
	if match := galiRegex.FindString(address); match != "" {
		res.StreetGali = strings.TrimSpace(match)
	}

	// Default coordinate fallback if PIN code wasn't matched
	if res.EstimatedLoc.Latitude == 0 {
		res.EstimatedLoc = utils.Coordinate{Latitude: 28.6139, Longitude: 77.2090} // New Delhi Central
	}

	return res, nil
}

func (s *pincodeService) ReverseLookup(ctx context.Context, lat, lng float64) (*PINCodeInfo, error) {
	pt := utils.Coordinate{Latitude: lat, Longitude: lng}
	var closest *PINCodeInfo
	minDist := 100000000.0

	for _, info := range s.directory {
		d := utils.HaversineDistanceCoords(pt, info.Center)
		if d < minDist {
			minDist = d
			infoCopy := info
			closest = &infoCopy
		}
	}

	if closest == nil {
		return nil, errors.New("no Indian postal zone matched")
	}

	return closest, nil
}
