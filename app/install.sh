#!/bin/bash

# Friend-Lite iOS App Installer
# Simple script to build and run the iOS app on simulators or physical devices
# Usage: ./install.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================${NC}"
}

# Check if we're in the app directory
if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
    print_error "Please run this script from the app directory (./app/)"
    exit 1
fi

print_header "Friend-Lite iOS App Installer"

# Check for required tools
print_info "Checking dependencies..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command -v xcrun &> /dev/null; then
    print_error "Xcode command line tools not found. Please install Xcode."
    exit 1
fi

print_success "All required tools are installed"

# Install npm dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_info "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_info "Dependencies already installed (skipping npm install)"
    echo -e "         ${YELLOW}Tip:${NC} Run 'npm install' manually if you need to update dependencies"
fi

# Check if iOS build exists
if [ ! -d "ios" ]; then
    print_warning "iOS native project not found. Will be generated on first build."
fi

# Get available iOS simulators
print_info "Fetching available iOS devices..."
DEVICES=$(xcrun simctl list devices available | grep -E "iPhone|iPad" | grep -v "unavailable" || true)

if [ -z "$DEVICES" ]; then
    print_warning "No iOS simulators found. Will build for connected device or default simulator."
    DEVICE_OPTION=""
else
    print_info "Available iOS Simulators:"
    echo "$DEVICES" | nl -w2 -s') '
    echo ""
    echo "Options:"
    echo "  1) Build for specific simulator (enter number above)"
    echo "  2) Build for connected physical device"
    echo "  3) Build for default simulator"
    echo ""
    read -p "Select option (1-3) or press Enter for default simulator: " DEVICE_CHOICE

    if [ "$DEVICE_CHOICE" = "1" ]; then
        read -p "Enter simulator number: " SIM_NUM
        DEVICE_NAME=$(echo "$DEVICES" | sed -n "${SIM_NUM}p" | sed -E 's/.*\(([-A-Z0-9]+)\).*/\1/' | xargs)
        if [ -n "$DEVICE_NAME" ]; then
            DEVICE_OPTION="--device $DEVICE_NAME"
            print_success "Selected device: $DEVICE_NAME"
        else
            print_warning "Invalid selection, using default simulator"
            DEVICE_OPTION=""
        fi
    elif [ "$DEVICE_CHOICE" = "2" ]; then
        DEVICE_OPTION="--device"
        print_success "Will build for connected physical device"
    else
        DEVICE_OPTION=""
        print_success "Will use default simulator"
    fi
fi

# Ask about tunnel mode
echo ""
print_info "Connection Mode:"
echo "  Tunnel mode allows connection from physical devices outside your local network"
echo "  Local mode is faster for development on simulators"
echo ""
read -p "Use tunnel mode? (y/N): " USE_TUNNEL

TUNNEL_FLAG=""
if [[ "$USE_TUNNEL" =~ ^[Yy]$ ]]; then
    TUNNEL_FLAG="--tunnel"
    print_success "Tunnel mode enabled"
else
    print_success "Using local network mode"
fi

# Build and run
print_header "Building and Running iOS App"

COMMAND="npx expo run:ios $DEVICE_OPTION $TUNNEL_FLAG"
print_info "Executing: $COMMAND"
echo ""

# Run the command
eval $COMMAND

print_success "iOS app build and launch completed!"
print_info "The app should now be running on your selected device"
