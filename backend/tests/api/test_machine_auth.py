"""Tests for ADR-040: maskinidentitet, invitasjonskoder og enrollment."""
from datetime import datetime, timedelta, timezone

import pytest


# ---------------------------------------------------------------------------
# Invite code management
# ---------------------------------------------------------------------------

def test_create_invite_code(client):
    r = client.post("/admin/invite-codes", json={"photographer_name": "Anna", "ttl_minutes": 60})
    assert r.status_code == 201
    data = r.json()
    assert len(data["code"]) == 8
    assert data["access_level"] == "guest"
    assert data["photographer_name"] == "Anna"
    assert data["used_at"] is None


def test_list_invite_codes(client):
    client.post("/admin/invite-codes", json={"photographer_name": "Test"})
    r = client.get("/admin/invite-codes")
    assert r.status_code == 200
    codes = r.json()
    assert len(codes) >= 1


def test_delete_unused_invite_code(client):
    code = client.post("/admin/invite-codes", json={}).json()
    r = client.delete(f"/admin/invite-codes/{code['id']}")
    assert r.status_code == 204
    # Verifiser at den er borte
    all_codes = client.get("/admin/invite-codes").json()
    assert all(c["id"] != code["id"] for c in all_codes)


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

def test_enroll_success(client):
    code = client.post("/admin/invite-codes", json={"photographer_name": "Anna", "ttl_minutes": 60}).json()
    r = client.post("/auth/enroll", json={"code": code["code"], "device_name": "Annas iPhone"})
    assert r.status_code == 201
    data = r.json()
    assert "api_token" in data
    assert data["api_token"].startswith("hp_")
    assert data["photographer_name"] == "Anna"


def test_enroll_marks_code_used(client):
    code = client.post("/admin/invite-codes", json={"photographer_name": "Bob"}).json()
    client.post("/auth/enroll", json={"code": code["code"]})
    # Bruk koden på nytt → 410
    r = client.post("/auth/enroll", json={"code": code["code"]})
    assert r.status_code == 410


def test_enroll_unknown_code(client):
    r = client.post("/auth/enroll", json={"code": "XXXXXXXX"})
    assert r.status_code == 404


def test_enroll_expired_code(client, db):
    from models.machine import MachineInviteCode
    import secrets
    import uuid
    code_str = "EX" + secrets.token_hex(3).upper()
    expired = MachineInviteCode(
        id=uuid.uuid4(),
        code=code_str,
        access_level="guest",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(expired)
    db.commit()
    r = client.post("/auth/enroll", json={"code": code_str})
    assert r.status_code == 410


def test_enroll_creates_machine_and_photographer(client, db):
    from models.machine import Machine
    from models.photographer import Photographer
    code = client.post("/admin/invite-codes", json={"photographer_name": "Eva"}).json()
    result = client.post("/auth/enroll", json={"code": code["code"], "device_name": "Eva Laptop"}).json()

    machine = db.query(Machine).filter(Machine.machine_id == result["machine_id"]).first()
    assert machine is not None
    assert machine.machine_name == "Eva Laptop"

    photographer = db.get(Photographer, result["photographer_id"])
    assert photographer is not None
    assert photographer.name == "Eva"
    assert photographer.access_level == "guest"


# ---------------------------------------------------------------------------
# Admin: list machines
# ---------------------------------------------------------------------------

def test_list_machines_admin(client):
    r = client.get("/admin/machines")
    assert r.status_code == 200
    machines = r.json()
    assert isinstance(machines, list)
    for m in machines:
        assert "machine_id" in m


def test_revoke_nonexistent_machine_token(client):
    r = client.delete("/admin/machines/00000000-0000-0000-0000-000000000000/token")
    assert r.status_code == 404


def test_revoke_machine_token(client, db):
    from models.machine import Machine, MachineToken
    import uuid
    # Enroll a guest to get a machine with a token
    code = client.post("/admin/invite-codes", json={"photographer_name": "Revoke Test"}).json()
    result = client.post("/auth/enroll", json={"code": code["code"]}).json()
    machine_id = result["machine_id"]

    # Verify token exists and is active
    tokens_before = db.query(MachineToken).filter(
        MachineToken.machine_id == machine_id,
        MachineToken.is_active.is_(True),
    ).count()
    assert tokens_before == 1

    r = client.delete(f"/admin/machines/{machine_id}/token")
    assert r.status_code == 204

    tokens_after = db.query(MachineToken).filter(
        MachineToken.machine_id == machine_id,
        MachineToken.is_active.is_(True),
    ).count()
    assert tokens_after == 0
