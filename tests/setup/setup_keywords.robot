*** Settings ***
Documentation    Flexible setup keywords for test environments
...
...              DEFAULT MODE: Dev mode - keeps containers running for fast iteration
...
...              This file provides two primary modes:
...              - Dev Mode (default): Reuse containers, clear data only (~5s)
...              - Prod Mode: Complete teardown and rebuild (for CI/CD)
...
...              Control via environment variables:
...              - TEST_MODE: 'dev' (default) or 'prod' (CI/CD mode)
...              - REBUILD: Force container rebuild (dev mode only)
...
...              Quick usage:
...              - robot tests/                    # Dev mode (fast, keep containers)
...              - TEST_MODE=prod robot tests/     # Prod mode (CI/CD, fresh env)
Library          RequestsLibrary
Library          Collections
Library          OperatingSystem
Library          String
Library          Process
Library          DateTime
Variables        test_env.py
Resource         ../resources/session_resources.robot


*** Keywords ***

Suite Setup
    [Documentation]    Flexible setup based on TEST_MODE environment variable
    ...                DEFAULT: dev mode (keep containers running)
    ...                TEST_MODE=prod for CI/CD (fresh environment)

    # Get test mode (default: dev)
    ${test_mode}=    Get Environment Variable    TEST_MODE    default=dev
    ${rebuild}=      Get Environment Variable    REBUILD      default=false

    # Handle different startup modes
    Run Keyword If    '${test_mode}' == 'prod'     Prod Mode Setup
    ...    ELSE IF    '${rebuild}' == 'true'       Dev Mode Setup With Rebuild
    ...    ELSE                                     Dev Mode Setup

    # Create admin session for all tests
    Create API Session    api

Dev Mode Setup
    [Documentation]    Default development mode - reuse containers, clear data only (fastest)
    Log To Console    \n=== Dev Mode Setup (Default) ===

    ${is_up}=    Run Keyword And Return Status    Readiness Check    ${API_URL}

    IF    ${is_up}
        Log To Console    ✓ Reusing existing containers (fast mode)
        Clear Test Databases
    ELSE
        Log To Console    ⚠ Containers not running, starting them...
        Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    up    -d    shell=True

        Log To Console    Waiting for services to be ready...
        Wait Until Keyword Succeeds    60s    5s    Readiness Check    ${API_URL}
        Clear Test Databases
    END

    Log To Console    ✓ Dev environment ready!

Dev Mode Setup With Rebuild
    [Documentation]    Dev mode with forced rebuild (after code changes)
    Log To Console    \n=== Dev Mode Setup (with rebuild) ===
    Log To Console    Rebuilding containers with latest code...

    Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    up    -d    --build    shell=True

    Log To Console    Waiting for services to be ready...
    Wait Until Keyword Succeeds    60s    5s    Readiness Check    ${API_URL}

    Log To Console    Clearing test data...
    Clear Test Databases
    Log To Console    ✓ Dev environment ready!

Prod Mode Setup
    [Documentation]    Production/CI mode - complete teardown and rebuild (clean slate)
    Log To Console    \n=== Prod Mode Setup (CI/CD) ===
    Log To Console    Tearing down existing containers and volumes...

    Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    down    -v    shell=True
    Run Process    rm    -rf    backends/advanced/data/test_mongo_data    shell=True
    Run Process    rm    -rf    backends/advanced/data/test_qdrant_data    shell=True
    Run Process    rm    -rf    backends/advanced/data/test_audio_chunks    shell=True

    Log To Console    Building and starting fresh containers...
    Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    up    -d    --build    shell=True

    Log To Console    Waiting for services to be ready...
    Wait Until Keyword Succeeds    60s    5s    Readiness Check    ${API_URL}
    Log To Console    ✓ Prod environment ready!

# Legacy keywords for backward compatibility
Fresh Environment Setup
    [Documentation]    DEPRECATED: Use 'Prod Mode Setup' instead
    Prod Mode Setup

Rebuild Environment Setup
    [Documentation]    DEPRECATED: Use 'Dev Mode Setup With Rebuild' instead
    Dev Mode Setup With Rebuild

Fast Development Setup
    [Documentation]    DEPRECATED: Use 'Dev Mode Setup' instead
    Dev Mode Setup

Start advanced-server
    [Documentation]    Start the server using docker-compose (legacy compatibility)
    ${is_up}=    Run Keyword And Return Status    Readiness Check    ${API_URL}
    IF    ${is_up}
        Log    advanced-server is already running
        RETURN
    ELSE
        Log    Starting advanced-server
        Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    up    -d    --build    shell=True
        Log    Waiting for services to start...
        Wait Until Keyword Succeeds    60s    5s    Readiness Check    ${API_URL}
        Log    Services are ready
    END

