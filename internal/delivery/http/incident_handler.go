package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type IncidentHandler struct {
	usecase domain.IncidentUsecase
}

func NewIncidentHandler(usecase domain.IncidentUsecase) *IncidentHandler {
	return &IncidentHandler{usecase: usecase}
}

// Report godoc
// @Summary Report a traffic incident
// @Tags incidents
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body domain.IncidentReport true "Incident details"
// @Success 201 {object} domain.Incident
// @Router /incidents [post]
func (h *IncidentHandler) Report(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	var req domain.IncidentReport
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	incident, err := h.usecase.Report(c.Context(), userID, &req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(incident)
}

// GetNearby godoc
// @Summary Get nearby incidents
// @Tags incidents
// @Produce json
// @Param lat query number true "Latitude"
// @Param lng query number true "Longitude"
// @Param radius query number false "Radius in meters"
// @Success 200 {array} domain.Incident
// @Router /incidents [get]
func (h *IncidentHandler) GetNearby(c *fiber.Ctx) error {
	var query domain.IncidentQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	incidents, err := h.usecase.GetNearby(c.Context(), &query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(incidents)
}
