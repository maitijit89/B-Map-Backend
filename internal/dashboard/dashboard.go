package dashboard

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/version"
)

const LandingHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B-Map Navigation Backend | MongoDB & Indian Geospatial Platform</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0d14;
            --bg-card: rgba(18, 24, 38, 0.7);
            --border: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(59, 130, 246, 0.4);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent-blue: #3b82f6;
            --accent-green: #10b981;
            --accent-purple: #8b5cf6;
            --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(139, 92, 246, 0.12) 0%, transparent 40%);
            background-attachment: fixed;
        }
        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 40px 24px;
            width: 100%;
        }
        header {
            text-align: center;
            margin-bottom: 40px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 16px;
        }
        .badge-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
        h1 {
            font-size: 3rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .subtitle {
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 650px;
            margin: 0 auto;
            line-height: 1.6;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 36px;
        }
        .status-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
            transition: all 0.2s ease;
        }
        .status-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-2px);
        }
        .status-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 6px;
        }
        .status-val {
            font-size: 1.1rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .endpoints-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            backdrop-filter: blur(16px);
        }
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        .section-title {
            font-size: 1.35rem;
            font-weight: 700;
        }
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 14px;
        }
        .endpoint-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 18px;
            text-decoration: none;
            color: var(--text-main);
            transition: all 0.2s ease;
        }
        .endpoint-btn:hover {
            background: rgba(59, 130, 246, 0.1);
            border-color: var(--accent-blue);
            transform: translateY(-2px);
        }
        .method-get {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 700;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            padding: 4px 8px;
            border-radius: 6px;
            margin-right: 10px;
        }
        .endpoint-path {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #e2e8f0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .endpoint-desc {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 4px;
        }
        footer {
            margin-top: auto;
            text-align: center;
            padding: 24px;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="badge">
                <span class="badge-dot"></span>
                <span>SYSTEM ACTIVE & HEALTHY</span>
            </div>
            <h1>B-Map Navigation Backend</h1>
            <p class="subtitle">Next-generation enterprise navigation, Contraction Hierarchies pathfinding, and Indian Regional Navigation Ecosystem powered by MongoDB 2dsphere & Redis.</p>
        </header>

        <div class="status-grid">
            <div class="status-card">
                <div class="status-title">Database Engine</div>
                <div class="status-val">🍃 MongoDB Atlas (2dsphere)</div>
            </div>
            <div class="status-card">
                <div class="status-title">Cache Layer</div>
                <div class="status-val">⚡ Redis (L1/L2 Multi-tier)</div>
            </div>
            <div class="status-card">
                <div class="status-title">Admin Console</div>
                <div class="status-val"><a href="/admin" style="color:#60a5fa;text-decoration:none">📊 Open Dashboard ↗</a></div>
            </div>
            <div class="status-card">
                <div class="status-title">Fast Routing</div>
                <div class="status-val">🚀 Contraction Hierarchies</div>
            </div>
        </div>

        <div class="endpoints-section">
            <div class="section-header">
                <div class="section-title">⚡ Live Interactive API Endpoints</div>
            </div>
            <div class="endpoints-grid">
                <a href="/admin" target="_blank" class="endpoint-btn" style="border-color:rgba(59,130,246,0.4)">
                    <div>
                        <span class="method-get" style="background:rgba(59,130,246,0.2);color:#60a5fa">ADMIN</span>
                        <span class="endpoint-path">/admin</span>
                        <div class="endpoint-desc">Admin Command Center & Live User Map</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/health" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/health</span>
                        <div class="endpoint-desc">Backend health & database status</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/places/search?q=India" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/places/search?q=India</span>
                        <div class="endpoint-desc">Full-text MongoDB place search</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/places/search?lat=28.6129&lng=77.2295&radius=50000" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/places/search (Proximity)</span>
                        <div class="endpoint-desc">2dsphere 50km radius spherical search</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/routes/directions?origin=28.6129,77.2295&destination=28.5562,77.1000&mode=driving" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/routes/directions</span>
                        <div class="endpoint-desc">India Gate to DEL Airport driving route</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/maps/style.json?theme=standard" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/maps/style.json</span>
                        <div class="endpoint-desc">Mapbox Vector Style Spec v8 JSON</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/boundaries/territorial" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/boundaries/territorial</span>
                        <div class="endpoint-desc">Survey of India (SOI) official borders</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/metrics" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/metrics</span>
                        <div class="endpoint-desc">Prometheus performance metrics</div>
                    </div>
                    <span>↗</span>
                </a>
            </div>
        </div>

        <footer>
            B-Map Platform Backend &bull; Developed with Go 1.25, MongoDB Atlas & Redis
        </footer>
    </div>
</body>
</html>`

// Handler returns the HTTP handler for the landing page dashboard.
func Handler(cfg *config.Config, versionSvc version.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("Accept") == "application/json" {
			c.JSON(http.StatusOK, gin.H{
				"name":       cfg.App.Name,
				"version":    versionSvc.GetActiveVersion(),
				"status":     "running",
				"database":   "MongoDB 7.0 (2dsphere geospatial)",
				"health_url": "/health",
				"admin_url":  "/admin",
				"api_base":   "/api/v1",
				"docs":       "https://github.com/maitijit89/B-Map-Backend",
			})
			return
		}

		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, LandingHTML)
	}
}
