#!/usr/bin/env python3
"""
Hermes Session Ingestion Script (Enhanced)

Parses a raw Hermes session transcript (.json or .ndjson) and emits a valid, 
structured ClisTa Thread conforming to the v0 protocol schemas.
Now correctly links tool call executions with their actual outputs as Evidence.

Usage:
    python src/ingest_hermes.py --input session.json --output thread_export.json
"""

import argparse
import json
import uuid
import hashlib
import datetime
import os
from typing import List, Dict, Any, Optional

def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def hash_payload(payload: Dict[str, Any]) -> str:
    """Generate a SHA256 hash of the payload for audit integrity."""
    payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    return f"sha256:{hashlib.sha256(payload_str.encode('utf-8')).hexdigest()}"

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

def ingest_session(input_path: str, output_path: str):
    messages = parse_session(input_path)
    if not messages:
        raise ValueError("No messages found in input file.")

    now = datetime.datetime.utcnow().isoformat() + "Z"
    thread_id = generate_id("thd")
    
    # 1. Initialize Participants
    participants = {
        "human_user": {
            "id": generate_id("par"),
            "object_type": "participant",
            "display_name": "Human User",
            "type": "human",
            "organization": None,
            "identity_ref": "hermes_user",
            "agent_model_ref": None,
            "public_key": None,
            "created_at": now
        },
        "hermes_agent": {
            "id": generate_id("par"),
            "object_type": "participant",
            "display_name": "Hermes Agent",
            "type": "ai_agent",
            "organization": "Nous Research",
            "identity_ref": "hermes_gateway",
            "agent_model_ref": "qwen3.7-plus",
            "public_key": None,
            "created_at": now
        }
    }

    # 2. Initialize Thread
    first_user_msg = next((m for m in messages if m.get("role") == "user"), messages[0])
    problem_statement = first_user_msg.get("content", "Unknown problem statement")[:500]
    
    thread = {
        "id": thread_id,
        "object_type": "thread",
        "title": f"Hermes Session: {problem_statement[:60]}...",
        "problem_statement": problem_statement,
        "status": "in_deliberation",
        "created_by_participant_id": participants["human_user"]["id"],
        "participant_ids": [p["id"] for p in participants.values()],
        "role_bindings": [],
        "evidence_ids": [],
        "claim_ids": [],
        "position_ids": [],
        "objection_ids": [],
        "alignment_state_ids": [],
        "decision_ids": [],
        "minority_report_ids": [],
        "fork_ids": [],
        "parent_thread_id": None,
        "visibility": "private",
        "created_at": now,
        "updated_at": now
    }

    claims = []
    evidence_items = []
    audit_events = []
    prev_event_id = None
    
    # Track pending tool calls to link with their outputs
    pending_tool_calls = {}

    # 3. Process Messages into Protocol Objects
    for idx, msg in enumerate(messages):
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", now)
        
        actor_id = participants["hermes_agent"]["id"] if role in ["assistant", "tool"] else participants["human_user"]["id"]
        
        # Extract Claims from user prompts
        if role == "user" and len(claims) == 0 and len(str(content)) > 20:
            claim = {
                "id": generate_id("clm"),
                "object_type": "claim",
                "thread_id": thread_id,
                "author_participant_id": actor_id,
                "content": str(content)[:1000],
                "claim_type": "interpretive",
                "evidence_ids": [],
                "confidence_score": 0.8,
                "created_at": timestamp
            }
            claims.append(claim)
            thread["claim_ids"].append(claim["id"])

        # Track tool calls
        if role == "assistant" and "tool_calls" in msg and msg["tool_calls"]:
            for tc in msg["tool_calls"]:
                tc_id = tc.get("id") or tc.get("tool_call_id") or f"tc_{uuid.uuid4().hex[:8]}"
                pending_tool_calls[tc_id] = {
                    "name": tc.get("name", "unknown_tool"),
                    "arguments": tc.get("arguments", "{}"),
                    "timestamp": timestamp,
                    "actor_id": actor_id
                }

        # Extract Evidence from tool outputs
        if role == "tool":
            tc_id = msg.get("tool_call_id")
            if tc_id and tc_id in pending_tool_calls:
                tc_info = pending_tool_calls.pop(tc_id)
                ev = {
                    "id": generate_id("evd"),
                    "object_type": "evidence",
                    "thread_id": thread_id,
                    "title": f"Tool Execution: {tc_info['name']}",
                    "source_type": "hermes_tool_output",
                    "source_url": None,
                    "source_ref": json.dumps({"tool": tc_info['name'], "args": tc_info['arguments']})[:200],
                    "summary": str(content)[:500], # The actual tool output is the evidence
                    "content_hash": hash_payload({"tool": tc_info['name'], "output": content}),
                    "category": "tool_execution",
                    "credibility_score": 0.9,
                    "added_by_participant_id": tc_info['actor_id'],
                    "created_at": tc_info['timestamp']
                }
                evidence_items.append(ev)
                thread["evidence_ids"].append(ev["id"])

        # Create Audit Event for every message
        payload = {"role": role, "content_preview": str(content)[:100] if content else "", "has_tools": "tool_calls" in msg or role == "tool"}
        event = {
            "id": generate_id("evt"),
            "object_type": "audit_event",
            "thread_id": thread_id,
            "actor_participant_id": actor_id,
            "action_type": "message_sent" if role in ["user", "assistant"] else "tool_execution",
            "target_object_type": "thread",
            "target_object_id": thread_id,
            "payload_hash": hash_payload(payload),
            "previous_event_id": prev_event_id,
            "created_at": timestamp
        }
        audit_events.append(event)
        prev_event_id = event["id"]

    # 4. Assemble Export
    export = {
        "schema": "clista.protocol.v0",
        "protocolVersion": "clista.protocol.v0",
        "exportedAt": now,
        "threads": [thread],
        "participants": list(participants.values()),
        "claims": claims,
        "evidence": evidence_items,
        "audit_events": audit_events
    }

    # 5. Write Output
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2)
    
    print(f"Successfully ingested {len(messages)} messages.")
    print(f"Generated: 1 Thread, {len(participants)} Participants, {len(claims)} Claims, {len(evidence_items)} Evidence items, {len(audit_events)} Audit Events.")
    print(f"Output written to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Hermes session into ClisTa Protocol v0 format")
    parser.add_argument("--input", required=True, help="Path to input .json or .ndjson Hermes session")
    parser.add_argument("--output", required=True, help="Path to output ClisTa thread export JSON")
    args = parser.parse_args()
    
    ingest_session(args.input, args.output)
