package http

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/service"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type PlaceHandler struct {
	placeService service.PlaceService
}

func NewPlaceHandler(placeService service.PlaceService) *PlaceHandler {
	return &PlaceHandler{
		placeService: placeService,
	}
}

// CreatePlace handles adding a new spatial point to B-Map.
// @Summary Create a new place / POI
// @Tags Places
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body domain.CreatePlaceRequest true "Place Creation Data"
// @Success 201 {object} APIResponse{data=domain.Place}
// @Failure 400 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /api/v1/places [post]
func (h *PlaceHandler) CreatePlace(c *fiber.Ctx) error {
	var req domain.CreatePlaceRequest
	if err := c.BodyParser(&req); err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid request payload format", err.Error())
	}

	if valErrors := utils.ValidateStruct(&req); len(valErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  valErrors,
		})
	}

	var userID *uuid.UUID
	if rawID := c.Locals("user_id"); rawID != nil {
		if uid, ok := rawID.(uuid.UUID); ok {
			userID = &uid
		}
	}

	place, err := h.placeService.CreatePlace(c.Context(), &req, userID)
	if err != nil {
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create place", err.Error())
	}

	return SuccessResponse(c, fiber.StatusCreated, "Place created successfully", place)
}

// GetNearbyPlaces queries PostGIS for locations within a given radius.
// @Summary Search nearby places within radius (meters)
// @Tags Places
// @Produce json
// @Param lat query number true "Latitude (-90 to 90)"
// @Param lng query number true "Longitude (-180 to 180)"
// @Param radius query number true "Search Radius in meters (e.g. 5000 for 5km)"
// @Param category query string false "Filter by category (e.g. restaurant, hospital)"
// @Param limit query int false "Results limit (default 20, max 100)"
// @Param offset query int false "Offset for pagination"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /api/v1/places/nearby [get]
func (h *PlaceHandler) GetNearbyPlaces(c *fiber.Ctx) error {
	var query domain.NearbyPlacesQuery
	if err := c.QueryParser(&query); err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid query parameters", err.Error())
	}

	if valErrors := utils.ValidateStruct(&query); len(valErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  valErrors,
		})
	}

	places, total, err := h.placeService.FindNearby(c.Context(), &query)
	if err != nil {
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to execute spatial query", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "Nearby places retrieved successfully", fiber.Map{
		"places": places,
		"total":  total,
		"query": fiber.Map{
			"latitude":      query.Latitude,
			"longitude":     query.Longitude,
			"radius_meters": query.RadiusMeters,
			"category":      query.Category,
			"limit":         query.Limit,
			"offset":        query.Offset,
		},
	})
}

// GetPlaceByID retrieves a single place by its UUID.
// @Summary Get place details by ID
// @Tags Places
// @Produce json
// @Param id path string true "Place UUID"
// @Success 200 {object} APIResponse{data=domain.Place}
// @Failure 404 {object} APIResponse
// @Router /api/v1/places/{id} [get]
func (h *PlaceHandler) GetPlaceByID(c *fiber.Ctx) error {
	idParam := c.Params("id")
	placeID, err := uuid.Parse(idParam)
	if err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid place UUID", nil)
	}

	place, err := h.placeService.GetPlaceByID(c.Context(), placeID)
	if err != nil {
		if errors.Is(err, domain.ErrPlaceNotFound) {
			return ErrorResponse(c, fiber.StatusNotFound, "Place not found", nil)
		}
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch place", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "Place details retrieved", place)
}
