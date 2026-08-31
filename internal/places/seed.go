package places

import (
	"log"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"gorm.io/gorm"
)

// SeedInitialData populates sample Points of Interest (POIs) if the places table is empty.
func SeedInitialData(db *gorm.DB) {
	var count int64
	db.Model(&domain.Place{}).Count(&count)

	if count > 0 {
		return // Data already seeded
	}

	log.Println("Seeding initial Points of Interest (POIs) for B-Map...")

	samplePlaces := []domain.Place{
		{
			ID:          uuid.New(),
			Name:        "San Francisco Ferry Building",
			Description: "Historic terminal and iconic marketplace with artisan foods and local vendors.",
			Address:     "1 Ferry Building, San Francisco, CA 94105",
			Category:    "landmark",
			Location:    database.NewGeoPoint(37.7955, -122.3937),
			PhotoURL:    "https://images.unsplash.com/photo-1506146332389-18140dc7b2fb",
		},
		{
			ID:          uuid.New(),
			Name:        "Blue Bottle Coffee",
			Description: "Specialty coffee roaster serving pour-overs, espresso drinks, and pastries.",
			Address:     "315 Linden St, San Francisco, CA 94102",
			Category:    "coffee",
			Location:    database.NewGeoPoint(37.7763, -122.4233),
			PhotoURL:    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
		},
		{
			ID:          uuid.New(),
			Name:        "Golden Gate Park",
			Description: "Vast public park featuring gardens, lakes, trails, and museums.",
			Address:     "501 Stanyan St, San Francisco, CA 94117",
			Category:    "park",
			Location:    database.NewGeoPoint(37.7694, -122.4862),
			PhotoURL:    "https://images.unsplash.com/photo-1449034446853-66c86144b0ad",
		},
		{
			ID:          uuid.New(),
			Name:        "UCSF Medical Center at Mission Bay",
			Description: "World-class hospital complex providing emergency, acute, and specialized healthcare.",
			Address:     "1855 4th St, San Francisco, CA 94158",
			Category:    "hospital",
			Location:    database.NewGeoPoint(37.7681, -122.3920),
			PhotoURL:    "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d",
		},
		{
			ID:          uuid.New(),
			Name:        "Chevron Gas Station",
			Description: "24/7 service station offering premium fuels, EV fast chargers, and convenience store.",
			Address:     "1298 Howard St, San Francisco, CA 94103",
			Category:    "gas_station",
			Location:    database.NewGeoPoint(37.7758, -122.4132),
			PhotoURL:    "https://images.unsplash.com/photo-1545459720-aac8509eb02c",
		},
		{
			ID:          uuid.New(),
			Name:        "Whole Foods Market",
			Description: "Eco-minded chain with natural and organic grocery items, housewares, and hot food bar.",
			Address:     "399 4th St, San Francisco, CA 94107",
			Category:    "supermarket",
			Location:    database.NewGeoPoint(37.7820, -122.3995),
			PhotoURL:    "https://images.unsplash.com/photo-1534723452862-4c874018d66d",
		},
	}

	for _, p := range samplePlaces {
		if err := db.Create(&p).Error; err != nil {
			log.Printf("Warning: failed to seed place %s: %v", p.Name, err)
		}
	}

	log.Println("Initial POI seeding completed successfully")
}
