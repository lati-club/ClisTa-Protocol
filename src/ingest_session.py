#!/usr/bin/env python3
"""
Generic Session Ingestion (M33).

A single ingestion front end with a small registry of provider profiles. Each
profile knows ONLY how to flatten its provider's raw session format into a
canonical list of normalized messages

    [{role: "user"|"assistant"|"tool",
      content: str,
      tool_calls: [{id, name, arguments}],
      tool_call_id: str | None,
      timestamp: str | None}, ...]

After normalization, the shared ``session_to_events`` pipeline is the SAME
code path for every provider — same id derivation, same recommendation /
objection detection, same decision-merge requirements. That's the M33 hard
law: ``provider_profile != protocol_change``. Adding a profile must never
change protocol output for the existing profiles. The hermes profile's golden
log under ``examples/hermes-ingest/`` is the regression test for that.

Usage:
    python src/ingest_session.py --profile hermes --input session.json --output events.ndjson
    python src/ingest_session.py --profile claude-code --input session.jsonl --output events.ndjson
"""

import argparse
import hashlib
import json
import os
import re
from typing import Any, Callable, Dict, List, Optional

import clista_events

# Fallback session time when a transcript carries no timestamps at all. A fixed
# epoch keeps ingestion fully deterministic: the same session always produces
# the same event log, byte for byte.
_EPOCH = "1970-01-01T00:00:00.000Z"


# ---- Normalization shape -------------------------------------------------

# A "normalized message" is a dict with the keys above. Profiles return a list
# of these. We seed deterministic ids over THIS list (not the raw provider
# blob), so two providers that boil down to the same conversation produce the
# same content-derived ids — the only protocol-visible thing a profile change
# can move is the normalized set, which is precisely what the law allows.


