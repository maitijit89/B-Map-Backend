package handler

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/maitijit89/B-Map-Backend/internal/app"
)

var fiberApp *fiber.App

func Handler(w http.ResponseWriter, r *http.Request) {
	if fiberApp == nil {
		fiberApp = app.CreateApp()
	}
	adaptor.FiberApp(fiberApp)(w, r)
}
