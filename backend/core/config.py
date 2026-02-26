from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+psycopg2://hotprevue:hotprevue@localhost:5432/hotprevue"
    coldpreview_dir: str = "/data/coldpreviews"


settings = Settings()
