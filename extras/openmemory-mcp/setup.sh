#!/bin/bash

# Enable strict error handling
set -euo pipefail

# Parse command line arguments
OPENAI_API_KEY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --openai-api-key)
            OPENAI_API_KEY="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

echo "🧠 OpenMemory MCP Setup (Pre-built Images)"
echo "=========================================="
echo ""
echo "This setup uses pre-built Docker images from ghcr.io/ushadow-io"
echo "No need to clone or build from source!"
echo ""

# Configure the .env file
ENV_FILE=".env"

# Check if already configured
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  $ENV_FILE already exists. Backing up..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Create .env from template or start fresh
if [ -f ".env.template" ]; then
    cp ".env.template" "$ENV_FILE"
else
    # Create minimal .env if template doesn't exist
    cat > "$ENV_FILE" << 'EOF'
# OpenMemory MCP Configuration

# Required: OpenAI API Key for memory processing
OPENAI_API_KEY=

# User identifier
USER=openmemory
OPENMEMORY_USER_ID=openmemory

# Optional: API Key for MCP server authentication
API_KEY=

# Frontend configuration
NEXT_PUBLIC_API_URL=http://localhost:8765
NEXT_PUBLIC_USER_ID=openmemory
EOF
fi

# Set restrictive permissions (owner read/write only)
chmod 600 "$ENV_FILE"

# Get OpenAI API Key (prompt only if not provided via command line)
if [ -z "$OPENAI_API_KEY" ]; then
    echo ""
    echo "🔑 OpenAI API Key (required for memory extraction)"
    echo "Get yours from: https://platform.openai.com/api-keys"
    while true; do
        read -s -r -p "OpenAI API Key: " OPENAI_API_KEY
        echo  # Print newline after silent input
        if [ -n "$OPENAI_API_KEY" ]; then
            break
        fi
        echo "Error: OpenAI API Key cannot be empty. Please try again."
    done
else
    echo "✅ OpenAI API key configured from command line"
fi

# Update .env file safely using awk - replace existing line or append if missing
temp_file=$(mktemp)
awk -v key="$OPENAI_API_KEY" '
    /^OPENAI_API_KEY=/ { print "OPENAI_API_KEY=" key; found=1; next }
    { print }
    END { if (!found) print "OPENAI_API_KEY=" key }
' "$ENV_FILE" > "$temp_file"
mv "$temp_file" "$ENV_FILE"

# Ensure USER is set to openmemory
awk '
    /^USER=/ { print "USER=openmemory"; found=1; next }
    { print }
    END { if (!found) print "USER=openmemory" }
' "$ENV_FILE" > "$temp_file"
mv "$temp_file" "$ENV_FILE"

echo ""
echo "✅ OpenMemory MCP configured!"
echo "📁 Configuration saved to: $ENV_FILE"
echo ""
echo "🚀 To start services:"
echo "   docker compose up -d"
echo ""
echo "   (Note: First run will pull pre-built images)"
echo ""
echo "📡 Services:"
echo "   🌐 MCP Server: http://localhost:8765"
echo "   📱 Web UI: http://localhost:3333"
echo "   🗄️  Neo4j Browser: http://localhost:7474"
echo "   🔍 Qdrant: http://localhost:6335"
echo ""
echo "🔐 Neo4j credentials: neo4j/taketheredpillNe0"
echo ""
echo "⚙️  Configure Chronicle backend (.env):"
echo "   MEMORY_PROVIDER=openmemory_mcp"
echo "   OPENMEMORY_MCP_URL=http://openmemory-mcp:8765  (for Docker - recommended)"
echo "   # or http://localhost:8765 (if backend runs outside Docker)"
echo ""
echo "💡 Using pre-built images from ghcr.io/ushadow-io:"
echo "   - u-mem0-api:latest"
echo "   - u-mem0-ui:latest"
echo ""
