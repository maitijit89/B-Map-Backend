package domain

import "errors"

var (
	ErrUserNotFound         = errors.New("user not found")
	ErrUserAlreadyExists     = errors.New("user already registered with this email")
	ErrInvalidOTP           = errors.New("invalid or expired OTP")
	ErrOTPNotFound          = errors.New("OTP not found or expired")
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrUnauthorized         = errors.New("unauthorized access")
	ErrInvalidToken         = errors.New("invalid or expired token")
	ErrPlaceNotFound        = errors.New("place not found")
	ErrInvalidLocationPoint = errors.New("invalid latitude or longitude coordinates")
	ErrFileUploadFailed     = errors.New("failed to upload image to storage")
	ErrInternalServer       = errors.New("internal server error")
)
