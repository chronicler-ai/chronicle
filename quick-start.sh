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
ENV_FILE="backends/advanced/.env"  # Overrides .env.default in backends/advanced
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

    # Prompt for environment name (for multi-worktree setups)
    echo ""
    echo -e "${BOLD}Environment Name${NC}"
    echo -e "${YELLOW}For multi-worktree setups, give each environment a unique name${NC}"
    echo -e "${YELLOW}Examples: chronicle, blue, gold, green, dev, staging${NC}"
    echo ""

    read -p "Environment name [chronicle]: " INPUT_ENV_NAME
    ENV_NAME="${INPUT_ENV_NAME:-chronicle}"

    # Convert to lowercase and replace spaces/special chars with hyphens
    ENV_NAME=$(echo "$ENV_NAME" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-' | sed 's/-$//')

    # Prompt for port offset (for multi-worktree environments)
    echo ""
    echo -e "${BOLD}Port Configuration${NC}"
    echo -e "${YELLOW}For multi-worktree setups, use different offsets for each environment${NC}"
    echo -e "${YELLOW}Suggested: blue=0, gold=10, green=20, red=30${NC}"
    echo ""
    read -p "Port offset [0]: " INPUT_PORT_OFFSET
    PORT_OFFSET="${INPUT_PORT_OFFSET:-0}"

    # Calculate application ports from offset (backend and frontend only)
    BACKEND_PORT=$((8000 + PORT_OFFSET))
    WEBUI_PORT=$((3000 + PORT_OFFSET))

    # Calculate Redis database number for isolation (shared Redis instance)
    REDIS_DATABASE=$((PORT_OFFSET / 10))

    # Calculate test environment ports (for parallel testing across worktrees)
    # Tests use shared infrastructure (MongoDB, Redis, Qdrant) but need unique app ports
    TEST_BACKEND_PORT=$((8001 + PORT_OFFSET))
    TEST_WEBUI_PORT=$((3001 + PORT_OFFSET))

    # Set database and project names based on environment name
    # Avoid chronicle-chronicle duplication
    if [[ "$ENV_NAME" == "chronicle" ]]; then
        MONGODB_DATABASE="chronicle"
        COMPOSE_PROJECT_NAME="chronicle"
    else
        MONGODB_DATABASE="chronicle_${ENV_NAME}"
        COMPOSE_PROJECT_NAME="chronicle-${ENV_NAME}"
    fi

    echo ""
    echo -e "${GREEN}✅ Environment configured${NC}"
    echo -e "  Name:     ${ENV_NAME}"
    echo -e "  Project:  ${COMPOSE_PROJECT_NAME}"
    echo -e "  Backend:  ${BACKEND_PORT}"
    echo -e "  WebUI:    ${WEBUI_PORT}"
    echo -e "  Database: ${MONGODB_DATABASE}"
    echo ""

    # Create minimal .env file with worktree-specific overrides
    cat > "$ENV_FILE" <<EOF
# Chronicle Environment Overrides
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT - Contains environment-specific configuration
#
# This file contains ONLY worktree-specific overrides.
# Base configuration is in .env.default (committed to git).

# ==========================================
# ENVIRONMENT & PROJECT NAMING
# ==========================================
ENV_NAME=${ENV_NAME}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}

# ==========================================
# AUTHENTICATION (Generated)
# ==========================================
AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
ADMIN_NAME=${ADMIN_NAME}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ==========================================
# DATABASE ISOLATION
# ==========================================
MONGODB_DATABASE=${MONGODB_DATABASE}
REDIS_DATABASE=${REDIS_DATABASE}

# ==========================================
# PORT CONFIGURATION
# ==========================================
PORT_OFFSET=${PORT_OFFSET}
BACKEND_PORT=${BACKEND_PORT}
WEBUI_PORT=${WEBUI_PORT}
TEST_BACKEND_PORT=${TEST_BACKEND_PORT}
TEST_WEBUI_PORT=${TEST_WEBUI_PORT}

# ==========================================
# CORS & FRONTEND CONFIGURATION
# ==========================================
# CORS origins with expanded port values for backend
CORS_ORIGINS=http://localhost:${WEBUI_PORT},http://127.0.0.1:${WEBUI_PORT},http://localhost:${BACKEND_PORT},http://127.0.0.1:${BACKEND_PORT}
# Frontend build-time configuration (must be expanded for Docker build args)
VITE_BACKEND_URL=http://localhost:${BACKEND_PORT}

# ==========================================
# API KEYS (Optional - Add your keys here)
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
    # Extract credentials and ports to display
    ADMIN_NAME=$(grep "^ADMIN_NAME=" "$ENV_FILE" | cut -d'=' -f2)
    ADMIN_EMAIL=$(grep "^ADMIN_EMAIL=" "$ENV_FILE" | cut -d'=' -f2)
    ADMIN_PASSWORD=$(grep "^ADMIN_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)
    BACKEND_PORT=$(grep "^BACKEND_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    WEBUI_PORT=$(grep "^WEBUI_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    # Set defaults if not found
    BACKEND_PORT=${BACKEND_PORT:-8000}
    WEBUI_PORT=${WEBUI_PORT:-3000}
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
    docker compose -f compose/infrastructure-shared.yml up -d
    echo -e "${GREEN}   ✅ Infrastructure started${NC}"
    sleep 3
fi
echo ""

# Start application
echo -e "${BLUE}🚀 Starting Chronicle application...${NC}"
echo ""
cd backends/advanced && docker compose up -d --build  # Build and start with .env overrides

echo ""
echo "   Waiting for backend to be healthy..."
sleep 3

# Wait for backend health check (with timeout)
TIMEOUT=60
ELAPSED=0
BACKEND_HEALTHY=false

while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

echo ""
if [[ "$BACKEND_HEALTHY" == true ]]; then
    echo -e "${GREEN}${BOLD}✅ Chronicle is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is starting... (may take a moment)${NC}"
fi

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                    ║${NC}"
echo -e "${BOLD}║  ${GREEN}🚀 Open Chronicle WebUI:${NC}${BOLD}                        ║${NC}"
echo -e "${BOLD}║                                                    ║${NC}"
echo -e "${BOLD}║     ${GREEN}${BOLD}http://localhost:${WEBUI_PORT}${NC}${BOLD}                          ║${NC}"
echo -e "${BOLD}║                                                    ║${NC}"
echo -e "${BOLD}║  ${YELLOW}(Click the link above or copy to browser)${NC}${BOLD}     ║${NC}"
echo -e "${BOLD}║                                                    ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for missing API keys
echo -e "${YELLOW}⚠️  Some features are disabled (no API keys configured):${NC}"
echo -e "   • Memory extraction (needs OpenAI API key)"
echo -e "   • Transcription (needs Deepgram API key)"
echo ""
echo -e "   ${BOLD}→ Add API keys at: http://localhost:${WEBUI_PORT}/system${NC}"
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
            echo "CORS_ORIGINS=https://${TAILSCALE_HOSTNAME}:9000,https://${TAILSCALE_HOSTNAME}:4000,http://localhost:${WEBUI_PORT}" >> "$ENV_FILE"

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