def _session_seed(messages: List[Dict[str, Any]]) -> str:
    """A stable digest of the normalized session, used to derive ids."""
    canonical = json.dumps(messages, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _id_factory(seed: str) -> Callable[[str, str], str]:
    def make_id(prefix: str, key: str) -> str:
        digest = hashlib.sha256(f"{seed}:{prefix}:{key}".encode("utf-8")).hexdigest()
        return f"{prefix}_{digest[:12]}"
    return make_id


# ---- Tool-call matching --------------------------------------------------

def _match_tool_call(pending: List[Dict[str, Any]], tool_call_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Pop the tool call a tool result belongs to.

    Prefers an explicit tool_call_id match; falls back to FIFO order when the
    provider omits ids on the call or the result. The fallback prefers calls
    that have no id of their own so we never steal an explicitly id-tagged
    call for a different result.
    """
    if not pending:
        return None
    if tool_call_id:
        for i, tc in enumerate(pending):
            if tc.get("id") == tool_call_id:
                return pending.pop(i)
    for i, tc in enumerate(pending):
        if not tc.get("id"):
            return pending.pop(i)
    return pending.pop(0)


# ---- Recommendation / objection detection --------------------------------
#
# These triggers are deliberately narrow: an assistant turn becomes a
# decision proposal only when it states one in plain language. A profile
# change MUST NOT change these — they are part of the shared pipeline.

_RECOMMENDATION_TRIGGERS = (
    "i recommend", "we recommend", "my recommendation", "our recommendation",
    "i suggest", "we suggest", "i propose", "we propose", "i advise",
    "recommendation:", "decision:",
)


def _detect_recommendation(messages: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    found = None
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        content = str(msg.get("content", ""))
        lowered = content.lower()
        if any(trigger in lowered for trigger in _RECOMMENDATION_TRIGGERS):
            found = {"text": content, "timestamp": msg.get("timestamp")}
    return found


_OBJECTION_TRIGGERS = (
    "concern", "risk", "caveat", "downside", "drawback",
    "limitation", "trade-off", "tradeoff", "must ensure", "on the other hand",
)


def _sentences(text: str) -> List[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", str(text).strip()) if s]


def _detect_objections(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    objections: List[Dict[str, Any]] = []
    seen = set()
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        for sentence in _sentences(msg.get("content", "")):
            lowered = sentence.lower()
            if any(trigger in lowered for trigger in _OBJECTION_TRIGGERS) and sentence not in seen:
                seen.add(sentence)
                objections.append({"text": sentence, "timestamp": msg.get("timestamp")})
    return objections


# ---- Shared event pipeline -----------------------------------------------
#
# Profiles MUST produce the same protocol output here for equivalent
# conversations. That's the M33 hard law in code: only the normalize step is
# allowed to vary.

def session_to_events(messages: List[Dict[str, Any]], *,
                      thread_title_prefix: str = "Session",
                      agent_name: str = "Assistant Agent") -> List[Dict[str, Any]]:
    """Map a normalized message list to an ordered ClisTa event list (unhashed).

    The ``thread_title_prefix`` and ``agent_name`` are presentation-only
    customizations. They cannot add events the engine wouldn't otherwise
    accept; they are limited to the human-facing strings on the Thread and the
    Agent participant. The id derivation, decision gating, evidence linking,
    and objection detection are byte-identical across profiles.
    """
    make_id = _id_factory(_session_seed(messages))
    now = messages[0].get("timestamp") if messages else None
    now = now or _EPOCH
    thread_id = make_id("thd", "thread")
    human_id = make_id("par", "participant:human")
    agent_id = make_id("par", "participant:agent")

    first_user = next((m for m in messages if m.get("role") == "user"), messages[0] if messages else {})
    problem = str(first_user.get("content", thread_title_prefix))[:500]

    events: List[Dict[str, Any]] = []

    def emit(event_type, actor_id, payload, timestamp):
        events.append({
            "event_id": make_id("evt", f"event:{len(events)}"),
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
        "name": agent_name, "role": "reasoning_participant",
    }}, now)

    emit("ThreadCreated", human_id, {"thread": {
        "id": thread_id, "object": "thread",
        "title": f"{thread_title_prefix}: {problem[:60]}",
        "question": problem,
        "status": "active",
        "participantIds": [human_id, agent_id],
        "createdAt": now, "updatedAt": now,
    }}, now)

    claim_ids: List[str] = []
    evidence_ids: List[str] = []
    pending_tool_calls: List[Dict[str, Any]] = []

    for index, msg in enumerate(messages):
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", now)

        if role == "user" and len(str(content)) > 20:
            claim_id = make_id("clm", f"claim:{index}")
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
                evidence_id = make_id("evd", f"evidence:{index}")
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

    objection_ids: List[str] = []
    if claim_ids:
        for obj_index, objection in enumerate(_detect_objections(messages)):
            objection_id = make_id("obj", f"objection:{obj_index}")
            objection_ids.append(objection_id)
            emit("ObjectionRaised", agent_id, {"objection": {
                "id": objection_id, "object": "objection",
                "threadId": thread_id,
                "participantId": agent_id,
                "targetObjectType": "claim",
                "targetObjectId": claim_ids[0],
                "text": objection["text"][:1000],
                "status": "open",
                "blocking": False,
                "raisedAt": objection["timestamp"] or now,
            }}, objection["timestamp"] or now)

    recommendation = _detect_recommendation(messages)
    if recommendation and evidence_ids:
        proposal = recommendation["text"][:1000]
        ts = recommendation["timestamp"] or now
        assumption_id = make_id("asm", "assumption")
        request_id = make_id("drq", "decision_request")
        review_id = make_id("rev", "review")
        record_id = make_id("dcr", "decision_record")

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

        emit("DecisionRequestOpened", agent_id, {"decisionRequest": {
            "id": request_id, "object": "decisionRequest",
            "threadId": thread_id,
            "proposal": proposal,
            "status": "review",
            "supportingEvidenceIds": evidence_ids,
            "supportingClaimIds": claim_ids,
            "supportingAssumptionIds": [assumption_id],
            "objectionIds": objection_ids,
            "openedByParticipantId": agent_id,
            "openedAt": ts,
        }}, ts)

        emit("ReviewSubmitted", human_id, {"review": {
            "id": review_id, "object": "review",
            "threadId": thread_id,
            "decisionRequestId": request_id,
            "reviewerParticipantId": human_id,
            "status": "approve",
            "comment": "Approved the assistant's recommendation.",
            "reviewedAt": ts,
        }}, ts)

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


# ---- Profile registry ----------------------------------------------------
#
# A profile is a tiny adapter: it loads the raw provider artifact and returns
# the normalized message list. NOTHING in a profile may touch the event
# pipeline above — that's how the hard law is enforced in code.


def _profile_hermes_load(input_path: str) -> List[Dict[str, Any]]:
    """Hermes already emits the normalized shape; we just parse it through."""
    messages: List[Dict[str, Any]] = []
    with open(input_path, "r", encoding="utf-8") as f:
        if input_path.endswith(".ndjson"):
            for line in f:
                line = line.strip()
                if line:
                    messages.append(json.loads(line))
        else:
            data = json.load(f)
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and "messages" in data:
                messages = data["messages"]
            else:
                raise ValueError("Unsupported JSON structure. Expected list of messages or {'messages': [...]}")
    return messages


def _claude_text_blocks(content: Any) -> str:
    """Concatenate the textual parts of a Claude-style content array.

    A Claude assistant turn arrives as ``content: [ {type:"text", text:...},
    {type:"tool_use", ...} ]``. We keep the human-readable text for the
    pipeline's recommendation/objection detection and ignore the rest (the
    tool_use blocks are extracted separately into tool_calls).
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "\n".join(parts).strip()
    return str(content or "")


def _profile_claude_code_load(input_path: str) -> List[Dict[str, Any]]:
    """Flatten a Claude Code session.jsonl into the normalized shape.

    Claude Code records each turn as one JSON object per line. A user turn
    can carry either plain text OR an array of tool_result blocks; an
    assistant turn carries an array of text + tool_use blocks. We expand
    tool_result blocks into their own normalized ``role=tool`` messages so
    the shared pipeline can pair them with their preceding tool_use calls
    exactly as it does for hermes.
    """
    normalized: List[Dict[str, Any]] = []
    with open(input_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            entry_type = entry.get("type")
            message = entry.get("message") or {}
            timestamp = entry.get("timestamp") or message.get("timestamp")
            if entry_type == "user":
                content = message.get("content")
                if isinstance(content, list):
                    # A user turn whose content is an array always carries
                    # tool_result blocks (Claude's convention). Each becomes
                    # its own normalized tool message, keyed by tool_use_id
                    # so the shared FIFO matcher can pair it back to its call.
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_result":
                            result_content = block.get("content")
                            if isinstance(result_content, list):
                                text_parts = []
                                for inner in result_content:
                                    if isinstance(inner, dict) and inner.get("type") == "text":
                                        text_parts.append(str(inner.get("text", "")))
                                result_text = "\n".join(text_parts).strip()
                            else:
                                result_text = str(result_content or "")
                            normalized.append({
                                "role": "tool",
                                "content": result_text,
                                "tool_call_id": block.get("tool_use_id"),
                                "timestamp": timestamp,
                            })
                else:
                    normalized.append({
                        "role": "user",
                        "content": str(content or ""),
                        "timestamp": timestamp,
                    })
            elif entry_type == "assistant":
                content = message.get("content")
                text = _claude_text_blocks(content)
                tool_calls = []
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            tool_calls.append({
                                "id": block.get("id"),
                                "name": block.get("name", "unknown_tool"),
                                "arguments": json.dumps(block.get("input") or {},
                                                       sort_keys=True,
                                                       separators=(",", ":")),
                            })
                msg = {
                    "role": "assistant",
                    "content": text,
                    "timestamp": timestamp,
                }
                if tool_calls:
                    msg["tool_calls"] = tool_calls
                normalized.append(msg)
            # Other entry types (system, summary, file-history-snapshot, etc.)
            # are intentionally dropped: they aren't part of the reasoning
            # transcript the protocol cares about, and silently including
            # them would change ids in a profile-specific way (forbidden by
            # the M33 hard law).
    return normalized


PROFILES: Dict[str, Dict[str, Any]] = {
    "hermes": {
        "load": _profile_hermes_load,
        "thread_title_prefix": "Hermes Session",
        "agent_name": "Hermes Agent",
    },
    "claude-code": {
        "load": _profile_claude_code_load,
        "thread_title_prefix": "Claude Code Session",
        "agent_name": "Claude Code Agent",
    },
}


def ingest_session_events(input_path: str, output_path: str, profile: str = "hermes") -> None:
    """Ingest a provider session into a chained ClisTa NDJSON event log."""
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile: {profile}. Known: {sorted(PROFILES)}")
    spec = PROFILES[profile]
    messages = spec["load"](input_path)
    if not messages:
        raise ValueError("No messages found in input file.")

    events = clista_events.prepare_and_chain(session_to_events(
        messages,
        thread_title_prefix=spec["thread_title_prefix"],
        agent_name=spec["agent_name"],
    ))

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(clista_events.serialize_ndjson(events))

    counts: Dict[str, int] = {}
    for e in events:
        counts[e["event_type"]] = counts.get(e["event_type"], 0) + 1
    summary = ", ".join(f"{n} {t}" for t, n in counts.items())
    print(f"Successfully ingested {len(messages)} messages (profile: {profile}).")
    print(f"Generated {len(events)} events: {summary}")
    print(f"Event log written to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest a provider session into a ClisTa event log")
    parser.add_argument("--profile", default="hermes", choices=sorted(PROFILES),
                        help="Provider profile (default: hermes)")
    parser.add_argument("--input", required=True, help="Path to the raw session file")
    parser.add_argument("--output", required=True, help="Path to output NDJSON event log")
    args = parser.parse_args()
    ingest_session_events(args.input, args.output, args.profile)
