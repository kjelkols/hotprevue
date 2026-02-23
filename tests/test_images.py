"""Tests for /images endpoints."""

import pytest


@pytest.mark.asyncio
async def test_register_image(client, sample_image_path):
    resp = await client.post("/images/register", json={"file_path": sample_image_path})
    assert resp.status_code == 201
    data = resp.json()
    assert "hothash" in data
    assert data["file_path"] == sample_image_path
    assert data["hotpreview_b64"]
    assert data["tags"] == []
    assert data["rating"] is None


@pytest.mark.asyncio
async def test_register_duplicate_returns_409(client, sample_image_path):
    await client.post("/images/register", json={"file_path": sample_image_path})
    resp = await client.post("/images/register", json={"file_path": sample_image_path})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_missing_file(client):
    resp = await client.post(
        "/images/register", json={"file_path": "/nonexistent/path/image.jpg"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_image(client, sample_image_path):
    reg = await client.post("/images/register", json={"file_path": sample_image_path})
    hothash = reg.json()["hothash"]

    resp = await client.get(f"/images/{hothash}")
    assert resp.status_code == 200
    assert resp.json()["hothash"] == hothash


@pytest.mark.asyncio
async def test_get_image_not_found(client):
    resp = await client.get("/images/deadbeef" + "0" * 56)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_images(client, sample_image_path):
    await client.post("/images/register", json={"file_path": sample_image_path})
    resp = await client.get("/images")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_update_image_rating(client, sample_image_path):
    reg = await client.post("/images/register", json={"file_path": sample_image_path})
    hothash = reg.json()["hothash"]

    resp = await client.patch(f"/images/{hothash}", json={"rating": 4})
    assert resp.status_code == 200
    assert resp.json()["rating"] == 4


@pytest.mark.asyncio
async def test_update_image_tags(client, sample_image_path):
    reg = await client.post("/images/register", json={"file_path": sample_image_path})
    hothash = reg.json()["hothash"]

    resp = await client.patch(f"/images/{hothash}", json={"tags": ["landscape", "summer"]})
    assert resp.status_code == 200
    assert set(resp.json()["tags"]) == {"landscape", "summer"}


@pytest.mark.asyncio
async def test_delete_image(client, sample_image_path):
    reg = await client.post("/images/register", json={"file_path": sample_image_path})
    hothash = reg.json()["hothash"]

    resp = await client.delete(f"/images/{hothash}")
    assert resp.status_code == 204

    resp = await client.get(f"/images/{hothash}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_register_with_rating_and_tags(client, sample_image_path):
    resp = await client.post(
        "/images/register",
        json={"file_path": sample_image_path, "rating": 3, "tags": ["nature"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["rating"] == 3
    assert data["tags"] == ["nature"]
