package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type ReviewHandler struct {
	usecase domain.ReviewUsecase
}

func NewReviewHandler(usecase domain.ReviewUsecase) *ReviewHandler {
	return &ReviewHandler{usecase: usecase}
}

// PostReview godoc
// @Summary Post a review for a place
// @Tags reviews
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param placeId query string true "Place ID"
// @Param request body domain.Review true "Review details"
// @Success 201 {object} domain.Review
// @Router /reviews [post]
func (h *ReviewHandler) PostReview(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	placeID := c.Query("placeId")
	if placeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "placeId is required"})
	}

	var review domain.Review
	if err := c.BodyParser(&review); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	review.UserID = userID
	review.PlaceID = placeID

	if err := h.usecase.PostReview(c.Context(), &review); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(review)
}

// GetPlaceReviews godoc
// @Summary Get reviews for a place
// @Tags reviews
// @Produce json
// @Security ApiKeyAuth
// @Param placeId query string true "Place ID"
// @Success 200 {array} domain.Review
// @Router /reviews [get]
func (h *ReviewHandler) GetPlaceReviews(c *fiber.Ctx) error {
	placeID := c.Query("placeId")
	if placeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "placeId is required"})
	}

	reviews, err := h.usecase.GetPlaceReviews(c.Context(), placeID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(reviews)
}

// GetMyReviews godoc
// @Summary Get current user's reviews
// @Tags reviews
// @Produce json
// @Security ApiKeyAuth
// @Success 200 {array} domain.Review
// @Router /reviews/me [get]
func (h *ReviewHandler) GetMyReviews(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	reviews, err := h.usecase.GetMyReviews(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(reviews)
}
