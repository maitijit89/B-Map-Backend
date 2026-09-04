package response

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	versionMu   sync.RWMutex
	currentAppVersion = "0.1.2"
)

// SetAppVersion updates the global app version used in API envelopes.
func SetAppVersion(v string) {
	if v == "" {
		return
	}
	versionMu.Lock()
	defer versionMu.Unlock()
	currentAppVersion = v
}

// GetAppVersion returns the current global app version.
func GetAppVersion() string {
	versionMu.RLock()
	defer versionMu.RUnlock()
	return currentAppVersion
}

// StandardResponse is the unified JSON response envelope.
type StandardResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorData  `json:"error,omitempty"`
	Meta    *MetaInfo   `json:"meta,omitempty"`
}

type ErrorData struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type MetaInfo struct {
	RequestID string `json:"request_id,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Version   string `json:"version,omitempty"`
}

// Success returns a standard 200/201 JSON payload.
func Success(c *gin.Context, statusCode int, data interface{}) {
	reqID, _ := c.Get("RequestID")
	reqIDStr, _ := reqID.(string)

	c.JSON(statusCode, StandardResponse{
		Success: true,
		Data:    data,
		Meta: &MetaInfo{
			RequestID: reqIDStr,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   GetAppVersion(),
		},
	})
}

// Error returns a standard error JSON envelope.
func Error(c *gin.Context, statusCode int, message string, details ...string) {
	reqID, _ := c.Get("RequestID")
	reqIDStr, _ := reqID.(string)

	det := ""
	if len(details) > 0 {
		det = details[0]
	}

	c.JSON(statusCode, StandardResponse{
		Success: false,
		Error: &ErrorData{
			Code:    statusCode,
			Message: message,
			Details: det,
		},
		Meta: &MetaInfo{
			RequestID: reqIDStr,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   GetAppVersion(),
		},
	})
}

// BadRequest returns 400 Bad Request.
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// InternalServerError returns 500 Internal Server Error.
func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}

// NotFound returns 404 Not Found.
func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}
