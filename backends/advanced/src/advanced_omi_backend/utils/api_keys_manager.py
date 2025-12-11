"""
API Keys Manager - Handle reading/writing API keys from file and database.
"""

import logging
import os
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def mask_api_key(key: Optional[str]) -> Optional[str]:
    """
    Mask an API key for display purposes.

    Shows first 7 chars and last 4 chars, masks the middle.
    Example: sk-1234567890abcdef -> sk-1234***cdef
    """
    if not key or len(key) < 12:
        return None

    return f"{key[:7]}****{key[-4:]}"


def read_api_keys_from_file(file_path: str = ".env.api-keys") -> Dict[str, Optional[str]]:
    """
    Read API keys from .env.api-keys file.

    Returns:
        Dictionary of API key values (not masked)
    """
    keys = {
        "openai_api_key": None,
        "deepgram_api_key": None,
        "mistral_api_key": None,
        "hf_token": None,
        "langfuse_public_key": None,
        "langfuse_secret_key": None,
        "ngrok_authtoken": None,
    }

    # Check if file exists
    if not os.path.exists(file_path):
        logger.warning(f"API keys file not found: {file_path}")
        return keys

    try:
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue

                # Parse key=value
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()

                    # Map env var names to our field names
                    if key == "OPENAI_API_KEY" and value:
                        keys["openai_api_key"] = value
                    elif key == "DEEPGRAM_API_KEY" and value:
                        keys["deepgram_api_key"] = value
                    elif key == "MISTRAL_API_KEY" and value:
                        keys["mistral_api_key"] = value
                    elif key == "HF_TOKEN" and value:
                        keys["hf_token"] = value
                    elif key == "LANGFUSE_PUBLIC_KEY" and value:
                        keys["langfuse_public_key"] = value
                    elif key == "LANGFUSE_SECRET_KEY" and value:
                        keys["langfuse_secret_key"] = value
                    elif key == "NGROK_AUTHTOKEN" and value:
                        keys["ngrok_authtoken"] = value

        logger.info(f"Loaded API keys from {file_path}")
        return keys

    except Exception as e:
        logger.error(f"Error reading API keys file: {e}")
        return keys


def write_api_keys_to_file(keys: Dict[str, Optional[str]], file_path: str = ".env.api-keys") -> bool:
    """
    Write API keys to .env.api-keys file.

    Args:
        keys: Dictionary of API key values
        file_path: Path to the .env.api-keys file

    Returns:
        True if successful, False otherwise
    """
    try:
        # Read template for structure/comments
        template_path = f"{file_path}.template"
        template_lines = []

        if os.path.exists(template_path):
            with open(template_path, 'r') as f:
                template_lines = f.readlines()

        # Build output content
        output_lines = []

        if template_lines:
            # Use template structure
            for line in template_lines:
                stripped = line.strip()

                # Keep comments and empty lines
                if not stripped or stripped.startswith('#'):
                    output_lines.append(line)
                    continue

                # Parse key=value from template
                if '=' in stripped:
                    key_name = stripped.split('=', 1)[0].strip()

                    # Replace with actual values if provided
                    if key_name == "OPENAI_API_KEY":
                        value = keys.get("openai_api_key", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "DEEPGRAM_API_KEY":
                        value = keys.get("deepgram_api_key", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "MISTRAL_API_KEY":
                        value = keys.get("mistral_api_key", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "HF_TOKEN":
                        value = keys.get("hf_token", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "LANGFUSE_PUBLIC_KEY":
                        value = keys.get("langfuse_public_key", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "LANGFUSE_SECRET_KEY":
                        value = keys.get("langfuse_secret_key", "")
                        output_lines.append(f"{key_name}={value}\n")
                    elif key_name == "NGROK_AUTHTOKEN":
                        value = keys.get("ngrok_authtoken", "")
                        output_lines.append(f"{key_name}={value}\n")
                    else:
                        # Keep other keys from template unchanged
                        output_lines.append(line)
        else:
            # No template - create simple format
            output_lines.append("# API Keys\n\n")
            output_lines.append(f"OPENAI_API_KEY={keys.get('openai_api_key', '')}\n")
            output_lines.append(f"DEEPGRAM_API_KEY={keys.get('deepgram_api_key', '')}\n")
            output_lines.append(f"MISTRAL_API_KEY={keys.get('mistral_api_key', '')}\n")
            output_lines.append(f"HF_TOKEN={keys.get('hf_token', '')}\n")
            output_lines.append(f"LANGFUSE_PUBLIC_KEY={keys.get('langfuse_public_key', '')}\n")
            output_lines.append(f"LANGFUSE_SECRET_KEY={keys.get('langfuse_secret_key', '')}\n")
            output_lines.append(f"NGROK_AUTHTOKEN={keys.get('ngrok_authtoken', '')}\n")

        # Write to file
        with open(file_path, 'w') as f:
            f.writelines(output_lines)

        logger.info(f"Wrote API keys to {file_path}")
        return True

    except Exception as e:
        logger.error(f"Error writing API keys file: {e}")
        return False
