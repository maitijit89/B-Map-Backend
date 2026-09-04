package tiles_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/internal/tiles"
)

type mockTileService struct {
	tileData []byte
}

func (m *mockTileService) GetVectorTile(ctx context.Context, z, x, y int) ([]byte, error) {
	return m.tileData, nil
}

func TestServeTile_Headers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	mockSvc := &mockTileService{
		tileData: []byte{0x1f, 0x8b, 0x08, 0x00}, // gzip magic bytes
	}
	hdl := tiles.NewHandler(mockSvc)
	router.GET("/api/v1/tiles/:z/:x/:y", hdl.ServeTile)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/tiles/14/11993/7165.mvt", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("expected Content-Encoding: gzip, got '%s'", w.Header().Get("Content-Encoding"))
	}

	if w.Header().Get("Content-Type") != "application/vnd.mapbox-vector-tile" {
		t.Errorf("expected MVT Content-Type, got '%s'", w.Header().Get("Content-Type"))
	}
}
