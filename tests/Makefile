# Friend-Lite Test Makefile
# Shortcuts for running tests

.PHONY: help all clean

# Default output directory
OUTPUTDIR ?= results
TEST_DIR = endpoints integration infrastructure

help:
	@echo "Friend-Lite Test Targets:"
	@echo ""
	@echo "Running Tests:"
	@echo "  make all         - Run all tests"
	@echo "  make endpoints   - Run only endpoint tests"
	@echo "  make integration - Run only integration tests"
	@echo "  make infra       - Run only infrastructure tests"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Remove test output files"
	@echo ""
	@echo "Environment Variables:"
	@echo "  OUTPUTDIR        - Output directory (default: results)"
	@echo ""
	@echo "Examples:"
	@echo "  make all                     # Full test suite"
	@echo "  make endpoints               # Only endpoint tests"
	@echo "  make all OUTPUTDIR=/tmp/out  # Custom output dir"

# Run all tests
# Creates a persistent fixture conversation that won't be deleted between suites
all:
	@echo "Running all tests..."
	CREATE_FIXTURE=true robot --outputdir $(OUTPUTDIR) \
		--name "All Tests" \
		$(TEST_DIR)

# Run only endpoint tests
endpoints:
	@echo "Running endpoint tests..."
	robot --outputdir $(OUTPUTDIR) \
		--name "Endpoint Tests" \
		endpoints

# Run only integration tests
integration:
	@echo "Running integration tests..."
	CREATE_FIXTURE=true robot --outputdir $(OUTPUTDIR) \
		--name "Integration Tests" \
		integration

# Run only infrastructure tests
infra:
	@echo "Running infrastructure tests..."
	robot --outputdir $(OUTPUTDIR) \
		--name "Infrastructure Tests" \
		infrastructure

# Clean up test output files
clean:
	@echo "Cleaning test outputs..."
	rm -f output.xml log.html report.html
	rm -rf $(OUTPUTDIR)
	@echo "Clean complete!"
