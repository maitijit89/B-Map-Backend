package handler

import (
	"net/http"

	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/maitijit89/B-Map-Backend/internal/app"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	fiberApp := app.CreateApp()
	adaptor.FiberAppToHandler(fiberApp)(w, r)
}
