package places

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// SeedInitialData populates sample Points of Interest (POIs) with Indian landmarks and transit hubs in MongoDB.
func SeedInitialData(db *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	coll := db.Collection("places")
	count, err := coll.CountDocuments(ctx, bson.M{})
	if err == nil && count > 0 {
		return // Data already seeded
	}

	log.Println("Seeding initial Indian ecosystem Points of Interest (POIs) into MongoDB for B-Map...")

	indianPOIs := []domain.Place{
		// New Delhi & NCR
		{
			ID:          uuid.New(),
			Name:        "India Gate",
			Description: "Iconic war memorial and ceremonial boulevard on Kartavya Path.",
			Address:     "Kartavya Path, India Gate, New Delhi, Delhi 110001",
			Category:    "landmark",
			Location:    database.NewGeoPoint(28.6129, 77.2295),
			PhotoURL:    "https://images.unsplash.com/photo-1587474260584-136574528ed5",
		},
		{
			ID:          uuid.New(),
			Name:        "Indira Gandhi International Airport (DEL) Terminal 3",
			Description: "Major international aviation hub with dedicated Metro Express and multi-modal transit.",
			Address:     "IGI Airport, New Delhi, Delhi 110037",
			Category:    "airport",
			Location:    database.NewGeoPoint(28.5562, 77.1000),
			PhotoURL:    "https://images.unsplash.com/photo-1530521954074-e64f6810b32d",
		},
		{
			ID:          uuid.New(),
			Name:        "Cyber Hub Gurgaon",
			Description: "Premier corporate dining, retail, and tech hub on NH-48 corridor.",
			Address:     "DLF Cyber City, Phase 2, Gurugram, Haryana 122002",
			Category:    "tech_hub",
			Location:    database.NewGeoPoint(28.4950, 77.0890),
			PhotoURL:    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
		},

		// Mumbai, Maharashtra
		{
			ID:          uuid.New(),
			Name:        "Gateway of India",
			Description: "20th-century arch monument overlooking the Arabian Sea in Colaba.",
			Address:     "Apollo Bandar, Colaba, Mumbai, Maharashtra 400001",
			Category:    "landmark",
			Location:    database.NewGeoPoint(18.9220, 72.8347),
			PhotoURL:    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f",
		},
		{
			ID:          uuid.New(),
			Name:        "Chhatrapati Shivaji Maharaj Terminus (CSMT)",
			Description: "UNESCO World Heritage railway terminus and headquarters of Central Railway.",
			Address:     "DN Road, Fort, Mumbai, Maharashtra 400001",
			Category:    "railway_station",
			Location:    database.NewGeoPoint(18.9398, 72.8355),
			PhotoURL:    "https://images.unsplash.com/photo-1567157577867-05ccb1388e66",
		},
		{
			ID:          uuid.New(),
			Name:        "Bandra-Worli Sea Link",
			Description: "8-lane cable-stayed bridge connecting Bandra with South Mumbai.",
			Address:     "Bandra West, Mumbai, Maharashtra 400050",
			Category:    "bridge_expressway",
			Location:    database.NewGeoPoint(19.0330, 72.8166),
			PhotoURL:    "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f",
		},

		// Bengaluru, Karnataka (Silicon Valley of India)
		{
			ID:          uuid.New(),
			Name:        "Vidhana Soudha",
			Description: "Seat of the state legislature of Karnataka, built in Neo-Dravidian architecture.",
			Address:     "Ambedkar Veedhi, Sampangi Rama Nagara, Bengaluru, Karnataka 560001",
			Category:    "government_landmark",
			Location:    database.NewGeoPoint(12.9797, 77.5908),
			PhotoURL:    "https://images.unsplash.com/photo-1596176530529-78163a4f7af2",
		},
		{
			ID:          uuid.New(),
			Name:        "Koramangala 5th Block Startup Hub",
			Description: "Epicenter of tech startups, co-working spaces, and cafes in South Bengaluru.",
			Address:     "Koramangala 5th Block, Bengaluru, Karnataka 560095",
			Category:    "tech_hub",
			Location:    database.NewGeoPoint(12.9352, 77.6245),
			PhotoURL:    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5",
		},

		// Hyderabad, Telangana
		{
			ID:          uuid.New(),
			Name:        "Charminar",
			Description: "16th-century landmark mosque and historical market monument.",
			Address:     "Char Kaman, Ghansi Bazaar, Hyderabad, Telangana 500002",
			Category:    "heritage_landmark",
			Location:    database.NewGeoPoint(17.3616, 78.4747),
			PhotoURL:    "https://images.unsplash.com/photo-1608958435020-e8a7109ba809",
		},
		{
			ID:          uuid.New(),
			Name:        "HITEC City Cyber Towers",
			Description: "Major IT corridor and technology township in Hyderabad.",
			Address:     "HITEC City, Madhapur, Hyderabad, Telangana 500081",
			Category:    "tech_hub",
			Location:    database.NewGeoPoint(17.4483, 78.3748),
			PhotoURL:    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",
		},

		// Kolkata, West Bengal
		{
			ID:          uuid.New(),
			Name:        "Howrah Bridge (Rabindra Setu)",
			Description: "Iconic cantilever bridge over the Hooghly River connecting Howrah and Kolkata.",
			Address:     "Howrah, Kolkata, West Bengal 700001",
			Category:    "landmark_bridge",
			Location:    database.NewGeoPoint(22.5851, 88.3468),
			PhotoURL:    "https://images.unsplash.com/photo-1558431382-27e303142255",
		},

		// Chennai, Tamil Nadu
		{
			ID:          uuid.New(),
			Name:        "Chennai Central Railway Station",
			Description: "Major railway terminus and southern transport junction.",
			Address:     "Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003",
			Category:    "railway_station",
			Location:    database.NewGeoPoint(13.0827, 80.2707),
			PhotoURL:    "https://images.unsplash.com/photo-1582510003544-4d00b7f74220",
		},
	}

	now := time.Now()
	for _, p := range indianPOIs {
		p.CreatedAt = now
		p.UpdatedAt = now
		if _, err := coll.InsertOne(ctx, p); err != nil {
			log.Printf("Warning: failed to seed Indian POI %s: %v", p.Name, err)
		}
	}

	log.Println("Indian ecosystem POI seeding completed successfully in MongoDB")
}
