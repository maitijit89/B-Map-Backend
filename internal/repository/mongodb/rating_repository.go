package mongodb

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ratingRepository struct {
	coll *mongo.Collection
}

// NewRatingRepository returns an implementation of domain.RatingRepository using MongoDB.
func NewRatingRepository(db *mongo.Database) domain.RatingRepository {
	return &ratingRepository{
		coll: db.Collection("ratings"),
	}
}

func (r *ratingRepository) Upsert(ctx context.Context, rating *domain.Rating) error {
	if rating.ID == uuid.Nil {
		rating.ID = uuid.New()
	}
	now := time.Now().UTC()
	if rating.CreatedAt.IsZero() {
		rating.CreatedAt = now
	}
	rating.UpdatedAt = now

	opts := options.UpdateOne().SetUpsert(true)
	filter := bson.M{"user_id": rating.UserID}
	update := bson.M{
		"$set": bson.M{
			"user_name":  rating.UserName,
			"user_email": rating.UserEmail,
			"score":      rating.Score,
			"feedback":   rating.Feedback,
			"category":   rating.Category,
			"updated_at": rating.UpdatedAt,
		},
		"$setOnInsert": bson.M{
			"_id":        rating.ID,
			"created_at": rating.CreatedAt,
		},
	}

	_, err := r.coll.UpdateOne(ctx, filter, update, opts)
	return err
}

func (r *ratingRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.Rating, error) {
	var rating domain.Rating
	err := r.coll.FindOne(ctx, bson.M{"user_id": userID}).Decode(&rating)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &rating, nil
}

func (r *ratingRepository) List(ctx context.Context, limit, offset int64) ([]*domain.Rating, int64, error) {
	total, err := r.coll.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(offset).
		SetLimit(limit)

	cursor, err := r.coll.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var ratings []*domain.Rating
	for cursor.Next(ctx) {
		var rt domain.Rating
		if err := cursor.Decode(&rt); err != nil {
			continue
		}
		ratings = append(ratings, &rt)
	}

	return ratings, total, nil
}

func (r *ratingRepository) GetStats(ctx context.Context) (*domain.RatingStats, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$score",
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := r.coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	dist := map[int]int64{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
	var totalRatings int64
	var sumScores int64

	type GroupResult struct {
		Score int   `bson:"_id"`
		Count int64 `bson:"count"`
	}

	for cursor.Next(ctx) {
		var gr GroupResult
		if err := cursor.Decode(&gr); err != nil {
			continue
		}
		dist[gr.Score] = gr.Count
		totalRatings += gr.Count
		sumScores += int64(gr.Score) * gr.Count
	}

	avg := 0.0
	if totalRatings > 0 {
		avg = float64(sumScores) / float64(totalRatings)
	}

	return &domain.RatingStats{
		AverageScore: avg,
		TotalRatings: totalRatings,
		Distribution: dist,
	}, nil
}
