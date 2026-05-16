package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type PlaceHandler struct {
	usecase domain.PlaceUsecase
}

func NewPlaceHandler(usecase domain.PlaceUsecase) *PlaceHandler {
	return &PlaceHandler{usecase: usecase}
}

// Search godoc
// @Summary Search for places
// @Tags places
// @Produce json
// @Param text query string true "Search text"
// @Param lat query number false "Latitude"
// @Param lng query number false "Longitude"
// @Success 200 {array} domain.Place
// @Router /places/search [get]
func (h *PlaceHandler) Search(c *fiber.Ctx) error {
	var query domain.PlaceSearchQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	places, err := h.usecase.Search(c.Context(), &query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(places)
}

// GetDetails godoc
// @Summary Get place details
// @Tags places
// @Produce json
// @Param id path string true "Place ID"
// @Success 200 {object} domain.Place
// @Router /places/{id} [get]
func (h *PlaceHandler) GetDetails(c *fiber.Ctx) error {
	id := c.Params("id")
	place, err := h.usecase.GetDetails(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "place not found"})
	}

	return c.JSON(place)
}

// FavoritePlace godoc
// @Summary Add a place to favorites
// @Tags places
// @Security ApiKeyAuth
// @Param id path string true "Place UUID"
// @Success 200 {object} map[string]string
// @Router /places/{id}/favorite [post]
func (h *PlaceHandler) FavoritePlace(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)
	
	placeIDStr := c.Params("id")

	if err := h.usecase.FavoritePlace(c.Context(), userID, placeIDStr); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "place added to favorites"})
}

// GetFavorites godoc
// @Summary Get user's favorite places
// @Tags places
// @Security ApiKeyAuth
// @Produce json
// @Success 200 {array} domain.Place
// @Router /places/favorites [get]
func (h *PlaceHandler) GetFavorites(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	places, err := h.usecase.GetFavorites(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(places)
}
// GetDirections godoc
// @Summary Get directions between two points
// @Tags navigation
// @Produce json
// @Param origin query string true "Origin location (address or lat,lng)"
// @Param destination query string true "Destination location"
// @Param mode query string false "Travel mode"
// @Success 200 {object} domain.DirectionsResponse
// @Router /navigation/directions [get]
func (h *PlaceHandler) GetDirections(c *fiber.Ctx) error {
	var req domain.DirectionsRequest
	if err := c.QueryParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Origin == "" || req.Destination == "" {
		return c.Status(400).JSON(fiber.Map{"error": "origin and destination are required"})
	}

	directions, err := h.usecase.GetDirections(c.Context(), &req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(directions)
}
