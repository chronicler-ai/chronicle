# Robot Framework Test Tags Reference

This document defines the standard tags used across the Friend-Lite test suite.

## Simplified Tag Set

Friend-Lite uses a **minimal, focused tag set** for test organization. Only 11 tags are permitted.

## Tag Format

**IMPORTANT**: Tags must be **tab-separated**, not space-separated.

```robot
# Correct - tabs between tags
[Tags]    permissions	conversation

# Incorrect - spaces between tags
[Tags]    permissions conversation
```

## Approved Tags

### Core Component Tags

**`permissions`** - Authentication, authorization, access control, user management
- User login/logout
- Admin operations
- Role-based access control
- Data isolation between users
- Security tests

**`conversation`** - Conversation management and transcription
- Conversation CRUD operations
- Transcript processing and versioning
- Speaker diarization
- Conversation metadata

**`memory`** - Memory extraction, storage, and retrieval
- Memory creation from conversations
- Semantic search
- Memory versioning
- Memory reprocessing

**`chat`** - Chat service and sessions
- Chat session management
- Message handling
- Chat history
- Chat statistics

**`queue`** - Job queue management and monitoring
- RQ worker status
- Job tracking
- Queue health
- Background task processing

**`health`** - System health and readiness checks
- Health endpoints
- Service status
- Readiness probes
- System metrics

**`infra`** - Infrastructure and system-level operations
- Service configuration
- System administration
- Client management
- General system operations

### Audio Processing Tags

**`audio-upload`** - Audio file upload and batch processing
- File upload endpoints
- Batch audio processing
- Audio file CRUD operations

**`audio-batch`** - Batch audio processing operations
- Multiple file processing
- Batch job management

**`audio-streaming`** - Real-time audio streaming
- WebSocket audio streaming
- Real-time transcription
- Live audio processing

### Integration Tags

**`e2e`** - End-to-end integration tests
- Multi-component workflows
- Full pipeline testing
- Cross-service integration

## Tag Usage Guidelines

### Single Tag per Test (Preferred)

Most tests should have **one primary tag** indicating the main component being tested:

```robot
# Authentication test
[Tags]    permissions

# Memory search test
[Tags]    memory

# WebSocket streaming test
[Tags]    audio-streaming
```

### Multiple Tags (When Necessary)

Use 2-3 tags only when testing interactions between components:

```robot
# Conversation creates memories
[Tags]    conversation	memory

# Admin managing queues
[Tags]    permissions	queue

# E2E audio upload to memory
[Tags]    e2e	audio-upload	memory
```

### Tag Selection Decision Tree

1. **Is it about users/auth/security?** → `permissions`
2. **Is it about audio upload/files?** → `audio-upload`
3. **Is it about WebSocket/streaming?** → `audio-streaming`
4. **Is it about conversations?** → `conversation`
5. **Is it about memories?** → `memory`
6. **Is it about chat?** → `chat`
7. **Is it about queues/jobs?** → `queue`
8. **Is it about health checks?** → `health`
9. **Is it end-to-end?** → `e2e`
10. **Is it infrastructure/config?** → `infra`

### Examples

```robot
# Good - Clear single tag
[Tags]    permissions
[Tags]    conversation
[Tags]    memory

# Good - Component interaction
[Tags]    conversation	memory
[Tags]    permissions	queue

# Good - E2E with components
[Tags]    e2e	audio-streaming	conversation

# Bad - Too many tags
[Tags]    permissions	conversation	memory	queue	health

# Bad - Use infra instead
[Tags]    configuration
[Tags]    system-admin

# Bad - Non-existent tags
[Tags]    negative
[Tags]    positive
[Tags]    security  # Use 'permissions' instead
```

## Prohibited Tags

**DO NOT create or use any tags other than the 11 approved tags above.**

Commonly misused tags that should NOT be used:
- ❌ `positive`, `negative` - Test outcome is in the results, not tags
- ❌ `security`, `auth`, `admin`, `user` - Use `permissions` instead
- ❌ `websocket`, `streaming` - Use `audio-streaming` instead
- ❌ `upload`, `crud` - Use `audio-upload` instead
- ❌ `integration` - Use `e2e` instead
- ❌ `system`, `config`, `service` - Use `infra` instead
- ❌ `rq`, `jobs`, `worker` - Use `queue` instead
- ❌ Any other tags not in the approved list above

## Running Tests by Tag

```bash
# Run all permission tests
robot --include permissions tests/

# Run conversation and memory tests
robot --include conversationORmemory tests/

# Run only E2E tests
robot --include e2e tests/

# Run everything except E2E
robot --exclude e2e tests/

# Run audio-related tests
robot --include audio-upload --include audio-streaming tests/
```

## Updating Tags

### Before Adding a New Tag

**STOP!** Ask yourself:
1. Can I use one of the existing 11 tags?
2. Is this tag really necessary for test organization?
3. Have I checked with the team?

**New tags require team approval and must be added to this document first.**

### Changing Existing Tags

When updating tags across test files:
1. Update all affected test files
2. Update this document (tags.md)
3. Update TESTING_GUIDELINES.md if rules changed
4. Document the change in the commit message

## Tag Statistics

Current distribution (approximate):
- `permissions`: 38 tests
- `infra`: 18 tests
- `chat`: 14 tests
- `queue`: 18 tests
- `e2e`: 14 tests
- `conversation`: 12 tests
- `memory`: 11 tests
- `health`: 9 tests
- `audio-streaming`: 4 tests
- `audio-upload`: 3 tests
- `audio-batch`: 0 tests (reserved for future use)

---

**Last Updated:** 2025-01-23
**Total Approved Tags:** 11
**Enforcement:** Mandatory - no exceptions
