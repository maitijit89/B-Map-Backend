package mongodb

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type userRepository struct {
	coll *mongo.Collection
}

// NewUserRepository returns an implementation of domain.UserRepository using MongoDB.
func NewUserRepository(db *mongo.Database) domain.UserRepository {
	return &userRepository{
		coll: db.Collection("users"),
	}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	now := time.Now().UTC()
	if user.CreatedAt.IsZero() {
		user.CreatedAt = now
	}
	if user.Role == "" {
		user.Role = "user"
	}
	if user.Status == "" {
		user.Status = "active"
	}
	user.UpdatedAt = now

	_, err := r.coll.InsertOne(ctx, user)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return domain.ErrUserAlreadyExists
		}
		return err
	}
	return nil
}

func (r *userRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	normalized := strings.ToLower(strings.TrimSpace(email))
	var user domain.User

	filter := bson.M{
		"email": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(normalized) + "$",
			"$options": "i",
		},
	}

	err := r.coll.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	user.UpdatedAt = time.Now().UTC()
	res, err := r.coll.ReplaceOne(ctx, bson.M{"_id": user.ID}, user)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *userRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *userRepository) List(ctx context.Context, search, status, role string, limit, offset int64) ([]*domain.User, int64, error) {
	filter := bson.M{}

	if search != "" {
		filter["$or"] = []bson.M{
			{"name": bson.M{"$regex": regexp.QuoteMeta(search), "$options": "i"}},
			{"email": bson.M{"$regex": regexp.QuoteMeta(search), "$options": "i"}},
		}
	}
	if status != "" {
		filter["status"] = status
	}
	if role != "" {
		filter["role"] = role
	}

	total, err := r.coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(offset).
		SetLimit(limit)

	cursor, err := r.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var users []*domain.User
	for cursor.Next(ctx) {
		var u domain.User
		if err := cursor.Decode(&u); err != nil {
			continue
		}
		users = append(users, &u)
	}

	return users, total, nil
}

func (r *userRepository) GetActiveUsers(ctx context.Context, activeSince time.Time) ([]*domain.User, error) {
	filter := bson.M{
		"last_active_at": bson.M{"$gte": activeSince},
		"status":         bson.M{"$ne": "suspended"},
	}

	opts := options.Find().SetSort(bson.D{{Key: "last_active_at", Value: -1}}).SetLimit(100)
	cursor, err := r.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var activeUsers []*domain.User
	for cursor.Next(ctx) {
		var u domain.User
		if err := cursor.Decode(&u); err != nil {
			continue
		}
		activeUsers = append(activeUsers, &u)
	}

	return activeUsers, nil
}

func (r *userRepository) UpdateTelemetry(ctx context.Context, id uuid.UUID, lat, lng float64, device, ip string) error {
	now := time.Now().UTC()
	updateFields := bson.M{
		"last_active_at": now,
		"client_ip":      ip,
		"updated_at":     now,
	}
	if lat != 0 || lng != 0 {
		updateFields["current_latitude"] = lat
		updateFields["current_longitude"] = lng
	}
	if device != "" {
		updateFields["device"] = device
	}

	updateDoc := bson.M{
		"$set": updateFields,
		"$inc": bson.M{
			"total_active_minutes": 1,
		},
	}

	_, err := r.coll.UpdateOne(ctx, bson.M{"_id": id}, updateDoc)
	return err
}

func (r *userRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	now := time.Now().UTC()
	_, err := r.coll.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": now,
		},
	})
	return err
}
