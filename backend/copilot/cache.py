from typing import Dict, Any, Optional

class CopilotCache:
    """
    In-memory cache for repeated AI queries on specific cases.
    Invalidates cached responses when the investigation data changes.
    """

    def __init__(self):
        # Key: (case_id, message_lower) -> value: dict (response payload)
        self._cache: Dict[tuple, Dict[str, Any]] = {}

    def get(self, case_id: Optional[str], message: str) -> Optional[Dict[str, Any]]:
        if not case_id:
            return None
        key = (case_id, message.strip().lower())
        return self._cache.get(key)

    def set(self, case_id: Optional[str], message: str, response: Dict[str, Any]):
        if not case_id:
            return
        key = (case_id, message.strip().lower())
        self._cache[key] = response

    def invalidate_case(self, case_id: str):
        """
        Invalidates all cache entries for a specific case.
        """
        keys_to_delete = [k for k in self._cache.keys() if k[0] == case_id]
        for k in keys_to_delete:
            del self._cache[k]

    def clear(self):
        self._cache.clear()
