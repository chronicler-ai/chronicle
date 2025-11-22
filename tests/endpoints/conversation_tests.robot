*** Settings ***
Documentation    Conversation Management API Tests
Library          RequestsLibrary
Library          Collections
Library          String
Resource         ../setup/setup_keywords.robot
Resource         ../setup/teardown_keywords.robot
Resource         ../resources/user_resources.robot
Resource         ../resources/conversation_keywords.robot
Resource         ../resources/queue_keywords.robot
Suite Setup      Suite Setup
Suite Teardown   Suite Teardown

*** Test Cases ***

Get User Conversations Test
    [Documentation]    Test getting conversations for authenticated user
    [Tags]    conversation user positive speed-fast

    ${conversations_data}=        Get User Conversations

    # Verify conversation structure if any exist
   
    IF    isinstance($conversations_data, dict) and len($conversations_data) > 0
        ${client_ids}=    Get Dictionary Keys    ${conversations_data}
        FOR    ${client_id}    IN    @{client_ids}
            ${client_conversations}=    Set Variable    ${conversations_data}[${client_id}]
            FOR    ${conversation}    IN    @{client_conversations}
                # Verify conversation structure
                Dictionary Should Contain Key    ${conversation}    conversation_id
                Dictionary Should Contain Key    ${conversation}    audio_uuid
                Dictionary Should Contain Key    ${conversation}    created_at
            END
        END
    END

Get Conversation By ID Test
    [Documentation]    Test getting a specific conversation by ID
    [Tags]    conversation individual positive speed-long

    ${test_conversation}=    Find Test Conversation

    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]
    ${conversation}=           Get Conversation By ID       ${conversation_id}

    # Verify conversation structure
    Dictionary Should Contain Key    ${conversation}    conversation_id
    Dictionary Should Contain Key    ${conversation}    audio_uuid
    Dictionary Should Contain Key    ${conversation}    created_at
    Should Be Equal    ${conversation}[conversation_id]    ${conversation_id}

Reprocess test and get Conversation Versions Test
    [Documentation]    Test getting version history for a conversation
    [Tags]    conversation versions positive speed-mid

    ${test_conversation}=    Find Test Conversation
    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]
    ${reprocess}=    Reprocess Transcript     ${conversation_id}

    # Wait for the reprocess job to complete before getting versions
    ${job_id}=    Set Variable    ${reprocess}[job_id]
    Wait For Job Status    ${job_id}    completed    timeout=120s    interval=5s

    ${versions}=           Get Conversation Versions     ${conversation_id}
    Length Should Be     ${versions}    2


Unauthorized Conversation Access Test
    [Documentation]    Test that conversation endpoints require authentication
    [Tags]    conversation security negative speed-fast
    Get Anonymous Session    session

    # Try to access conversations without token
    ${response}=    GET On Session    session    /api/conversations    expected_status=401
    Should Be Equal As Integers    ${response.status_code}    401

Non-Existent Conversation Test
    [Documentation]    Test accessing a non-existent conversation
    [Tags]    conversation negative notfound speed-fast

    ${fake_id}=         Set Variable    non-existent-conversation-id

    ${response}=        GET On Session    api    /api/conversations/${fake_id}    expected_status=404
    Should Be Equal As Integers    ${response.status_code}    404

Reprocess Memory Test
    [Documentation]    Test triggering memory reprocessing and verify new version created
    [Tags]    conversation reprocess memory positive speed-fast

    Skip  msg=Memory reprocessing needs a different transcript and different test data to work

    ${test_conversation}=    Find Test Conversation

    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]

    # Get initial memory version count
    ${initial_memory_count}=    Set Variable    ${test_conversation}[memory_version_count]
    Log    Initial memory version count: ${initial_memory_count}

    # Trigger memory reprocessing
    ${response}=    Reprocess Memory    ${conversation_id}

    # Verify response structure
    Dictionary Should Contain Key    ${response}    job_id
    Dictionary Should Contain Key    ${response}    status
    Should Be Equal As Strings    ${response}[status]    queued

    # Wait for job to complete
    ${job_id}=    Set Variable    ${response}[job_id]
    Wait For Job Status    ${job_id}    completed    timeout=60s    interval=5s

    # Verify new memory version was created
    ${updated_conversation}=    Get Conversation By ID    ${conversation_id}
    ${new_memory_count}=    Set Variable    ${updated_conversation}[memory_version_count]
    Log    New memory version count: ${new_memory_count}

    Should Be True    ${new_memory_count} > ${initial_memory_count}    Expected memory version count to increase

    ${memory_versions}=    Get conversation memory versions    ${conversation_id}
    Length Should Be    ${memory_versions}    ${new_memory_count}
  

