# B-Map Backend API Documentation

Welcome to the API documentation for **B-Map Backend**, a high-performance Python FastAPI service. This document outlines the API endpoints, schemas, authentication model, and local startup commands.

## Table of Contents
1. [Backend Setup & Startup Commands](#backend-setup--startup-commands)
2. [Global API Information](#global-api-information)
3. [Authentication (`/api/v1/auth`)](#authentication-apiv1auth)
4. [Incidents (`/api/v1/incidents`)](#incidents-apiv1incidents)
5. [Places (`/api/v1/places`)](#places-apiv1places)
6. [Navigation (`/api/v1/navigation`)](#navigation-apiv1navigation)
7. [User Pins (`/api/v1/pins`)](#user-pins-apiv1pins)
8. [Reviews & Ratings (`/api/v1/reviews`)](#reviews--ratings-apiv1reviews)
9. [Saved Lists (`/api/v1/lists`)](#saved-lists-apiv1lists)
10. [Timeline & History (`/api/v1/timeline`)](#timeline--history-apiv1timeline)
11. [Offline Pre-fetching (`/api/v1/offline`)](#offline-pre-fetching-apiv1offline)
12. [Maps (`/api/v1/maps`)](#maps-apiv1maps)
13. [Environment (`/api/v1/environment`)](#environment-apiv1environment)
14. [System/Utilities (`/`)](#systemutilities-)

---

## Backend Setup & Startup Commands

### Prerequisite Setup
1. **Virtual Environment**:
   ```bash
   python -m venv venv
   ```
   * Activate (Windows Powershell / Command Prompt):
     ```powershell
     .\venv\Scripts\Activate.ps1   # Powershell
     # OR
     .\venv\Scripts\activate.bat   # CMD
     ```
   * Activate (macOS/Linux):
     ```bash
     source venv/bin/activate
     ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Copy `env.example` to `.env` and fill in the necessary keys (Google Maps API keys, DB credentials, etc.):
   ```bash
   cp env.example .env
   ```

### Startup Commands

Depending on your environment, you can start the FastAPI backend in two ways:

#### A. Standard Startup (Recommended)
This runs the Python entrypoint directly, which automatically configures loop policies (such as using selector events loop policy on Windows to avoid psycopg issues) and handles custom port parsing:
```bash
python -m app.main
```
By default, this will bind to: `http://localhost:8080` (or the `PORT` specified in your environment variables).

#### B. Uvicorn Command (Alternative)
For hot-reloading in development directly from your CLI:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

---

## Global API Information

* **Base Production URL**: `https://b-map-backend.vercel.app`
* **Local Development Base URL**: `http://localhost:8080`
* **Interactive API Documentation**:
  - **Swagger UI**: [http://localhost:8080/docs](http://localhost:8080/docs) (Local) or [https://b-map-backend.vercel.app/docs](https://b-map-backend.vercel.app/docs)
  - **ReDoc**: [http://localhost:8080/redoc](http://localhost:8080/redoc) (Local) or [https://b-map-backend.vercel.app/redoc](https://b-map-backend.vercel.app/redoc)
* **Authentication**: For authenticated endpoints, pass the JSON Web Token (JWT) in the `Authorization` header:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
* **Rate Limiting**: Configured by default to `60` requests per minute per client IP (excluding docs, openapi specs, and health check routes). Excess requests return status code `429 Too Many Requests`.

---

## Authentication (`/api/v1/auth`)

### 1. Register User
* **HTTP Method**: `POST`
* **Path**: `/api/v1/auth/register`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "email": "user@example.com",
    "display_name": "John Doe",
    "password": "securepassword123"
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "email": "user@example.com",
      "display_name": "John Doe",
      "phone_number": null,
      "firebase_uid": null,
      "created_at": "2026-06-15T16:00:00Z"
    }
  }
  ```

### 2. Login User
* **HTTP Method**: `POST`
* **Path**: `/api/v1/auth/login`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
* **Response Body** (`200 OK`): Returns the same `AuthResponse` schema as Register.

### 3. Google OAuth Login
* **HTTP Method**: `POST`
* **Path**: `/api/v1/auth/google`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "id_token": "google_id_token_here"
  }
  ```
* **Response Body** (`200 OK`): Returns the same `AuthResponse` schema as Register.

### 4. Firebase Authentication Login
* **HTTP Method**: `POST`
* **Path**: `/api/v1/auth/firebase`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "id_token": "firebase_id_token_here"
  }
  ```
* **Response Body** (`200 OK`): Returns the same `AuthResponse` schema as Register.

---

## Incidents (`/api/v1/incidents`)

### 1. Report Incident
* **HTTP Method**: `POST`
* **Path**: `/api/v1/incidents/`
* **Authentication Required**: Yes
* **Request Body** (`application/json`):
  ```json
  {
    "type": "waterlogging", 
    "severity": "high",
    "description": "Heavy water accumulation near the underpass.",
    "lat": 23.8103,
    "lng": 90.4125
  }
  ```
  > **Note**: `type` must be one of: `accident`, `closure`, `hazard`, `traffic`, `waterlogging`, `pothole`, `stray_animal`, `police_check`, `event`.  
  > `severity` must be one of: `low`, `medium`, `high`, `critical`.
* **Response Body** (`201 Created`):
  ```json
  {
    "id": "9a185f64-5717-4562-b3fc-2c963f66afa7",
    "type": "waterlogging",
    "severity": "high",
    "description": "Heavy water accumulation near the underpass.",
    "lat": 23.8103,
    "lng": 90.4125,
    "reporter_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "is_active": true,
    "upvotes": 0,
    "created_at": "2026-06-15T16:05:00Z",
    "expires_at": "2026-06-15T18:05:00Z"
  }
  ```

### 2. Get Nearby Incidents
* **HTTP Method**: `GET`
* **Path**: `/api/v1/incidents/nearby`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required): Center latitude.
  - `lng` (float, required): Center longitude.
  - `radius` (float, optional, default = `5000`): Search radius in meters.
* **Response Body** (`200 OK`):
  ```json
  [
    {
      "id": "9a185f64-5717-4562-b3fc-2c963f66afa7",
      "type": "waterlogging",
      "severity": "high",
      "description": "Heavy water accumulation near the underpass.",
      "lat": 23.8103,
      "lng": 90.4125,
      "reporter_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "is_active": true,
      "upvotes": 3,
      "created_at": "2026-06-15T16:05:00Z",
      "expires_at": "2026-06-15T18:05:00Z"
    }
  ]
  ```

---

## Places (`/api/v1/places`)

### 1. Nearby Search
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/nearby`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
  - `radius` (integer, optional, default = `1000` meters)
  - `type` (string, optional): E.g., `restaurant`, `gas_station`
* **Response Body** (`200 OK`): Returns Google Places API results list.

### 2. Place Details
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/details/{place_id}`
* **Authentication Required**: No
* **Path Parameters**:
  - `place_id` (string, required): Google Place ID.
* **Response Body** (`200 OK`): Returns detailed Google Place object.

### 3. Place Autocomplete
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/autocomplete`
* **Authentication Required**: No
* **Query Parameters**:
  - `q` (string, required): Query string.
  - `lat` (float, optional)
  - `lng` (float, optional)
* **Response Body** (`200 OK`): List of prediction elements.

### 4. Text Search
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/search-text`
* **Authentication Required**: No
* **Query Parameters**:
  - `q` (string, required): Query string.
  - `lat` (float, optional)
  - `lng` (float, optional)
* **Response Body** (`200 OK`): Search result places list.

### 5. Geocode Address
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/geocode`
* **Authentication Required**: No
* **Query Parameters**:
  - `address` (string, required): Text address.
* **Response Body** (`200 OK`): Geocoded coordinate details.

### 6. Reverse Geocode Coordinates
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/reverse-geocode`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
* **Response Body** (`200 OK`): Street addresses found.

### 7. Validate Address
* **HTTP Method**: `POST`
* **Path**: `/api/v1/places/validate-address`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "address_lines": ["1600 Amphitheatre Pkwy"],
    "region_code": "US",
    "locality": "Mountain View"
  }
  ```
* **Response Body** (`200 OK`): Detailed address validation check mapping.

### 8. Geolocate (Cell/WiFi)
* **HTTP Method**: `POST`
* **Path**: `/api/v1/places/geolocate`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "cell_towers": [
      {
        "cellId": 170402995,
        "locationAreaCode": 2867,
        "mobileCountryCode": 310,
        "mobileNetworkCode": 410
      }
    ],
    "wifi_access_points": []
  }
  ```
* **Response Body** (`200 OK`): Calculated location coordinates and accuracy limit.

### 9. Get Place Timezone
* **HTTP Method**: `GET`
* **Path**: `/api/v1/places/timezone`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
  - `timestamp` (integer, optional)
* **Response Body** (`200 OK`): Timezone configuration metadata.

### 10. Aggregate Nearby Places
* **HTTP Method**: `POST`
* **Path**: `/api/v1/places/aggregate`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "lat": 23.8103,
    "lng": 90.4125,
    "radius": 1500,
    "place_types": ["restaurant", "cafe"]
  }
  ```
* **Response Body** (`200 OK`): Consolidated local places map data.

---

## Navigation (`/api/v1/navigation`)

### 1. Get Directions
* **HTTP Method**: `GET`
* **Path**: `/api/v1/navigation/directions`
* **Authentication Required**: No
* **Query Parameters**:
  - `origin` (string, required): Lat,lng or address. E.g. `"23.8103,90.4125"`
  - `destination` (string, required): Lat,lng or address.
  - `mode` (string, optional, default = `"driving"`): One of `driving`, `walking`, `bicycling`, `transit`.
* **Response Body** (`200 OK`): Standard path, duration, and distance.

### 2. Compute Routes (Advanced)
* **HTTP Method**: `POST`
* **Path**: `/api/v1/navigation/compute-routes`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "origin": {
      "location": {
        "latLng": {
          "latitude": 23.8103,
          "longitude": 90.4125
        }
      }
    },
    "destination": {
      "location": {
        "latLng": {
          "latitude": 23.8223,
          "longitude": 90.4225
        }
      }
    },
    "travel_mode": "DRIVE",
    "routing_preference": "TRAFFIC_AWARE"
  }
  ```
* **Response Body** (`200 OK`): Routes compute matrix containing polylines.

### 3. Get Distance Matrix
* **HTTP Method**: `GET`
* **Path**: `/api/v1/navigation/distance-matrix`
* **Authentication Required**: No
* **Query Parameters**:
  - `origins` (list of strings, required): Repeated parameter, e.g. `origins=23.8,90.4&origins=23.9,90.5`
  - `destinations` (list of strings, required): Repeated parameter, e.g. `destinations=23.82,90.42`
  - `mode` (string, optional, default = `"driving"`)
* **Response Body** (`200 OK`): Elements containing distance and duration metrics.

### 4. Optimize Routes (TSP Solver)
* **HTTP Method**: `POST`
* **Path**: `/api/v1/navigation/optimize-routes`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "model": {
      "shipments": [],
      "vehicles": []
    }
  }
  ```
* **Response Body** (`200 OK`): Solved waypoint sequence object.

### 5. Snap to Roads
* **HTTP Method**: `GET`
* **Path**: `/api/v1/navigation/snap-to-roads`
* **Authentication Required**: No
* **Query Parameters**:
  - `path` (string, required): Pipes-separated coordinate path, e.g. `"23.810,90.412|23.811,90.413"`
* **Response Body** (`200 OK`): List of snapped points.

### 6. Speed Limits
* **HTTP Method**: `GET`
* **Path**: `/api/v1/navigation/speed-limits`
* **Authentication Required**: No
* **Query Parameters**:
  - `path` (string, required): Pipes-separated coordinate path or Google Place IDs.
* **Response Body** (`200 OK`): Speed limit metadata for roads.

---

## User Pins (`/api/v1/pins`)

### 1. Create Saved Pin
* **HTTP Method**: `POST`
* **Path**: `/api/v1/pins/`
* **Authentication Required**: Yes
* **Request Body** (`application/json`):
  ```json
  {
    "name": "My Workspace",
    "description": "Building A, Floor 5",
    "lat": 23.8103,
    "lng": 90.4125
  }
  ```
* **Response Body** (`201 Created`):
  ```json
  {
    "id": "e2185f64-5717-4562-b3fc-2c963f66afb1",
    "name": "My Workspace",
    "description": "Building A, Floor 5",
    "lat": 23.8103,
    "lng": 90.4125,
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "created_at": "2026-06-15T16:10:00Z"
  }
  ```

### 2. List Saved Pins
* **HTTP Method**: `GET`
* **Path**: `/api/v1/pins/`
* **Authentication Required**: Yes
* **Response Body** (`200 OK`):
  ```json
  [
    {
      "id": "e2185f64-5717-4562-b3fc-2c963f66afb1",
      "name": "My Workspace",
      "description": "Building A, Floor 5",
      "lat": 23.8103,
      "lng": 90.4125,
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "created_at": "2026-06-15T16:10:00Z"
    }
  ]
  ```

### 3. Update Saved Pin
* **HTTP Method**: `PUT`
* **Path**: `/api/v1/pins/{pin_id}`
* **Authentication Required**: Yes
* **Path Parameters**:
  - `pin_id` (string/UUID, required)
* **Request Body** (`application/json`):
  ```json
  {
    "name": "Updated Office Name",
    "description": "Building B, Ground Floor"
  }
  ```
  > **Note**: Fields in update payload are optional.
* **Response Body** (`200 OK`): Full updated pin response.

### 4. Delete Saved Pin
* **HTTP Method**: `DELETE`
* **Path**: `/api/v1/pins/{pin_id}`
* **Authentication Required**: Yes
* **Path Parameters**:
  - `pin_id` (string/UUID, required)
* **Response Body** (`204 No Content`): Returns empty response on success.

---

## Reviews & Ratings (`/api/v1/reviews`)

### 1. Add Review
* **HTTP Method**: `POST`
* **Path**: `/api/v1/reviews/`
* **Authentication Required**: Yes
* **Request Body** (`application/json`):
  ```json
  {
    "rating": 5,
    "comment": "Incredible coffee and fast wifi!",
    "google_place_id": "ChIJVX43yT-uVToRLz1uY456asd",
    "place_name": "Espresso Club",
    "place_address": "123 Main St, New York, NY",
    "lat": 40.7128,
    "lng": -74.0060
  }
  ```
* **Response Body** (`201 Created`):
  ```json
  {
    "id": "e7185f64-5717-4562-b3fc-2c963f66afc9",
    "rating": 5,
    "comment": "Incredible coffee and fast wifi!",
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "place_id": "8f185f64-5717-4562-b3fc-2c963f66afd3",
    "created_at": "2026-06-15T16:15:00Z",
    "reviewer_name": "John Doe"
  }
  ```

### 2. Get Reviews for Place
* **HTTP Method**: `GET`
* **Path**: `/api/v1/reviews/place/{google_place_id}`
* **Authentication Required**: No
* **Path Parameters**:
  - `google_place_id` (string, required)
* **Response Body** (`200 OK`):
  ```json
  [
    {
      "id": "e7185f64-5717-4562-b3fc-2c963f66afc9",
      "rating": 5,
      "comment": "Incredible coffee and fast wifi!",
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "place_id": "8f185f64-5717-4562-b3fc-2c963f66afd3",
      "created_at": "2026-06-15T16:15:00Z",
      "reviewer_name": "John Doe"
    }
  ]
  ```

### 3. Delete Review
* **HTTP Method**: `DELETE`
* **Path**: `/api/v1/reviews/{review_id}`
* **Authentication Required**: Yes
* **Path Parameters**:
  - `review_id` (string/UUID, required)
* **Response Body** (`200 OK`):
  ```json
  {
    "status": "success"
  }
  ```

---

## Saved Lists (`/api/v1/lists`)

### 1. Create Saved List
* **HTTP Method**: `POST`
* **Path**: `/api/v1/lists/`
* **Authentication Required**: Yes
* **Request Body** (`application/json`):
  ```json
  {
    "name": "Summer Trip 2026",
    "is_public": false
  }
  ```
* **Response Body** (`201 Created`):
  ```json
  {
    "id": "d1185f64-5717-4562-b3fc-2c963f66afe5",
    "name": "Summer Trip 2026",
    "is_public": false,
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "created_at": "2026-06-15T16:20:00Z",
    "places_count": 0
  }
  ```

### 2. Get User Lists
* **HTTP Method**: `GET`
* **Path**: `/api/v1/lists/`
* **Authentication Required**: Yes
* **Response Body** (`200 OK`): List of UserList objects.

### 3. Add Place to List
* **HTTP Method**: `POST`
* **Path**: `/api/v1/lists/{list_id}/places`
* **Authentication Required**: Yes
* **Path Parameters**:
  - `list_id` (string/UUID, required)
* **Request Body** (`application/json`):
  ```json
  {
    "google_place_id": "ChIJVX43yT-uVToRLz1uY456asd",
    "name": "Espresso Club",
    "address": "123 Main St, New York, NY",
    "lat": 40.7128,
    "lng": -74.0060
  }
  ```
* **Response Body** (`200 OK`):
  ```json
  {
    "status": "success"
  }
  ```

### 4. Remove Place from List
* **HTTP Method**: `DELETE`
* **Path**: `/api/v1/lists/{list_id}/places/{place_id}`
* **Authentication Required**: Yes
* **Path Parameters**:
  - `list_id` (string/UUID, required)
  - `place_id` (string/UUID, required): The internal place ID within B-Map (UUID).
* **Response Body** (`200 OK`):
  ```json
  {
    "status": "success"
  }
  ```

### 5. Get List Details
* **HTTP Method**: `GET`
* **Path**: `/api/v1/lists/{list_id}`
* **Authentication Required**: Optional (Public lists can be viewed by anyone, private lists are restricted to list owner)
* **Path Parameters**:
  - `list_id` (string/UUID, required)
* **Response Body** (`200 OK`):
  ```json
  {
    "id": "d1185f64-5717-4562-b3fc-2c963f66afe5",
    "name": "Summer Trip 2026",
    "is_public": false,
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "created_at": "2026-06-15T16:20:00Z",
    "places": [
      {
        "id": "8f185f64-5717-4562-b3fc-2c963f66afd3",
        "google_place_id": "ChIJVX43yT-uVToRLz1uY456asd",
        "name": "Espresso Club",
        "address": "123 Main St, New York, NY",
        "lat": 40.7128,
        "lng": -74.0060,
        "rating": null,
        "user_ratings_total": null,
        "created_at": "2026-06-15T16:15:00Z"
      }
    ]
  }
  ```

---

## Timeline & History (`/api/v1/timeline`)

### 1. Log Location Trace
* **HTTP Method**: `POST`
* **Path**: `/api/v1/timeline/`
* **Authentication Required**: Yes
* **Request Body** (`application/json`):
  ```json
  {
    "lat": 23.8103,
    "lng": 90.4125
  }
  ```
* **Response Body** (`201 Created`):
  ```json
  {
    "id": "a9185f64-5717-4562-b3fc-2c963f66aff1",
    "lat": 23.8103,
    "lng": 90.4125,
    "timestamp": "2026-06-15T16:25:00Z"
  }
  ```

### 2. Get Location Timeline
* **HTTP Method**: `GET`
* **Path**: `/api/v1/timeline/`
* **Authentication Required**: Yes
* **Query Parameters**:
  - `start_date` (string/datetime format, optional): E.g. `"2026-06-15T00:00:00Z"`
  - `end_date` (string/datetime format, optional)
* **Response Body** (`200 OK`): List of TimelineResponse coordinates trace objects.

### 3. Get Timeline Stats
* **HTTP Method**: `GET`
* **Path**: `/api/v1/timeline/stats`
* **Authentication Required**: Yes
* **Response Body** (`200 OK`):
  ```json
  {
    "total_distance_km": 142.5,
    "distinct_locations_count": 8,
    "active_days_count": 4,
    "most_visited_cluster": []
  }
  ```

---

## Offline Pre-fetching (`/api/v1/offline`)

### 1. Fetch Off-line Cache Region Data
* **HTTP Method**: `GET`
* **Path**: `/api/v1/offline/cache`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat_min` (float, required): Minimum boundary latitude (ge=-90.0, le=90.0).
  - `lng_min` (float, required): Minimum boundary longitude (ge=-180.0, le=180.0).
  - `lat_max` (float, required): Maximum boundary latitude (ge=-90.0, le=90.0).
  - `lng_max` (float, required): Maximum boundary longitude (ge=-180.0, le=180.0).
* **Response Body** (`200 OK`): Aggregated payload representing offline maps, routing details, and places inside the bounding area.

---

## Maps (`/api/v1/maps`)

### 1. Create Tile Session
* **HTTP Method**: `POST`
* **Path**: `/api/v1/maps/tiles/session`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "map_type": "roadmap"
  }
  ```
* **Response Body** (`200 OK`): Returns session token info from Google Map Tiles service.

### 2. Get Elevation
* **HTTP Method**: `GET`
* **Path**: `/api/v1/maps/elevation`
* **Authentication Required**: No
* **Query Parameters**:
  - `locations` (string, required): Pipes-separated coordinate list, e.g. `"23.810,90.412|23.811,90.413"`
* **Response Body** (`200 OK`): Elevation values list.

### 3. Get Aerial View (3D Render)
* **HTTP Method**: `GET`
* **Path**: `/api/v1/maps/aerial-view`
* **Authentication Required**: No
* **Query Parameters**:
  - `address` (string, required): Center address string.
* **Response Body** (`200 OK`): Google Aerial View API media render info.

### 4. Get Static Map URL
* **HTTP Method**: `GET`
* **Path**: `/api/v1/maps/static`
* **Authentication Required**: No
* **Query Parameters**:
  - `center` (string, required): Latitude, longitude or address string.
  - `zoom` (integer, optional, default = `14`)
  - `size` (string, optional, default = `"600x400"`)
* **Response Body** (`200 OK`): Returns string (the static image URL).

### 5. Get Street View Panorama URL
* **HTTP Method**: `GET`
* **Path**: `/api/v1/maps/streetview`
* **Authentication Required**: No
* **Query Parameters**:
  - `location` (string, required): Latitude, longitude or address string.
  - `size` (string, optional, default = `"600x400"`)
* **Response Body** (`200 OK`): Returns string (the panorama image URL).

### 6. List Geospatial Datasets
* **HTTP Method**: `GET`
* **Path**: `/api/v1/maps/datasets`
* **Authentication Required**: No
* **Response Body** (`200 OK`): List of datasets.

### 7. Create Geospatial Dataset
* **HTTP Method**: `POST`
* **Path**: `/api/v1/maps/datasets`
* **Authentication Required**: No
* **Request Body** (`application/json`):
  ```json
  {
    "display_name": "My Custom Heatmap"
  }
  ```
* **Response Body** (`200 OK`): Dataset metadata.

### 8. Delete Geospatial Dataset
* **HTTP Method**: `DELETE`
* **Path**: `/api/v1/maps/datasets/{dataset_id}`
* **Authentication Required**: No
* **Path Parameters**:
  - `dataset_id` (string, required)
* **Response Body** (`200 OK`): Action status.

---

## Environment (`/api/v1/environment`)

### 1. Get Air Quality (AQI)
* **HTTP Method**: `GET`
* **Path**: `/api/v1/environment/air-quality`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
* **Response Body** (`200 OK`): Google Air Quality Index details.

### 2. Get Pollen Forecast
* **HTTP Method**: `GET`
* **Path**: `/api/v1/environment/pollen`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
  - `days` (integer, optional, default = `1` day forecast)
* **Response Body** (`200 OK`): Detailed pollen forecast.

### 3. Get Weather Info
* **HTTP Method**: `GET`
* **Path**: `/api/v1/environment/weather`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
  - `query_type` (string, optional, default = `"current"`): One of `current`, `forecast_daily`, `forecast_hourly`, `history`
* **Response Body** (`200 OK`): Weather data payload.

### 4. Get Solar Potential
* **HTTP Method**: `GET`
* **Path**: `/api/v1/environment/solar`
* **Authentication Required**: No
* **Query Parameters**:
  - `lat` (float, required)
  - `lng` (float, required)
* **Response Body** (`200 OK`): Solar potential metrics.

---

## System/Utilities

### 1. Developer Console Home Page
* **HTTP Method**: `GET`
* **Path**: `/`
* **Authentication Required**: No
* **Response Body** (`200 OK`): HTML welcome page.

### 2. Health Check
* **HTTP Method**: `GET`
* **Path**: `/health`
* **Authentication Required**: No
* **Response Body** (`200 OK`):
  ```json
  {
    "status": "healthy"
  }
  ```
