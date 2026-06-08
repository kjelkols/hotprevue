"""ADR-044: tilgangskontroll basert på photographers.access_level.

Tre cases:
- Ingen token (legacy eiermaskin) → passerer require_owner, ser alt
- owner-fotograf med token → ser alt, kan mutere
- guest-fotograf med token → ser kun egne bilder, 403 på skriveoperasjoner
"""
import uuid

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enroll(client, db, photographer_name="Tester", access_level="guest"):
    """Enroll a new machine and return (api_token, photographer_id)."""
    code_resp = client.post(
        "/admin/invite-codes",
        json={"photographer_name": photographer_name, "access_level": access_level, "ttl_minutes": 60},
    )
    assert code_resp.status_code == 201
    code = code_resp.json()["code"]

    enroll_resp = client.post("/auth/enroll", json={"code": code, "device_name": f"{photographer_name} iPhone"})
    assert enroll_resp.status_code == 201
    data = enroll_resp.json()
    return data["api_token"], data["photographer_id"]


def _make_photo(client, db, photographer_id: str):
    """Insert a minimal photo row directly into the DB and return its hothash."""
    from sqlalchemy import text
    from models.photo import Photo
    from models.photographer import Photographer

    photographer = db.get(Photographer, uuid.UUID(photographer_id))

    kind_id = db.execute(text("SELECT id FROM kinds WHERE is_default = true LIMIT 1")).scalar()

    hothash = uuid.uuid4().hex
    photo = Photo(
        id=uuid.uuid4(),
        hothash=hothash,
        hotpreview_b64="fake",
        photographer_id=photographer.id,
        kind_id=kind_id,
    )
    db.add(photo)
    db.commit()
    return hothash


# ---------------------------------------------------------------------------
# access_level on photographer
# ---------------------------------------------------------------------------

def test_enroll_guest_sets_access_level(client, db):
    _, photographer_id = _enroll(client, db, "Anna", "guest")
    from models.photographer import Photographer
    p = db.get(Photographer, uuid.UUID(photographer_id))
    assert p.access_level == "guest"


def test_enroll_owner_sets_access_level(client, db):
    _, photographer_id = _enroll(client, db, "Kjell", "owner")
    from models.photographer import Photographer
    p = db.get(Photographer, uuid.UUID(photographer_id))
    assert p.access_level == "owner"


# ---------------------------------------------------------------------------
# PhotoAccessFilter — GET /photos
# ---------------------------------------------------------------------------

def test_no_token_sees_all_photos(client, db):
    """Legacy owner request (no Bearer token) sees all photos."""
    _, pid_a = _enroll(client, db, "A", "guest")
    _, pid_b = _enroll(client, db, "B", "guest")
    _make_photo(client, db, pid_a)
    _make_photo(client, db, pid_b)

    r = client.get("/photos")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_owner_token_sees_all_photos(client, db):
    token, pid_owner = _enroll(client, db, "Owner", "owner")
    _, pid_guest = _enroll(client, db, "Guest", "guest")
    _make_photo(client, db, pid_owner)
    _make_photo(client, db, pid_guest)

    r = client.get("/photos", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_guest_token_sees_only_own_photos(client, db):
    token, pid_guest = _enroll(client, db, "Guest", "guest")
    _, pid_other = _enroll(client, db, "Other", "guest")

    own_hash = _make_photo(client, db, pid_guest)
    _make_photo(client, db, pid_other)

    r = client.get("/photos", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    hashes = [p["hothash"] for p in r.json()]
    assert own_hash in hashes
    assert len(hashes) == 1


# ---------------------------------------------------------------------------
# require_owner — write operations blocked for guest
# ---------------------------------------------------------------------------

def test_guest_cannot_create_event(client, db):
    token, _ = _enroll(client, db, "Guest", "guest")
    r = client.post(
        "/events",
        json={"name": "Test", "kind_id": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


def test_guest_cannot_create_collection(client, db):
    token, _ = _enroll(client, db, "Guest", "guest")
    r = client.post(
        "/collections",
        json={"name": "Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


def test_guest_cannot_create_photographer(client, db):
    token, _ = _enroll(client, db, "Guest", "guest")
    r = client.post(
        "/photographers",
        json={"name": "Ny fotograf"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


def test_owner_token_can_create_event(client, db):
    token, _ = _enroll(client, db, "Owner", "owner")
    r = client.post(
        "/events",
        json={"name": "Test event"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201


def test_no_token_can_create_event(client, db):
    """Legacy owner machine without token must still work."""
    r = client.post("/events", json={"name": "Legacy event"})
    assert r.status_code == 201


# ---------------------------------------------------------------------------
# Scenario B — enroll existing photographer
# ---------------------------------------------------------------------------

def test_enroll_existing_photographer(client, db):
    """Scenario B: invite code links to existing photographer, no duplicate created."""
    from models.photographer import Photographer

    # Create photographer directly
    p = Photographer(name="Existing", access_level="guest")
    db.add(p)
    db.commit()
    db.refresh(p)

    # Owner creates code pointing to existing photographer
    code_resp = client.post(
        "/admin/invite-codes",
        json={"target_photographer_id": str(p.id), "ttl_minutes": 60},
    )
    assert code_resp.status_code == 201
    code = code_resp.json()["code"]

    enroll_resp = client.post("/auth/enroll", json={"code": code, "device_name": "New device"})
    assert enroll_resp.status_code == 201
    data = enroll_resp.json()
    assert data["photographer_id"] == str(p.id)

    # Only one photographer with that name
    photographers = db.query(Photographer).filter(Photographer.name == "Existing").all()
    assert len(photographers) == 1


# ---------------------------------------------------------------------------
# Self-service add-machine-code
# ---------------------------------------------------------------------------

def test_add_machine_code_requires_auth(client):
    r = client.post("/auth/add-machine-code")
    assert r.status_code == 401


def test_add_machine_code_creates_code(client, db):
    token, pid = _enroll(client, db, "Anna", "guest")
    r = client.post("/auth/add-machine-code", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    data = r.json()
    assert "code" in data
    assert len(data["code"]) == 8


def test_add_machine_code_enrolls_new_machine(client, db):
    """New machine enrolled via add-machine-code belongs to same photographer."""
    from models.machine import Machine

    token, pid = _enroll(client, db, "Anna", "guest")
    add_resp = client.post("/auth/add-machine-code", headers={"Authorization": f"Bearer {token}"})
    code = add_resp.json()["code"]

    enroll_resp = client.post("/auth/enroll", json={"code": code, "device_name": "Anna Laptop"})
    assert enroll_resp.status_code == 201
    data = enroll_resp.json()
    assert data["photographer_id"] == pid

    machines = db.query(Machine).filter(Machine.photographer_id == uuid.UUID(pid)).all()
    assert len(machines) == 2
