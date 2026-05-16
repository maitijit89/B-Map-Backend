package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type ListHandler struct {
	usecase domain.ListUsecase
}

func NewListHandler(usecase domain.ListUsecase) *ListHandler {
	return &ListHandler{usecase: usecase}
}

type CreateListRequest struct {
	Name string `json:"name" validate:"required"`
}

type AddPlaceRequest struct {
	PlaceID string `json:"placeId" validate:"required"`
}

func (h *ListHandler) CreateList(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	var req CreateListRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	list, err := h.usecase.CreateList(c.Context(), userID, req.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(list)
}

func (h *ListHandler) GetMyLists(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	lists, err := h.usecase.GetUserLists(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(lists)
}

func (h *ListHandler) AddPlace(c *fiber.Ctx) error {
	listIDStr := c.Params("id")
	listID, err := uuid.Parse(listIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid list id"})
	}

	var req AddPlaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	if err := h.usecase.AddPlaceToList(c.Context(), listID, req.PlaceID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "place added to list"})
}
