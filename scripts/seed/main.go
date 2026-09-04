package main

import (
	"log"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/places"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func main() {
	cfg := config.LoadConfig()
	log.Printf("Connecting to MongoDB database %s on %s:%s...", cfg.DB.DBName, cfg.DB.Host, cfg.DB.Port)

	db, err := database.InitMongoDB(&cfg.DB, cfg.App.Env)
	if err != nil {
		log.Fatalf("MongoDB connection failed: %v", err)
	}

	log.Println("Seeding spatial places, POIs, and landmarks into MongoDB...")
	places.SeedInitialData(db)
	log.Println("MongoDB database seeding completed successfully.")
}
