import os
import io
import tempfile
from typing import List
from starlette.datastructures import UploadFile as StarletteUploadFile
from googleapiclient.http import MediaIoBaseDownload
from advanced_omi_backend.app_config import get_app_config

AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg")
FOLDER_MIMETYPE = "application/vnd.google-apps.folder"


class AudioValidationError(Exception):
    pass


# -------------------------------------------------------------
# DOWNLOAD A SINGLE FILE (OAUTH)
# -------------------------------------------------------------
async def download_and_wrap_drive_file(service, file_item):
    file_id = file_item["id"]
    name = file_item["name"]

    request = service.files().get_media(fileId=file_id)

    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    content = fh.getvalue()

    if not content:
        raise AudioValidationError(f"Downloaded Google Drive file '{name}' was empty")

    tmp_file = tempfile.NamedTemporaryFile(delete=False)
    tmp_file.write(content)
    tmp_file.flush()

    # Wrap in Starlette UploadFile to mimic standard uploads
    return StarletteUploadFile(
        filename=name,
        file=open(tmp_file.name, "rb"),
    )


# -------------------------------------------------------------
# LIST + DOWNLOAD FILES IN FOLDER (OAUTH)
# -------------------------------------------------------------
async def download_audio_files_from_drive(folder_id: str) -> List[StarletteUploadFile]:
    if not folder_id:
        raise AudioValidationError("Google Drive folder ID is required.")

    service = get_app_config().get_gdrive_service()

    try:
        query = f"'{folder_id}' in parents and trashed = false"

        response = service.files().list(
            q=query,
            fields="files(id, name, mimeType)",
            includeItemsFromAllDrives=False,
            supportsAllDrives=False,
        ).execute()

        all_files = response.get("files", [])

        audio_files = [
            f for f in all_files
            if f["name"].lower().endswith(AUDIO_EXTENSIONS)
        ]

        if not audio_files:
            raise AudioValidationError("No audio files found in folder.")

        wrapped_files = []
        for item in audio_files:
            wrapped_files.append(await download_and_wrap_drive_file(service, item))

        return wrapped_files

    except Exception as e:
        if isinstance(e, AudioValidationError):
            raise
        raise AudioValidationError(f"Google Drive API Error: {repr(e)}")
