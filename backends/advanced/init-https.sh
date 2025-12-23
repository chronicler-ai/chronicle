#!/bin/bash
set -e

# Initialize Chronicle Advanced Backend with HTTPS proxy
# Usage: ./init.sh <tailscale-ip>

if [ $# -ne 1 ]; then
    echo "Usage: $0 <tailscale-ip>"
    echo "Example: $0 100.83.66.30"
    echo ""
    echo "This script will:"
    echo "  1. Generate SSL certificates for localhost and your Tailscale IP"
    echo "  2. Create nginx.conf from template"
    echo "  3. Set up HTTPS proxy for the backend"
    exit 1
fi

TAILSCALE_IP="$1"

# Validate IP format (basic check)
if ! echo "$TAILSCALE_IP" | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' > /dev/null; then
    echo "Error: Invalid IP format. Expected format: xxx.xxx.xxx.xxx"
    exit 1
fi

echo "🚀 Initializing Chronicle Advanced Backend with Tailscale IP: $TAILSCALE_IP"
echo ""

# Check if nginx.conf.template exists
if [ ! -f "nginx.conf.template" ]; then
    echo "❌ Error: nginx.conf.template not found"
    echo "   Make sure you're running this from the backends/advanced directory"
    exit 1
fi

# Generate SSL certificates
echo "📄 Step 1: Generating SSL certificates..."
if [ -f "ssl/generate-ssl.sh" ]; then
    ./ssl/generate-ssl.sh "$TAILSCALE_IP"
    echo "✅ SSL certificates generated"
else
    echo "❌ Error: ssl/generate-ssl.sh not found"
    exit 1
fi

echo ""

# Create nginx.conf from template
echo "📄 Step 2: Creating nginx configuration..."
sed "s/TAILSCALE_IP/$TAILSCALE_IP/g" nginx.conf.template > nginx.conf
echo "✅ nginx.conf created with IP: $TAILSCALE_IP"

echo ""

# Update .env file with HTTPS CORS origins
echo "📄 Step 3: Updating CORS origins..."
if [ -f ".env" ]; then
    # Update existing .env file
    if grep -q "CORS_ORIGINS" .env; then
        # Update existing CORS_ORIGINS line
        sed -i "s/CORS_ORIGINS=.*/CORS_ORIGINS=https:\/\/localhost,https:\/\/localhost:443,https:\/\/127.0.0.1,https:\/\/$TAILSCALE_IP/" .env
    else
        # Add CORS_ORIGINS line
        echo "CORS_ORIGINS=https://localhost,https://localhost:443,https://127.0.0.1,https://$TAILSCALE_IP" >> .env
    fi
    echo "✅ Updated CORS origins in .env file"
else
    echo "⚠️  No .env file found. You may need to:"
    echo "   1. Copy .env.template to .env"
    echo "   2. Add: CORS_ORIGINS=https://localhost,https://localhost:443,https://127.0.0.1,https://$TAILSCALE_IP"
fi

echo ""
echo "📄 Step 4: Memory configuration now lives in config.yml (memory section)"

echo ""
echo "🎉 Initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Start the services:"
echo "     docker compose up --build -d"
echo ""
echo "  2. Access the dashboard:"
echo "     🌐 https://localhost/ (accept SSL certificate)"
echo "     🌐 https://$TAILSCALE_IP/"
echo ""
echo "  3. Test live recording:"
echo "     📱 Navigate to Live Record page"
echo "     🎤 Microphone access will work over HTTPS"
echo ""
echo "🔧 Services included:"
echo "   - Chronicle Backend: Internal (proxied through nginx)"
echo "   - Web Dashboard: https://localhost/ or https://$TAILSCALE_IP/"
echo "   - WebSocket Audio: wss://localhost/ws_pcm or wss://$TAILSCALE_IP/ws_pcm"
echo ""
echo "📚 For more details, see: Docs/HTTPS_SETUP.md"
