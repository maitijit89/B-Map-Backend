package evcharging

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// GetNearbyStations handles GET /api/v1/ev/stations
func (h *Handler) GetNearbyStations(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius_km", "25")
	connectorFilter := c.Query("connector")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid lat and lng query parameters are required",
		})
		return
	}

	q := &NearbyEVQuery{
		Location:        utils.Coordinate{Latitude: lat, Longitude: lng},
		RadiusKm:        radius,
		ConnectorFilter: ConnectorType(connectorFilter),
	}

	stations, err := h.service.GetNearbyStations(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"count":    len(stations),
			"stations": stations,
		},
	})
}

// GetStationByID handles GET /api/v1/ev/stations/:id
func (h *Handler) GetStationByID(c *gin.Context) {
	id := c.Param("id")
	station, err := h.service.GetStationByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    station,
	})
}
