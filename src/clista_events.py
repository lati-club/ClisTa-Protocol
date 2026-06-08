#!/usr/bin/env python3
"""
Canonical ClisTa event-log primitives (Python).

Byte-for-byte compatible with the JavaScript engine's hashing in
``src/integrity.js``: stable (recursively key-sorted, compact) JSON
serialization, SHA-256 content hashes, and previous_hash chaining. This lets
Python tooling emit an append-only NDJSON event log that the JS engine accepts
as valid (``node src/cli.js validate --events <log>``).

Mirrors:
  - stableStringify / sortKeys            -> stable_stringify
  - contentHash                           -> content_hash
  - canonicalEventHashMaterial            -> _v1_material
  - computeEventHash (v1 path)            -> compute_event_hash
  - prepareEventForAppend / writeEvents   -> prepare_and_chain
  - serializeEventsNdjson                 -> serialize_ndjson
"""

import hashlib
import json
from typing import Any, Dict, List

PROTOCOL_VERSION = "clista.protocol.v0"
EVENT_HASH_VERSION = "clista.event_hash.v1"


def stable_stringify(value: Any) -> str:
    """Recursively key-sorted, compact JSON — matches JS stableStringify.

    json.dumps with sort_keys sorts object keys alphabetically (recursively)
    and preserves array order, exactly like the JS sortKeys helper. The compact
    separators match JSON.stringify, and ensure_ascii=False keeps non-ASCII
    characters as UTF-8 (JSON.stringify does not \\u-escape them).
    """
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(value: Any) -> str:
    """sha256:<hex> over the stable serialization — matches JS contentHash."""
    return "sha256:" + hashlib.sha256(stable_stringify(value).encode("utf-8")).hexdigest()


def _v1_material(event: Dict[str, Any]) -> Dict[str, Any]:
    """All event fields except the two hash fields (and None ~ JS undefined).

    Build events without null-valued keys so this exclusion can never diverge
    from what the JS validator sees in the written line.
    """
    return {
        k: v
        for k, v in event.items()
        if k not in ("content_hash", "previous_hash") and v is not None
    }


def compute_event_hash(event: Dict[str, Any]) -> str:
    """Compute the v1 content_hash for an event (event must carry hash_version)."""
    return content_hash(_v1_material(event))


def prepare_and_chain(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Stamp version fields, chain previous_hash, and compute content_hash.

    Mirrors writeEvents/prepareEventForAppend in src/events.js + integrity.js:
    each event's previous_hash points at the prior event's content_hash, and the
    content_hash is computed over material that includes that previous_hash.
    Returns new dicts; inputs are not mutated.
    """
    prepared: List[Dict[str, Any]] = []
    previous_hash = None
    for event in events:
        item = {k: v for k, v in event.items() if k not in ("content_hash", "previous_hash")}
        item.setdefault("protocol_version", PROTOCOL_VERSION)
        item.setdefault("hash_version", EVENT_HASH_VERSION)
        if previous_hash:
            item["previous_hash"] = previous_hash
        item["content_hash"] = compute_event_hash(item)
        previous_hash = item["content_hash"]
        prepared.append(item)
    return prepared


def serialize_ndjson(events: List[Dict[str, Any]]) -> str:
    """One canonical JSON line per event, newline-terminated (empty -> "")."""
    if not events:
        return ""
    return "\n".join(stable_stringify(event) for event in events) + "\n"
