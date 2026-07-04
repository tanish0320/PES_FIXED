from datetime import datetime
from app.analytics import sqlite_store as store


def detect_global_cycles() -> dict:
    """Detect cycles across the entire global financial graph in SQLite.

    Simplified version: fetches pre-detected cycles from DB instead of
    computing them in real-time (48K+ transactions is too slow for DFS).
    """
    # Fetch pre-computed cycles from database
    cycles_from_db = store.fetch_all_cycles()

    if cycles_from_db:
        # Return cycles from database
        return {
            "cycles": [dict(c) for c in cycles_from_db]
        }

    # Fallback: return empty cycles if none exist
    return {
        "cycles": []
    }
