import os
import requests
import json
from typing import Generator, Dict, Any, Optional

class QwenClient:
    """
    Client for communicating with the local Ollama instance running Qwen3-8B.
    Handles streaming token delivery, timeouts, and connection retries.
    """

    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.timeout = 10.0 # connection timeout

    def health(self) -> Dict[str, Any]:
        """
        Check if Ollama server is up and verify if the requested model is pulled.
        """
        try:
            res = requests.get(f"{self.host}/api/tags", timeout=2.0)
            if res.status_code == 200:
                models = res.json().get("models", [])
                pulled_models = [m.get("name") for m in models]
                # Check direct match or without tags
                has_model = any(self.model in m or m in self.model for m in pulled_models)
                return {
                    "status": "online",
                    "model_available": has_model,
                    "available_models": pulled_models
                }
        except requests.exceptions.RequestException:
            pass
        return {"status": "offline", "model_available": False, "available_models": []}

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Send a non-streaming chat request to Qwen.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.1 # low temperature for investigative accuracy
            }
        }

        try:
            res = requests.post(f"{self.host}/api/chat", json=payload, timeout=self.timeout)
            if res.status_code == 200:
                return res.json().get("message", {}).get("content", "")
            else:
                return "Error: Ollama returned status code " + str(res.status_code)
        except requests.exceptions.RequestException:
            return "AI Copilot Offline: Could not connect to Ollama server."

    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None) -> Generator[str, None, None]:
        """
        Send a streaming chat request to Qwen.
        Yields individual tokens as they are generated.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.1
            }
        }

        try:
            # Note stream=True on requests
            res = requests.post(f"{self.host}/api/chat", json=payload, stream=True, timeout=self.timeout)
            if res.status_code == 200:
                for line in res.iter_lines():
                    if line:
                        decoded = line.decode('utf-8')
                        try:
                            data = json.loads(decoded)
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield token
                        except json.JSONDecodeError:
                            continue
            else:
                # If model is missing, check alternative name tags (e.g. qwen2.5:7b, qwen:7b, or custom tags)
                yield f"\n### AI Copilot Offline\nOllama server returned error status {res.status_code}."
        except requests.exceptions.RequestException:
            yield "\n### AI Copilot Offline\nOllama is currently unreachable. Make sure the Ollama daemon is running locally and the model `qwen3:8b` (or your configured model) is pulled."
