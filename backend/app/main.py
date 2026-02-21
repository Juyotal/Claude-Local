from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import dispose_engine, init_db, init_engine
from .routers import attachments, conversations, health, models, uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_path = settings.DB_PATH
    if db_path == ":memory:":
        db_url = "sqlite+aiosqlite:///:memory:"
    else:
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        db_url = f"sqlite+aiosqlite:///{db_path}"

    init_engine(db_url)
    await init_db()
    yield
    await dispose_engine()


app = FastAPI(title="Claude Local", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(models.router)
app.include_router(conversations.router)
app.include_router(uploads.router)
app.include_router(attachments.router)
