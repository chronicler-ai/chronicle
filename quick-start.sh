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
ENV_FILE=".env.default"
CONFIG_FILE="config-defaults.yml"

# Parse arguments
RESET_CONFIG=false
if [[ "$1" == "--reset" ]]; then
    RESET_CONFIG=true
fi

# Print header
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}🚀 Chronicle Quick Start${NC}"
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

    # Generate secure secret
    if command -v openssl &> /dev/null; then
        AUTH_SECRET_KEY=$(openssl rand -hex 32)
    else
        # Fallback for systems without openssl
        AUTH_SECRET_KEY=$(head -c 32 /dev/urandom | xxd -p -c 64)
    fi

    # Prompt for admin credentials
    echo ""
    echo -e "${BOLD}Admin Account Setup${NC}"
    echo -e "${YELLOW}Press Enter to use defaults shown in [brackets]${NC}"
    echo ""

    read -p "Admin Name [admin]: " INPUT_ADMIN_NAME
    ADMIN_NAME="${INPUT_ADMIN_NAME:-admin}"

    read -p "Admin Email [admin@example.com]: " INPUT_ADMIN_EMAIL
    ADMIN_EMAIL="${INPUT_ADMIN_EMAIL:-admin@example.com}"

    read -sp "Admin Password [password-123]: " INPUT_ADMIN_PASSWORD
    echo ""
    ADMIN_PASSWORD="${INPUT_ADMIN_PASSWORD:-password-123}"

    # Create .env.quick-start
    cat > "$ENV_FILE" <<EOF
# Chronicle Quick Start Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT THIS FILE - Contains sensitive credentials

# ==========================================
# AUTHENTICATION & SECURITY
# ==========================================
AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
ADMIN_NAME=${ADMIN_NAME}
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
# Port offset for running multiple instances (default: 0)
# - Backend: 8000 + PORT_OFFSET = 8000
# - WebUI: 3000 + PORT_OFFSET = 3000
# - Redis DB: PORT_OFFSET / 1000 = 0
PORT_OFFSET=0
BACKEND_PORT=8000
WEBUI_PORT=3000
HOST_IP=localhost
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
VITE_BACKEND_URL=http://localhost:8000

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

    # Display credentials confirmation
    echo ""
    echo -e "${GREEN}✅ Admin account configured${NC}"
    echo ""
    echo -e "${BOLD}Login Credentials:${NC}"
    echo -e "  Name:     ${ADMIN_NAME}"
    echo -e "  Email:    ${ADMIN_EMAIL}"
    echo -e "  Password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo ""
    sleep 2
else
    echo -e "${GREEN}✅ Using existing configuration${NC}"
    # Extract credentials to display
    ADMIN_NAME=$(grep "^ADMIN_NAME=" "$ENV_FILE" | cut -d'=' -f2)
    ADMIN_EMAIL=$(grep "^ADMIN_EMAIL=" "$ENV_FILE" | cut -d'=' -f2)
    ADMIN_PASSWORD=$(grep "^ADMIN_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)
    echo ""
    echo -e "${BOLD}Login Credentials:${NC}"
    echo -e "  Name:     ${ADMIN_NAME:-admin}"
    echo -e "  Email:    ${ADMIN_EMAIL}"
    echo -e "  Password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo ""
fi

# Start infrastructure
echo -e "${BLUE}🏗️  Starting infrastructure...${NC}"
if docker ps --filter "name=^mongo$" --filter "status=running" -q | grep -q .; then
    echo -e "${GREEN}   ✅ Infrastructure already running${NC}"
else
    docker compose -f docker-compose.infra.yml up -d
    echo -e "${GREEN}   ✅ Infrastructure started${NC}"
    sleep 3
fi
echo ""

# Start application
echo -e "${BLUE}🚀 Starting Chronicle application...${NC}"
echo ""
docker compose --env-file .env.default up -d

echo ""
echo "   Waiting for backend to be healthy..."
sleep 3

# Wait for backend health check (with timeout)
TIMEOUT=60
ELAPSED=0
BACKEND_HEALTHY=false

while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

cd ../..

echo ""
if [[ "$BACKEND_HEALTHY" == true ]]; then
    echo -e "${GREEN}${BOLD}✅ Chronicle is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is starting... (may take a moment)${NC}"
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}   Access Chronicle at: http://localhost:3000${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for missing API keys
echo -e "${YELLOW}⚠️  Some features are disabled (no API keys configured):${NC}"
echo -e "   • Memory extraction (needs OpenAI API key)"
echo -e "   • Transcription (needs Deepgram API key)"
echo ""
echo -e "   ${BOLD}→ Add API keys at: http://localhost:3000/system${NC}"
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
            echo "CORS_ORIGINS=https://${TAILSCALE_HOSTNAME}:9000,https://${TAILSCALE_HOSTNAME}:4000,http://localhost:3000" >> "$ENV_FILE"

            echo ""
            echo -e "${GREEN}✅ HTTPS configured!${NC}"
            echo ""
            echo -e "   Access from any device on your tailnet:"
            echo -e "   ${BOLD}https://${TAILSCALE_HOSTNAME}:4000${NC}"
            echo ""
            echo -e "${YELLOW}   Note: Restart services to apply HTTPS settings:${NC}"
            echo -e "   ${BOLD}make restart${NC}"
            echo ""
        fi
    fi
fi

# Usage information
echo -e "${BOLD}Helpful commands:${NC}"
echo "  Stop:    make down"
echo "  Restart: make restart"
echo "  Logs:    make logs"
echo "  Rebuild: make build"
echo ""

echo -e "${GREEN}${BOLD}🎉 Setup complete! Happy coding!${NC}"
echo ""
