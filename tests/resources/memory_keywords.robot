*** Settings ***
Documentation    Memory Management Keywords
...
...              This file contains keywords for memory operations including retrieval,
...              search, and deletion. All keywords use session-based authentication.
...
...              Examples of keywords that belong here:
...              - Memory retrieval and listing
...              - Memory search operations
...              - Memory deletion
...              - Memory verification and validation
...
...              Keywords that should NOT be in this file:
...              - Verification/assertion keywords (belong in tests)
...              - Session management (belong in session_keywords.robot)
Library          RequestsLibrary
Library          Collections
Variables        ../setup/test_env.py

*** Keywords ***

Get User Memories
    [Documentation]    Get memories for authenticated user using session
    [Arguments]    ${session}    ${limit}=50    ${user_id}=${None}

    &{params}=     Create Dictionary    limit=${limit}

    IF    '${user_id}' != '${None}'
        Set To Dictionary    ${params}    user_id=${user_id}
    END

    ${response}=    GET On Session    ${session}    /api/memories    params=${params}
    RETURN    ${response}

Get Memories With Transcripts
    [Documentation]    Get memories with their source transcripts using session
    [Arguments]    ${session}    ${limit}=50

    &{params}=     Create Dictionary    limit=${limit}

    ${response}=    GET On Session    ${session}    /api/memories/with-transcripts    params=${params}
    RETURN    ${response}

Search Memories
    [Documentation]    Search memories by query using session
    [Arguments]    ${session}    ${query}    ${limit}=20    ${score_threshold}=0.0

    &{params}=     Create Dictionary    query=${query}    limit=${limit}    score_threshold=${score_threshold}

    ${response}=    GET On Session    ${session}    /api/memories/search    params=${params}
    RETURN    ${response}

Delete Memory
    [Documentation]    Delete a specific memory using session
    [Arguments]    ${session}    ${memory_id}

    ${response}=    DELETE On Session    ${session}    /api/memories/${memory_id}
    RETURN    ${response}

Get Unfiltered Memories
    [Documentation]    Get all memories including fallback transcript memories using session
    [Arguments]    ${session}    ${limit}=50

    &{params}=     Create Dictionary    limit=${limit}

    ${response}=    GET On Session    ${session}    /api/memories/unfiltered    params=${params}
    RETURN    ${response}

Get All Memories Admin
    [Documentation]    Get all memories across all users (admin only) using session
    [Arguments]    ${session}    ${limit}=200

    &{params}=     Create Dictionary    limit=${limit}

    ${response}=    GET On Session    ${session}    /api/memories/admin    params=${params}
    RETURN    ${response}

Count User Memories
    [Documentation]    Count memories for a user using session
    [Arguments]    ${session}

    ${response}=    Get User Memories    ${session}    1000
    Should Be Equal As Integers    ${response.status_code}    200
    ${memories_data}=    Set Variable    ${response.json()}
    ${memories}=    Set Variable    ${memories_data}[memories]
    ${count}=       Get Length    ${memories}
    RETURN    ${count}

Verify Memory Extraction
    [Documentation]    Verify memories were extracted successfully
    [Arguments]    ${conversation}    ${memories_data}    ${min_memories}=0

    # Check conversation memory count
    Dictionary Should Contain Key    ${conversation}    memory_count
    ${conv_memory_count}=    Set Variable    ${conversation}[memory_count]

    # Check API memories
    Dictionary Should Contain Key    ${memories_data}    memories
    ${memories}=    Set Variable    ${memories_data}[memories]
    ${api_memory_count}=    Get Length    ${memories}

    # Verify reasonable memory extraction
    Should Be True    ${conv_memory_count} >= ${min_memories}    Insufficient memories: ${conv_memory_count}
    Should Be True    ${api_memory_count} >= ${min_memories}    Insufficient API memories: ${api_memory_count}

    Log    Memory extraction verified: conversation=${conv_memory_count}, api=${api_memory_count}    INFO
