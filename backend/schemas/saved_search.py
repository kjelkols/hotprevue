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
    # Always ANDed with the search expression, independent of `logic`.
    # Used by the timeline day-view to scope results to a single calendar day
    # without altering the user's OR/AND search logic. See docs/decisions/006-timeline.md.
    date_filter: str | None = None  # ISO date "YYYY-MM-DD"


class TimelineRequest(BaseModel):
    logic: str = "AND"
    criteria: list[SearchCriterion] = []


class TimelineDay(BaseModel):
    day: int
    count: int
    cover_hothash: str
    cover_hotpreview_b64: str


class TimelineMonth(BaseModel):
    month: int
    count: int
    cover_hothash: str
    cover_hotpreview_b64: str
    days: list[TimelineDay]


class TimelineYear(BaseModel):
    year: int
    count: int
    cover_hothash: str
    cover_hotpreview_b64: str
    months: list[TimelineMonth]
