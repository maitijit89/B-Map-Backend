package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/internal/analytics"
)

// FeatureTrackerMiddleware automatically categorizes and tracks API feature usage for admin graphs.
func FeatureTrackerMiddleware(analyticsSvc analytics.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Only track successful API calls
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 && analyticsSvc != nil {
			path := c.Request.URL.Path
			var feature string

			switch {
			case strings.HasPrefix(path, "/api/v1/routes"):
				feature = "Turn-by-Turn Routing & Directions"
			case strings.HasPrefix(path, "/api/v1/places"):
				feature = "Places Search & Autocomplete"
			case strings.HasPrefix(path, "/api/v1/navic"):
				feature = "NavIC Satellite Positioning"
			case strings.HasPrefix(path, "/api/v1/tolls"):
				feature = "FASTag Toll Estimator"
			case strings.HasPrefix(path, "/api/v1/weather"):
				feature = "Highway Fog & Weather Radar"
			case strings.HasPrefix(path, "/api/v1/hazards"):
				feature = "Road Hazards & Waterlogging"
			case strings.HasPrefix(path, "/api/v1/digipin"):
				feature = "India Post DIGIPIN Grid"
			case strings.HasPrefix(path, "/api/v1/ev"):
				feature = "EV Charging Stations"
			case strings.HasPrefix(path, "/api/v1/emergency"):
				feature = "112 SOS Highway Emergency"
			case strings.HasPrefix(path, "/api/v1/vernacular"):
				feature = "Vernacular Voice Guidance"
			case strings.HasPrefix(path, "/api/v1/tiles"):
				feature = "Vector Tile Map Server"
			case strings.HasPrefix(path, "/api/v1/fleet"):
				feature = "Fleet & Driver Tracking"
			case strings.HasPrefix(path, "/api/v1/geocoding") || strings.HasPrefix(path, "/api/v1/address"):
				feature = "Geocoding & Address Validation"
			}

			if feature != "" {
				analyticsSvc.TrackFeature(c.Request.Context(), feature)
			}
		}
	}
}
