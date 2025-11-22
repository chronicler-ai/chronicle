*** Settings ***
Documentation    WebSocket audio streaming keywords using the shared AudioStreamClient
Library          Collections
Library          OperatingSystem
Library          ../libs/audio_stream_library.py
Variables        ../setup/test_env.py
Resource         session_resources.robot
Resource         queue_keywords.robot

*** Keywords ***
Stream Audio File Via WebSocket
    [Documentation]    Stream a WAV file via WebSocket using Wyoming protocol
    ...                Uses the shared AudioStreamClient from advanced_omi_backend.clients
    [Arguments]    ${audio_file_path}    ${device_name}=robot-test    ${recording_mode}=streaming

    File Should Exist    ${audio_file_path}

    # Get a fresh token for WebSocket auth
    ${token}=    Get Authentication Token    api    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}

    ${chunks_sent}=    Stream Audio File
    ...    base_url=${API_URL}
    ...    token=${token}
    ...    wav_path=${audio_file_path}
    ...    device_name=${device_name}
    ...    recording_mode=${recording_mode}

    Log    Streamed ${chunks_sent} audio chunks via WebSocket
    Should Be True    ${chunks_sent} > 0    No audio chunks were sent
    RETURN    ${chunks_sent}

Stream Audio File Batch Mode
    [Documentation]    Stream a WAV file in batch mode via WebSocket
    [Arguments]    ${audio_file_path}    ${device_name}=robot-test

    ${chunks_sent}=    Stream Audio File Via WebSocket
    ...    ${audio_file_path}
    ...    ${device_name}
    ...    recording_mode=batch

    RETURN    ${chunks_sent}

Stream Audio File Streaming Mode
    [Documentation]    Stream a WAV file in streaming mode via WebSocket
    [Arguments]    ${audio_file_path}    ${device_name}=robot-test

    ${chunks_sent}=    Stream Audio File Via WebSocket
    ...    ${audio_file_path}
    ...    ${device_name}
    ...    recording_mode=streaming

    RETURN    ${chunks_sent}

# =============================================================================
# Non-blocking streaming keywords (for testing during stream)
# =============================================================================

Open Audio Stream
    [Documentation]    Start a WebSocket audio stream (non-blocking)
    ...                Returns immediately after connection. Use Send Audio Chunks
    ...                to send audio, and Close Audio Stream to close.
    [Arguments]    ${device_name}=robot-test    ${recording_mode}=streaming

    ${token}=    Get Authentication Token    api    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}

    # Call the Python library method directly
    ${stream_id}=    Start Audio Stream
    ...    base_url=${API_URL}
    ...    token=${token}
    ...    device_name=${device_name}
    ...    recording_mode=${recording_mode}

    Log    Started audio stream ${stream_id} for device ${device_name}
    RETURN    ${stream_id}

Send Audio Chunks To Stream
    [Documentation]    Send audio chunks from a file to an open stream
    [Arguments]    ${stream_id}    ${audio_file_path}    ${num_chunks}=${None}

    File Should Exist    ${audio_file_path}

    # Call the Python library method directly
    ${chunks_sent}=    Send Audio Chunks
    ...    stream_id=${stream_id}
    ...    wav_path=${audio_file_path}
    ...    num_chunks=${num_chunks}

    Log    Sent ${chunks_sent} chunks to stream ${stream_id}
    RETURN    ${chunks_sent}

Close Audio Stream
    [Documentation]    Stop an audio stream and close the connection
    [Arguments]    ${stream_id}

    # Call the Python library method directly
    ${total_chunks}=    Stop Audio Stream    ${stream_id}
    Log    Stopped stream ${stream_id}, total chunks: ${total_chunks}
    RETURN    ${total_chunks}

Cleanup All Audio Streams
    [Documentation]    Stop all active streams (use in teardown)
    Cleanup All Streams

Stream And Wait For Conversation
    [Documentation]    Send audio chunks to stream, wait for conversation to be created and closed.
    ...                Returns the conversation_id of the completed conversation.
    ...                conv_number parameter is informational only (for logging).
    [Arguments]    ${stream_id}    ${audio_file_path}    ${device_name}    ${num_chunks}=100    ${conv_number}=1

    # Get existing conversation IDs before sending audio
    ${jobs_before}=    Get Jobs By Type And Client    open_conversation    ${device_name}
    ${existing_conv_ids}=    Create List
    FOR    ${job}    IN    @{jobs_before}
        ${meta}=    Set Variable    ${job}[meta]
        ${conv_id}=    Evaluate    $meta.get('conversation_id', '')
        IF    $conv_id != ''
            Append To List    ${existing_conv_ids}    ${conv_id}
        END
    END
    Log    Conversation #${conv_number}: Starting with ${existing_conv_ids.__len__()} existing conversations

    # Send audio chunks
    Send Audio Chunks To Stream    ${stream_id}    ${audio_file_path}    num_chunks=${num_chunks}

    # Wait for a NEW conversation job to be created (new conversation_id appears)
    ${conv_job}=    Wait Until Keyword Succeeds    30s    2s
    ...    Wait For New Conversation Job    open_conversation    ${device_name}    ${existing_conv_ids}

    ${conv_meta}=    Set Variable    ${conv_job}[meta]
    ${conversation_id}=    Evaluate    $conv_meta.get('conversation_id', '')
    Log    Conversation #${conv_number} created: ${conversation_id}

    # Wait for conversation to close via inactivity timeout (with queue drain, can take 45+ seconds)
    Wait For Job Status    ${conv_job}[job_id]    completed    timeout=60s    interval=2s
    Log    Conversation #${conv_number} closed: ${conversation_id}

    RETURN    ${conversation_id}

Get Most Recent Job
    [Documentation]    Get the job with the most recent created_at timestamp from a list
    [Arguments]    ${jobs}

    ${most_recent}=    Set Variable    ${None}
    ${most_recent_time}=    Set Variable    ${None}

    FOR    ${job}    IN    @{jobs}
        ${created_at}=    Set Variable    ${job}[created_at]
        IF    $most_recent_time is None or $created_at > $most_recent_time
            ${most_recent}=    Set Variable    ${job}
            ${most_recent_time}=    Set Variable    ${created_at}
        END
    END

    Should Not Be Equal    ${most_recent}    ${None}    No jobs found in list
    Log    Most recent job created at: ${most_recent_time}
    RETURN    ${most_recent}
