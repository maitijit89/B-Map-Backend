package http

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maitijit89/b-map-backend/pkg/cloudinary"
)

type UploadHandler struct {
	cloudinaryService cloudinary.Service
}

func NewUploadHandler(cloudinaryService cloudinary.Service) *UploadHandler {
	return &UploadHandler{
		cloudinaryService: cloudinaryService,
	}
}

// UploadImage handles image uploads for avatars, place photos, and map assets.
// @Summary Upload an image to Cloudinary
// @Tags Upload
// @Security BearerAuth
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "Image file to upload (JPEG, PNG, WEBP, max 10MB)"
// @Param folder formData string false "Subfolder in Cloudinary"
// @Success 200 {object} APIResponse{data=cloudinary.UploadResult}
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /api/v1/upload [post]
func (h *UploadHandler) UploadImage(c *fiber.Ctx) error {
	if h.cloudinaryService == nil {
		return ErrorResponse(c, fiber.StatusServiceUnavailable, "Cloudinary service is not configured", nil)
	}

	fileHeader, err := c.FormFile("image")
	if err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "No image file provided in form field 'image'", err.Error())
	}

	// Validate file size (max 10MB)
	if fileHeader.Size > 10*1024*1024 {
		return ErrorResponse(c, fiber.StatusBadRequest, "File size exceeds maximum allowed limit of 10MB", nil)
	}

	// Validate file extension
	contentType := fileHeader.Header.Get("Content-Type")
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}

	if !allowedTypes[strings.ToLower(contentType)] {
		return ErrorResponse(c, fiber.StatusBadRequest, fmt.Sprintf("Unsupported media type: %s. Allowed: JPEG, PNG, WEBP, GIF", contentType), nil)
	}

	folder := c.FormValue("folder", "")

	result, err := h.cloudinaryService.UploadMultipartFile(c.Context(), fileHeader, folder)
	if err != nil {
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload image to Cloudinary", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "Image uploaded successfully", result)
}
