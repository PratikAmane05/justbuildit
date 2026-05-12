from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "justbuildit"
    APP_ENV: str = "development"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    BACKEND_PUBLIC_URL: str = "http://localhost:8002"  # Change to your ngrok URL locally
    FRONTEND_URL: str = "https://justbuilditai.vercel.app"  # Production Vercel URL
    SECRET_KEY: str = "changeme-secret"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/justbuildit"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "changeme-super-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost"]

    # GitHub
    GITHUB_APP_ID: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # AWS Bedrock (AI task generation)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_DEFAULT_REGION: str = "ap-south-1"
    BEDROCK_MODEL_ID: str = "arn:aws:bedrock:ap-south-1:458479809589:inference-profile/apac.amazon.nova-micro-v1:0"

    # AWS S3
    S3_BUCKET_NAME: str = ""

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    SMTP_FROM_EMAIL: str = "noreply@justbuildit.ai"



settings = Settings()
