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

# Check if already configured
if [ -f ".env" ]; then
    echo "⚠️  .env already exists. Backing up..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Start from template - check existence first
if [ ! -r ".env.template" ]; then
    echo "Error: .env.template not found or not readable" >&2
    exit 1
fi

# Copy template and set secure permissions
if ! cp .env.template .env; then
    echo "Error: Failed to copy .env.template to .env" >&2
    exit 1
fi

# Set restrictive permissions (owner read/write only)
chmod 600 .env

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
' .env > "$temp_file"
mv "$temp_file" .env

echo ""
echo "✅ OpenMemory MCP configured!"
echo "📁 Configuration saved to .env"
echo ""
echo "🚀 To start: docker compose up -d"
echo "🌐 MCP Server: http://localhost:8765"
echo "📱 Web UI: http://localhost:3001"