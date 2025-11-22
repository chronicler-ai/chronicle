*** Settings ***
Documentation    Debug Pipeline Step by Step
Resource         ../setup/setup_keywords.robot
Resource         ../setup/teardown_keywords.robot
Suite Setup      Suite Setup
Suite Teardown   Suite Teardown 

*** Test Cases ***

Test server connection
    [Documentation]    Test connection to the server
    [Tags]    debug connection todo speed-fast

    Log    Testing server connection    INFO
    Fail    Test not written yet - placeholder test

Login to server
    [Documentation]    Test logging in to the server from mobile client
    [Tags]    speed-fast
    Log    Logging in to server    INFO
    Fail    Test not written yet - placeholder test

Scan bluetooth devices
    [Documentation]    Scan for available bluetooth devices
    [Tags]    speed-fast
    Log    Scanning bluetooth devices    INFO
    Fail    Test not written yet - placeholder test

Filter devices by omi
    [Documentation]    Filter scanned devices by omi
    [Tags]    speed-fast
    Log    Filtering devices by omi    INFO
    Fail    Test not written yet - placeholder test

Connect to bluetooth device
    [Documentation]    Connect to a bluetooth device
    [Tags]    speed-fast
    Log    Connecting to bluetooth device    INFO
    Fail    Test not written yet - placeholder test

Get device codec
    [Documentation]    Get the codec information from the device
    [Tags]    speed-fast
    Log    Getting device codec    INFO
    Fail    Test not written yet - placeholder test

Get device battery level
    [Documentation]    Get the battery level from the device
    [Tags]    speed-fast
    Log    Getting device battery level    INFO
    Fail    Test not written yet - placeholder test

Start audio stream
    [Documentation]    Start streaming audio from the device
    [Tags]    speed-fast
    Log    Starting audio stream    INFO
    Fail    Test not written yet - placeholder test
