"""
MCP Client Library for Robot Framework

This library provides keywords for testing MCP (Model Context Protocol) servers
using the official MCP Python SDK with SSE transport.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from mcp import ClientSession
from mcp.client.sse import sse_client

logger = logging.getLogger(__name__)


class MCPClientLibrary:
    """Robot Framework library for testing MCP servers via SSE.

    This library executes MCP operations as single-use connections rather than
    maintaining a persistent connection, which simplifies async/sync bridging.
    """

    ROBOT_LIBRARY_SCOPE = "TEST"
    ROBOT_LIBRARY_VERSION = "1.0.0"

    def __init__(self):
        """Initialize the MCP client library."""
        self.base_url: Optional[str] = None
        self.api_key: Optional[str] = None
        self._event_loop = None

    def _get_event_loop(self):
        """Get or create an event loop."""
        if self._event_loop is None:
            try:
                self._event_loop = asyncio.get_event_loop()
            except RuntimeError:
                self._event_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._event_loop)
        return self._event_loop

    def connect_to_mcp_server(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Set MCP server connection parameters.

        Note: Connection is established on-demand for each operation.

        Args:
            base_url: Base URL of the MCP server (e.g., http://localhost:8000)
            api_key: API key for authentication
            timeout: Connection timeout in seconds (default: 30)

        Example:
            | Connect To MCP Server | http://localhost:8000 | ${api_key} | timeout=10 |
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        logger.info(f"MCP server configured: {self.base_url}")

    def list_mcp_tools(self) -> List[Dict[str, Any]]:
        """
        List all available tools from the MCP server.

        Returns:
            List of tool definitions

        Example:
            | ${tools}= | List MCP Tools |
            | Log | Found ${len(tools)} tools |
        """
        if not self.base_url or not self.api_key:
            raise RuntimeError("Not configured. Call 'Connect To MCP Server' first.")

        async def _list_tools():
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                sse_url = f"{self.base_url}/mcp/conversations/sse"

                logger.info(f"Connecting to MCP server to list tools...")

                # Create fresh connection
                async with sse_client(sse_url, headers=headers, timeout=30) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        logger.info("Session initialized, listing tools...")

                        result = await session.list_tools()
                        logger.info(f"Received tool list response")

                        tools = [tool.model_dump() for tool in result.tools]
                        logger.info(f"Parsed {len(tools)} tools")
                        return tools
            except Exception as e:
                logger.error(f"Error listing tools: {type(e).__name__}: {e}", exc_info=True)
                raise

        loop = self._get_event_loop()
        try:
            tools = loop.run_until_complete(_list_tools())
            logger.info(f"Successfully listed {len(tools)} MCP tools: {[t.get('name') for t in tools]}")
            return tools
        except Exception as e:
            error_msg = f"Failed to list MCP tools: {type(e).__name__}: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    def call_mcp_tool(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Call an MCP tool with the given arguments.

        Args:
            tool_name: Name of the tool to call
            arguments: Dictionary of arguments to pass to the tool

        Returns:
            Tool result as a dictionary

        Example:
            | &{args}= | Create Dictionary | limit=10 | offset=0 |
            | ${result}= | Call MCP Tool | list_conversations | ${args} |
        """
        if not self.base_url or not self.api_key:
            raise RuntimeError("Not configured. Call 'Connect To MCP Server' first.")

        if arguments is None:
            arguments = {}

        async def _call_tool():
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                sse_url = f"{self.base_url}/mcp/conversations/sse"

                logger.info(f"Connecting to MCP server to call tool '{tool_name}'...")

                # Create fresh connection
                async with sse_client(sse_url, headers=headers, timeout=30) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        logger.info(f"Session initialized, calling tool '{tool_name}'...")

                        result = await session.call_tool(tool_name, arguments=arguments)
                        logger.info(f"Tool '{tool_name}' executed successfully")

                        return {"content": result.content, "isError": result.isError}
            except Exception as e:
                logger.error(f"Error calling tool '{tool_name}': {type(e).__name__}: {e}", exc_info=True)
                raise

        loop = self._get_event_loop()
        try:
            result = loop.run_until_complete(_call_tool())
            logger.info(f"Called MCP tool '{tool_name}' with args: {arguments}")
            return result
        except Exception as e:
            error_msg = f"Failed to call MCP tool '{tool_name}': {type(e).__name__}: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    def list_mcp_resources(self) -> List[Dict[str, Any]]:
        """
        List all available resources from the MCP server.

        Returns:
            List of resource definitions

        Example:
            | ${resources}= | List MCP Resources |
        """
        if not self.base_url or not self.api_key:
            raise RuntimeError("Not configured. Call 'Connect To MCP Server' first.")

        async def _list_resources():
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                sse_url = f"{self.base_url}/mcp/conversations/sse"

                logger.info(f"Connecting to MCP server to list resources...")

                # Create fresh connection
                async with sse_client(sse_url, headers=headers, timeout=30) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        logger.info("Session initialized, listing resources...")

                        result = await session.list_resources()
                        logger.info(f"Received resource list response")

                        resources = [resource.model_dump() for resource in result.resources]
                        logger.info(f"Parsed {len(resources)} resources")
                        return resources
            except Exception as e:
                logger.error(f"Error listing resources: {type(e).__name__}: {e}", exc_info=True)
                raise

        loop = self._get_event_loop()
        try:
            resources = loop.run_until_complete(_list_resources())
            logger.info(f"Successfully listed {len(resources)} MCP resources")
            return resources
        except Exception as e:
            error_msg = f"Failed to list MCP resources: {type(e).__name__}: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    def read_mcp_resource(self, uri: str) -> Dict[str, Any]:
        """
        Read an MCP resource by its URI.

        Args:
            uri: Resource URI (e.g., conversation://conv-123/audio)

        Returns:
            Resource content as a dictionary

        Example:
            | ${audio}= | Read MCP Resource | conversation://conv-123/audio |
        """
        if not self.base_url or not self.api_key:
            raise RuntimeError("Not configured. Call 'Connect To MCP Server' first.")

        async def _read_resource():
            try:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                sse_url = f"{self.base_url}/mcp/conversations/sse"

                logger.info(f"Connecting to MCP server to read resource '{uri}'...")

                # Create fresh connection
                async with sse_client(sse_url, headers=headers, timeout=30) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        logger.info(f"Session initialized, reading resource '{uri}'...")

                        result = await session.read_resource(uri)
                        logger.info(f"Resource '{uri}' read successfully")

                        # ReadResourceResult has 'contents' attribute which is a list of content items
                        return {"uri": uri, "contents": result.contents}
            except Exception as e:
                logger.error(f"Error reading resource '{uri}': {type(e).__name__}: {e}", exc_info=True)
                raise

        loop = self._get_event_loop()
        try:
            resource = loop.run_until_complete(_read_resource())
            logger.info(f"Successfully read MCP resource: {uri}")
            return resource
        except Exception as e:
            error_msg = f"Failed to read MCP resource '{uri}': {type(e).__name__}: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    def disconnect_from_mcp_server(self):
        """
        Disconnect from the MCP server and clean up resources.

        Note: Connections are created per-operation, so no cleanup needed.

        Example:
            | Disconnect From MCP Server |
        """
        logger.info("MCP client disconnected (connections are per-operation)")
        self.base_url = None
        self.api_key = None

    def parse_mcp_tool_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse MCP tool result content and return as dictionary.

        Args:
            result: Tool result from Call MCP Tool

        Returns:
            Parsed data as a dictionary

        Example:
            | ${result}= | Call MCP Tool | list_conversations |
            | ${data}= | Parse MCP Tool Result | ${result} |
            | ${conversations}= | Get From Dictionary | ${data} | conversations |
        """
        if not result:
            return {}

        content_list = result.get("content", [])
        if not content_list:
            return {}

        # Get the first content item (usually text)
        first_content = content_list[0] if isinstance(content_list, list) else content_list

        # Extract text content
        text_content = ""
        if isinstance(first_content, dict):
            text_content = first_content.get("text", "")
        elif hasattr(first_content, "text"):
            text_content = first_content.text
        else:
            text_content = str(first_content)

        # Parse JSON directly in Python
        if text_content:
            import json
            return json.loads(text_content)

        return {}
