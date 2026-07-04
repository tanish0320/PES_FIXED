import json
import re
from typing import Dict, Any, List

class ResponseFormatter:
    """
    Format model output into the strict JSON response format expected by the frontend.
    Handles extraction from Markdown code blocks, JSON parse failures, and ensures
    default values are populated correctly.
    """

    @classmethod
    def format_response(cls, raw_text: str, intent: str) -> Dict[str, Any]:
        # Initialize default payload structure
        default_payload = {
            "answer": "The supplied investigation data does not contain enough evidence to answer this question.",
            "evidence": [],
            "confidence": 70,
            "sources": ["Current Investigation Data"],
            "suggested_actions": [],
            "follow_up_questions": []
        }

        # 1. Clean backticks and markup if LLM wrapped in code block
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```"):
            # Strip first line (e.g. ```json) and last line (```)
            lines = cleaned_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()

        # 2. Try loading JSON directly
        try:
            parsed = json.loads(cleaned_text)
            # Ensure it is a dictionary
            if isinstance(parsed, dict):
                # Ensure confidence is an integer
                if "confidence" in parsed:
                    try:
                        parsed["confidence"] = int(str(parsed["confidence"]).replace("%", ""))
                    except ValueError:
                        parsed["confidence"] = 80
                
                # Fill missing keys
                for k, v in default_payload.items():
                    if k not in parsed or parsed[k] is None:
                        parsed[k] = v
                
                # Ensure follow-up questions are populated and contain at least 3 questions
                if not parsed.get("follow_up_questions") or len(parsed.get("follow_up_questions", [])) < 3:
                    parsed["follow_up_questions"] = cls._get_default_questions(intent)
                
                return parsed
        except json.JSONDecodeError:
            pass

        # 3. Fallback: Parse using regex if JSON loading failed
        parsed_payload = default_payload.copy()
        
        # Try to extract "answer"
        answer_match = re.search(r'"answer"\s*:\s*"(.*?)"', cleaned_text, re.DOTALL)
        if answer_match:
            parsed_payload["answer"] = answer_match.group(1).replace('\\"', '"').replace('\\n', '\n')
        else:
            # Check if there is plain text we can treat as the answer
            plain_answer = re.sub(r'[{}]', '', cleaned_text).strip()
            if len(plain_answer) > 50:
                parsed_payload["answer"] = plain_answer

        # Try to extract "confidence"
        conf_match = re.search(r'"confidence"\s*:\s*(\d+)', cleaned_text)
        if conf_match:
            parsed_payload["confidence"] = int(conf_match.group(1))

        # Try to extract lists (evidence, sources, suggested_actions, follow_up_questions)
        for key in ["evidence", "sources", "suggested_actions", "follow_up_questions"]:
            list_match = re.search(r'"' + key + r'"\s*:\s*\[(.*?)\]', cleaned_text, re.DOTALL)
            if list_match:
                items_str = list_match.group(1)
                items = re.findall(r'"(.*?)"', items_str)
                if items:
                    parsed_payload[key] = [item.replace('\\"', '"') for item in items]

        # Ensure follow-up questions
        if not parsed_payload.get("follow_up_questions") or len(parsed_payload["follow_up_questions"]) < 3:
            parsed_payload["follow_up_questions"] = cls._get_default_questions(intent)

        return parsed_payload

    @staticmethod
    def _get_default_questions(intent: str) -> List[str]:
        if intent == "GRAPH_EXPLANATION":
            return [
                "Why is this account suspicious?",
                "Trace downstream money flow.",
                "Detail circular flow loops in the graph."
            ]
        elif intent in ["REPORT_SUMMARY", "REPORT_GENERATION", "TIMELINE_SUMMARY"]:
            return [
                "Explain the layering risk score.",
                "Summarize critical transaction flags.",
                "Show suspicious beneficiaries."
            ]
        elif intent == "PATTERN_EXPLANATION":
            return [
                "Explain the Fan-Out structuring pattern.",
                "What triggers a circular loop flag?",
                "Which transaction had the highest risk contribution?"
            ]
        return [
            "Why is this account suspicious?",
            "Trace money flow in the graph.",
            "Generate FIR summary of the report."
        ]