Stop advanced-server
    [Documentation]    Stop the server using docker-compose (legacy compatibility)
    Run Process    docker-compose    -f    backends/advanced/docker-compose-test.yml    down    shell=True

Start speaker-recognition-service
    [Documentation]    Start the speaker recognition service using docker-compose
    ${is_up}=    Run Keyword And Return Status    Readiness Check    ${SPEAKER_RECOGNITION_URL}
    IF    ${is_up}
        Log    speaker-recognition-service is already running
        RETURN
    ELSE
        Log    Starting speaker-recognition-service
        Run Process    docker-compose    -f    extras/speaker-recognition/docker-compose-test.yml    up    -d    --build    shell=True
        Log    Waiting for speaker recognition service to start...
        Wait Until Keyword Succeeds    60s    5s    Readiness Check    ${SPEAKER_RECOGNITION_URL}
        Log    Speaker recognition service is ready
    END

Readiness Check
    [Documentation]    Verify that the readiness endpoint is accessible
    [Tags]             health    api
    [Arguments]        ${base_url}=${API_URL}

    ${response}=    GET    ${base_url}/readiness    expected_status=200
    Should Be Equal As Integers    ${response.status_code}    200
    RETURN    ${True}

Health Check
    [Documentation]    Verify that the health endpoint is accessible
    [Tags]             health    api
    [Arguments]        ${base_url}=${API_URL}

    ${response}=    GET    ${base_url}/health    expected_status=200
    Should Be Equal As Integers    ${response.status_code}    200
    RETURN    ${True}

Clear Test Databases
    [Documentation]    Quickly clear test databases and audio files without restarting containers (preserves admin user)
    Log To Console    Clearing test databases and audio files...

    # Clear MongoDB collections but preserve admin user
    # Note: Removed shell=True to avoid shell interpretation of curly braces
    Run Process    docker    exec    advanced-mongo-test-1    mongosh    test_db    --eval    db.users.deleteMany({'email': {$$ne:'${ADMIN_EMAIL}'}})
    Run Process    docker    exec    advanced-mongo-test-1    mongosh    test_db    --eval    db.conversations.deleteMany({})
    Run Process    docker    exec    advanced-mongo-test-1    mongosh    test_db    --eval    db.audio_chunks.deleteMany({})
    # Clear admin user's registered_clients array to prevent client_id counter increments
    Run Process    docker    exec    advanced-mongo-test-1    mongosh    test_db    --eval    db.users.updateOne({'email':'${ADMIN_EMAIL}'}, {$$set: {'registered_clients': []}})
    Log To Console    MongoDB collections cleared (except admin user)

    # Clear Qdrant collections
    Run Process    curl    -s    -X    DELETE    http://localhost:6337/collections/memories    shell=True
    Run Process    curl    -s    -X    DELETE    http://localhost:6337/collections/conversations    shell=True
    Log To Console    Qdrant collections cleared

    # Clear audio files from mounted volumes
    Run Process    rm    -rf    ${EXECDIR}/backends/advanced/data/test_audio_chunks/*    shell=True
    Run Process    rm    -rf    ${EXECDIR}/backends/advanced/data/test_debug_dir/*    shell=True
    # Also clear any files inside the container (in case of different mount paths)
    Run Process    docker    exec    advanced-friend-backend-test-1    find    /app/audio_chunks    -name    *.wav    -delete    shell=True
    Run Process    docker    exec    advanced-friend-backend-test-1    find    /app/debug_dir    -name    *    -type    f    -delete    shell=True
    Log To Console    Audio files and debug files cleared

    # Clear Redis queues and job registries
    Run Process    docker    exec    advanced-redis-test-1    redis-cli    FLUSHALL    shell=True
    Log To Console    Redis queues and job registries cleared

Reset Data Without Restart
    [Documentation]    Ultra-fast reset for rapid iteration (alias for Clear Test Databases)
    Clear Test Databases

Get Random ID
    [Documentation]    Generate a unique random ID for test data (call each time for new ID)
    ${random_id}=    Generate Random String    8    [LETTERS][NUMBERS]
    RETURN    ${random_id}

Check Environment Variables
    [Documentation]    Check required environment variables and return missing ones
    [Arguments]    @{required_vars}

    @{missing_vars}=    Create List
    FOR    ${var}    IN    @{required_vars}
        ${value}=    Get Environment Variable    ${var}    ${EMPTY}
        IF    '${value}' == '${EMPTY}'
            Append To List    ${missing_vars}    ${var}
        ELSE
            Log    Environment variable ${var} is set    DEBUG
        END
    END
    RETURN    ${missing_vars}

Log Test Phase
    [Documentation]    Log the current test phase with timing
    [Arguments]    ${phase_name}

    ${timestamp}=    Get Current Date    result_format=%Y-%m-%d %H:%M:%S
    Log    === PHASE: ${phase_name} (${timestamp}) ===    INFO
