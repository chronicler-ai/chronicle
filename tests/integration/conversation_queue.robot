*** Settings ***
Documentation    Conversation Queue Integration Tests
Library          RequestsLibrary
Library          Collections
Resource         ../setup/setup_keywords.robot
Resource         ../setup/teardown_keywords.robot
Resource         ../resources/session_resources.robot
Resource         ../resources/audio_keywords.robot
Resource         ../resources/conversation_keywords.robot
Resource         ../resources/queue_keywords.robot
Variables        ../setup/test_env.py
Variables        ../setup/test_data.py
Suite Setup      Suite Setup
Test Setup       Clear Test Databases


*** Test Cases ***

Test Upload audio creates transcription job
    [Documentation]    Test that uploading audio creates a transcription job in the queue
    [Tags]    integration queue upload speed-mid
    [Timeout]          120s

    Log    Starting Upload Job Queue Test    INFO

    # Verify queue is empty
    ${initial_job_count}=    Get queue length
    Should Be Equal As Integers    ${initial_job_count}    0

    # Upload audio file to create conversation and trigger transcription job
    ${conversation}=    Upload Audio File   ${TEST_AUDIO_FILE}    ${TEST_DEVICE_NAME}
    ${conversation_id}=    Set Variable    ${conversation}[conversation_id]

    Log    Created conversation: ${conversation_id}    INFO

    # Verify a new job has been added to the queue
    Wait Until Keyword Succeeds    10s    2s    Get queue length
    ${job_count}=    Get queue length
    Should Be True    ${job_count} >= 1    Expected at least 1 job in queue, got ${job_count}

    # Get the list of jobs and find the transcription job for our conversation
    ${jobs}=    Get job queue

    # Find the transcription job for our conversation
    # Note: transcript jobs have job_type "reprocess_transcript" and conversation_id as args[0]
    ${transcription_job}=    Set Variable    None
    FOR    ${job}    IN    @{jobs}
        ${job_type}=    Set Variable    ${job}[job_type]
        # Check if this is a transcript job (job_type contains "transcript")
        ${is_transcript_job}=    Evaluate    "transcribe" in "${job_type}".lower()
        IF    ${is_transcript_job}
            # Get conversation_id from args[0] (first argument to transcript job)
            ${job_conv_id}=    Set Variable    ${job}[meta][conversation_id]
            # Check if conversation_id matches (compare first 8 chars for short IDs)
            ${conv_id_short}=    Evaluate    "${conversation_id}"[:8]
            ${job_conv_id_short}=    Evaluate    "${job_conv_id}"[:8]
            IF    '${conv_id_short}' == '${job_conv_id_short}'
                ${transcription_job}=    Set Variable    ${job}
                Exit For Loop
            END
        END
    END
    Should Not Be Equal    ${transcription_job}    None    Transcription job for conversation ${conversation_id} not found in queue

Test Reprocess Conversation Job Queue
    [Documentation]    Test that reprocess transcript jobs are created and processed correctly
    [Tags]    integration queue reprocess speed-long
    [Timeout]          180s

    Log    Starting Reprocess Job Queue Test    INFO

    # First, create a conversation by uploading audio
    ${conversation}=    Upload Audio File   ${TEST_AUDIO_FILE}    ${TEST_DEVICE_NAME}
    ${conversation_id}=    Set Variable    ${conversation}[conversation_id]

    Log    Created conversation: ${conversation_id}    INFO

    # Wait for initial upload processing to complete (transcription job chain)
    Log    Waiting for initial conversation processing to complete...    INFO
    Sleep    5s    # Give time for initial job chain (transcription -> speaker -> cropping -> memory)

    # Get conversation to verify initial state
    ${initial_conversation}=    Get Conversation By ID    ${conversation_id}
    Dictionary Should Contain Key    ${initial_conversation}    transcript_version_count
    ${initial_version_count}=    Set Variable    ${initial_conversation}[transcript_version_count]
    Log    Initial transcript version count: ${initial_version_count}    INFO

    # Trigger transcript reprocessing
    Log    Triggering transcript reprocessing for conversation ${conversation_id}    INFO
    ${reprocess_data}=    Reprocess Transcript    ${conversation_id}
    ${job_id}=    Set Variable    ${reprocess_data}[job_id]
    ${version_id}=    Set Variable    ${reprocess_data}[version_id]

    # Verify job response structure
    Dictionary Should Contain Key    ${reprocess_data}    job_id
    Dictionary Should Contain Key    ${reprocess_data}    version_id
    Dictionary Should Contain Key    ${reprocess_data}    status
    Should Not Be Equal As Strings    failed    ${reprocess_data}[status]

    Log    Reprocess job created: ${job_id}, version: ${version_id}    INFO

    # Wait for transcription job to complete (first in chain)
    Log    Waiting for transcription job ${job_id} to complete...    INFO
    Wait Until Keyword Succeeds    90s    3s    Job Should Be Complete    ${job_id}

    ${job_details}=    Get Job Details    ${job_id}
    Log    Job details: ${job_details}    INFO

    # Verify job structure
    Dictionary Should Contain Key    ${job_details}    job_id
    Dictionary Should Contain Key    ${job_details}    job_type
    Dictionary Should Contain Key    ${job_details}    status
    Should Be Equal As Strings    ${job_details}[job_id]    ${job_id}
    Should Be Equal As Strings    ${job_details}[job_type]    transcribe_full_audio_job

    # Job should be completed or finished
    Should Be True    '${job_details}[status]' in ['completed', 'finished']    Job status: ${job_details}[status]

    # Wait additional time for full job chain to complete (speaker -> cropping -> memory)
    Log    Waiting for full reprocessing job chain to complete...    INFO
    Sleep    10s

    # Verify conversation was updated with new transcript version
    ${updated_conversation}=    Get Conversation By ID    ${conversation_id}

    # Check that we have more transcript versions than before
    Dictionary Should Contain Key    ${updated_conversation}    transcript_version_count
    ${new_version_count}=    Set Variable    ${updated_conversation}[transcript_version_count]
    Log    New transcript version count: ${new_version_count}    INFO

    Should Be True    ${new_version_count} > ${initial_version_count}    Expected version count to increase from ${initial_version_count} to ${new_version_count}

    # Verify conversation has transcript data
    Dictionary Should Contain Key    ${updated_conversation}    transcript
    ${transcript}=    Set Variable    ${updated_conversation}[transcript]
    Should Not Be Empty    ${transcript}    Expected conversation to have transcript after reprocessing

    # Verify transcript versions array exists and has correct count
    Dictionary Should Contain Key    ${updated_conversation}    transcript_versions
    ${transcript_versions}=    Get Length    ${updated_conversation}[transcript_versions]
    Should Be Equal As Integers    ${transcript_versions}    ${new_version_count}

    Log    Reprocess Job Queue Test Completed Successfully    INFO

*** Keywords ***

Job Should Be Complete
    [Documentation]    Check if job has reached a completed state
    [Arguments]     ${job_id}

    ${job}=    Get Job status    ${job_id}
    ${status}=    Set Variable    ${job}[status]
    Should Be True    '${status}' in ['completed', 'finished', 'failed']    Job status: ${status}
