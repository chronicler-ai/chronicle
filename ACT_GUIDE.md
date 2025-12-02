# Testing GitHub Actions Locally with Act

## Setup Complete ✓

Act is installed and configured. Your `.secrets` file is ready (gitignored).

## Quick Start

### 1. Dry Run (See what would execute)
```bash
act pull_request -W .github/workflows/robot-tests.yml -n --container-architecture linux/amd64
```

### 2. Run Robot Tests Locally (Full GitHub Actions simulation)
```bash
act pull_request -W .github/workflows/robot-tests.yml \
  --secret-file .secrets \
  --container-architecture linux/amd64
```

### 3. Run with Verbose Output
```bash
act pull_request -W .github/workflows/robot-tests.yml \
  --secret-file .secrets \
  --container-architecture linux/amd64 \
  -v
```

### 4. Skip Image Pull (After first run)
```bash
act pull_request -W .github/workflows/robot-tests.yml \
  --secret-file .secrets \
  --container-architecture linux/amd64 \
  --pull=false
```

## Important Notes

- **First run downloads ~20GB Docker image** - be patient
- **M-series Mac**: Always use `--container-architecture linux/amd64`
- **Secrets file**: `.secrets` contains your API keys (gitignored)
- **Resource intensive**: Docker-in-Docker uses significant CPU/RAM
- **Not 100% identical**: Some GitHub-specific features may behave differently

## Editing Secrets

```bash
nano .secrets
```

Format:
```
DEEPGRAM_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
```

## Troubleshooting

### Out of disk space
```bash
# Clean up act containers
docker system prune -a
```

### Workflow fails differently than GitHub
- Act uses different runner images
- Some GitHub Actions may not be fully compatible
- Check act logs vs GitHub Actions logs

### Kill running act job
```bash
# Ctrl+C or:
docker ps | grep act | awk '{print $1}' | xargs docker kill
```

## Why Use Act?

- Test workflows without pushing to GitHub
- Faster iteration during workflow development
- Debug CI-specific issues locally
- Save GitHub Actions minutes

