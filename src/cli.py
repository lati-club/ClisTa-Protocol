#!/usr/bin/env python3
"""
ClisTa Protocol ingestion CLI

Ingests an external session into the canonical ClisTa append-only event log that
the engine consumes. Validation and projection live in the engine itself:

    node src/cli.js validate  --events <log>
    node src/cli.js state show --events <log>

Usage:
    python3 src/cli.py ingest --input session.json --output events.ndjson
"""

import argparse
import json
import sys
import os

# Add this directory to the path so the ingest adapter is importable.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ingest_hermes import ingest_session_events


def cmd_ingest(args):
    """Ingest a Hermes session into a ClisTa event log."""
    try:
        ingest_session_events(args.input, args.output)
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="clista",
        description="ClisTa Protocol ingestion CLI"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    ingest_parser = subparsers.add_parser(
        "ingest", help="Ingest a Hermes session into a ClisTa event log")
    ingest_parser.add_argument("--input", required=True,
                               help="Path to input Hermes session (.json or .ndjson)")
    ingest_parser.add_argument("--output", required=True,
                               help="Path to output NDJSON event log")
    ingest_parser.set_defaults(func=cmd_ingest)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
