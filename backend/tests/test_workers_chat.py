"""Tests for POST /api/workers-chat (HR AI assistant)."""
import os
import pytest
import requests

# Backend is verified locally on 8001 per request; also try REACT_APP_BACKEND_URL fallback.
BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")

WORKER = {
    "id": "w1", "name": "Resad", "surname": "Aliyev",
    "position": "Satici", "branch": "Merkez", "isActive": True,
    "rating": 88, "monthlyTarget": 5000,
    "monthlyTotalSales": 6200, "monthlyTotalReturns": 200,
}
WORKER2 = {
    "id": "w2", "name": "Aysel", "surname": "Memmedova",
    "position": "Satici", "branch": "Genclik", "isActive": True,
    "rating": 72, "monthlyTarget": 5000,
    "monthlyTotalSales": 4100, "monthlyTotalReturns": 150,
}


def _post(body):
    return requests.post(f"{BASE_URL}/api/workers-chat", json=body, timeout=60)


def test_single_worker_grounded_reply():
    body = {
        "mode": "workers",
        "message": "En yaxsi satan iscini de",
        "language": "az",
        "workers": [WORKER],
        "fines": [],
        "rewards": [{"workerId": "w1", "type": "bonus", "amount": 300,
                     "reason": "Hedef ustu", "date": "2026-06-02"}],
        "requests": [],
        "history": [],
    }
    r = _post(body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reply" in data
    reply = data["reply"]
    assert isinstance(reply, str) and len(reply.strip()) > 20, f"Reply too short: {reply!r}"
    # Grounded: should reference Resad or numeric facts
    lower = reply.lower()
    assert ("resad" in lower or "reşad" in lower or "6200" in reply or "88" in reply), \
        f"Reply not grounded in provided worker data: {reply!r}"


def test_branch_comparison_multi_worker():
    body = {
        "mode": "workers",
        "message": "Filialları müqayisə et",
        "language": "az",
        "workers": [WORKER, WORKER2],
        "fines": [],
        "rewards": [],
        "requests": [],
        "history": [],
    }
    r = _post(body)
    assert r.status_code == 200, r.text
    data = r.json()
    reply = data.get("reply", "")
    assert isinstance(reply, str) and len(reply.strip()) > 20
    lower = reply.lower()
    # Should mention at least one of the branches provided; must not hallucinate
    mentioned = sum(x in lower for x in ["merkez", "mərkəz", "genclik", "gənclik"])
    assert mentioned >= 1, f"Reply did not reference provided branches: {reply!r}"


def test_empty_workers_graceful():
    body = {
        "mode": "workers",
        "message": "Ümumi vəziyyəti qiymətləndir",
        "language": "az",
        "workers": [],
        "fines": [],
        "rewards": [],
        "requests": [],
        "history": [],
    }
    r = _post(body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reply" in data
    assert isinstance(data["reply"], str) and len(data["reply"].strip()) > 0
