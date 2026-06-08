#!/usr/bin/env python3
"""
Tests for the Level 1 MVP Python tooling.

Covers the behaviors repaired in review:
  - ingest tool-output -> evidence linking (FIFO fallback when ids are omitted)
  - _match_tool_call fallback never steals an explicitly id-tagged call
  - a Claim is extracted from every substantive user message (not just the first)
  - audit hashes commit to full message content, not a truncated preview
  - audit-chain validation walks previous_event_id links (tolerates out-of-order
    timestamps, flags dangling links / forks / bad roots)
  - CLI default-thread resolution fails cleanly on an export with no threads

Uses only the standard library (no pytest). Run with:
    python3 -m unittest discover -s tests
    python3 tests/test_engine_ingest.py
"""

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "src"))


def _quiet_ingest(in_path, out_path):
    """Run ingest_session without leaking its progress prints into test output."""
    with contextlib.redirect_stdout(io.StringIO()):
        ingest_session(in_path, out_path)

from engine import ClisTaEngine  # noqa: E402
import ingest_hermes  # noqa: E402
from ingest_hermes import _match_tool_call, hash_payload, ingest_session  # noqa: E402
import cli  # noqa: E402


def make_engine(threads=None, audit_events=None, participants=None,
                claims=None, evidence=None, decisions=None):
    """Build an engine over in-memory export data (skips file I/O)."""
    engine = ClisTaEngine()
    engine.export_data = {
        "threads": threads or [],
        "participants": participants or [],
        "claims": claims or [],
        "evidence": evidence or [],
        "decisions": decisions or [],
        "audit_events": audit_events or [],
    }
    engine._build_index()
    return engine


def event(ev_id, prev_id, created_at, thread_id="t1"):
    return {
        "id": ev_id,
        "object_type": "audit_event",
        "thread_id": thread_id,
        "previous_event_id": prev_id,
        "created_at": created_at,
    }


class MatchToolCallTests(unittest.TestCase):
    def test_exact_id_match(self):
        pending = [{"id": "call_A", "name": "a"}, {"id": "call_B", "name": "b"}]
        match = _match_tool_call(pending, "call_B")
        self.assertEqual(match["name"], "b")
        # The matched call is consumed; the other remains.
        self.assertEqual([p["name"] for p in pending], ["a"])

    def test_empty_pending_returns_none(self):
        self.assertIsNone(_match_tool_call([], "call_A"))

    def test_fallback_prefers_untagged_call(self):
        # Result carries an id, but the matching call was stored without one
        # (the Hermes shape). We must not steal the unrelated id-tagged call.
        pending = [{"id": "call_A", "name": "tagged"}, {"id": None, "name": "untagged"}]
        match = _match_tool_call(pending, "call_unknown")
        self.assertEqual(match["name"], "untagged")
        self.assertEqual([p["name"] for p in pending], ["tagged"])

    def test_fallback_fifo_when_all_tagged(self):
        pending = [{"id": "call_A", "name": "first"}, {"id": "call_B", "name": "second"}]
        match = _match_tool_call(pending, None)
        self.assertEqual(match["name"], "first")


class HashPayloadTests(unittest.TestCase):
    def test_commits_to_full_content(self):
        # Two payloads identical for the first 100 chars but differing after.
        base = "x" * 100
        a = {"role": "tool", "content": base + "AAA"}
        b = {"role": "tool", "content": base + "BBB"}
        self.assertNotEqual(hash_payload(a), hash_payload(b))

    def test_deterministic(self):
        payload = {"role": "user", "content": "hello", "has_tools": False}
        self.assertEqual(hash_payload(payload), hash_payload(payload))
        self.assertTrue(hash_payload(payload).startswith("sha256:"))


class AuditChainTests(unittest.TestCase):
    def test_valid_chain_with_out_of_order_timestamps(self):
        # Descending timestamps but a well-formed link chain: must be valid.
        events = [
            event("e1", None, "2026-01-03"),
            event("e2", "e1", "2026-01-02"),
            event("e3", "e2", "2026-01-01"),
        ]
        engine = make_engine(threads=[{"id": "t1"}], audit_events=events)
        result = engine.validate_audit_chain("t1")
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["event_count"], 3)
        self.assertEqual(result["head_event_id"], "e3")

    def test_dangling_previous_event_id(self):
        events = [
            event("e1", None, "2026-01-01"),
            event("e2", "e1", "2026-01-02"),
            event("e3", "eX", "2026-01-03"),  # eX does not exist
        ]
        engine = make_engine(threads=[{"id": "t1"}], audit_events=events)
        result = engine.validate_audit_chain("t1")
        self.assertFalse(result["valid"])
        self.assertTrue(any("e3" in err for err in result["errors"]))

    def test_fork_two_events_share_previous(self):
        events = [
            event("e1", None, "2026-01-01"),
            event("e2", "e1", "2026-01-02"),
            event("e3", "e1", "2026-01-03"),  # also claims e1 as previous
        ]
        engine = make_engine(threads=[{"id": "t1"}], audit_events=events)
        result = engine.validate_audit_chain("t1")
        self.assertFalse(result["valid"])
        self.assertTrue(any("fork" in err.lower() for err in result["errors"]))

    def test_no_root(self):
        events = [
            event("e1", "e2", "2026-01-01"),
            event("e2", "e1", "2026-01-02"),
        ]
        engine = make_engine(threads=[{"id": "t1"}], audit_events=events)
        result = engine.validate_audit_chain("t1")
        self.assertFalse(result["valid"])
        self.assertTrue(any("root" in err.lower() for err in result["errors"]))

    def test_empty_chain_is_valid(self):
        engine = make_engine(threads=[{"id": "t1"}], audit_events=[])
        result = engine.validate_audit_chain("t1")
        self.assertTrue(result["valid"])
        self.assertEqual(result["event_count"], 0)
        self.assertIsNone(result["head_event_id"])


