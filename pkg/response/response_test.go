package response_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/response"
)

func TestResponseEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	response.SetAppVersion("0.1.2")
	if response.GetAppVersion() != "0.1.2" {
		t.Fatalf("expected 0.1.2, got %s", response.GetAppVersion())
	}

	r := gin.New()
	r.GET("/test-success", func(c *gin.Context) {
		response.Success(c, http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/test-error", func(c *gin.Context) {
		response.BadRequest(c, "Invalid parameters")
	})

	// Test success
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test-success", nil)
	r.ServeHTTP(w, req)

	var successResp response.StandardResponse
	if err := json.Unmarshal(w.Body.Bytes(), &successResp); err != nil {
		t.Fatalf("failed to unmarshal success response: %v", err)
	}
	if !successResp.Success {
		t.Errorf("expected success: true")
	}
	if successResp.Meta == nil || successResp.Meta.Version != "0.1.2" {
		t.Errorf("expected version 0.1.2 in meta, got %+v", successResp.Meta)
	}

	// Test error
	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest("GET", "/test-error", nil)
	r.ServeHTTP(wErr, reqErr)

	var errorResp response.StandardResponse
	if err := json.Unmarshal(wErr.Body.Bytes(), &errorResp); err != nil {
		t.Fatalf("failed to unmarshal error response: %v", err)
	}
	if errorResp.Success {
		t.Errorf("expected success: false")
	}
	if errorResp.Error.Code != http.StatusBadRequest {
		t.Errorf("expected 400 error code, got %d", errorResp.Error.Code)
	}
}
