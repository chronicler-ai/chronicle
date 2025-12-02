*** Settings ***
Documentation    WebSocket audio streaming keywords using the shared AudioStreamClient
Library          Collections
Library          OperatingSystem
Library          ../libs/audio_stream_library.py
Variables        ../setup/test_env.py
Resource         session_keywords.robot
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
    [Arguments]    ${stream_id}    ${audio_file_path}    ${num_chunks}=${None}    ${realtime_pacing}=False

    File Should Exist    ${audio_file_path}

    # Call the Python library method directly
    ${chunks_sent}=    Send Audio Chunks
    ...    stream_id=${stream_id}
    ...    wav_path=${audio_file_path}
    ...    num_chunks=${num_chunks}
    ...    realtime_pacing=${realtime_pacing}

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
    ...                Works correctly even with existing conversations by tracking new conversation creation.
    [Arguments]    ${stream_id}    ${audio_file_path}    ${device_name}    ${num_chunks}=100

    # Get baseline conversation IDs before streaming to detect new conversation
    ${baseline_jobs}=    Get Jobs By Type And Client    open_conversation    ${device_name}
    ${existing_conv_ids}=    Create List
    FOR    ${job}    IN    @{baseline_jobs}
        ${meta}=    Set Variable    ${job}[meta]
        ${conv_id}=    Evaluate    $meta.get('conversation_id', '')
        IF    '${conv_id}' != ''
            Append To List    ${existing_conv_ids}    ${conv_id}
        END
    END
    Log    Baseline conversation IDs: ${existing_conv_ids}

    # Send audio chunks
    Send Audio Chunks To Stream    ${stream_id}    ${audio_file_path}    num_chunks=${num_chunks}

    # Wait for NEW conversation job to be created (not in baseline)
    ${new_job}=    Wait Until Keyword Succeeds    60s    3s
    ...    Wait For New Conversation Job    open_conversation    ${device_name}    ${existing_conv_ids}

    ${conv_meta}=    Set Variable    ${new_job}[meta]
    ${conversation_id}=    Evaluate    $conv_meta.get('conversation_id', '')
    Log    New conversation created: ${conversation_id}

    # Wait for conversation to close via inactivity timeout (with queue drain, can take 45+ seconds)
    Wait For Job Status    ${new_job}[job_id]    completed    timeout=60s    interval=2s
    Log    Conversation closed: ${conversation_id}

    RETURN    ${conversation_id}
