package main

import (
	"log"
	"os"

	"github.com/maitijit89/B-Map-Backend/internal/app"
)

func main() {
	fiberApp := app.CreateApp()

	// Start Server
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := fiberApp.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
