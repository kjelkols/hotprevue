"""Tests for GET/POST/PATCH/DELETE /events."""


def test_create_event(client):
    r = client.post("/events", json={"name": "Birthday Party"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Birthday Party"
    assert data["photo_count"] == 0


def test_list_events_empty(client):
    r = client.get("/events")
    assert r.status_code == 200
    assert r.json() == []



def test_get_event(client):
    created = client.post("/events", json={"name": "Festival"}).json()
    r = client.get(f"/events/{created['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Festival"


def test_get_event_not_found(client):
    assert client.get("/events/00000000-0000-0000-0000-000000000000").status_code == 404


def test_patch_event(client):
    created = client.post("/events", json={"name": "Old Name"}).json()
    r = client.patch(f"/events/{created['id']}", json={"name": "New Name", "location": "Oslo"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["location"] == "Oslo"


def test_delete_event_removes_it(client):
    created = client.post("/events", json={"name": "Temp"}).json()
    assert client.delete(f"/events/{created['id']}").status_code == 204
    assert client.get(f"/events/{created['id']}").status_code == 404


