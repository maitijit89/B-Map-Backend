package cloudinary

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/maitijit89/b-map-backend/config"
)

type Service interface {
	UploadImage(ctx context.Context, file interface{}, folder string) (*UploadResult, error)
	UploadMultipartFile(ctx context.Context, fileHeader *multipart.FileHeader, folder string) (*UploadResult, error)
	DeleteImage(ctx context.Context, publicID string) error
}

type service struct {
	cld    *cloudinary.Cloudinary
	folder string
}

type UploadResult struct {
	PublicID  string `json:"public_id"`
	SecureURL string `json:"secure_url"`
	Format    string `json:"format"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Bytes     int    `json:"bytes"`
}

// NewCloudinaryService initializes a new Cloudinary service client.
func NewCloudinaryService(cfg *config.CloudinaryConfig) (Service, error) {
	if cfg.CloudName == "" || cfg.APIKey == "" || cfg.APISecret == "" {
		return nil, errors.New("cloudinary credentials are missing in configuration")
	}

	cld, err := cloudinary.NewFromParams(cfg.CloudName, cfg.APIKey, cfg.APISecret)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Cloudinary client: %w", err)
	}

	folder := cfg.Folder
	if folder == "" {
		folder = "b_map_uploads"
	}

	return &service{
		cld:    cld,
		folder: folder,
	}, nil
}

func boolPtr(b bool) *bool {
	return &b
}

// UploadImage uploads an image (from reader, file path, or url) to Cloudinary.
func (s *service) UploadImage(ctx context.Context, file interface{}, targetFolder string) (*UploadResult, error) {
	uploadFolder := s.folder
	if targetFolder != "" {
		uploadFolder = fmt.Sprintf("%s/%s", s.folder, targetFolder)
	}

	uploadParams := uploader.UploadParams{
		Folder:         uploadFolder,
		ResourceType:   "image",
		UniqueFilename: boolPtr(true),
		Overwrite:      boolPtr(false),
	}

	ctxWithTimeout, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	resp, err := s.cld.Upload.Upload(ctxWithTimeout, file, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("cloudinary upload failed: %w", err)
	}

	return &UploadResult{
		PublicID:  resp.PublicID,
		SecureURL: resp.SecureURL,
		Format:    resp.Format,
		Width:     resp.Width,
		Height:    resp.Height,
		Bytes:     resp.Bytes,
	}, nil
}

// UploadMultipartFile handles direct multipart file upload from HTTP handlers.
func (s *service) UploadMultipartFile(ctx context.Context, fileHeader *multipart.FileHeader, targetFolder string) (*UploadResult, error) {
	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open multipart file: %w", err)
	}
	defer file.Close()

	return s.UploadImage(ctx, file, targetFolder)
}

// DeleteImage removes an asset from Cloudinary by its public ID.
func (s *service) DeleteImage(ctx context.Context, publicID string) error {
	ctxWithTimeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	_, err := s.cld.Upload.Destroy(ctxWithTimeout, uploader.DestroyParams{
		PublicID:     publicID,
		ResourceType: "image",
	})
	if err != nil {
		return fmt.Errorf("failed to delete image from cloudinary: %w", err)
	}

	return nil
}
