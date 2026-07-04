from typing import List, Dict

class ConversationMemory:
    """
    Maintains a short conversation history (last 5 exchanges / 10 messages)
    independent per investigation.
    """

    def __init__(self):
        self._memories: Dict[str, List[Dict[str, str]]] = {}

    def get_history(self, case_id: str) -> List[Dict[str, str]]:
        if not case_id:
            return []
        return self._memories.get(case_id, [])

    def add_exchange(self, case_id: str, user_msg: str, assistant_msg: str):
        if not case_id:
            return
        
        if case_id not in self._memories:
            self._memories[case_id] = []
            
        history = self._memories[case_id]
        
        history.append({"role": "user", "content": user_msg})
        history.append({"role": "assistant", "content": assistant_msg})
        
        # Keep only last 5 exchanges (10 messages total)
        if len(history) > 10:
            self._memories[case_id] = history[-10:]

    def clear(self, case_id: str):
        if case_id in self._memories:
            del self._memories[case_id]
