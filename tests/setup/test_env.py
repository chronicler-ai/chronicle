# Test Environment Configuration
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.test from the tests directory (one level up from setup/)
test_env_path = Path(__file__).resolve().parents[1] / ".env.test"
load_dotenv(test_env_path)

# Load .env from backends/advanced directory to get COMPOSE_PROJECT_NAME
backend_env_path = Path(__file__).resolve().parents[2] / "backends" / "advanced" / ".env"
if backend_env_path.exists():
    load_dotenv(backend_env_path, override=False)

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

# Docker Container Names (dynamically based on COMPOSE_PROJECT_NAME)
# Default to 'advanced' if not set (which is the directory name)
COMPOSE_PROJECT_NAME = os.getenv('COMPOSE_PROJECT_NAME', 'advanced')
WORKERS_CONTAINER = f"{COMPOSE_PROJECT_NAME}-workers-test-1"
REDIS_CONTAINER = f"{COMPOSE_PROJECT_NAME}-redis-test-1"
BACKEND_CONTAINER = f"{COMPOSE_PROJECT_NAME}-friend-backend-test-1"
MONGO_CONTAINER = f"{COMPOSE_PROJECT_NAME}-mongo-test-1"
QDRANT_CONTAINER = f"{COMPOSE_PROJECT_NAME}-qdrant-test-1"
