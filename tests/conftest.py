"""
Pytest configuration and shared fixtures for Friend-Lite tests.

This file provides reusable fixtures and configuration for all pytest tests.
"""

import os
import uuid
from typing import Dict, Any, Optional
import pytest
import requests
from test_env import (
    API_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
)


class APIClient:
    """Simple API client for Friend-Lite backend tests."""

    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url
        self.session = requests.Session()

    def login(self, email: str, password: str) -> str:
        """Login and return JWT token."""
        response = self.session.post(
            f"{self.base_url}/auth/jwt/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        return response.json()["access_token"]

    def get(
        self, endpoint: str, token: Optional[str] = None, expected_status: int = 200
    ) -> requests.Response:
        """Make GET request."""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = self.session.get(f"{self.base_url}{endpoint}", headers=headers)
        if expected_status is not None:
            assert (
                response.status_code == expected_status
            ), f"Expected {expected_status}, got {response.status_code}: {response.text}"
        return response

    def post(
        self,
        endpoint: str,
        token: Optional[str] = None,
        json: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        expected_status: int = 200,
    ) -> requests.Response:
        """Make POST request."""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = self.session.post(
            f"{self.base_url}{endpoint}", headers=headers, json=json, data=data, files=files
        )
        if expected_status is not None:
            assert (
                response.status_code == expected_status
            ), f"Expected {expected_status}, got {response.status_code}: {response.text}"
        return response

    def put(
        self,
        endpoint: str,
        token: Optional[str] = None,
        json: Optional[Dict[str, Any]] = None,
        expected_status: int = 200,
    ) -> requests.Response:
        """Make PUT request."""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = self.session.put(f"{self.base_url}{endpoint}", headers=headers, json=json)
        if expected_status is not None:
            assert (
                response.status_code == expected_status
            ), f"Expected {expected_status}, got {response.status_code}: {response.text}"
        return response

    def delete(
        self,
        endpoint: str,
        token: Optional[str] = None,
        expected_status: int = 200,
    ) -> requests.Response:
        """Make DELETE request."""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = self.session.delete(f"{self.base_url}{endpoint}", headers=headers)
        if expected_status is not None:
            assert (
                response.status_code == expected_status
            ), f"Expected {expected_status}, got {response.status_code}: {response.text}"
        return response

    # Convenience methods for common operations
    def create_chat_session(
        self, token: str, title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a chat session."""
        if title is None:
            title = f"Test Session {uuid.uuid4()}"
        response = self.post(
            "/api/chat/sessions", token=token, json={"title": title}, expected_status=200
        )
        return response.json()

    def get_chat_sessions(self, token: str, limit: int = 100) -> list:
        """Get all chat sessions for user."""
        response = self.get(f"/api/chat/sessions?limit={limit}", token=token)
        return response.json()

    def get_chat_session(self, token: str, session_id: str) -> Dict[str, Any]:
        """Get specific chat session."""
        response = self.get(f"/api/chat/sessions/{session_id}", token=token)
        return response.json()

    def update_chat_session(
        self, token: str, session_id: str, title: str
    ) -> Dict[str, Any]:
        """Update chat session title."""
        response = self.put(
            f"/api/chat/sessions/{session_id}", token=token, json={"title": title}
        )
        return response.json()

    def delete_chat_session(self, token: str, session_id: str) -> Dict[str, Any]:
        """Delete chat session."""
        response = self.delete(f"/api/chat/sessions/{session_id}", token=token)
        return response.json()

    def get_session_messages(self, token: str, session_id: str) -> list:
        """Get messages from a chat session."""
        response = self.get(f"/api/chat/sessions/{session_id}/messages", token=token)
        return response.json()

    def get_chat_statistics(self, token: str) -> Dict[str, Any]:
        """Get chat statistics for user."""
        response = self.get("/api/chat/statistics", token=token)
        return response.json()

    def create_user(
        self, token: str, email: str, password: str, is_superuser: bool = False
    ) -> Dict[str, Any]:
        """Create a new user (admin only)."""
        response = self.post(
            "/api/users",
            token=token,
            json={"email": email, "password": password, "is_superuser": is_superuser},
            expected_status=201,
        )
        return response.json()

    def delete_user(self, token: str, user_id: str) -> Dict[str, Any]:
        """Delete a user (admin only)."""
        response = self.delete(f"/api/users/{user_id}", token=token)
        return response.json()

    def get_current_user(self, token: str) -> Dict[str, Any]:
        """Get current authenticated user."""
        response = self.get("/users/me", token=token)
        return response.json()

    def get_all_users(self, token: str) -> list:
        """Get all users (admin only)."""
        response = self.get("/api/users", token=token)
        return response.json()


@pytest.fixture
def api_client():
    """Provide API client for tests."""
    return APIClient()


@pytest.fixture
def admin_token(api_client):
    """Provide admin authentication token."""
    return api_client.login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture
def test_user_token(api_client, admin_token):
    """Create and authenticate a test user, cleanup after test."""
    # Create test user
    email = f"test-user-{uuid.uuid4()}@example.com"
    user = api_client.create_user(admin_token, email, TEST_USER_PASSWORD)
    user_id = user["user_id"]

    # Login as test user
    token = api_client.login(email, TEST_USER_PASSWORD)

    yield token

    # Cleanup
    try:
        api_client.delete_user(admin_token, user_id)
    except Exception:
        pass  # User might already be deleted


@pytest.fixture
def random_id():
    """Generate a random ID for test data (factory fixture - call to get new ID each time)."""
    def _generate_random_id():
        return str(uuid.uuid4())[:8]
    return _generate_random_id
