from abc import ABC, abstractmethod
from typing import Generator, Dict, Any, Optional
import os
import requests
import json

class LLMClient(ABC):
    """
    Abstract interface for LLM operations.
    Enables database and framework-agnostic LLM swapping.
    """

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        pass

    @abstractmethod
    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None) -> Generator[str, None, None]:
        pass

    @abstractmethod
    def health(self) -> Dict[str, Any]:
        pass

class OllamaClient(LLMClient):
    """
    Ollama-based implementation of the LLMClient using the local Qwen3:8b model.
    """

    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.timeout = 10.0

    def health(self) -> Dict[str, Any]:
        try:
            res = requests.get(f"{self.host}/api/tags", timeout=2.0)
            if res.status_code == 200:
                models = res.json().get("models", [])
                pulled_models = [m.get("name") for m in models]
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
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.1}
        }

        try:
            res = requests.post(f"{self.host}/api/chat", json=payload, timeout=self.timeout)
            if res.status_code == 200:
                return res.json().get("message", {}).get("content", "")
            return f"Ollama returned error: {res.status_code}"
        except requests.exceptions.RequestException:
            return "AI Copilot Offline"

    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None) -> Generator[str, None, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": 0.1}
        }

        try:
            res = requests.post(f"{self.host}/api/chat", json=payload, stream=True, timeout=self.timeout)
            if res.status_code == 200:
                for line in res.iter_lines():
                    if line:
                        try:
                            data = json.loads(line.decode('utf-8'))
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield token
                        except json.JSONDecodeError:
                            continue
            else:
                yield f"\n### AI Copilot Offline\nOllama error {res.status_code}."
        except requests.exceptions.RequestException:
            yield "\n### AI Copilot Offline\nOllama unreachable."
