"""
MemoryService — Supermemory-backed inspection memory.

Stores inspection results (text, audio transcripts, frames) in the Supermemory
cloud API with semantic search. Data is scoped per machine via container_tag.
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from supermemory import Supermemory

load_dotenv()

DEFAULT_MACHINE_ID = "W8210127"


class MemoryService:
    def __init__(self):
        api_key = os.getenv("SUPERMEMORY_API_KEY")
        if not api_key:
            print(
                "[MEMORY] WARNING: SUPERMEMORY_API_KEY not set in .env — "
                "running in local-only mode (no cloud memory). "
                "Get a free key at https://supermemory.ai"
            )
            self.client = None
        else:
            self.client = Supermemory(api_key=api_key)
            print("[MEMORY] Initialized Supermemory cloud service")

    @staticmethod
    def _machine_tag(machine_id: str) -> str:
        """Normalize machine ID into a container tag."""
        return f"machine-{machine_id}"

    def save_inspection(
        self,
        inspection_id: str,
        component: str,
        grade: str,
        notes: str,
        raw_analysis: dict,
        audio_transcript: str = "",
        frames: list = None,
        machine_id: str = DEFAULT_MACHINE_ID,
    ) -> bool:
        """
        Save an inspection to Supermemory.

        Stores a structured text document with metadata for filtering,
        scoped to the machine's container tag.
        """
        if frames is None:
            frames = []

        if not self.client:
            print(f"[MEMORY] Skipping save (no API key): {inspection_id} / {component}")
            return False

        try:
            # Build a rich text document for semantic search
            content_parts = [
                f"INSPECTION REPORT — {inspection_id}",
                f"Component: {component}",
                f"Grade: {grade}",
                f"Final Status: {raw_analysis.get('final_status', 'UNKNOWN')}",
                f"Notes: {notes}",
            ]

            # Include chain-of-thought reasoning if present
            cot = raw_analysis.get("chain_of_thought", {})
            if cot:
                content_parts.append(f"Visual Observations: {cot.get('visual_shows', cot.get('observations', ''))}")
                content_parts.append(f"Audio Says: {cot.get('audio_says', '')}")
                content_parts.append(f"Comparison: {cot.get('comparison', '')}")

            if audio_transcript:
                content_parts.append(f"Operator Audio Transcript: {audio_transcript}")

            # Include first frame as inline base64 reference (supermemory can index text)
            if frames:
                content_parts.append(f"Frame Count: {len(frames)}")
                # Store the first frame inline — supermemory processes text content
                first_frame = frames[0]
                if ',' in first_frame:
                    first_frame = first_frame.split(',')[1]
                content_parts.append(f"Primary Frame (base64): {first_frame[:200]}...")  # Truncated reference

            content = "\n".join(content_parts)

            # Parse date from inspection_id (format: YYYYMMDD_HHMMSS_ffffff)
            inspection_date = "unknown"
            if len(inspection_id) >= 8 and inspection_id[:8].isdigit():
                d = inspection_id[:8]
                inspection_date = f"{d[:4]}-{d[4:6]}-{d[6:8]}"

            # Store in Supermemory
            result = self.client.add(
                content=content,
                custom_id=inspection_id,
                container_tag=self._machine_tag(machine_id),
                metadata={
                    "component": component,
                    "grade": grade,
                    "final_status": raw_analysis.get("final_status", "UNKNOWN"),
                    "checklist_mapped_item": raw_analysis.get("checklist_mapped_item", component),
                    "checklist_grade": raw_analysis.get("checklist_grade", grade),
                    "verdict_reasoning": raw_analysis.get("verdict_reasoning", notes),
                    "recommendation": raw_analysis.get("recommendation", ""),
                    "inspection_date": inspection_date,
                    "has_audio": bool(audio_transcript),
                    "frame_count": float(len(frames)),
                },
            )

            print(f"[MEMORY] Saved inspection {inspection_id} for {component} -> Supermemory (tag: {self._machine_tag(machine_id)})")
            return True

        except Exception as e:
            print(f"[ERROR] Supermemory save failed: {e}")
            return False

    def get_history(
        self,
        component_query: str,
        limit: int = 5,
        machine_id: str = DEFAULT_MACHINE_ID,
    ) -> list:
        """
        Retrieve past inspection records for a component using semantic search.

        Unlike the old JSON approach, this finds semantically similar records —
        e.g., searching "tire" will match "Tires and Rims" records.
        """
        try:
            if not self.client:
                return []

            response = self.client.search.documents(
                q=f"{component_query} inspection history",
                container_tags=[self._machine_tag(machine_id)],
                limit=limit,
                include_summary=True,
                include_full_docs=True,
            )

            # Convert Supermemory results back to our internal format
            records = []
            for doc in response.results:
                metadata = {}
                if hasattr(doc, 'metadata') and doc.metadata:
                    metadata = dict(doc.metadata) if not isinstance(doc.metadata, dict) else doc.metadata

                records.append({
                    "inspection_id": getattr(doc, 'document_id', '') or metadata.get("custom_id", ""),
                    "component": metadata.get("component", "Unknown"),
                    "grade": metadata.get("grade", "None"),
                    "operator_notes": getattr(doc, 'summary', '') or "",
                    "audio_transcript": "",  # Not stored separately in metadata
                    "frame_count": int(metadata.get("frame_count", 0)),
                    "ai_analysis": {
                        "final_status": metadata.get("final_status", "UNKNOWN"),
                        "checklist_mapped_item": metadata.get("checklist_mapped_item", metadata.get("component", "Unknown")),
                        "checklist_grade": metadata.get("checklist_grade", metadata.get("grade", "None")),
                        "verdict_reasoning": metadata.get("verdict_reasoning", ""),
                        "recommendation": metadata.get("recommendation", ""),
                    },
                    "content": getattr(doc, 'content', '') or "",
                    "score": getattr(doc, 'score', 0),
                })

            return records

        except Exception as e:
            print(f"[ERROR] Supermemory search failed for '{component_query}': {e}")
            return []

    def get_available_dates(self, machine_id: str = DEFAULT_MACHINE_ID) -> list:
        """
        Return a sorted list of distinct inspection dates (YYYY-MM-DD), newest first.
        """
        try:
            if not self.client:
                return []

            # Search broadly to get documents, extract dates from metadata
            response = self.client.documents.list(
                container_tags=[self._machine_tag(machine_id)],
                limit=100,
            )

            dates = set()
            docs = getattr(response, 'memories', None) or getattr(response, 'results', [])
            for doc in docs:
                metadata = {}
                if hasattr(doc, 'metadata') and doc.metadata:
                    metadata = dict(doc.metadata) if not isinstance(doc.metadata, dict) else doc.metadata
                date_str = metadata.get("inspection_date", "")
                if date_str and date_str != "unknown":
                    dates.add(date_str)

            return sorted(dates, reverse=True)

        except Exception as e:
            print(f"[ERROR] Supermemory dates fetch failed: {e}")
            return []

    def get_history_by_date(
        self,
        date_str: str,
        machine_id: str = DEFAULT_MACHINE_ID,
    ) -> list:
        """
        Fetch all inspection records for a given date (YYYY-MM-DD).
        """
        try:
            if not self.client:
                return []

            # Search for all inspections on this date
            response = self.client.search.documents(
                q=f"inspection on {date_str}",
                container_tags=[self._machine_tag(machine_id)],
                limit=50,
                include_full_docs=True,
                include_summary=True,
                filters={
                    "AND": [
                        {
                            "key": "inspection_date",
                            "value": date_str,
                            "operator": "eq",
                        }
                    ]
                },
            )

            records = []
            for doc in response.results:
                metadata = {}
                if hasattr(doc, 'metadata') and doc.metadata:
                    metadata = dict(doc.metadata) if not isinstance(doc.metadata, dict) else doc.metadata

                records.append({
                    "inspection_id": getattr(doc, 'document_id', '') or metadata.get("custom_id", ""),
                    "component": metadata.get("component", "Unknown"),
                    "grade": metadata.get("grade", "None"),
                    "operator_notes": getattr(doc, 'summary', '') or "",
                    "audio_transcript": "",
                    "frame_count": int(metadata.get("frame_count", 0)),
                    "ai_analysis": {
                        "final_status": metadata.get("final_status", "UNKNOWN"),
                        "checklist_mapped_item": metadata.get("checklist_mapped_item", metadata.get("component", "Unknown")),
                        "checklist_grade": metadata.get("checklist_grade", metadata.get("grade", "None")),
                        "verdict_reasoning": metadata.get("verdict_reasoning", ""),
                        "recommendation": metadata.get("recommendation", ""),
                    },
                    "content": getattr(doc, 'content', '') or "",
                })

            return records

        except Exception as e:
            print(f"[ERROR] Supermemory history by date failed for {date_str}: {e}")
            return []


# Singleton instance
memory = MemoryService()
