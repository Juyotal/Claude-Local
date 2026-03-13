# Claude Local

A local, single-user web app that gives you a Claude.ai-style chat interface over your own Anthropic API key. Runs entirely on `localhost` — no auth, no external services beyond the Anthropic API itself.

![Claude Local screenshot](docs/screenshot-chat.png)
![Citations screenshot](docs/screenshot-citations.png)

> Screenshots are placeholders — add your own after first run.

---

## Features

- **Multiple conversations** — persisted in a local SQLite database across restarts
- **File attachments** — drag-and-drop or click to attach images, PDFs, and code/text files; sent inline to the API
- **Model picker** — switch between Opus, Sonnet, and Haiku families per conversation
- **Per-conversation system prompt** — set a custom persona or instructions
- **Streaming responses** — live token-by-token output via SSE
- **Markdown + syntax highlighting** — code blocks with copy button, GFM tables, task lists
- **Web search** — Anthropic server-side `web_search_20250305` tool with live searching indicator and inline citations
- **Dark / light mode** — persisted to localStorage
- **Empty states** — friendly first-run experience with quick-suggestion buttons
- **API-key banner** — blocking warning if `ANTHROPIC_API_KEY` is not set

---

## Supported models

| Family  | Model ID                        |
|---------|---------------------------------|
| Opus 4  | `claude-opus-4-7`               |
| Sonnet 4 | `claude-sonnet-4-6` (default)  |
| Haiku 4 | `claude-haiku-4-5-20251001`     |

To add or remove models, edit `backend/app/routers/models.py`.

---

## Supported file types

| Category | MIME types |
|----------|------------|
| Images   | `image/png`, `image/jpeg`, `image/gif`, `image/webp` |
| Documents | `application/pdf` |
| Text / code | `text/plain`, `text/markdown`, `text/csv`, `text/html`, `text/css`, `text/xml`, `text/yaml`, `text/javascript`, `text/typescript`, `text/x-python`, `text/x-c`, `text/x-java`, `text/x-rust`, `text/x-go`, `text/x-ruby`, and more |
| Structured | `application/json`, `application/xml`, `application/toml`, `application/x-yaml` |

Unknown binary files that decode cleanly as UTF-8 are also accepted as `text/plain`. Maximum size: **25 MB** per file (configurable via `MAX_UPLOAD_BYTES`).

---

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1 — Clone and configure

```bash
git clone <repo-url>
cd claude-local
cp backend/.env.example backend/.env
# Open backend/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2 — Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The API starts at **http://localhost:8000**. The SQLite database is created automatically at `./data/app.db` on first run.

### 3 — Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Configuration

All settings are read from environment variables or `backend/.env`:

| Variable              | Required | Default                  | Description                                |
|-----------------------|----------|--------------------------|--------------------------------------------|
| `ANTHROPIC_API_KEY`   | **Yes**  | —                        | Your Anthropic API key (`sk-ant-…`)        |
| `DB_PATH`             | No       | `./data/app.db`          | Path to the SQLite database file           |
| `CORS_ORIGINS`        | No       | `http://localhost:3000`  | Comma-separated list of allowed origins    |
| `MAX_UPLOAD_BYTES`    | No       | `26214400` (25 MB)       | Maximum file attachment size in bytes      |
| `WEB_SEARCH_MAX_USES` | No       | `5`                      | Max web-search tool calls per message      |

---

## Running tests

### Backend

```bash
cd backend
pip install -e ".[dev]"
pytest
```

Tests run against an in-memory SQLite database — no `.env` required.

### Frontend

```bash
cd frontend
npm test
```

Runs Vitest in CI mode. Uses jsdom + Testing Library. All tests are strict TypeScript (no `any`).

---

## Project structure

```
claude-local/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + lifespan
│   │   ├── config.py                # pydantic-settings
│   │   ├── db.py                    # async SQLAlchemy engine
│   │   ├── models.py                # ORM: Conversation, Message, Attachment, Citation
│   │   ├── schemas.py               # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── conversations.py     # CRUD + SSE streaming endpoint
│   │   │   ├── uploads.py           # File upload + delete
│   │   │   ├── attachments.py       # File download
│   │   │   ├── config.py            # Upload limits endpoint
│   │   │   ├── models.py            # List available Claude models
│   │   │   └── health.py            # Health check
│   │   └── services/
│   │       ├── anthropic_client.py  # Streaming wrapper for the Anthropic SDK
│   │       ├── message_builder.py   # Builds Anthropic content blocks from attachments
│   │       └── file_types.py        # MIME type classifier
│   └── tests/
├── frontend/
│   ├── app/                         # Next.js App Router pages
│   ├── components/                  # React components
│   │   ├── ChatPane.tsx             # Main chat view
│   │   ├── Composer.tsx             # Message input with file upload
│   │   ├── MessageList.tsx          # Message rendering, citations, search indicator
│   │   └── Sidebar.tsx              # Conversation list + management
│   ├── lib/
│   │   ├── api.ts                   # Typed fetch client
│   │   ├── useChat.ts               # Streaming chat hook
│   │   ├── useAttachments.ts        # File upload state management
│   │   └── sse.ts                   # SSE parser
│   └── types/api.ts                 # Zod schemas mirroring backend types
└── README.md
```

---

## Known limitations

- **Single user only** — no authentication. Do not expose to a network.
- **No attachment search** — file content is sent to the API but not indexed locally.
- **SQLite only** — not designed for concurrent write access (fine for localhost).
- **Progress simulation** — upload progress bars are simulated (fetch does not expose real upload progress).
- **Favicon loading** — the Sources section fetches favicons from Google's s2 API; requires internet access.
- **No conversation export** — messages exist only in the local SQLite database.
