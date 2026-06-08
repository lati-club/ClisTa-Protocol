#!/usr/bin/env python3
"""
ClisTa Protocol CLI

Command-line interface for the ClisTa Protocol reference engine.
Matches the UX patterns of the existing repo (e.g., `clista validate`, `clista project`).

Usage:
    python -m clista validate --export path/to/export.json
    python -m clista project --export path/to/export.json --thread thd_123
    python -m clista ingest --input session.json --output export.json
"""

import argparse
import json
import sys
import os

# Add parent directory to path to allow importing engine and ingest_hermes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import ClisTaEngine
from ingest_hermes import ingest_session, ingest_session_events

def resolve_thread_id(engine, requested):
    """Return the requested thread id, or the first thread in the export.

    Raises ValueError (not IndexError) when an export with no threads is loaded,
    so callers can surface a clean structured error.
    """
    if requested:
        return requested
    thread_ids = list(engine.index["threads"].keys())
    if not thread_ids:
        raise ValueError("Export contains no threads.")
    return thread_ids[0]

def cmd_validate(args):
    """Validate an export file for referential integrity and audit chain."""
    engine = ClisTaEngine()
    try:
        engine.load_export(args.export)
        thread_id = resolve_thread_id(engine, args.thread)
    except Exception as e:
        print(json.dumps({"error": str(e), "valid": False}, indent=2))
        sys.exit(1)

    report = engine.run_full_validation(thread_id)
    
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["overall_valid"] else 1)

def cmd_project(args):
    """Project the current reasoning state for a given thread."""
    engine = ClisTaEngine()
    try:
        engine.load_export(args.export)
        thread_id = resolve_thread_id(engine, args.thread)
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))
        sys.exit(1)

    try:
        state = engine.project_state(thread_id)
        print(json.dumps(state, indent=2))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))
        sys.exit(1)

def cmd_ingest(args):
    """Ingest a Hermes session into a ClisTa export or engine event log."""
    try:
        if args.format == "events":
            ingest_session_events(args.input, args.output)
        else:
            ingest_session(args.input, args.output)
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        prog="clista",
        description="ClisTa Protocol Reference Engine CLI"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate export integrity and audit chain")
    validate_parser.add_argument("--export", required=True, help="Path to ClisTa export JSON")
    validate_parser.add_argument("--thread", help="Thread ID to validate (defaults to first)")
    validate_parser.set_defaults(func=cmd_validate)
    
    # Project command
    project_parser = subparsers.add_parser("project", help="Project current reasoning state")
    project_parser.add_argument("--export", required=True, help="Path to ClisTa export JSON")
    project_parser.add_argument("--thread", help="Thread ID to project (defaults to first)")
    project_parser.set_defaults(func=cmd_project)
    
    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest Hermes session into ClisTa format")
    ingest_parser.add_argument("--input", required=True, help="Path to input Hermes session (.json or .ndjson)")
    ingest_parser.add_argument("--output", required=True, help="Path to output file")
    ingest_parser.add_argument("--format", choices=["export", "events"], default="export",
                               help="export: flat clista.protocol.v0 JSON (default); "
                                    "events: chained NDJSON event log the engine consumes")
    ingest_parser.set_defaults(func=cmd_ingest)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
        
    args.func(args)

if __name__ == "__main__":
    main()
