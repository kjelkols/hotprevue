"""Tests for /events endpoints."""

import pytest


@pytest.mark.asyncio
async def test_create_event(client):
    resp = await client.post("/events", json={"name": "Summer 2024"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Summer 2024"
    assert "id" in data
    assert data["image_count"] == 0


@pytest.mark.asyncio
async def test_list_events(client):
    await client.post("/events", json={"name": "Event A"})
    await client.post("/events", json={"name": "Event B"})
    resp = await client.get("/events")
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert "Event A" in names
    assert "Event B" in names


@pytest.mark.asyncio
async def test_get_event(client):
    created = (await client.post("/events", json={"name": "My Event"})).json()
    event_id = created["id"]

    resp = await client.get(f"/events/{event_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Event"
    assert resp.json()["images"] == []


@pytest.mark.asyncio
async def test_get_event_not_found(client):
    resp = await client.get("/events/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_event(client):
    created = (await client.post("/events", json={"name": "Old Name"})).json()
    event_id = created["id"]

    resp = await client.patch(f"/events/{event_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_event(client):
    created = (await client.post("/events", json={"name": "To Delete"})).json()
    event_id = created["id"]

    resp = await client.delete(f"/events/{event_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/events/{event_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_event_keeps_images(client, sample_image_path):
    """Deleting an event must not delete its images — only null out event_id."""
    event = (await client.post("/events", json={"name": "With Images"})).json()
    event_id = event["id"]

    img = (
        await client.post(
            "/images/register",
            json={"file_path": sample_image_path, "event_id": event_id},
        )
    ).json()
    hothash = img["hothash"]

    await client.delete(f"/events/{event_id}")

    resp = await client.get(f"/images/{hothash}")
    assert resp.status_code == 200
    assert resp.json()["event_id"] is None


@pytest.mark.asyncio
async def test_event_hierarchy(client):
    parent = (await client.post("/events", json={"name": "Parent"})).json()
    parent_id = parent["id"]

    child = (
        await client.post("/events", json={"name": "Child", "parent_id": parent_id})
    ).json()
    assert child["parent_id"] == parent_id


@pytest.mark.asyncio
async def test_create_event_invalid_parent(client):
    resp = await client.post(
        "/events",
        json={"name": "Orphan", "parent_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_event_image_count(client, sample_image_path):
    event = (await client.post("/events", json={"name": "Counted"})).json()
    event_id = event["id"]

    await client.post(
        "/images/register",
        json={"file_path": sample_image_path, "event_id": event_id},
    )

    events = (await client.get("/events")).json()
    target = next(e for e in events if e["id"] == event_id)
    assert target["image_count"] == 1
