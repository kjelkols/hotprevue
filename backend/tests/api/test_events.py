"""Tests for GET/POST/PATCH/DELETE /events."""


def test_create_event(client):
    r = client.post("/events", json={"name": "Birthday Party"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Birthday Party"
    assert data["parent_id"] is None
    assert data["photo_count"] == 0


def test_list_events_empty(client):
    r = client.get("/events")
    assert r.status_code == 200
    assert r.json() == []


def test_list_events_tree(client):
    parent = client.post("/events", json={"name": "Wedding"}).json()
    client.post("/events", json={"name": "Ceremony", "parent_id": parent["id"]})
    client.post("/events", json={"name": "Reception", "parent_id": parent["id"]})

    r = client.get("/events")
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 1
    assert tree[0]["name"] == "Wedding"
    children = tree[0]["children"]
    assert len(children) == 2
    assert [c["name"] for c in children] == ["Ceremony", "Reception"]


def test_cannot_nest_three_levels(client):
    parent = client.post("/events", json={"name": "Parent"}).json()
    child = client.post("/events", json={"name": "Child", "parent_id": parent["id"]}).json()
    r = client.post("/events", json={"name": "Grandchild", "parent_id": child["id"]})
    assert r.status_code == 409


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


def test_delete_event_with_children_fails(client):
    parent = client.post("/events", json={"name": "Parent"}).json()
    client.post("/events", json={"name": "Child", "parent_id": parent["id"]})
    assert client.delete(f"/events/{parent['id']}").status_code == 409


def test_patch_event_move_to_child(client):
    """Moving a root event to become a child of another root event."""
    root1 = client.post("/events", json={"name": "Root1"}).json()
    root2 = client.post("/events", json={"name": "Root2"}).json()
    r = client.patch(f"/events/{root2['id']}", json={"parent_id": root1["id"]})
    assert r.status_code == 200
    assert r.json()["parent_id"] == root1["id"]


def test_patch_event_cannot_move_parent_with_children(client):
    """Cannot make a root event with children into a child event."""
    parent = client.post("/events", json={"name": "Parent"}).json()
    client.post("/events", json={"name": "Child", "parent_id": parent["id"]})
    other = client.post("/events", json={"name": "Other"}).json()
    r = client.patch(f"/events/{parent['id']}", json={"parent_id": other["id"]})
    assert r.status_code == 409
