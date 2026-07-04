import re
from typing import List, Dict, Any, Set

class CitationManager:
    """
    Validates citations inside the generated LLM text against the raw context transactions.
    Rejects and hides unverified or hallucinated transaction IDs.
    """

    @staticmethod
    def validate_text(text: str, valid_tx_ids: Set[str]) -> str:
        tx_pattern = re.compile(r'\bTX-\w+\b', re.IGNORECASE)
        citations = tx_pattern.findall(text)
        
        for cit in citations:
            cit_upper = cit.upper()
            if cit_upper not in valid_tx_ids:
                # Replace hallucinated reference
                text = re.sub(r'\b' + re.escape(cit) + r'\b', "[unverified transaction reference]", text)
        return text

    @classmethod
    def validate_and_clean(cls, data: Dict[str, Any], raw_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates transaction IDs in the answer and evidence strings against actual transactions.
        """
        # Collect valid transactions
        valid_tx_ids = set()
        for tx in raw_context.get("transactions", []):
            tid = tx.get("tx_id")
            if tid:
                valid_tx_ids.add(str(tid).upper())
                
        for edge in raw_context.get("graph", {}).get("edges", []):
            tid = edge.get("tx_id")
            if tid:
                valid_tx_ids.add(str(tid).upper())

        # Validate answer text
        if "answer" in data and isinstance(data["answer"], str):
            data["answer"] = cls.validate_text(data["answer"], valid_tx_ids)

        # Validate evidence list
        if "evidence" in data and isinstance(data["evidence"], list):
            cleaned_evidence = []
            for item in data["evidence"]:
                if isinstance(item, str):
                    cleaned_evidence.append(cls.validate_text(item, valid_tx_ids))
                else:
                    cleaned_evidence.append(item)
            data["evidence"] = cleaned_evidence

        return data
