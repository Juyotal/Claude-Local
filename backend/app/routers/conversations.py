from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Conversation, Message
from app.schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
    MessageOut,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(session: AsyncSession = Depends(get_session)):
    count_subq = (
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == Conversation.id)
        .scalar_subquery()
    )
    result = await session.execute(
        select(Conversation, count_subq.label("message_count")).order_by(
            Conversation.updated_at.desc()
        )
    )
    return [
        ConversationOut(
            id=conv.id,
            title=conv.title,
            model=conv.model,
            system_prompt=conv.system_prompt,
            web_search_enabled=conv.web_search_enabled,
            updated_at=conv.updated_at,
            message_count=count,
        )
        for conv, count in result.all()
    ]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: Optional[ConversationCreate] = Body(default=None),
    session: AsyncSession = Depends(get_session),
):
    if body is None:
        body = ConversationCreate()
    conv = Conversation(
        title=body.title,
        model=body.model,
        system_prompt=body.system_prompt,
    )
    session.add(conv)
    await session.commit()
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model=conv.model,
        system_prompt=conv.system_prompt,
        web_search_enabled=conv.web_search_enabled,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
):
    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        model=conv.model,
        system_prompt=conv.system_prompt,
        web_search_enabled=conv.web_search_enabled,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at)
            for m in messages
        ],
    )


@router.patch("/{conversation_id}", response_model=ConversationDetail)
async def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    session: AsyncSession = Depends(get_session),
):
    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.title is not None:
        conv.title = body.title
    if body.model is not None:
        conv.model = body.model
    if body.system_prompt is not None:
        conv.system_prompt = body.system_prompt
    if body.web_search_enabled is not None:
        conv.web_search_enabled = body.web_search_enabled

    conv.updated_at = datetime.now(timezone.utc)
    await session.commit()

    msgs_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        model=conv.model,
        system_prompt=conv.system_prompt,
        web_search_enabled=conv.web_search_enabled,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at)
            for m in messages
        ],
    )


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
):
    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.delete(conv)
    await session.commit()
