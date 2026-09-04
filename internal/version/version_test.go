package version_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/internal/version"
	"github.com/maitijit89/b-map-backend/pkg/response"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1, v2 string
		want   int
	}{
		{"0.1.2", "0.1.2", 0},
		{"v0.1.2", "0.1.2", 0},
		{"0.1.1", "0.1.2", -1},
		{"0.1.2", "0.1.1", 1},
		{"0.1.2", "0.2.0", -1},
		{"0.2.0", "0.1.9", 1},
		{"1.0.0", "0.9.9", 1},
		{"0.1.0", "0.1.0.1", -1},
	}

	for _, tt := range tests {
		got := version.CompareVersions(tt.v1, tt.v2)
		if got != tt.want {
			t.Errorf("CompareVersions(%q, %q) = %d; want %d", tt.v1, tt.v2, got, tt.want)
		}
	}
}

func TestVersionService_DefaultAndPatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := version.NewVersionService("0.1.2", nil, nil)

	ctx := context.Background()

	// 1. Check initial version
	cfg, err := svc.GetVersion(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Version != "0.1.2" {
		t.Errorf("expected version 0.1.2, got %s", cfg.Version)
	}
	if svc.GetActiveVersion() != "0.1.2" {
		t.Errorf("expected active version 0.1.2, got %s", svc.GetActiveVersion())
	}
	if response.GetAppVersion() != "0.1.2" {
		t.Errorf("expected response package version 0.1.2, got %s", response.GetAppVersion())
	}

	// 2. Check update for older client (0.1.1)
	updResp, err := svc.CheckUpdate(ctx, "0.1.1", 11, "android")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updResp.UpdateAvailable {
		t.Errorf("expected update to be available for 0.1.1 against 0.1.2")
	}
	if updResp.IsMandatory {
		t.Errorf("expected update not mandatory since min_version is 0.1.0")
	}

	// 3. Check update for obsolete client (0.0.9 < min_version 0.1.0)
	updResp2, err := svc.CheckUpdate(ctx, "0.0.9", 9, "android")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updResp2.IsMandatory {
		t.Errorf("expected mandatory update for 0.0.9 < 0.1.0")
	}

	// 4. Patch version to 0.1.3
	newVer := "0.1.3"
	force := true
	notes := "Critical performance and routing engine patch"
	url := "https://example.com/bmap-0.1.3.apk"

	patchReq := &version.PatchVersionRequest{
		Version:      &newVer,
		ForceUpdate:  &force,
		ReleaseNotes: &notes,
		DownloadURL:  &url,
		ApkURL:       &url,
	}

	patched, err := svc.PatchVersion(ctx, patchReq, "admin@bmap.in")
	if err != nil {
		t.Fatalf("unexpected patch error: %v", err)
	}
	if patched.Version != "0.1.3" {
		t.Errorf("expected patched version 0.1.3, got %s", patched.Version)
	}
	if !patched.ForceUpdate {
		t.Errorf("expected force_update to be true")
	}
	if patched.ReleaseNotes != notes {
		t.Errorf("expected release notes %q, got %q", notes, patched.ReleaseNotes)
	}
	if response.GetAppVersion() != "0.1.3" {
		t.Errorf("expected response package version 0.1.3, got %s", response.GetAppVersion())
	}

	// 5. Check update for 0.1.2 against new 0.1.3 (should now be update available and forced)
	updResp3, err := svc.CheckUpdate(ctx, "0.1.2", 12, "android")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updResp3.UpdateAvailable {
		t.Errorf("expected update available for 0.1.2 after patching to 0.1.3")
	}
	if !updResp3.IsMandatory {
		t.Errorf("expected mandatory update because force_update is true")
	}
}

func TestVersionHTTPHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := version.NewVersionService("0.1.2", nil, nil)
	hdl := version.NewHandler(svc)

	r := gin.New()
	r.GET("/api/v1/app/version", hdl.GetVersion)
	r.GET("/api/v1/app/check-update", hdl.CheckUpdate)
	r.PATCH("/api/v1/admin/version", hdl.PatchVersion)

	// Test GET /api/v1/app/version
	req, _ := http.NewRequest("GET", "/api/v1/app/version", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var resp struct {
		Success bool                     `json:"success"`
		Data    version.AppVersionConfig `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Data.Version != "0.1.2" {
		t.Errorf("expected version 0.1.2, got %s", resp.Data.Version)
	}

	// Test GET /api/v1/app/check-update?current_version=0.1.1
	req2, _ := http.NewRequest("GET", "/api/v1/app/check-update?current_version=0.1.1", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w2.Code)
	}

	var checkResp struct {
		Success bool                        `json:"success"`
		Data    version.CheckUpdateResponse `json:"data"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &checkResp); err != nil {
		t.Fatalf("failed to unmarshal check update response: %v", err)
	}
	if !checkResp.Data.UpdateAvailable {
		t.Errorf("expected update_available to be true")
	}

	// Test PATCH /api/v1/admin/version
	patchBody := map[string]interface{}{
		"version":       "0.1.3",
		"release_notes": "Added Hindi vernacular voice guidance",
		"force_update":  false,
	}
	bodyBytes, _ := json.Marshal(patchBody)
	req3, _ := http.NewRequest("PATCH", "/api/v1/admin/version", bytes.NewBuffer(bodyBytes))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on PATCH, got %d (body: %s)", w3.Code, w3.Body.String())
	}

	// Verify updated version through GET /api/v1/app/version
	req4, _ := http.NewRequest("GET", "/api/v1/app/version", nil)
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)

	var resp4 struct {
		Success bool                     `json:"success"`
		Data    version.AppVersionConfig `json:"data"`
	}
	_ = json.Unmarshal(w4.Body.Bytes(), &resp4)
	if resp4.Data.Version != "0.1.3" {
		t.Errorf("expected version 0.1.3 after patch, got %s", resp4.Data.Version)
	}
}
