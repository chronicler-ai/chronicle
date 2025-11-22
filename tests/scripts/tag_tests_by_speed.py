#!/usr/bin/env python3
"""
Tag Robot Framework tests based on their execution speed.
Adds speed-fast, speed-mid, or speed-long tags to test cases.
"""

import xml.etree.ElementTree as ET
import sys
from pathlib import Path
import re


def get_test_timings(xml_file):
    """Extract test timings from output.xml."""
    tree = ET.parse(xml_file)
    root = tree.getroot()

    test_timings = {}

    # Find all test cases
    for test in root.iter('test'):
        name = test.get('name', 'Unknown')
        status = test.find('status')
        if status is not None:
            elapsed = status.get('elapsed')
            if elapsed:
                # In Robot Framework 7.x (schema v5), elapsed is already in seconds
                elapsed_sec = float(elapsed)

                # Categorize
                if elapsed_sec < 2.0:
                    tag = 'speed-fast'
                elif elapsed_sec <= 10.0:
                    tag = 'speed-mid'
                else:
                    tag = 'speed-long'

                test_timings[name] = {
                    'time_sec': elapsed_sec,
                    'tag': tag
                }

    return test_timings


def add_tags_to_robot_file(robot_file, test_timings):
    """Add speed tags to tests in a robot file."""
    with open(robot_file, 'r') as f:
        content = f.read()

    original_content = content
    modified = False

    # Process each test
    for test_name, timing in test_timings.items():
        speed_tag = timing['tag']

        # Escape special regex characters in test name
        escaped_name = re.escape(test_name)

        # Pattern to match test case with optional [Tags] line
        # Matches: Test Name\n    [Documentation]...\n    [Tags]...
        # or: Test Name\n    [Tags]...
        # or: Test Name\n    (first keyword)
        pattern = rf'^{escaped_name}\s*$\n((?:    \[Documentation\].*\n(?:    \.\.\..*\n)*)?)(    \[Tags\].*\n)?'

        def replace_tags(match):
            nonlocal modified
            test_line = match.group(0).split('\n')[0] + '\n'  # Test name line
            doc_lines = match.group(1) or ''  # Documentation lines
            tags_line = match.group(2)  # Existing tags line

            if tags_line:
                # Update existing tags
                stripped = tags_line.strip()
                indent = tags_line[:len(tags_line) - len(tags_line.lstrip())]

                # Parse existing tags
                tags_content = stripped.replace('[Tags]', '').strip()
                tags = tags_content.split() if tags_content else []

                # Remove existing speed- tags
                tags = [t for t in tags if not t.startswith('speed-')]

                # Add new speed tag if not already there
                if speed_tag not in tags:
                    tags.append(speed_tag)
                    new_tags_line = f"{indent}[Tags]    {' '.join([t for t in tags if t])}\n"
                    modified = True
                    return test_line + doc_lines + new_tags_line
                else:
                    return match.group(0)
            else:
                # Add new [Tags] line after documentation (or after test name if no doc)
                indent = '    '
                new_tags_line = f"{indent}[Tags]    {speed_tag}\n"
                modified = True
                return test_line + doc_lines + new_tags_line

        content = re.sub(pattern, replace_tags, content, flags=re.MULTILINE)

    if modified:
        with open(robot_file, 'w') as f:
            f.write(content)
        return True

    return False


def main():
    # Get test timings
    xml_file = Path(__file__).parent.parent / 'output.xml'

    if len(sys.argv) > 1:
        xml_file = Path(sys.argv[1])

    if not xml_file.exists():
        print(f"Error: {xml_file} not found")
        print("Please run tests first to generate output.xml")
        sys.exit(1)

    print(f"Reading test timings from: {xml_file}")
    test_timings = get_test_timings(xml_file)

    print(f"\nFound {len(test_timings)} tests with timing data")

    # Categorize
    fast = sum(1 for t in test_timings.values() if t['tag'] == 'speed-fast')
    mid = sum(1 for t in test_timings.values() if t['tag'] == 'speed-mid')
    long = sum(1 for t in test_timings.values() if t['tag'] == 'speed-long')

    print(f"  Fast:  {fast} tests (< 2s)")
    print(f"  Mid:   {mid} tests (2-10s)")
    print(f"  Long:  {long} tests (> 10s)")

    # Find all robot files
    tests_dir = Path(__file__).parent
    robot_files = list(tests_dir.glob('**/*.robot'))

    # Exclude setup files
    robot_files = [f for f in robot_files if 'setup' not in str(f) and 'resources' not in str(f)]

    print(f"\nUpdating {len(robot_files)} robot files...")

    modified_count = 0
    for robot_file in robot_files:
        try:
            if add_tags_to_robot_file(robot_file, test_timings):
                print(f"  ✓ {robot_file.relative_to(tests_dir.parent)}")
                modified_count += 1
        except Exception as e:
            print(f"  ✗ {robot_file.relative_to(tests_dir.parent)}: {e}")

    print(f"\n✓ Modified {modified_count} files")


if __name__ == '__main__':
    main()
