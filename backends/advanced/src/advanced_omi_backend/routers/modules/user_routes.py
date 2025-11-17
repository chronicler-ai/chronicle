"""
User management routes for Friend-Lite API.

Handles user CRUD operations and admin user management.
"""

import logging
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from advanced_omi_backend.auth import current_active_user, current_superuser
from advanced_omi_backend.controllers import user_controller
from advanced_omi_backend.users import User, UserCreate, UserUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[User])
async def get_users(current_user: User = Depends(current_superuser)):
    """Get all users. Admin only."""
    return await user_controller.get_users()


@router.post("")
async def create_user(user_data: UserCreate, current_user: User = Depends(current_superuser)):
    """Create a new user. Admin only."""
    return await user_controller.create_user(user_data)


@router.put("/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, current_user: User = Depends(current_superuser)):
    """Update a user. Admin only."""
    return await user_controller.update_user(user_id, user_data)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(current_superuser),
    delete_conversations: bool = False,
    delete_memories: bool = False,
):
    """Delete a user and optionally their associated data. Admin only."""
    return await user_controller.delete_user(user_id, delete_conversations, delete_memories)


@router.post("/me/api-key")
async def generate_api_key(current_user: User = Depends(current_active_user)):
    """Generate a new API key for the current user."""
    try:
        # Generate a secure random API key (32 bytes = 64 hex characters)
        new_api_key = secrets.token_urlsafe(32)

        # Update user with new API key
        current_user.api_key = new_api_key
        current_user.api_key_created_at = datetime.now(UTC)
        await current_user.save()

        logger.info(f"Generated new API key for user {current_user.id}")

        return {
            "api_key": new_api_key,
            "created_at": current_user.api_key_created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to generate API key for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate API key")


@router.delete("/me/api-key")
async def revoke_api_key(current_user: User = Depends(current_active_user)):
    """Revoke the current user's API key."""
    try:
        current_user.api_key = None
        current_user.api_key_created_at = None
        await current_user.save()

        logger.info(f"Revoked API key for user {current_user.id}")

        return {"status": "success", "message": "API key revoked"}
    except Exception as e:
        logger.error(f"Failed to revoke API key for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke API key")
