from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ANTHROPIC_API_KEY: str = ""
    DB_PATH: str = "./data/app.db"
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_UPLOAD_BYTES: int = 26214400  # 25 MB

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
