# Friend-Lite Test Makefile
# Shortcuts for running tests by speed category

.PHONY: help fast mid all tag-tests analyze clean

# Default output directory
OUTPUTDIR ?= results
TEST_DIR = endpoints integration

help:
	@echo "Friend-Lite Test Targets:"
	@echo ""
	@echo "Running Tests:"
	@echo "  make fast        - Run only fast tests (< 2s each)"
	@echo "  make mid         - Run fast + mid tests (< 10s each)"
	@echo "  make all         - Run all tests (including long tests)"
	@echo ""
	@echo "Test Management:"
	@echo "  make tag-tests   - Tag tests by speed based on last run"
	@echo "  make analyze     - Analyze test speeds from last run"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Remove test output files"
	@echo ""
	@echo "Environment Variables:"
	@echo "  OUTPUTDIR        - Output directory (default: results)"
	@echo ""
	@echo "Examples:"
	@echo "  make fast                    # Quick test run"
	@echo "  make mid OUTPUTDIR=/tmp/out  # Custom output dir"
	@echo "  make all                     # Full test suite"

# Run only fast tests (< 2 seconds)
fast:
	@echo "Running fast tests (< 2s)..."
	robot --outputdir $(OUTPUTDIR) \
		--include speed-fast \
		--name "Fast Tests" \
		$(TEST_DIR)

# Run fast and mid tests (< 10 seconds)
mid:
	@echo "Running fast + mid tests (< 10s)..."
	robot --outputdir $(OUTPUTDIR) \
		--include speed-fastORspeed-mid \
		--name "Fast and Mid Tests" \
		$(TEST_DIR)

# Run all tests (including long tests)
all:
	@echo "Running all tests..."
	robot --outputdir $(OUTPUTDIR) \
		--name "All Tests" \
		$(TEST_DIR)

# Tag tests based on execution speed from last run
tag-tests:
	@echo "Tagging tests based on speed..."
	@if [ ! -f "$(OUTPUTDIR)/output.xml" ]; then \
		echo "Error: $(OUTPUTDIR)/output.xml not found!"; \
		echo "Run tests first to generate timing data."; \
		exit 1; \
	fi
	python3 scripts/tag_tests_by_speed.py $(OUTPUTDIR)/output.xml
	@echo ""
	@echo "Tests have been tagged! Run 'make analyze' to see the breakdown."

# Analyze test speeds from last run
analyze:
	@echo "Analyzing test speeds..."
	@if [ ! -f "$(OUTPUTDIR)/output.xml" ]; then \
		echo "Error: $(OUTPUTDIR)/output.xml not found!"; \
		echo "Run tests first to generate timing data."; \
		exit 1; \
	fi
	python3 scripts/analyze_test_speeds.py $(OUTPUTDIR)/output.xml

# Clean up test output files
clean:
	@echo "Cleaning test outputs..."
	rm -f output.xml log.html report.html
	rm -rf $(OUTPUTDIR)
	@echo "Clean complete!"
