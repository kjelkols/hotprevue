"""Tests for POST /system/folder-event-lookup."""
import uuid

import pytest

from models.event import Event
from models.photo import ImageFile, Photo
from models.photographer import Photographer


def _make_photographer(db):
    p = Photographer(name="Testfotograf")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_event(db, name):
    e = Event(name=name)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def _make_photo(db, photographer_id, file_path, event_id=None):
    photo = Photo(
        hothash=uuid.uuid4().hex,
        hotpreview_b64="dGVzdA==",
        photographer_id=photographer_id,
        event_id=event_id,
    )
    db.add(photo)
    db.flush()
    db.add(ImageFile(photo_id=photo.id, file_path=file_path, file_type="JPEG", is_master=True))
    db.commit()
    db.refresh(photo)
    return photo


def test_folder_event_lookup_empty_paths(client):
    r = client.post("/system/folder-event-lookup", json={"paths": []})
    assert r.status_code == 200
    assert r.json() == {"matches": []}


def test_folder_event_lookup_no_match(client):
    r = client.post("/system/folder-event-lookup", json={"paths": ["/bilder/2024/Sommerfest"]})
    assert r.status_code == 200
    data = r.json()
    assert len(data["matches"]) == 1
    assert data["matches"][0]["path"] == "/bilder/2024/Sommerfest"
    assert data["matches"][0]["event"] is None


def test_folder_event_lookup_finds_event(client, db):
    p = _make_photographer(db)
    event = _make_event(db, "Sommerfest")
    _make_photo(db, p.id, "/bilder/2024/Sommerfest/IMG_001.jpg", event_id=event.id)
    _make_photo(db, p.id, "/bilder/2024/Sommerfest/IMG_002.jpg", event_id=event.id)

    r = client.post("/system/folder-event-lookup", json={"paths": ["/bilder/2024/Sommerfest"]})
    assert r.status_code == 200
    match = r.json()["matches"][0]
    assert match["event"]["id"] == str(event.id)
    assert match["event"]["name"] == "Sommerfest"


def test_folder_event_lookup_returns_most_frequent(client, db):
    p = _make_photographer(db)
    event_a = _make_event(db, "Event A")
    event_b = _make_event(db, "Event B")
    folder = "/bilder/2024/Blanding"
    _make_photo(db, p.id, f"{folder}/IMG_001.jpg", event_id=event_a.id)
    _make_photo(db, p.id, f"{folder}/IMG_002.jpg", event_id=event_b.id)
    _make_photo(db, p.id, f"{folder}/IMG_003.jpg", event_id=event_b.id)

    r = client.post("/system/folder-event-lookup", json={"paths": [folder]})
    assert r.status_code == 200
    match = r.json()["matches"][0]
    assert match["event"]["name"] == "Event B"


def test_folder_event_lookup_ignores_photos_without_event(client, db):
    p = _make_photographer(db)
    folder = "/bilder/2024/Ingen"
    _make_photo(db, p.id, f"{folder}/IMG_001.jpg", event_id=None)
    _make_photo(db, p.id, f"{folder}/IMG_002.jpg", event_id=None)

    r = client.post("/system/folder-event-lookup", json={"paths": [folder]})
    assert r.status_code == 200
    assert r.json()["matches"][0]["event"] is None


def test_folder_event_lookup_multiple_paths(client, db):
    p = _make_photographer(db)
    e1 = _make_event(db, "Bryllup")
    e2 = _make_event(db, "Julefest")
    _make_photo(db, p.id, "/bilder/bryllup/IMG_001.jpg", event_id=e1.id)
    _make_photo(db, p.id, "/bilder/julefest/IMG_001.jpg", event_id=e2.id)

    r = client.post(
        "/system/folder-event-lookup",
        json={"paths": ["/bilder/bryllup", "/bilder/julefest", "/bilder/ingenting"]},
    )
    assert r.status_code == 200
    matches = {m["path"]: m["event"] for m in r.json()["matches"]}
    assert matches["/bilder/bryllup"]["name"] == "Bryllup"
    assert matches["/bilder/julefest"]["name"] == "Julefest"
    assert matches["/bilder/ingenting"] is None
