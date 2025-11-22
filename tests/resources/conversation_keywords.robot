*** Settings ***
Documentation    Conversation Management Keywords
Library          RequestsLibrary
Library          Collections
Library          Process
Library          String
Resource         session_resources.robot
Resource         audio_keywords.robot


*** Keywords ***

Get User Conversations
    [Documentation]    Get conversations for authenticated user (uses admin session)

    ${response}=    GET On Session    api    /api/conversations    expected_status=200
    RETURN    ${response.json()}[conversations]

Get Conversation By ID
    [Documentation]    Get a specific conversation by ID
    [Arguments]       ${conversation_id}
    ${response}=    GET On Session    api    /api/conversations/${conversation_id} 
    RETURN    ${response.json()}[conversation]

Get Conversation Versions
    [Documentation]    Get version history for a conversation
    [Arguments]    ${conversation_id}
    ${response}=    GET On Session    api    /api/conversations/${conversation_id}/versions 
    RETURN    ${response.json()}[transcript_versions]

Get conversation memory versions
    [Documentation]    Get memory version history for a conversation
    [Arguments]    ${conversation_id}
    ${response}=    GET On Session    api    /api/conversations/${conversation_id}/versions/memory
    RETURN    ${response.json()}[memory_versions]

Reprocess Transcript
    [Documentation]    Trigger transcript reprocessing for a conversation
    [Arguments]     ${conversation_id}

    ${response}=    POST On Session    api    /api/conversations/${conversation_id}/reprocess-transcript    expected_status=200

    ${reprocess_data}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${reprocess_data}    job_id
    Dictionary Should Contain Key    ${reprocess_data}    status

    ${job_id}=    Set Variable    ${reprocess_data}[job_id]
    ${initial_status}=    Set Variable    ${reprocess_data}[status]

    Log    Reprocess job created: ${job_id} with status: ${initial_status}    INFO
    Should Be Equal As Strings    ${initial_status}    queued

    RETURN    ${response.json()}

Reprocess Memory
    [Documentation]    Trigger memory reprocessing for a conversation
    [Arguments]    ${conversation_id}    ${transcript_version_id}=active
    &{params}=     Create Dictionary    transcript_version_id=${transcript_version_id}

    ${response}=    POST On Session    api    /api/conversations/${conversation_id}/reprocess-memory        params=${params}
    RETURN    ${response.json()}

Activate Transcript Version
    [Documentation]    Activate a specific transcript version
    [Arguments]    ${conversation_id}    ${version_id}

    ${response}=    POST On Session    api    /api/conversations/${conversation_id}/activate-transcript/${version_id}  
    RETURN    ${response.json()}

Activate Memory Version
    [Documentation]    Activate a specific memory version
    [Arguments]     ${conversation_id}    ${version_id}

    ${response}=    POST On Session    api    /api/conversations/${conversation_id}/activate-memory/${version_id}  
    RETURN    ${response.json()}

Delete Conversation
    [Documentation]    Delete a conversation
    [Arguments]     ${audio_uuid}

    ${response}=    DELETE On Session    api    /api/conversations/${audio_uuid}    headers=${headers}
    RETURN    ${response.json()}

Delete Conversation Version
    [Documentation]    Delete a specific version from a conversation
    [Arguments]     ${conversation_id}    ${version_type}    ${version_id}

    ${response}=    DELETE On Session    api    /api/conversations/${conversation_id}/versions/${version_type}/${version_id}    headers=${headers}
    RETURN    ${response.json()}

Close Current Conversation
    [Documentation]    Close the current conversation for a client
    [Arguments]    ${client_id}

    ${response}=    POST On Session    api    /api/conversations/${client_id}/close    headers=${headers}
    RETURN    ${response.json()}

Get Cropped Audio Info
    [Documentation]    Get cropped audio information for a conversation
    [Arguments]     ${audio_uuid}

    ${response}=    GET On Session    api    /api/conversations/${audio_uuid}/cropped    headers=${headers}
    RETURN    ${response.json()}[cropped_audios]    

Add Speaker To Conversation
    [Documentation]    Add a speaker to the speakers_identified list
    [Arguments]    ${audio_uuid}    ${speaker_id}
    &{params}=     Create Dictionary    speaker_id=${speaker_id}

    ${response}=    POST On Session    api    /api/conversations/${audio_uuid}/speakers    headers=${headers}    params=${params}
    RETURN    ${response.json()}

Update Transcript Segment
    [Documentation]    Update a specific transcript segment
    [Arguments]    ${audio_uuid}    ${segment_index}    ${speaker_id}=${None}    ${start_time}=${None}    ${end_time}=${None}
    &{params}=     Create Dictionary

    IF    '${speaker_id}' != '${None}'
        Set To Dictionary    ${params}    speaker_id=${speaker_id}
    END
    IF    '${start_time}' != '${None}'
        Set To Dictionary    ${params}    start_time=${start_time}
    END
    IF    '${end_time}' != '${None}'
        Set To Dictionary    ${params}    end_time=${end_time}
    END

    ${response}=    PUT On Session    api    /api/conversations/${audio_uuid}/transcript/${segment_index}    headers=${headers}    params=${params}
    RETURN    ${response.json()}


Create Test Conversation
    [Documentation]    Create a test conversation by processing a test audio file
    [Arguments]     ${device_name}=test-device

    # Upload test audio file to create a conversation

    ${conversation}=    Upload Audio File     ${TEST_AUDIO_FILE}    ${device_name}

    RETURN    ${conversation}

Verify Transcript Content
    [Documentation]    Verify transcript contains expected content and quality
    [Arguments]    ${conversation}    ${expected_keywords}    ${min_length}=50

    Dictionary Should Contain Key    ${conversation}    transcript
    ${transcript}=    Set Variable    ${conversation}[transcript]
    Should Not Be Empty    ${transcript}

    # Check length
    ${transcript_length}=    Get Length    ${transcript}
    Should Be True    ${transcript_length} >= ${min_length}    Transcript too short: ${transcript_length}

    # Check for expected keywords
    ${transcript_lower}=    Convert To Lower Case    ${transcript}
    FOR    ${keyword}    IN    @{expected_keywords}
        ${keyword_lower}=    Convert To Lower Case    ${keyword}
        Should Contain    ${transcript_lower}    ${keyword_lower}    Missing keyword: ${keyword}
    END

    # Verify segments exist
    Dictionary Should Contain Key    ${conversation}    segments
    ${segments}=    Set Variable    ${conversation}[segments]
    ${segment_count}=    Get Length    ${segments}
    Should Be True    ${segment_count} > 0    No segments found

    Log    Transcript verification passed: ${transcript_length} chars, ${segment_count} segments    INFO

Find Test Conversation
    [Documentation]    Find an existing conversation or create one if none exist (uses admin session)
    ${conversations_data}=    Get User Conversations
    Log    Retrieved conversations data: ${conversations_data}

    # conversations_data is now a flat list
    ${count}=    Get Length    ${conversations_data}

    IF    ${count} > 0
        ${first_conv}=    Set Variable    ${conversations_data}[0]
        RETURN    ${first_conv}
    END

    # If no conversations exist, create one by uploading test audio
    Log    No conversations found, creating one by uploading test audio
    ${conversation}=    Upload Audio File    ${TEST_AUDIO_FILE}    ${TEST_DEVICE_NAME}

    # Wait for initial processing to complete
    Sleep    5s

    RETURN    ${conversation}

