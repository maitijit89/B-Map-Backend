import sys
import os

# Add the project root to sys.path so 'app' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

# This is for Vercel to find the FastAPI instance
handler = app
