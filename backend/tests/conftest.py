import os

# Set before any app module is imported so pydantic-settings picks them up.
os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "test-key")
os.environ["DB_PATH"] = ":memory:"

# Direct patch in case settings was already instantiated by pytest collection.
from app.config import settings  # noqa: E402
settings.ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]  # type: ignore[misc]
