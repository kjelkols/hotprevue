from __future__ import annotations

from sqlalchemy.orm import Query

from models.photo import Photo


class PhotoAccessFilter:
    @staticmethod
    def apply(query: Query, photographer) -> Query:
        """Filter a Photo query based on the requesting photographer's access level.

        - owner (or None/no token): no restriction
        - guest: only photos where photographer_id matches
        """
        if photographer is None or photographer.access_level == "owner":
            return query
        return query.filter(Photo.photographer_id == photographer.id)
