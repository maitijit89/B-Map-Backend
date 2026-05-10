package repository

import (
	"context"

	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"gorm.io/gorm"
)

type incidentRepository struct {
	db *gorm.DB
}

func NewIncidentRepository(db *gorm.DB) domain.IncidentRepository {
	return &incidentRepository{db: db}
}

func (r *incidentRepository) Create(ctx context.Context, incident *domain.Incident) error {
	query := `INSERT INTO incidents (type, description, location, reporter_id, is_active, created_at, expires_at)
	VALUES (?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?, ?, ?)`
	
	return r.db.WithContext(ctx).Exec(query, 
		incident.Type, 
		incident.Description, 
		incident.Lng, 
		incident.Lat, 
		incident.ReporterID,
		incident.IsActive,
		incident.CreatedAt,
		incident.ExpiresAt,
	).Error
}

func (r *incidentRepository) GetNearby(ctx context.Context, lat, lng, radius float64) ([]domain.Incident, error) {
	var incidents []domain.Incident
	
	query := `SELECT id, type, description, is_active, reporter_id, created_at, expires_at,
		ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
		FROM incidents
		WHERE ST_DWithin(location, ST_MakePoint(?, ?)::geography, ?)
		AND is_active = TRUE`
	
	rows, err := r.db.WithContext(ctx).Raw(query, lng, lat, radius).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var inc domain.Incident
		err := rows.Scan(&inc.ID, &inc.Type, &inc.Description, &inc.IsActive, &inc.ReporterID, &inc.CreatedAt, &inc.ExpiresAt, &inc.Lat, &inc.Lng)
		if err != nil {
			return nil, err
		}
		incidents = append(incidents, inc)
	}

	return incidents, nil
}
