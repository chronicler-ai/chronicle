*** Settings ***
Documentation    Health check and service readiness verification keywords
...
...              This file contains keywords for checking service health and readiness.
...              Keywords in this file handle API endpoint health checks and service status verification.
...
...              Keywords in this file handle:
...              - Health endpoint checks
...              - Readiness endpoint checks
...              - Service availability verification
...
...              Keywords that should NOT be in this file:
...              - Docker service management (belong in setup_env_keywords.robot)
...              - Data management (belong in test_manager_keywords.robot)
...              - User/session management (belong in respective resource files)
Library          RequestsLibrary
Variables        ../setup/test_env.py


*** Keywords ***

Readiness Check
    [Documentation]    Verify that the readiness endpoint is accessible and returns 200
    [Tags]             health    api
    [Arguments]        ${base_url}=${API_URL}

    ${response}=    GET    ${base_url}/readiness    expected_status=200    timeout=2
    Should Be Equal As Integers    ${response.status_code}    200
    RETURN    ${True}

Health Check
    [Documentation]    Verify that the health endpoint is accessible and returns 200
    [Tags]             health    api
    [Arguments]        ${base_url}=${API_URL}

    ${response}=    GET    ${base_url}/health    expected_status=200    timeout=2
    Should Be Equal As Integers    ${response.status_code}    200
    RETURN    ${True}
