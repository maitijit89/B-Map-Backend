package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"gorm.io/gorm"
)

type placeRepository struct {
	db *gorm.DB
}

func NewPlaceRepository(db *gorm.DB) domain.PlaceRepository {
	return &placeRepository{db: db}
}

func (r *placeRepository) Save(ctx context.Context, place *domain.Place) error {
	query := `INSERT INTO places (external_id, name, address, location, category, rating, created_at)
	VALUES (?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?, ?)
	ON CONFLICT (external_id) DO UPDATE SET
	name = EXCLUDED.name, address = EXCLUDED.address, location = EXCLUDED.location, rating = EXCLUDED.rating`
	
	return r.db.WithContext(ctx).Exec(query,
		place.ExternalID,
		place.Name,
		place.Address,
		place.Lng,
		place.Lat,
		place.Category,
		place.Rating,
		place.CreatedAt,
	).Error
}

func (r *placeRepository) GetByID(ctx context.Context, externalID string) (*domain.Place, error) {
	var place domain.Place
	query := `SELECT id, external_id, name, address, category, rating, created_at,
		ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
		FROM places WHERE external_id = ?`
	
	row := r.db.WithContext(ctx).Raw(query, externalID).Row()
	err := row.Scan(&place.ID, &place.ExternalID, &place.Name, &place.Address, &place.Category, &place.Rating, &place.CreatedAt, &place.Lat, &place.Lng)
	if err != nil {
		return nil, err
	}
	return &place, nil
}

func (r *placeRepository) SearchLocal(ctx context.Context, query *domain.PlaceSearchQuery) ([]domain.Place, error) {
	var places []domain.Place
	sql := `SELECT id, external_id, name, address, category, rating, created_at,
		ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
		FROM places
		WHERE name ILIKE ?`
	
	rows, err := r.db.WithContext(ctx).Raw(sql, "%"+query.Text+"%").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.Place
		err := rows.Scan(&p.ID, &p.ExternalID, &p.Name, &p.Address, &p.Category, &p.Rating, &p.CreatedAt, &p.Lat, &p.Lng)
		if err != nil {
			return nil, err
		}
		places = append(places, p)
	}
	return places, nil
}

func (r *placeRepository) AddFavorite(ctx context.Context, userID uuid.UUID, placeID string) error {
	var internalID uuid.UUID
	err := r.db.WithContext(ctx).Raw("SELECT id FROM places WHERE external_id = ?", placeID).Row().Scan(&internalID)
	if err != nil {
		return err
	}

	fav := domain.UserFavorite{
		UserID:  userID,
		PlaceID: internalID,
	}
	return r.db.WithContext(ctx).Create(&fav).Error
}

func (r *placeRepository) GetFavorites(ctx context.Context, userID uuid.UUID) ([]domain.Place, error) {
	var places []domain.Place
	query := `SELECT p.id, p.external_id, p.name, p.address, p.category, p.rating, p.created_at,
		ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng
		FROM places p
		JOIN user_favorites uf ON p.id = uf.place_id
		WHERE uf.user_id = ?`
	
	rows, err := r.db.WithContext(ctx).Raw(query, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.Place
		err := rows.Scan(&p.ID, &p.ExternalID, &p.Name, &p.Address, &p.Category, &p.Rating, &p.CreatedAt, &p.Lat, &p.Lng)
		if err != nil {
			return nil, err
		}
		places = append(places, p)
	}
	return places, nil
}
