#!/usr/bin/env python3
"""
Sync Friend-Lite users with Mycelia OAuth credentials.

This script helps migrate existing Friend-Lite installations to use Mycelia,
or sync existing Mycelia installations with Friend-Lite users.

Usage:
    # Dry run (preview changes)
    python scripts/sync_friendlite_mycelia.py --dry-run

    # Sync all users
    python scripts/sync_friendlite_mycelia.py --sync-all

    # Sync specific user
    python scripts/sync_friendlite_mycelia.py --email admin@example.com

    # Check for orphaned Mycelia objects
    python scripts/sync_friendlite_mycelia.py --check-orphans

    # Reassign orphaned objects to a user
    python scripts/sync_friendlite_mycelia.py --reassign-orphans --target-email admin@example.com

Environment Variables:
    MONGODB_URI or MONGO_URL - MongoDB connection string
    MYCELIA_DB - Mycelia database name (default: mycelia)
"""

import os
import sys
import argparse
import secrets
import hashlib
import base64
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pymongo import MongoClient
from bson import ObjectId

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


class FriendLiteMyceliaSync:
    """Sync Friend-Lite users with Mycelia OAuth credentials."""

    def __init__(self, mongo_url: str, mycelia_db: str, friendlite_db: str):
        self.mongo_url = mongo_url
        self.mycelia_db = mycelia_db
        self.friendlite_db = friendlite_db
        self.client = MongoClient(mongo_url)

        print(f"📊 Connected to MongoDB:")
        print(f"   URL: {mongo_url}")
        print(f"   Friend-Lite DB: {friendlite_db}")
        print(f"   Mycelia DB: {mycelia_db}\n")

    def _hash_api_key_with_salt(self, api_key: str, salt: bytes) -> str:
        """Hash API key with salt (matches Mycelia's implementation)."""
        h = hashlib.sha256()
        h.update(salt)
        h.update(api_key.encode('utf-8'))
        return base64.b64encode(h.digest()).decode('utf-8')

    def get_all_friendlite_users(self) -> List[Dict]:
        """Get all users from Friend-Lite database."""
        db = self.client[self.friendlite_db]
        users = list(db["users"].find({}))
        return users

    def get_all_mycelia_objects(self) -> List[Dict]:
        """Get all objects from Mycelia database."""
        db = self.client[self.mycelia_db]
        objects = list(db["objects"].find({}))
        return objects

    def get_mycelia_api_key_for_user(self, user_id: str) -> Optional[Dict]:
        """Check if user already has a Mycelia API key."""
        db = self.client[self.mycelia_db]
        api_key = db["api_keys"].find_one({
            "owner": user_id,
            "isActive": True
        })
        return api_key

    def create_mycelia_api_key(self, user_id: str, user_email: str, dry_run: bool = False) -> Tuple[str, str]:
        """Create a Mycelia API key for a Friend-Lite user."""
        # Generate API key
        random_part = secrets.token_urlsafe(32)
        api_key = f"mycelia_{random_part}"
        salt = secrets.token_bytes(32)
        hashed_key = self._hash_api_key_with_salt(api_key, salt)
        open_prefix = api_key[:16]

        api_key_doc = {
            "hashedKey": hashed_key,
            "salt": base64.b64encode(salt).decode('utf-8'),
            "owner": user_id,
            "name": f"Friend-Lite Auto ({user_email})",
            "policies": [{"resource": "**", "action": "*", "effect": "allow"}],
            "openPrefix": open_prefix,
            "createdAt": datetime.utcnow(),
            "isActive": True,
        }

        if dry_run:
            print(f"   [DRY RUN] Would create API key with owner={user_id}")
            return "dry-run-client-id", "dry-run-api-key"

        db = self.client[self.mycelia_db]
        result = db["api_keys"].insert_one(api_key_doc)
        client_id = str(result.inserted_id)

        # Update Friend-Lite user document
        fl_db = self.client[self.friendlite_db]
        fl_db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "mycelia_oauth": {
                        "client_id": client_id,
                        "created_at": datetime.utcnow(),
                        "synced": True
                    }
                }
            }
        )

        return client_id, api_key

    def sync_user(self, user: Dict, dry_run: bool = False) -> bool:
        """Sync a single user to Mycelia OAuth."""
        user_id = str(user["_id"])
        user_email = user.get("email", "unknown")

        # Check if already synced
        existing = self.get_mycelia_api_key_for_user(user_id)
        if existing:
            print(f"✓ {user_email:40} Already synced (Client ID: {existing['_id']})")
            return False

        # Create new API key
        try:
            client_id, api_key = self.create_mycelia_api_key(user_id, user_email, dry_run)

            if dry_run:
                print(f"→ {user_email:40} [DRY RUN] Would create OAuth credentials")
            else:
                print(f"✓ {user_email:40} Created OAuth credentials")
                print(f"   Client ID:     {client_id}")
                print(f"   Client Secret: {api_key}")

            return True
        except Exception as e:
            print(f"✗ {user_email:40} Failed: {e}")
            return False

    def sync_all_users(self, dry_run: bool = False):
        """Sync all Friend-Lite users to Mycelia OAuth."""
        users = self.get_all_friendlite_users()

        print(f"{'='*80}")
        print(f"SYNC ALL USERS")
        print(f"{'='*80}")
        print(f"Found {len(users)} Friend-Lite users\n")

        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made\n")

        synced_count = 0
        for user in users:
            if self.sync_user(user, dry_run):
                synced_count += 1

        print(f"\n{'='*80}")
        if dry_run:
            print(f"DRY RUN SUMMARY: Would sync {synced_count} users")
        else:
            print(f"SUMMARY: Synced {synced_count} new users, {len(users) - synced_count} already synced")
        print(f"{'='*80}\n")

    def check_orphaned_objects(self):
        """Find Mycelia objects with userId not matching any Friend-Lite user."""
        users = self.get_all_friendlite_users()
        user_ids = {str(user["_id"]) for user in users}

        objects = self.get_all_mycelia_objects()

        print(f"{'='*80}")
        print(f"ORPHANED OBJECTS CHECK")
        print(f"{'='*80}")
        print(f"Friend-Lite users: {len(user_ids)}")
        print(f"Mycelia objects:   {len(objects)}\n")

        orphaned = []
        user_object_counts = {}

        for obj in objects:
            obj_user_id = obj.get("userId")
            if obj_user_id:
                # Count objects per user
                user_object_counts[obj_user_id] = user_object_counts.get(obj_user_id, 0) + 1

                # Check if orphaned
                if obj_user_id not in user_ids:
                    orphaned.append(obj)

        # Display object distribution
        print("Object distribution by userId:")
        for user_id, count in sorted(user_object_counts.items(), key=lambda x: x[1], reverse=True):
            status = "✓" if user_id in user_ids else "✗ ORPHANED"
            print(f"   {user_id}: {count:4} objects  {status}")

        # Display orphaned objects
        if orphaned:
            print(f"\n⚠️  Found {len(orphaned)} orphaned objects:")
            for obj in orphaned[:10]:  # Show first 10
                obj_id = obj.get("_id")
                obj_name = obj.get("name", "Unnamed")[:50]
                obj_user_id = obj.get("userId")
                print(f"   {obj_id} - {obj_name} (userId: {obj_user_id})")

            if len(orphaned) > 10:
                print(f"   ... and {len(orphaned) - 10} more")
        else:
            print("\n✓ No orphaned objects found!")

        print(f"{'='*80}\n")
        return orphaned

    def reassign_orphaned_objects(self, target_email: str, dry_run: bool = False):
        """Reassign all orphaned objects to a specific Friend-Lite user."""
        # Get target user
        fl_db = self.client[self.friendlite_db]
        target_user = fl_db["users"].find_one({"email": target_email})

        if not target_user:
            print(f"✗ User with email '{target_email}' not found in Friend-Lite")
            return

        target_user_id = str(target_user["_id"])
        print(f"Target user: {target_email} (ID: {target_user_id})\n")

        # Find orphaned objects
        users = self.get_all_friendlite_users()
        user_ids = {str(user["_id"]) for user in users}
        objects = self.get_all_mycelia_objects()

        orphaned = [obj for obj in objects if obj.get("userId") and obj.get("userId") not in user_ids]

        if not orphaned:
            print("✓ No orphaned objects to reassign")
            return

        print(f"{'='*80}")
        print(f"REASSIGN ORPHANED OBJECTS")
        print(f"{'='*80}")
        print(f"Found {len(orphaned)} orphaned objects")

        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made\n")
        else:
            print(f"Will reassign to: {target_email}\n")

        mycelia_db = self.client[self.mycelia_db]

        for obj in orphaned:
            obj_id = obj["_id"]
            old_user_id = obj.get("userId")
            obj_name = obj.get("name", "Unnamed")[:50]

            if dry_run:
                print(f"→ [DRY RUN] Would reassign: {obj_name}")
                print(f"   From: {old_user_id} → To: {target_user_id}")
            else:
                result = mycelia_db["objects"].update_one(
                    {"_id": obj_id},
                    {"$set": {"userId": target_user_id}}
                )
                if result.modified_count > 0:
                    print(f"✓ Reassigned: {obj_name}")
                else:
                    print(f"✗ Failed to reassign: {obj_name}")

        print(f"\n{'='*80}")
        if dry_run:
            print(f"DRY RUN SUMMARY: Would reassign {len(orphaned)} objects to {target_email}")
        else:
            print(f"SUMMARY: Reassigned {len(orphaned)} objects to {target_email}")
        print(f"{'='*80}\n")

    def display_sync_status(self):
        """Display current sync status."""
        users = self.get_all_friendlite_users()

        print(f"{'='*80}")
        print(f"SYNC STATUS")
        print(f"{'='*80}\n")

        synced_count = 0
        unsynced_count = 0

        print(f"{'Email':<40} {'User ID':<30} {'Status'}")
        print(f"{'-'*40} {'-'*30} {'-'*20}")

        for user in users:
            user_id = str(user["_id"])
            user_email = user.get("email", "unknown")

            existing = self.get_mycelia_api_key_for_user(user_id)
            if existing:
                status = f"✓ Synced (Client ID: {existing['_id']})"
                synced_count += 1
            else:
                status = "✗ Not synced"
                unsynced_count += 1

            print(f"{user_email:<40} {user_id:<30} {status}")

        print(f"\n{'='*80}")
        print(f"Total users: {len(users)}")
        print(f"Synced:      {synced_count}")
        print(f"Not synced:  {unsynced_count}")
        print(f"{'='*80}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Sync Friend-Lite users with Mycelia OAuth credentials",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument("--dry-run", action="store_true", help="Preview changes without making them")
    parser.add_argument("--sync-all", action="store_true", help="Sync all Friend-Lite users")
    parser.add_argument("--email", type=str, help="Sync specific user by email")
    parser.add_argument("--check-orphans", action="store_true", help="Check for orphaned Mycelia objects")
    parser.add_argument("--reassign-orphans", action="store_true", help="Reassign orphaned objects to target user")
    parser.add_argument("--target-email", type=str, help="Target user email for reassigning orphans")
    parser.add_argument("--status", action="store_true", help="Display current sync status")

    args = parser.parse_args()

    # Get configuration from environment
    mongo_url = os.getenv("MONGODB_URI") or os.getenv("MONGO_URL", "mongodb://localhost:27017")

    # Extract database name from MONGODB_URI if present
    if "/" in mongo_url and mongo_url.count("/") >= 3:
        friendlite_db = mongo_url.split("/")[-1].split("?")[0] or "friend-lite"
    else:
        friendlite_db = "friend-lite"

    mycelia_db = os.getenv("MYCELIA_DB", os.getenv("DATABASE_NAME", "mycelia"))

    # Create sync service
    sync = FriendLiteMyceliaSync(mongo_url, mycelia_db, friendlite_db)

    # Execute requested action
    if args.status:
        sync.display_sync_status()
    elif args.sync_all:
        sync.sync_all_users(dry_run=args.dry_run)
    elif args.email:
        fl_db = sync.client[friendlite_db]
        user = fl_db["users"].find_one({"email": args.email})
        if user:
            sync.sync_user(user, dry_run=args.dry_run)
        else:
            print(f"✗ User with email '{args.email}' not found")
    elif args.check_orphans:
        sync.check_orphaned_objects()
    elif args.reassign_orphans:
        if not args.target_email:
            print("✗ --target-email required for --reassign-orphans")
            sys.exit(1)
        sync.reassign_orphaned_objects(args.target_email, dry_run=args.dry_run)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
