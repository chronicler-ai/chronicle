#!/bin/bash
set -e

# Chronicle Admin Reset Script
# Removes admin users from database and clears auth variables for fresh setup

echo "🧹 Chronicle Admin Reset"
echo "========================================"

# Check we're in the right directory
if [ ! -f "docker-compose.yml" ] || [ ! -f "docker-compose.infra.yml" ]; then
    echo "❌ Error: Must be run from the GOLD directory"
    echo "   cd to the directory containing docker-compose.yml"
    exit 1
fi
echo ""
echo "⚠️  WARNING: This will:"
echo "   - Remove ALL admin users from the database"
echo "   - Clear AUTH_SECRET_KEY from .env"
echo "   - Clear ADMIN_PASSWORD from .env"
echo "   - Allow you to run ./go.sh for a fresh setup"
echo ""
read -p "Are you sure? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Aborted"
    exit 0
fi

# Get database name - check where backend actually loads it from
# Priority: backends/advanced/.env > root .env > .env.default > hardcoded default
if [ -f backends/advanced/.env ]; then
    MONGODB_DATABASE=$(grep "^MONGODB_DATABASE=" backends/advanced/.env | cut -d'=' -f2)
fi

if [ -z "$MONGODB_DATABASE" ] && [ -f .env ]; then
    MONGODB_DATABASE=$(grep "^MONGODB_DATABASE=" .env | cut -d'=' -f2)
fi

if [ -z "$MONGODB_DATABASE" ] && [ -f .env.default ]; then
    MONGODB_DATABASE=$(grep "^MONGODB_DATABASE=" .env.default | cut -d'=' -f2)
fi

# Final fallback to backend's hardcoded default
if [ -z "$MONGODB_DATABASE" ]; then
    MONGODB_DATABASE="friend-lite"
fi

echo "📦 Database: ${MONGODB_DATABASE}"
echo ""

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if ! docker ps | grep -q "mongo"; then
    echo "⚠️  MongoDB container is not running"
    echo "   Starting MongoDB..."
    docker compose -f docker-compose.infra.yml up -d mongo
    echo "   Waiting for MongoDB to be ready..."
    sleep 5
fi

# Remove admin users from MongoDB
echo "🗑️  Removing admin users from database..."
docker exec -i mongo mongosh "${MONGODB_DATABASE}" --quiet --eval '
const beforeCount = db.users.countDocuments({ is_superuser: true });
const result = db.users.deleteMany({ is_superuser: true });
const afterCount = db.users.countDocuments({ is_superuser: true });
print("✅ Removed " + result.deletedCount + " admin user(s). Remaining admins: " + afterCount);
' || echo "⚠️  MongoDB operation may have failed - check if container is running"

echo ""
echo "🔐 Clearing auth variables from .env files..."

# Function to clear auth variables from a file
clear_auth_vars() {
    local file=$1
    local cleared=false

    if [ -f "$file" ]; then
        # Clear AUTH_SECRET_KEY
        if grep -q "^AUTH_SECRET_KEY=" "$file"; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=|" "$file"
            else
                sed -i "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=|" "$file"
            fi
            echo "   ✅ AUTH_SECRET_KEY cleared from $file"
            cleared=true
        fi

        # Clear ADMIN_PASSWORD
        if grep -q "^ADMIN_PASSWORD=" "$file"; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=|" "$file"
            else
                sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=|" "$file"
            fi
            echo "   ✅ ADMIN_PASSWORD cleared from $file"
            cleared=true
        fi
    fi
}

# Clear from root .env
clear_auth_vars ".env"

# Clear from backends/advanced/.env (this is what the backend actually uses!)
clear_auth_vars "backends/advanced/.env"

if [ ! -f .env ] && [ ! -f backends/advanced/.env ]; then
    echo "   ⚠️  No .env files found (will be created by go.sh)"
fi

echo ""
echo "🔄 Restarting backend to invalidate active sessions..."
docker compose restart backend 2>/dev/null || echo "   ⚠️  Backend not running (that's ok)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Admin reset complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Next steps:"
echo "   1. Clear your browser cache/localStorage (Cmd+Shift+R or hard refresh)"
echo "   2. Visit the web UI - you'll be redirected to /setup"
echo "   3. Create a new admin account"
echo ""
echo "💡 Or run ./go.sh to restart everything fresh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
