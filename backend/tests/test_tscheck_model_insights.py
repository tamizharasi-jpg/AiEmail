"""Backend coverage for 'Model insights'.

GET /api/model-insights must return dataset statistics, model comparison
metrics, feature importance, and a confusion matrix for the model insights page.
"""


def test_model_insights_returns_full_payload(client):
    resp = client.get("/model-insights")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data.get("dataset_size", 0) > 0
    assert isinstance(data.get("metrics"), list) and len(data["metrics"]) > 0
    for model in data["metrics"]:
        assert "accuracy" in model and "f1" in model

    assert isinstance(data.get("feature_importance"), list) and len(data["feature_importance"]) > 0
    cm = data.get("confusion_matrix")
    assert isinstance(cm, list) and len(cm) == 2 and all(len(row) == 2 for row in cm)
