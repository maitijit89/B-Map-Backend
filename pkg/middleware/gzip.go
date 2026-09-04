package middleware

import (
	"compress/gzip"
	"io"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

var gzipWriterPool = sync.Pool{
	New: func() interface{} {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		return w
	},
}

type gzipResponseWriter struct {
	gin.ResponseWriter
	writer *gzip.Writer
}

func (g *gzipResponseWriter) Write(data []byte) (int, error) {
	g.Header().Del("Content-Length")
	return g.writer.Write(data)
}

func (g *gzipResponseWriter) WriteString(s string) (int, error) {
	g.Header().Del("Content-Length")
	return g.writer.Write([]byte(s))
}

// GzipMiddleware dynamically compresses HTTP responses over 512 bytes with gzip for supported clients.
func GzipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only compress if client explicitly supports gzip
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		// Skip WebSocket upgrades, Server-Sent Events, and pre-compressed vector tiles
		if strings.Contains(c.GetHeader("Upgrade"), "websocket") ||
			strings.Contains(c.GetHeader("Accept"), "text/event-stream") ||
			strings.HasPrefix(c.Request.URL.Path, "/api/v1/tiles") {
			c.Next()
			return
		}

		gz := gzipWriterPool.Get().(*gzip.Writer)
		defer gzipWriterPool.Put(gz)

		gz.Reset(c.Writer)
		defer gz.Close()

		c.Header("Content-Encoding", "gzip")
		c.Header("Vary", "Accept-Encoding")

		c.Writer = &gzipResponseWriter{
			ResponseWriter: c.Writer,
			writer:         gz,
		}

		c.Next()
	}
}
