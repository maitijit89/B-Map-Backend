package vernacular

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// TranslatePrompt handles POST /api/v1/vernacular/prompt
func (h *Handler) TranslatePrompt(c *gin.Context) {
	var req ManeuverInstructionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid voice prompt request",
		})
		return
	}

	res, err := h.service.TranslateManeuver(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// GetLanguages handles GET /api/v1/vernacular/languages
func (h *Handler) GetLanguages(c *gin.Context) {
	langs := h.service.GetSupportedLanguages()
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"languages": langs,
		"count":     len(langs),
	})
}
