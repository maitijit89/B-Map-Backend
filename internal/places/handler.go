package places

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

type Handler struct {
	placesService Service
}

func NewHandler(placesService Service) *Handler {
	return &Handler{placesService: placesService}
}

// SearchPlaces handles GET /api/v1/places/search
func (h *Handler) SearchPlaces(c *gin.Context) {
	q := c.Query("q")
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "0")
	category := c.Query("category")
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	var latPtr, lngPtr *float64
	if latStr != "" && lngStr != "" {
		if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
			latPtr = &lat
		}
		if lng, err := strconv.ParseFloat(lngStr, 64); err == nil {
			lngPtr = &lng
		}
	}

	searchReq := &SearchQuery{
		Query:        q,
		Latitude:     latPtr,
		Longitude:    lngPtr,
		RadiusMeters: radius,
		Category:     category,
		Limit:        limit,
		Offset:       offset,
	}

	places, total, err := h.placesService.Search(c.Request.Context(), searchReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search places: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"places":  places,
		"total":   total,
	})
}

// Autocomplete handles GET /api/v1/places/autocomplete?q=...&lat=...&lng=...
func (h *Handler) Autocomplete(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "suggestions": []AutocompleteItem{}})
		return
	}

	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	limitStr := c.DefaultQuery("limit", "8")
	limit, _ := strconv.Atoi(limitStr)

	var latPtr, lngPtr *float64
	if latStr != "" && lngStr != "" {
		if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
			latPtr = &lat
		}
		if lng, err := strconv.ParseFloat(lngStr, 64); err == nil {
			lngPtr = &lng
		}
	}

	items, err := h.placesService.Autocomplete(c.Request.Context(), q, latPtr, lngPtr, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute autocomplete: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"suggestions": items,
	})
}

// ReverseGeocode handles GET /api/v1/places/reverse?lat=...&lng=...
func (h *Handler) ReverseGeocode(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' are required for reverse geocoding"})
		return
	}

	place, err := h.placesService.ReverseGeocode(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No matching place found near coordinates"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"place":   place,
	})
}

// CreatePlace handles POST /api/v1/places
func (h *Handler) CreatePlace(c *gin.Context) {
	var req struct {
		Name        string  `json:"name" binding:"required,min=2"`
		Description string  `json:"description"`
		Address     string  `json:"address" binding:"required"`
		Category    string  `json:"category" binding:"required"`
		Latitude    float64 `json:"latitude" binding:"required"`
		Longitude   float64 `json:"longitude" binding:"required"`
		PhotoURL    string  `json:"photo_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdBy *uuid.UUID
	if userIDStr := c.GetString("user_id"); userIDStr != "" {
		if uid, err := uuid.Parse(userIDStr); err == nil {
			createdBy = &uid
		}
	}

	place := &domain.Place{
		Name:        req.Name,
		Description: req.Description,
		Address:     req.Address,
		Category:    req.Category,
		Location:    database.NewGeoPoint(req.Latitude, req.Longitude),
		PhotoURL:    req.PhotoURL,
		CreatedBy:   createdBy,
	}

	if err := h.placesService.CreatePlace(c.Request.Context(), place); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save place: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Place created successfully",
		"place":   place,
	})
}
