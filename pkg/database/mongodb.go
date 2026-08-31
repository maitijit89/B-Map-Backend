package database

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// InitMongoDB establishes a high-performance connection pool to MongoDB Atlas,
// sets optimal timeouts, compression, retry settings, and initializes 2dsphere spatial and composite indexes.
func InitMongoDB(cfg *config.DatabaseConfig, appEnv string) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := cfg.URI
	if mongoURI == "" {
		if cfg.User != "" && cfg.Password != "" {
			escapedUser := url.QueryEscape(cfg.User)
			escapedPass := url.QueryEscape(cfg.Password)
			mongoURI = fmt.Sprintf("mongodb://%s:%s@%s:%s/%s?authSource=admin",
				escapedUser, escapedPass, cfg.Host, cfg.Port, cfg.DBName)
		} else {
			mongoURI = fmt.Sprintf("mongodb://%s:%s/%s", cfg.Host, cfg.Port, cfg.DBName)
		}
	}

	dbName := cfg.DBName
	if dbName == "" {
		dbName = "b_map_db"
	}

	clientOpts := options.Client().
		ApplyURI(mongoURI).
		SetMaxPoolSize(100).
		SetMinPoolSize(10).
		SetMaxConnIdleTime(5 * time.Minute).
		SetTimeout(12 * time.Second).
		SetRetryWrites(true).
		SetRetryReads(true).
		SetCompressors([]string{"zlib", "snappy", "zstd"})

	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize MongoDB client: %w", err)
	}

	// Ping the primary node to ensure connectivity
	if err := client.Ping(ctx, nil); err != nil {
		log.Printf("Warning: MongoDB ping check failed (database may still be starting): %v", err)
	} else {
		log.Println("Connected to MongoDB Atlas with high-performance connection pool successfully")
	}

	db := client.Database(dbName)

	// Ensure 2dsphere spatial and performance indexes
	ensureIndexes(ctx, db)

	return db, nil
}

func ensureIndexes(ctx context.Context, db *mongo.Database) {
	// 1. Places Collection: 2dsphere on location, index on category & fulltext
	placesColl := db.Collection("places")
	_, err := placesColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_places_location_2dsphere"),
		},
		{
			Keys:    bson.D{{Key: "category", Value: 1}},
			Options: options.Index().SetName("idx_places_category"),
		},
		{
			Keys: bson.D{
				{Key: "name", Value: "text"},
				{Key: "description", Value: "text"},
				{Key: "address", Value: "text"},
			},
			Options: options.Index().SetName("idx_places_text"),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: -1}},
			Options: options.Index().SetName("idx_places_created_at"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on places collection: %v", err)
	}

	// 2. Users Collection: Unique index on email, compound indexes on status, role, last_active_at
	usersColl := db.Collection("users")
	_, err = usersColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_users_email_unique"),
		},
		{
			Keys:    bson.D{{Key: "last_active_at", Value: -1}},
			Options: options.Index().SetName("idx_users_last_active_at"),
		},
		{
			Keys:    bson.D{{Key: "status", Value: 1}, {Key: "role", Value: 1}},
			Options: options.Index().SetName("idx_users_status_role"),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: -1}},
			Options: options.Index().SetName("idx_users_created_at"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on users collection: %v", err)
	}

	// 3. Ratings Collection: user_id index, score index, created_at index
	ratingsColl := db.Collection("ratings")
	_, err = ratingsColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_ratings_user_id_unique"),
		},
		{
			Keys:    bson.D{{Key: "score", Value: 1}},
			Options: options.Index().SetName("idx_ratings_score"),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: -1}},
			Options: options.Index().SetName("idx_ratings_created_at"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on ratings collection: %v", err)
	}

	// 4. Feature Usage Collection: feature_name and count sorting index
	featureColl := db.Collection("feature_usage")
	_, err = featureColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "feature_name", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_feature_name_unique"),
		},
		{
			Keys:    bson.D{{Key: "count", Value: -1}},
			Options: options.Index().SetName("idx_feature_count"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on feature_usage collection: %v", err)
	}

	// 5. Vehicles Collection: 2dsphere on location, index on driver_id and status
	vehiclesColl := db.Collection("vehicles")
	_, err = vehiclesColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_vehicles_location_2dsphere"),
		},
		{
			Keys:    bson.D{{Key: "driver_id", Value: 1}, {Key: "status", Value: 1}},
			Options: options.Index().SetName("idx_vehicles_driver_status"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on vehicles collection: %v", err)
	}

	// 6. Trips Collection: 2dsphere on pickup & dropoff locations
	tripsColl := db.Collection("trips")
	_, err = tripsColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "pickup_location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_trips_pickup_2dsphere"),
		},
		{
			Keys:    bson.D{{Key: "dropoff_location", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_trips_dropoff_2dsphere"),
		},
		{
			Keys:    bson.D{{Key: "rider_id", Value: 1}, {Key: "status", Value: 1}},
			Options: options.Index().SetName("idx_trips_rider_status"),
		},
		{
			Keys:    bson.D{{Key: "driver_id", Value: 1}, {Key: "status", Value: 1}},
			Options: options.Index().SetName("idx_trips_driver_status"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on trips collection: %v", err)
	}

	// 7. Boundaries Collection: 2dsphere on center_point, index on admin_level
	boundariesColl := db.Collection("boundaries")
	_, err = boundariesColl.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "center_point", Value: "2dsphere"}},
			Options: options.Index().SetName("idx_boundaries_center_2dsphere"),
		},
		{
			Keys:    bson.D{{Key: "admin_level", Value: 1}, {Key: "country_code", Value: 1}},
			Options: options.Index().SetName("idx_boundaries_admin_country"),
		},
	})
	if err != nil {
		log.Printf("Warning: failed to create indexes on boundaries collection: %v", err)
	}

	// 8. Road Nodes Collection: 2dsphere on location
	nodesColl := db.Collection("road_nodes")
	_, err = nodesColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
		Options: options.Index().SetName("idx_road_nodes_location_2dsphere"),
	})
	if err != nil {
		log.Printf("Warning: failed to create index on road_nodes: %v", err)
	}

	log.Println("MongoDB 2dsphere spatial and composite performance indexes initialized successfully")
}
