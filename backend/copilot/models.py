from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class CopilotChatRequest(BaseModel):
    message: str = Field(..., description="The user question or message")
    case_id: Optional[str] = Field(None, description="Active investigation case ID")
    selected_node: Optional[str] = Field(None, description="Currently selected graph node ID")
    page: str = Field("dashboard", description="Active page view")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active UI filters")

class CopilotChatResponse(BaseModel):
    answer: str = Field(..., description="General structured answer text")
    evidence: List[str] = Field(default_factory=list, description="Concrete evidence bullets")
    confidence: int = Field(85, description="Confidence percentage (0-100)")
    sources: List[str] = Field(default_factory=list, description="Data sources cited")
    suggested_actions: List[str] = Field(default_factory=list, description="Actions investigators can take")
    follow_up_questions: List[str] = Field(default_factory=list, description="3 recommended follow-up questions")
