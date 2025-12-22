# Test Environment Configuration
import os
from pathlib import Path

# Load .env file from backends/advanced directory if it exists
# This allows tests to work when run from VSCode or command line
def load_env_file():
    """Load environment variables from .env file if it exists."""
    # Look for .env in backends/advanced directory
    env_file = Path(__file__).parent.parent.parent / "backends" / "advanced" / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Only set if not already in environment (CI takes precedence)
                    if key not in os.environ:
                        os.environ[key] = value

# Load .env file (CI environment variables take precedence)
load_env_file()

# API Configuration
API_URL = 'http://localhost:8001'  # Use BACKEND_URL from test.env
API_BASE = 'http://localhost:8001/api'
SPEAKER_RECOGNITION_URL = 'http://localhost:8085'  # Speaker recognition service

WEB_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')  # Use FRONTEND_URL from test.env

# Test-specific credentials (override any values from .env)
# These are the credentials used in docker-compose-test.yml
ADMIN_EMAIL = 'test-admin@example.com'
ADMIN_PASSWORD = 'test-admin-password-123'

# Admin user credentials (Robot Framework format)
ADMIN_USER = {
    "email": ADMIN_EMAIL,
    "password": ADMIN_PASSWORD
}

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
BACKEND_CONTAINER = f"{COMPOSE_PROJECT_NAME}-chronicle-backend-test-1"
WORKERS_CONTAINER = f"{COMPOSE_PROJECT_NAME}-workers-test-1"
MONGO_CONTAINER = f"{COMPOSE_PROJECT_NAME}-mongo-test-1"
REDIS_CONTAINER = f"{COMPOSE_PROJECT_NAME}-redis-test-1"
QDRANT_CONTAINER = f"{COMPOSE_PROJECT_NAME}-qdrant-test-1"
WEBUI_CONTAINER = f"{COMPOSE_PROJECT_NAME}-webui-test-1"
