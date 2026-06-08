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
import ingest_hermes  # noqa: E402
from ingest_hermes import (  # noqa: E402
    _detect_objections, _match_tool_call, session_to_events,
)

MOCK_MESSAGES = [
    {"role": "user",
     "content": "We need to decide whether to run a limited beta of the assistant.",
     "timestamp": "2026-01-01T00:00:00.000Z"},
    {"role": "assistant", "content": "Searching for queue metrics.",
     "timestamp": "2026-01-01T00:00:01.000Z",
     "tool_calls": [{"name": "web_search", "arguments": "{}"}]},
    {"role": "tool", "content": "{\"median_wait\": \"45m\"}",
     "timestamp": "2026-01-01T00:00:02.000Z", "tool_call_id": "call_1"},
    {"role": "assistant", "content": "I recommend a limited, redacted beta.",
     "timestamp": "2026-01-01T00:00:03.000Z"},
]

# Same as MOCK_MESSAGES but the conclusion states no recommendation, so no
# decision chain should be emitted.
NO_RECOMMENDATION_MESSAGES = MOCK_MESSAGES[:-1] + [
    {"role": "assistant", "content": "The median wait time is 45 minutes.",
     "timestamp": "2026-01-01T00:00:03.000Z"},
]

# Conclusion names a concern (risk) alongside the recommendation, so an
# objection should be raised in addition to the decision chain.
OBJECTION_MESSAGES = MOCK_MESSAGES[:-1] + [
    {"role": "assistant",
     "content": "A key risk is user privacy. I recommend a limited, redacted beta.",
     "timestamp": "2026-01-01T00:00:03.000Z"},
]


class MatchToolCallTests(unittest.TestCase):
    def test_exact_id_match(self):
        pending = [{"id": "call_A", "name": "a"}, {"id": "call_B", "name": "b"}]
        match = _match_tool_call(pending, "call_B")
        self.assertEqual(match["name"], "b")
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
             "ClaimCreated", "EvidenceCommitted",
             "AssumptionDeclared", "DecisionRequestOpened",
             "ReviewSubmitted", "DecisionMerged"],
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


class DecisionExtractionTests(unittest.TestCase):
    def _by_type(self, events):
        out = {}
        for e in events:
            out.setdefault(e["event_type"], []).append(e)
        return out

    def test_detect_recommendation_picks_last_recommending_turn(self):
        rec = ingest_hermes._detect_recommendation(MOCK_MESSAGES)
        self.assertIsNotNone(rec)
        self.assertIn("limited", rec["text"])

    def test_no_recommendation_returns_none(self):
        self.assertIsNone(ingest_hermes._detect_recommendation(NO_RECOMMENDATION_MESSAGES))

    def test_decision_chain_roles_and_links(self):
        events = session_to_events(MOCK_MESSAGES)
        by = self._by_type(events)
        human_id = events[0]["payload"]["participant"]["id"]
        agent_id = events[1]["payload"]["participant"]["id"]

        request = by["DecisionRequestOpened"][0]["payload"]["decisionRequest"]
        review = by["ReviewSubmitted"][0]["payload"]["review"]
        record = by["DecisionMerged"][0]["payload"]["decisionRecord"]

        # Agent proposes; decision_owner human reviews and decides.
        self.assertEqual(request["openedByParticipantId"], agent_id)
        self.assertEqual(review["reviewerParticipantId"], human_id)
        self.assertEqual(review["status"], "approve")
        self.assertEqual(record["decidedByParticipantId"], human_id)
        self.assertEqual(record["status"], "approved")

        # The record links back to the request and carries all three supports.
        self.assertEqual(record["decisionRequestId"], request["id"])
        self.assertEqual(review["decisionRequestId"], request["id"])
        for field in ("supportingEvidenceIds", "supportingClaimIds", "supportingAssumptionIds"):
            self.assertTrue(record[field], f"{field} must be non-empty")
        self.assertIn("recommend", record["summary"].lower())

    def test_no_decision_without_recommendation(self):
        types = [e["event_type"] for e in session_to_events(NO_RECOMMENDATION_MESSAGES)]
        self.assertNotIn("DecisionMerged", types)
        self.assertNotIn("DecisionRequestOpened", types)

    def test_no_decision_without_evidence(self):
        # Recommendation present, but no tool output -> no evidence -> the engine
        # would reject an evidence-free merge, so the adapter emits no decision.
        messages = [
            {"role": "user", "content": "Should we launch the limited beta now?",
             "timestamp": "2026-01-01T00:00:00Z"},
            {"role": "assistant", "content": "I recommend launching a limited beta.",
             "timestamp": "2026-01-01T00:00:01Z"},
        ]
        types = [e["event_type"] for e in session_to_events(messages)]
        self.assertNotIn("DecisionMerged", types)
        self.assertNotIn("EvidenceCommitted", types)


