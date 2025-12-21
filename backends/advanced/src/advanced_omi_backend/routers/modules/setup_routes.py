"""
Setup routes for first-time admin account creation.

Provides public endpoints for checking setup status and creating the initial admin user.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from advanced_omi_backend.auth import check_admin_exists, get_user_manager
from advanced_omi_backend.users import UserCreate, get_user_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    """Response model for setup status check."""
    requires_setup: bool = Field(..., description="Whether initial admin setup is required")


class AdminCreateRequest(BaseModel):
    """Request model for creating the first admin user."""
    display_name: str = Field(..., min_length=1, description="Administrator's display name")
    email: EmailStr = Field(..., description="Administrator's email address")
    password: str = Field(..., min_length=8, description="Administrator's password (minimum 8 characters)")
    confirm_password: str = Field(..., description="Password confirmation")

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Validate that password and confirm_password match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class AdminCreateResponse(BaseModel):
    """Response model for successful admin creation."""
    message: str
    user_id: str
    email: str


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status():
    """
    Check if initial admin setup is required.

    Public endpoint (no authentication required).
    Returns whether an admin user already exists.
    """
    try:
        admin_exists = await check_admin_exists()
        return SetupStatusResponse(requires_setup=not admin_exists)
    except Exception as e:
        logger.error(f"Failed to check setup status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check setup status")


@router.post("/create-admin", response_model=AdminCreateResponse, status_code=201)
async def create_admin(request: AdminCreateRequest):
    """
    Create the first admin user.

    Public endpoint (no authentication required).
    Can only be used once - fails if an admin already exists.

    Args:
        request: Admin creation request with display_name, email, password, and confirm_password

    Returns:
        AdminCreateResponse with success message and user details

    Raises:
        409 Conflict: Admin already exists
        400 Bad Request: Validation errors
    """
    try:
        # Atomic check: verify no admin exists before proceeding
        admin_exists = await check_admin_exists()
        if admin_exists:
            logger.warning("Attempted to create admin when one already exists")
            raise HTTPException(
                status_code=409,
                detail="Admin user already exists. Setup has already been completed."
            )

        # Get user database and manager
        user_db_gen = get_user_db()
        user_db = await user_db_gen.__anext__()
        user_manager_gen = get_user_manager(user_db)
        user_manager = await user_manager_gen.__anext__()

        # Create admin user with UserManager (handles password hashing)
        admin_create = UserCreate(
            email=request.email,
            password=request.password,
            is_superuser=True,
            is_verified=True,
            display_name=request.display_name,
        )

        admin_user = await user_manager.create(admin_create)

        logger.info(
            f"✅ Created admin user via web setup: {admin_user.user_id} ({admin_user.email})"
        )

        return AdminCreateResponse(
            message="Admin user created successfully",
            user_id=str(admin_user.id),
            email=admin_user.email
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 409 Conflict)
        raise
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to create admin user. Please try again."
        )
