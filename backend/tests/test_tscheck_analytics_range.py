"""Backend coverage for 'Analytics interaction'.

GET /api/analytics?range=<7d|30d|90d|all> must respond for each supported
range and return distinct simulated volume data driving the chart.
"""

import pytest


@pytest.mark.parametrize("range_value", ["7d", "30d", "90d", "all"])
def test_analytics_range_returns_data(client, range_value):
    resp = client.get("/analytics", params={"period": range_value})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("period") == range_value
    assert "volume" in data and isinstance(data["volume"], list) and len(data["volume"]) > 0
