package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"github.com/redis/go-redis/v9"
)

type placeUsecase struct {
	repo  domain.PlaceRepository
	redis *redis.Client
}

func NewPlaceUsecase(repo domain.PlaceRepository, redis *redis.Client) domain.PlaceUsecase {
	return &placeUsecase{repo: repo, redis: redis}
}

func (u *placeUsecase) Search(ctx context.Context, query *domain.PlaceSearchQuery) ([]domain.Place, error) {
	// 1. Try Google Places
	places, err := u.searchGoogle(ctx, query)
	if err == nil && len(places) > 0 {
		// Save results to local cache DB
		for _, p := range places {
			u.repo.Save(ctx, &p)
		}
		return places, nil
	}

	// 2. Fallback to Local/OSM
	return u.repo.SearchLocal(ctx, query)
}

func (u *placeUsecase) GetDetails(ctx context.Context, id string) (*domain.Place, error) {
	// Try cache first
	cached, err := u.redis.Get(ctx, "place:"+id).Result()
	if err == nil {
		var place domain.Place
		json.Unmarshal([]byte(cached), &place)
		return &place, nil
	}

	// Try DB
	place, err := u.repo.GetByID(ctx, id)
	if err == nil {
		return place, nil
	}

	// Fetch from Google
	place, err = u.fetchGoogleDetails(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache result
	data, _ := json.Marshal(place)
	u.redis.Set(ctx, "place:"+id, data, 24*time.Hour)
	u.repo.Save(ctx, place)

	return place, nil
}

func (u *placeUsecase) FavoritePlace(ctx context.Context, userID, placeID uuid.UUID) error {
	return u.repo.AddFavorite(ctx, userID, placeID)
}

func (u *placeUsecase) GetFavorites(ctx context.Context, userID uuid.UUID) ([]domain.Place, error) {
	return u.repo.GetFavorites(ctx, userID)
}

// searchGoogle proxies to Google Places API
func (u *placeUsecase) searchGoogle(ctx context.Context, query *domain.PlaceSearchQuery) ([]domain.Place, error) {
	apiKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	url := fmt.Sprintf("https://maps.googleapis.com/maps/api/place/textsearch/json?query=%s&location=%f,%f&radius=10000&key=%s",
		query.Text, query.Lat, query.Lng, apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Results []struct {
			PlaceID  string `json:"place_id"`
			Name     string `json:"name"`
			Address  string `json:"formatted_address"`
			Geometry struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating float64 `json:"rating"`
			Types  []string `json:"types"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	var places []domain.Place
	for _, r := range result.Results {
		p := domain.Place{
			ExternalID: r.PlaceID,
			Name:       r.Name,
			Address:    r.Address,
			Lat:        r.Geometry.Location.Lat,
			Lng:        r.Geometry.Location.Lng,
			Rating:     r.Rating,
			CreatedAt:  time.Now(),
		}
		if len(r.Types) > 0 {
			p.Category = r.Types[0]
		}
		places = append(places, p)
	}

	return places, nil
}

func (u *placeUsecase) fetchGoogleDetails(ctx context.Context, placeID string) (*domain.Place, error) {
	apiKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	url := fmt.Sprintf("https://maps.googleapis.com/maps/api/place/details/json?place_id=%s&key=%s", placeID, apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Result struct {
			PlaceID  string `json:"place_id"`
			Name     string `json:"name"`
			Address  string `json:"formatted_address"`
			Geometry struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating float64 `json:"rating"`
			Types  []string `json:"types"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	p := &domain.Place{
		ExternalID: result.Result.PlaceID,
		Name:       result.Result.Name,
		Address:    result.Result.Address,
		Lat:        result.Result.Geometry.Location.Lat,
		Lng:        result.Result.Geometry.Location.Lng,
		Rating:     result.Result.Rating,
		CreatedAt:  time.Now(),
	}
	if len(result.Result.Types) > 0 {
		p.Category = result.Result.Types[0]
	}

	return p, nil
}
