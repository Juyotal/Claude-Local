# Claude Local

A single-user web app with a Claude.ai-like feel, powered by the Anthropic API.

## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.x (async), SQLite, pydantic-settings
- **Dev server**: uvicorn
- **Package manager**: pip + pyproject.toml (hatchling build backend)

## Setup

```bash
git clone <repo>
cd claude-local
cp backend/.env.example backend/.env
# Edit backend/.env and fill in ANTHROPIC_API_KEY
```

## Run

```bash
cd backend
pip install -e .
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.
The SQLite database is created automatically at `./data/app.db` on first run.

## Tests

```bash
cd backend
pip install -e ".[dev]"
pytest
```

Tests run against an in-memory SQLite database; no `.env` file required.

## Configuration

All settings are read from environment variables (or `backend/.env`):

| Variable            | Required | Default                    | Description                     |
|---------------------|----------|----------------------------|---------------------------------|
| `ANTHROPIC_API_KEY` | Yes      | —                          | Your Anthropic API key          |
| `DB_PATH`           | No       | `./data/app.db`            | Path to SQLite database file    |
| `CORS_ORIGINS`      | No       | `http://localhost:3000`    | Comma-separated allowed origins |
| `MAX_UPLOAD_BYTES`  | No       | `26214400`                 | Max attachment upload size (25 MB) |

## Attachment storage

Attachment binary data (`Attachment.data`) is stored as raw bytes in a SQLite BLOB column.
Callers are responsible for base64-encoding/decoding at the API boundary if needed.
