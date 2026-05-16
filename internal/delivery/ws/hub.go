package ws

import (
	"encoding/json"
	"math"
	"sync"

	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) BroadcastIncident(incident *domain.Incident) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type": "NEW_INCIDENT",
		"data": incident,
	})

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		// Only broadcast to clients within 5km
		if distance(client.Lat, client.Lng, incident.Lat, incident.Lng) <= 5.0 {
			select {
			case client.send <- msg:
			default:
				// If buffer full, skip or handle (Run handles cleanup)
			}
		}
	}
}

// distance calculates distance in km between two points using Haversine formula
func distance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}
