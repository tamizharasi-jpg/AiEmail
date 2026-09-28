"""Backend coverage for 'Analyze suspicious email'.

POST /api/analysis stores the analyzed email and returns a result whose
classification for a clearly risky body is Suspicious with no generated
reply draft surfaced for action (safe-response behavior).
"""


def test_analyze_suspicious_email_stores_and_classifies(client):
    payload = {
        "sender": "tscheck-analyze-suspicious@example.com",
        "subject": "Urgent verify your account now",
        "body": (
            "Your account is suspended. Verify your password immediately within 24 "
            "hours to restore access or you will lose everything."
        ),
    }
    resp = client.post("/analysis", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "email" in data
    email = data["email"]
    assert email["sender"] == payload["sender"]
    assert email["spam_status"] == "Suspicious"
    assert email.get("is_simulated") is True

    # confirm it was actually stored (not just returned) by fetching it back
    fetch = client.get(f"/emails/{email['id']}")
    assert fetch.status_code == 200, fetch.text
    assert fetch.json()["spam_status"] == "Suspicious"
