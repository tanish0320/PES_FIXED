from abc import ABC, abstractmethod
from typing import Generator, Dict, Any, Optional
import os
import requests
import json
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("copilot.llm_client")

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
    Ollama-based implementation of the LLMClient using a local Qwen3:8b model.
    Disables chain-of-thought/thinking blocks explicitly with think=false.
    """

    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.timeout = 60.0 # 60 seconds timeout as requested
        
        # Reuse HTTP client to avoid creating new connections on every request
        self.session = requests.Session()

    def health(self) -> Dict[str, Any]:
        """
        Verify if Ollama is reachable and the model exists.
        """
        try:
            res = self.session.get(f"{self.host}/api/tags", timeout=2.0)
            if res.status_code == 200:
                models = res.json().get("models", [])
                pulled_models = [m.get("name") for m in models]
                # Check direct match or tagless match
                has_model = any(self.model in m or m in self.model for m in pulled_models)
                if has_model:
                    return {
                        "status": "healthy",
                        "model": self.model
                    }
        except Exception as e:
            logger.error(f"Ollama health check failed: {str(e)}")
            
        return {
            "status": "offline"
        }

    def _combine_prompt(self, prompt: str, system_prompt: Optional[str]) -> str:
        """
        Combine System Prompt + Investigation Context + Officer Question
        """
        combined = ""
        if system_prompt:
            combined += f"{system_prompt.strip()}\n\n"
        combined += prompt.strip()
        return combined

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Non-streaming generation request to Ollama using /api/generate.
        """
        combined_prompt = self._combine_prompt(prompt, system_prompt)
        prompt_len = len(combined_prompt)

        payload = {
            "model": self.model,
            "prompt": combined_prompt,
            "stream": False,
            "options": {
                "think": False,
                "temperature": 0.0
            }
        }

        start_time = time.time()
        try:
            res = self.session.post(f"{self.host}/api/generate", json=payload, timeout=self.timeout)
            generation_time = time.time() - start_time

            if res.status_code == 200:
                response_text = res.json().get("response", "").strip()
                # Estimate token count (average ~4 characters per token)
                token_count = len(response_text.split())
                
                print(f"[OLLAMA] Generate Success: Prompt Length={prompt_len}, Time={generation_time:.2f}s, Estimated Tokens={token_count}")
                logger.info(f"Ollama generate success. Prompt length: {prompt_len}, Time: {generation_time:.2f}s, Tokens: {token_count}")
                return response_text
            else:
                err_msg = f"Ollama returned error: {res.status_code}"
                logger.error(err_msg)
                return "AI Copilot Offline"
        except requests.exceptions.Timeout:
            logger.error("Ollama generate request timed out after 60s.")
            return "AI Copilot Timeout"
        except Exception as e:
            logger.error(f"Ollama generate failed: {str(e)}")
            return "AI Copilot Offline"

    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None) -> Generator[str, None, None]:
        """
        Streaming generation request to Ollama using /api/generate.
        """
        combined_prompt = self._combine_prompt(prompt, system_prompt)
        prompt_len = len(combined_prompt)

        payload = {
            "model": self.model,
            "prompt": combined_prompt,
            "stream": True,
            "options": {
                "think": False,
                "temperature": 0.0
            }
        }

        start_time = time.time()
        token_count = 0
        
        try:
            res = self.session.post(f"{self.host}/api/generate", json=payload, stream=True, timeout=self.timeout)
            if res.status_code == 200:
                for line in res.iter_lines():
                    if line:
                        try:
                            data = json.loads(line.decode('utf-8'))
                            token = data.get("response", "")
                            if token:
                                token_count += 1
                                yield token
                        except json.JSONDecodeError:
                            continue
                
                generation_time = time.time() - start_time
                print(f"[OLLAMA] Stream Complete: Prompt Length={prompt_len}, Time={generation_time:.2f}s, Tokens={token_count}")
                logger.info(f"Ollama stream success. Prompt length: {prompt_len}, Time: {generation_time:.2f}s, Tokens: {token_count}")
            else:
                logger.error(f"Ollama stream error status: {res.status_code}")
                raise requests.exceptions.RequestException(f"Error status {res.status_code}")
        except requests.exceptions.Timeout as e:
            logger.error("Ollama stream request timed out after 60s.")
            raise e
        except Exception as e:
            logger.error(f"Ollama stream failed: {str(e)}")
            raise e
