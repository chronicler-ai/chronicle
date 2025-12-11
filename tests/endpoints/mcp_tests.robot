*** Settings ***
Documentation    MCP (Model Context Protocol) Server API Tests
...
...              Tests for the Friend-Lite MCP server that provides conversation access
...              tools for LLMs via the Model Context Protocol.
...
...              The MCP server provides:
...              - list_conversations: List conversations with filtering/pagination
...              - get_conversation: Get detailed conversation data
...              - get_segments_from_conversation: Get speaker segments
...              - Audio resources: Access conversation audio files
...
...              Authentication: Uses API keys generated via /users/me/api-key
...              Protocol: JSON-RPC over SSE (Server-Sent Events)
...
...              Uses MCPClientLibrary for proper MCP protocol testing.
Library          RequestsLibrary
Library          Collections
Library          String
Library          ../libraries/MCPClientLibrary.py
Resource         ../setup/setup_keywords.robot
Resource         ../setup/teardown_keywords.robot
Resource         ../resources/session_keywords.robot
Resource         ../resources/user_keywords.robot
Resource         ../resources/conversation_keywords.robot
Resource         ../resources/mcp_keywords.robot
Suite Setup      Suite Setup
Suite Teardown   Suite Teardown
Test Setup       Test Cleanup

*** Test Cases ***

Generate API Key For MCP Access Test
    [Documentation]    Test generating an API key for MCP server access
    [Tags]    infra

    # Generate API key
    ${api_key}=    Generate User API Key    api

    # Verify API key is returned and has expected format
    Should Not Be Empty    ${api_key}
    ${key_length}=    Get Length    ${api_key}
    Should Be True    ${key_length} > 20    API key should be sufficiently long

    # Verify API key is stored in user profile
    ${user}=    Get User Details    api    me
    Dictionary Should Contain Key    ${user}    api_key
    Should Not Be Empty    ${user}[api_key]
    Should Be Equal    ${user}[api_key]    ${api_key}

Revoke API Key Test
    [Documentation]    Test revoking an API key
    [Tags]    infra

    # First generate an API key
    ${api_key}=    Generate User API Key    api

    # Revoke it
    ${result}=    Revoke User API Key    api

    # Verify revocation response
    Dictionary Should Contain Key    ${result}    status
    Should Be Equal    ${result}[status]    success

    # Verify API key is removed from user profile
    ${user}=    Get User Details    api    me
    # API key should be None/null or not present
    ${api_key_value}=    Get From Dictionary    ${user}    api_key    default=${None}
    Should Be Equal    ${api_key_value}    ${None}    API key should be None after revocation

MCP Retrieve Conversation Via Direct API Test
    [Documentation]    Test retrieving conversation data using standard API (baseline for MCP comparison)
    [Tags]    infra	conversation

    # This test verifies the underlying data is accessible
    # MCP server should provide same data via MCP protocol

    # Get a test conversation via normal API
    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Verify conversation has required data
    Dictionary Should Contain Key    ${test_conversation}    conversation_id
    Dictionary Should Contain Key    ${test_conversation}    audio_uuid
    Should Be Equal    ${test_conversation}[conversation_id]    ${conversation_id}

    Log    Found test conversation: ${conversation_id}

MCP Retrieve Audio Via Direct API Test
    [Documentation]    Test retrieving audio file using standard API (baseline for MCP comparison)
    [Tags]    infra	conversation

    # This test verifies audio files are accessible
    # MCP server should provide same audio via MCP protocol

    # Get a test conversation with audio
    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Skip if no audio
    Skip If    not ${test_conversation}[has_audio]    Test conversation has no audio file

    # Get audio file via standard API
    ${response}=    GET On Session    api    /api/conversations/${conversation_id}/audio    expected_status=200

    # Verify audio was retrieved
    Should Be Equal As Integers    ${response.status_code}    200
    ${audio_size}=    Evaluate    len($response.content)
    Should Be True    ${audio_size} > 0    Audio file should have content

    Log    Successfully retrieved audio file of ${audio_size} bytes

MCP SSE Endpoint Requires Authentication Test
    [Documentation]    Test that MCP SSE endpoint requires authentication
    [Tags]    infra	permissions

    # Try to connect without Authorization header
    ${response}=    GET On Session    api    /mcp/conversations/sse    expected_status=401

    # Verify 401 Unauthorized
    Should Be Equal As Integers    ${response.status_code}    401
    ${error_data}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${error_data}    error
    Should Contain    ${error_data}[error]    Authorization header required

MCP List Tools Test
    [Documentation]    Test listing available MCP tools
    [Tags]    infra

    ${api_key}=    Generate User API Key    api

    # Connect to MCP server
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # List available tools
    ${tools}=    List MCP Tools

    # Verify we got tools
    ${tool_count}=    Get Length    ${tools}
    Should Be True    ${tool_count} > 0    MCP server should provide tools

    # Verify expected tools are present
    ${tool_names}=    Evaluate    [tool['name'] for tool in ${tools}]
    Should Contain    ${tool_names}    list_conversations
    Should Contain    ${tool_names}    get_conversation
    Should Contain    ${tool_names}    get_segments_from_conversation

    Log    Found ${tool_count} MCP tools: ${tool_names}

    [Teardown]    Disconnect From MCP Server

