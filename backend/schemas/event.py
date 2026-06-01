import uuid
from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class EventCreate(BaseModel):
    name: str
    description: str | None = None
    start_date: dt_date | None = None
    end_date: dt_date | None = None
    location: str | None = None

    @model_validator(mode='after')
    def check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError('end_date må være lik eller etter start_date')
        return self


class EventPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: dt_date | None = None
    end_date: dt_date | None = None
    location: str | None = None
    cover_hothash: str | None = None

    @model_validator(mode='after')
    def check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError('end_date må være lik eller etter start_date')
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    start_date: dt_date | None
    end_date: dt_date | None
    location: str | None
    cover_hothash: str | None
    created_at: datetime
    photo_count: int = 0
