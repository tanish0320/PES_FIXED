from typing import Dict, List, Tuple
import re

class IntentClassifier:
    """
    Weighted keyword intent classifier.
    Scores keywords and phrases dynamically to determine investigator intent.
    Completely LLM-independent.
    """

    INTENT_WEIGHTS = {
        "CASE_EXPLANATION": [
            ("suspicious", 3), ("risk", 2), ("high risk", 4), ("threat", 3), ("flagged", 2),
            ("explain risk", 4), ("danger", 2), ("critical", 3), ("violation", 2)
        ],
        "GRAPH_EXPLANATION": [
            ("graph", 5), ("flow", 4), ("money flow", 5), ("incoming", 3), ("outgoing", 3),
            ("connections", 3), ("nodes", 4), ("edges", 4), ("neighbor", 4), ("path", 2)
        ],
        "REPORT_SUMMARY": [
            ("summarize report", 5), ("summary of report", 5), ("explain report", 4),
            ("findings", 2), ("executive summary", 5), ("overview", 2)
        ],
        "ENTITY_LOOKUP": [
            ("entity", 4), ("merchant", 3), ("person", 3), ("counterparty", 4), ("name", 2),
            ("who is", 4), ("beneficiary", 3), ("beneficiaries", 3), ("upi id", 4), ("ifsc", 4)
        ],
        "TRANSACTION_LOOKUP": [
            ("transaction", 4), ("tx-", 5), ("txid", 5), ("transfer", 2), ("rupee", 2),
            ("rs.", 2), ("amount", 2), ("debit", 3), ("credit", 3), ("payment", 2), ("cash", 2)
        ],
        "PATTERN_EXPLANATION": [
            ("pattern", 5), ("structuring", 4), ("layering", 4), ("circular flow", 5),
            ("fan-out", 5), ("merge", 4), ("velocity", 3), ("risk pattern", 4), ("smurfing", 5)
        ],
        "TIMELINE_SUMMARY": [
            ("timeline", 5), ("chronology", 4), ("milestone", 3), ("sequence", 4),
            ("history", 2), ("events", 2), ("date", 1), ("time", 1)
        ],
        "INVESTIGATION_SUMMARY": [
            ("investigation", 3), ("case", 2), ("overall", 2), ("what is this case", 4),
            ("sentinel report", 3), ("audit overview", 3)
        ],
        "REPORT_GENERATION": [
            ("generate report", 5), ("create report", 4), ("generate fir", 5),
            ("fir summary", 5), ("write report", 4), ("export report", 3)
        ]
    }

    @classmethod
    def classify(cls, message: str, page: str) -> str:
        msg = message.lower().strip()
        words = msg.split()

        # 1. Check for FOLLOW_UP intent (short conversational cues)
        short_cues = {"why", "how", "what", "who", "show", "yes", "no", "ok", "okay", "tell me more", "explain"}
        if len(words) <= 4 and any(cue in msg for cue in short_cues):
            return "FOLLOW_UP"

        # 2. Score intents using weighted keyword matchers
        scores = {intent: 0 for intent in cls.INTENT_WEIGHTS}
        for intent, keyword_tuples in cls.INTENT_WEIGHTS.items():
            for kw, weight in keyword_tuples:
                # Use regex word boundaries or substring matching for multi-word phrases
                if kw in msg:
                    scores[intent] += weight

        # Filter out zero scores
        scored_intents = [(intent, score) for intent, score in scores.items() if score > 0]
        
        if scored_intents:
            # Sort by score descending
            scored_intents.sort(key=lambda x: x[1], reverse=True)
            return scored_intents[0][0]

        # 3. Fallbacks based on active page context
        if page == "graph":
            return "GRAPH_EXPLANATION"
        elif page == "report":
            return "REPORT_SUMMARY"
        elif page == "transactions":
            return "TRANSACTION_LOOKUP"

        return "GENERAL_KNOWLEDGE"