class ReferentialIntegrityTests(unittest.TestCase):
    def test_unknown_participant_flagged(self):
        engine = make_engine(
            threads=[{"id": "t1", "participant_ids": ["par_missing"]}],
            participants=[],
        )
        result = engine.validate_referential_integrity()
        self.assertFalse(result["valid"])
        self.assertTrue(any("par_missing" in err for err in result["errors"]))

    def test_clean_references_ok(self):
        engine = make_engine(
            threads=[{
                "id": "t1",
                "participant_ids": ["par_1"],
                "claim_ids": ["clm_1"],
                "evidence_ids": ["evd_1"],
            }],
            participants=[{"id": "par_1"}],
            claims=[{"id": "clm_1", "evidence_ids": ["evd_1"]}],
            evidence=[{"id": "evd_1"}],
        )
        result = engine.validate_referential_integrity()
        self.assertTrue(result["valid"], result["errors"])


class ResolveThreadIdTests(unittest.TestCase):
    def test_empty_export_raises_value_error(self):
        engine = make_engine(threads=[])
        with self.assertRaises(ValueError):
            cli.resolve_thread_id(engine, None)

    def test_defaults_to_first_thread(self):
        engine = make_engine(threads=[{"id": "t1"}, {"id": "t2"}])
        self.assertEqual(cli.resolve_thread_id(engine, None), "t1")

    def test_explicit_thread_passthrough(self):
        engine = make_engine(threads=[{"id": "t1"}])
        self.assertEqual(cli.resolve_thread_id(engine, "t_custom"), "t_custom")


class IngestIntegrationTests(unittest.TestCase):
    def _ingest(self, messages):
        with tempfile.TemporaryDirectory() as tmp:
            in_path = os.path.join(tmp, "session.json")
            out_path = os.path.join(tmp, "export.json")
            with open(in_path, "w", encoding="utf-8") as f:
                json.dump(messages, f)
            _quiet_ingest(in_path, out_path)
            with open(out_path, "r", encoding="utf-8") as f:
                return json.load(f)

    def test_links_tool_output_when_call_has_no_id(self):
        # The assistant tool_call omits an id; the tool result carries one.
        # The fixed ingest must still link them into a single Evidence item.
        messages = [
            {"role": "user", "content": "Please look up the queue metrics for me.",
             "timestamp": "2026-01-01T00:00:00Z"},
            {"role": "assistant", "content": "Searching.",
             "timestamp": "2026-01-01T00:00:01Z",
             "tool_calls": [{"name": "web_search", "arguments": "{}"}]},
            {"role": "tool", "content": "{\"result\": \"median wait 45m\"}",
             "timestamp": "2026-01-01T00:00:02Z", "tool_call_id": "call_1"},
        ]
        export = self._ingest(messages)
        self.assertEqual(len(export["evidence"]), 1)
        ev = export["evidence"][0]
        self.assertIn("median wait 45m", ev["summary"])
        self.assertEqual(ev["source_type"], "hermes_tool_output")
        # The thread references the created evidence.
        self.assertEqual(export["threads"][0]["evidence_ids"], [ev["id"]])

    def test_extracts_claim_from_every_user_message(self):
        messages = [
            {"role": "user", "content": "First substantive question about deployment.",
             "timestamp": "2026-01-01T00:00:00Z"},
            {"role": "assistant", "content": "Answer one.",
             "timestamp": "2026-01-01T00:00:01Z"},
            {"role": "user", "content": "Second substantive question about privacy.",
             "timestamp": "2026-01-01T00:00:02Z"},
        ]
        export = self._ingest(messages)
        self.assertEqual(len(export["claims"]), 2)
        self.assertEqual(len(export["threads"][0]["claim_ids"]), 2)

    def test_timestamp_uses_z_suffix(self):
        messages = [{"role": "user", "content": "A sufficiently long prompt here.",
                     "timestamp": "2026-01-01T00:00:00Z"}]
        export = self._ingest(messages)
        self.assertTrue(export["threads"][0]["created_at"].endswith("Z"))

    def test_ingest_output_passes_validation(self):
        messages = [
            {"role": "user", "content": "Decide whether to run the limited beta.",
             "timestamp": "2026-01-01T00:00:00Z"},
            {"role": "assistant", "content": "Searching for metrics.",
             "timestamp": "2026-01-01T00:00:01Z",
             "tool_calls": [{"name": "web_search", "arguments": "{}"}]},
            {"role": "tool", "content": "{\"median\": \"45m\"}",
             "timestamp": "2026-01-01T00:00:02Z", "tool_call_id": "call_1"},
            {"role": "assistant", "content": "Recommend a limited redacted beta.",
             "timestamp": "2026-01-01T00:00:03Z"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            in_path = os.path.join(tmp, "session.json")
            out_path = os.path.join(tmp, "export.json")
            with open(in_path, "w", encoding="utf-8") as f:
                json.dump(messages, f)
            _quiet_ingest(in_path, out_path)
            engine = ClisTaEngine()
            engine.load_export(out_path)
            thread_id = list(engine.index["threads"].keys())[0]
            report = engine.run_full_validation(thread_id)
        self.assertTrue(report["overall_valid"], report)


if __name__ == "__main__":
    unittest.main()
