#!/usr/bin/env python3
"""
Tests for the Hermes -> ClisTa event-log bridge.

Covers:
  - canonical hashing parity with the JS engine (src/integrity.js): the same
    stable serialization reproduces content_hashes stored in the engine's own
    example logs, byte-for-byte
  - prepare_and_chain: version stamping, previous_hash chaining, content_hash
  - session_to_events: the ordered ParticipantAdded/ThreadCreated/ClaimCreated/
    EvidenceCommitted sequence with correct payload shapes
  - round-trip: the generated log is accepted by the real engine
    (`node src/cli.js validate --events <log>`), skipped if node is unavailable

Standard library only. Run with: python3 -m unittest discover -s tests
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "src"))

import clista_events  # noqa: E402
from ingest_hermes import session_to_events  # noqa: E402

MOCK_MESSAGES = [
    {"role": "user",
     "content": "We need to decide whether to run a limited beta of the assistant.",
     "timestamp": "2026-01-01T00:00:00.000Z"},
    {"role": "assistant", "content": "Searching for queue metrics.",
     "timestamp": "2026-01-01T00:00:01.000Z",
     "tool_calls": [{"name": "web_search", "arguments": "{}"}]},
    {"role": "tool", "content": "{\"median_wait\": \"45m\"}",
     "timestamp": "2026-01-01T00:00:02.000Z", "tool_call_id": "call_1"},
    {"role": "assistant", "content": "Recommend a limited, redacted beta.",
     "timestamp": "2026-01-01T00:00:03.000Z"},
]


class CanonicalHashingTests(unittest.TestCase):
    def test_stable_stringify_sorts_keys_not_arrays(self):
        # Object keys sort alphabetically; array order is preserved.
        self.assertEqual(
            clista_events.stable_stringify({"b": 1, "a": [3, 2]}),
            '{"a":[3,2],"b":1}',
        )

    def test_content_hash_known_value(self):
        import hashlib
        expected = "sha256:" + hashlib.sha256('{"a":2,"b":1}'.encode()).hexdigest()
        self.assertEqual(clista_events.content_hash({"b": 1, "a": 2}), expected)

    def test_reproduces_engine_example_log_hashes(self):
        # The engine's example logs use the legacy hash material
        # {event_type, thread_id, actor_id, timestamp, payload, metadata}.
        # Reproducing their stored content_hash with our primitives proves
        # byte-for-byte parity with src/integrity.js on real data.
        log = os.path.join(REPO_ROOT, "examples", "first-test-thread", "events.ndjson")
        checked = 0
        with open(log, encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                ev = json.loads(line)
                if "content_hash" not in ev:
                    continue
                material = {
                    k: ev[k]
                    for k in ("event_type", "thread_id", "actor_id", "timestamp", "payload", "metadata")
                    if ev.get(k) is not None
                }
                self.assertEqual(clista_events.content_hash(material), ev["content_hash"],
                                 f"hash mismatch for {ev.get('event_id')}")
                checked += 1
        self.assertGreater(checked, 0, "no hashed events found in example log")


class PrepareAndChainTests(unittest.TestCase):
    def _events(self):
        return [
            {"event_id": "evt_1", "event_type": "X", "thread_id": "t", "actor_id": "a",
             "timestamp": "2026-01-01T00:00:00.000Z", "payload": {"n": 1}},
            {"event_id": "evt_2", "event_type": "X", "thread_id": "t", "actor_id": "a",
             "timestamp": "2026-01-01T00:00:01.000Z", "payload": {"n": 2}},
            {"event_id": "evt_3", "event_type": "X", "thread_id": "t", "actor_id": "a",
             "timestamp": "2026-01-01T00:00:02.000Z", "payload": {"n": 3}},
        ]

    def test_chains_and_stamps_versions(self):
        out = clista_events.prepare_and_chain(self._events())
        self.assertNotIn("previous_hash", out[0])  # first event has no link
        for i, ev in enumerate(out):
            self.assertEqual(ev["protocol_version"], clista_events.PROTOCOL_VERSION)
            self.assertEqual(ev["hash_version"], clista_events.EVENT_HASH_VERSION)
            # content_hash recomputes to itself from the written material.
            self.assertEqual(ev["content_hash"], clista_events.compute_event_hash(ev))
            if i > 0:
                self.assertEqual(ev["previous_hash"], out[i - 1]["content_hash"])

    def test_does_not_mutate_input(self):
        events = self._events()
        clista_events.prepare_and_chain(events)
        self.assertNotIn("content_hash", events[0])

    def test_serialize_ndjson(self):
        out = clista_events.prepare_and_chain(self._events())
        text = clista_events.serialize_ndjson(out)
        self.assertTrue(text.endswith("\n"))
        lines = text.splitlines()
        self.assertEqual(len(lines), 3)
        # Each line is canonical (re-parses, and re-serializes identically).
        for line in lines:
            self.assertEqual(line, clista_events.stable_stringify(json.loads(line)))
        self.assertEqual(clista_events.serialize_ndjson([]), "")


class SessionToEventsTests(unittest.TestCase):
    def test_event_sequence_and_shapes(self):
        events = session_to_events(MOCK_MESSAGES)
        self.assertEqual(
            [e["event_type"] for e in events],
            ["ParticipantAdded", "ParticipantAdded", "ThreadCreated",
             "ClaimCreated", "EvidenceCommitted"],
        )
        thread = events[2]["payload"]["thread"]
        self.assertEqual(thread["status"], "active")
        self.assertEqual(len(thread["participantIds"]), 2)
        self.assertEqual(thread["id"], events[2]["thread_id"])

        claim = events[3]["payload"]["claim"]
        self.assertIn("limited beta", claim["text"])
        self.assertEqual(claim["object"], "claim")
        self.assertEqual(claim["createdByParticipantId"], events[0]["payload"]["participant"]["id"])

        evidence = events[4]["payload"]["evidence"]
        self.assertIn("web_search", evidence["source"])
        self.assertIn("median_wait", evidence["finding"])
        self.assertEqual(evidence["committedByParticipantId"], events[1]["payload"]["participant"]["id"])

    def test_actor_of_participant_added_is_the_participant(self):
        # ParticipantAdded is exempt from the actor-known check only because its
        # actor is the participant it declares; the engine relies on this.
        events = session_to_events(MOCK_MESSAGES)
        for ev in events[:2]:
            self.assertEqual(ev["actor_id"], ev["payload"]["participant"]["id"])


@unittest.skipUnless(shutil.which("node"), "node not available")
class EngineRoundTripTests(unittest.TestCase):
    def test_generated_log_is_accepted_by_engine(self):
        events = clista_events.prepare_and_chain(session_to_events(MOCK_MESSAGES))
        with tempfile.TemporaryDirectory() as tmp:
            log = os.path.join(tmp, "events.ndjson")
            with open(log, "w", encoding="utf-8") as f:
                f.write(clista_events.serialize_ndjson(events))
            proc = subprocess.run(
                ["node", os.path.join("src", "cli.js"), "validate", "--events", log],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        report = json.loads(proc.stdout)
        self.assertTrue(report["valid"], report)


if __name__ == "__main__":
    unittest.main()
