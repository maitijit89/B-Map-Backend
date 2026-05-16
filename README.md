# B-Map Backend (Python Version)

A high-performance backend for the B-Map application, migrated from Go to Python using FastAPI.

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with PostGIS
- **ORM**: SQLAlchemy 2.0 + GeoAlchemy2
- **Validation**: Pydantic v2
- **Authentication**: JWT & Google OAuth

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run locally:
   ```bash
   python -m app.main
   ```

## Environment Variables

See `.env` for required configuration.
