import os
from typing import List, Dict, Any

class PromptBuilder:
    """
    Assembles prompts for the LLM. Loads template files, aggregates context blocks,
    and appends conversation history.
    """

    PROMPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts")

    @classmethod
    def _read_prompt(cls, filename: str) -> str:
        path = os.path.join(cls.PROMPTS_DIR, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    @classmethod
    def get_system_prompt(cls) -> str:
        return cls._read_prompt("system_v1.txt")

    @classmethod
    def build_user_prompt(cls, intent: str, context_str: str, history: List[Dict[str, str]], message: str) -> str:
        # Load intent template
        template = ""
        if intent == "GRAPH_EXPLANATION":
            template = cls._read_prompt("graph.txt")
        elif intent in ["REPORT_SUMMARY", "REPORT_GENERATION", "TIMELINE_SUMMARY"]:
            template = cls._read_prompt("report.txt")
        else:
            template = cls._read_prompt("explanation.txt")

        # Compile history
        history_str = ""
        if history:
            lines = ["\n### CONVERSATION MEMORY"]
            for h in history:
                role = "Investigator" if h["role"] == "user" else "Copilot"
                lines.append(f"{role}: {h['content']}")
            history_str = "\n".join(lines) + "\n"

        prompt = (
            f"You are SENTINEL AI Investigation Copilot.\n"
            f"You assist financial investigators.\n"
            f"You NEVER fabricate evidence.\n"
            f"You NEVER invent transactions.\n"
            f"You NEVER invent RBI guidelines.\n"
            f"You ONLY answer using supplied context.\n"
            f"If evidence is unavailable say so explicitly.\n"
            f"Always distinguish facts from assumptions.\n"
            f"Always cite evidence.\n"
            f"Always produce structured output.\n\n"
            f"### INTENT FOCUS\n{template}\n\n"
            f"### INVESTIGATION CONTEXT\n{context_str}\n"
            f"{history_str}\n"
            f"### OFFICER QUESTION\n"
            f"Officer: {message}\n"
            f"\n"
            f"Format your response as a valid JSON object matching the requested schema. Ensure all fields (answer, evidence, confidence, sources, suggested_actions, follow_up_questions) are populated."
        )
        return prompt
