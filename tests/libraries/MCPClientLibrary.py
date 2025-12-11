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
    """Robot Framework library for testing MCP servers via SSE."""

    ROBOT_LIBRARY_SCOPE = "TEST"
    ROBOT_LIBRARY_VERSION = "1.0.0"

    def __init__(self):
        """Initialize the MCP client library."""
        self.session: Optional[ClientSession] = None
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
        Connect to an MCP server via SSE transport.

        Args:
            base_url: Base URL of the MCP server (e.g., http://localhost:8000)
            api_key: API key for authentication
            timeout: Connection timeout in seconds (default: 30)

        Example:
            | Connect To MCP Server | http://localhost:8000 | ${api_key} | timeout=10 |
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

        async def _connect():
            headers = {"Authorization": f"Bearer {api_key}"}
            sse_url = f"{self.base_url}/mcp/conversations/sse"

            # Use SSE client from MCP SDK
            async with sse_client(sse_url, headers=headers, timeout=timeout) as (read, write):
                async with ClientSession(read, write) as session:
                    self.session = session
                    # Initialize the connection
                    await session.initialize()
                    logger.info(f"Connected to MCP server at {self.base_url}")
                    return session

        loop = self._get_event_loop()
        try:
            result = loop.run_until_complete(_connect())
            logger.info(f"MCP session initialized: {result}")
        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            raise

    def list_mcp_tools(self) -> List[Dict[str, Any]]:
        """
        List all available tools from the MCP server.

        Returns:
            List of tool definitions

        Example:
            | ${tools}= | List MCP Tools |
            | Log | Found ${len(tools)} tools |
        """
        if not self.session:
            raise RuntimeError("Not connected to MCP server. Call 'Connect To MCP Server' first.")

        async def _list_tools():
            result = await self.session.list_tools()
            return [tool.model_dump() for tool in result.tools]

        loop = self._get_event_loop()
        tools = loop.run_until_complete(_list_tools())
        logger.info(f"Listed {len(tools)} MCP tools")
        return tools

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
        if not self.session:
            raise RuntimeError("Not connected to MCP server. Call 'Connect To MCP Server' first.")

        if arguments is None:
            arguments = {}

        async def _call_tool():
            result = await self.session.call_tool(tool_name, arguments=arguments)
            return {"content": result.content, "isError": result.isError}

        loop = self._get_event_loop()
        result = loop.run_until_complete(_call_tool())
        logger.info(f"Called MCP tool '{tool_name}' with args: {arguments}")

        return result

    def list_mcp_resources(self) -> List[Dict[str, Any]]:
        """
        List all available resources from the MCP server.

        Returns:
            List of resource definitions

        Example:
            | ${resources}= | List MCP Resources |
        """
        if not self.session:
            raise RuntimeError("Not connected to MCP server. Call 'Connect To MCP Server' first.")

        async def _list_resources():
            result = await self.session.list_resources()
            return [resource.model_dump() for resource in result.resources]

        loop = self._get_event_loop()
        resources = loop.run_until_complete(_list_resources())
        logger.info(f"Listed {len(resources)} MCP resources")
        return resources

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
        if not self.session:
            raise RuntimeError("Not connected to MCP server. Call 'Connect To MCP Server' first.")

        async def _read_resource():
            result = await self.session.read_resource(uri)
            return {"uri": result.uri, "contents": result.contents}

        loop = self._get_event_loop()
        resource = loop.run_until_complete(_read_resource())
        logger.info(f"Read MCP resource: {uri}")
        return resource

    def disconnect_from_mcp_server(self):
        """
        Disconnect from the MCP server and clean up resources.

        Example:
            | Disconnect From MCP Server |
        """
        if self.session:
            logger.info("Disconnecting from MCP server")
            self.session = None
        self.base_url = None
        self.api_key = None

    def parse_mcp_tool_result(self, result: Dict[str, Any]) -> str:
        """
        Parse MCP tool result content (handles JSON strings in content).

        Args:
            result: Tool result from Call MCP Tool

        Returns:
            Parsed JSON string from the tool result content

        Example:
            | ${result}= | Call MCP Tool | list_conversations |
            | ${json_str}= | Parse MCP Tool Result | ${result} |
            | ${data}= | Evaluate | json.loads($json_str) | json |
        """
        if not result:
            return ""

        content_list = result.get("content", [])
        if not content_list:
            return ""

        # Get the first content item (usually text)
        first_content = content_list[0] if isinstance(content_list, list) else content_list

        if isinstance(first_content, dict):
            return first_content.get("text", "")
        elif hasattr(first_content, "text"):
            return first_content.text
        else:
            return str(first_content)
