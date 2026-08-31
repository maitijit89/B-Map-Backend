package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all CORS origins for WebSockets in development
	},
}

type Message struct {
	Event string      `json:"event"`
	Room  string      `json:"room,omitempty"`
	Data  interface{} `json:"data"`
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	rooms    map[string]bool
	clientID string
	mu       sync.Mutex
}

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	rdb        *redis.Client
	mu         sync.RWMutex
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan *Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rdb:        rdb,
	}
}

func (h *Hub) Run(ctx context.Context) {
	// Start Redis Pub/Sub listener for horizontal scalability across clusters
	go h.listenRedisPubSub(ctx)

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
				for room := range client.rooms {
					if h.rooms[room] != nil {
						delete(h.rooms[room], client)
					}
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			msgBytes, err := json.Marshal(msg)
			if err == nil {
				if msg.Room != "" {
					// Broadcast to room
					if roomClients, ok := h.rooms[msg.Room]; ok {
						for client := range roomClients {
							select {
							case client.send <- msgBytes:
							default:
								close(client.send)
								delete(h.clients, client)
							}
						}
					}
				} else {
					// Global broadcast
					for client := range h.clients {
						select {
						case client.send <- msgBytes:
						default:
							close(client.send)
							delete(h.clients, client)
						}
					}
				}
			}
			h.mu.RUnlock()

		case <-ctx.Done():
			return
		}
	}
}

// BroadcastLocal sends a message locally to all connected WebSocket clients in a room.
func (h *Hub) BroadcastLocal(msg *Message) {
	h.broadcast <- msg
}

// BroadcastCluster publishes an event to Redis Pub/Sub for all nodes to receive.
func (h *Hub) BroadcastCluster(ctx context.Context, channel string, msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return h.rdb.Publish(ctx, channel, data).Err()
}

func (h *Hub) listenRedisPubSub(ctx context.Context) {
	pubsub := h.rdb.Subscribe(ctx, "fleet:broadcast", "fleet:trips")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var wsMsg Message
		if err := json.Unmarshal([]byte(msg.Payload), &wsMsg); err == nil {
			h.broadcast <- &wsMsg
		}
	}
}

// HandleWebSocket upgrades HTTP connection and registers client into the Hub.
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request, clientID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade Error: %v", err)
		return
	}

	client := &Client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, 256),
		rooms:    make(map[string]bool),
		clientID: clientID,
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var req struct {
			Action string `json:"action"` // "join_room", "leave_room"
			Room   string `json:"room"`
		}

		if err := json.Unmarshal(message, &req); err == nil {
			c.mu.Lock()
			if req.Action == "join_room" && req.Room != "" {
				c.rooms[req.Room] = true
				c.hub.mu.Lock()
				if c.hub.rooms[req.Room] == nil {
					c.hub.rooms[req.Room] = make(map[*Client]bool)
				}
				c.hub.rooms[req.Room][c] = true
				c.hub.mu.Unlock()
			} else if req.Action == "leave_room" && req.Room != "" {
				delete(c.rooms, req.Room)
				c.hub.mu.Lock()
				if c.hub.rooms[req.Room] != nil {
					delete(c.hub.rooms[req.Room], c)
				}
				c.hub.mu.Unlock()
			}
			c.mu.Unlock()
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
