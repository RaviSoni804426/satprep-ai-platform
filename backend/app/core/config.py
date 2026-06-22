import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/satprep"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = "supersecretjwtkeyforhashingandsigningsatprep"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    OTP_BYPASS: bool = True
    ALLOWED_ORIGINS: List[str] = ["*"]
    
    # S3 simulated or actual settings
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = "satprep-ai-bucket"

settings = Settings()
