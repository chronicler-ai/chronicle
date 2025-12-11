"""
Mycelia OAuth Synchronization Service.

This module synchronizes Chronicle users with Mycelia OAuth API keys,
ensuring that when users access Mycelia directly, they use credentials
that map to their Chronicle user ID.
"""

import base64
import hashlib
import logging
import os
import secrets
from datetime import datetime
from typing import Optional, Tuple

from bson import ObjectId
from pymongo import MongoClient

logger = logging.getLogger(__name__)


class MyceliaSyncService:
    """Synchronize Chronicle users with Mycelia OAuth API keys."""

    def __init__(self):
        """Initialize the sync service."""
        # MongoDB configuration
        # MONGODB_URI format: mongodb://host:port/database_name
        self.mongo_url = os.getenv(
            "MONGODB_URI", os.getenv("MONGO_URL", "mongodb://localhost:27017")
        )

        # Determine Mycelia database from environment
        # Test environment uses mycelia_test, production uses mycelia
        self.mycelia_db = os.getenv("MYCELIA_DB", os.getenv("DATABASE_NAME", "mycelia"))

        # Chronicle database - extract from MONGODB_URI or use default
        # Test env: test_db, Production: chronicle
        if "/" in self.mongo_url and self.mongo_url.count("/") >= 3:
            # Extract database name from mongodb://host:port/database
            self.chronicle_db = self.mongo_url.split("/")[-1].split("?")[0] or "chronicle"
        else:
            self.chronicle_db = "chronicle"

        logger.info(f"MyceliaSyncService initialized: {self.mongo_url}, Mycelia DB: {self.mycelia_db}, Chronicle DB: {self.chronicle_db}")

    def _hash_api_key_with_salt(self, api_key: str, salt: bytes) -> str:
        """Hash API key with salt (matches Mycelia's implementation)."""
        h = hashlib.sha256()
        h.update(salt)
        h.update(api_key.encode("utf-8"))
        return base64.b64encode(h.digest()).decode("utf-8")

    def _create_mycelia_api_key(self, user_id: str, user_email: str) -> Tuple[str, str]:
        """
        Create a Mycelia API key for a Chronicle user.

        Args:
            user_id: Chronicle user ID (MongoDB ObjectId as string)
            user_email: User email address

        Returns:
            Tuple of (client_id, api_key)
        """
        # Generate API key in Mycelia format
        random_part = secrets.token_urlsafe(32)
        api_key = f"mycelia_{random_part}"

        # Generate salt
        salt = secrets.token_bytes(32)

        # Hash the API key
        hashed_key = self._hash_api_key_with_salt(api_key, salt)

        # Open prefix for fast lookup
        open_prefix = api_key[:16]

        # Connect to Mycelia database
        client = MongoClient(self.mongo_url)
        db = client[self.mycelia_db]
        api_keys_collection = db["api_keys"]

        # Check if user already has an active API key
        existing = api_keys_collection.find_one({
            "owner": user_id,
            "isActive": True,
            "name": f"Chronicle Auto ({user_email})"
        })

        if existing:
            logger.info(f"User {user_email} already has Mycelia API key: {existing['_id']}")
            # Return existing credentials (we can't retrieve the original API key)
            # User will need to use the stored credentials
            return str(existing["_id"]), None

        # Create new API key document
        api_key_doc = {
            "hashedKey": hashed_key,
            "salt": base64.b64encode(salt).decode('utf-8'),
            "owner": user_id,  # CRITICAL: owner = Chronicle user ID
            "name": f"Chronicle Auto ({user_email})",
            "policies": [
                {
                    "resource": "**",
                    "action": "*",
                    "effect": "allow"
                }
            ],
            "openPrefix": open_prefix,
            "createdAt": datetime.utcnow(),
            "isActive": True,
        }

        # Insert into Mycelia database
        result = api_keys_collection.insert_one(api_key_doc)
        client_id = str(result.inserted_id)

        logger.info(f"✅ Created Mycelia API key for {user_email}: {client_id}")

        return client_id, api_key

    def sync_user_to_mycelia(self, user_id: str, user_email: str) -> Optional[Tuple[str, str]]:
        """
        Sync a Chronicle user to Mycelia OAuth.

        Args:
            user_id: Chronicle user ID
            user_email: User email

        Returns:
            Tuple of (client_id, api_key) or None if sync fails
        """
        try:
            # Create Mycelia API key
            client_id, api_key = self._create_mycelia_api_key(user_id, user_email)

            # Store credentials in Chronicle user document (if new key was created)
            if api_key:
                client = MongoClient(self.mongo_url)
                db = client[self.chronicle_db]
                users_collection = db["users"]

                users_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {
                        "$set": {
                            "mycelia_oauth": {
                                "client_id": client_id,
                                "created_at": datetime.utcnow(),
                                "synced": True,
                            }
                        }
                    },
                )

                logger.info(f"✅ Synced {user_email} with Mycelia OAuth")
                return client_id, api_key
            else:
                logger.info(f"ℹ️  {user_email} already synced with Mycelia")
                return client_id, None

        except Exception as e:
            logger.error(f"Failed to sync {user_email} to Mycelia: {e}", exc_info=True)
            return None

    def sync_admin_user(self) -> Optional[Tuple[str, str]]:
        """
        Sync the admin user on startup.

        Returns:
            Tuple of (client_id, api_key) if new key created, or None
        """
        try:
            admin_email = os.getenv("ADMIN_EMAIL")
            if not admin_email:
                logger.warning("ADMIN_EMAIL not set, skipping Mycelia sync")
                return None

            # Get admin user from Chronicle database
            client = MongoClient(self.mongo_url)
            db = client[self.chronicle_db]
            users_collection = db["users"]

            admin_user = users_collection.find_one({"email": admin_email})
            if not admin_user:
                logger.warning(f"Admin user {admin_email} not found in database")
                return None

            user_id = str(admin_user["_id"])

            # Sync to Mycelia
            result = self.sync_user_to_mycelia(user_id, admin_email)

            if result:
                client_id, api_key = result
                if api_key:
                    # Credentials created successfully - don't log them
                    logger.info("=" * 70)
                    logger.info("🔑 MYCELIA OAUTH CREDENTIALS CREATED")
                    logger.info("=" * 70)
                    logger.info(f"User:          {admin_email}")
                    logger.info(f"Client ID:     {client_id}")
                    logger.info("")
                    logger.info("🔐 To retrieve credentials for Mycelia configuration:")
                    logger.info("   cd backends/advanced/scripts")
                    logger.info("   python create_mycelia_api_key.py")
                    logger.info("")
                    logger.info(
                        "📝 This will display the API key needed for Mycelia frontend setup"
                    )
                    logger.info("=" * 70)

            return result

        except Exception as e:
            logger.error(f"Failed to sync admin user: {e}", exc_info=True)
            return None


# Global instance
_sync_service: Optional[MyceliaSyncService] = None


def get_mycelia_sync_service() -> MyceliaSyncService:
    """Get or create the global Mycelia sync service instance."""
    global _sync_service
    if _sync_service is None:
        _sync_service = MyceliaSyncService()
    return _sync_service


async def sync_admin_on_startup():
    """Run admin user sync on application startup."""
    logger.info("🔄 Starting Mycelia OAuth synchronization...")

    # Check if Mycelia sync is enabled
    memory_provider = os.getenv("MEMORY_PROVIDER", "chronicle").lower()
    if memory_provider != "mycelia":
        logger.info("Mycelia sync skipped (MEMORY_PROVIDER != mycelia)")
        return

    sync_service = get_mycelia_sync_service()
    result = sync_service.sync_admin_user()

    if result:
        logger.info("✅ Mycelia OAuth sync completed")
    else:
        logger.warning("⚠️  Mycelia OAuth sync completed with warnings")
