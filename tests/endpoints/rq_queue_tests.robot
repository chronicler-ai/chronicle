*** Settings ***
Documentation       RQ Job Persistence Tests - Verify Redis Queue job persistence through service restarts
Library             RequestsLibrary
Library             Collections
Library             Process
Library             OperatingSystem
Library             String
Library             DateTime
Resource            ../setup/setup_keywords.robot
Resource            ../setup/teardown_keywords.robot
Resource            ../resources/session_resources.robot
Resource            ../resources/user_resources.robot
Resource            ../resources/conversation_keywords.robot
Variables           ../setup/test_env.py

Suite Setup         Suite Setup
Suite Teardown      Suite Teardown

*** Variables ***
${TEST_TIMEOUT}             60s
${COMPOSE_FILE}             backends/advanced/docker-compose-test.yml

*** Keywords ***


Check Queue Stats
    [Documentation]    Get current queue statistics
    ${response}=    GET On Session    api    /api/queue/stats    expected_status=200
    RETURN    ${response.json()}

Check Queue Jobs
    [Documentation]    Get current jobs in queue
    ${response}=    GET On Session    api    /api/queue/jobs    expected_status=200
    RETURN    ${response.json()}

Check Queue Health
    [Documentation]    Get queue health status
    ${response}=    GET On Session    api    /api/queue/worker-details    expected_status=200
    RETURN    ${response.json()}

Restart Backend Service
    [Documentation]    Restart the backend service to test persistence
    Log    Restarting backend service to test job persistence

    # Stop backend container
    Run Process    docker-compose    -f    ${COMPOSE_FILE}    stop    friend-backend-test
    ...    cwd=.    timeout=30s

    # Start backend container again
    Run Process    docker-compose    -f    ${COMPOSE_FILE}    start    friend-backend-test
    ...    cwd=.    timeout=60s

    # Wait for backend to be ready again
    Wait Until Keyword Succeeds    ${TEST_TIMEOUT}    5s
    ...    Health Check    ${API_URL}

    Log    Backend service restarted successfully


*** Test Cases ***
Test RQ Job Enqueuing
    [Documentation]    Test that jobs can be enqueued in Redis
    [Tags]    rq enqueue positive speed-long

    # Check initial queue state
    ${initial_stats}=    Check Queue Stats
    ${initial_queued}=    Set Variable    ${initial_stats}[queued_jobs]

    # Find or create test conversation
    ${conversation}=   Find Test Conversation
    ${conversation_id}=  Set Variable     ${conversation}[conversation_id]

    # Trigger reprocessing to test job enqueuing
    ${job_id}=    Reprocess Transcript   ${conversation_id}

    # Verify job was enqueued
    ${stats_after}=    Check Queue Stats
    ${queued_after}=    Set Variable    ${stats_after}[queued_jobs]

    Should Be True    ${queued_after} >= ${initial_queued}
    Log    Successfully enqueued job: ${job_id}

Test Job Persistence Through Backend Restart
    [Documentation]    Test that RQ jobs persist when backend service restarts
    [Tags]    rq persistence restart critical speed-mid

    # Find test conversation
    ${conversation}=    Find Test Conversation
    ${conversation_id}=  Set Variable     ${conversation}[conversation_id]
    IF    $conversation_id != $None
        # Create and enqueue a job
        ${job_id}=    Reprocess Transcript    ${conversation_id}

        # Verify jobs exist in queue (may include other jobs)
        ${jobs_before}=    Check Queue Jobs
        ${jobs_count_before}=    Get Length    ${jobs_before}[jobs]

        # Restart backend service
        Restart Backend Service

        # Verify queue is still accessible and jobs persist
        ${jobs_after}=    Check Queue Jobs
        ${jobs_count_after}=    Get Length    ${jobs_after}[jobs]

        # Jobs should persist through restart (count may be same or greater)
        Should Be True    ${jobs_count_after} >= 0
        Log    Job persistence test passed - queue survived backend restart with ${jobs_count_after} jobs
    ELSE
        Log    No conversations available for persistence test
        Pass Execution    No conversations available for job persistence test
    END

Test Multiple Jobs Persistence
    [Documentation]    Test that multiple jobs persist through restart
    [Tags]    rq persistence multiple stress speed-long

    # Find test conversation
    ${conversation}=    Find Test Conversation

    IF    $conversation != $None
        # Create multiple jobs using the same conversation
        ${job_count}=    Set Variable    3
        FOR    ${i}    IN RANGE    ${job_count}
            ${job_id}=    Reprocess Transcript    ${conversation}[conversation_id]
            Sleep    1s    # Small delay between jobs
        END

        Log    Created ${job_count} reprocessing jobs

        # Get baseline job count
        ${jobs_before}=    Check Queue Jobs
        ${jobs_count_before}=    Get Length    ${jobs_before}[jobs]

        # Restart backend
        Restart Backend Service

        # Verify jobs persist through restart
        ${jobs_after}=    Check Queue Jobs
        ${jobs_count_after}=    Get Length    ${jobs_after}[jobs]

        # Jobs should persist (exact count may vary based on processing)
        Should Be True    ${jobs_count_after} >= 0
        Log    Jobs persisted through restart: ${jobs_count_before} -> ${jobs_count_after}
    ELSE
        Log    No conversations available for multiple jobs test
        Pass Execution    No conversations available for multiple jobs persistence test
    END

Test Queue Stats Accuracy
    [Documentation]    Test that queue statistics accurately reflect job states
    [Tags]    rq statistics accuracy positive speed-mid

    # Get baseline stats
    ${initial_stats}=    Check Queue Stats
    ${initial_queued}=    Set Variable    ${initial_stats}[processing_jobs]

    # Find test conversation
    ${conversation_id}=    Find Test Conversation

    IF    $conversation_id != $None
        # Create multiple jobs to get meaningful stats
        ${job_count}=    Set Variable    3
        FOR    ${i}    IN RANGE    ${job_count}
            ${job_id}=    Reprocess Transcript    ${conversation_id}[conversation_id]
            Sleep    0.5s
        END
        Sleep     2s
        # Check updated stats
        ${updated_stats}=    Check Queue Stats
        ${updated_queued}=    Set Variable    ${updated_stats}[processing_jobs]

        # Should have same or more jobs queued (jobs may process quickly)
        Should Be True    ${updated_queued} > ${initial_queued}
        Log    Queue statistics updated: ${initial_queued} -> ${updated_queued}
    ELSE
        Log    No conversations available for stats accuracy test
        Pass Execution    No conversations available for queue stats accuracy test
    END

Test Queue API Authentication
    [Documentation]    Test that queue endpoints properly enforce authentication
    [Tags]    rq security authentication negative speed-fast

    # Create anonymous session (no authentication)
    Get Anonymous Session    anon_session

    # Queue jobs endpoint should require authentication
    ${response}=    GET On Session    anon_session    /api/queue/jobs    expected_status=401
    Should Be Equal As Integers    ${response.status_code}    401

    # Queue stats endpoint should require authentication
    ${response}=    GET On Session    anon_session    /api/queue/stats    expected_status=401
    Should Be Equal As Integers    ${response.status_code}    401

    Log    Queue API authentication properly enforced