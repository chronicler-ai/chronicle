*** Settings ***
Documentation    MCP (Model Context Protocol) server interaction keywords
...
...              This file contains keywords for interacting with the Friend-Lite MCP server.
...              Keywords in this file should handle MCP-specific operations like SSE connections,
...              tool calls, and resource access.
...
...              Examples of keywords that belong here:
...              - MCP SSE connection setup
...              - MCP tool invocations (list_conversations, get_conversation, etc.)
...              - MCP resource access (audio files)
...              - MCP request/response formatting
...
...              Keywords that should NOT be in this file:
...              - Verification/assertion keywords (belong in tests)
...              - API key generation (belongs in user_keywords.robot)
...              - General API session management (belongs in session_keywords.robot)
Library          RequestsLibrary
Library          Collections
# Library          JSONLibrary
Library          String
Variables        ../setup/test_env.py
Resource         session_keywords.robot

*** Keywords ***

Generate User API Key
    [Documentation]    Generate an API key for MCP access for the current user
    [Arguments]    ${session}

    ${response}=    POST On Session    ${session}    /api/users/me/api-key    expected_status=200
    ${data}=        Set Variable    ${response.json()}
    ${api_key}=     Get From Dictionary    ${data}    api_key

    RETURN    ${api_key}

Revoke User API Key
    [Documentation]    Revoke the current user's API key
    [Arguments]    ${session}

    ${response}=    DELETE On Session    ${session}    /api/users/me/api-key    expected_status=200
    RETURN    ${response.json()}