MCP List Conversations Tool Test
    [Documentation]    Test the list_conversations MCP tool
    [Tags]    infra	conversation

    ${api_key}=    Generate User API Key    api
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # Call list_conversations tool
    &{args}=    Create Dictionary    limit=10    offset=0
    ${result}=    Call MCP Tool    list_conversations    ${args}

    # Verify result structure
    Dictionary Should Contain Key    ${result}    content
    Dictionary Should Contain Key    ${result}    isError
    Should Be Equal    ${result}[isError]    ${False}

    # Parse the content (MCP tools return JSON strings)
    ${content_str}=    Parse MCP Tool Result    ${result}
    ${conversations_data}=    Evaluate    json.loads('''${content_str}''')    json

    # Verify conversation data structure
    Dictionary Should Contain Key    ${conversations_data}    conversations
    Dictionary Should Contain Key    ${conversations_data}    pagination

    ${conv_count}=    Get Length    ${conversations_data}[conversations]
    Log    Listed ${conv_count} conversations via MCP

    [Teardown]    Disconnect From MCP Server

MCP Get Conversation Tool Test
    [Documentation]    Test the get_conversation MCP tool
    [Tags]    infra	conversation

    ${api_key}=    Generate User API Key    api
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # First get a conversation ID
    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Call get_conversation tool
    &{args}=    Create Dictionary    conversation_id=${conversation_id}
    ${result}=    Call MCP Tool    get_conversation    ${args}

    # Verify result
    Should Be Equal    ${result}[isError]    ${False}

    # Parse conversation data
    ${content_str}=    Parse MCP Tool Result    ${result}
    ${conversation}=    Evaluate    json.loads('''${content_str}''')    json

    # Verify conversation structure
    Dictionary Should Contain Key    ${conversation}    conversation_id
    Dictionary Should Contain Key    ${conversation}    transcript
    Dictionary Should Contain Key    ${conversation}    audio_uuid
    Should Be Equal    ${conversation}[conversation_id]    ${conversation_id}

    Log    Retrieved conversation ${conversation_id} via MCP

    [Teardown]    Disconnect From MCP Server

MCP Get Segments Tool Test
    [Documentation]    Test the get_segments_from_conversation MCP tool
    [Tags]    infra	conversation

    ${api_key}=    Generate User API Key    api
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # Get a conversation with segments
    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Call get_segments tool
    &{args}=    Create Dictionary    conversation_id=${conversation_id}
    ${result}=    Call MCP Tool    get_segments_from_conversation    ${args}

    # Verify result
    Should Be Equal    ${result}[isError]    ${False}

    # Parse segments data
    ${content_str}=    Parse MCP Tool Result    ${result}
    ${segments_data}=    Evaluate    json.loads('''${content_str}''')    json

    # Verify segments structure
    Dictionary Should Contain Key    ${segments_data}    conversation_id
    Dictionary Should Contain Key    ${segments_data}    segments
    Dictionary Should Contain Key    ${segments_data}    segment_count
    Should Be Equal    ${segments_data}[conversation_id]    ${conversation_id}

    Log    Retrieved ${segments_data}[segment_count] segments via MCP

    [Teardown]    Disconnect From MCP Server

MCP List Resources Test
    [Documentation]    Test listing available MCP resources
    [Tags]    infra

    ${api_key}=    Generate User API Key    api
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # List resources (may be empty if dynamic)
    ${resources}=    List MCP Resources

    # Resources might be dynamically generated, so just verify it returns a list
    ${is_list}=    Evaluate    isinstance($resources, list)
    Should Be True    ${is_list}    Resources should be a list

    Log    Found ${len(resources)} MCP resources

    [Teardown]    Disconnect From MCP Server

MCP Read Audio Resource Test
    [Documentation]    Test reading audio resource via MCP
    [Tags]    infra	conversation

    ${api_key}=    Generate User API Key    api
    Connect To MCP Server    ${API_URL}    ${api_key}    timeout=10

    # Get a conversation with audio
    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Skip if no audio
    Skip If    not ${test_conversation}[has_audio]    Test conversation has no audio

    # Read audio resource
    ${uri}=    Set Variable    conversation://${conversation_id}/audio
    ${resource}=    Read MCP Resource    ${uri}

    # Verify resource structure
    Dictionary Should Contain Key    ${resource}    uri
    Dictionary Should Contain Key    ${resource}    contents
    Should Be Equal    ${resource}[uri]    ${uri}

    Log    Successfully read audio resource via MCP

    [Teardown]    Disconnect From MCP Server

*** Keywords ***

Find Test Conversation
    [Documentation]    Find a test conversation with segments for testing
    ${conversations_data}=    Get User Conversations

    # Find first conversation from any client
    ${client_ids}=    Get Dictionary Keys    ${conversations_data}
    FOR    ${client_id}    IN    @{client_ids}
        ${client_conversations}=    Get From Dictionary    ${conversations_data}    ${client_id}
        ${conv_count}=    Get Length    ${client_conversations}
        IF    ${conv_count} > 0
            ${conversation}=    Get From List    ${client_conversations}    0
            RETURN    ${conversation}
        END
    END

    Fail    No test conversations found
