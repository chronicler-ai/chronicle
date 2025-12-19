#!/bin/bash

# Friend-Lite Quick Start
# Zero-configuration startup for local development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.quick-start"
CONFIG_FILE="config-defaults.yml"

# Parse arguments
RESET_CONFIG=false
if [[ "$1" == "--reset" ]]; then
    RESET_CONFIG=true
fi

# Print header
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}🚀 Friend-Lite Quick Start${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if config exists
if [[ -f "$ENV_FILE" ]] && [[ "$RESET_CONFIG" == false ]]; then
    echo -e "${GREEN}✅ Existing configuration found${NC}"
    echo ""
    read -p "Use existing configuration? (Y/n): " use_existing
    if [[ "$use_existing" == "n" ]] || [[ "$use_existing" == "N" ]]; then
        RESET_CONFIG=true
    fi
fi

# Generate or load configuration
if [[ ! -f "$ENV_FILE" ]] || [[ "$RESET_CONFIG" == true ]]; then
    echo -e "${BLUE}🔧 Generating configuration...${NC}"
    echo ""

    # Generate secure secrets
    if command -v openssl &> /dev/null; then
        AUTH_SECRET_KEY=$(openssl rand -hex 32)
        ADMIN_PASSWORD=$(openssl rand -hex 16)
    else
        # Fallback for systems without openssl
        AUTH_SECRET_KEY=$(head -c 32 /dev/urandom | xxd -p -c 64)
        ADMIN_PASSWORD=$(head -c 16 /dev/urandom | xxd -p -c 32)
    fi

    ADMIN_EMAIL="admin@example.com"

    # Create .env.quick-start
    cat > "$ENV_FILE" <<EOF
# Friend-Lite Quick Start Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT THIS FILE - Contains sensitive credentials

# ==========================================
# AUTHENTICATION & SECURITY
# ==========================================
AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ==========================================
# GRACEFUL DEGRADATION SETTINGS
# ==========================================
# Allow backend to start without API keys
ALLOW_MISSING_API_KEYS=true
LLM_REQUIRED=false
TRANSCRIPTION_REQUIRED=false

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
MONGODB_URI=mongodb://mongo:27017
MONGODB_DATABASE=chronicle-quickstart
REDIS_URL=redis://redis:6379/0
REDIS_DATABASE=0
QDRANT_BASE_URL=qdrant
QDRANT_PORT=6333

# ==========================================
# NETWORK CONFIGURATION
# ==========================================
BACKEND_PORT=9000
WEBUI_PORT=4000
HOST_IP=localhost
CORS_ORIGINS=http://localhost:3000,http://localhost:4000,http://127.0.0.1:4000
VITE_BACKEND_URL=http://localhost:9000

# ==========================================
# SERVICE CONFIGURATION
# ==========================================
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
MEMORY_PROVIDER=friend_lite
TRANSCRIPTION_PROVIDER=deepgram

# ==========================================
# API KEYS (Add via UI after startup)
# ==========================================
# OPENAI_API_KEY=
# DEEPGRAM_API_KEY=
# MISTRAL_API_KEY=
EOF

    chmod 600 "$ENV_FILE"

    # Display credentials prominently
    echo ""
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${RED}⚠️  SAVE THESE CREDENTIALS NOW! ⚠️${NC}"
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Admin Email:${NC}    ${ADMIN_EMAIL}"
    echo -e "${BOLD}Admin Password:${NC} ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo ""
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    sleep 2
else
    echo -e "${GREEN}✅ Using existing configuration${NC}"
    # Extract password to display
    ADMIN_PASSWORD=$(grep "^ADMIN_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)
    ADMIN_EMAIL=$(grep "^ADMIN_EMAIL=" "$ENV_FILE" | cut -d'=' -f2)
    echo ""
    echo -e "${BOLD}Admin Email:${NC}    ${ADMIN_EMAIL}"
    echo -e "${BOLD}Admin Password:${NC} ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo ""
fi

# Create chronicle-network if it doesn't exist
echo -e "${BLUE}🔗 Checking Docker network...${NC}"
if ! docker network inspect chronicle-network &> /dev/null; then
    echo "   Creating chronicle-network..."
    docker network create chronicle-network
    echo -e "${GREEN}   ✅ Network created${NC}"
else
    echo -e "${GREEN}   ✅ Network exists${NC}"
fi
echo ""

# Start shared infrastructure
echo -e "${BLUE}🏗️  Starting shared infrastructure...${NC}"
echo ""

# Check if infrastructure is already running
MONGO_RUNNING=$(docker ps --filter "name=^mongo$" --filter "status=running" --format "{{.Names}}" 2>/dev/null || true)
REDIS_RUNNING=$(docker ps --filter "name=^redis$" --filter "status=running" --format "{{.Names}}" 2>/dev/null || true)
QDRANT_RUNNING=$(docker ps --filter "name=^qdrant$" --filter "status=running" --format "{{.Names}}" 2>/dev/null || true)

if [[ -n "$MONGO_RUNNING" ]] && [[ -n "$REDIS_RUNNING" ]] && [[ -n "$QDRANT_RUNNING" ]]; then
    echo -e "${GREEN}   ✅ Infrastructure already running${NC}"
else
    echo "   Starting MongoDB, Redis, Qdrant, Caddy..."
    docker compose -f compose/infrastructure-shared.yml up -d --no-recreate 2>&1 | grep -v "is up to date" || true
    echo ""
    echo "   Waiting for services to be ready..."
    sleep 5
    echo -e "${GREEN}   ✅ Infrastructure started${NC}"
fi

echo ""
echo -e "   ${BOLD}Services:${NC}"
echo -e "   📊 MongoDB:  ${GREEN}Running${NC} (mongodb://localhost:27017)"
echo -e "   💾 Redis:    ${GREEN}Running${NC} (redis://localhost:6379)"
echo -e "   🔍 Qdrant:   ${GREEN}Running${NC} (http://localhost:6034)"
echo ""

# Start application services
echo -e "${BLUE}🚀 Starting Friend-Lite application...${NC}"
echo ""

cd backends/advanced

# Start backend, workers, and webui
docker compose \
  -p chronicle-quickstart \
  --env-file ../../.env.quick-start \
  up -d friend-backend workers webui

echo ""
echo "   Waiting for backend to be healthy..."
sleep 3

# Wait for backend health check (with timeout)
TIMEOUT=60
ELAPSED=0
BACKEND_HEALTHY=false

while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if curl -s http://localhost:9000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

cd ../..

echo ""
if [[ "$BACKEND_HEALTHY" == true ]]; then
    echo -e "${GREEN}${BOLD}✅ Friend-Lite is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is starting... (may take a moment)${NC}"
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}   Access Friend-Lite at: http://localhost:4000${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for missing API keys
echo -e "${YELLOW}⚠️  Some features are disabled (no API keys configured):${NC}"
echo -e "   • Memory extraction (needs OpenAI API key)"
echo -e "   • Transcription (needs Deepgram API key)"
echo ""
echo -e "   ${BOLD}→ Add API keys at: http://localhost:4000/system${NC}"
echo ""

# Next steps
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Login with the credentials shown above"
echo "  2. Configure API keys in System settings"
echo "  3. Enable optional services if needed"
echo ""

# Check for Tailscale
if command -v tailscale &> /dev/null && tailscale status &> /dev/null; then
    TAILSCALE_HOSTNAME=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "")

    if [[ -n "$TAILSCALE_HOSTNAME" ]]; then
        echo -e "${BLUE}🌐 Tailscale detected: ${TAILSCALE_HOSTNAME}${NC}"
        echo ""
        read -p "Configure HTTPS access via Tailscale? (y/N): " setup_tailscale

        if [[ "$setup_tailscale" == "y" ]] || [[ "$setup_tailscale" == "Y" ]]; then
            echo ""
            echo -e "${BLUE}🔒 Provisioning Tailscale certificates...${NC}"

            # Provision certificates
            tailscale cert "$TAILSCALE_HOSTNAME" 2>/dev/null || true

            # Update .env.quick-start with HTTPS settings
            echo "" >> "$ENV_FILE"
            echo "# Tailscale HTTPS Configuration" >> "$ENV_FILE"
            echo "TAILSCALE_HOSTNAME=${TAILSCALE_HOSTNAME}" >> "$ENV_FILE"
            echo "HTTPS_ENABLED=true" >> "$ENV_FILE"
            echo "CORS_ORIGINS=https://${TAILSCALE_HOSTNAME}:9000,https://${TAILSCALE_HOSTNAME}:4000,http://localhost:4000" >> "$ENV_FILE"

            echo ""
            echo -e "${GREEN}✅ HTTPS configured!${NC}"
            echo ""
            echo -e "   Access from any device on your tailnet:"
            echo -e "   ${BOLD}https://${TAILSCALE_HOSTNAME}:4000${NC}"
            echo ""
            echo -e "${YELLOW}   Note: Restart services to apply HTTPS settings:${NC}"
            echo -e "   ${BOLD}docker compose -p chronicle-quickstart restart${NC}"
            echo ""
        fi
    fi
fi

# Usage information
echo -e "${BOLD}Helpful commands:${NC}"
echo "  Stop:    make quick-start-stop"
echo "  Restart: docker compose -p chronicle-quickstart restart"
echo "  Logs:    docker compose -p chronicle-quickstart logs -f"
echo ""

echo -e "${GREEN}${BOLD}🎉 Setup complete! Happy coding!${NC}"
echo ""
