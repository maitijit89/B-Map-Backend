package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type TimelineHandler struct {
	usecase domain.TimelineUsecase
}

func NewTimelineHandler(usecase domain.TimelineUsecase) *TimelineHandler {
	return &TimelineHandler{usecase: usecase}
}

// RecordLocation godoc
// @Summary Record user location
// @Tags timeline
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body domain.TravelHistory true "Location details"
// @Success 201 {object} map[string]string
// @Router /timeline [post]
func (h *TimelineHandler) RecordLocation(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	var req domain.TravelHistory
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.usecase.RecordLocation(c.Context(), userID, &req); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{"message": "location recorded"})
}

// GetHistory godoc
// @Summary Get user travel history
// @Tags timeline
// @Security ApiKeyAuth
// @Produce json
// @Success 200 {array} domain.TravelHistory
// @Router /timeline [get]
func (h *TimelineHandler) GetHistory(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	history, err := h.usecase.GetHistory(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(history)
}
