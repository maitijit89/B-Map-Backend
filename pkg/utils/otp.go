package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// GenerateOTP generates a cryptographically secure numeric OTP of the specified length.
func GenerateOTP(length int) (string, error) {
	if length <= 0 {
		length = 6
	}

	max := big.NewInt(10)
	otp := make([]byte, length)

	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("failed to generate random digit: %w", err)
		}
		otp[i] = byte(num.Int64() + '0')
	}

	return string(otp), nil
}
