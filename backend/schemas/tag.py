from pydantic import BaseModel


class TagOut(BaseModel):
    name: str
    photo_count: int
