package handler

import (
	"fmt"
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Internal Server Error", "details": "%v"}`, err)
		}
	}()

	if fiberApp == nil {
		fiberApp = app.CreateApp()
	}
	adaptor.FiberApp(fiberApp)(w, r)
}
