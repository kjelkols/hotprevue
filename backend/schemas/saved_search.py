import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SearchCriterion(BaseModel):
    field: str
    operator: str
    value: Any = None


class SavedSearchCreate(BaseModel):
    name: str
    description: str | None = None
    logic: str = "AND"
    criteria: list[SearchCriterion] = []


class SavedSearchPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    logic: str | None = None
    criteria: list[SearchCriterion] | None = None


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    logic: str
    criteria: list[SearchCriterion]
    created_at: datetime
    updated_at: datetime


class ExecuteSearchRequest(BaseModel):
    logic: str = "AND"
    criteria: list[SearchCriterion] = []
    sort: str = "taken_at_desc"
    limit: int = 100
    offset: int = 0
