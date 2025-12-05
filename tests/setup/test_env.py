# Test Environment Configuration
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.test from the tests directory (one level up from setup/)
test_env_path = Path(__file__).resolve().parents[1] / ".env.test"
load_dotenv(test_env_path)

# API Configuration
API_URL = 'http://localhost:8001'  # Use BACKEND_URL from test.env
API_BASE = 'http://localhost:8001/api'
SPEAKER_RECOGNITION_URL = 'http://localhost:8085'  # Speaker recognition service

WEB_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')  # Use FRONTEND_URL from test.env
# Admin user credentials (Robot Framework format)
ADMIN_USER = {
    "email": os.getenv('ADMIN_EMAIL', 'test-admin@example.com'),
    "password": os.getenv('ADMIN_PASSWORD', 'test-admin-password-123')
}

# Individual variables for Robot Framework
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'test-admin@example.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'test-admin-password-123')

TEST_USER = {
    "email": "test@example.com",
    "password": "test-password"
}

# Individual variables for Robot Framework
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test-password"



# API Endpoints
ENDPOINTS = {
    "health": "/health",
    "readiness": "/readiness",
    "auth": "/auth/jwt/login",
    "conversations": "/api/conversations",
    "memories": "/api/memories",
    "memory_search": "/api/memories/search",
    "users": "/api/users"
}

# API Keys (loaded from test.env)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
HF_TOKEN = os.getenv('HF_TOKEN')

# Test Configuration
TEST_CONFIG = {
    "retry_count": 3,
    "retry_delay": 1,
    "default_timeout": 30
}

# Docker Container Names (from .env.test)
BACKEND_CONTAINER = os.getenv('BACKEND_CONTAINER', 'advanced-chronicle-backend-test-1')
WORKERS_CONTAINER = os.getenv('WORKERS_CONTAINER', 'advanced-workers-test-1')
MONGO_CONTAINER = os.getenv('MONGO_CONTAINER', 'advanced-mongo-test-1')
REDIS_CONTAINER = os.getenv('REDIS_CONTAINER', 'advanced-redis-test-1')
QDRANT_CONTAINER = os.getenv('QDRANT_CONTAINER', 'advanced-qdrant-test-1')
WEBUI_CONTAINER = os.getenv('WEBUI_CONTAINER', 'advanced-webui-test-1')