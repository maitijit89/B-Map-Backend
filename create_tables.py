import sys
from unittest.mock import MagicMock
# Mock asyncpg to bypass import errors when loading app.db.session
sys.modules['asyncpg'] = MagicMock()

import os
import ssl
import urllib.parse
from sqlalchemy import create_engine, text
from app.db.session import Base
# Import models to ensure they are registered with Base metadata
from app.db.models import User, Incident, Place, Review, Pin, Timeline, UserList
from dotenv import load_dotenv

load_dotenv()

# Build connection string for pg8000 using the IPv4 pooler
DB_USER = "postgres.oqrvudpkthskccruciza"
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_HOST = "aws-1-ap-southeast-1.pooler.supabase.com"
DB_PORT = "5432" # Port for Session Pooler (behaving like direct connection)
DB_NAME = os.environ.get("DB_NAME")
DB_SSLMODE = os.environ.get("DB_SSLMODE", "require")

# URL-encode username and password
quoted_user = urllib.parse.quote_plus(DB_USER)
quoted_password = urllib.parse.quote_plus(DB_PASSWORD) if DB_PASSWORD else ""

# Use postgresql+pg8000 connection scheme
DATABASE_URL_SYNC = f"postgresql+pg8000://{quoted_user}:{quoted_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

connect_args = {}
if DB_SSLMODE == "require":
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl_context"] = ssl_context

print("Connecting to Supabase database pooler via pg8000 (Pure Python PostgreSQL driver)...")
print(f"Host: {DB_HOST}, Port: {DB_PORT}, User: {DB_USER}")
engine = create_engine(DATABASE_URL_SYNC, connect_args=connect_args, echo=True)

with engine.begin() as conn:
    print("Enabling PostGIS extension (required for Geographic Geography columns)...")
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
    
    print("Creating all tables defined in models.py on Supabase...")
    Base.metadata.create_all(conn)
    print("All database tables created successfully on Supabase!")
