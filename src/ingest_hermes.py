#!/usr/bin/env python3
"""
Hermes Session Ingestion — thin shim over ``ingest_session``.

The Hermes profile is one entry in the generic session-ingestion registry
(M33). This module is kept as a stable entry point for older docs, scripts,
and the clean-room replay (``scripts/replay.sh``) which calls it by path.
Output is byte-identical to the previous, dedicated implementation: the
committed example log under ``examples/hermes-ingest/`` is the regression
test (also re-asserted by ``test/hermes-ingest-replay.test.js``).

Usage:
    python src/ingest_hermes.py --input session.json --output events.ndjson
"""

import argparse

from ingest_session import ingest_session_events


def ingest_session_events_hermes(input_path: str, output_path: str) -> None:
    ingest_session_events(input_path, output_path, profile="hermes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest a Hermes session into a ClisTa event log")
    parser.add_argument("--input", required=True, help="Path to input .json or .ndjson Hermes session")
    parser.add_argument("--output", required=True, help="Path to output NDJSON event log")
    args = parser.parse_args()
    ingest_session_events_hermes(args.input, args.output)
