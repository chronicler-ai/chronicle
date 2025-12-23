#!/bin/bash

# Advanced Backend Integration Test Runner
# Mirrors the GitHub CI integration-tests.yml workflow for local development
# Requires: .env file with DEEPGRAM_API_KEY and OPENAI_API_KEY

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ] || [ ! -d "src" ]; then
    print_error "Please run this script from the backends/advanced directory"
    exit 1
fi

print_info "Advanced Backend Integration Test Runner"
print_info "========================================"

# Load environment variables (CI or local)
# Priority: CI environment > .env.test > .env
if [ -n "$DEEPGRAM_API_KEY" ]; then
    print_info "Using environment variables from CI/environment..."
elif [ -f ".env.test" ]; then
    print_info "Loading environment variables from .env.test..."
    set -a
    source .env.test
    set +a
elif [ -f ".env" ]; then
    print_info "Loading environment variables from .env..."
    set -a
    source .env
    set +a
else
    print_error "Neither .env.test nor .env file found, and no environment variables set!"
    print_info "For local development: cp .env.template .env and configure required API keys"
    print_info "For CI: ensure required API keys are set based on configured providers"
    exit 1
fi

# Verify required environment variables based on configured providers
TRANSCRIPTION_PROVIDER=${TRANSCRIPTION_PROVIDER:-deepgram}
LLM_PROVIDER=${LLM_PROVIDER:-openai}

print_info "Configured providers:"
print_info "  TRANSCRIPTION_PROVIDER: $TRANSCRIPTION_PROVIDER"
print_info "  LLM_PROVIDER: $LLM_PROVIDER"

# Check transcription provider API key
case "$TRANSCRIPTION_PROVIDER" in
    deepgram)
        if [ -z "$DEEPGRAM_API_KEY" ]; then
            print_error "DEEPGRAM_API_KEY not set (required for TRANSCRIPTION_PROVIDER=deepgram)"
            exit 1
        fi
        print_info "DEEPGRAM_API_KEY length: ${#DEEPGRAM_API_KEY}"
        ;;
    mistral)
        if [ -z "$MISTRAL_API_KEY" ]; then
            print_error "MISTRAL_API_KEY not set (required for TRANSCRIPTION_PROVIDER=mistral)"
            exit 1
        fi
        print_info "MISTRAL_API_KEY length: ${#MISTRAL_API_KEY}"
        ;;
    offline|parakeet)
        print_info "Using offline/local transcription - no API key required"
        ;;
    *)
        print_warning "Unknown TRANSCRIPTION_PROVIDER: $TRANSCRIPTION_PROVIDER"
        ;;
esac

# Check LLM provider API key (for memory extraction)
case "$LLM_PROVIDER" in
    openai)
        if [ -z "$OPENAI_API_KEY" ]; then
            print_error "OPENAI_API_KEY not set (required for LLM_PROVIDER=openai)"
            exit 1
        fi
        print_info "OPENAI_API_KEY length: ${#OPENAI_API_KEY}"
        ;;
    ollama)
        print_info "Using Ollama for LLM - no API key required"
        ;;
    *)
        print_warning "Unknown LLM_PROVIDER: $LLM_PROVIDER"
        ;;
esac

# Ensure memory_config.yaml exists
if [ ! -f "memory_config.yaml" ] && [ -f "memory_config.yaml.template" ]; then
    print_info "Creating memory_config.yaml from template..."
    cp memory_config.yaml.template memory_config.yaml
    print_success "memory_config.yaml created"
fi

# Ensure diarization_config.json exists
if [ ! -f "diarization_config.json" ] && [ -f "diarization_config.json.template" ]; then
    print_info "Creating diarization_config.json from template..."
    cp diarization_config.json.template diarization_config.json
    print_success "diarization_config.json created"
fi

# Install dependencies with uv
print_info "Installing dependencies with uv..."
uv sync --dev --group test

# Set up environment variables for testing
print_info "Setting up test environment variables..."

print_info "Using environment variables from .env file for test configuration"

# Clean test environment
print_info "Cleaning test environment..."
sudo rm -rf ./test_audio_chunks/ ./test_data/ ./test_debug_dir/ ./mongo_data_test/ ./qdrant_data_test/ ./test_neo4j/ || true

# Stop any existing test containers
print_info "Stopping existing test containers..."
docker compose -f docker-compose-test.yml down -v || true

# Run integration tests
print_info "Running integration tests..."
print_info "Using fresh mode (CACHED_MODE=False) for clean testing"
print_info "Disabling BuildKit for integration tests (DOCKER_BUILDKIT=0)"

# Check OpenMemory MCP connectivity if using openmemory_mcp provider
if [ "$MEMORY_PROVIDER" = "openmemory_mcp" ]; then
    print_info "Checking OpenMemory MCP connectivity..."
    if curl -s --max-time 5 http://localhost:8765/docs > /dev/null 2>&1; then
        print_success "OpenMemory MCP server is accessible at http://localhost:8765"
    else
        print_warning "OpenMemory MCP server not accessible at http://localhost:8765"
        print_info "Make sure to start OpenMemory MCP: cd extras/openmemory-mcp && docker compose up -d"
    fi
fi

# Set environment variables for the test
export DOCKER_BUILDKIT=0

# Run the integration test with extended timeout (mem0 needs time for comprehensive extraction)
print_info "Starting integration test (timeout: 15 minutes)..."
if timeout 900 uv run pytest tests/test_integration.py::test_full_pipeline_integration -v -s --tb=short --log-cli-level=INFO; then
    print_success "Integration tests completed successfully!"
else
    TEST_EXIT_CODE=$?
    print_error "Integration tests FAILED with exit code: $TEST_EXIT_CODE"

    # Clean up test containers before exiting
    print_info "Cleaning up test containers after failure..."
    docker compose -f docker-compose-test.yml down -v || true
    docker system prune -f || true

    exit $TEST_EXIT_CODE
fi

# Clean up test containers
print_info "Cleaning up test containers..."
docker compose -f docker-compose-test.yml down -v || true
docker system prune -f || true

print_success "Advanced Backend integration tests completed!"