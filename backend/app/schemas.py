from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    db: str
    anthropic_key_present: bool


class ModelInfo(BaseModel):
    id: str
    label: str


class ConversationCreate(BaseModel):
    title: str = "New conversation"
    model: str = "claude-sonnet-4-6"
    system_prompt: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    web_search_enabled: Optional[bool] = None


class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    system_prompt: Optional[str]
    web_search_enabled: bool
    updated_at: datetime
    message_count: int

    model_config = {"from_attributes": True}


class CitationOut(BaseModel):
    id: str
    url: str
    title: Optional[str]
    cited_text: Optional[str]
    start_index: Optional[int]
    end_index: Optional[int]

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    citations: list[CitationOut] = []

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: str
    title: str
    model: str
    system_prompt: Optional[str]
    web_search_enabled: bool
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    attachment_ids: list[str] = []


class AttachmentOut(BaseModel):
    id: str
    filename: str
    media_type: str
    size_bytes: int

    model_config = {"from_attributes": True}
