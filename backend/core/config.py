from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://hotprevue:hotprevue@localhost:5432/hotprevue"
    coldpreview_dir: str = "/data/coldpreviews"
    hotprevue_frontend_dir: str = ""
    ai_search_url: str = ""  # e.g. http://tenketank.tail764ab5.ts.net:8001

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