class ObjectionExtractionTests(unittest.TestCase):
    def _objection(self, events):
        return next(e["payload"]["objection"]
                    for e in events if e["event_type"] == "ObjectionRaised")

    def test_detect_objections_finds_concern_sentence(self):
        objs = _detect_objections(OBJECTION_MESSAGES)
        self.assertEqual(len(objs), 1)
        self.assertIn("risk", objs[0]["text"].lower())

    def test_no_objection_without_a_concern(self):
        self.assertEqual(_detect_objections(MOCK_MESSAGES), [])

    def test_objection_event_shape(self):
        events = session_to_events(OBJECTION_MESSAGES)
        agent_id = events[1]["payload"]["participant"]["id"]
        first_claim = next(e["payload"]["claim"]["id"]
                           for e in events if e["event_type"] == "ClaimCreated")
        obj = self._objection(events)
        self.assertEqual(obj["status"], "open")
        self.assertFalse(obj["blocking"])  # logged caveat, not formal dissent
        self.assertEqual(obj["participantId"], agent_id)
        self.assertEqual(obj["targetObjectType"], "claim")
        self.assertEqual(obj["targetObjectId"], first_claim)

    def test_objection_referenced_by_decision_but_not_preserved(self):
        events = session_to_events(OBJECTION_MESSAGES)
        obj_id = self._objection(events)["id"]
        request = next(e["payload"]["decisionRequest"]
                       for e in events if e["event_type"] == "DecisionRequestOpened")
        record = next(e["payload"]["decisionRecord"]
                      for e in events if e["event_type"] == "DecisionMerged")
        # Considered by the decision, but non-blocking => not preserved, and the
        # engine therefore requires no minority report.
        self.assertIn(obj_id, request["objectionIds"])
        self.assertNotIn(obj_id, record.get("preservedObjectionIds", []))

    def test_objection_without_recommendation_has_no_decision(self):
        messages = [
            {"role": "user", "content": "Should we expand the beta to all users?",
             "timestamp": "2026-01-01T00:00:00Z"},
            {"role": "assistant", "content": "A major privacy concern remains unaddressed.",
             "timestamp": "2026-01-01T00:00:01Z"},
        ]
        types = [e["event_type"] for e in session_to_events(messages)]
        self.assertIn("ObjectionRaised", types)
        self.assertNotIn("DecisionMerged", types)


@unittest.skipUnless(shutil.which("node"), "node not available")
class EngineRoundTripTests(unittest.TestCase):
    def _write_log(self, tmp, messages):
        events = clista_events.prepare_and_chain(session_to_events(messages))
        log = os.path.join(tmp, "events.ndjson")
        with open(log, "w", encoding="utf-8") as f:
            f.write(clista_events.serialize_ndjson(events))
        return log

    def _cli(self, *args):
        return subprocess.run(
            ["node", os.path.join("src", "cli.js"), *args],
            cwd=REPO_ROOT, capture_output=True, text=True,
        )

    def test_generated_log_is_accepted_by_engine(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = self._write_log(tmp, MOCK_MESSAGES)
            proc = self._cli("validate", "--events", log)
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        self.assertTrue(json.loads(proc.stdout)["valid"], proc.stdout)

    def test_decision_projects_as_approved(self):
        # The full session (recommendation + evidence) must project a merged,
        # approved decision in the engine's own state view.
        with tempfile.TemporaryDirectory() as tmp:
            log = self._write_log(tmp, MOCK_MESSAGES)
            proc = self._cli("state", "show", "--events", log)
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        status = json.loads(proc.stdout).get("decisionStatus", {})
        self.assertEqual(status.get("recordStatus"), "approved", status)

    def test_objection_session_validates_and_projects(self):
        # A session that names a concern must stay engine-valid and surface the
        # objection in the projection alongside the approved decision.
        with tempfile.TemporaryDirectory() as tmp:
            log = self._write_log(tmp, OBJECTION_MESSAGES)
            valid = self._cli("validate", "--events", log)
            state = self._cli("state", "show", "--events", log)
        self.assertEqual(valid.returncode, 0, valid.stderr or valid.stdout)
        self.assertTrue(json.loads(valid.stdout)["valid"], valid.stdout)
        projection = json.loads(state.stdout)
        self.assertEqual(len(projection.get("unresolvedObjections", [])), 1, projection)
        self.assertEqual(projection.get("decisionStatus", {}).get("recordStatus"), "approved")


if __name__ == "__main__":
    unittest.main()
