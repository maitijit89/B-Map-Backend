package ws

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func NewHandler(hub *Hub) fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		client := &Client{hub: hub, conn: c, send: make(chan []byte, 256)}
		client.hub.register <- client

		go client.WritePump()
		client.ReadPump()
	})
}
