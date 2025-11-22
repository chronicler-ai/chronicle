# Test Scripts

Utility scripts for managing and analyzing Robot Framework tests.

## Scripts

### tag_tests_by_speed.py

Automatically tags Robot Framework tests with speed categories based on execution time:

- `speed-fast`: Tests that complete in < 2 seconds
- `speed-mid`: Tests that take 2-10 seconds
- `speed-long`: Tests that take > 10 seconds

**Usage:**
```bash
# Tag tests based on last run
python3 scripts/tag_tests_by_speed.py results/output.xml

# Or use the Makefile shortcut
make tag-tests
```

**How it works:**
1. Parses `output.xml` to extract actual test execution times
2. Categorizes each test by speed
3. Updates robot files with appropriate speed tags

### analyze_test_speeds.py

Analyzes test execution times and provides a breakdown by speed category.

**Usage:**
```bash
# Analyze test speeds from last run
python3 scripts/analyze_test_speeds.py results/output.xml

# Or use the Makefile shortcut
make analyze
```

**Output:**
- Lists all tests sorted by execution time
- Shows breakdown by speed category (fast/mid/long)
- Identifies the slowest tests

## Workflow

1. **Run tests** to generate timing data:
   ```bash
   make all
   ```

2. **Analyze** the results:
   ```bash
   make analyze
   ```

3. **Tag** tests with speed categories:
   ```bash
   make tag-tests
   ```

4. **Run specific test subsets**:
   ```bash
   make fast    # Quick smoke tests
   make mid     # Most tests (< 10s)
   make all     # Full suite
   ```

## Notes

- Speed tags are based on **actual wall-clock execution time**
- Tags should be updated periodically as tests change
- Robot Framework 7.x stores elapsed time in seconds (not milliseconds)
