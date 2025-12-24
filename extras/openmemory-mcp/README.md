# OpenMemory MCP Service

This directory contains a local deployment of the OpenMemory MCP (Model Context Protocol) server, which can be used as an alternative memory provider for Chronicle.

**Note:** This deployment builds from the [Ushadow-io/mem0](https://github.com/Ushadow-io/mem0) fork instead of the official mem0.ai release, providing custom features and enhancements.

## What is OpenMemory MCP?

OpenMemory MCP is a memory service from mem0.ai that provides:
- Automatic memory extraction from conversations
- Vector-based memory storage with Qdrant
- Semantic search across memories
- MCP protocol support for AI integrations
- Built-in deduplication and memory management

## Quick Start

### 1. Run Setup Script

The setup script will:
- Clone the Ushadow-io/mem0 fork
- Configure your environment with API keys
- Prepare the service for deployment

```bash
./setup.sh
```

Or provide API key directly:
```bash
./setup.sh --openai-api-key your-api-key-here
```

### 2. Start Services

The docker-compose.yml is located in the fork directory. You can start services using:

**Option A: Using Chronicle's unified service manager (Recommended)**
```bash
# From project root
uv run --with-requirements setup-requirements.txt python services.py start openmemory-mcp --build
```

**Option B: Manually from the fork directory**
```bash
# From extras/openmemory-mcp
cd mem0-fork/openmemory
docker compose up --build -d
```

**Note:** The first build may take several minutes as Docker builds the services from source.

### 3. Configure Chronicle

In your Chronicle backend `.env` file:

```bash
# Use OpenMemory MCP instead of built-in memory processing
MEMORY_PROVIDER=openmemory_mcp
OPENMEMORY_MCP_URL=http://localhost:8765
```

## Architecture

The deployment includes:

1. **OpenMemory MCP Server** (port 8765)
   - FastAPI backend with MCP protocol support
   - Memory extraction using OpenAI
   - REST API and MCP endpoints
   - Development mode with hot-reload enabled

2. **Qdrant Vector Database** (port 6333)
   - Stores memory embeddings
   - Enables semantic search
   - Note: Uses same port as Chronicle's Qdrant (services are isolated by Docker network)

3. **Neo4j Graph Database** (ports 7474, 7687)
   - Advanced graph-based memory features
   - APOC and Graph Data Science plugins enabled
   - Web browser interface for visualization
   - Default credentials: `neo4j/taketheredpillNe0`

4. **OpenMemory UI** (port 3333)
   - Web interface for memory management
   - View and search memories
   - Debug and testing interface

## Service Endpoints

- **MCP Server**: http://localhost:8765
  - REST API: `/api/v1/memories`
  - MCP SSE: `/mcp/{client_name}/sse/{user_id}`
  - API Docs: http://localhost:8765/docs

- **Qdrant Dashboard**: http://localhost:6333/dashboard

- **Neo4j Browser**: http://localhost:7474
  - Username: `neo4j`
  - Password: `taketheredpillNe0`

- **OpenMemory UI**: http://localhost:3333

## How It Works with Chronicle

When configured with `MEMORY_PROVIDER=openmemory_mcp`, Chronicle will:

1. Send raw conversation transcripts to OpenMemory MCP
2. OpenMemory extracts memories using OpenAI
3. Memories are stored in the dedicated Qdrant instance
4. Chronicle can search memories via the MCP protocol

This replaces Chronicle's built-in memory processing with OpenMemory's implementation.

## Managing Services

**Using Chronicle's unified service manager (from project root):**
```bash
# View status
uv run --with-requirements setup-requirements.txt python services.py status

# Stop services
uv run --with-requirements setup-requirements.txt python services.py stop openmemory-mcp

# Restart services
uv run --with-requirements setup-requirements.txt python services.py restart openmemory-mcp --build
```

**Manually from the fork directory:**
```bash
cd extras/openmemory-mcp/mem0-fork/openmemory

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove data
docker compose down -v

# Restart services
docker compose restart
```

## Testing

### Standalone Test (No Chronicle Dependencies)

Test the OpenMemory MCP server directly:

```bash
# From extras/openmemory-mcp directory
./test_standalone.py

# Or with custom server URL
OPENMEMORY_MCP_URL=http://localhost:8765 python test_standalone.py
```

This test verifies:
- Server connectivity
- Memory creation via REST API
- Memory listing and search
- Memory deletion
- MCP protocol endpoints

### Integration Test (With Chronicle)

Test the integration between Chronicle and OpenMemory MCP:

```bash
# From backends/advanced directory
cd backends/advanced
uv run python tests/test_openmemory_integration.py

# Or with custom server URL
OPENMEMORY_MCP_URL=http://localhost:8765 uv run python tests/test_openmemory_integration.py
```

This test verifies:
- MCP client functionality
- OpenMemoryMCPService implementation
- Service factory integration
- Memory operations through Chronicle interface

## Troubleshooting

### Port Conflicts

**Qdrant Port Note**: OpenMemory uses port 6333 for Qdrant, same as Chronicle's main Qdrant. However, they are isolated by Docker networks and won't conflict. Services communicate via container names, not localhost ports.

If you need to change ports, edit `mem0-fork/openmemory/docker-compose.yml`:
- MCP Server: Change `8765:8765` to another port
- Qdrant: Change `6333:6333` to another port
- Neo4j Browser: Change `7474:7474` to another port
- Neo4j Bolt: Change `7687:7687` to another port
- UI: Change `3333:3000` to another port

Update Chronicle's `OPENMEMORY_MCP_URL` if you change the MCP server port.

### Memory Not Working

1. Check OpenMemory logs: `docker compose logs openmemory-mcp`
2. Verify OPENAI_API_KEY is set correctly
3. Ensure Chronicle backend is configured with correct URL
4. Test MCP endpoint: `curl http://localhost:8765/api/v1/memories?user_id=test`

### Connection Issues

- Ensure containers are on same network if running Chronicle in Docker
- Use `host.docker.internal` instead of `localhost` when connecting from Docker containers

## Advanced Configuration

### Using with Docker Network

If Chronicle backend is also running in Docker:

```yaml
# In Chronicle docker-compose.yml
networks:
  default:
    external:
      name: openmemory-mcp_openmemory-network
```

Then use container names in Chronicle .env:
```bash
OPENMEMORY_MCP_URL=http://openmemory-mcp:8765
```

### Custom Models

OpenMemory uses OpenAI by default. To use different models, you would need to modify the OpenMemory source code and build a custom image.

## Resources

- [OpenMemory Documentation](https://docs.mem0.ai/open-memory/introduction)
- [MCP Protocol Spec](https://github.com/mem0ai/mem0/tree/main/openmemory)
- [Chronicle Memory Docs](../../backends/advanced/MEMORY_PROVIDERS.md)