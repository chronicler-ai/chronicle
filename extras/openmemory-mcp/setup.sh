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

echo "🧠 OpenMemory MCP Setup"
echo "======================"

# Clone the mem0 fork if not already present
MEM0_DIR="mem0-fork"
if [ ! -d "$MEM0_DIR" ]; then
    echo "📥 Cloning Ushadow-io/mem0 fork..."
    if ! git clone https://github.com/Ushadow-io/mem0.git "$MEM0_DIR"; then
        echo "❌ Failed to clone mem0 fork" >&2
        exit 1
    fi
    echo "✅ Fork cloned successfully"
else
    echo "✅ Fork already exists at $MEM0_DIR"
    # Optionally pull latest changes
    read -p "Update fork to latest version? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📥 Pulling latest changes..."
        (cd "$MEM0_DIR" && git pull) || echo "⚠️  Failed to update fork"
    fi
fi

# Configure the api/.env file inside the fork
ENV_FILE="$MEM0_DIR/openmemory/api/.env"

# Check if already configured
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  $ENV_FILE already exists. Backing up..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Check if .env.example exists to use as template
if [ -f "$MEM0_DIR/openmemory/api/.env.example" ]; then
    cp "$MEM0_DIR/openmemory/api/.env.example" "$ENV_FILE"
else
    # Create minimal .env if example doesn't exist
    cat > "$ENV_FILE" << 'EOF'
OPENAI_API_KEY=sk-xxx
USER=openmemory
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
echo "📦 Fork cloned to: $MEM0_DIR"
echo ""
echo "🚀 To start services:"
echo "   cd $MEM0_DIR/openmemory"
echo "   docker compose up --build -d"
echo ""
echo "   (Note: First build may take a few minutes)"
echo ""
echo "📡 Services:"
echo "   🌐 MCP Server: http://localhost:8765"
echo "   📱 Web UI: http://localhost:3333"
echo "   🗄️  Neo4j Browser: http://localhost:7474"
echo "   🔍 Qdrant: http://localhost:6333"
echo ""
echo "🔐 Neo4j credentials: neo4j/taketheredpillNe0"
echo ""
echo "⚙️  Configure Chronicle backend (.env):"
echo "   MEMORY_PROVIDER=openmemory_mcp"
echo "   OPENMEMORY_MCP_URL=http://openmemory-mcp:8765  (for Docker)"
echo "   # or http://localhost:8765 (for local development)"
