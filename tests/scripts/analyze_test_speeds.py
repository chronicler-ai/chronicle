#!/usr/bin/env python3
"""
Analyze Robot Framework test execution times and categorize by speed.
"""

import xml.etree.ElementTree as ET
import sys
from pathlib import Path


def parse_duration(duration_str):
    """Convert duration string like '00:00:01.234' to seconds."""
    if not duration_str:
        return 0.0

    parts = duration_str.split(':')
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    return 0.0


def analyze_tests(xml_file):
    """Parse output.xml and categorize tests by speed."""
    tree = ET.parse(xml_file)
    root = tree.getroot()

    test_timings = []

    # Find all test cases
    for test in root.iter('test'):
        name = test.get('name', 'Unknown')

        # Get status element for timing
        status = test.find('status')
        if status is not None:
            elapsed = status.get('elapsed')
            if elapsed:
                # In Robot Framework 7.x (schema v5), elapsed is already in seconds
                elapsed_sec = float(elapsed)

                # Get the parent suite path
                suite_parts = []
                parent = test
                while parent is not None:
                    if parent.tag == 'suite':
                        suite_name = parent.get('name', '')
                        if suite_name and suite_name != 'All Api Tests':
                            suite_parts.insert(0, suite_name)
                    # Find parent in tree
                    found_parent = False
                    for elem in root.iter():
                        for child in elem:
                            if child == parent:
                                parent = elem
                                found_parent = True
                                break
                        if found_parent:
                            break
                    if not found_parent:
                        break

                suite_path = '.'.join(suite_parts) if suite_parts else 'Unknown'

                test_timings.append({
                    'name': name,
                    'suite': suite_path,
                    'time_sec': elapsed_sec
                })

    # Categorize by speed
    fast = []
    mid = []
    long = []

    for test in test_timings:
        if test['time_sec'] < 2.0:
            fast.append(test)
        elif test['time_sec'] <= 10.0:
            mid.append(test)
        else:
            long.append(test)

    # Sort each category by time
    fast.sort(key=lambda x: x['time_sec'])
    mid.sort(key=lambda x: x['time_sec'])
    long.sort(key=lambda x: x['time_sec'])

    return fast, mid, long


def print_category(category_name, tests):
    """Print tests in a category."""
    print(f"\n{'=' * 80}")
    print(f"{category_name}: {len(tests)} tests")
    print(f"{'=' * 80}")

    for test in tests:
        print(f"{test['time_sec']:6.2f}s | {test['suite']:40s} | {test['name']}")


def main():
    xml_file = Path(__file__).parent.parent / 'output.xml'

    if len(sys.argv) > 1:
        xml_file = Path(sys.argv[1])

    if not xml_file.exists():
        print(f"Error: {xml_file} not found")
        sys.exit(1)

    print(f"Analyzing: {xml_file}")

    fast, mid, long = analyze_tests(xml_file)

    print_category("FAST (< 2 seconds)", fast)
    print_category("MID (2-10 seconds)", mid)
    print_category("LONG (> 10 seconds)", long)

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"Total tests: {len(fast) + len(mid) + len(long)}")
    print(f"Fast:  {len(fast):3d} tests (< 2s)")
    print(f"Mid:   {len(mid):3d} tests (2-10s)")
    print(f"Long:  {len(long):3d} tests (> 10s)")


if __name__ == '__main__':
    main()
