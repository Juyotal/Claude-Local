import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db import SessionLocal, get_session
from app.models import Conversation, Message
from app.schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
    MessageCreate,
    MessageOut,
)
from app.services.anthropic_client import get_client, stream_chat

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


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
):
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=422, detail="Content cannot be empty")

    try:
        get_client()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    count_result = await session.execute(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conversation_id, Message.role == "user")
    )
    is_first_user_message = count_result.scalar() == 0

    user_msg = Message(conversation_id=conversation_id, role="user", content=body.content)
    session.add(user_msg)

    if is_first_user_message and conv.title == "New conversation":
        conv.title = body.content[:40].strip()
        conv.updated_at = datetime.now(timezone.utc)

    await session.commit()

    msgs_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    history = [
        {"role": m.role, "content": m.content} for m in msgs_result.scalars().all()
    ]

    assistant_msg = Message(conversation_id=conversation_id, role="assistant", content="")
    session.add(assistant_msg)
    await session.commit()

    assistant_id = assistant_msg.id
    model = conv.model
    system_prompt = conv.system_prompt

    async def event_generator():
        yield {"event": "message_start", "data": json.dumps({"message_id": assistant_id})}

        full_content = ""
        try:
            async for chunk in stream_chat(history, model, system_prompt):
                if chunk["type"] == "delta":
                    full_content += chunk["text"]
                    yield {"event": "delta", "data": json.dumps({"text": chunk["text"]})}
                elif chunk["type"] == "usage":
                    yield {
                        "event": "message_stop",
                        "data": json.dumps({
                            "message_id": assistant_id,
                            "usage": {
                                "input_tokens": chunk["input_tokens"],
                                "output_tokens": chunk["output_tokens"],
                            },
                        }),
                    }
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            yield {"event": "error", "data": json.dumps({"message": str(exc)})}
        finally:
            if SessionLocal is not None:
                async with SessionLocal() as save_session:
                    row = await save_session.get(Message, assistant_id)
                    if row is not None:
                        row.content = full_content
                        await save_session.commit()

    return EventSourceResponse(event_generator())
