#!/usr/bin/env python3
"""
Generate Kubernetes configuration files (ConfigMap and Secret)
"""

import os
import sys
from pathlib import Path

# Add lib directory to path
sys.path.append(str(Path(__file__).parent / 'lib'))

from env_utils import get_resolved_env_vars, classify_secrets

def split_secrets(secret_vars: dict) -> tuple[dict, dict]:
    """Split secrets into environment credentials and API keys"""
    # Environment-specific credentials
    env_credential_keys = {
        'AUTH_SECRET_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD',
        'NEO4J_PASSWORD', 'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'REDIS_PASSWORD',
        'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'NGROK_AUTHTOKEN',
        'SSL_CERT_SECRET'
    }

    # API keys for external services
    api_key_keys = {
        'OPENAI_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY',
        'DEEPGRAM_API_KEY', 'HF_TOKEN'
    }

    env_credentials = {}
    api_keys = {}

    for var_name, var_value in secret_vars.items():
        if var_name in env_credential_keys:
            env_credentials[var_name] = var_value
        elif var_name in api_key_keys:
            api_keys[var_name] = var_value
        else:
            # Default: treat unknown secrets as environment credentials
            env_credentials[var_name] = var_value

    return env_credentials, api_keys

def generate_k8s_manifests(namespace: str = "friend-lite"):
    """Generate Kubernetes ConfigMap and Secret manifests"""
    print(f"Generating Kubernetes ConfigMap and Secret for namespace {namespace}...")

    # Create output directory
    output_dir = Path("k8s-manifests")
    output_dir.mkdir(exist_ok=True)

    # Get all resolved environment variables
    all_vars = get_resolved_env_vars()
    config_vars, secret_vars = classify_secrets(all_vars)

    # Split secrets into environment credentials and API keys
    env_credentials, api_keys = split_secrets(secret_vars)

    # Generate ConfigMap
    configmap_path = output_dir / "configmap.yaml"
    with open(configmap_path, 'w') as f:
        f.write("apiVersion: v1\n")
        f.write("kind: ConfigMap\n")
        f.write("metadata:\n")
        f.write(f"  name: friend-lite-config\n")
        f.write(f"  namespace: {namespace}\n")
        f.write("  labels:\n")
        f.write("    app.kubernetes.io/name: friend-lite\n")
        f.write("    app.kubernetes.io/component: config\n")
        f.write("data:\n")

        for var_name in sorted(config_vars.keys()):
            var_value = config_vars[var_name]
            # Escape quotes in values
            escaped_value = var_value.replace('"', '\\"')
            f.write(f'  {var_name}: "{escaped_value}"\n')

    # Generate Secrets
    import base64
    secret_path = output_dir / "secrets.yaml"
    with open(secret_path, 'w') as f:
        # Environment-specific credentials secret
        f.write("# Environment-specific credentials\n")
        f.write("apiVersion: v1\n")
        f.write("kind: Secret\n")
        f.write("type: Opaque\n")
        f.write("metadata:\n")
        f.write(f"  name: friend-lite-secrets\n")
        f.write(f"  namespace: {namespace}\n")
        f.write("  labels:\n")
        f.write("    app.kubernetes.io/name: friend-lite\n")
        f.write("    app.kubernetes.io/component: secrets\n")
        f.write("data:\n")

        for var_name in sorted(env_credentials.keys()):
            var_value = env_credentials[var_name]
            encoded_value = base64.b64encode(var_value.encode()).decode()
            f.write(f"  {var_name}: {encoded_value}\n")

        # API keys secret
        f.write("---\n")
        f.write("# API keys for external services\n")
        f.write("apiVersion: v1\n")
        f.write("kind: Secret\n")
        f.write("type: Opaque\n")
        f.write("metadata:\n")
        f.write(f"  name: friend-lite-api-keys\n")
        f.write(f"  namespace: {namespace}\n")
        f.write("  labels:\n")
        f.write("    app.kubernetes.io/name: friend-lite\n")
        f.write("    app.kubernetes.io/component: secrets\n")
        f.write("data:\n")

        for var_name in sorted(api_keys.keys()):
            var_value = api_keys[var_name]
            encoded_value = base64.b64encode(var_value.encode()).decode()
            f.write(f"  {var_name}: {encoded_value}\n")

    print("Generated:")
    print(f"  - {configmap_path}")
    print(f"  - {secret_path} (2 secrets: friend-lite-secrets, friend-lite-api-keys)")
    print("")
    print("To apply these manifests:")
    print(f"  kubectl apply -f {configmap_path}")
    print(f"  kubectl apply -f {secret_path}")

def main():
    """Main entry point"""
    namespace = sys.argv[1] if len(sys.argv) > 1 else "friend-lite"
    generate_k8s_manifests(namespace)

if __name__ == "__main__":
    main()