# 🏛️ B-Map Platform Architecture Specification

> *Note: This document is identical to [architecture.md](file:///e:/B-Map-Backend/architecture.md), provided for compatibility with both standard and alternative filename conventions.*

Please refer to the full, authoritative architecture specification located at:
👉 **[architecture.md](file:///e:/B-Map-Backend/architecture.md)**

---

## Quick Architectural Summary

- **Runtime**: Node.js 24 + TypeScript (CommonJS build)
- **Framework**: Express.js 5 with Helmet, CORS, and Zod validation
- **Real-Time Engine**: Socket.IO 4+ with live room subscriptions (`nav:<id>`, `driver:<id>`)
- **Geospatial Database**: MongoDB Atlas with `2dsphere` indexes (`[longitude, latitude]`)
- **Routing Engine**: OSRM (Open Source Routing Machine) driving, bike, and foot profiles
- **Cache Layer**: Redis (ioredis) with TTL route caching and `GEOADD`/`GEOSEARCH` primitives
- **Sovereign Indian Stack**: ISRO NavIC L5/S-band, DigiPIN 4m×4m, FASTag tolls, IMD weather, Vernacular TTS in 12 languages
- **Resilience**: Dual-tier in-memory offline fallback for non-stop navigation during database disconnections
- **Security Hardening**: Dual rate-limiting (Auth: 15/15m, API: 300/1m), HS256 algorithm pinning, ReDoS escaping, XSS sanitization
