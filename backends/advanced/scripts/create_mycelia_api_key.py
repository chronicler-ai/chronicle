#!/usr/bin/env python3
"""Create a proper Mycelia API key (not OAuth client) for Chronicle user."""

import base64
import os
import sys
import secrets
import hashlib
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# MongoDB configuration
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27018")
MYCELIA_DB = os.getenv("MYCELIA_DB", os.getenv("DATABASE_NAME", "mycelia_test"))

# User ID from JWT or argument
USER_ID = os.getenv("USER_ID", "692c7727c7b16bdf58d23cd1")  # test user


def hash_api_key_with_salt(api_key: str, salt: bytes) -> str:
    """Hash API key with salt (matches Mycelia's hashApiKey function)."""
    # SHA256(salt + apiKey) in base64
    h = hashlib.sha256()
    h.update(salt)
    h.update(api_key.encode('utf-8'))
    return base64.b64encode(h.digest()).decode('utf-8')  # Use base64 like Mycelia


def main():
    print(f"📊 MongoDB Configuration:")
    print(f"   URL: {MONGO_URL}")
    print(f"   Database: {MYCELIA_DB}\n")

    print("🔐 Creating Mycelia API Key\n")

    # Generate API key in Mycelia format: mycelia_{random_base64url}
    random_part = secrets.token_urlsafe(32)
    api_key = f"mycelia_{random_part}"

    # Generate salt (32 bytes)
    salt = secrets.token_bytes(32)

    # Hash the API key with salt
    hashed_key = hash_api_key_with_salt(api_key, salt)

    # Open prefix (first 16 chars for fast lookup)
    open_prefix = api_key[:16]

    print(f"✅ Generated API Key:")
    print(f"   Key: {api_key}")
    print(f"   Open Prefix: {open_prefix}")
    print(f"   Owner: {USER_ID}\n")

    # Connect to MongoDB
    client = MongoClient(MONGO_URL)
    db = client[MYCELIA_DB]
    api_keys = db["api_keys"]

    # Check for existing active keys for this user
    existing = api_keys.find_one({"owner": USER_ID, "isActive": True})
    if existing:
        print(f"ℹ️  Existing active API key found: {existing['_id']}")
        print(f"   Deactivating old key...\n")
        api_keys.update_one(
            {"_id": existing["_id"]},
            {"$set": {"isActive": False}}
        )

    # Create API key document (matches Mycelia's format)
    api_key_doc = {
        "hashedKey": hashed_key,  # Note: hashedKey, not hash!
        "salt": base64.b64encode(salt).decode('utf-8'),  # Store as base64 like Mycelia
        "owner": USER_ID,
        "name": "Chronicle Integration",
        "policies": [
            {
                "resource": "**",
                "action": "*",
                "effect": "allow"
            }
        ],
        "openPrefix": open_prefix,
        "createdAt": datetime.now(),
        "isActive": True,
    }

    # Insert into database
    result = api_keys.insert_one(api_key_doc)
    client_id = str(result.inserted_id)

    print(f"🎉 API Key Created Successfully!")
    print(f"   Client ID: {client_id}")
    print(f"   API Key: {api_key}")
    print(f"\n" + "=" * 70)
    print("📋 MYCELIA CONFIGURATION (Test Environment)")
    print("=" * 70)
    print(f"\n1️⃣  Configure Mycelia Frontend Settings:")
    print(f"   • Go to: http://localhost:3002/settings")
    print(f"   • API Endpoint: http://localhost:5100")
    print(f"   • Client ID: {client_id}")
    print(f"   • Client Secret: {api_key}")
    print(f"   • Click 'Save' and then 'Test Token'")
    print(f"\n✅ This API key uses the proper Mycelia format with salt!")
    print("=" * 70 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
