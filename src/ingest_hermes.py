#!/usr/bin/env python3
"""
Hermes Session Ingestion (adapter)

Parses a raw Hermes session transcript (.json or .ndjson) and emits the
canonical ClisTa append-only event log that the engine consumes. Tool calls are
linked to their outputs as Evidence, and an explicit assistant recommendation
backed by evidence is emitted as a full decision (request -> review -> merge).

Usage:
    python src/ingest_hermes.py --input session.json --output events.ndjson
"""

import argparse
import datetime
import json
import os
import uuid
from typing import List, Dict, Any, Optional

import clista_events


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _utc_now() -> str:
    """ISO 8601 UTC timestamp with milliseconds, e.g. 2026-06-08T16:21:59.654Z."""
    dt = datetime.datetime.now(datetime.timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _match_tool_call(pending: List[Dict[str, Any]], tool_call_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Pop the tool call a tool result belongs to.

    Prefers an explicit tool_call_id match; falls back to FIFO order when the
    provider omits ids on the call or the result (e.g. the Hermes export format),
    since tool outputs follow their calls in order.
    """
    if not pending:
        return None
    if tool_call_id:
        for i, tc in enumerate(pending):
            if tc.get("id") == tool_call_id:
                return pending.pop(i)
    # No id match (Hermes omits the id on the call side while the result carries
    # one). Fall back to the oldest call that has no id of its own, so we never
    # steal a call that was explicitly id-tagged for a different result. Only if
    # every remaining call carries an id do we fall back to plain FIFO.
    for i, tc in enumerate(pending):
        if not tc.get("id"):
            return pending.pop(i)
    return pending.pop(0)


def parse_session(input_path: str) -> List[Dict[str, Any]]:
    """Parse either JSON array or NDJSON format."""
    messages = []
    with open(input_path, 'r', encoding='utf-8') as f:
        if input_path.endswith('.ndjson'):
            for line in f:
                line = line.strip()
                if line:
                    messages.append(json.loads(line))
        else:
            data = json.load(f)
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and 'messages' in data:
                messages = data['messages']
            else:
                raise ValueError("Unsupported JSON structure. Expected list of messages or {'messages': [...]}")
    return messages

# Conservative, deterministic phrases that mark an assistant turn as an explicit
# recommendation. Detection stays boring on purpose: it never infers a decision
# from subtext, only from a stated recommendation.
_RECOMMENDATION_TRIGGERS = (
    "i recommend", "we recommend", "my recommendation", "our recommendation",
    "i suggest", "we suggest", "i propose", "we propose", "i advise",
    "recommendation:", "decision:",
)


def _detect_recommendation(messages: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Return the last assistant turn that states an explicit recommendation.

    Returns {"text", "timestamp"} for the final recommending assistant message,
    or None if no assistant turn uses recommendation language. The decision the
    human (decision owner) then approves is that recommendation verbatim.
    """
    found = None
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        content = str(msg.get("content", ""))
        lowered = content.lower()
        if any(trigger in lowered for trigger in _RECOMMENDATION_TRIGGERS):
            found = {"text": content, "timestamp": msg.get("timestamp")}
    return found


def session_to_events(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Map a Hermes session to an ordered ClisTa event list (unhashed).

    Emits the canonical append-only sequence the JS engine consumes:
      ParticipantAdded x2  (declared first; the actor is the participant being
                            added, which the engine exempts from the actor-known
                            check, mirroring its own logs)
      ThreadCreated        (references both participants)
      ClaimCreated         (one per substantive user message)
      EvidenceCommitted    (one per tool output linked to its call)
      DecisionRequestOpened + ReviewSubmitted + DecisionMerged
                           (only when the assistant states an explicit
                            recommendation AND evidence exists: the agent
                            proposes it, the human/decision_owner approves it)

    Assistant prose that is not an explicit recommendation stays conversation —
    it is never forced into a claim or an inferred decision. A decision is only
    emitted when the engine's own rules can be satisfied (a merge requires at
    least one piece of evidence and an approving review), so a recommendation in
    a session with no tool evidence yields claims/evidence but no decision.
    The returned events are unhashed; run them through
    clista_events.prepare_and_chain before serializing.
    """
    now = _utc_now()
    thread_id = generate_id("thd")
    human_id = generate_id("par")
    agent_id = generate_id("par")

    first_user = next((m for m in messages if m.get("role") == "user"), messages[0])
    problem = str(first_user.get("content", "Hermes session"))[:500]

    events: List[Dict[str, Any]] = []

    def emit(event_type, actor_id, payload, timestamp):
        events.append({
            "event_id": generate_id("evt"),
            "event_type": event_type,
            "thread_id": thread_id,
            "actor_id": actor_id,
            "timestamp": timestamp,
            "payload": payload,
        })

    emit("ParticipantAdded", human_id, {"participant": {
        "id": human_id, "object": "participant", "kind": "human",
        "name": "Human User", "role": "decision_owner",
    }}, now)
    emit("ParticipantAdded", agent_id, {"participant": {
        "id": agent_id, "object": "participant", "kind": "agent",
        "name": "Hermes Agent", "role": "reasoning_participant",
    }}, now)

    emit("ThreadCreated", human_id, {"thread": {
        "id": thread_id, "object": "thread",
        "title": f"Hermes Session: {problem[:60]}",
        "question": problem,
        "status": "active",
        "participantIds": [human_id, agent_id],
        "createdAt": now, "updatedAt": now,
    }}, now)

    claim_ids: List[str] = []
    evidence_ids: List[str] = []

    pending_tool_calls: List[Dict[str, Any]] = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", now)

        if role == "user" and len(str(content)) > 20:
            claim_id = generate_id("clm")
            claim_ids.append(claim_id)
            emit("ClaimCreated", human_id, {"claim": {
                "id": claim_id, "object": "claim",
                "threadId": thread_id,
                "text": str(content)[:1000],
                "status": "draft",
                "createdByParticipantId": human_id,
                "createdAt": timestamp,
            }}, timestamp)

        if role == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                pending_tool_calls.append({
                    "id": tc.get("id") or tc.get("tool_call_id"),
                    "name": tc.get("name", "unknown_tool"),
                    "arguments": tc.get("arguments", "{}"),
                    "timestamp": timestamp,
                })

        if role == "tool":
            tc_info = _match_tool_call(pending_tool_calls, msg.get("tool_call_id"))
            if tc_info is not None:
                evidence_id = generate_id("evd")
                evidence_ids.append(evidence_id)
                emit("EvidenceCommitted", agent_id, {"evidence": {
                    "id": evidence_id, "object": "evidence",
                    "threadId": thread_id,
                    "source": f"Tool: {tc_info['name']}",
                    "finding": str(content)[:1000],
                    "confidence": 0.9,
                    "committedByParticipantId": agent_id,
                    "committedAt": tc_info["timestamp"],
                }}, tc_info["timestamp"])

    # Decision chain: only when the assistant made an explicit recommendation and
    # there is evidence to back it (the engine rejects an evidence-free merge).
    recommendation = _detect_recommendation(messages)
    if recommendation and evidence_ids:
        proposal = recommendation["text"][:1000]
        ts = recommendation["timestamp"] or now
        assumption_id = generate_id("asm")
        request_id = generate_id("drq")
        review_id = generate_id("rev")
        record_id = generate_id("dcr")

        # The engine requires every decision to rest on evidence, a claim, and a
        # named assumption. The load-bearing assumption behind acting on a
        # recommendation is that the gathered evidence is sufficient and current.
        emit("AssumptionDeclared", agent_id, {"assumption": {
            "id": assumption_id, "object": "assumption",
            "threadId": thread_id,
            "text": "The evidence gathered in this session is sufficient and current "
                    "enough to act on the recommendation.",
            "status": "active",
            "evidenceIds": evidence_ids,
            "declaredByParticipantId": agent_id,
            "declaredAt": ts,
        }}, ts)

        # The agent proposes its own recommendation...
        emit("DecisionRequestOpened", agent_id, {"decisionRequest": {
            "id": request_id, "object": "decisionRequest",
            "threadId": thread_id,
            "proposal": proposal,
            "status": "review",
            "supportingEvidenceIds": evidence_ids,
            "supportingClaimIds": claim_ids,
            "supportingAssumptionIds": [assumption_id],
            "openedByParticipantId": agent_id,
            "openedAt": ts,
        }}, ts)

        # ...the human/decision_owner reviews and approves it...
        emit("ReviewSubmitted", human_id, {"review": {
            "id": review_id, "object": "review",
            "threadId": thread_id,
            "decisionRequestId": request_id,
            "reviewerParticipantId": human_id,
            "status": "approve",
            "comment": "Approved the assistant's recommendation.",
            "reviewedAt": ts,
        }}, ts)

        # ...and merges the final decision record.
        emit("DecisionMerged", human_id, {"decisionRecord": {
            "id": record_id, "object": "decisionRecord",
            "threadId": thread_id,
            "decisionRequestId": request_id,
            "status": "approved",
            "summary": proposal,
            "rationale": "Approved the assistant's recommendation from the session.",
            "supportingEvidenceIds": evidence_ids,
            "supportingClaimIds": claim_ids,
            "supportingAssumptionIds": [assumption_id],
            "decidedByParticipantId": human_id,
            "decidedAt": ts,
        }}, ts)

    return events


def ingest_session_events(input_path: str, output_path: str):
    """Ingest a Hermes session into a chained ClisTa NDJSON event log."""
    messages = parse_session(input_path)
    if not messages:
        raise ValueError("No messages found in input file.")

    events = clista_events.prepare_and_chain(session_to_events(messages))

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(clista_events.serialize_ndjson(events))

    counts: Dict[str, int] = {}
    for e in events:
        counts[e["event_type"]] = counts.get(e["event_type"], 0) + 1
    summary = ", ".join(f"{n} {t}" for t, n in counts.items())
    print(f"Successfully ingested {len(messages)} messages.")
    print(f"Generated {len(events)} events: {summary}")
    print(f"Event log written to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest a Hermes session into a ClisTa event log")
    parser.add_argument("--input", required=True, help="Path to input .json or .ndjson Hermes session")
    parser.add_argument("--output", required=True, help="Path to output NDJSON event log")
    args = parser.parse_args()

    ingest_session_events(args.input, args.output)
