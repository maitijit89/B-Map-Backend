package handler

import (
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/maitijit89/B-Map-Backend/internal/app"
)

var fiberApp *fiber.App

func Handler(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("Panic in Handler: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	}()

	if fiberApp == nil {
		fiberApp = app.CreateApp()
	}
	adaptor.FiberApp(fiberApp)(w, r)
}
