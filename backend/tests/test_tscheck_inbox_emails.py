"""Backend coverage for 'Inbox intelligence flow' and 'Email intelligence detail'.

GET /api/emails backs the inbox table (list + search/filter via query params),
and GET /api/emails/{id} backs the detail split view, including the known
seeded suspicious email (demo-credential-risk) called out in seed_facts.
"""


def test_emails_list_returns_seeded_rows(client):
    resp = client.get("/emails")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) >= 6, "expected at least the six deterministic seeded emails"


def test_emails_list_suspicious_filter_narrows_results(client):
    all_resp = client.get("/emails")
    assert all_resp.status_code == 200
    all_items = all_resp.json()["items"]

    filtered_resp = client.get("/emails", params={"filter": "suspicious"})
    assert filtered_resp.status_code == 200, filtered_resp.text
    filtered_items = filtered_resp.json()["items"]

    assert len(filtered_items) <= len(all_items)
    assert len(filtered_items) > 0
    assert all(item.get("spam_status") == "Suspicious" for item in filtered_items)


def test_known_suspicious_seed_email_detail(client):
    resp = client.get("/emails/demo-credential-risk")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == "demo-credential-risk"
    assert data["spam_status"] == "Suspicious"
    assert data["phishing_risk"] == "High"
    assert "influencing_factors" in data and len(data["influencing_factors"]) > 0
    assert data.get("is_simulated") is True
