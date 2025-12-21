#!/bin/bash
set -e

# Chronicle Quick Start - Web UI Setup Flow
# This script starts Chronicle and opens the web UI setup screen to create an admin account

echo "🚀 Chronicle Quick Start - Web UI Setup"
echo "========================================"

# Check we're in the right directory
if [ ! -f "docker-compose.yml" ] || [ ! -f "docker-compose.infra.yml" ]; then
    echo "❌ Error: Must be run from the GOLD directory"
    echo "   cd to the directory containing docker-compose.yml"
    exit 1
fi

# Check if .env exists, if not create from defaults
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.default..."
    cp .env.default .env
fi

# Generate AUTH_SECRET_KEY if not set (check all .env files)
SECRET_KEY=""

# Check if any .env file has a valid AUTH_SECRET_KEY
for env_file in backends/advanced/.env .env; do
    if [ -f "$env_file" ] && grep -q "^AUTH_SECRET_KEY=.\+" "$env_file" 2>/dev/null; then
        SECRET_KEY=$(grep "^AUTH_SECRET_KEY=" "$env_file" | cut -d'=' -f2)
        echo "✅ AUTH_SECRET_KEY already set in $env_file"
        break
    fi
done

# Generate if not found
if [ -z "$SECRET_KEY" ]; then
    echo "🔐 Generating secure AUTH_SECRET_KEY..."
    SECRET_KEY=$(openssl rand -base64 32)
    echo "✅ AUTH_SECRET_KEY generated"
fi

# Ensure it's set in backends/advanced/.env (the one backend actually uses)
if [ -f backends/advanced/.env ]; then
    if grep -q "^AUTH_SECRET_KEY=" backends/advanced/.env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=${SECRET_KEY}|" backends/advanced/.env
        else
            sed -i "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=${SECRET_KEY}|" backends/advanced/.env
        fi
    else
        echo "AUTH_SECRET_KEY=${SECRET_KEY}" >> backends/advanced/.env
    fi
fi

# Also set in root .env for consistency
if [ -f .env ]; then
    if grep -q "^AUTH_SECRET_KEY=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=${SECRET_KEY}|" .env
        else
            sed -i "s|^AUTH_SECRET_KEY=.*|AUTH_SECRET_KEY=${SECRET_KEY}|" .env
        fi
    else
        echo "AUTH_SECRET_KEY=${SECRET_KEY}" >> .env
    fi
fi

# Ensure ADMIN_PASSWORD is empty in all .env files (to trigger web UI setup)
for env_file in .env backends/advanced/.env; do
    if [ -f "$env_file" ] && grep -q "^ADMIN_PASSWORD=.\+" "$env_file" 2>/dev/null; then
        echo "⚠️  ADMIN_PASSWORD is set in $env_file - clearing it to enable web UI setup..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=|" "$env_file"
        else
            sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=|" "$env_file"
        fi
    fi
done

echo ""
echo "🐳 Starting Docker services..."

# Check if infrastructure is already running
if docker ps --filter "name=^mongo$" --filter "status=running" -q | grep -q .; then
    echo "   ✅ Infrastructure already running (reusing existing)"
else
    echo "   Starting infrastructure (MongoDB, Redis, Qdrant)..."
    docker compose -f docker-compose.infra.yml up -d
    echo "   Waiting for infrastructure to be ready..."
    sleep 3
fi

echo "   Starting application services..."
# Clean up any orphaned containers from previous runs
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "⏳ Waiting for backend to be ready..."
MAX_WAIT=60
WAITED=0
BACKEND_PORT=$(grep "^BACKEND_PORT=" .env | cut -d'=' -f2 || echo "8000")

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo "   Waiting... (${WAITED}s/${MAX_WAIT}s)"
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "❌ Backend failed to start within ${MAX_WAIT} seconds"
    echo "   Check logs with: docker compose logs backend"
    exit 1
fi

echo ""
echo "✅ Chronicle is running!"
echo ""
echo "📱 Opening web UI setup screen..."
echo "   You'll be prompted to create your admin account"
echo ""

# Get webui port
WEBUI_PORT=$(grep "^WEBUI_PORT=" .env | cut -d'=' -f2 || echo "3000")

# Open browser to setup page
if command -v open > /dev/null; then
    # macOS
    open "http://localhost:${WEBUI_PORT}/setup"
elif command -v xdg-open > /dev/null; then
    # Linux
    xdg-open "http://localhost:${WEBUI_PORT}/setup"
elif command -v start > /dev/null; then
    # Windows
    start "http://localhost:${WEBUI_PORT}/setup"
else
    echo "   Please open your browser to: http://localhost:${WEBUI_PORT}/setup"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Quick Reference:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Web UI Setup:  http://localhost:${WEBUI_PORT}/setup"
echo "   Web Dashboard: http://localhost:${WEBUI_PORT}"
echo "   Backend API:   http://localhost:${BACKEND_PORT}"
echo ""
echo "   View logs:     docker compose logs -f"
echo "   Stop services: docker compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
