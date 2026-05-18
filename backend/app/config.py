from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    aws_region: str = "eu-west-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bedrock_model_id: str = "eu.anthropic.claude-sonnet-4-5"
    database_url: str = "postgresql://parchi:parchi@db:5432/parchi"
    gcs_project_id: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
