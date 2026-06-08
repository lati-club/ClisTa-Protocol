#!/usr/bin/env python3
"""
ClisTa Protocol Core Reference Engine

Reads, validates, and projects state from ClisTa Protocol v0 exports.
"""

import json
import hashlib
from typing import Dict, List, Any, Optional

class ClisTaEngine:
    def __init__(self):
        self.export_data: Optional[Dict[str, Any]] = None
        self.index: Dict[str, Dict[str, Any]] = {
            "threads": {},
            "participants": {},
            "claims": {},
            "evidence": {},
            "positions": {},
            "objections": {},
            "alignment_states": {},
            "decisions": {},
            "minority_reports": {},
            "audit_events": {}
        }

    def load_export(self, path: str) -> None:
        """Load and index a ClisTa protocol export file."""
        with open(path, 'r', encoding='utf-8') as f:
            self.export_data = json.load(f)
        
        self._build_index()

    def _build_index(self) -> None:
        """Build O(1) lookup indexes for all protocol objects."""
        if not self.export_data:
            raise ValueError("No export data loaded. Call load_export() first.")
            
        for obj_type in self.index.keys():
            for obj in self.export_data.get(obj_type, []):
                obj_id = obj.get("id")
                if obj_id:
                    self.index[obj_type][obj_id] = obj

    def validate_referential_integrity(self) -> Dict[str, Any]:
        """Validate that all referenced IDs in the export actually exist."""
        errors = []
        
        for thread in self.index["threads"].values():
            thread_id = thread["id"]
            
            for p_id in thread.get("participant_ids", []):
                if p_id not in self.index["participants"]:
                    errors.append(f"Thread {thread_id}: references unknown participant {p_id}")
            
            for c_id in thread.get("claim_ids", []):
                if c_id not in self.index["claims"]:
                    errors.append(f"Thread {thread_id}: references unknown claim {c_id}")
                    
            for e_id in thread.get("evidence_ids", []):
                if e_id not in self.index["evidence"]:
                    errors.append(f"Thread {thread_id}: references unknown evidence {e_id}")
                    
            for d_id in thread.get("decision_ids", []):
                if d_id not in self.index["decisions"]:
                    errors.append(f"Thread {thread_id}: references unknown decision {d_id}")

        # Validate claim evidence references
        for claim in self.index["claims"].values():
            for e_id in claim.get("evidence_ids", []):
                if e_id not in self.index["evidence"]:
                    errors.append(f"Claim {claim['id']}: references unknown evidence {e_id}")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def validate_audit_chain(self, thread_id: str) -> Dict[str, Any]:
        """Validate the append-only audit chain for a specific thread."""
        events = [
            ev for ev in self.index["audit_events"].values() 
            if ev.get("thread_id") == thread_id
        ]
        
        # Sort by created_at to ensure chronological order
        events.sort(key=lambda x: x.get("created_at", ""))
        
        errors = []
        expected_prev_id = None
        
        for ev in events:
            ev_id = ev.get("id")
            prev_id = ev.get("previous_event_id")
            
            if prev_id != expected_prev_id:
                errors.append(
                    f"Audit chain broken at {ev_id}: expected previous_event_id "
                    f"'{expected_prev_id}', got '{prev_id}'"
                )
            
            expected_prev_id = ev_id

        return {
            "valid": len(errors) == 0,
            "event_count": len(events),
            "head_event_id": expected_prev_id,
            "errors": errors
        }

    def project_state(self, thread_id: str) -> Dict[str, Any]:
        """Reconstruct the current reasoning state for a given thread."""
        thread = self.index["threads"].get(thread_id)
        if not thread:
            raise ValueError(f"Thread {thread_id} not found in export.")

        # Gather related objects
        claims = [self.index["claims"][cid] for cid in thread.get("claim_ids", []) if cid in self.index["claims"]]
        evidence = [self.index["evidence"][eid] for eid in thread.get("evidence_ids", []) if eid in self.index["evidence"]]
        decisions = [self.index["decisions"][did] for did in thread.get("decision_ids", []) if did in self.index["decisions"]]
        alignment_states = [self.index["alignment_states"][aid] for aid in thread.get("alignment_state_ids", []) if aid in self.index["alignment_states"]]
        minority_reports = [self.index["minority_reports"][mid] for mid in thread.get("minority_report_ids", []) if mid in self.index["minority_reports"]]
        
        # Enrich claims with evidence details
        enriched_claims = []
        for claim in claims:
            claim_evidence = [
                self.index["evidence"][eid] 
                for eid in claim.get("evidence_ids", []) 
                if eid in self.index["evidence"]
            ]
            enriched_claims.append({
                **claim,
                "supporting_evidence": claim_evidence
            })

        # Enrich decisions with minority reports
        enriched_decisions = []
        for decision in decisions:
            decision_mr = [
                mr for mr in minority_reports 
                if mr.get("decision_id") == decision.get("id")
            ]
            enriched_decisions.append({
                **decision,
                "minority_reports": decision_mr
            })

        return {
            "schema": "clista.projected_state.v0",
            "thread_id": thread_id,
            "title": thread.get("title"),
            "problem_statement": thread.get("problem_statement"),
            "status": thread.get("status"),
            "participant_count": len(thread.get("participant_ids", [])),
            "claims": enriched_claims,
            "evidence_count": len(evidence),
            "alignment_states": alignment_states,
            "decisions": enriched_decisions,
            "projected_at": thread.get("updated_at")
        }

    def run_full_validation(self, thread_id: str) -> Dict[str, Any]:
        """Run all validation checks and return a comprehensive report."""
        ref_check = self.validate_referential_integrity()
        chain_check = self.validate_audit_chain(thread_id)
        
        return {
            "schema": "clista.validation_report.v0",
            "thread_id": thread_id,
            "referential_integrity": ref_check,
            "audit_chain": chain_check,
            "overall_valid": ref_check["valid"] and chain_check["valid"]
        }


if __name__ == "__main__":
    import sys
    
    export_path = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/mock_clista_export.json"
    
    print(f"Loading export: {export_path}")
    engine = ClisTaEngine()
    engine.load_export(export_path)
    
    # Get the first thread ID for testing
    thread_id = list(engine.index["threads"].keys())[0]
    print(f"Target Thread: {thread_id}\n")
    
    print("=== 1. Referential Integrity ===")
    ref_result = engine.validate_referential_integrity()
    print(f"Valid: {ref_result['valid']}")
    if ref_result['errors']:
        for err in ref_result['errors']:
            print(f"  - {err}")
            
    print("\n=== 2. Audit Chain Validation ===")
    chain_result = engine.validate_audit_chain(thread_id)
    print(f"Valid: {chain_result['valid']}")
    print(f"Event Count: {chain_result['event_count']}")
    print(f"Head Event ID: {chain_result['head_event_id']}")
    if chain_result['errors']:
        for err in chain_result['errors']:
            print(f"  - {err}")
            
    print("\n=== 3. Projected State ===")
    state = engine.project_state(thread_id)
    print(json.dumps(state, indent=2))
