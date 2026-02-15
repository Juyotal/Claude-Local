from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    db: str
    anthropic_key_present: bool
