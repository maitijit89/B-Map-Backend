package fleet

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/realtime"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Handler struct {
	fleetService Service
	hub          *realtime.Hub
}

func NewHandler(fleetService Service, hub *realtime.Hub) *Handler {
	return &Handler{
		fleetService: fleetService,
		hub:          hub,
	}
}

// UpdateLocation handles POST /api/v1/fleet/location
func (h *Handler) UpdateLocation(c *gin.Context) {
	var payload LocationUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid location payload: " + err.Error()})
		return
	}

	if payload.DriverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id is required"})
		return
	}

	if err := h.fleetService.UpdateDriverLocation(c.Request.Context(), &payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update driver location: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Driver location updated and broadcasted",
	})
}

// GetNearbyDrivers handles GET /api/v1/fleet/nearby-drivers?lat=...&lng=...&radius=...
func (h *Handler) GetNearbyDrivers(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "5000") // Default 5km (5000m)
	limitStr := c.DefaultQuery("limit", "10")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, err3 := strconv.ParseFloat(radiusStr, 64)
	limit, _ := strconv.Atoi(limitStr)

	if err1 != nil || err2 != nil || err3 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid coordinate or radius query parameters"})
		return
	}

	drivers, err := h.fleetService.GetNearbyDrivers(c.Request.Context(), lat, lng, radius, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query nearby drivers: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"drivers": drivers,
		"count":   len(drivers),
	})
}

// RequestTrip handles POST /api/v1/fleet/trips
func (h *Handler) RequestTrip(c *gin.Context) {
	var req struct {
		PickupLat      float64 `json:"pickup_lat" binding:"required"`
		PickupLng      float64 `json:"pickup_lng" binding:"required"`
		DropoffLat     float64 `json:"dropoff_lat" binding:"required"`
		DropoffLng     float64 `json:"dropoff_lng" binding:"required"`
		PickupAddress  string  `json:"pickup_address"`
		DropoffAddress string  `json:"dropoff_address"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr := c.GetString("user_id")
	riderID, err := uuid.Parse(userIDStr)
	if err != nil {
		riderID = uuid.New() // Fallback for dev / unauthenticated requests
	}

	payload := &TripRequestPayload{
		RiderID:         riderID,
		Pickup:          utils.Coordinate{Latitude: req.PickupLat, Longitude: req.PickupLng},
		Dropoff:         utils.Coordinate{Latitude: req.DropoffLat, Longitude: req.DropoffLng},
		PickupAddress:   req.PickupAddress,
		DropoffAddress:  req.DropoffAddress,
	}

	trip, err := h.fleetService.RequestTrip(c.Request.Context(), payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to request trip: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Trip created and dispatched to nearby drivers",
		"trip":    trip,
	})
}

// AcceptTrip handles POST /api/v1/fleet/trips/:id/accept
func (h *Handler) AcceptTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var req struct {
		DriverID string `json:"driver_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id is required"})
		return
	}

	driverUUID, err := uuid.Parse(req.DriverID)
	if err != nil {
		driverUUID = uuid.New()
	}

	trip, err := h.fleetService.AcceptTrip(c.Request.Context(), driverUUID, tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Trip accepted successfully",
		"trip":    trip,
	})
}

// CompleteTrip handles POST /api/v1/fleet/trips/:id/complete
func (h *Handler) CompleteTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	trip, err := h.fleetService.CompleteTrip(c.Request.Context(), tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Trip completed",
		"trip":    trip,
	})
}

// GetTripByID handles GET /api/v1/fleet/trips/:id
func (h *Handler) GetTripByID(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	trip, err := h.fleetService.GetTripByID(c.Request.Context(), tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"trip":    trip,
	})
}

// WebSocketEndpoint handles GET /api/v1/fleet/ws for real-time bidirectional telemetry
func (h *Handler) WebSocketEndpoint(c *gin.Context) {
	clientID := c.Query("client_id")
	if clientID == "" {
		clientID = uuid.New().String()
	}
	h.hub.HandleWebSocket(c.Writer, c.Request, clientID)
}