Close Conversation Test
    [Documentation]    Test closing current conversation for a client
    [Tags]    conversation close positive speed-fast
    
    Skip     msg=Close conversation needs to be evaluated as to it's purpose from the client side

    Get Anonymous Session    anon_session

    Create API Session    admin_session
    ${client_id}=       Set Variable    test-client-${RANDOM_ID}

    # This might return 404 if client doesn't exist, which is expected
    ${response}=        POST On Session    admin_session    /api/conversations/${client_id}/close    expected_status=any
    Should Be True     ${response.status_code} in [200, 404]

Invalid Conversation Operations Test
    [Documentation]    Test invalid operations on conversations
    [Tags]    conversation negative invalid speed-fast

    ${fake_id}=         Set Variable    invalid-conversation-id

    # Test reprocessing non-existent conversation
    ${response}=        POST On Session    api    /api/conversations/${fake_id}/reprocess-transcript    expected_status=404
    Should Be Equal As Integers    ${response.status_code}    404

    # Test getting versions of non-existent conversation
    ${response}=        GET On Session    api    /api/conversations/${fake_id}/versions    expected_status=404
    Should Be Equal As Integers    ${response.status_code}    404

Transcript Version activate Test
    [Documentation]    Test version activation (if versions exist)
    [Tags]    conversation versions activation speed-mid

    ${test_conversation}=    Find Test Conversation

    ${conversation_id}=    Set Variable    ${test_conversation}[conversation_id]
    ${reprocess}=    Reprocess Transcript     ${conversation_id}
    
    
    # Wait for the reprocess job to complete before getting versions
    ${job_id}=    Set Variable    ${reprocess}[job_id]
    Wait For Job Status    ${job_id}    completed    timeout=120s    interval=5s

    ${versions}=  Get Conversation Versions     ${conversation_id}
    # Test activating existing active version (should succeed)
    ${active_transcript}=  Set Variable    ${test_conversation}[active_transcript_version]
    ${response}=       Activate Transcript Version      ${conversation_id}    ${versions}[1][version_id]
     Should Be Equal As Strings    ${response}[active_transcript_version]   ${versions}[1][version_id]  


        # ${active_memory}=     Get memory versions  
        # ...    ${test}[active_memory_version]
        # IF    '${active_memory}' != '${None}' and '${active_memory}' != 'null'
        #     ${response}=       Activate Memory Version       ${conversation_id}    ${active_memory}
        #     Should Be Equal As Integers    ${response.status_code}    200
        # END

Get conversation permission Test
    [Documentation]    Test that users can only access their own conversations
    [Tags]    conversation security isolation speed-mid

    Create Test Conversation
    # Create a test user
    ${test_user}=       Create Test User    api
    Create API Session    user_session    email=${test_user}[email]    password=${TEST_USER_PASSWORD}

    # Get admin conversations
    ${admin_conversations}=    Get User Conversations
    Should Be True    len(${admin_conversations}) > 0

    # Get user conversations (should be empty for new user)
    ${user_conversations}=    GET On Session    user_session    /api/conversations
    Should Be Equal As Integers    ${user_conversations.status_code}    200
    ${user_conv_data}=    Set Variable    ${user_conversations.json()}
    Length Should Be    ${user_conv_data}[conversations]    0

    # Cleanup
    Delete User    api    ${test_user}[id]

