package utils

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

type ValidationErrorResponse struct {
	Field   string `json:"field"`
	Tag     string `json:"tag"`
	Message string `json:"message"`
}

// ValidateStruct validates a struct based on tags and formats error messages.
func ValidateStruct(s interface{}) []*ValidationErrorResponse {
	var errors []*ValidationErrorResponse
	err := validate.Struct(s)
	if err != nil {
		for _, err := range err.(validator.ValidationErrors) {
			var element ValidationErrorResponse
			element.Field = strings.ToLower(err.Field())
			element.Tag = err.Tag()
			element.Message = fmt.Sprintf("Field validation for '%s' failed on the '%s' tag", err.Field(), err.Tag())
			errors = append(errors, &element)
		}
	}
	return errors
}
