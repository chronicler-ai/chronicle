*** Settings ***
Documentation    Audio Keywords
Library          RequestsLibrary
Library          Collections
Library          OperatingSystem
Variables        ../setup/test_data.py
Resource         session_keywords.robot
Resource         conversation_keywords.robot
Resource         queue_keywords.robot

*** Keywords ***
Upload Audio File
      [Documentation]    Upload audio file using session with proper multipart form data
      [Arguments]    ${audio_file_path}    ${device_name}=robot-test    ${folder}=.

      # Verify file exists
      File Should Exist    ${audio_file_path}

      # Debug the request being sent
      
      Log    Sending file: ${audio_file_path}
      Log    Device name: ${device_name}
      Log    Folder: ${folder}

      # Create proper file upload using Python expressions to actually open the file
      Log    Files dictionary will contain: files -> ${audio_file_path}
      Log    Data dictionary will contain: device_name -> ${device_name}

    #   # Build params dict with optional folder parameter
          ${response}=       POST On Session    api    /api/audio/upload
          ...                files=${{ {'files': open('${audio_file_path}', 'rb')} }}
          ...                params=device_name=${device_name}&folder=${folder}
          ...                expected_status=any

      # Detailed debugging of the response
      Log    Upload response status: ${response.status_code}
      Log    Upload response headers: ${response.headers}
      Log    Upload response content type: ${response.headers.get('content-type', 'not set')}
      Log    Upload response text length: ${response.text.__len__()}
      Log    Upload response raw text: ${response.text}

      # Parse JSON response to dictionary
      ${upload_response}=    Set Variable    ${response.json()}
      Log    Parsed upload response: ${upload_response}

      # Validate upload was successful
      Should Be Equal As Strings    ${upload_response['summary']['processing']}    1    Upload failed: No files enqueued
      Should Be Equal As Strings    ${upload_response['files'][0]['status']}    processing    Upload failed: ${response.text}

      # Extract important values
      ${audio_uuid}=    Set Variable    ${upload_response['files'][0]['audio_uuid']}
      ${job_id}=        Set Variable    ${upload_response['files'][0]['conversation_id']}
      ${transcript_job_id}=    Set Variable    ${upload_response['files'][0]['transcript_job_id']}
      Log    Audio UUID: ${audio_uuid}
      Log    Conversation ID: ${job_id}
      Log    Transcript Job ID: ${transcript_job_id}

      # Wait for conversation to be created and transcribed
      Log    Waiting for transcription to complete...

      Wait Until Keyword Succeeds    60s    5s       Check job status   ${transcript_job_id}    completed
      ${job}=    Get Job Details    ${transcript_job_id}

     # Get the completed conversation
      ${conversation}=     Get Conversation By ID    ${job}[result][conversation_id]
      Should Not Be Equal    ${conversation}    ${None}    Conversation not found after upload and processing

      Log    Found conversation: ${conversation}
      RETURN    ${conversation}


Get Cropped Audio Info
    [Documentation]    Get cropped audio information for a conversation
    [Arguments]     ${audio_uuid}

    ${response}=    GET On Session    api    /api/conversations/${audio_uuid}/cropped    headers=${headers}
    RETURN    ${response.json()}[cropped_audios]    
