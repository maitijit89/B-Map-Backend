# B_map Backend

A high-performance, professional Go backend for the B_map mapping application.

## Tech Stack
- **Go 1.26**
- **Fiber** (Web Framework)
- **PostgreSQL + PostGIS** (Geospatial Database)
- **Redis** (Caching)
- **JWT** (Authentication)
- **Swagger** (API Documentation)
- **WebSockets** (Real-time Engine)

## Deployment

### Vercel (Serverless)
This project is configured for deployment on Vercel using Serverless Functions.

**IMPORTANT NOTE ON WEBSOCKETS**: 
Vercel Serverless Functions are stateless and short-lived. This means the built-in WebSocket real-time engine will **NOT** work on Vercel. If you require persistent WebSockets, please deploy to a VPS or a container platform like Google Cloud Run or Railway.

#### Steps to Deploy:
1. Push your code to GitHub.
2. Connect your repository to Vercel.
3. Configure Environment Variables in the Vercel Dashboard:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSLMODE`
   - `REDIS_HOST`, `REDIS_PORT`
   - `JWT_SECRET`
   - `GOOGLE_PLACES_API_KEY`
4. Deploy!

### Docker (Recommended for Full Features)
To use all features including real-time WebSockets, deploy using Docker:
```bash
docker-compose up -d
```

## Local Development
1. `copy env.example .env`
2. Update `.env` with your credentials.
3. `go run cmd/api/main.go`

## API Documentation
Once running, visit `/swagger` to view the interactive documentation.
