package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"gorm.io/gorm"
)

type timelineRepository struct {
	db *gorm.DB
}

func NewTimelineRepository(db *gorm.DB) domain.TimelineRepository {
	return &timelineRepository{db: db}
}

func (r *timelineRepository) Save(ctx context.Context, history *domain.TravelHistory) error {
	query := `INSERT INTO user_timeline (user_id, location, speed_kph, created_at)
	VALUES (?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?)`
	
	return r.db.WithContext(ctx).Exec(query,
		history.UserID,
		history.Lng,
		history.Lat,
		history.SpeedKph,
		history.CreatedAt,
	).Error
}

func (r *timelineRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]domain.TravelHistory, error) {
	var history []domain.TravelHistory
	query := `SELECT id, user_id, speed_kph, created_at,
		ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
		FROM user_timeline
		WHERE user_id = ?
		ORDER BY created_at DESC`
	
	rows, err := r.db.WithContext(ctx).Raw(query, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var h domain.TravelHistory
		err := rows.Scan(&h.ID, &h.UserID, &h.SpeedKph, &h.CreatedAt, &h.Lat, &h.Lng)
		if err != nil {
			return nil, err
		}
		history = append(history, h)
	}
	return history, nil
}
