"""Backend coverage for the 'Premium desktop dashboard' criterion.

GET /api/overview must return the KPI/metric payload the dashboard renders,
with the simulated-data flag and populated distributions/recent analysis.
"""

import pytest


def test_overview_returns_populated_dashboard_payload(client):
    resp = client.get("/overview")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    for key in [
        "emails_analyzed",
        "spam_detected",
        "high_priority",
        "action_required",
        "inbox_health",
        "volume_trend",
        "priority_distribution",
        "category_distribution",
        "recent_analysis",
    ]:
        assert key in data, f"missing {key} in overview payload"

    assert isinstance(data["priority_distribution"], list) and len(data["priority_distribution"]) > 0
    assert isinstance(data["category_distribution"], list) and len(data["category_distribution"]) > 0
    assert isinstance(data["recent_analysis"], list) and len(data["recent_analysis"]) > 0
    # every recent analysis row must be simulated presentation data per seed_facts
    assert all(item.get("is_simulated") is True for item in data["recent_analysis"])
